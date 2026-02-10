import OpenAI from "openai";
import { randomUUID } from "crypto";
import { getDb } from "../db";
import { aiFeedback } from "@shared/schema";
import { count, eq, sql } from "drizzle-orm";

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
}

export interface DiagnosisSuggestion {
  id: string;
  diagnosis: string;
  confidence: "high" | "moderate" | "low";
  reasoning: string;
  citations: Citation[];
}

export interface RedFlag {
  id: string;
  flag: string;
  severity: "critical" | "warning";
  action: string;
  citations: Citation[];
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

const MEDICAL_KNOWLEDGE_BASE = {
  atls: {
    source: "ATLS - Advanced Trauma Life Support",
    title: "American College of Surgeons ATLS Guidelines",
    year: "2023",
    url: "https://www.facs.org/quality-programs/trauma/atls",
  },
  pals: {
    source: "PALS - Pediatric Advanced Life Support",
    title: "American Heart Association PALS Guidelines",
    year: "2023",
    url: "https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/pediatric-advanced-life-support",
  },
  sepsis: {
    source: "Surviving Sepsis Campaign",
    title: "International Guidelines for Management of Sepsis and Septic Shock",
    year: "2021",
    url: "https://www.sccm.org/SurvivingSepsisCampaign",
  },
  acs: {
    source: "ACC/AHA Guidelines",
    title: "Guidelines for Management of Patients with Acute Coronary Syndromes",
    year: "2023",
    url: "https://www.acc.org/guidelines",
  },
  stroke: {
    source: "AHA/ASA Stroke Guidelines",
    title: "Guidelines for Early Management of Acute Ischemic Stroke",
    year: "2019",
    url: "https://www.stroke.org/en/professionals",
  },
  trauma: {
    source: "Eastern Association for Surgery of Trauma",
    title: "EAST Practice Management Guidelines",
    year: "2022",
    url: "https://www.east.org/education-resources/practice-management-guidelines",
  },
  toxicology: {
    source: "AACT Clinical Toxicology Guidelines",
    title: "American Academy of Clinical Toxicology Position Statements",
    year: "2023",
    url: undefined as string | undefined,
  },
  pediatricEmergency: {
    source: "Pediatric Emergency Medicine",
    title: "Fleisher & Ludwig's Textbook of Pediatric Emergency Medicine",
    year: "2020",
    url: undefined as string | undefined,
  },
  wikiem: {
    source: "WikEM",
    title: "The Global Emergency Medicine Wiki",
    year: "2024",
    url: "https://wikem.org",
  },
  tintinalli: {
    source: "Tintinalli's Emergency Medicine",
    title: "Tintinalli's Emergency Medicine: A Comprehensive Study Guide",
    year: "2020",
    url: undefined as string | undefined,
  },
  rosens: {
    source: "Rosen's Emergency Medicine",
    title: "Rosen's Emergency Medicine: Concepts and Clinical Practice",
    year: "2022",
    url: undefined as string | undefined,
  },
} as const;

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

export async function generateDiagnosisSuggestions(caseData: {
  chiefComplaint: string;
  vitals: Record<string, string>;
  history: string;
  examination: string;
  age: number;
  gender: string;
  abgData?: ABGData;
}): Promise<{ suggestions: DiagnosisSuggestion[]; redFlags: RedFlag[] }> {
  const isPediatric = caseData.age <= 16;
  const abgInfo = formatABGData(caseData.abgData);
  
  const systemPrompt = `You are an expert emergency medicine physician assistant. Analyze the patient case and provide:
1. Up to 3 differential diagnoses ranked by likelihood
2. Any red flags requiring immediate attention

For EACH diagnosis and red flag, you MUST cite specific medical guidelines or sources.

Guidelines and sources to reference:
- ATLS (Advanced Trauma Life Support) for trauma cases
- PALS (Pediatric Advanced Life Support) for pediatric emergencies
- Surviving Sepsis Campaign for sepsis/infection
- ACC/AHA Guidelines for cardiac conditions
- AHA/ASA Guidelines for stroke
- EAST Guidelines for surgical emergencies
- WikEM (wikiem) - emergency medicine wiki for quick reference
- Tintinalli's Emergency Medicine (tintinalli) - comprehensive EM textbook
- Rosen's Emergency Medicine (rosens) - clinical practice reference

Patient is ${isPediatric ? "pediatric (use PALS protocols)" : "adult (use ATLS protocols)"}.

Respond in JSON format:
{
  "suggestions": [
    {
      "diagnosis": "Primary diagnosis",
      "confidence": "high|moderate|low",
      "reasoning": "Brief clinical reasoning",
      "citations": [
        {
          "id": "cite1",
          "sourceKey": "atls|pals|sepsis|acs|stroke|trauma|toxicology|pediatricEmergency",
          "excerpt": "Specific guideline text or criterion referenced"
        }
      ]
    }
  ],
  "redFlags": [
    {
      "flag": "Critical finding",
      "severity": "critical|warning",
      "action": "Immediate action required",
      "citations": [
        {
          "id": "rf1",
          "sourceKey": "atls|pals|sepsis|acs|stroke|trauma",
          "excerpt": "Guideline-based criteria for this red flag"
        }
      ]
    }
  ]
}`;

  const userPrompt = `Patient Case:
- Age: ${caseData.age} years, Gender: ${caseData.gender}
- Chief Complaint: ${caseData.chiefComplaint}
- Vitals: ${JSON.stringify(caseData.vitals)}
- History: ${caseData.history}
- Examination: ${caseData.examination}${abgInfo ? `\n- ABG/VBG: ${abgInfo}` : ""}

Provide differential diagnoses and identify any red flags.${abgInfo ? " Consider the ABG values in your assessment - look for acid-base disturbances, oxygenation issues, and electrolyte abnormalities that may suggest specific diagnoses or red flags." : ""}`;

  const openai = getOpenAIClient();
  if (!openai) {
    return { suggestions: [], redFlags: [] };
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
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { suggestions: [], redFlags: [] };
    }

    const parsed = JSON.parse(content);
    
    const suggestions: DiagnosisSuggestion[] = (parsed.suggestions || []).map((s: { diagnosis: string; confidence: string; reasoning: string; citations?: Array<{ id: string; sourceKey: string; excerpt: string }> }) => ({
      id: randomUUID(),
      diagnosis: s.diagnosis,
      confidence: s.confidence as "high" | "moderate" | "low",
      reasoning: s.reasoning,
      citations: (s.citations || []).map((c: { id: string; sourceKey: string; excerpt: string }) => {
        const sourceInfo = MEDICAL_KNOWLEDGE_BASE[c.sourceKey as keyof typeof MEDICAL_KNOWLEDGE_BASE] || {
          source: "Medical Literature",
          title: "Clinical Guidelines",
        };
        return {
          id: c.id,
          source: sourceInfo.source,
          title: sourceInfo.title,
          year: sourceInfo.year,
          url: sourceInfo.url,
          excerpt: c.excerpt,
        };
      }),
    }));

    const redFlags: RedFlag[] = (parsed.redFlags || []).map((r: { flag: string; severity: string; action: string; citations?: Array<{ id: string; sourceKey: string; excerpt: string }> }) => ({
      id: randomUUID(),
      flag: r.flag,
      severity: r.severity as "critical" | "warning",
      action: r.action,
      citations: (r.citations || []).map((c: { id: string; sourceKey: string; excerpt: string }) => {
        const sourceInfo = MEDICAL_KNOWLEDGE_BASE[c.sourceKey as keyof typeof MEDICAL_KNOWLEDGE_BASE] || {
          source: "Medical Literature",
          title: "Clinical Guidelines",
        };
        return {
          id: c.id,
          source: sourceInfo.source,
          title: sourceInfo.title,
          year: sourceInfo.year,
          url: sourceInfo.url,
          excerpt: c.excerpt,
        };
      }),
    }));

    return { suggestions, redFlags };
  } catch (error) {
    console.error("AI Diagnosis error:", error);
    return { suggestions: [], redFlags: [] };
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
  medications?: any[];
  investigations?: any[];
  vitals?: Record<string, string>;
  examination?: Record<string, any>;
  procedures?: string;
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
    : summaryData.medications || "";

  const investigationsText = Array.isArray(summaryData.investigations)
    ? summaryData.investigations.map((i: any) => `${i.name || i.test || ""}: ${i.result || i.value || "pending"}`).filter(Boolean).join(", ")
    : summaryData.investigations || "";

  const prompt = `You are a senior emergency medicine physician writing a discharge summary. Generate a professional "Course in Hospital" section based on the following case details:

Patient: ${patientInfo}
Chief Complaint: ${summaryData.chief_complaint || "Not specified"}
Working Diagnosis: ${summaryData.diagnosis || "To be determined"}
Treatment Given: ${summaryData.treatment_given || "Not specified"}
Medications Administered: ${medicationsText || "None documented"}
Investigations: ${investigationsText || "None documented"}
Procedures: ${summaryData.procedures || "None"}

Write a concise, professional clinical narrative (2-4 paragraphs) describing:
1. Presentation and initial assessment
2. Investigations performed and key findings
3. Treatment provided including medications
4. Clinical response and current status
5. Disposition plan

Use professional medical terminology. Be factual and concise. Do not include speculative information.

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

  const { isSarvamAvailable, sarvamSpeechToTextTranslate } = await import('./sarvamAI');
  
  if (isSarvamAvailable()) {
    try {
      console.log("[Voice] Using Sarvam AI for speech-to-text (optimized for Indian accents)");
      const sarvamResult = await sarvamSpeechToTextTranslate(audioBuffer, filename);
      transcript = sarvamResult.transcript || '';
      console.log("[Voice] Sarvam STT success, detected language:", sarvamResult.language_code);
    } catch (sarvamError) {
      console.warn("[Voice] Sarvam STT failed, falling back to OpenAI Whisper:", sarvamError);
      transcript = await fallbackWhisperTranscribe(audioBuffer, filename);
    }
  } else {
    console.log("[Voice] Sarvam AI not configured, using OpenAI Whisper");
    transcript = await fallbackWhisperTranscribe(audioBuffer, filename);
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

async function fallbackWhisperTranscribe(audioBuffer: Buffer, filename: string): Promise<string> {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error("No transcription service available - neither Sarvam AI nor OpenAI configured");
  }

  try {
    const uint8Array = new Uint8Array(audioBuffer);
    const file = new File([uint8Array], filename, { type: 'audio/m4a' });
    
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'en',
      response_format: 'text',
    });

    return typeof transcriptionResponse === 'string' 
      ? transcriptionResponse 
      : (transcriptionResponse as unknown as { text: string }).text || '';
  } catch (error) {
    console.error("[Whisper] Transcription error:", error);
    throw new Error("Failed to transcribe audio");
  }
}
