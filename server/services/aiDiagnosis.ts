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

  const systemPrompt = `You are a clinical decision support tool for emergency medicine physicians, trained on Tintinalli's Emergency Medicine, Rosen's Emergency Medicine, and current clinical practice guidelines.

Your role is to prompt physician thinking — NOT to diagnose. You surface conditions the physician should actively consider or rule out, supported by medical literature, so the treating physician can make an informed clinical decision.

Provide:
1. EXACTLY 5 conditions to rule out, ranked by SEVERITY (most life-threatening FIRST, most benign LAST)
2. Red flags requiring immediate physician attention with specific time-sensitive actions
3. For EACH condition: key supporting findings from the case, suggested workup, and initial management considerations

CRITICAL INSTRUCTIONS:
- Frame all output as prompts for physician review, not as diagnoses
- Rank by SEVERITY (1 = most dangerous to miss, 5 = least severe), NOT by likelihood
- Use language like "Consider ruling out..." or "This presentation warrants excluding..."
- evidence field: "high" = presentation is very consistent with this condition; "moderate" = some features are present; "low" = should be excluded despite low probability given severity
- Cite specific sources using reference numbers [1], [2], etc. from the provided medical literature search results
- Each reasoning field MUST include inline citations like "According to [1], ..." or "Per Tintinalli's [2], ..."
- Include specific diagnostic criteria, clinical decision rules, and guideline recommendations
- Think like a senior EM attending prompting a resident — explain WHY this condition must be considered

Patient is ${isPediatric ? "PEDIATRIC (age <= 16, use PALS protocols, weight-based dosing)" : "ADULT (use ATLS protocols)"}.
${sourcesContext}

Respond in JSON format with EXACTLY 5 suggestions ranked by severity (index 0 = most severe, index 4 = least severe):
{
  "suggestions": [
    {
      "diagnosis": "Most dangerous condition to rule out first",
      "severity_rank": 1,
      "confidence": "high|moderate|low",
      "reasoning": "Consider ruling out [condition] because... Cite inline [1], [2]. Explain the clinical reasoning and why this presentation warrants exclusion. Reference specific guideline criteria.",
      "keyFindings": ["Finding from this case that warrants consideration", "Finding 2", "Finding 3"],
      "workup": ["Investigation to exclude this condition", "Investigation 2", "Lab/imaging 3"],
      "management": ["Initial step if this condition is confirmed", "Step 2", "Disposition consideration"],
      "citationRefs": [1, 3, 5]
    },
    { "diagnosis": "2nd most severe condition...", "severity_rank": 2, "confidence": "...", "reasoning": "...", "keyFindings": [], "workup": [], "management": [], "citationRefs": [] },
    { "diagnosis": "3rd...", "severity_rank": 3, "confidence": "...", "reasoning": "...", "keyFindings": [], "workup": [], "management": [], "citationRefs": [] },
    { "diagnosis": "4th...", "severity_rank": 4, "confidence": "...", "reasoning": "...", "keyFindings": [], "workup": [], "management": [], "citationRefs": [] },
    { "diagnosis": "Least severe condition to consider", "severity_rank": 5, "confidence": "...", "reasoning": "...", "keyFindings": [], "workup": [], "management": [], "citationRefs": [] }
  ],
  "redFlags": [
    {
      "flag": "Critical finding requiring immediate physician attention",
      "severity": "critical|warning",
      "action": "Specific immediate action — be precise (e.g., 'Obtain STAT ECG and troponin, activate cath lab if STEMI')",
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
  // Rich structured fields (from full_case route)
  patientName?: string;
  patientAge?: string;
  patientSex?: string;
  uhid?: string;
  mlcStatus?: string;
  modeArrival?: string;
  arrivalDate?: string;
  arrivalTime?: string;
  emResident?: string;
  emConsultant?: string;
  complaint?: string;
  duration?: string;
  onset?: string;
  signsSymptoms?: string;
  hpi?: string;
  pastMedical?: string;
  pastSurgical?: string;
  allergies?: string;
  preMeds?: string;
  familyHx?: string;
  socialHx?: string;
  bp?: string;
  hr?: string;
  rr?: string;
  spo2?: string;
  temp?: string;
  grbs?: string;
  gcsE?: string;
  gcsV?: string;
  gcsM?: string;
  gcsTot?: string;
  airway?: string;
  auscultation?: string;
  workBreathing?: string;
  o2Device?: string;
  crt?: string;
  cvsFindings?: string;
  ivAccess?: string;
  pupils?: string;
  power?: string;
  focalDeficit?: string;
  exposure?: string;
  examGeneral?: string;
  examCVS?: string;
  examRespiratory?: string;
  examAbdomen?: string;
  examCNS?: string;
  examExtremities?: string;
  examHEENT?: string;
  labsOrdered?: string;
  imagingOrdered?: string;
  ecg?: string;
  efast?: string;
  resultsSummary?: string;
  vbgSection?: string;
  medsText?: string;
  dischargeMedsText?: string;
  proceduresText?: string;
  consultText?: string;
  psychText?: string;
  workingDx?: string;
  differentials?: string;
  dispPlan?: string;
  conditionDx?: string;
  pendingReps?: string;
  followUp?: string;
  // Legacy fields (fallback)
  patient?: { name?: string; age?: number | string; gender?: string; };
  chief_complaint?: string;
  diagnosis?: string;
  treatment_given?: string;
  medications?: any;
  investigations?: any;
  vitals?: Record<string, string>;
  examination?: Record<string, string>;
  primary_survey_findings?: Record<string, string>;
  procedures?: string;
  consultations_text?: string;
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

  // Use rich structured fields when available, fall back to legacy fields
  const hasRich = !!(summaryData.patientName || summaryData.complaint || summaryData.hpi);

  const pName   = summaryData.patientName   || `${summaryData.patient?.age || "?"} yr ${summaryData.patient?.gender || "patient"}`;
  const pAge    = summaryData.patientAge    || String(summaryData.patient?.age || "Unknown");
  const pSex    = summaryData.patientSex    || summaryData.patient?.gender || "";
  const chief   = summaryData.complaint     || summaryData.chief_complaint || "Not specified";
  const hpiTxt  = summaryData.hpi           || summaryData.history_of_present_illness || "Not documented";
  const pmh     = summaryData.pastMedical   || summaryData.past_medical_history || "Nil significant";
  const dxTxt   = summaryData.workingDx     || summaryData.diagnosis || "To be determined";
  const disp    = summaryData.dispPlan      || summaryData.disposition_type || "Not specified";
  const cond    = summaryData.conditionDx   || summaryData.condition_at_discharge || "STABLE";

  // Vitals block
  const vitalsBlock = hasRich ? [
    summaryData.bp    ? `BP: ${summaryData.bp} mmHg`     : "",
    summaryData.hr    ? `HR: ${summaryData.hr} bpm`       : "",
    summaryData.rr    ? `RR: ${summaryData.rr} /min`      : "",
    summaryData.spo2  ? `SpO2: ${summaryData.spo2}%`      : "",
    summaryData.temp  ? `Temp: ${summaryData.temp}°F`     : "",
    summaryData.gcsTot ? `GCS: ${summaryData.gcsTot}/15 (E${summaryData.gcsE} V${summaryData.gcsV} M${summaryData.gcsM})` : "",
    summaryData.grbs  ? `GRBS: ${summaryData.grbs} mg/dL` : "",
  ].filter(Boolean).join(" | ") : (summaryData.vitals ? Object.entries(summaryData.vitals).filter(([_, v]) => v).map(([k, v]) => `${k.toUpperCase()}: ${v}`).join(" | ") : "Not documented");

  // ABCDE block
  const abcdeBlock = hasRich ? `A — Airway:    ${summaryData.airway || "Patent, self-maintained"}
B — Breathing: ${summaryData.auscultation || "Air entry bilaterally equal and clear"}; Work of breathing: ${summaryData.workBreathing || "No accessory muscle use"}; O2: ${summaryData.o2Device || "Room air"}
C — Circulation: CRT ${summaryData.crt || "< 2 seconds"}; ${summaryData.cvsFindings || "S1S2 heard, no murmurs"}; IV Access: ${summaryData.ivAccess || "Not documented"}
D — Disability: Pupils: ${summaryData.pupils || "Bilaterally equal and reactive"}; Power: ${summaryData.power || "5/5 all four limbs"}; Focal deficit: ${summaryData.focalDeficit || "None"}
E — Exposure:  ${summaryData.exposure || "No external injuries or significant findings"}` : "";

  // Systemic exam block
  const examBlock = hasRich ? `General:     ${summaryData.examGeneral || "Conscious, oriented, comfortable at rest"}
CVS:         ${summaryData.examCVS || "S1S2 heard, no murmurs, no added sounds"}
Respiratory: ${summaryData.examRespiratory || "Air entry bilaterally equal and clear, no adventitious sounds"}
Abdomen:     ${summaryData.examAbdomen || "Soft, non-tender, bowel sounds present"}
CNS:         ${summaryData.examCNS || "No focal neurological deficit"}
Extremities: ${summaryData.examExtremities || "No pedal oedema, peripheral pulses present bilaterally"}
HEENT:       ${summaryData.examHEENT || "Not examined"}` : "";

  // Investigations block
  const invBlock = hasRich ? `Labs Ordered:  ${summaryData.labsOrdered || "Nil"}
Imaging:       ${summaryData.imagingOrdered || "Nil"}
ECG:           ${summaryData.ecg || "Not done"}
EFAST:         ${summaryData.efast || "Not done"}
VBG:           ${summaryData.vbgSection || "Not done"}
Results:       ${summaryData.resultsSummary || "Pending"}` : (typeof summaryData.investigations === "string" ? summaryData.investigations : "");

  // Meds block
  const medsBlock = hasRich ? (summaryData.medsText || "Nil") : (Array.isArray(summaryData.medications)
    ? summaryData.medications.map((m: any) => `• ${m.name || ""} ${m.dose || ""} ${m.route || ""} ${m.frequency || ""}`.trim()).join("\n")
    : String(summaryData.medications || "Nil"));

  const prompt = `You are a senior emergency medicine physician writing a formal Indian ER discharge summary. 

CRITICAL RULES:
- ONLY use what is explicitly documented below. Never infer, assume, or fabricate.
- Use exact drug names, doses, and routes as documented — do not alter them.
- Consultations are a separate event from procedures — do NOT merge them.
- If VBG is "Not done", do not mention VBG in the narrative.
- Write in past tense. Professional Indian ER medical English.
- Do NOT repeat the structured data verbatim — synthesise into a coherent clinical story.

═══════════════════════════════════════
PATIENT
═══════════════════════════════════════
Name:            ${pName}
Age / Gender:    ${pAge} years / ${pSex}
UHID:            ${summaryData.uhid || "Not recorded"}
MLC Case:        ${summaryData.mlcStatus || "No"}
Mode of Arrival: ${summaryData.modeArrival || "Not recorded"}
Date / Time:     ${summaryData.arrivalDate || ""} ${summaryData.arrivalTime || ""}
EM Resident:     ${summaryData.emResident || "Not documented"}
EM Consultant:   ${summaryData.emConsultant || "Not documented"}

═══════════════════════════════════════
PRESENTING COMPLAINT
═══════════════════════════════════════
${chief}${summaryData.duration ? ` — since ${summaryData.duration}` : ""}${summaryData.onset ? ` (${summaryData.onset} onset)` : ""}
${summaryData.signsSymptoms ? `\nAssociated symptoms: ${summaryData.signsSymptoms}` : ""}

═══════════════════════════════════════
HISTORY
═══════════════════════════════════════
HPI:
${hpiTxt}

Past Medical History:  ${pmh}
Past Surgical History: ${summaryData.pastSurgical || "Nil"}
Known Allergies:       ${summaryData.allergies || summaryData.allergy || "NKDA"}
Pre-admission Medications: ${summaryData.preMeds || "None"}
Family History:  ${summaryData.familyHx || "Not significant"}
Social History:  ${summaryData.socialHx || "Not recorded"}

═══════════════════════════════════════
VITALS ON ARRIVAL
═══════════════════════════════════════
${vitalsBlock || "Not documented"}

═══════════════════════════════════════
PRIMARY SURVEY (ABCDE)
═══════════════════════════════════════
${abcdeBlock || "(see examination)"}

═══════════════════════════════════════
SYSTEMIC EXAMINATION
═══════════════════════════════════════
${examBlock || "(not separately documented)"}

═══════════════════════════════════════
INVESTIGATIONS
═══════════════════════════════════════
${invBlock || "None documented"}

═══════════════════════════════════════
TREATMENT IN EMERGENCY (administered in ER)
═══════════════════════════════════════
Medications / Fluids Given in ER:
${medsBlock}

Procedures (interventions only, not consultations):
${summaryData.proceduresText || summaryData.procedures || "Nil"}

═══════════════════════════════════════
DISCHARGE MEDICATIONS (post-discharge prescription)
═══════════════════════════════════════
${summaryData.dischargeMedsText || "To be completed by treating physician"}
NOTE: The Course in Hospital narrative must only reference ER treatment medications above, NOT discharge medications.

═══════════════════════════════════════
CONSULTATIONS
═══════════════════════════════════════
${summaryData.consultText || summaryData.consultations_text || "No specialist consultations during this visit"}

═══════════════════════════════════════
PSYCHOLOGICAL SCREEN
═══════════════════════════════════════
${summaryData.psychText || "Not assessed during this visit"}

═══════════════════════════════════════
DIAGNOSIS
═══════════════════════════════════════
Working Diagnosis: ${dxTxt}
Differentials:     ${summaryData.differentials || "None documented"}

═══════════════════════════════════════
DISPOSITION
═══════════════════════════════════════
Plan:            ${disp}
Condition:       ${cond}
Pending Reports: ${summaryData.pendingReps || "Nil"}
Follow Up:       ${summaryData.followUp || "As clinically indicated"}

═══════════════════════════════════════

Now write ONLY the "Course in Hospital" section — a flowing clinical narrative (3–5 sentences, 2 paragraphs max) covering:
1. What the patient presented with and key history
2. Examination findings (specific values, not "within normal limits")
3. Investigations done and key results (mention VBG values only if documented above as "Not done" skip it)
4. Treatment administered in the ER
5. Consultations obtained (if any)
6. Response to treatment and disposition

Respond in JSON:
{
  "course_in_hospital": "...",
  "diagnosis": "Primary diagnosis"
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
  differentialDiagnosis?: string[];
  treatmentNotes?: string;
  prescribedMedications?: Array<{ name: string; dose?: string; route?: string; frequency?: string }>;
  prescribedInfusions?: Array<{ name: string; dose?: string; dilution?: string; rate?: string }>;
  investigationsOrdered?: string;
  imagingOrdered?: string;
  rawTranscription?: string;
  restAllNormal?: boolean;
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

  const prompt = `You are a clinical documentation assistant for an Emergency Room physician. Extract structured clinical information from the following transcript and organize it into appropriate case sheet fields.

IMPORTANT — AMBIENT RECORDING CONTEXT:
This transcript may be from a natural doctor-patient-bystander conversation recorded in the ER, not a formal dictation. It may contain:
- Doctor questions to the patient or family ("How long has this been?")
- Patient answers in any Indian language or English ("Since yesterday evening")
- Bystander / family member comments
- Nurse instructions mid-recording ("Take BP", "Give this medicine")
- Conversational fillers ("okay", "hmm", "let me see", "uh")
- Repeated clarifying questions
- Background noise transcribed as text

Your job: Extract ONLY the clinically relevant facts from ALL speakers. Ignore conversational structure entirely. Do NOT include questions, filler phrases, nursing instructions, or direct speech verbatim. Synthesise everything into clean clinical documentation as if written by the physician after the encounter.

${contextInfo}

Voice transcript:
"${transcription}"

Extract and categorize any mentioned clinical information into the following structure. Only include fields that have relevant information mentioned in the transcript. Be accurate and use medical terminology appropriately.

Respond in JSON format:
{
  "chiefComplaint": "Main presenting complaint if mentioned",
  "historyOfPresentIllness": "A complete NARRATIVE clinical story in third person prose. Weave onset, duration, progression, character, location, severity, aggravating/relieving factors, associated symptoms, and pertinent negatives into flowing text. Do NOT use labels or bullet points. Example: 'Patient presented with severe epigastric pain of 6 hours duration, burning in character, aggravated by food intake and relieved by antacids. Associated with nausea and two episodes of non-bilious vomiting. No hematemesis or melena.'",
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
  "differentialDiagnosis": ["Differential diagnoses if mentioned"],
  "prescribedMedications": [
    {"name": "Drug name", "dose": "Dose with units", "route": "PO/IV/IM/SC/etc", "frequency": "OD/BD/TDS/QID/SOS/etc"}
  ],
  "prescribedInfusions": [
    {"name": "Fluid or drug name (NS, RL, Dopamine, etc)", "dose": "Amount if mentioned", "dilution": "Dilution details", "rate": "Rate of infusion"}
  ],
  "investigationsOrdered": "Labs ordered (CBC, RFT, LFT, etc.)",
  "imagingOrdered": "Imaging ordered (X-ray, CT, USG, etc.)",
  "treatmentNotes": "Any other treatment plans or notes not captured above",
  "restAllNormal": false
}

IMPORTANT RULES:
1. When the doctor mentions prescribing or administering medications (e.g., "give paracetamol 1g IV", "start on Tab Pantoprazole 40mg OD"), extract them into "prescribedMedications" array. When IV fluids or continuous infusions are mentioned (e.g., "start NS at 100ml/hr", "Dopamine drip"), extract them into "prescribedInfusions" array. "medications" field is ONLY for the patient's current/home medications (medication history).
2. CRITICAL: Only include fields that have ACTUAL content mentioned in the transcript. Do NOT include fields with values like "Not mentioned", "None", "N/A", "Unknown", or empty strings. Simply OMIT the field entirely if no relevant information was mentioned.
3. For "historyOfPresentIllness": Construct a complete NARRATIVE clinical story in flowing third-person prose. Weave ALL clinical details (onset, duration, progression, character, location, severity, aggravating/relieving factors, associated symptoms, pertinent negatives) into a cohesive paragraph. Do NOT use labels like "Onset:", "Duration:", etc. Example: "Patient presented with severe retrosternal chest pain of sudden onset 2 hours ago while climbing stairs. The pain is crushing in nature, radiating to the left arm, aggravated by exertion and partially relieved by rest. Associated with profuse sweating and breathlessness. No history of vomiting or syncope."
4. For "painDetails": Only include specific subfields (location, severity, character, etc.) where the doctor ACTUALLY describes pain characteristics. Do NOT include subfields with "Not mentioned" values. Omit the entire painDetails object if pain is not relevant to the presentation. Pain details should ALSO be woven into the historyOfPresentIllness narrative.
5. For "chiefComplaint": Extract the main reason the patient came to the ER. This should be a brief phrase like "Vomiting and loose stools" or "Chest pain" or "Difficulty breathing".
6. "REST ALL NORMAL" DETECTION: If the doctor says phrases like "rest all examination normal", "other systems normal", "rest all systems within normal limits", "systemic examination otherwise normal", "rest of examination unremarkable", or any similar wording indicating unmentioned exam systems should be considered normal — set "restAllNormal" to true. The examFindings should still contain any SPECIFIC findings mentioned, and restAllNormal covers everything else.`;

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
  patientContext?: { 
    age?: string | number; 
    sex?: string; 
    presenting_complaint?: string;
    vitals?: string;
    abcde?: string;
    history?: string;
    examination?: string;
    diagnosis?: string;
  }
): Promise<string> {
  const openai = getOpenAIClient();
  if (!openai) {
    return "AI interpretation unavailable - OpenAI API not configured. Manual interpretation required.";
  }

  const clinicalContextParts: string[] = [];
  if (patientContext?.age) clinicalContextParts.push(`Age: ${patientContext.age}`);
  if (patientContext?.sex) clinicalContextParts.push(`Sex: ${patientContext.sex}`);
  if (patientContext?.presenting_complaint) clinicalContextParts.push(`Chief Complaint: ${patientContext.presenting_complaint}`);
  if (patientContext?.vitals) clinicalContextParts.push(`Vitals: ${patientContext.vitals}`);
  if (patientContext?.abcde) clinicalContextParts.push(`Primary Survey (ABCDE): ${patientContext.abcde}`);
  if (patientContext?.history) clinicalContextParts.push(`History: ${patientContext.history}`);
  if (patientContext?.examination) clinicalContextParts.push(`Examination: ${patientContext.examination}`);
  if (patientContext?.diagnosis) clinicalContextParts.push(`Working Diagnosis: ${patientContext.diagnosis}`);

  const hasRichContext = clinicalContextParts.length > 2;

  const prompt = `You are an expert emergency medicine physician. Interpret the following ABG/VBG values and provide a clear clinical interpretation.

ABG Values: ${abgValues}

${clinicalContextParts.length > 0 ? `CLINICAL CONTEXT:\n${clinicalContextParts.join("\n")}` : "No patient context provided."}

Use the stepwise approach:
1. Check pH (acidemia <7.35, alkalemia >7.45)
2. Check primary disorder (pCO2 for respiratory, HCO3 for metabolic)
3. Check compensation (Winter's formula for metabolic, expected changes for respiratory)
4. Check anion gap if metabolic acidosis
5. Consider delta ratio if high anion gap

You MUST format your response EXACTLY as numbered sections using this structure:

1. **Acid-base status:** [Describe the primary acid-base disorder - respiratory/metabolic acidosis/alkalosis, mixed disorder. Include specific values.]

2. **Oxygenation assessment:** [Assess pO2, SaO2, FiO2, A-a gradient. Describe oxygenation status.${hasRichContext ? " Correlate with the patient's SpO2, oxygen supplementation, and respiratory status from the clinical context." : ""}]

3. **Compensation status:** [Describe compensation - compensated, partially compensated, uncompensated. Use Winter's formula or expected changes.]

4. **Clinical significance and likely causes:** [Clinical relevance, likely causes${hasRichContext ? " — correlate ABG findings with the chief complaint, vitals, ABCDE assessment, history, and examination findings provided. Explain how the ABG fits the overall clinical picture" : " based on patient context"}, differential considerations.]

5. **Suggested actions:** [If critical values present, suggest immediate actions.${hasRichContext ? " Consider what interventions are already in place (from ABCDE) and suggest further steps." : ""} If normal, state no urgent action needed.]

Each section MUST start with the number and bold heading as shown above. Use **bold** for key findings and abnormal values within each section.

IMPORTANT: After the 5 sections, add a final line starting with "SUMMARY:" followed by a single concise one-line clinical ABG diagnosis (e.g., "SUMMARY: Primary respiratory alkalosis with compensatory metabolic acidosis and mild hypoxemia"). This summary should be suitable as a final ABG diagnosis label.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: "You are an expert emergency medicine physician providing ABG interpretation. Be concise, clinically relevant, and actionable. When clinical context is provided (chief complaint, vitals, ABCDE assessment, history, examination), you MUST correlate the ABG findings with the full clinical picture to give a contextual interpretation, not just a standalone ABG analysis." 
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1200,
    });

    return response.choices[0]?.message?.content || "Unable to interpret ABG values";
  } catch (error) {
    console.error("ABG interpretation error:", error);
    return "Error interpreting ABG values. Please try again or interpret manually.";
  }
}

export interface ABGScanResult {
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
  sampleType?: string;
}

export async function extractABGFromImage(imageBase64: string): Promise<ABGScanResult> {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error("AI service not available");
  }

  try {
    let ocrText = "";
    
    try {
      const { isSarvamAvailable, sarvamParsePDF } = await import("./sarvamAI");
      if (isSarvamAvailable()) {
        console.log("[ABG Scan] Using Sarvam AI OCR for text extraction...");
        const imageBuffer = Buffer.from(imageBase64, "base64");
        const { default: PDFDocument } = await import("pdfkit");
        const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
          const doc = new PDFDocument({ size: "A4" });
          const chunks: Buffer[] = [];
          doc.on("data", (chunk: Buffer) => chunks.push(chunk));
          doc.on("end", () => resolve(Buffer.concat(chunks)));
          doc.on("error", reject);
          doc.image(imageBuffer, 0, 0, { fit: [595, 842], align: "center", valign: "center" });
          doc.end();
        });
        ocrText = await sarvamParsePDF(pdfBuffer, 1);
        console.log("[ABG Scan] Sarvam OCR extracted text length:", ocrText.length);
      }
    } catch (sarvamErr) {
      console.warn("[ABG Scan] Sarvam OCR failed, falling back to GPT-4o vision:", sarvamErr);
    }

    if (ocrText && ocrText.trim().length > 10) {
      console.log("[ABG Scan] Extracting ABG values from OCR text using OpenAI...");
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert at reading ABG (Arterial/Venous Blood Gas) machine printouts from devices like Radiometer ABL800, i-STAT, GEM Premier, etc. You will receive OCR-extracted text from a blood gas report. Extract ONLY the numeric values without units. Be precise. If a value is not found in the text, omit it.`
          },
          {
            role: "user",
            content: `Here is OCR-extracted text from a blood gas report printout:\n\n${ocrText}\n\nExtract all ABG/VBG values. Return ONLY numeric values without units. Respond in JSON:
{
  "ph": "pH value (e.g. 7.438)",
  "pco2": "pCO2 in mmHg (e.g. 31.1)",
  "po2": "pO2 in mmHg (e.g. 64.5)",
  "hco3": "HCO3/Bicarbonate in mEq/L - use cHCO3 or standard HCO3 (e.g. 22.5)",
  "be": "Base Excess in mEq/L - use cBase(Ecf) or BE (e.g. -2.8)",
  "lactate": "Lactate in mmol/L (e.g. 2.2)",
  "sao2": "SaO2/sO2 percentage without % (e.g. 91.0)",
  "fio2": "FiO2 percentage without % (e.g. 21.0)",
  "na": "Sodium/cNa in mEq/L (e.g. 126)",
  "k": "Potassium/cK in mEq/L (e.g. 4.1)",
  "cl": "Chloride/cCl in mEq/L (e.g. 99)",
  "anionGap": "Anion Gap value (e.g. 6.0)",
  "glucose": "Glucose/cGlu in mg/dL (e.g. 177)",
  "hb": "Hemoglobin/ctHb in g/dL (e.g. 13.2)",
  "aaGradient": "A-a gradient if shown",
  "sampleType": "Arterial or Venous if indicated"
}
Only include fields with actual values found in the text. Omit fields not present.`
          }
        ],
        max_tokens: 1000,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response from AI");
      }
      return JSON.parse(content) as ABGScanResult;
    }

    console.log("[ABG Scan] Falling back to GPT-4o vision for direct image reading...");
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert at reading ABG (Arterial/Venous Blood Gas) machine printouts from devices like Radiometer ABL800, i-STAT, GEM Premier, etc. Extract ONLY the numeric values without units. Be precise - read the exact numbers from the printout. If a value is not visible or unreadable, omit it.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract all ABG/VBG values from this blood gas report printout. Return ONLY numeric values without units. Respond in JSON:
{
  "ph": "pH value (e.g. 7.438)",
  "pco2": "pCO2 in mmHg (e.g. 31.1)",
  "po2": "pO2 in mmHg (e.g. 64.5)",
  "hco3": "HCO3/Bicarbonate in mEq/L - use cHCO3 or standard HCO3 (e.g. 22.5)",
  "be": "Base Excess in mEq/L - use cBase(Ecf) or BE (e.g. -2.8)",
  "lactate": "Lactate in mmol/L (e.g. 2.2)",
  "sao2": "SaO2/sO2 percentage without % (e.g. 91.0)",
  "fio2": "FiO2 percentage without % (e.g. 21.0)",
  "na": "Sodium/cNa in mEq/L (e.g. 126)",
  "k": "Potassium/cK in mEq/L (e.g. 4.1)",
  "cl": "Chloride/cCl in mEq/L (e.g. 99)",
  "anionGap": "Anion Gap value (e.g. 6.0)",
  "glucose": "Glucose/cGlu in mg/dL (e.g. 177)",
  "hb": "Hemoglobin/ctHb in g/dL (e.g. 13.2)",
  "aaGradient": "A-a gradient if shown",
  "sampleType": "Arterial or Venous if indicated"
}
Only include fields with actual values. Omit empty or unreadable fields.`
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
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }

    return JSON.parse(content) as ABGScanResult;
  } catch (error) {
    console.error("ABG scan extraction error:", error);
    throw new Error("Failed to extract ABG values from image");
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

export interface MasterConsultation {
  specialty: string;
  doctorName: string;
  adviceGiven: string;
}

export interface SmartDictationResult {
  // Patient info
  patientName?: string;
  patientAge?: string;
  patientSex?: string;
  // Chief complaint (legacy string)
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
    location?: string; severity?: string; character?: string; onset?: string;
    duration?: string; aggravatingFactors?: string; relievingFactors?: string; associatedSymptoms?: string;
  };
  vitalsSuggested?: {
    bp?: string; hr?: string; rr?: string; spo2?: string; temperature?: string; grbs?: string; gcs?: string;
  };
  vbgResults?: {
    ph?: string; pco2?: string; po2?: string; hco3?: string; lactate?: string;
    hemoglobin?: string; sodium?: string; potassium?: string; creatinine?: string; glucose?: string;
  };
  examFindings?: {
    general?: string; cvs?: string; respiratory?: string; abdomen?: string;
    cns?: string; musculoskeletal?: string; skin?: string; heent?: string;
  };
  // Doctor fields
  emResident?: string;
  emConsultant?: string;
  consultationGiven?: string;
  consultations?: MasterConsultation[];
  // Master schema structured fields
  primarySurvey?: {
    airway?: { status?: string; findings?: string; confidence?: string; };
    breathing?: { spo2?: string; rr?: string; workOfBreathing?: string; oxygenDevice?: string; auscultation?: string; confidence?: string; };
    circulation?: { hr?: string; bpSystolic?: string; bpDiastolic?: string; crt?: string; ivAccess?: string; cvs?: string; confidence?: string; };
    disability?: { gcsE?: string; gcsV?: string; gcsM?: string; gcsTotal?: string; pupils?: string; grbs?: string; focalDeficit?: string; power?: string; confidence?: string; };
    exposure?: { temperature?: string; findings?: string; confidence?: string; };
  };
  disposition?: { plan?: string; pendingReports?: string; followUp?: string; confidence?: string; };
  psychologicalAssessment?: {
    assessed?: boolean;
    suicidalIdeation?: boolean;
    selfHarm?: boolean;
    intentToHarmOthers?: boolean;
    substanceAbuse?: boolean;
    psychiatricHistory?: boolean;
    currentlyOnPsychiatricTreatment?: boolean;
    hasSupportSystem?: boolean;
    notes?: string;
    confidence?: string;
  };
  sectionConfidence?: {
    patient?: string; doctors?: string; chiefComplaint?: string; hpi?: string;
    pastHistory?: string; primarySurvey?: string; examination?: string;
    investigations?: string; treatment?: string; diagnosis?: string; disposition?: string;
  };
  diagnosis?: string[];
  differentialDiagnosis?: string[];
  prescribedMedications?: Array<{ name: string; dose: string; route: string; frequency: string; }>;
  prescribedInfusions?: Array<{ name: string; dose?: string; rate?: string; dilution?: string; }>;
  treatmentNotes?: string;
  investigationsOrdered?: string;
  imagingOrdered?: string;
  rawTranscription?: string;
  fieldsPopulated?: string[];
  restAllNormal?: boolean;
  detectedLanguage?: string;
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
    ? `Patient context: ${patientContext.age || "unknown"} year old ${patientContext.sex || "patient"}. Case type: ${isPediatric ? "Pediatric (PALS)" : "Adult (ATLS)"}. Note: transcript may have been translated to English from the doctor's original language.`
    : "No patient context provided";

  const pediatricExtra = isPediatric ? `,
    "immunizationHistory": "Vaccination history if mentioned",
    "birthHistory": "Birth history - term/preterm, birth weight, NICU stay if mentioned",
    "feedingHistory": "Breastfeeding/formula/weaning if mentioned",
    "developmentalHistory": "Developmental milestones if mentioned"` : "";

  const prompt = `You are a clinical documentation AI for an Indian emergency department.
The transcript below is a doctor dictating a patient case (may have been translated to English).
Indian EM abbreviations: k/c/o = known case of, h/o = history of, GRBS = glucose, OHA = oral hypoglycemic agents, NKDA = no known drug allergies, c/o = complaints of, b/l = bilateral, a/w = associated with, e/e = equal and reactive, NAD = no acute distress, o/e = on examination.

${contextInfo}

RULES:
1. Return JSON ONLY — no markdown, no explanation
2. Use "" for missing strings, [] for missing arrays, false for missing booleans
3. Medications: split into drug + dose + route + frequency
4. GCS: extract E, V, M individually AND compute total (E+V+M)
5. VBG/ABG: extract every parameter as a separate field
6. Past medical history: always an array of strings
7. Consultations: array with specialty + doctorName + adviceGiven
8. Negative findings: put in hpi.negativeHistory array
9. confidence per section: "high" = explicitly stated, "medium" = inferred, "low" = unclear, "" = not mentioned

TRANSCRIPT:
"${transcription}"

SCHEMA (fill every field, use "" for not mentioned):
{
  "patientName": "",
  "patientAge": "",
  "patientSex": "",
  "chiefComplaint": "Main presenting complaint",
  "onset": "When symptoms started",
  "duration": "Duration of symptoms",
  "progression": "How symptoms progressed",
  "historyOfPresentIllness": "Complete narrative clinical story in third person — weave onset, duration, progression, character, location, severity, aggravating/relieving factors, associated symptoms, pertinent negatives into flowing prose",
  "associatedSymptoms": "Symptoms accompanying chief complaint",
  "negativeSymptoms": "Pertinent negatives explicitly mentioned",
  "symptoms": [],
  "pastMedicalHistory": "Known conditions (T2DM, HTN, etc.)",
  "pastSurgicalHistory": "Previous surgeries",
  "allergies": "Drug/food allergies or NKDA",
  "currentMedications": "Current medications",
  "familyHistory": "Family history",
  "socialHistory": "Smoking, alcohol, occupation"${pediatricExtra},
  "menstrualHistory": "Menstrual/obstetric history if mentioned",
  "painDetails": {
    "location": "", "severity": "", "character": "", "onset": "",
    "duration": "", "aggravatingFactors": "", "relievingFactors": "", "associatedSymptoms": ""
  },
  "vitalsSuggested": {
    "bp": "systolic/diastolic", "hr": "", "rr": "", "spo2": "", "temperature": "", "grbs": "", "gcs": "E_V_M total"
  },
  "primarySurvey": {
    "airway": { "status": "", "findings": "", "confidence": "" },
    "breathing": { "spo2": "", "rr": "", "workOfBreathing": "", "oxygenDevice": "", "auscultation": "", "confidence": "" },
    "circulation": { "hr": "", "bpSystolic": "", "bpDiastolic": "", "crt": "", "ivAccess": "", "cvs": "", "confidence": "" },
    "disability": { "gcsE": "", "gcsV": "", "gcsM": "", "gcsTotal": "", "pupils": "", "grbs": "", "focalDeficit": "", "power": "", "confidence": "" },
    "exposure": { "temperature": "", "findings": "", "confidence": "" }
  },
  "vbgResults": {
    "ph": "", "pco2": "", "po2": "", "hco3": "", "lactate": "",
    "hemoglobin": "", "sodium": "", "potassium": "", "creatinine": "", "glucose": ""
  },
  "examFindings": {
    "general": "", "cvs": "", "respiratory": "", "abdomen": "", "cns": "", "musculoskeletal": "", "skin": "", "heent": ""
  },
  "emResident": "",
  "emConsultant": "",
  "consultationGiven": "",
  "consultations": [{ "specialty": "", "doctorName": "", "adviceGiven": "" }],
  "diagnosis": [],
  "differentialDiagnosis": [],
  "prescribedMedications": [{ "name": "", "dose": "", "route": "", "frequency": "" }],
  "prescribedInfusions": [{ "name": "", "dose": "", "rate": "" }],
  "disposition": { "plan": "", "pendingReports": "", "followUp": "" },
  "psychologicalAssessment": {
    "assessed": false,
    "suicidalIdeation": false,
    "selfHarm": false,
    "intentToHarmOthers": false,
    "substanceAbuse": false,
    "psychiatricHistory": false,
    "currentlyOnPsychiatricTreatment": false,
    "hasSupportSystem": false,
    "notes": ""
  },
  "treatmentNotes": "",
  "investigationsOrdered": "",
  "imagingOrdered": "",
  "sectionConfidence": {
    "patient": "", "chiefComplaint": "", "hpi": "", "pastHistory": "",
    "primarySurvey": "", "examination": "", "investigations": "",
    "treatment": "", "diagnosis": "", "disposition": ""
  },
  "restAllNormal": false,
  "fieldsPopulated": ["Array of field names that were populated"]
}

SPECIAL INSTRUCTION - "REST ALL NORMAL" DETECTION:
8. If the doctor says phrases like "rest all examination normal", "other systems normal", "rest all systems within normal limits", "systemic examination otherwise normal", "rest of examination unremarkable", "per abdomen soft non-tender rest all normal", "o/e NAD rest normal", or any similar wording indicating that examination systems NOT specifically mentioned with abnormal findings should be considered normal — set "restAllNormal" to true. This tells the app to auto-fill normal findings for all exam sections that don't have specific abnormalities documented. The examFindings should still contain any SPECIFIC findings the doctor mentioned (both normal details and abnormalities), and restAllNormal covers everything else.`;

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
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }

    const extracted = JSON.parse(content) as SmartDictationResult;
    extracted.rawTranscription = transcription;
    // Populate primarySurvey vitalsSuggested from structured primarySurvey if vitalsSuggested is empty
    if (extracted.primarySurvey && !extracted.vitalsSuggested?.bp) {
      const ps = extracted.primarySurvey;
      extracted.vitalsSuggested = {
        bp: ps.circulation?.bpSystolic && ps.circulation?.bpDiastolic
          ? `${ps.circulation.bpSystolic}/${ps.circulation.bpDiastolic}` : extracted.vitalsSuggested?.bp || "",
        hr: ps.circulation?.hr || extracted.vitalsSuggested?.hr || "",
        rr: ps.breathing?.rr || extracted.vitalsSuggested?.rr || "",
        spo2: ps.breathing?.spo2 || extracted.vitalsSuggested?.spo2 || "",
        temperature: ps.exposure?.temperature || extracted.vitalsSuggested?.temperature || "",
        grbs: ps.disability?.grbs || extracted.vitalsSuggested?.grbs || "",
        gcs: ps.disability?.gcsTotal || extracted.vitalsSuggested?.gcs || "",
      };
    }
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
