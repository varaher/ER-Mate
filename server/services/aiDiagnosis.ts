import OpenAI from "openai";
import { randomUUID } from "crypto";
import { getDb } from "../db";
import { aiFeedback } from "@shared/schema";
import { count, eq, sql } from "drizzle-orm";
import { searchMedicalLiterature, type MedicalSearchResult } from "./medicalSearch";

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  
  if (!apiKey || !baseURL) {
    console.warn("OpenAI API not configured - AI_INTEGRATIONS_OPENAI_API_KEY or AI_INTEGRATIONS_OPENAI_BASE_URL missing");
    return null;
  }
  
  return new OpenAI({ apiKey, baseURL });
}

export interface Citation {
  id: string;
  source: string;
  title: string;
  year?: string;
  url?: string;
  excerpt: string;
  sourceType?: "pubmed" | "textbook" | "guideline" | "wikem";
  authors?: string;
  refNumber?: number;
}

export interface DiagnosisSuggestion {
  id: string;
  diagnosis: string;
  confidence: "high" | "moderate" | "low";
  severity_rank: number;
  reasoning: string;
  keyFindings: string[];
  workup: string[];
  management: string[];
  citations: Citation[];
}

export interface RedFlag {
  id: string;
  flag: string;
  severity: "critical" | "warning";
  action: string;
  timeframe?: string;
  citations: Citation[];
}

export interface SearchSource {
  id: string;
  title: string;
  source: string;
  authors?: string;
  year?: string;
  url: string;
  sourceType: "pubmed" | "textbook" | "guideline" | "wikem";
}

export interface AIFeedback {
  suggestionId: string;
  caseId: string;
  feedbackType: "accepted" | "modified" | "rejected";
  userCorrection?: string;
  suggestionText?: string;
  timestamp: Date;
  userId?: string;
}

interface ABGData {
  sampleType?: string;
  ph?: string;
  pco2?: string;
  po2?: string;
  hco3?: string;
  be?: string;
  lactate?: string;
  sao2?: string;
  fio2?: string;
  na?: string;
  k?: string;
  cl?: string;
  anionGap?: string;
  glucose?: string;
  hb?: string;
  aaGradient?: string;
  interpretation?: string;
  status?: string;
}

function formatABGData(abgData?: ABGData): string {
  if (!abgData) return "";
  const parts: string[] = [];
  if (abgData.sampleType) parts.push(`Sample: ${abgData.sampleType}`);
  if (abgData.ph) parts.push(`pH: ${abgData.ph}`);
  if (abgData.pco2) parts.push(`pCO2: ${abgData.pco2} mmHg`);
  if (abgData.po2) parts.push(`pO2: ${abgData.po2} mmHg`);
  if (abgData.hco3) parts.push(`HCO3: ${abgData.hco3} mEq/L`);
  if (abgData.be) parts.push(`BE: ${abgData.be} mEq/L`);
  if (abgData.lactate) parts.push(`Lactate: ${abgData.lactate} mmol/L`);
  if (abgData.sao2) parts.push(`SaO2: ${abgData.sao2}%`);
  if (abgData.fio2) parts.push(`FiO2: ${abgData.fio2}%`);
  if (abgData.na) parts.push(`Na: ${abgData.na} mEq/L`);
  if (abgData.k) parts.push(`K: ${abgData.k} mEq/L`);
  if (abgData.cl) parts.push(`Cl: ${abgData.cl} mEq/L`);
  if (abgData.anionGap) parts.push(`Anion Gap: ${abgData.anionGap}`);
  if (abgData.glucose) parts.push(`Glucose: ${abgData.glucose} mg/dL`);
  if (abgData.hb) parts.push(`Hb: ${abgData.hb} g/dL`);
  if (abgData.aaGradient) parts.push(`A-a Gradient: ${abgData.aaGradient} mmHg`);
  if (abgData.status && abgData.status !== "not_done") parts.push(`Interpretation: ${abgData.status.replace(/_/g, " ")}`);
  if (abgData.interpretation) parts.push(`Clinical Note: ${abgData.interpretation}`);
  return parts.length > 0 ? parts.join(", ") : "";
}

function buildSourcesContext(searchResults: MedicalSearchResult[]): string {
  if (searchResults.length === 0) return "";

  let context = "\n\n## MEDICAL LITERATURE SEARCH RESULTS (use these as references)\n";
  searchResults.forEach((result, index) => {
    context += `\n[${index + 1}] ${result.title}`;
    if (result.authors) context += ` - ${result.authors}`;
    if (result.year) context += ` (${result.year})`;
    context += `\n    Source: ${result.source}`;
    context += `\n    URL: ${result.url}`;
    if (result.snippet) context += `\n    Summary: ${result.snippet}`;
    context += "\n";
  });

  return context;
}

export async function generateDiagnosisSuggestions(caseData: {
  chiefComplaint: string;
  vitals: Record<string, string>;
  history: string;
  examination: string;
  age: number;
  gender: string;
  abgData?: ABGData;
}): Promise<{ suggestions: DiagnosisSuggestion[]; redFlags: RedFlag[]; sources: SearchSource[] }> {
  const isPediatric = caseData.age <= 16;
  const abgInfo = formatABGData(caseData.abgData);

  console.log("[AI Diagnosis] Searching medical literature for:", caseData.chiefComplaint);
  let searchResults: MedicalSearchResult[] = [];
  try {
    searchResults = await searchMedicalLiterature(
      caseData.chiefComplaint,
      caseData.age,
      caseData.history?.substring(0, 200)
    );
    console.log(`[AI Diagnosis] Found ${searchResults.length} medical references`);
  } catch (err) {
    console.warn("[AI Diagnosis] Medical literature search failed:", err);
  }

  const sourcesContext = buildSourcesContext(searchResults);

  const sources: SearchSource[] = searchResults.map((r) => ({
    id: r.id,
    title: r.title,
    source: r.source,
    authors: r.authors,
    year: r.year,
    url: r.url,
    sourceType: r.sourceType,
  }));

  const systemPrompt = `You are an expert emergency medicine physician and clinical decision support system. You have been trained on emergency medicine textbooks including Tintinalli's Emergency Medicine, Rosen's Emergency Medicine, and current clinical practice guidelines.

Your role is to analyze the patient case using evidence-based medicine and provide:
1. EXACTLY 5 provisional diagnoses ranked by SEVERITY (most severe/life-threatening FIRST, least severe LAST)
2. Red flags requiring immediate attention with specific time-sensitive actions
3. For EACH diagnosis: key supporting findings, recommended workup, and initial management

CRITICAL INSTRUCTIONS:
- You MUST provide exactly 5 provisional diagnoses, no more, no less
- Rank them by SEVERITY (1 = most severe/dangerous, 5 = least severe/benign), NOT by likelihood
- The first diagnosis should be the most life-threatening condition to rule out
- The last diagnosis should be the most benign possibility
- Cite specific sources using reference numbers [1], [2], etc. from the provided medical literature search results
- Each diagnosis reasoning MUST include inline citations like "According to [1], ..." or "Per Tintinalli's [2], ..."
- Include specific diagnostic criteria, clinical decision rules, and guideline recommendations
- For red flags, cite the specific guideline that defines the criteria (e.g., "SIRS criteria per Surviving Sepsis Campaign [3]")
- Think like a senior EM attending teaching a resident - explain WHY each diagnosis is considered

Patient is ${isPediatric ? "PEDIATRIC (age <= 16, use PALS protocols, weight-based dosing)" : "ADULT (use ATLS protocols)"}.
${sourcesContext}

Respond in JSON format with EXACTLY 5 suggestions ranked by severity (index 0 = most severe, index 4 = least severe):
{
  "suggestions": [
    {
      "diagnosis": "Most severe/life-threatening diagnosis to rule out",
      "severity_rank": 1,
      "confidence": "high|moderate|low",
      "reasoning": "Detailed clinical reasoning with inline citations [1], [2]. Explain the pathophysiology, why this patient's presentation matches, and key distinguishing features from the differential. Reference specific textbook chapters or guideline criteria.",
      "keyFindings": ["Finding 1 that supports this diagnosis", "Finding 2", "Finding 3"],
      "workup": ["Investigation 1 to order", "Investigation 2", "Lab/imaging 3"],
      "management": ["Initial management step 1", "Step 2", "Disposition consideration"],
      "citationRefs": [1, 3, 5]
    },
    { "diagnosis": "2nd most severe...", "severity_rank": 2, "confidence": "...", "reasoning": "...", "keyFindings": [], "workup": [], "management": [], "citationRefs": [] },
    { "diagnosis": "3rd...", "severity_rank": 3, "confidence": "...", "reasoning": "...", "keyFindings": [], "workup": [], "management": [], "citationRefs": [] },
    { "diagnosis": "4th...", "severity_rank": 4, "confidence": "...", "reasoning": "...", "keyFindings": [], "workup": [], "management": [], "citationRefs": [] },
    { "diagnosis": "Least severe/most benign diagnosis", "severity_rank": 5, "confidence": "...", "reasoning": "...", "keyFindings": [], "workup": [], "management": [], "citationRefs": [] }
  ],
  "redFlags": [
    {
      "flag": "Critical finding description",
      "severity": "critical|warning",
      "action": "Specific immediate action required - be precise (e.g., 'Obtain STAT ECG and troponin, activate cath lab if STEMI')",
      "timeframe": "Within X minutes/hours",
      "citationRefs": [2, 4]
    }
  ]
}`;

  const userPrompt = `Patient Case:
- Age: ${caseData.age} years, Gender: ${caseData.gender}
- Chief Complaint: ${caseData.chiefComplaint}
- Vitals: ${JSON.stringify(caseData.vitals)}
- History: ${caseData.history}
- Examination: ${caseData.examination}${abgInfo ? `\n- ABG/VBG: ${abgInfo}` : ""}

Analyze this case thoroughly. Provide differential diagnoses with evidence-based reasoning, cite the medical literature provided, identify all red flags, and recommend workup and management for each diagnosis.${abgInfo ? " Consider the ABG values carefully - analyze acid-base status, oxygenation, electrolytes, and their implications for the differential." : ""}`;

  const openai = getOpenAIClient();
  if (!openai) {
    return { suggestions: [], redFlags: [], sources };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { suggestions: [], redFlags: [], sources };
    }

    const parsed = JSON.parse(content);

    const suggestions: DiagnosisSuggestion[] = (parsed.suggestions || []).map((s: any, index: number) => {
      const citationRefs: number[] = s.citationRefs || [];
      const citations: Citation[] = citationRefs
        .filter((refNum: number) => refNum >= 1 && refNum <= searchResults.length)
        .map((refNum: number) => {
          const source = searchResults[refNum - 1];
          return {
            id: source.id,
            source: source.source,
            title: source.title,
            year: source.year,
            url: source.url,
            excerpt: source.snippet,
            sourceType: source.sourceType,
            authors: source.authors,
            refNumber: refNum,
          };
        });

      return {
        id: randomUUID(),
        diagnosis: s.diagnosis,
        confidence: s.confidence as "high" | "moderate" | "low",
        severity_rank: s.severity_rank || (index + 1),
        reasoning: s.reasoning,
        keyFindings: s.keyFindings || [],
        workup: s.workup || [],
        management: s.management || [],
        citations,
      };
    });

    const redFlags: RedFlag[] = (parsed.redFlags || []).map((r: any) => {
      const citationRefs: number[] = r.citationRefs || [];
      const citations: Citation[] = citationRefs
        .filter((refNum: number) => refNum >= 1 && refNum <= searchResults.length)
        .map((refNum: number) => {
          const source = searchResults[refNum - 1];
          return {
            id: source.id,
            source: source.source,
            title: source.title,
            year: source.year,
            url: source.url,
            excerpt: source.snippet,
            sourceType: source.sourceType,
            authors: source.authors,
            refNumber: refNum,
          };
        });

      return {
        id: randomUUID(),
        flag: r.flag,
        severity: r.severity as "critical" | "warning",
        action: r.action,
        timeframe: r.timeframe,
        citations,
      };
    });

    return { suggestions, redFlags, sources };
  } catch (error) {
    console.error("AI Diagnosis error:", error);
    return { suggestions: [], redFlags: [], sources };
  }
}

export interface FeedbackResult {
  success: boolean;
  error?: string;
}

export async function recordFeedback(feedback: AIFeedback): Promise<FeedbackResult> {
  const db = getDb();
  
  if (!db) {
    console.error("DATABASE_URL not configured - feedback feature unavailable");
    return { 
      success: false, 
      error: "Database not configured. Self-learning feedback feature is unavailable." 
    };
  }

  try {
    await db.insert(aiFeedback).values({
      suggestionId: feedback.suggestionId,
      caseId: feedback.caseId,
      feedbackType: feedback.feedbackType,
      userCorrection: feedback.userCorrection,
      suggestionText: feedback.suggestionText,
      userId: feedback.userId,
    });
    console.log(`Feedback persisted to database: ${feedback.feedbackType} for suggestion ${feedback.suggestionId}`);
    return { success: true };
  } catch (error) {
    console.error("Database insert failed:", error);
    return { 
      success: false, 
      error: "Failed to save feedback to database. Please try again." 
    };
  }
}

export async function getFeedbackStats(): Promise<{
  total: number;
  accepted: number;
  modified: number;
  rejected: number;
  acceptanceRate: number;
  available: boolean;
}> {
  const db = getDb();
  if (!db) {
    return { total: 0, accepted: 0, modified: 0, rejected: 0, acceptanceRate: 0, available: false };
  }

  try {
    const totalResult = await db.select({ count: count() }).from(aiFeedback);
    const acceptedResult = await db.select({ count: count() }).from(aiFeedback).where(eq(aiFeedback.feedbackType, "accepted"));
    const modifiedResult = await db.select({ count: count() }).from(aiFeedback).where(eq(aiFeedback.feedbackType, "modified"));
    const rejectedResult = await db.select({ count: count() }).from(aiFeedback).where(eq(aiFeedback.feedbackType, "rejected"));
    
    const total = totalResult[0]?.count || 0;
    const accepted = acceptedResult[0]?.count || 0;
    const modified = modifiedResult[0]?.count || 0;
    const rejected = rejectedResult[0]?.count || 0;
    
    return {
      total,
      accepted,
      modified,
      rejected,
      acceptanceRate: total > 0 ? (accepted / total) * 100 : 0,
      available: true,
    };
  } catch (error) {
    console.error("Failed to get feedback stats from database:", error);
    return { total: 0, accepted: 0, modified: 0, rejected: 0, acceptanceRate: 0, available: false };
  }
}

export async function getLearningInsights(): Promise<string[]> {
  const insights: string[] = [];
  const db = getDb();
  
  if (!db) {
    insights.push("Self-learning analytics unavailable - database not configured");
    return insights;
  }

  try {
    const corrections = await db.select()
      .from(aiFeedback)
      .where(eq(aiFeedback.feedbackType, "modified"));
    
    const correctionCount = corrections.filter(f => f.userCorrection).length;
    
    if (correctionCount > 0) {
      insights.push(`${correctionCount} diagnoses have been corrected by clinicians`);
    }
    
    const stats = await getFeedbackStats();
    if (stats.acceptanceRate < 70 && stats.total > 10) {
      insights.push("AI suggestions need improvement - acceptance rate below 70%");
    } else if (stats.acceptanceRate >= 90 && stats.total > 10) {
      insights.push("AI suggestions performing well - 90%+ acceptance rate");
    }
  } catch (error) {
    console.error("Failed to get learning insights from database:", error);
    insights.push("Unable to load learning insights");
  }
  
  return insights;
}

export interface DischargeSummaryInput {
  patient?: {
    name?: string;
    age?: number;
    gender?: string;
  };
  chief_complaint?: string;
  diagnosis?: string;
  treatment_given?: string;
  medications?: any;
  investigations?: any;
  vitals?: Record<string, string>;
  examination?: Record<string, any>;
  procedures?: string;
  primary_assessment?: Record<string, string>;
  history_of_present_illness?: string;
  past_medical_history?: string;
  allergy?: string;
  disposition_type?: string;
  condition_at_discharge?: string;
}

export async function generateCourseInHospital(summaryData: DischargeSummaryInput): Promise<{ course_in_hospital: string; diagnosis?: string }> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    throw new Error("AI service not available - OpenAI not configured");
  }

  const patientInfo = summaryData.patient
    ? `${summaryData.patient.age || "unknown age"} year old ${summaryData.patient.gender || "patient"}`
    : "Patient";

  const medicationsText = Array.isArray(summaryData.medications)
    ? summaryData.medications.map((m: any) => `${m.name || ""} ${m.dose || ""} ${m.route || ""} ${m.frequency || ""}`).filter(Boolean).join(", ")
    : (typeof summaryData.medications === "string" ? summaryData.medications : "") || "";

  const investigationsText = Array.isArray(summaryData.investigations)
    ? summaryData.investigations.map((i: any) => `${i.name || i.test || ""}: ${i.result || i.value || "pending"}`).filter(Boolean).join(", ")
    : (typeof summaryData.investigations === "string" ? summaryData.investigations : "") || "";

  const vitalsText = summaryData.vitals 
    ? Object.entries(summaryData.vitals).filter(([_, v]) => v).map(([k, v]) => `${k.toUpperCase()}: ${v}`).join(", ")
    : "";

  const primaryAssessmentText = summaryData.primary_assessment
    ? Object.entries(summaryData.primary_assessment).filter(([_, v]) => v).map(([k, v]) => `${k}: ${v}`).join("; ")
    : "";

  const prompt = `You are a senior emergency medicine physician writing a discharge summary. Generate a professional "Course in Hospital" section based on the following case details.

CRITICAL RULES:
- ONLY describe what is documented below. Do NOT assume, infer, or add any treatments, medications, or procedures that are not explicitly listed.
- If a medication was given as an injection (Inj.), do NOT say it was given as a tablet (Tab.) or vice versa. Use the exact route/form documented.
- If no medications are documented, simply state "No specific medications were administered in the ER."
- Do NOT add any clinical decisions, reasoning, or treatment plans that are not documented below.
- Be strictly factual. No fabrication or speculation.

Patient: ${patientInfo}
Chief Complaint: ${summaryData.chief_complaint || "Not specified"}
History of Present Illness: ${summaryData.history_of_present_illness || "Not documented"}
Past Medical History: ${summaryData.past_medical_history || "None"}
Allergies: ${summaryData.allergy || "NKDA"}
Vitals at Arrival: ${vitalsText || "Not documented"}
Primary Assessment (ABCDE): ${primaryAssessmentText || "Not documented"}
Working Diagnosis: ${summaryData.diagnosis || "To be determined"}
Medications Administered: ${medicationsText || "None documented"}
Investigations: ${investigationsText || "None documented"}
Procedures: ${summaryData.procedures || "None"}
Disposition: ${summaryData.disposition_type || "Not specified"}
Condition at Discharge: ${summaryData.condition_at_discharge || "Not specified"}

Write a concise, professional clinical narrative (2-4 paragraphs) describing:
1. Presentation and initial assessment
2. Investigations performed and key findings (only if documented)
3. Treatment provided - list ONLY the exact medications/interventions documented above
4. Clinical response and disposition

Use professional medical terminology. Be strictly factual based ONLY on the data provided above.

Respond in JSON format:
{
  "course_in_hospital": "The detailed course narrative...",
  "diagnosis": "Refined diagnosis based on the case (if chief complaint suggests one)"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an experienced emergency medicine physician assistant helping with discharge documentation." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }

    const result = JSON.parse(content);
    return {
      course_in_hospital: result.course_in_hospital || "",
      diagnosis: result.diagnosis,
    };
  } catch (error) {
    console.error("Failed to generate course in hospital:", error);
    throw new Error("Failed to generate discharge summary content");
  }
}

export interface ExtractedClinicalData {
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  pastMedicalHistory?: string;
  allergies?: string;
  medications?: string;
  symptoms?: string[];
  painDetails?: {
    location?: string;
    severity?: string;
    character?: string;
    onset?: string;
    duration?: string;
  };
  vitalsSuggested?: {
    bp?: string;
    hr?: string;
    rr?: string;
    spo2?: string;
    temperature?: string;
  };
  examFindings?: {
    general?: string;
    cvs?: string;
    respiratory?: string;
    abdomen?: string;
    cns?: string;
  };
  diagnosis?: string[];
  treatmentNotes?: string;
  rawTranscription?: string;
}

export async function extractClinicalDataFromVoice(
  transcription: string,
  patientContext?: { age?: number; sex?: string; chiefComplaint?: string }
): Promise<ExtractedClinicalData> {
  const openai = getOpenAIClient();
  if (!openai) {
    console.warn("OpenAI not configured - returning raw transcription only");
    return { rawTranscription: transcription };
  }

  const contextInfo = patientContext
    ? `Patient context: ${patientContext.age || "unknown"} year old ${patientContext.sex || "patient"}, presenting with: ${patientContext.chiefComplaint || "not specified"}`
    : "No patient context provided";

  const prompt = `You are a clinical documentation assistant for an Emergency Room physician. Extract structured clinical information from the following voice dictation and organize it into appropriate case sheet fields.

${contextInfo}

Voice dictation transcript:
"${transcription}"

Extract and categorize any mentioned clinical information into the following structure. Only include fields that have relevant information mentioned in the transcript. Be accurate and use medical terminology appropriately.

Respond in JSON format:
{
  "chiefComplaint": "Main presenting complaint if mentioned",
  "historyOfPresentIllness": "Detailed HPI narrative if mentioned",
  "pastMedicalHistory": "PMH if mentioned (diabetes, hypertension, etc.)",
  "allergies": "Drug/food allergies if mentioned",
  "medications": "Current medications if mentioned",
  "symptoms": ["Array of symptoms mentioned"],
  "painDetails": {
    "location": "Where the pain is",
    "severity": "Pain severity/score if mentioned",
    "character": "Nature of pain (sharp, dull, etc.)",
    "onset": "When it started",
    "duration": "How long"
  },
  "examFindings": {
    "general": "General examination findings if mentioned",
    "cvs": "Cardiovascular findings if mentioned",
    "respiratory": "Respiratory findings if mentioned",
    "abdomen": "Abdominal findings if mentioned",
    "cns": "Neurological findings if mentioned"
  },
  "diagnosis": ["Possible diagnoses mentioned"],
  "treatmentNotes": "Any treatment plans or notes mentioned"
}

Only include fields that have actual content from the transcript. Omit empty or irrelevant fields.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: "You are a precise clinical documentation assistant. Extract only the information that is explicitly stated or strongly implied in the voice transcript. Do not invent or assume information." 
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }

    const extracted = JSON.parse(content) as ExtractedClinicalData;
    extracted.rawTranscription = transcription;
    return extracted;
  } catch (error) {
    console.error("Failed to extract clinical data:", error);
    return { rawTranscription: transcription };
  }
}

export async function interpretABG(
  abgValues: string,
  patientContext?: { age?: string | number; sex?: string; presenting_complaint?: string }
): Promise<string> {
  const openai = getOpenAIClient();
  if (!openai) {
    return "AI interpretation unavailable - OpenAI API not configured. Manual interpretation required.";
  }

  const prompt = `You are an expert emergency medicine physician. Interpret the following ABG/VBG values and provide a clear clinical interpretation.

ABG Values: ${abgValues}
${patientContext?.age ? `Patient Age: ${patientContext.age}` : ""}
${patientContext?.sex ? `Patient Sex: ${patientContext.sex}` : ""}
${patientContext?.presenting_complaint ? `Presenting Complaint: ${patientContext.presenting_complaint}` : ""}

Provide a concise interpretation including:
1. Acid-base status (respiratory/metabolic acidosis/alkalosis, mixed disorder)
2. Oxygenation assessment
3. Compensation status (compensated, partially compensated, uncompensated)
4. Clinical significance and likely causes
5. Suggested actions if critical

Use the stepwise approach:
1. Check pH (acidemia <7.35, alkalemia >7.45)
2. Check primary disorder (pCO2 for respiratory, HCO3 for metabolic)
3. Check compensation (Winter's formula for metabolic, expected changes for respiratory)
4. Check anion gap if metabolic acidosis
5. Consider delta ratio if high anion gap

Be concise but clinically relevant. Format as a clear, readable paragraph.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: "You are an expert emergency medicine physician providing ABG interpretation. Be concise, clinically relevant, and actionable." 
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    return response.choices[0]?.message?.content || "Unable to interpret ABG values";
  } catch (error) {
    console.error("ABG interpretation error:", error);
    return "Error interpreting ABG values. Please try again or interpret manually.";
  }
}

export interface ImageExtractedData {
  chiefComplaint?: string;
  hpiNotes?: string;
  allergies?: string;
  pastMedicalHistory?: string;
  medications?: string;
  vitals?: {
    hr?: string;
    bp?: string;
    rr?: string;
    spo2?: string;
    temp?: string;
    grbs?: string;
  };
  abgValues?: {
    ph?: string;
    pco2?: string;
    po2?: string;
    hco3?: string;
    be?: string;
    lactate?: string;
    sao2?: string;
    fio2?: string;
    na?: string;
    k?: string;
    cl?: string;
    anionGap?: string;
    glucose?: string;
    hb?: string;
  };
  labResults?: string;
  imagingResults?: string;
  diagnosis?: string;
  treatmentNotes?: string;
  generalNotes?: string;
}

export async function extractClinicalDataFromImage(
  imageBase64: string,
  patientContext?: { patientAge?: number; patientSex?: string; presentingComplaint?: string }
): Promise<ImageExtractedData> {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error("AI service not available");
  }

  const contextInfo = patientContext
    ? `Patient context: ${patientContext.patientAge ? `Age ${patientContext.patientAge}` : ""}${patientContext.patientSex ? `, ${patientContext.patientSex}` : ""}${patientContext.presentingComplaint ? `. Presenting complaint: ${patientContext.presentingComplaint}` : ""}`
    : "";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a clinical documentation assistant for an Emergency Room. Your task is to analyze images of clinical documents (lab reports, referral notes, prescriptions, ABG results, handwritten notes, discharge summaries) and extract structured clinical data.

Extract ONLY information that is clearly visible and readable in the image. Do not guess or make up values. If a field is not present or not readable, omit it from the response.

For ABG reports specifically, look for: pH, pCO2, pO2, HCO3, BE (Base Excess), Lactate, SaO2, FiO2, Na, K, Cl, Anion Gap, Glucose, Hb.

For lab reports, look for: Complete blood count values, metabolic panel, liver function tests, renal function tests.

For vitals, look for: Heart rate, blood pressure, respiratory rate, SpO2, temperature, blood glucose.

${contextInfo}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this clinical document image and extract all relevant medical data. Respond in JSON format:
{
  "chiefComplaint": "Main presenting complaint if visible",
  "hpiNotes": "History details if present",
  "allergies": "Any allergies mentioned",
  "pastMedicalHistory": "Past medical history if mentioned",
  "medications": "Current medications if listed",
  "vitals": {
    "hr": "Heart rate value with units",
    "bp": "Blood pressure (systolic/diastolic)",
    "rr": "Respiratory rate",
    "spo2": "Oxygen saturation percentage",
    "temp": "Temperature with units",
    "grbs": "Blood glucose value"
  },
  "abgValues": {
    "ph": "pH value",
    "pco2": "pCO2 value",
    "po2": "pO2 value",
    "hco3": "HCO3/Bicarbonate value",
    "be": "Base excess value",
    "lactate": "Lactate value",
    "sao2": "SaO2 percentage",
    "fio2": "FiO2 percentage",
    "na": "Sodium value",
    "k": "Potassium value",
    "cl": "Chloride value",
    "anionGap": "Anion gap value",
    "glucose": "Glucose value",
    "hb": "Hemoglobin value"
  },
  "labResults": "Summary of other lab results (CBC, metabolic panel, etc.)",
  "imagingResults": "Any imaging findings mentioned",
  "diagnosis": "Diagnosis or impression if stated",
  "treatmentNotes": "Treatment recommendations if present",
  "generalNotes": "Any other relevant clinical information"
}

Only include fields with actual values extracted from the image. Omit empty fields entirely.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }

    return JSON.parse(content) as ImageExtractedData;
  } catch (error) {
    console.error("Image extraction error:", error);
    throw new Error("Failed to extract data from image");
  }
}

export interface VoiceTranscriptionResult {
  transcript: string;
  structured?: ExtractedClinicalData;
}

export async function transcribeAndExtractVoice(
  audioBuffer: Buffer,
  filename: string,
  patientContext?: { age?: number; sex?: string; chiefComplaint?: string },
  mode: string = 'full'
): Promise<VoiceTranscriptionResult> {
  let transcript = '';

  const { convertAudioToWav } = await import('./audioConvert');
  const converted = await convertAudioToWav(audioBuffer, filename);
  const wavBuffer = converted.buffer;
  const wavFilename = converted.filename;

  const { isSarvamAvailable, sarvamSpeechToTextTranslate } = await import('./sarvamAI');
  
  if (isSarvamAvailable()) {
    try {
      console.log("[Voice] Using Sarvam AI for speech-to-text (optimized for Indian accents)");
      const sarvamResult = await sarvamSpeechToTextTranslate(wavBuffer, wavFilename);
      transcript = sarvamResult.transcript || '';
      console.log("[Voice] Sarvam STT success, detected language:", sarvamResult.language_code);
    } catch (sarvamError) {
      console.warn("[Voice] Sarvam STT failed, falling back to OpenAI Whisper:", sarvamError);
      transcript = await fallbackWhisperTranscribe(wavBuffer, wavFilename);
    }
  } else {
    console.log("[Voice] Sarvam AI not configured, using OpenAI Whisper");
    transcript = await fallbackWhisperTranscribe(wavBuffer, wavFilename);
  }

  if (!transcript || transcript.trim().length === 0) {
    return { transcript: 'No speech detected in the recording.' };
  }

  if (mode === 'full') {
    const structured = await extractClinicalDataFromVoice(transcript, patientContext);
    return { transcript, structured };
  }

  return { transcript };
}

export interface SmartDictationResult {
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  onset?: string;
  duration?: string;
  progression?: string;
  associatedSymptoms?: string;
  negativeSymptoms?: string;
  pastMedicalHistory?: string;
  pastSurgicalHistory?: string;
  allergies?: string;
  currentMedications?: string;
  familyHistory?: string;
  socialHistory?: string;
  menstrualHistory?: string;
  immunizationHistory?: string;
  birthHistory?: string;
  feedingHistory?: string;
  developmentalHistory?: string;
  symptoms?: string[];
  painDetails?: {
    location?: string;
    severity?: string;
    character?: string;
    onset?: string;
    duration?: string;
    aggravatingFactors?: string;
    relievingFactors?: string;
    associatedSymptoms?: string;
  };
  vitalsSuggested?: {
    bp?: string;
    hr?: string;
    rr?: string;
    spo2?: string;
    temperature?: string;
    grbs?: string;
  };
  examFindings?: {
    general?: string;
    cvs?: string;
    respiratory?: string;
    abdomen?: string;
    cns?: string;
    musculoskeletal?: string;
    skin?: string;
    heent?: string;
  };
  diagnosis?: string[];
  differentialDiagnosis?: string[];
  treatmentNotes?: string;
  investigationsOrdered?: string;
  imagingOrdered?: string;
  rawTranscription?: string;
  fieldsPopulated?: string[];
}

export async function extractSmartDictation(
  transcription: string,
  patientContext?: { age?: number; sex?: string; chiefComplaint?: string; caseType?: string }
): Promise<SmartDictationResult> {
  const openai = getOpenAIClient();
  if (!openai) {
    console.warn("OpenAI not configured - returning raw transcription only");
    return { rawTranscription: transcription };
  }

  const isPediatric = patientContext?.caseType === 'pediatric' || 
    (patientContext?.age !== undefined && patientContext.age <= 16);

  const contextInfo = patientContext
    ? `Patient context: ${patientContext.age || "unknown"} year old ${patientContext.sex || "patient"}${patientContext.chiefComplaint ? `, presenting with: ${patientContext.chiefComplaint}` : ""}. Case type: ${isPediatric ? "Pediatric (PALS)" : "Adult (ATLS)"}.`
    : "No patient context provided";

  const pediatricFields = isPediatric ? `
  "immunizationHistory": "Vaccination history if mentioned",
  "birthHistory": "Birth history - term/preterm, birth weight, NICU stay, etc. if mentioned",
  "feedingHistory": "Breastfeeding/formula/weaning history if mentioned",
  "developmentalHistory": "Developmental milestones if mentioned",` : "";

  const prompt = `You are an expert Emergency Medicine clinical documentation assistant. A physician is dictating a patient's complete history in one continuous narrative. Your job is to carefully parse this dictation and extract every piece of clinical information, placing it into the correct case sheet field.

${contextInfo}

Voice dictation transcript:
"${transcription}"

IMPORTANT INSTRUCTIONS:
1. Parse the ENTIRE dictation carefully. Doctors may speak in informal/shorthand style.
2. Recognize common medical abbreviations: "pt" = patient, "c/o" = complaining of, "h/o" = history of, "k/c/o" = known case of, "OHA" = oral hypoglycemic agents, "dx" = diagnosis, "rx" = treatment, "hx" = history, "sx" = symptoms, "o/e" = on examination, "NAD" = no acute distress, "GRBS" = random blood sugar, etc.
3. Differentiate between: presenting complaints vs past history vs examination findings vs diagnosis.
4. If something is mentioned as a NEGATIVE finding (e.g., "not associated with vomiting"), put it in "negativeSymptoms".
5. Only include fields that have actual content from the transcript. Omit empty fields entirely.
6. Be precise - do not invent or assume information not stated.
7. Include a "fieldsPopulated" array listing which fields you filled, so the UI can show what was auto-populated.

Respond in JSON format:
{
  "chiefComplaint": "Main presenting complaint(s) - what the patient came in for",
  "historyOfPresentIllness": "Detailed narrative of the current illness episode - onset, progression, character, associated/aggravating/relieving factors",
  "onset": "When symptoms started (e.g., '2 days ago', 'sudden onset')",
  "duration": "Duration of symptoms",
  "progression": "How symptoms progressed (gradual, sudden, worsening, etc.)",
  "associatedSymptoms": "Symptoms that accompany the chief complaint",
  "negativeSymptoms": "Pertinent negatives explicitly mentioned (e.g., 'no vomiting, no loose stools')",
  "pastMedicalHistory": "Known medical conditions (diabetes, hypertension, asthma, etc.)",
  "pastSurgicalHistory": "Previous surgeries if mentioned",
  "allergies": "Drug or food allergies if mentioned",
  "currentMedications": "Current medications the patient is taking",
  "familyHistory": "Family medical history if mentioned",
  "socialHistory": "Smoking, alcohol, occupation, etc. if mentioned",
  "menstrualHistory": "Menstrual/obstetric history if mentioned and relevant",${pediatricFields}
  "symptoms": ["Array of individual symptoms extracted"],
  "painDetails": {
    "location": "Where the pain is",
    "severity": "Pain score or description",
    "character": "Nature of pain (sharp, dull, colicky, burning, etc.)",
    "onset": "When pain started",
    "duration": "How long",
    "aggravatingFactors": "What makes it worse",
    "relievingFactors": "What makes it better",
    "associatedSymptoms": "Symptoms with the pain"
  },
  "vitalsSuggested": {
    "bp": "Blood pressure if mentioned",
    "hr": "Heart rate if mentioned",
    "rr": "Respiratory rate if mentioned",
    "spo2": "SpO2 if mentioned",
    "temperature": "Temperature if mentioned",
    "grbs": "Blood sugar if mentioned"
  },
  "examFindings": {
    "general": "General appearance/examination findings",
    "cvs": "Cardiovascular examination findings",
    "respiratory": "Respiratory examination findings",
    "abdomen": "Abdominal examination findings",
    "cns": "Neurological examination findings",
    "musculoskeletal": "MSK findings if mentioned",
    "skin": "Skin/wound findings if mentioned",
    "heent": "Head, eyes, ears, nose, throat findings if mentioned"
  },
  "diagnosis": ["Primary diagnosis or working diagnosis"],
  "differentialDiagnosis": ["Differential diagnoses if mentioned"],
  "treatmentNotes": "Any treatment plans or medications given if mentioned",
  "investigationsOrdered": "Labs ordered if mentioned (CBC, RFT, etc.)",
  "imagingOrdered": "Imaging ordered if mentioned (X-ray, CT, USG, etc.)",
  "fieldsPopulated": ["Array of field names that were populated"]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: "You are an expert emergency medicine clinical documentation assistant specializing in parsing doctor dictations. You understand Indian English medical terminology, common abbreviations, and clinical workflow. Extract ONLY information explicitly stated or strongly implied in the dictation. Never invent data. Be thorough - capture every clinical detail mentioned." 
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }

    const extracted = JSON.parse(content) as SmartDictationResult;
    extracted.rawTranscription = transcription;
    return extracted;
  } catch (error) {
    console.error("Failed to extract smart dictation data:", error);
    return { rawTranscription: transcription };
  }
}

async function fallbackWhisperTranscribe(audioBuffer: Buffer, filename: string): Promise<string> {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error("No transcription service available - neither Sarvam AI nor OpenAI configured");
  }

  try {
    const uint8Array = new Uint8Array(audioBuffer);
    const mimeType = filename.endsWith('.webm') ? 'audio/webm' : filename.endsWith('.wav') ? 'audio/wav' : filename.endsWith('.mp3') ? 'audio/mpeg' : 'audio/mp4';
    const file = new File([uint8Array], filename, { type: mimeType });
    
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: file,
      model: 'gpt-4o-mini-transcribe',
      language: 'en',
      response_format: 'json',
    });

    return typeof transcriptionResponse === 'string' 
      ? transcriptionResponse 
      : (transcriptionResponse as any).text || '';
  } catch (error) {
    console.error("[Whisper] Transcription error:", error);
    throw new Error("Failed to transcribe audio");
  }
}
