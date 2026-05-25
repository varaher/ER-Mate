var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  aiFeedback: () => aiFeedback,
  caseClinicalData: () => caseClinicalData,
  emReferenceFeedback: () => emReferenceFeedback,
  insertAIFeedbackSchema: () => insertAIFeedbackSchema,
  insertCaseClinicalDataSchema: () => insertCaseClinicalDataSchema,
  insertEMReferenceFeedbackSchema: () => insertEMReferenceFeedbackSchema,
  insertSubscriptionSchema: () => insertSubscriptionSchema,
  insertTreatmentHistorySchema: () => insertTreatmentHistorySchema,
  insertUserFeedbackSchema: () => insertUserFeedbackSchema,
  insertUserSchema: () => insertUserSchema,
  subscriptions: () => subscriptions,
  treatmentHistory: () => treatmentHistory,
  userFeedback: () => userFeedback,
  users: () => users
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, serial, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users, insertUserSchema, aiFeedback, insertAIFeedbackSchema, treatmentHistory, insertTreatmentHistorySchema, emReferenceFeedback, insertEMReferenceFeedbackSchema, subscriptions, insertSubscriptionSchema, userFeedback, insertUserFeedbackSchema, caseClinicalData, insertCaseClinicalDataSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    users = pgTable("users", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      username: text("username").notNull().unique(),
      password: text("password").notNull()
    });
    insertUserSchema = createInsertSchema(users).pick({
      username: true,
      password: true
    });
    aiFeedback = pgTable("ai_feedback", {
      id: serial("id").primaryKey(),
      suggestionId: text("suggestion_id").notNull(),
      caseId: text("case_id").notNull(),
      feedbackType: text("feedback_type").notNull(),
      userCorrection: text("user_correction"),
      suggestionText: text("suggestion_text"),
      userId: text("user_id"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
    });
    insertAIFeedbackSchema = createInsertSchema(aiFeedback).omit({
      id: true,
      createdAt: true
    });
    treatmentHistory = pgTable("treatment_history", {
      id: serial("id").primaryKey(),
      userId: text("user_id"),
      diagnosis: text("diagnosis").notNull(),
      drugName: text("drug_name").notNull(),
      dose: text("dose"),
      route: text("route"),
      frequency: text("frequency"),
      drugType: text("drug_type").default("medication"),
      dilution: text("dilution"),
      rate: text("rate"),
      ageGroup: text("age_group"),
      patientAge: text("patient_age"),
      patientSex: text("patient_sex"),
      caseId: text("case_id"),
      usageCount: integer("usage_count").default(1),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
      updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
    });
    insertTreatmentHistorySchema = createInsertSchema(treatmentHistory).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    emReferenceFeedback = pgTable("em_reference_feedback", {
      id: serial("id").primaryKey(),
      messageId: text("message_id").notNull(),
      query: text("query").notNull(),
      response: text("response").notNull(),
      topic: text("topic"),
      feedbackType: text("feedback_type").notNull(),
      feedbackComment: text("feedback_comment"),
      userId: text("user_id"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
    });
    insertEMReferenceFeedbackSchema = createInsertSchema(emReferenceFeedback).omit({
      id: true,
      createdAt: true
    });
    subscriptions = pgTable("subscriptions", {
      id: serial("id").primaryKey(),
      userId: text("user_id").notNull(),
      userEmail: text("user_email").notNull(),
      plan: text("plan").notNull().default("free"),
      status: text("status").notNull().default("active"),
      casesUsed: integer("cases_used").notNull().default(0),
      casesLimit: integer("cases_limit").notNull().default(10),
      currentPeriodStart: timestamp("current_period_start").default(sql`CURRENT_TIMESTAMP`),
      currentPeriodEnd: timestamp("current_period_end"),
      stripeCustomerId: text("stripe_customer_id"),
      stripeSubscriptionId: text("stripe_subscription_id"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
      updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
    });
    insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    userFeedback = pgTable("user_feedback", {
      id: serial("id").primaryKey(),
      userId: text("user_id"),
      userEmail: text("user_email"),
      userName: text("user_name"),
      category: text("category").notNull().default("general"),
      message: text("message").notNull(),
      platform: text("platform"),
      appVersion: text("app_version"),
      status: text("status").notNull().default("new"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
    });
    insertUserFeedbackSchema = createInsertSchema(userFeedback).omit({
      id: true,
      createdAt: true,
      status: true
    });
    caseClinicalData = pgTable("case_clinical_data", {
      id: serial("id").primaryKey(),
      caseId: text("case_id").notNull(),
      userId: text("user_id").notNull(),
      payload: jsonb("payload").notNull(),
      updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
    });
    insertCaseClinicalDataSchema = createInsertSchema(caseClinicalData).omit({
      id: true,
      updatedAt: true
    });
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  getDb: () => getDb
});
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
function getDb() {
  if (!connectionString) {
    console.warn("DATABASE_URL not set, database operations will not work");
    return null;
  }
  if (!db) {
    pool = new Pool({ connectionString });
    db = drizzle(pool, { schema: schema_exports });
  }
  return db;
}
var connectionString, db, pool;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    connectionString = process.env.DATABASE_URL;
    db = null;
    pool = null;
  }
});

// server/services/medicalSearch.ts
async function searchPubMed(query, maxResults = 5) {
  try {
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query + " emergency medicine")}&retmax=${maxResults}&sort=relevance&retmode=json`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const ids = searchData?.esearchresult?.idlist || [];
    if (ids.length === 0) return [];
    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;
    const fetchRes = await fetch(fetchUrl);
    if (!fetchRes.ok) return [];
    const fetchData = await fetchRes.json();
    const results = [];
    for (const id of ids) {
      const article = fetchData?.result?.[id];
      if (!article || article.error) continue;
      const authors = article.authors?.slice(0, 3).map((a) => a.name).join(", ");
      const year = article.pubdate?.split(" ")?.[0] || "";
      results.push({
        id: `pubmed_${id}`,
        title: article.title || "",
        source: article.fulljournalname || article.source || "PubMed",
        authors: authors ? article.authors?.length > 3 ? `${authors} et al.` : authors : void 0,
        year,
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        snippet: article.title || "",
        sourceType: "pubmed"
      });
    }
    return results;
  } catch (error) {
    console.error("PubMed search error:", error);
    return [];
  }
}
async function searchWikEM(query) {
  try {
    const searchUrl = `https://wikem.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=0&srlimit=3&format=json&origin=*`;
    const res = await fetch(searchUrl);
    if (!res.ok) return [];
    const data = await res.json();
    const searchResults = data?.query?.search || [];
    return searchResults.map((item, i) => ({
      id: `wikem_${item.pageid}`,
      title: item.title,
      source: "WikEM - Global Emergency Medicine Wiki",
      year: (/* @__PURE__ */ new Date()).getFullYear().toString(),
      url: `https://wikem.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
      snippet: item.snippet?.replace(/<[^>]+>/g, "") || "",
      sourceType: "wikem"
    }));
  } catch (error) {
    console.error("WikEM search error:", error);
    return [];
  }
}
function getTextbookReferences(complaint, isPediatric) {
  const refs = [];
  const complaintLower = complaint.toLowerCase();
  refs.push({
    id: "textbook_tintinalli",
    title: "Tintinalli's Emergency Medicine: A Comprehensive Study Guide, 9th Edition",
    source: "McGraw-Hill Education",
    authors: "Tintinalli JE, Ma OJ, Yealy DM et al.",
    year: "2020",
    url: "https://accessemergencymedicine.mhmedical.com/book.aspx?bookid=2353",
    snippet: "Comprehensive emergency medicine reference covering evaluation, diagnosis, and management.",
    sourceType: "textbook"
  });
  refs.push({
    id: "textbook_rosens",
    title: "Rosen's Emergency Medicine: Concepts and Clinical Practice, 10th Edition",
    source: "Elsevier",
    authors: "Walls RM, Hockberger RS, Gausche-Hill M",
    year: "2023",
    url: "https://www.elsevier.com/books/rosens-emergency-medicine/walls/978-0-323-75489-3",
    snippet: "Gold standard clinical practice reference for emergency physicians.",
    sourceType: "textbook"
  });
  if (isPediatric) {
    refs.push({
      id: "textbook_fleisher",
      title: "Fleisher & Ludwig's Textbook of Pediatric Emergency Medicine, 8th Edition",
      source: "Wolters Kluwer",
      authors: "Shaw KN, Bachur RG",
      year: "2021",
      url: "https://shop.lww.com/fleisher-ludwigs-textbook-of-pediatric-emergency-medicine/p/9781975134556",
      snippet: "Definitive pediatric emergency medicine textbook with evidence-based protocols.",
      sourceType: "textbook"
    });
    refs.push({
      id: "guideline_pals",
      title: "Pediatric Advanced Life Support (PALS) Provider Manual",
      source: "American Heart Association",
      authors: "AHA",
      year: "2020",
      url: "https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/pediatric-advanced-life-support",
      snippet: "AHA guidelines for pediatric resuscitation and emergency cardiovascular care.",
      sourceType: "guideline"
    });
  }
  if (/trauma|fracture|fall|accident|injury|wound|laceration|head injury|blunt|penetrating/.test(complaintLower)) {
    refs.push({
      id: "guideline_atls",
      title: "Advanced Trauma Life Support (ATLS) Student Course Manual, 10th Edition",
      source: "American College of Surgeons",
      authors: "ACS Committee on Trauma",
      year: "2018",
      url: "https://www.facs.org/quality-programs/trauma/education/advanced-trauma-life-support/",
      snippet: "Systematic approach to trauma assessment and management: primary and secondary surveys.",
      sourceType: "guideline"
    });
    refs.push({
      id: "guideline_east",
      title: "EAST Practice Management Guidelines",
      source: "Eastern Association for the Surgery of Trauma",
      authors: "EAST",
      year: "2023",
      url: "https://www.east.org/education-resources/practice-management-guidelines",
      snippet: "Evidence-based practice management guidelines for surgical trauma care.",
      sourceType: "guideline"
    });
  }
  if (/chest pain|mi|acs|angina|stemi|nstemi|cardiac|heart|palpitation/.test(complaintLower)) {
    refs.push({
      id: "guideline_aha_acs",
      title: "2021 ACC/AHA/SCAI Guideline for Coronary Artery Revascularization",
      source: "Journal of the American College of Cardiology",
      authors: "Lawton JS, Tamis-Holland JE, Bangalore S et al.",
      year: "2022",
      url: "https://www.jacc.org/doi/10.1016/j.jacc.2021.09.006",
      snippet: "Evidence-based guidelines for management of acute coronary syndromes and revascularization.",
      sourceType: "guideline"
    });
  }
  if (/sepsis|septic|infection|fever|pneumonia|uti|cellulitis|bacteremia|meningitis/.test(complaintLower)) {
    refs.push({
      id: "guideline_ssc",
      title: "Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock 2021",
      source: "Intensive Care Medicine",
      authors: "Evans L, Rhodes A, Alhazzani W et al.",
      year: "2021",
      url: "https://www.sccm.org/SurvivingSepsisCampaign/Guidelines/Adult-Patients",
      snippet: "Hour-1 bundle: lactate, blood cultures, broad-spectrum antibiotics, crystalloid for hypotension, vasopressors if needed.",
      sourceType: "guideline"
    });
  }
  if (/stroke|tia|weakness|hemiparesis|aphasia|facial droop|slurred speech/.test(complaintLower)) {
    refs.push({
      id: "guideline_aha_stroke",
      title: "2019 AHA/ASA Guideline for the Early Management of Patients With Acute Ischemic Stroke",
      source: "Stroke (AHA/ASA)",
      authors: "Powers WJ, Rabinstein AA, Ackerson T et al.",
      year: "2019",
      url: "https://www.ahajournals.org/doi/10.1161/STR.0000000000000211",
      snippet: "Door-to-needle time <60 min, IV alteplase within 4.5h window, mechanical thrombectomy within 24h for large vessel occlusion.",
      sourceType: "guideline"
    });
  }
  if (/asthma|copd|dyspnea|breathless|wheeze|respiratory|shortness of breath|sob/.test(complaintLower)) {
    refs.push({
      id: "guideline_gina",
      title: "Global Initiative for Asthma (GINA) Report 2023",
      source: "GINA",
      authors: "GINA Science Committee",
      year: "2023",
      url: "https://ginasthma.org/gina-reports/",
      snippet: "Stepwise approach to asthma management, acute exacerbation protocols, and severity assessment.",
      sourceType: "guideline"
    });
  }
  if (/poison|overdose|toxicology|ingestion|intoxication|drug abuse/.test(complaintLower)) {
    refs.push({
      id: "textbook_goldfrank",
      title: "Goldfrank's Toxicologic Emergencies, 11th Edition",
      source: "McGraw-Hill Education",
      authors: "Nelson LS, Howland MA, Lewin NA et al.",
      year: "2019",
      url: "https://accessemergencymedicine.mhmedical.com/book.aspx?bookid=2569",
      snippet: "Comprehensive toxicology reference: toxidromes, antidotes, decontamination, and enhanced elimination.",
      sourceType: "textbook"
    });
  }
  if (/abdominal|appendicitis|bowel|gi bleed|vomiting|diarrhea|obstruction|pancreatitis/.test(complaintLower)) {
    refs.push({
      id: "guideline_aga",
      title: "ACG Clinical Guidelines for Abdominal Pain Assessment",
      source: "American College of Gastroenterology",
      authors: "ACG",
      year: "2023",
      url: "https://journals.lww.com/ajg/pages/default.aspx",
      snippet: "Evidence-based approach to acute abdominal pain: differential diagnosis, imaging, and management.",
      sourceType: "guideline"
    });
  }
  if (/headache|migraine|subarachnoid|meningitis|head/.test(complaintLower)) {
    refs.push({
      id: "guideline_headache",
      title: "ACEP Clinical Policy: Critical Issues in the Evaluation of Adult Patients Presenting with Acute Headache",
      source: "Annals of Emergency Medicine",
      authors: "Godwin SA, Cherkas DS, Panagos PD et al.",
      year: "2019",
      url: "https://www.acep.org/patient-care/clinical-policies/",
      snippet: "Risk stratification for headache emergencies, SAH screening criteria, CT/LP decision rules.",
      sourceType: "guideline"
    });
  }
  return refs;
}
async function searchMedicalLiterature(chiefComplaint, age, additionalContext) {
  const isPediatric = age <= 16;
  const searchQuery = additionalContext ? `${chiefComplaint} ${additionalContext} ${isPediatric ? "pediatric" : ""}` : `${chiefComplaint} ${isPediatric ? "pediatric" : ""} emergency`;
  const [pubmedResults, wikemResults] = await Promise.all([
    searchPubMed(searchQuery, 5),
    searchWikEM(chiefComplaint)
  ]);
  const textbookRefs = getTextbookReferences(chiefComplaint, isPediatric);
  const allResults = [...textbookRefs, ...pubmedResults, ...wikemResults];
  const seen = /* @__PURE__ */ new Set();
  return allResults.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}
var init_medicalSearch = __esm({
  "server/services/medicalSearch.ts"() {
    "use strict";
  }
});

// server/services/sarvamAI.ts
var sarvamAI_exports = {};
__export(sarvamAI_exports, {
  isSarvamAvailable: () => isSarvamAvailable,
  sarvamParsePDF: () => sarvamParsePDF,
  sarvamSpeechToText: () => sarvamSpeechToText,
  sarvamSpeechToTextTranslate: () => sarvamSpeechToTextTranslate,
  sarvamTranslateToEnglish: () => sarvamTranslateToEnglish
});
import FormData from "form-data";
function getSarvamApiKey() {
  return process.env.SARVAM_AI_API_KEY || null;
}
async function sarvamSpeechToText(audioBuffer, filename, languageCode = "unknown") {
  const apiKey = getSarvamApiKey();
  if (!apiKey) {
    throw new Error("Sarvam AI API key not configured");
  }
  const formData = new FormData();
  formData.append("file", audioBuffer, {
    filename,
    contentType: getAudioMimeType(filename)
  });
  formData.append("model", "saaras:v3");
  formData.append("language_code", languageCode);
  formData.append("mode", "transcribe");
  const response = await fetch(`${SARVAM_API_BASE}/speech-to-text`, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey,
      ...formData.getHeaders()
    },
    body: formData.getBuffer()
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Sarvam STT] Error:", response.status, errorText);
    throw new Error(`Sarvam STT failed: ${response.status} - ${errorText}`);
  }
  const result = await response.json();
  console.log("[Sarvam STT] Success, language:", result.language_code, "transcript length:", result.transcript?.length);
  return result;
}
async function sarvamSpeechToTextTranslate(audioBuffer, filename) {
  const apiKey = getSarvamApiKey();
  if (!apiKey) {
    throw new Error("Sarvam AI API key not configured");
  }
  const formData = new FormData();
  formData.append("file", audioBuffer, {
    filename,
    contentType: getAudioMimeType(filename)
  });
  formData.append("model", "saaras:v2.5");
  const response = await fetch(`${SARVAM_API_BASE}/speech-to-text-translate`, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey,
      ...formData.getHeaders()
    },
    body: formData.getBuffer()
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Sarvam STT Translate] Error:", response.status, errorText);
    throw new Error(`Sarvam STT translate failed: ${response.status} - ${errorText}`);
  }
  const result = await response.json();
  console.log("[Sarvam STT Translate] Success, language:", result.language_code);
  return result;
}
async function sarvamParsePDF(pdfBuffer, pageNumber = 1) {
  const apiKey = getSarvamApiKey();
  if (!apiKey) {
    throw new Error("Sarvam AI API key not configured");
  }
  const formData = new FormData();
  formData.append("pdf", pdfBuffer, {
    filename: "document.pdf",
    contentType: "application/pdf"
  });
  formData.append("page_number", String(pageNumber));
  formData.append("sarvam_mode", "large");
  const response = await fetch(`${SARVAM_API_BASE}/parse/parsepdf`, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey,
      ...formData.getHeaders()
    },
    body: formData.getBuffer()
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Sarvam Parse] Error:", response.status, errorText);
    throw new Error(`Sarvam document parse failed: ${response.status} - ${errorText}`);
  }
  const result = await response.json();
  if (result.output) {
    try {
      const decoded = Buffer.from(result.output, "base64").toString("utf-8");
      return decoded;
    } catch {
      return result.output;
    }
  }
  return result.parsed_text || "";
}
async function sarvamTranslateToEnglish(text2) {
  const apiKey = getSarvamApiKey();
  if (!apiKey) {
    throw new Error("Sarvam AI API key not configured");
  }
  const response = await fetch(`${SARVAM_API_BASE}/translate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": apiKey
    },
    body: JSON.stringify({
      input: text2,
      source_language_code: "auto",
      target_language_code: "en-IN",
      mode: "code-mixed",
      model: "mayura:v1",
      numerals_format: "international"
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Sarvam Translate] Error:", response.status, errorText);
    throw new Error(`Sarvam translation failed: ${response.status} - ${errorText}`);
  }
  const result = await response.json();
  console.log("[Sarvam Translate] Success, source language:", result.source_language_code, "output length:", result.translated_text?.length);
  return result;
}
function isSarvamAvailable() {
  return !!getSarvamApiKey();
}
function getAudioMimeType(filename) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const mimeMap = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    aac: "audio/aac",
    ogg: "audio/ogg",
    webm: "audio/webm",
    flac: "audio/flac",
    amr: "audio/amr",
    wma: "audio/x-ms-wma",
    opus: "audio/opus",
    caf: "audio/x-caf",
    mp4: "audio/mp4"
  };
  return mimeMap[ext] || "audio/mpeg";
}
var SARVAM_API_BASE;
var init_sarvamAI = __esm({
  "server/services/sarvamAI.ts"() {
    "use strict";
    SARVAM_API_BASE = "https://api.sarvam.ai";
  }
});

// server/services/audioConvert.ts
var audioConvert_exports = {};
__export(audioConvert_exports, {
  convertAudioToWav: () => convertAudioToWav
});
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
async function convertAudioToWav(audioBuffer, originalFilename) {
  const ext = path.extname(originalFilename).toLowerCase();
  if (ext === ".wav") {
    return { buffer: audioBuffer, filename: originalFilename };
  }
  const tmpDir = os.tmpdir();
  const timestamp2 = Date.now();
  const inputPath = path.join(tmpDir, `voice_input_${timestamp2}${ext || ".bin"}`);
  const outputPath = path.join(tmpDir, `voice_output_${timestamp2}.wav`);
  try {
    fs.writeFileSync(inputPath, audioBuffer);
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-ar",
      "16000",
      "-ac",
      "1",
      "-sample_fmt",
      "s16",
      "-f",
      "wav",
      outputPath
    ], { timeout: 3e4 });
    const wavBuffer = fs.readFileSync(outputPath);
    console.log(`[AudioConvert] Converted ${originalFilename} (${audioBuffer.length} bytes) -> WAV (${wavBuffer.length} bytes)`);
    return { buffer: wavBuffer, filename: originalFilename.replace(/\.[^.]+$/, ".wav") };
  } catch (error) {
    console.error("[AudioConvert] ffmpeg conversion failed:", error);
    console.log("[AudioConvert] Returning original audio as fallback");
    return { buffer: audioBuffer, filename: originalFilename };
  } finally {
    try {
      fs.unlinkSync(inputPath);
    } catch {
    }
    try {
      fs.unlinkSync(outputPath);
    } catch {
    }
  }
}
var execFileAsync;
var init_audioConvert = __esm({
  "server/services/audioConvert.ts"() {
    "use strict";
    execFileAsync = promisify(execFile);
  }
});

// server/services/aiDiagnosis.ts
var aiDiagnosis_exports = {};
__export(aiDiagnosis_exports, {
  extractABGFromImage: () => extractABGFromImage,
  extractClinicalDataFromImage: () => extractClinicalDataFromImage,
  extractClinicalDataFromVoice: () => extractClinicalDataFromVoice,
  extractSmartDictation: () => extractSmartDictation,
  generateCourseInHospital: () => generateCourseInHospital,
  generateDiagnosisSuggestions: () => generateDiagnosisSuggestions,
  getFeedbackStats: () => getFeedbackStats,
  getLearningInsights: () => getLearningInsights,
  interpretABG: () => interpretABG,
  recordFeedback: () => recordFeedback,
  transcribeAndExtractVoice: () => transcribeAndExtractVoice
});
import OpenAI from "openai";
import { randomUUID } from "crypto";
import { count, eq } from "drizzle-orm";
function getOpenAIClient() {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!apiKey || !baseURL) {
    console.warn("OpenAI API not configured - AI_INTEGRATIONS_OPENAI_API_KEY or AI_INTEGRATIONS_OPENAI_BASE_URL missing");
    return null;
  }
  return new OpenAI({ apiKey, baseURL });
}
function formatABGData(abgData) {
  if (!abgData) return "";
  const parts = [];
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
function buildSourcesContext(searchResults) {
  if (searchResults.length === 0) return "";
  let context = "\n\n## MEDICAL LITERATURE SEARCH RESULTS (use these as references)\n";
  searchResults.forEach((result, index) => {
    context += `
[${index + 1}] ${result.title}`;
    if (result.authors) context += ` - ${result.authors}`;
    if (result.year) context += ` (${result.year})`;
    context += `
    Source: ${result.source}`;
    context += `
    URL: ${result.url}`;
    if (result.snippet) context += `
    Summary: ${result.snippet}`;
    context += "\n";
  });
  return context;
}
async function generateDiagnosisSuggestions(caseData) {
  const isPediatric = caseData.age <= 16;
  const abgInfo = formatABGData(caseData.abgData);
  console.log("[AI Diagnosis] Searching medical literature for:", caseData.chiefComplaint);
  let searchResults = [];
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
  const sources = searchResults.map((r) => ({
    id: r.id,
    title: r.title,
    source: r.source,
    authors: r.authors,
    year: r.year,
    url: r.url,
    sourceType: r.sourceType
  }));
  const systemPrompt = `You are a clinical decision support tool for emergency medicine physicians, trained on Tintinalli's Emergency Medicine, Rosen's Emergency Medicine, and current clinical practice guidelines.

Your role is to prompt physician thinking \u2014 NOT to diagnose. You surface conditions the physician should actively consider or rule out, supported by medical literature, so the treating physician can make an informed clinical decision.

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
- Think like a senior EM attending prompting a resident \u2014 explain WHY this condition must be considered

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
      "action": "Specific immediate action \u2014 be precise (e.g., 'Obtain STAT ECG and troponin, activate cath lab if STEMI')",
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
- Examination: ${caseData.examination}${abgInfo ? `
- ABG/VBG: ${abgInfo}` : ""}

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
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 4e3
    });
    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { suggestions: [], redFlags: [], sources };
    }
    const parsed = JSON.parse(content);
    const suggestions = (parsed.suggestions || []).map((s, index) => {
      const citationRefs = s.citationRefs || [];
      const citations = citationRefs.filter((refNum) => refNum >= 1 && refNum <= searchResults.length).map((refNum) => {
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
          refNumber: refNum
        };
      });
      return {
        id: randomUUID(),
        diagnosis: s.diagnosis,
        confidence: s.confidence,
        severity_rank: s.severity_rank || index + 1,
        reasoning: s.reasoning,
        keyFindings: s.keyFindings || [],
        workup: s.workup || [],
        management: s.management || [],
        citations
      };
    });
    const redFlags = (parsed.redFlags || []).map((r) => {
      const citationRefs = r.citationRefs || [];
      const citations = citationRefs.filter((refNum) => refNum >= 1 && refNum <= searchResults.length).map((refNum) => {
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
          refNumber: refNum
        };
      });
      return {
        id: randomUUID(),
        flag: r.flag,
        severity: r.severity,
        action: r.action,
        timeframe: r.timeframe,
        citations
      };
    });
    return { suggestions, redFlags, sources };
  } catch (error) {
    console.error("AI Diagnosis error:", error);
    return { suggestions: [], redFlags: [], sources };
  }
}
async function recordFeedback(feedback) {
  const db2 = getDb();
  if (!db2) {
    console.error("DATABASE_URL not configured - feedback feature unavailable");
    return {
      success: false,
      error: "Database not configured. Self-learning feedback feature is unavailable."
    };
  }
  try {
    await db2.insert(aiFeedback).values({
      suggestionId: feedback.suggestionId,
      caseId: feedback.caseId,
      feedbackType: feedback.feedbackType,
      userCorrection: feedback.userCorrection,
      suggestionText: feedback.suggestionText,
      userId: feedback.userId
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
async function getFeedbackStats() {
  const db2 = getDb();
  if (!db2) {
    return { total: 0, accepted: 0, modified: 0, rejected: 0, acceptanceRate: 0, available: false };
  }
  try {
    const totalResult = await db2.select({ count: count() }).from(aiFeedback);
    const acceptedResult = await db2.select({ count: count() }).from(aiFeedback).where(eq(aiFeedback.feedbackType, "accepted"));
    const modifiedResult = await db2.select({ count: count() }).from(aiFeedback).where(eq(aiFeedback.feedbackType, "modified"));
    const rejectedResult = await db2.select({ count: count() }).from(aiFeedback).where(eq(aiFeedback.feedbackType, "rejected"));
    const total = totalResult[0]?.count || 0;
    const accepted = acceptedResult[0]?.count || 0;
    const modified = modifiedResult[0]?.count || 0;
    const rejected = rejectedResult[0]?.count || 0;
    return {
      total,
      accepted,
      modified,
      rejected,
      acceptanceRate: total > 0 ? accepted / total * 100 : 0,
      available: true
    };
  } catch (error) {
    console.error("Failed to get feedback stats from database:", error);
    return { total: 0, accepted: 0, modified: 0, rejected: 0, acceptanceRate: 0, available: false };
  }
}
async function getLearningInsights() {
  const insights = [];
  const db2 = getDb();
  if (!db2) {
    insights.push("Self-learning analytics unavailable - database not configured");
    return insights;
  }
  try {
    const corrections = await db2.select().from(aiFeedback).where(eq(aiFeedback.feedbackType, "modified"));
    const correctionCount = corrections.filter((f) => f.userCorrection).length;
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
async function generateCourseInHospital(summaryData) {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error("AI service not available - OpenAI not configured");
  }
  const hasRich = !!(summaryData.patientName || summaryData.complaint || summaryData.hpi);
  const pName = summaryData.patientName || `${summaryData.patient?.age || "?"} yr ${summaryData.patient?.gender || "patient"}`;
  const pAge = summaryData.patientAge || String(summaryData.patient?.age || "Unknown");
  const pSex = summaryData.patientSex || summaryData.patient?.gender || "";
  const chief = summaryData.complaint || summaryData.chief_complaint || "Not specified";
  const hpiTxt = summaryData.hpi || summaryData.history_of_present_illness || "Not documented";
  const pmh = summaryData.pastMedical || summaryData.past_medical_history || "Nil significant";
  const dxTxt = summaryData.workingDx || summaryData.diagnosis || "To be determined";
  const disp = summaryData.dispPlan || summaryData.disposition_type || "Not specified";
  const cond = summaryData.conditionDx || summaryData.condition_at_discharge || "STABLE";
  const vitalsBlock = hasRich ? [
    summaryData.bp ? `BP: ${summaryData.bp} mmHg` : "",
    summaryData.hr ? `HR: ${summaryData.hr} bpm` : "",
    summaryData.rr ? `RR: ${summaryData.rr} /min` : "",
    summaryData.spo2 ? `SpO2: ${summaryData.spo2}%` : "",
    summaryData.temp ? `Temp: ${summaryData.temp}\xB0F` : "",
    summaryData.gcsTot ? `GCS: ${summaryData.gcsTot}/15 (E${summaryData.gcsE} V${summaryData.gcsV} M${summaryData.gcsM})` : "",
    summaryData.grbs ? `GRBS: ${summaryData.grbs} mg/dL` : ""
  ].filter(Boolean).join(" | ") : summaryData.vitals ? Object.entries(summaryData.vitals).filter(([_, v]) => v).map(([k, v]) => `${k.toUpperCase()}: ${v}`).join(" | ") : "Not documented";
  const abcdeBlock = hasRich ? `A \u2014 Airway:    ${summaryData.airway || "Patent, self-maintained"}
B \u2014 Breathing: ${summaryData.auscultation || "Air entry bilaterally equal and clear"}; Work of breathing: ${summaryData.workBreathing || "No accessory muscle use"}; O2: ${summaryData.o2Device || "Room air"}
C \u2014 Circulation: CRT ${summaryData.crt || "< 2 seconds"}; ${summaryData.cvsFindings || "S1S2 heard, no murmurs"}; IV Access: ${summaryData.ivAccess || "Not documented"}
D \u2014 Disability: Pupils: ${summaryData.pupils || "Bilaterally equal and reactive"}; Power: ${summaryData.power || "5/5 all four limbs"}; Focal deficit: ${summaryData.focalDeficit || "None"}
E \u2014 Exposure:  ${summaryData.exposure || "No external injuries or significant findings"}` : "";
  const examBlock = hasRich ? `General:     ${summaryData.examGeneral || "Conscious, oriented, comfortable at rest"}
CVS:         ${summaryData.examCVS || "S1S2 heard, no murmurs, no added sounds"}
Respiratory: ${summaryData.examRespiratory || "Air entry bilaterally equal and clear, no adventitious sounds"}
Abdomen:     ${summaryData.examAbdomen || "Soft, non-tender, bowel sounds present"}
CNS:         ${summaryData.examCNS || "No focal neurological deficit"}
Extremities: ${summaryData.examExtremities || "No pedal oedema, peripheral pulses present bilaterally"}
HEENT:       ${summaryData.examHEENT || "Not examined"}` : "";
  const invBlock = hasRich ? `Labs Ordered:  ${summaryData.labsOrdered || "Nil"}
Imaging:       ${summaryData.imagingOrdered || "Nil"}
ECG:           ${summaryData.ecg || "Not done"}
EFAST:         ${summaryData.efast || "Not done"}
VBG:           ${summaryData.vbgSection || "Not done"}
Results:       ${summaryData.resultsSummary || "Pending"}` : typeof summaryData.investigations === "string" ? summaryData.investigations : "";
  const medsBlock = hasRich ? summaryData.medsText || "Nil" : Array.isArray(summaryData.medications) ? summaryData.medications.map((m) => `\u2022 ${m.name || ""} ${m.dose || ""} ${m.route || ""} ${m.frequency || ""}`.trim()).join("\n") : String(summaryData.medications || "Nil");
  const prompt = `You are a senior emergency medicine physician writing a formal Indian ER discharge summary. 

CRITICAL RULES:
- ONLY use what is explicitly documented below. Never infer, assume, or fabricate.
- Use exact drug names, doses, and routes as documented \u2014 do not alter them.
- Consultations are a separate event from procedures \u2014 do NOT merge them.
- If VBG is "Not done", do not mention VBG in the narrative.
- Write in past tense. Professional Indian ER medical English.
- Do NOT repeat the structured data verbatim \u2014 synthesise into a coherent clinical story.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
PATIENT
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
Name:            ${pName}
Age / Gender:    ${pAge} years / ${pSex}
UHID:            ${summaryData.uhid || "Not recorded"}
MLC Case:        ${summaryData.mlcStatus || "No"}
Mode of Arrival: ${summaryData.modeArrival || "Not recorded"}
Date / Time:     ${summaryData.arrivalDate || ""} ${summaryData.arrivalTime || ""}
EM Resident:     ${summaryData.emResident || "Not documented"}
EM Consultant:   ${summaryData.emConsultant || "Not documented"}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
PRESENTING COMPLAINT
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
${chief}${summaryData.duration ? ` \u2014 since ${summaryData.duration}` : ""}${summaryData.onset ? ` (${summaryData.onset} onset)` : ""}
${summaryData.signsSymptoms ? `
Associated symptoms: ${summaryData.signsSymptoms}` : ""}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
HISTORY
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
HPI:
${hpiTxt}

Past Medical History:  ${pmh}
Past Surgical History: ${summaryData.pastSurgical || "Nil"}
Known Allergies:       ${summaryData.allergies || summaryData.allergy || "NKDA"}
Pre-admission Medications: ${summaryData.preMeds || "None"}
Family History:  ${summaryData.familyHx || "Not significant"}
Social History:  ${summaryData.socialHx || "Not recorded"}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
VITALS ON ARRIVAL
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
${vitalsBlock || "Not documented"}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
PRIMARY SURVEY (ABCDE)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
${abcdeBlock || "(see examination)"}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
SYSTEMIC EXAMINATION
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
${examBlock || "(not separately documented)"}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
INVESTIGATIONS
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
${invBlock || "None documented"}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
TREATMENT IN EMERGENCY (administered in ER)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
Medications / Fluids Given in ER:
${medsBlock}

Procedures (interventions only, not consultations):
${summaryData.proceduresText || summaryData.procedures || "Nil"}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
DISCHARGE MEDICATIONS (post-discharge prescription)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
${summaryData.dischargeMedsText || "To be completed by treating physician"}
NOTE: The Course in Hospital narrative must only reference ER treatment medications above, NOT discharge medications.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
CONSULTATIONS
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
${summaryData.consultText || summaryData.consultations_text || "No specialist consultations during this visit"}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
PSYCHOLOGICAL SCREEN
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
${summaryData.psychText || "Not assessed during this visit"}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
DIAGNOSIS
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
Working Diagnosis: ${dxTxt}
Differentials:     ${summaryData.differentials || "None documented"}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
DISPOSITION
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
Plan:            ${disp}
Condition:       ${cond}
Pending Reports: ${summaryData.pendingReps || "Nil"}
Follow Up:       ${summaryData.followUp || "As clinically indicated"}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Now write ONLY the "Course in Hospital" section \u2014 a flowing clinical narrative (3\u20135 sentences, 2 paragraphs max) covering:
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
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1e3,
      response_format: { type: "json_object" }
    });
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }
    const result = JSON.parse(content);
    return {
      course_in_hospital: result.course_in_hospital || "",
      diagnosis: result.diagnosis
    };
  } catch (error) {
    console.error("Failed to generate course in hospital:", error);
    throw new Error("Failed to generate discharge summary content");
  }
}
async function extractClinicalDataFromVoice(transcription, patientContext) {
  const openai = getOpenAIClient();
  if (!openai) {
    console.warn("OpenAI not configured - returning raw transcription only");
    return { rawTranscription: transcription };
  }
  const contextInfo = patientContext ? `Patient context: ${patientContext.age || "unknown"} year old ${patientContext.sex || "patient"}, presenting with: ${patientContext.chiefComplaint || "not specified"}` : "No patient context provided";
  const prompt = `You are a clinical documentation assistant for an Emergency Room physician. Extract structured clinical information from the following transcript and organize it into appropriate case sheet fields.

IMPORTANT \u2014 AMBIENT RECORDING CONTEXT:
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
  "pastMedicalHistory": ["Array of known conditions, one per item \u2014 e.g. Diabetes, Hypertension"],
  "allergies": "Drug/food allergies if mentioned \u2014 use NKDA if doctor says no allergies",
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
6. "REST ALL NORMAL" DETECTION: If the doctor says phrases like "rest all examination normal", "other systems normal", "rest all systems within normal limits", "systemic examination otherwise normal", "rest of examination unremarkable", or any similar wording indicating unmentioned exam systems should be considered normal \u2014 set "restAllNormal" to true. The examFindings should still contain any SPECIFIC findings mentioned, and restAllNormal covers everything else.`;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a precise clinical documentation assistant. Extract only the information that is explicitly stated or strongly implied in the voice transcript. Do not invent or assume information."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: "json_object" }
    });
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }
    const extracted = JSON.parse(content);
    extracted.rawTranscription = transcription;
    return extracted;
  } catch (error) {
    console.error("Failed to extract clinical data:", error);
    return { rawTranscription: transcription };
  }
}
async function interpretABG(abgValues, patientContext) {
  const openai = getOpenAIClient();
  if (!openai) {
    return "AI interpretation unavailable - OpenAI API not configured. Manual interpretation required.";
  }
  const clinicalContextParts = [];
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

${clinicalContextParts.length > 0 ? `CLINICAL CONTEXT:
${clinicalContextParts.join("\n")}` : "No patient context provided."}

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

4. **Clinical significance and likely causes:** [Clinical relevance, likely causes${hasRichContext ? " \u2014 correlate ABG findings with the chief complaint, vitals, ABCDE assessment, history, and examination findings provided. Explain how the ABG fits the overall clinical picture" : " based on patient context"}, differential considerations.]

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
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1200
    });
    return response.choices[0]?.message?.content || "Unable to interpret ABG values";
  } catch (error) {
    console.error("ABG interpretation error:", error);
    return "Error interpreting ABG values. Please try again or interpret manually.";
  }
}
async function extractABGFromImage(imageBase64) {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error("AI service not available");
  }
  try {
    let ocrText = "";
    try {
      const { isSarvamAvailable: isSarvamAvailable2, sarvamParsePDF: sarvamParsePDF2 } = await Promise.resolve().then(() => (init_sarvamAI(), sarvamAI_exports));
      if (isSarvamAvailable2()) {
        console.log("[ABG Scan] Using Sarvam AI OCR for text extraction...");
        const imageBuffer = Buffer.from(imageBase64, "base64");
        const { default: PDFDocument2 } = await import("pdfkit");
        const pdfBuffer = await new Promise((resolve2, reject) => {
          const doc = new PDFDocument2({ size: "A4" });
          const chunks = [];
          doc.on("data", (chunk) => chunks.push(chunk));
          doc.on("end", () => resolve2(Buffer.concat(chunks)));
          doc.on("error", reject);
          doc.image(imageBuffer, 0, 0, { fit: [595, 842], align: "center", valign: "center" });
          doc.end();
        });
        ocrText = await sarvamParsePDF2(pdfBuffer, 1);
        console.log("[ABG Scan] Sarvam OCR extracted text length:", ocrText.length);
      }
    } catch (sarvamErr) {
      console.warn("[ABG Scan] Sarvam OCR failed, falling back to GPT-4o vision:", sarvamErr);
    }
    if (ocrText && ocrText.trim().length > 10) {
      console.log("[ABG Scan] Extracting ABG values from OCR text using OpenAI...");
      const response2 = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert at reading ABG (Arterial/Venous Blood Gas) machine printouts from devices like Radiometer ABL800, i-STAT, GEM Premier, etc. You will receive OCR-extracted text from a blood gas report. Extract ONLY the numeric values without units. Be precise. If a value is not found in the text, omit it.`
          },
          {
            role: "user",
            content: `Here is OCR-extracted text from a blood gas report printout:

${ocrText}

Extract all ABG/VBG values. Return ONLY numeric values without units. Respond in JSON:
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
        max_tokens: 1e3,
        response_format: { type: "json_object" }
      });
      const content2 = response2.choices[0]?.message?.content;
      if (!content2) {
        throw new Error("Empty response from AI");
      }
      return JSON.parse(content2);
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
      max_tokens: 1e3,
      response_format: { type: "json_object" }
    });
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }
    return JSON.parse(content);
  } catch (error) {
    console.error("ABG scan extraction error:", error);
    throw new Error("Failed to extract ABG values from image");
  }
}
async function extractClinicalDataFromImage(imageBase64, patientContext) {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error("AI service not available");
  }
  const contextInfo = patientContext ? `Patient context: ${patientContext.patientAge ? `Age ${patientContext.patientAge}` : ""}${patientContext.patientSex ? `, ${patientContext.patientSex}` : ""}${patientContext.presentingComplaint ? `. Presenting complaint: ${patientContext.presentingComplaint}` : ""}` : "";
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
      max_tokens: 2e3,
      response_format: { type: "json_object" }
    });
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }
    return JSON.parse(content);
  } catch (error) {
    console.error("Image extraction error:", error);
    throw new Error("Failed to extract data from image");
  }
}
async function transcribeAndExtractVoice(audioBuffer, filename, patientContext, mode = "full") {
  let transcript = "";
  const { convertAudioToWav: convertAudioToWav2 } = await Promise.resolve().then(() => (init_audioConvert(), audioConvert_exports));
  const converted = await convertAudioToWav2(audioBuffer, filename);
  const wavBuffer = converted.buffer;
  const wavFilename = converted.filename;
  const { isSarvamAvailable: isSarvamAvailable2, sarvamSpeechToTextTranslate: sarvamSpeechToTextTranslate2 } = await Promise.resolve().then(() => (init_sarvamAI(), sarvamAI_exports));
  if (isSarvamAvailable2()) {
    try {
      console.log("[Voice] Using Sarvam AI for speech-to-text (optimized for Indian accents)");
      const sarvamResult = await sarvamSpeechToTextTranslate2(wavBuffer, wavFilename);
      transcript = sarvamResult.transcript || "";
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
    return { transcript: "No speech detected in the recording." };
  }
  if (mode === "full") {
    const structured = await extractClinicalDataFromVoice(transcript, patientContext);
    return { transcript, structured };
  }
  return { transcript };
}
async function extractSmartDictation(transcription, patientContext) {
  const openai = getOpenAIClient();
  if (!openai) {
    console.warn("OpenAI not configured - returning raw transcription only");
    return { rawTranscription: transcription };
  }
  const isPediatric = patientContext?.caseType === "pediatric" || patientContext?.age !== void 0 && patientContext.age <= 16;
  const contextInfo = patientContext ? `Patient context: ${patientContext.age || "unknown"} year old ${patientContext.sex || "patient"}. Case type: ${isPediatric ? "Pediatric (PALS)" : "Adult (ATLS)"}. Note: transcript may have been translated to English from the doctor's original language.` : "No patient context provided";
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
1. Return JSON ONLY \u2014 no markdown, no explanation
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
  "historyOfPresentIllness": "Complete narrative clinical story in third person \u2014 weave onset, duration, progression, character, location, severity, aggravating/relieving factors, associated symptoms, pertinent negatives into flowing prose",
  "associatedSymptoms": "Symptoms accompanying chief complaint",
  "negativeSymptoms": "Pertinent negatives explicitly mentioned",
  "symptoms": [],
  "pastMedicalHistory": ["Known conditions as separate items \u2014 e.g. T2DM, HTN, CAD, CKD"],
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
    "done": false,
    "sampleType": "VBG or ABG",
    "ph": "", "pco2": "", "po2": "", "hco3": "", "be": "", "lactate": "",
    "hemoglobin": "", "sodium": "", "potassium": "", "chloride": "", "creatinine": "", "glucose": "", "bilirubin": ""
  },
  "adjuncts": {
    "ecgDone": false,
    "ecgFindings": "ECG rhythm, rate, ST changes, intervals \u2014 exactly as dictated",
    "echoDone": false,
    "echoFindings": "Echo/bedside echo findings \u2014 LV function, valves, effusion \u2014 exactly as dictated",
    "efastDone": false,
    "efastFindings": "EFAST findings if mentioned"
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
8. If the doctor says phrases like "rest all examination normal", "other systems normal", "rest all systems within normal limits", "systemic examination otherwise normal", "rest of examination unremarkable", "per abdomen soft non-tender rest all normal", "o/e NAD rest normal", or any similar wording indicating that examination systems NOT specifically mentioned with abnormal findings should be considered normal \u2014 set "restAllNormal" to true. This tells the app to auto-fill normal findings for all exam sections that don't have specific abnormalities documented. The examFindings should still contain any SPECIFIC findings the doctor mentioned (both normal details and abnormalities), and restAllNormal covers everything else.`;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert emergency medicine clinical documentation assistant specializing in parsing doctor dictations. You understand Indian English medical terminology, common abbreviations, and clinical workflow. Extract ONLY information explicitly stated or strongly implied in the dictation. Never invent data. Be thorough - capture every clinical detail mentioned."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 4e3,
      response_format: { type: "json_object" }
    });
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }
    const extracted = JSON.parse(content);
    extracted.rawTranscription = transcription;
    if (extracted.primarySurvey && !extracted.vitalsSuggested?.bp) {
      const ps = extracted.primarySurvey;
      extracted.vitalsSuggested = {
        bp: ps.circulation?.bpSystolic && ps.circulation?.bpDiastolic ? `${ps.circulation.bpSystolic}/${ps.circulation.bpDiastolic}` : extracted.vitalsSuggested?.bp || "",
        hr: ps.circulation?.hr || extracted.vitalsSuggested?.hr || "",
        rr: ps.breathing?.rr || extracted.vitalsSuggested?.rr || "",
        spo2: ps.breathing?.spo2 || extracted.vitalsSuggested?.spo2 || "",
        temperature: ps.exposure?.temperature || extracted.vitalsSuggested?.temperature || "",
        grbs: ps.disability?.grbs || extracted.vitalsSuggested?.grbs || "",
        gcs: ps.disability?.gcsTotal || extracted.vitalsSuggested?.gcs || ""
      };
    }
    return extracted;
  } catch (error) {
    console.error("Failed to extract smart dictation data:", error);
    return { rawTranscription: transcription };
  }
}
async function fallbackWhisperTranscribe(audioBuffer, filename) {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error("No transcription service available - neither Sarvam AI nor OpenAI configured");
  }
  try {
    const uint8Array = new Uint8Array(audioBuffer);
    const mimeType = filename.endsWith(".webm") ? "audio/webm" : filename.endsWith(".wav") ? "audio/wav" : filename.endsWith(".mp3") ? "audio/mpeg" : "audio/mp4";
    const file = new File([uint8Array], filename, { type: mimeType });
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file,
      model: "gpt-4o-mini-transcribe",
      language: "en",
      response_format: "json"
    });
    return typeof transcriptionResponse === "string" ? transcriptionResponse : transcriptionResponse.text || "";
  } catch (error) {
    console.error("[Whisper] Transcription error:", error);
    throw new Error("Failed to transcribe audio");
  }
}
var init_aiDiagnosis = __esm({
  "server/services/aiDiagnosis.ts"() {
    "use strict";
    init_db();
    init_schema();
    init_medicalSearch();
  }
});

// server/services/subscription.ts
var subscription_exports = {};
__export(subscription_exports, {
  FREE_CASE_LIMIT: () => FREE_CASE_LIMIT,
  PREMIUM_CASE_LIMIT: () => PREMIUM_CASE_LIMIT,
  PREMIUM_PRICE_INR: () => PREMIUM_PRICE_INR,
  activatePremium: () => activatePremium,
  canCreateCase: () => canCreateCase,
  cancelSubscription: () => cancelSubscription,
  getOrCreateSubscription: () => getOrCreateSubscription,
  incrementCaseCount: () => incrementCaseCount,
  resetMonthlyCases: () => resetMonthlyCases
});
import { eq as eq2 } from "drizzle-orm";
async function getOrCreateSubscription(userId, userEmail) {
  const db2 = getDb();
  const existing = await db2.select().from(subscriptions).where(eq2(subscriptions.userId, userId)).limit(1);
  if (existing.length > 0) {
    return existing[0];
  }
  const [newSub] = await db2.insert(subscriptions).values({
    userId,
    userEmail,
    plan: "free",
    status: "active",
    casesUsed: 0,
    casesLimit: FREE_CASE_LIMIT
  }).returning();
  return newSub;
}
async function canCreateCase(userId, userEmail) {
  const sub = await getOrCreateSubscription(userId, userEmail);
  if (sub.plan !== "free") {
    return { allowed: true, casesUsed: sub.casesUsed, casesLimit: sub.casesLimit, plan: sub.plan };
  }
  if (sub.casesUsed < sub.casesLimit) {
    return { allowed: true, casesUsed: sub.casesUsed, casesLimit: sub.casesLimit, plan: sub.plan };
  }
  return { allowed: false, casesUsed: sub.casesUsed, casesLimit: sub.casesLimit, plan: sub.plan };
}
async function incrementCaseCount(userId, userEmail) {
  const db2 = getDb();
  const sub = await getOrCreateSubscription(userId, userEmail);
  await db2.update(subscriptions).set({
    casesUsed: sub.casesUsed + 1,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq2(subscriptions.id, sub.id));
  return { casesUsed: sub.casesUsed + 1, casesLimit: sub.casesLimit };
}
async function activatePremium(userId, stripeCustomerId, stripeSubscriptionId) {
  const db2 = getDb();
  const sub = await getOrCreateSubscription(userId, "");
  const now = /* @__PURE__ */ new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  await db2.update(subscriptions).set({
    plan: "premium",
    status: "active",
    casesLimit: PREMIUM_CASE_LIMIT,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    stripeCustomerId: stripeCustomerId || sub.stripeCustomerId,
    stripeSubscriptionId: stripeSubscriptionId || sub.stripeSubscriptionId,
    updatedAt: now
  }).where(eq2(subscriptions.id, sub.id));
}
async function cancelSubscription(userId) {
  const db2 = getDb();
  const sub = await getOrCreateSubscription(userId, "");
  await db2.update(subscriptions).set({
    plan: "free",
    status: "cancelled",
    casesLimit: FREE_CASE_LIMIT,
    stripeSubscriptionId: null,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq2(subscriptions.id, sub.id));
}
async function resetMonthlyCases(userId) {
  const db2 = getDb();
  const sub = await getOrCreateSubscription(userId, "");
  await db2.update(subscriptions).set({
    casesUsed: 0,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq2(subscriptions.id, sub.id));
}
var FREE_CASE_LIMIT, PREMIUM_CASE_LIMIT, PREMIUM_PRICE_INR;
var init_subscription = __esm({
  "server/services/subscription.ts"() {
    "use strict";
    init_db();
    init_schema();
    FREE_CASE_LIMIT = 10;
    PREMIUM_CASE_LIMIT = 999999;
    PREMIUM_PRICE_INR = 559;
  }
});

// server/index.ts
import express from "express";

// server/routes.ts
init_aiDiagnosis();
init_subscription();
import { createServer } from "node:http";
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import multer from "multer";

// server/services/emReference.ts
import OpenAI2 from "openai";
function getOpenAIClient2() {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!apiKey || !baseURL) return null;
  return new OpenAI2({ apiKey, baseURL });
}
var EM_SYSTEM_PROMPT = `You are an expert Emergency Medicine reference assistant for doctors and residents. Your role is to provide accurate, evidence-based clinical information for emergency medicine practice.

RESPONSE GUIDELINES:
1. Provide concise, clinically actionable answers organized with clear headings and bullet points.
2. Always cite standard emergency medicine textbooks and guidelines as references at the end.
3. Use markdown formatting: **bold** for key terms, bullet points for lists, numbered steps for protocols.
4. Include diagnostic criteria, management algorithms, and disposition guidelines when relevant.
5. For drug doses, always specify adult vs pediatric doses with weight-based calculations where applicable.
6. Mention red flags, critical actions, and time-sensitive interventions prominently.
7. Keep language professional but accessible for medical practitioners.

REFERENCE SOURCES (cite these when applicable):
- Tintinalli's Emergency Medicine (9th Edition)
- Rosen's Emergency Medicine (10th Edition)
- Roberts & Hedges' Clinical Procedures in Emergency Medicine (7th Edition)
- ATLS - Advanced Trauma Life Support (10th Edition)
- PALS - Pediatric Advanced Life Support
- ACLS - Advanced Cardiovascular Life Support
- Harrison's Principles of Internal Medicine (21st Edition)
- Nelson Textbook of Pediatrics (21st Edition)
- Schwartz's Principles of Surgery (11th Edition)
- UpToDate Clinical Decision Support
- Surviving Sepsis Campaign Guidelines (2021)
- AHA/ACC Guidelines
- WHO Guidelines (where applicable)
- NICE Guidelines (where applicable)
- National Emergency Medicine Guidelines

FORMAT:
- Start with a brief 1-2 line overview/definition
- Then provide structured content with clear sections
- End with "References:" section listing 2-4 most relevant sources used
- Keep total response focused and practical (not excessively long)`;
async function getEMReferenceResponse(messages, topic) {
  const openai = getOpenAIClient2();
  if (!openai) {
    return "AI service is not configured. Please check the setup.";
  }
  const systemContent = topic ? `${EM_SYSTEM_PROMPT}

The user is asking about the topic: "${topic}". Provide focused, detailed information.` : EM_SYSTEM_PROMPT;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemContent },
        ...messages.map((m) => ({ role: m.role, content: m.content }))
      ],
      temperature: 0.3,
      max_tokens: 2e3
    });
    return response.choices[0]?.message?.content || "Unable to generate response.";
  } catch (error) {
    console.error("[EMReference] Error:", error);
    return "An error occurred while generating the response. Please try again.";
  }
}
var EM_TOPICS = {
  core_knowledge: {
    title: "Core Knowledge",
    icon: "book",
    topics: [
      "Sepsis",
      "Shock",
      "Anaphylaxis",
      "Fluid & Blood Therapy",
      "DKA & HHS",
      "Stroke",
      "TIA",
      "Intracranial Bleed",
      "Seizure & Status Epilepticus",
      "Trauma Management Approach",
      "Head Injury Management",
      "Cervical Spine Injury Management",
      "COPD & Asthma",
      "Pneumonia",
      "Pneumothorax",
      "GI Bleed",
      "Pancreatitis",
      "Appendicitis",
      "Cholecystitis",
      "Jaundice",
      "Urinary Tract Infection",
      "Acute Kidney Injury",
      "Pediatric Assessment",
      "Fever & SBI in Children",
      "ARI & Wheezing in Children",
      "UTI in Children",
      "Seizure in Children",
      "Pulmonary Embolism",
      "Aortic Dissection",
      "Esophageal Rupture",
      "Hand & Wrist Injuries",
      "Elbow & Ankle Injuries",
      "Ectopic Pregnancy",
      "Eclampsia",
      "PID",
      "Postpartum Cardiomyopathy",
      "Toxidromes",
      "Eye Emergencies",
      "Ear Emergencies",
      "Dental Emergencies",
      "Neonatal Resuscitation",
      "Sickle Cell Disease",
      "Anemias",
      "Thyroid Storm",
      "Adrenal Crisis"
    ]
  },
  symptomatology: {
    title: "Symptomatology",
    icon: "thermometer",
    topics: [
      "Headache",
      "Chest Pain",
      "Abdominal Pain",
      "Breathlessness",
      "Back Pain",
      "Altered Mental Status",
      "Dizziness & Vertigo",
      "Fever"
    ]
  },
  basic_physiology: {
    title: "Basic Physiology",
    icon: "heart",
    topics: [
      "Lung Physiology",
      "Cardiac Physiology",
      "Renal Physiology",
      "Sodium - Hypo/Hypernatremia",
      "Potassium - Hypo/Hyperkalemia",
      "Calcium - Hypo/Hypercalcemia",
      "Acid-Base Disorders",
      "Coagulation Pathway & Abnormalities"
    ]
  },
  procedures: {
    title: "Procedures",
    icon: "tool",
    topics: [
      "IV & IO Access",
      "Central Line Insertion",
      "Arterial Line",
      "Airway Management",
      "Surgical Airway / Cricothyrotomy",
      "Cardiac Pacing",
      "Chest Tube / Intercostal Drain",
      "Reducing Dislocations",
      "Splinting Techniques",
      "Wound Management",
      "Procedural Sedation",
      "Thoracotomy",
      "Mechanical Ventilation"
    ]
  },
  skills: {
    title: "Clinical Skills",
    icon: "activity",
    topics: [
      "ECG Analysis",
      "ABG Analysis",
      "Chest X-Ray Interpretation",
      "Abdominal X-Ray Interpretation",
      "CT Head Interpretation",
      "Echocardiography Basics",
      "Bedside Ultrasound / POCUS",
      "ENS Examination",
      "CVS Examination",
      "Respiratory Examination",
      "Abdomen Examination",
      "Shoulder Examination",
      "Hand Examination",
      "Knee Examination"
    ]
  }
};

// server/routes.ts
init_db();
init_schema();
import { eq as eq3, desc, count as count2 } from "drizzle-orm";
var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});
function formatDate(dateString) {
  if (!dateString) return (/* @__PURE__ */ new Date()).toLocaleDateString("en-IN");
  try {
    return new Date(dateString).toLocaleDateString("en-IN");
  } catch {
    return (/* @__PURE__ */ new Date()).toLocaleDateString("en-IN");
  }
}
function formatVitals(vitals) {
  if (!vitals) return "";
  const parts = [];
  if (vitals.hr) parts.push(`HR: ${vitals.hr}`);
  const bp = vitals.bp || (vitals.bp_systolic || vitals.bp_diastolic ? `${vitals.bp_systolic || "-"}/${vitals.bp_diastolic || "-"}` : "");
  if (bp) parts.push(`BP: ${bp}`);
  if (vitals.rr) parts.push(`RR: ${vitals.rr}`);
  if (vitals.spo2) parts.push(`SpO2: ${vitals.spo2}%`);
  const temp = vitals.temperature || vitals.temp;
  if (temp) parts.push(`Temp: ${temp}\xB0F`);
  const gcsE = vitals.gcs_e;
  const gcsV = vitals.gcs_v;
  const gcsM = vitals.gcs_m;
  if (gcsE || gcsV || gcsM) {
    const total = (parseInt(gcsE) || 0) + (parseInt(gcsV) || 0) + (parseInt(gcsM) || 0);
    parts.push(`GCS: ${total || "-"} (E${gcsE || "-"}V${gcsV || "-"}M${gcsM || "-"})`);
  } else if (vitals.gcs) {
    parts.push(`GCS: ${vitals.gcs}`);
  }
  if (vitals.pain_score) parts.push(`Pain: ${vitals.pain_score}/10`);
  if (vitals.grbs) parts.push(`GRBS: ${vitals.grbs}`);
  return parts.join(" | ");
}
function formatSecondaryAssessment(assessment) {
  if (!assessment) return "";
  const findings = [];
  if (assessment.pallor) findings.push("Pallor");
  if (assessment.icterus) findings.push("Icterus");
  if (assessment.cyanosis) findings.push("Cyanosis");
  if (assessment.clubbing) findings.push("Clubbing");
  if (assessment.lymphadenopathy) findings.push("Lymphadenopathy");
  if (assessment.edema) findings.push("Edema");
  return findings.length > 0 ? findings.join(", ") : "No significant findings";
}
var linkCodes = /* @__PURE__ */ new Map();
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of linkCodes.entries()) {
    if (now > data.expiresAt) {
      linkCodes.delete(code);
    }
  }
}, 6e4);
function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
function decodeJwt(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = Buffer.from(payloadBase64, "base64").toString("utf8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}
async function registerRoutes(app2) {
  const EXTERNAL_API = process.env.EXPO_PUBLIC_EXTERNAL_API_URL || "https://er-emr-backend.onrender.com/api";
  app2.get("/api/proxy/cases", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "No auth token" });
      const externalRes = await fetch(`${EXTERNAL_API}/cases`, {
        headers: { Authorization: authHeader, "Content-Type": "application/json" }
      });
      const responseText = await externalRes.text();
      if (!externalRes.ok) {
        try {
          return res.status(externalRes.status).json(JSON.parse(responseText));
        } catch {
          return res.status(externalRes.status).send(responseText);
        }
      }
      let casesData;
      try {
        const parsed = JSON.parse(responseText);
        casesData = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.data) ? parsed.data : [];
      } catch {
        return res.status(500).json({ error: "Invalid response from backend" });
      }
      const token = authHeader.replace(/^Bearer\s+/i, "");
      const jwtPayload = decodeJwt(token);
      if (jwtPayload && casesData.length > 0) {
        const userId = jwtPayload.sub || jwtPayload.id || jwtPayload.user_id;
        const userEmail = jwtPayload.email;
        const sample = casesData[0];
        const hasUserField = "doctor_id" in sample || "user_id" in sample || "created_by" in sample || "doctor_email" in sample;
        if (hasUserField) {
          const filtered = casesData.filter((c) => {
            if (userId && (c.doctor_id === userId || c.user_id === userId || c.created_by === userId)) return true;
            if (userEmail && c.doctor_email === userEmail) return true;
            return false;
          });
          console.log(`[PROXY] Cases: ${casesData.length} total \u2192 ${filtered.length} for user ${userEmail || userId}`);
          return res.json(filtered);
        } else {
          console.log(`[PROXY] No user field found on cases. Keys: ${Object.keys(sample).join(", ")}. Returning all ${casesData.length}.`);
        }
      }
      return res.json(casesData);
    } catch (err) {
      console.error("[PROXY] GET /cases error:", err);
      return res.status(500).json({ error: err.message });
    }
  });
  app2.delete("/api/proxy/cases/:id", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "No auth token" });
      const { id } = req.params;
      const externalRes = await fetch(`${EXTERNAL_API}/cases/${id}`, {
        method: "DELETE",
        headers: { Authorization: authHeader, "Content-Type": "application/json" }
      });
      const responseText = await externalRes.text();
      try {
        return res.status(externalRes.status).json(JSON.parse(responseText));
      } catch {
        return res.status(externalRes.status).send(responseText);
      }
    } catch (err) {
      console.error("[PROXY] DELETE /cases/:id error:", err);
      return res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/proxy/clinical-data/:caseId", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "No auth token" });
      const token = authHeader.replace(/^Bearer\s+/i, "");
      const jwtPayload = decodeJwt(token);
      if (!jwtPayload) return res.status(401).json({ error: "Invalid token" });
      const userId = jwtPayload.sub || jwtPayload.id || jwtPayload.user_id || jwtPayload.email;
      if (!userId) return res.status(401).json({ error: "Cannot identify user" });
      const { caseId } = req.params;
      const payload = req.body;
      const db2 = getDb();
      if (!db2) return res.status(503).json({ error: "Database unavailable" });
      const { caseClinicalData: caseClinicalData2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { sql: drizzleSqlFn } = await import("drizzle-orm");
      await db2.insert(caseClinicalData2).values({
        caseId,
        userId,
        payload
      }).onConflictDoUpdate({
        target: [caseClinicalData2.caseId, caseClinicalData2.userId],
        set: {
          payload,
          updatedAt: drizzleSqlFn`CURRENT_TIMESTAMP`
        }
      });
      console.log(`[CLINICAL] Saved clinical data for case ${caseId} user ${userId}`);
      return res.json({ success: true });
    } catch (err) {
      console.error("[CLINICAL] POST error:", err);
      return res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/proxy/clinical-data/:caseId", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "No auth token" });
      const token = authHeader.replace(/^Bearer\s+/i, "");
      const jwtPayload = decodeJwt(token);
      if (!jwtPayload) return res.status(401).json({ error: "Invalid token" });
      const userId = jwtPayload.sub || jwtPayload.id || jwtPayload.user_id || jwtPayload.email;
      if (!userId) return res.status(401).json({ error: "Cannot identify user" });
      const { caseId } = req.params;
      const db2 = getDb();
      if (!db2) return res.status(503).json({ error: "Database unavailable" });
      const { caseClinicalData: caseClinicalData2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eq4, and } = await import("drizzle-orm");
      const rows = await db2.select().from(caseClinicalData2).where(and(eq4(caseClinicalData2.caseId, caseId), eq4(caseClinicalData2.userId, userId))).limit(1);
      if (rows.length === 0) return res.json({ found: false });
      return res.json({ found: true, payload: rows[0].payload, updatedAt: rows[0].updatedAt });
    } catch (err) {
      console.error("[CLINICAL] GET error:", err);
      return res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/auth/generate-link-code", async (req, res) => {
    try {
      const { userId, userEmail, userName, token } = req.body;
      if (!userId || !token) {
        return res.status(400).json({ error: "userId and token are required" });
      }
      let code = generateCode();
      while (linkCodes.has(code)) {
        code = generateCode();
      }
      const now = Date.now();
      const expiresIn = 300;
      linkCodes.set(code, {
        userId,
        userEmail: userEmail || "",
        userName: userName || "",
        token,
        createdAt: now,
        expiresAt: now + expiresIn * 1e3
      });
      const domain = process.env.REPLIT_DOMAINS ? process.env.REPLIT_DOMAINS.split(",")[0].trim() : process.env.REPLIT_DEV_DOMAIN || process.env.REPL_SLUG + ".replit.app";
      const url = `https://${domain}/web?code=${code}`;
      res.json({
        success: true,
        data: {
          code,
          url,
          expires_in: expiresIn
        }
      });
    } catch (error) {
      console.error("[Link Code] Generate error:", error);
      res.status(500).json({ error: "Failed to generate link code" });
    }
  });
  app2.get("/api/auth/verify-link-code", async (req, res) => {
    try {
      const code = (req.query.code || "").toUpperCase();
      if (!code) {
        return res.status(400).json({ error: "Code is required" });
      }
      const linkData = linkCodes.get(code);
      if (!linkData) {
        return res.status(404).json({ error: "Invalid or expired code" });
      }
      if (Date.now() > linkData.expiresAt) {
        linkCodes.delete(code);
        return res.status(410).json({ error: "Code has expired" });
      }
      linkCodes.delete(code);
      res.json({
        success: true,
        access_token: linkData.token,
        user: {
          id: linkData.userId,
          email: linkData.userEmail,
          name: linkData.userName
        }
      });
    } catch (error) {
      console.error("[Link Code] Verify error:", error);
      res.status(500).json({ error: "Failed to verify link code" });
    }
  });
  const qrSessions = /* @__PURE__ */ new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [t, d] of qrSessions.entries()) {
      if (now > d.expiresAt) qrSessions.delete(t);
    }
  }, 6e4);
  app2.post("/api/device-link/generate", async (req, res) => {
    try {
      const { randomUUID: randomUUID2 } = await import("crypto");
      const token = randomUUID2();
      const expiresIn = 300;
      qrSessions.set(token, {
        status: "pending",
        createdAt: Date.now(),
        expiresAt: Date.now() + expiresIn * 1e3
      });
      const domain = process.env.REPLIT_DOMAINS ? process.env.REPLIT_DOMAINS.split(",")[0].trim() : process.env.REPLIT_DEV_DOMAIN || (process.env.REPL_SLUG || "ermate") + ".replit.app";
      const qrUrl = `https://${domain}/web?qr_token=${token}`;
      return res.json({ success: true, token, qr_url: qrUrl, expires_in: expiresIn });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/device-link/approve", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Auth required" });
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "token required" });
      const session = qrSessions.get(token);
      if (!session) return res.status(404).json({ error: "Invalid or expired QR session" });
      if (Date.now() > session.expiresAt) {
        qrSessions.delete(token);
        return res.status(410).json({ error: "QR code expired" });
      }
      const authToken = authHeader.replace(/^Bearer\s+/i, "");
      const jwtPayload = decodeJwt(authToken);
      session.status = "approved";
      session.authToken = authToken;
      session.userId = jwtPayload?.sub || jwtPayload?.id || jwtPayload?.user_id || "";
      session.userEmail = jwtPayload?.email || "";
      session.userName = jwtPayload?.name || "";
      console.log(`[DeviceLink] QR approved by ${session.userEmail || session.userId}`);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/device-link/status", async (req, res) => {
    try {
      const token = (req.query.token || "").trim();
      if (!token) return res.status(400).json({ error: "token required" });
      const session = qrSessions.get(token);
      if (!session || Date.now() > session.expiresAt) {
        if (session) qrSessions.delete(token);
        return res.json({ status: "expired" });
      }
      if (session.status === "approved") {
        const result = {
          status: "approved",
          authToken: session.authToken,
          user: { id: session.userId, email: session.userEmail, name: session.userName }
        };
        qrSessions.delete(token);
        return res.json(result);
      }
      return res.json({ status: "pending", expires_in: Math.floor((session.expiresAt - Date.now()) / 1e3) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app2.get("/manifest.json", (_req, res) => {
    res.setHeader("Content-Type", "application/manifest+json");
    res.json({
      name: "ErMate",
      short_name: "ErMate",
      description: "Emergency Room EMR \u2014 voice-powered case documentation",
      start_url: "/web",
      display: "standalone",
      background_color: "#0a0e1a",
      theme_color: "#3b82f6",
      orientation: "portrait-primary",
      icons: [
        { src: "/assets/images/icon.png", sizes: "192x192", type: "image/png" },
        { src: "/assets/images/icon.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
      ]
    });
  });
  app2.post("/api/auth/google", async (req, res) => {
    try {
      const { idToken, accessToken, name, email, password } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      const EXTERNAL_API2 = "https://er-emr-backend.onrender.com/api";
      const safeJsonParse = async (response) => {
        const text2 = await response.text();
        try {
          return JSON.parse(text2);
        } catch {
          console.warn("[Google Auth] Non-JSON response:", text2.substring(0, 200));
          return null;
        }
      };
      const loginPassword = password || email;
      let loginRes = await fetch(`${EXTERNAL_API2}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: loginPassword })
      });
      if (loginRes.ok) {
        const loginData = await safeJsonParse(loginRes);
        if (loginData) return res.json(loginData);
      }
      const registerRes = await fetch(`${EXTERNAL_API2}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || email.split("@")[0],
          email,
          password: email,
          role: "resident"
        })
      });
      if (registerRes.ok) {
        const registerData = await safeJsonParse(registerRes);
        if (registerData) return res.json(registerData);
      }
      const regErrorText = await registerRes.text().catch(() => "");
      console.error("[Google Auth] Registration failed:", regErrorText);
      const emailAlreadyExists = regErrorText.toLowerCase().includes("already registered") || regErrorText.toLowerCase().includes("already exists") || regErrorText.toLowerCase().includes("duplicate");
      if (emailAlreadyExists) {
        return res.status(401).json({
          error: "An account with this email already exists. Please sign in using your email and password instead."
        });
      }
      loginRes = await fetch(`${EXTERNAL_API2}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: email })
      });
      if (loginRes.ok) {
        const loginData = await safeJsonParse(loginRes);
        if (loginData) return res.json(loginData);
      }
      return res.status(401).json({ error: "Google sign-in failed. The server may be temporarily unavailable \u2014 please try again in a moment." });
    } catch (error) {
      console.error("[Google Auth] Error:", error);
      res.status(500).json({ error: "Google sign-in failed. Please try again." });
    }
  });
  app2.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      const EXTERNAL_API2 = "https://er-emr-backend.onrender.com/api";
      const response = await fetch(`${EXTERNAL_API2}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return res.json({ success: true, message: data.message || "If an account exists with this email, a password reset link has been sent." });
      }
      return res.json({ success: true, message: "If an account exists with this email, a password reset link has been sent." });
    } catch (error) {
      console.error("[Forgot Password] Error:", error);
      return res.json({ success: true, message: "If an account exists with this email, a password reset link has been sent." });
    }
  });
  app2.post("/api/export/discharge-pdf", async (req, res) => {
    try {
      const data = req.body;
      if (!data.patient || !data.discharge_summary) {
        return res.status(400).json({ error: "Missing patient or discharge summary data" });
      }
      const ds = data.discharge_summary;
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 40, bottom: 40, left: 50, right: 50 }
      });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(chunks);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="discharge_summary_${(data.patient.name || "patient").replace(/\s+/g, "_")}.pdf"`);
        res.send(pdfBuffer);
      });
      doc.fontSize(18).font("Helvetica-Bold").text("DISCHARGE SUMMARY", { align: "center" });
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica").text("Emergency Department", { align: "center" });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica-Bold").text("PATIENT INFORMATION");
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(10);
      doc.text(`Name: ${data.patient.name || "N/A"}        Age/Sex: ${data.patient.age || "N/A"} / ${data.patient.sex || "N/A"}`);
      doc.text(`MLC: ${ds.mlc ? "Yes" : "No"}        Allergy: ${ds.allergy || "No known allergies"}`);
      doc.text(`Admission: ${formatDate(data.created_at)}        Discharge: ${ds.discharge_date || formatDate()}`);
      doc.moveDown(0.5);
      if (ds.vitals_arrival) {
        doc.font("Helvetica-Bold").fontSize(10).text("Vitals at Time of Arrival:");
        doc.font("Helvetica").text(formatVitals(ds.vitals_arrival));
        doc.moveDown(0.3);
      }
      if (ds.presenting_complaint) {
        doc.font("Helvetica-Bold").text("Presenting Complaints:");
        doc.font("Helvetica").text(ds.presenting_complaint);
        doc.moveDown(0.3);
      }
      if (ds.history_of_present_illness) {
        doc.font("Helvetica-Bold").text("History of Present Illness:");
        doc.font("Helvetica").text(ds.history_of_present_illness);
        doc.moveDown(0.3);
      }
      if (ds.past_medical_history) {
        doc.font("Helvetica-Bold").text("Past Medical/Surgical Histories:");
        doc.font("Helvetica").text(ds.past_medical_history);
        doc.moveDown(0.3);
      }
      if (ds.family_history || ds.lmp) {
        if (ds.family_history) {
          doc.font("Helvetica-Bold").text("Family/Gynae History:");
          doc.font("Helvetica").text(ds.family_history);
        }
        if (ds.lmp) {
          doc.font("Helvetica-Bold").text("LMP:");
          doc.font("Helvetica").text(ds.lmp);
        }
        doc.moveDown(0.3);
      }
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").fontSize(11).text("PRIMARY ASSESSMENT");
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(10);
      if (ds.primary_assessment) {
        const pa = ds.primary_assessment;
        if (pa.airway) doc.text(`Airway: ${pa.airway}`);
        if (pa.breathing) doc.text(`Breathing: ${pa.breathing}`);
        if (pa.circulation) doc.text(`Circulation: ${pa.circulation}`);
        if (pa.disability) doc.text(`Disability: ${pa.disability}`);
        if (pa.exposure) doc.text(`Exposure: ${pa.exposure}`);
        if (pa.efast) doc.text(`EFAST: ${pa.efast}`);
      }
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").fontSize(11).text("SECONDARY ASSESSMENT");
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(10);
      doc.text(`General Examination: ${formatSecondaryAssessment(ds.secondary_assessment)}`);
      if (ds.systemic_exam) {
        const se = ds.systemic_exam;
        if (se.chest) doc.text(`CHEST: ${se.chest}`);
        if (se.cvs) doc.text(`CVS: ${se.cvs}`);
        if (se.pa) doc.text(`P/A: ${se.pa}`);
        if (se.cns) doc.text(`CNS: ${se.cns}`);
        if (se.extremities) doc.text(`EXTREMITIES: ${se.extremities}`);
      }
      doc.moveDown(0.5);
      if (ds.course_in_hospital) {
        doc.font("Helvetica-Bold").fontSize(11).text("COURSE IN HOSPITAL WITH MEDICATIONS AND PROCEDURES");
        doc.moveDown(0.2);
        doc.font("Helvetica").fontSize(10).text(ds.course_in_hospital);
        doc.moveDown(0.3);
      }
      if (ds.investigations) {
        doc.font("Helvetica-Bold").fontSize(10).text("Investigations:");
        doc.font("Helvetica").text(ds.investigations);
        doc.moveDown(0.3);
      }
      if (ds.diagnosis) {
        doc.font("Helvetica-Bold").fontSize(11).text("DIAGNOSIS AT TIME OF DISCHARGE");
        doc.moveDown(0.2);
        doc.font("Helvetica").fontSize(10).text(ds.diagnosis);
        doc.moveDown(0.3);
      }
      if (ds.discharge_medications) {
        doc.font("Helvetica-Bold").fontSize(10).text("Discharge Medications:");
        doc.font("Helvetica").text(ds.discharge_medications);
        doc.moveDown(0.3);
      }
      doc.font("Helvetica-Bold").fontSize(10).text("Disposition:");
      doc.font("Helvetica").text(`[ ${ds.disposition_type === "Normal Discharge" ? "X" : " "} ] Normal Discharge`);
      doc.text(`[ ${ds.disposition_type === "Discharge at Request" ? "X" : " "} ] Discharge at Request`);
      doc.text(`[ ${ds.disposition_type === "Discharge Against Medical Advice" ? "X" : " "} ] Discharge Against Medical Advice`);
      doc.text(`[ ${ds.disposition_type === "Referred" ? "X" : " "} ] Referred`);
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").text(`Condition at Time of Discharge: ${ds.condition_at_discharge || "STABLE"}`);
      doc.moveDown(0.3);
      if (ds.vitals_discharge) {
        doc.font("Helvetica-Bold").text("Vitals at Time of Discharge:");
        doc.font("Helvetica").text(formatVitals(ds.vitals_discharge));
        doc.moveDown(0.3);
      }
      if (ds.follow_up_advice) {
        doc.font("Helvetica-Bold").text("Follow-Up Advice:");
        doc.font("Helvetica").text(ds.follow_up_advice);
        doc.moveDown(0.5);
      }
      doc.moveDown(0.5);
      const sigY = doc.y;
      doc.text(`ED Resident: ${ds.ed_resident || "_________________"}`, 50, sigY);
      doc.text(`ED Consultant: ${ds.ed_consultant || "_________________"}`, 300, sigY);
      doc.moveDown(0.3);
      const timeY = doc.y;
      doc.text(`Sign and Time: ${ds.sign_time_resident || "_________________"}`, 50, timeY);
      doc.text(`Sign and Time: ${ds.sign_time_consultant || "_________________"}`, 300, timeY);
      doc.moveDown(0.5);
      doc.text(`Date: ${ds.discharge_date || formatDate()}`, 50);
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);
      doc.fontSize(8).font("Helvetica-Oblique");
      doc.text("This discharge summary provides clinical information meant to facilitate continuity of patient care. For statutory purposes, a treatment/discharge certificate shall be issued on request. For a disability certificate, approach a Government-constituted Medical Board.", { align: "center" });
      doc.end();
    } catch (err) {
      console.error("PDF generation error:", err);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });
  app2.post("/api/export/discharge-docx", async (req, res) => {
    try {
      const data = req.body;
      if (!data.patient || !data.discharge_summary) {
        return res.status(400).json({ error: "Missing patient or discharge summary data" });
      }
      const ds = data.discharge_summary;
      const children = [];
      children.push(
        new Paragraph({
          text: "DISCHARGE SUMMARY",
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 }
        }),
        new Paragraph({
          text: "Emergency Department",
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 }
        })
      );
      children.push(
        new Paragraph({
          text: "PATIENT INFORMATION",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        }),
        new Paragraph({ text: `Name: ${data.patient.name || "N/A"}        Age/Sex: ${data.patient.age || "N/A"} / ${data.patient.sex || "N/A"}` }),
        new Paragraph({ text: `MLC: ${ds.mlc ? "Yes" : "No"}        Allergy: ${ds.allergy || "No known allergies"}` }),
        new Paragraph({ text: `Admission: ${formatDate(data.created_at)}        Discharge: ${ds.discharge_date || formatDate()}`, spacing: { after: 200 } })
      );
      if (ds.vitals_arrival) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: "Vitals at Time of Arrival: ", bold: true }), new TextRun({ text: formatVitals(ds.vitals_arrival) })] })
        );
      }
      if (ds.presenting_complaint) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: "Presenting Complaints: ", bold: true }), new TextRun({ text: ds.presenting_complaint })] })
        );
      }
      if (ds.history_of_present_illness) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: "History of Present Illness: ", bold: true }), new TextRun({ text: ds.history_of_present_illness })] })
        );
      }
      if (ds.past_medical_history) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: "Past Medical/Surgical Histories: ", bold: true }), new TextRun({ text: ds.past_medical_history })] })
        );
      }
      if (ds.family_history) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: "Family/Gynae History: ", bold: true }), new TextRun({ text: ds.family_history })] })
        );
      }
      if (ds.lmp) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: "LMP: ", bold: true }), new TextRun({ text: ds.lmp })] })
        );
      }
      children.push(
        new Paragraph({
          text: "PRIMARY ASSESSMENT",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 }
        })
      );
      if (ds.primary_assessment) {
        const pa = ds.primary_assessment;
        if (pa.airway) children.push(new Paragraph({ text: `Airway: ${pa.airway}` }));
        if (pa.breathing) children.push(new Paragraph({ text: `Breathing: ${pa.breathing}` }));
        if (pa.circulation) children.push(new Paragraph({ text: `Circulation: ${pa.circulation}` }));
        if (pa.disability) children.push(new Paragraph({ text: `Disability: ${pa.disability}` }));
        if (pa.exposure) children.push(new Paragraph({ text: `Exposure: ${pa.exposure}` }));
        if (pa.efast) children.push(new Paragraph({ text: `EFAST: ${pa.efast}` }));
      }
      children.push(
        new Paragraph({
          text: "SECONDARY ASSESSMENT",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 }
        }),
        new Paragraph({ text: `General Examination: ${formatSecondaryAssessment(ds.secondary_assessment)}` })
      );
      if (ds.systemic_exam) {
        const se = ds.systemic_exam;
        if (se.chest) children.push(new Paragraph({ text: `CHEST: ${se.chest}` }));
        if (se.cvs) children.push(new Paragraph({ text: `CVS: ${se.cvs}` }));
        if (se.pa) children.push(new Paragraph({ text: `P/A: ${se.pa}` }));
        if (se.cns) children.push(new Paragraph({ text: `CNS: ${se.cns}` }));
        if (se.extremities) children.push(new Paragraph({ text: `EXTREMITIES: ${se.extremities}` }));
      }
      if (ds.course_in_hospital) {
        children.push(
          new Paragraph({
            text: "COURSE IN HOSPITAL WITH MEDICATIONS AND PROCEDURES",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 }
          }),
          new Paragraph({ text: ds.course_in_hospital, spacing: { after: 200 } })
        );
      }
      if (ds.investigations) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: "Investigations: ", bold: true }), new TextRun({ text: ds.investigations })] })
        );
      }
      if (ds.diagnosis) {
        children.push(
          new Paragraph({
            text: "DIAGNOSIS AT TIME OF DISCHARGE",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 }
          }),
          new Paragraph({ text: ds.diagnosis, spacing: { after: 200 } })
        );
      }
      if (ds.discharge_medications) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: "Discharge Medications: ", bold: true }), new TextRun({ text: ds.discharge_medications })] })
        );
      }
      children.push(
        new Paragraph({ children: [new TextRun({ text: "Disposition:", bold: true })], spacing: { before: 200 } }),
        new Paragraph({ text: `[ ${ds.disposition_type === "Normal Discharge" ? "X" : " "} ] Normal Discharge` }),
        new Paragraph({ text: `[ ${ds.disposition_type === "Discharge at Request" ? "X" : " "} ] Discharge at Request` }),
        new Paragraph({ text: `[ ${ds.disposition_type === "Discharge Against Medical Advice" ? "X" : " "} ] Discharge Against Medical Advice` }),
        new Paragraph({ text: `[ ${ds.disposition_type === "Referred" ? "X" : " "} ] Referred` })
      );
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `Condition at Time of Discharge: ${ds.condition_at_discharge || "STABLE"}`, bold: true })],
          spacing: { before: 200 }
        })
      );
      if (ds.vitals_discharge) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: "Vitals at Time of Discharge: ", bold: true }), new TextRun({ text: formatVitals(ds.vitals_discharge) })] })
        );
      }
      if (ds.follow_up_advice) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: "Follow-Up Advice: ", bold: true }), new TextRun({ text: ds.follow_up_advice })], spacing: { after: 300 } })
        );
      }
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `ED Resident: ${ds.ed_resident || "_________________"}` }),
            new TextRun({ text: "     |     " }),
            new TextRun({ text: `ED Consultant: ${ds.ed_consultant || "_________________"}` })
          ],
          spacing: { before: 400 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Sign and Time: ${ds.sign_time_resident || "_________________"}` }),
            new TextRun({ text: "     |     " }),
            new TextRun({ text: `Sign and Time: ${ds.sign_time_consultant || "_________________"}` })
          ],
          spacing: { before: 100 }
        }),
        new Paragraph({ text: `Date: ${ds.discharge_date || formatDate()}`, spacing: { before: 100, after: 300 } })
      );
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "This discharge summary provides clinical information meant to facilitate continuity of patient care. For statutory purposes, a treatment/discharge certificate shall be issued on request. For a disability certificate, approach a Government-constituted Medical Board.",
              italics: true,
              size: 18
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200 }
        })
      );
      const docxDoc = new Document({
        sections: [
          {
            properties: {},
            children
          }
        ]
      });
      const buffer = await Packer.toBuffer(docxDoc);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="discharge_summary_${(data.patient.name || "patient").replace(/\s+/g, "_")}.docx"`);
      res.send(Buffer.from(buffer));
    } catch (err) {
      console.error("DOCX generation error:", err);
      res.status(500).json({ error: "Failed to generate DOCX" });
    }
  });
  app2.post("/api/export/casesheet-pdf", async (req, res) => {
    try {
      const data = req.body;
      if (!data.patient) {
        return res.status(400).json({ error: "Missing patient data" });
      }
      const patientAge = parseFloat(data.patient?.age) || 0;
      const isPed = patientAge > 0 && patientAge <= 16;
      const primary = data.primary_assessment || data.abcde || {};
      const vitals = data.vitals_at_arrival || data.triage?.vitals || {};
      const adjuncts = data.adjuncts || {};
      const abgData = data.abg || adjuncts.abg || {};
      const history = data.history || {};
      const exam = data.examination || {};
      const investigations = data.investigations || {};
      const treatment = data.treatment || {};
      const procedures = data.procedures || {};
      const proceduresPerformed = data.procedures_performed || procedures.procedures_performed || procedures.performed || [];
      const proceduresNotes = procedures.general_notes || procedures.generalNotes || "";
      const disposition = data.disposition || {};
      const erObs = data.er_observation || {};
      const addendumNotes = treatment.addendum_notes || data.addendum_notes || [];
      const airway = primary.airway || {};
      const breathing = primary.breathing || {};
      const circulation = primary.circulation || {};
      const disability = primary.disability || {};
      const exposure = primary.exposure || {};
      const pat = primary.pat || {};
      const efast = primary.efast || {};
      const nv = (val, dflt) => {
        if (val === void 0 || val === null || val === "") return dflt;
        if (Array.isArray(val)) return val.length > 0 ? val.filter(Boolean).join(", ") : dflt;
        return String(val);
      };
      console.log("[EXPORT] PDF casesheet | isPediatric:", isPed);
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(chunks);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="casesheet_${(data.patient?.name || "patient").replace(/\s+/g, "_")}.pdf"`);
        res.send(pdfBuffer);
      });
      const pdfLine = () => {
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      };
      const pdfHeading = (t) => {
        doc.moveDown(0.3);
        doc.fontSize(11).font("Helvetica-Bold").text(t.toUpperCase());
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.2);
        doc.fontSize(10).font("Helvetica");
      };
      const pdfSubHeading = (t) => {
        doc.moveDown(0.15);
        doc.fontSize(10).font("Helvetica-Bold").text(t);
        doc.font("Helvetica");
      };
      const pdfField = (label, val, dflt = "") => {
        const display = val !== void 0 && val !== null && val !== "" ? String(val) : dflt;
        if (display !== "") doc.text(`${label}: ${display}`);
      };
      const pdfAlways = (label, val, dflt) => {
        const display = val !== void 0 && val !== null && val !== "" ? String(val) : dflt;
        doc.text(`${label}: ${display}`);
      };
      const ensureSpace = (needed = 80) => {
        if (doc.y > 750 - needed) doc.addPage();
      };
      doc.fontSize(16).font("Helvetica-Bold").text("EMERGENCY DEPARTMENT CASE SHEET", { align: "center" });
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica").text(`Generated: ${(/* @__PURE__ */ new Date()).toLocaleDateString("en-IN")}`, { align: "center" });
      doc.moveDown(0.4);
      pdfLine();
      pdfHeading("PATIENT INFORMATION");
      doc.text(`Name: ${data.patient?.name || "N/A"}        Age/Sex: ${data.patient?.age || "N/A"} / ${data.patient?.sex || "N/A"}`);
      if (data.patient?.uhid) pdfField("UHID", data.patient.uhid);
      if (data.patient?.phone) pdfField("Phone", data.patient.phone);
      pdfAlways("Mode of Arrival", data.patient?.mode_of_arrival || data.mode_of_arrival, "Not specified");
      if (isPed && data.patient?.weight) doc.text(`Weight: ${data.patient.weight} kg`);
      doc.text(`MLC: ${data.mlc ? "Yes" : "No"}`);
      if (data.patient?.arrival_datetime) doc.text(`Arrival Time: ${new Date(data.patient.arrival_datetime).toLocaleString("en-IN")}`);
      if (data.em_resident) pdfField("EM Resident", data.em_resident);
      if (data.em_consultant) pdfField("EM Consultant", data.em_consultant);
      if (data.triage_priority) doc.text(`Triage: Priority ${data.triage_priority} - ${(data.triage_color || "").toUpperCase()}`);
      const complaintText = data.presenting_complaint?.text || data.triage?.chief_complaint || "";
      if (complaintText) {
        let ccLine = complaintText;
        if (data.presenting_complaint?.duration) ccLine += ` | Duration: ${data.presenting_complaint.duration}`;
        if (data.presenting_complaint?.onset_type) ccLine += ` | Onset: ${data.presenting_complaint.onset_type}`;
        doc.text(`Presenting Complaint: ${ccLine}`);
      }
      doc.moveDown(0.3);
      ensureSpace();
      pdfHeading("VITALS AT ARRIVAL");
      const vHR = vitals.hr || vitals.heart_rate || "";
      const vBPS = vitals.bp_systolic || vitals.systolic || "";
      const vBPD = vitals.bp_diastolic || vitals.diastolic || "";
      const vRR = vitals.rr || vitals.respiratory_rate || "";
      const vSpO2 = vitals.spo2 || vitals.oxygen_saturation || "";
      const vTemp = vitals.temperature || "";
      const vGCSE = vitals.gcs_e || "";
      const vGCSV = vitals.gcs_v || "";
      const vGCSM = vitals.gcs_m || "";
      const vGCST = vitals.gcs_total || vitals.gcs || (vGCSE || vGCSV || vGCSM ? `${(parseInt(vGCSE) || 0) + (parseInt(vGCSV) || 0) + (parseInt(vGCSM) || 0)}` : "");
      const vPain = vitals.pain_score || "";
      const vGRBS = vitals.grbs || vitals.glucose || "";
      doc.text(`HR: ${vHR || "\u2014"} bpm    BP: ${vBPS && vBPD ? vBPS + "/" + vBPD : vBPS || "\u2014"} mmHg    RR: ${vRR || "\u2014"} /min    SpO2: ${vSpO2 || "\u2014"}%`);
      doc.text(`Temp: ${vTemp || "\u2014"} \xB0F    GCS: ${vGCST || "\u2014"} (E${vGCSE || "\u2014"}V${vGCSV || "\u2014"}M${vGCSM || "\u2014"})    Pain: ${vPain || "\u2014"}/10    GRBS: ${vGRBS || "\u2014"} mg/dL`);
      doc.moveDown(0.3);
      ensureSpace();
      pdfHeading("PRIMARY ASSESSMENT (ABCDE)");
      if (isPed) {
        pdfSubHeading("Pediatric Assessment Triangle (PAT)");
        const appearance = pat.appearance || {};
        doc.text(`Appearance \u2014 Tone: ${nv(appearance.tone || pat.tone, "Normal")}, Interactivity: ${nv(appearance.interactivity || pat.interactivity, "Normal")}, Consolability: ${nv(appearance.consolability || pat.consolability, "Normal")}, Look/Gaze: ${nv(appearance.lookGaze || pat.lookGaze, "Normal")}, Speech/Cry: ${nv(appearance.speechCry || pat.speechCry, "Normal")}`);
        doc.text(`Work of Breathing: ${nv(pat.workOfBreathing, "Normal")}    Circulation to Skin: ${nv(pat.circulationToSkin, "Normal")}`);
        doc.moveDown(0.15);
      }
      pdfSubHeading("A \u2014 Airway");
      const airwayStatus = airway.status || primary.airway_status;
      const airwayInterventions = airway.interventions || primary.airway_interventions || airway.intervention;
      pdfAlways("Status", airwayStatus, "Patent");
      pdfAlways("Interventions", airwayInterventions ? Array.isArray(airwayInterventions) ? airwayInterventions.join(", ") : airwayInterventions : "", "None required");
      if (airway.cry) pdfField("Cry", airway.cry);
      pdfField("Notes", airway.notes || primary.airway_additional_notes);
      pdfSubHeading("B \u2014 Breathing");
      const bRR = breathing.rr || breathing.respiratoryRate || primary.breathing_rr;
      const bSpO2 = breathing.spo2 || primary.breathing_spo2;
      const bEffort = breathing.effort || breathing.workOfBreathing || primary.breathing_work;
      doc.text(`RR: ${nv(bRR, vRR || "Normal")}    SpO2: ${nv(bSpO2, vSpO2 ? vSpO2 + "%" : "Normal")}    Effort: ${nv(bEffort, "Normal")}`);
      pdfAlways("Air Entry", breathing.airEntry, "Equal bilateral air entry");
      pdfAlways("Chest Expansion", breathing.chestExpansion, "Equal");
      pdfAlways("Added Sounds", breathing.addedSounds, "None");
      if (breathing.o2Device || primary.breathing_oxygen_device) doc.text(`O2 Device: ${breathing.o2Device || primary.breathing_oxygen_device}${breathing.o2Flow || primary.breathing_oxygen_flow ? " @ " + (breathing.o2Flow || primary.breathing_oxygen_flow) + " L/min" : ""}`);
      if (breathing.intervention) pdfField("Interventions", Array.isArray(breathing.intervention) ? breathing.intervention.join(", ") : breathing.intervention);
      pdfField("Notes", breathing.notes || primary.breathing_additional_notes);
      pdfSubHeading("C \u2014 Circulation");
      const cHR = circulation.hr || circulation.heartRate || primary.circulation_hr;
      const cBPS = circulation.bpSystolic || primary.circulation_bp_systolic || circulation.bloodPressure;
      const cBPD = circulation.bpDiastolic || primary.circulation_bp_diastolic;
      const cCRT = circulation.capillaryRefill || circulation.crt || primary.circulation_crt;
      doc.text(`HR: ${nv(cHR, vHR || "Normal")}    BP: ${cBPS && cBPD ? cBPS + "/" + cBPD : cBPS || (vBPS && vBPD ? vBPS + "/" + vBPD : "Normal")}    CRT: ${nv(cCRT, "<2 sec")}`);
      pdfAlways("Pulse Quality", circulation.pulseQuality || circulation.pulses, "Normal volume, regular");
      pdfAlways("Skin Color/Temp", circulation.skinColorTemp, "Normal color, warm peripheries");
      if (circulation.distendedNeckVeins) pdfField("Neck Veins", circulation.distendedNeckVeins);
      const cAdj = circulation.interventions || primary.circulation_adjuncts || circulation.intervention;
      pdfAlways("IV Access", cAdj ? Array.isArray(cAdj) ? cAdj.join(", ") : cAdj : circulation.ivAccess || "", "Not established");
      pdfField("Notes", circulation.notes || primary.circulation_additional_notes);
      pdfSubHeading("D \u2014 Disability");
      const dAVPU = disability.motorResponse || disability.avpuGcs || primary.disability_avpu;
      const dGE = disability.gcsE || primary.disability_gcs_e || vGCSE;
      const dGV = disability.gcsV || primary.disability_gcs_v || vGCSV;
      const dGM = disability.gcsM || primary.disability_gcs_m || vGCSM;
      const dPupilSize = disability.pupilSize || disability.pupils || primary.disability_pupils_size;
      const dPupilReact = disability.pupilReaction || primary.disability_pupils_reaction;
      const dGlucose = disability.glucose || primary.disability_grbs || vGRBS;
      const dGCSStr = dGE || dGV || dGM ? `${(parseInt(dGE) || 0) + (parseInt(dGV) || 0) + (parseInt(dGM) || 0)} (E${dGE || "\u2014"}V${dGV || "\u2014"}M${dGM || "\u2014"})` : vGCST ? vGCST : "15 (E4V5M6)";
      pdfAlways("AVPU", dAVPU, "Alert");
      doc.text(`GCS: ${dGCSStr}`);
      doc.text(`Pupils: ${nv(dPupilSize, "Equal, 3 mm")} \u2014 Reaction: ${nv(dPupilReact, "Briskly reactive bilaterally")}`);
      pdfAlways("Blood Glucose", dGlucose, "Normal");
      if (disability.abnormalResponses) pdfField("Abnormal Responses", disability.abnormalResponses);
      pdfField("Notes", disability.notes || primary.disability_additional_notes);
      pdfSubHeading("E \u2014 Exposure");
      const eTemp = exposure.temperature || primary.exposure_temperature;
      pdfAlways("Temperature", eTemp, vTemp || "Normal");
      pdfAlways("Trauma", exposure.trauma, "None");
      pdfAlways("Signs of Trauma/Illness", exposure.signsOfTraumaIllness ? Array.isArray(exposure.signsOfTraumaIllness) ? exposure.signsOfTraumaIllness.join(", ") : exposure.signsOfTraumaIllness : "", "None detected");
      if (exposure.evidenceOfInfection) pdfField("Evidence of Infection", exposure.evidenceOfInfection);
      if (exposure.longBoneDeformities) pdfField("Long Bone Deformities", exposure.longBoneDeformities);
      if (isPed && Object.keys(efast).length > 0) {
        doc.text(`EFAST \u2014 Heart: ${nv(efast.heart, "Normal")}, Abdomen: ${nv(efast.abdomen, "Normal")}, Lungs: ${nv(efast.lungs, "Normal")}, Pelvis: ${nv(efast.pelvis, "Normal")}`);
      }
      pdfField("Notes", exposure.notes || primary.exposure_additional_notes);
      doc.moveDown(0.3);
      ensureSpace();
      pdfHeading("ADJUNCTS TO PRIMARY SURVEY");
      pdfAlways("ECG", adjuncts.ecg_findings || adjuncts.ecg_status, "Not done");
      pdfAlways("Bedside Echo", adjuncts.bedside_echo, "Not done");
      if (adjuncts.efast_status || adjuncts.efast_notes) {
        doc.text(`EFAST: ${adjuncts.efast_status || ""}${adjuncts.efast_notes ? " - " + adjuncts.efast_notes : ""}`);
      } else {
        doc.text("EFAST: Not done");
      }
      pdfField("ABG/VBG Notes", adjuncts.additional_notes);
      if (Object.keys(abgData).length > 0) {
        pdfSubHeading("ABG Values");
        const abgParts = [];
        if (abgData.pH) abgParts.push(`pH: ${abgData.pH}`);
        if (abgData.pCO2) abgParts.push(`pCO2: ${abgData.pCO2}`);
        if (abgData.pO2) abgParts.push(`pO2: ${abgData.pO2}`);
        if (abgData.HCO3) abgParts.push(`HCO3: ${abgData.HCO3}`);
        if (abgData.BE) abgParts.push(`BE: ${abgData.BE}`);
        if (abgData.Lactate) abgParts.push(`Lactate: ${abgData.Lactate}`);
        if (abgData.SaO2) abgParts.push(`SaO2: ${abgData.SaO2}`);
        if (abgData.FiO2) abgParts.push(`FiO2: ${abgData.FiO2}`);
        if (abgData.Na) abgParts.push(`Na: ${abgData.Na}`);
        if (abgData.K) abgParts.push(`K: ${abgData.K}`);
        if (abgData.Cl) abgParts.push(`Cl: ${abgData.Cl}`);
        if (abgData.AnionGap) abgParts.push(`AG: ${abgData.AnionGap}`);
        if (abgData.Glucose) abgParts.push(`Glucose: ${abgData.Glucose}`);
        if (abgData.Hb) abgParts.push(`Hb: ${abgData.Hb}`);
        if (abgParts.length > 0) doc.text(abgParts.join(" | "));
      }
      doc.moveDown(0.3);
      ensureSpace();
      if (isPed) {
        pdfHeading("SAMPLE HISTORY (PEDIATRIC)");
        const signsObj = history.signsAndSymptoms || {};
        const signsText = history.signs_and_symptoms || "";
        if (Object.keys(signsObj).length > 0) {
          const sParts = [];
          if (signsObj.breathingDifficulty) sParts.push(`Breathing Difficulty: ${signsObj.breathingDifficulty}`);
          if (signsObj.fever) sParts.push(`Fever: ${signsObj.fever}`);
          if (signsObj.vomiting) sParts.push(`Vomiting: ${signsObj.vomiting}`);
          if (signsObj.decreasedOralIntake) sParts.push(`Decreased Oral Intake: ${signsObj.decreasedOralIntake}`);
          if (signsObj.timeCourse) sParts.push(`Time Course: ${signsObj.timeCourse}`);
          if (signsObj.notes) sParts.push(`Notes: ${signsObj.notes}`);
          doc.text(`Signs & Symptoms: ${sParts.length > 0 ? sParts.join(", ") : "As presenting complaint"}`);
        } else {
          doc.text(`Signs & Symptoms: ${signsText || "As presenting complaint"}`);
        }
        pdfAlways("Allergies", Array.isArray(history.allergies) ? history.allergies.join(", ") : history.allergies, "NKDA (No Known Drug Allergies)");
        pdfAlways("Current Medications", history.currentMedications || history.medications || history.drug_history, "None");
        pdfField("Last Dose Medications", history.lastDoseMedications);
        pdfField("Medications in Environment", history.medicationsInEnvironment);
        pdfAlways("Past Medical History", history.healthHistory || history.past_medical, "Nil significant");
        pdfField("Underlying Conditions", history.underlyingConditions);
        pdfAlways("Immunization Status", history.immunizationStatus, "Up to date as per schedule");
        pdfAlways("Last Meal", history.lastMeal || history.last_meal, "Not recorded");
        pdfField("LMP", history.lmp);
        pdfAlways("Events / HPI", history.events || history.hpi || history.events_hopi, "As presenting complaint");
        pdfField("Treatment Before Arrival", history.treatmentBeforeArrival);
      } else {
        pdfHeading("HISTORY (SAMPLE)");
        pdfAlways("HPI / Events", history.hpi || history.events_hopi || data.sample?.eventsHopi, "As presenting complaint");
        pdfAlways("Past Medical History", Array.isArray(history.past_medical) ? history.past_medical.join(", ") : history.past_medical, "Nil significant");
        pdfAlways("Past Surgical History", history.past_surgical, "Nil");
        pdfAlways("Allergies", Array.isArray(history.allergies) ? history.allergies.join(", ") : history.allergies, "NKDA (No Known Drug Allergies)");
        pdfAlways("Medications / Drug History", history.medications || history.drug_history, "None");
        pdfAlways("Last Meal / LMP", history.last_meal || history.last_meal_lmp || history.lmp, "Not recorded");
      }
      doc.moveDown(0.3);
      ensureSpace();
      if (isPed) {
        pdfHeading("PHYSICAL EXAMINATION (PEDIATRIC)");
        const heent = exam.heent || data.heent || data.physical_exam?.heent || {};
        pdfSubHeading("HEENT");
        pdfAlways("Head", heent.head, "Normocephalic, Atraumatic");
        pdfAlways("Eyes", heent.eyes, "PERLA, No icterus");
        pdfAlways("Ears", heent.ears, "Normal");
        pdfAlways("Nose", heent.nose, "Normal");
        pdfAlways("Throat", heent.throat, "Normal, No pharyngitis");
        pdfAlways("Lymph Nodes", heent.lymphNodes, "No lymphadenopathy");
        pdfSubHeading("Systemic");
        pdfAlways("Respiratory", exam.respiratory || data.physical_exam?.respiratory || exam.respiratory_additional_notes, "Normal vesicular breath sounds, No added sounds, Equal air entry");
        pdfAlways("Cardiovascular", exam.cardiovascular || data.physical_exam?.cardiovascular || exam.cvs_additional_notes, "S1 S2 heard, No murmurs, No added sounds");
        pdfAlways("Abdomen", exam.abdomen || data.physical_exam?.abdomen || exam.abdomen_additional_notes, "Soft, Non-tender, No organomegaly, Bowel sounds present and normal");
        pdfField("Back", exam.back || data.physical_exam?.back);
        pdfAlways("Extremities", exam.extremities || data.physical_exam?.extremities || exam.extremities_additional_notes, "No edema, No deformities, Peripheral pulses present");
      } else {
        pdfHeading("PHYSICAL EXAMINATION");
        pdfSubHeading("General Examination");
        const genFindings = [];
        if (exam.general_pallor) genFindings.push("Pallor+");
        if (exam.general_icterus) genFindings.push("Icterus+");
        if (exam.general_cyanosis) genFindings.push("Cyanosis+");
        if (exam.general_clubbing) genFindings.push("Clubbing+");
        if (exam.general_lymphadenopathy) genFindings.push("Lymphadenopathy+");
        if (exam.general_edema) genFindings.push("Edema+");
        if (exam.general_appearance) doc.text(`Appearance: ${exam.general_appearance}`);
        doc.text(genFindings.length > 0 ? genFindings.join(", ") : "No Pallor / No Icterus / No Cyanosis / No Clubbing / No Lymphadenopathy / No Edema");
        pdfField("Notes", exam.general_additional_notes);
        pdfSubHeading("CVS");
        pdfAlways("Status", exam.cvs_status, "Normal");
        pdfAlways("S1/S2", exam.cvs_s1_s2, "S1 S2 heard, No added sounds");
        pdfAlways("Murmurs", exam.cvs_murmurs, "No murmurs");
        pdfField("Pulse", exam.cvs_pulse);
        pdfField("Apex Beat", exam.cvs_apexBeat);
        pdfField("Notes", exam.cvs_additional_notes);
        pdfSubHeading("Respiratory");
        pdfAlways("Status", exam.respiratory_status, "Normal");
        pdfAlways("Expansion", exam.respiratory_expansion, "Equal bilateral");
        pdfAlways("Breath Sounds", exam.respiratory_breath_sounds, "Normal vesicular breath sounds bilaterally");
        pdfAlways("Percussion", exam.respiratory_percussion, "Resonant bilaterally");
        pdfAlways("Added Sounds", exam.respiratory_added_sounds, "None");
        pdfField("Notes", exam.respiratory_additional_notes);
        pdfSubHeading("Abdomen");
        pdfAlways("Status", exam.abdomen_status, "Soft, Non-tender");
        pdfAlways("Bowel Sounds", exam.abdomen_bowel_sounds, "Present and normal");
        pdfAlways("Organomegaly", exam.abdomen_organomegaly, "None");
        pdfField("Percussion", exam.abdomen_percussion);
        pdfField("Notes", exam.abdomen_additional_notes);
        pdfSubHeading("CNS");
        pdfAlways("Status", exam.cns_status, "Normal");
        pdfAlways("Higher Mental Functions", exam.cns_higher_mental_functions, "Intact \u2014 oriented to time, place and person");
        pdfAlways("Cranial Nerves", exam.cns_cranial_nerves, "Intact");
        pdfAlways("Motor System", exam.cns_motor_system, "Power 5/5 in all limbs, tone normal");
        pdfAlways("Reflexes", exam.cns_reflexes, "Normal deep tendon reflexes");
        pdfField("Sensory System", exam.cns_sensory_system);
        pdfField("Notes", exam.cns_additional_notes);
        pdfSubHeading("Extremities");
        pdfAlways("Status", exam.extremities_status, "Normal");
        pdfAlways("Findings", exam.extremities_findings, "No edema, No cyanosis, Peripheral pulses present");
        pdfField("Notes", exam.extremities_additional_notes);
      }
      doc.moveDown(0.3);
      ensureSpace();
      pdfHeading("INVESTIGATIONS");
      if (Array.isArray(investigations.panels_selected) && investigations.panels_selected.length > 0) {
        doc.text(`Lab Panels: ${investigations.panels_selected.join(", ")}`);
      } else {
        doc.text("Lab Panels: None ordered");
      }
      if (Array.isArray(investigations.individual_tests) && investigations.individual_tests.length > 0) doc.text(`Individual Tests: ${investigations.individual_tests.join(", ")}`);
      if (investigations.imaging) {
        doc.text(`Imaging: ${Array.isArray(investigations.imaging) ? investigations.imaging.join(", ") : investigations.imaging}`);
      } else {
        doc.text("Imaging: None ordered");
      }
      pdfField("Results / Notes", investigations.results_notes);
      doc.moveDown(0.3);
      ensureSpace();
      pdfHeading("TREATMENT");
      const primaryDiag = treatment.primary_diagnosis || (Array.isArray(treatment.provisional_diagnoses) && treatment.provisional_diagnoses.length > 0 ? treatment.provisional_diagnoses[0] : "");
      pdfAlways("Primary Diagnosis", primaryDiag, "To be determined");
      if (Array.isArray(treatment.provisional_diagnoses) && treatment.provisional_diagnoses.length > 0) doc.text(`Provisional Diagnoses: ${treatment.provisional_diagnoses.join(", ")}`);
      if (treatment.differential_diagnoses) {
        const diffs = Array.isArray(treatment.differential_diagnoses) ? treatment.differential_diagnoses.join(", ") : treatment.differential_diagnoses;
        doc.text(`Differential Diagnoses: ${diffs}`);
      }
      if (Array.isArray(treatment.interventions) && treatment.interventions.length > 0) doc.text(`Interventions: ${treatment.interventions.join(", ")}`);
      pdfField("Intervention Notes", treatment.intervention_notes);
      if (Array.isArray(treatment.medications) && treatment.medications.length > 0) {
        pdfSubHeading("Medications:");
        treatment.medications.forEach((med) => {
          doc.text(`  - ${med.name || med.drug_name || ""} ${med.dose || ""} ${med.route || ""} ${med.frequency || ""}`.trim());
        });
      } else {
        doc.text("Medications: None prescribed");
      }
      if (Array.isArray(treatment.infusions) && treatment.infusions.length > 0) {
        pdfSubHeading("Infusions:");
        treatment.infusions.forEach((inf) => {
          doc.text(`  - ${inf.name || inf.drug_name || inf.drug || ""} ${inf.dose || ""} in ${inf.dilution || ""} at ${inf.rate || ""}`.trim());
        });
      }
      pdfAlways("IV Fluids", treatment.fluids, "None");
      pdfField("Other Medications", treatment.other_medications);
      doc.moveDown(0.3);
      ensureSpace();
      pdfHeading("PROCEDURES PERFORMED");
      if (Array.isArray(proceduresPerformed) && proceduresPerformed.length > 0) {
        proceduresPerformed.forEach((proc) => {
          if (typeof proc === "string") doc.text(`  - ${proc}`);
          else doc.text(`  - ${proc.name || "Procedure"}${proc.notes ? ": " + proc.notes : ""}`);
        });
      } else {
        doc.text("No procedures performed");
      }
      pdfField("General Notes", proceduresNotes);
      doc.moveDown(0.3);
      if (erObs.notes || erObs.duration) {
        ensureSpace();
        pdfHeading("ER OBSERVATION");
        pdfField("Duration", erObs.duration);
        pdfField("Notes", erObs.notes);
        doc.moveDown(0.3);
      }
      ensureSpace();
      pdfHeading("DISPOSITION");
      pdfAlways("Type", disposition.type, "To be decided");
      pdfField("Admit To", disposition.admit_to || disposition.destination || disposition.department);
      pdfField("Room", disposition.admit_to_room);
      pdfField("Refer To", disposition.refer_to);
      pdfAlways("Condition at Discharge", disposition.condition_at_discharge || disposition.condition, "STABLE");
      pdfField("Notes", disposition.notes);
      doc.moveDown(0.3);
      if (data.mlc && data.mlc_details) {
        ensureSpace();
        pdfHeading("MLC DETAILS");
        pdfField("Nature of Incident", data.mlc_details.nature);
        pdfField("Date/Time", data.mlc_details.datetime);
        pdfField("Place", data.mlc_details.place);
        pdfField("Informant", data.mlc_details.informant);
        doc.moveDown(0.3);
      }
      const addNotes = Array.isArray(addendumNotes) ? addendumNotes.filter(Boolean) : [];
      if (addNotes.length > 0) {
        ensureSpace();
        pdfHeading("ADDENDUM NOTES");
        addNotes.forEach((note, i) => doc.text(`${i + 1}. ${note}`));
        doc.moveDown(0.3);
      }
      ensureSpace(40);
      doc.moveDown(0.3);
      pdfLine();
      doc.moveDown(0.2);
      pdfField("Case Status", data.status);
      if (data.created_at) doc.text(`Created: ${new Date(data.created_at).toLocaleString("en-IN")}`);
      if (data.updated_at) doc.text(`Last Updated: ${new Date(data.updated_at).toLocaleString("en-IN")}`);
      doc.moveDown(0.4);
      pdfLine();
      doc.moveDown(0.2);
      doc.fontSize(8).font("Helvetica-Oblique").text("This case sheet is generated from ErMate for clinical documentation purposes.", { align: "center" });
      doc.end();
    } catch (err) {
      console.error("Case sheet PDF generation error:", err);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });
  app2.post("/api/export/casesheet-docx", async (req, res) => {
    try {
      const data = req.body;
      if (!data.patient) {
        return res.status(400).json({ error: "Missing patient data" });
      }
      const patientAge = parseFloat(data.patient?.age) || 0;
      const isPed = patientAge > 0 && patientAge <= 16;
      const primary = data.primary_assessment || data.abcde || {};
      const vitals = data.vitals_at_arrival || data.triage?.vitals || {};
      const adjuncts = data.adjuncts || {};
      const abgData = data.abg || adjuncts.abg || {};
      const history = data.history || {};
      const exam = data.examination || {};
      const investigations = data.investigations || {};
      const treatment = data.treatment || {};
      const procedures = data.procedures || {};
      const proceduresPerformed = data.procedures_performed || procedures.procedures_performed || procedures.performed || [];
      const proceduresNotes = procedures.general_notes || procedures.generalNotes || "";
      const disposition = data.disposition || {};
      const erObs = data.er_observation || {};
      const addendumNotes = treatment.addendum_notes || data.addendum_notes || [];
      const airway = primary.airway || {};
      const breathing = primary.breathing || {};
      const circulation = primary.circulation || {};
      const disability = primary.disability || {};
      const exposure = primary.exposure || {};
      const pat = primary.pat || {};
      const efast = primary.efast || {};
      const nv = (val, dflt) => {
        if (val === void 0 || val === null || val === "") return dflt;
        if (Array.isArray(val)) return val.length > 0 ? val.filter(Boolean).join(", ") : dflt;
        return String(val);
      };
      console.log("[EXPORT] DOCX casesheet | isPediatric:", isPed);
      const children = [];
      const dH = (t) => new Paragraph({ text: t.toUpperCase(), heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } });
      const dSH = (t) => new Paragraph({ children: [new TextRun({ text: t, bold: true, underline: {} })], spacing: { before: 120, after: 40 } });
      const dP = (t) => new Paragraph({ text: t, spacing: { after: 40 } });
      const dBold = (label, val) => new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun({ text: val })], spacing: { after: 40 } });
      const dField = (label, val) => {
        if (val !== void 0 && val !== null && val !== "") children.push(dBold(label, String(val)));
      };
      const dAlways = (label, val, dflt) => children.push(dBold(label, nv(val, dflt)));
      children.push(
        new Paragraph({ text: "EMERGENCY DEPARTMENT CASE SHEET", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 100 } }),
        new Paragraph({ text: `Generated: ${(/* @__PURE__ */ new Date()).toLocaleDateString("en-IN")}`, alignment: AlignmentType.CENTER, spacing: { after: 300 } })
      );
      children.push(dH("PATIENT INFORMATION"));
      children.push(dP(`Name: ${data.patient?.name || "N/A"}        Age/Sex: ${data.patient?.age || "N/A"} / ${data.patient?.sex || "N/A"}`));
      dField("UHID", data.patient?.uhid);
      dField("Phone", data.patient?.phone);
      dAlways("Mode of Arrival", data.patient?.mode_of_arrival || data.mode_of_arrival, "Not specified");
      if (isPed && data.patient?.weight) children.push(dBold("Weight", String(data.patient.weight) + " kg"));
      children.push(dBold("MLC", data.mlc ? "Yes" : "No"));
      if (data.patient?.arrival_datetime) children.push(dBold("Arrival Time", new Date(data.patient.arrival_datetime).toLocaleString("en-IN")));
      dField("EM Resident", data.em_resident);
      dField("EM Consultant", data.em_consultant);
      if (data.triage_priority) children.push(dBold("Triage", `Priority ${data.triage_priority} - ${(data.triage_color || "").toUpperCase()}`));
      const complaintText = data.presenting_complaint?.text || data.triage?.chief_complaint || "";
      if (complaintText) {
        let ccLine = complaintText;
        if (data.presenting_complaint?.duration) ccLine += ` | Duration: ${data.presenting_complaint.duration}`;
        if (data.presenting_complaint?.onset_type) ccLine += ` | Onset: ${data.presenting_complaint.onset_type}`;
        children.push(dBold("Presenting Complaint", ccLine));
      }
      children.push(dH("VITALS AT ARRIVAL"));
      const vHR = vitals.hr || vitals.heart_rate || "";
      const vBPS = vitals.bp_systolic || vitals.systolic || "";
      const vBPD = vitals.bp_diastolic || vitals.diastolic || "";
      const vRR = vitals.rr || vitals.respiratory_rate || "";
      const vSpO2 = vitals.spo2 || vitals.oxygen_saturation || "";
      const vTemp = vitals.temperature || "";
      const vGCSE = vitals.gcs_e || "";
      const vGCSV = vitals.gcs_v || "";
      const vGCSM = vitals.gcs_m || "";
      const vGCST = vitals.gcs_total || vitals.gcs || (vGCSE || vGCSV || vGCSM ? `${(parseInt(vGCSE) || 0) + (parseInt(vGCSV) || 0) + (parseInt(vGCSM) || 0)}` : "");
      const vPain = vitals.pain_score || "";
      const vGRBS = vitals.grbs || vitals.glucose || "";
      children.push(dP(`HR: ${vHR || "\u2014"} bpm    BP: ${vBPS && vBPD ? vBPS + "/" + vBPD : vBPS || "\u2014"} mmHg    RR: ${vRR || "\u2014"} /min    SpO2: ${vSpO2 || "\u2014"}%`));
      children.push(dP(`Temp: ${vTemp || "\u2014"} \xB0F    GCS: ${vGCST || "\u2014"} (E${vGCSE || "\u2014"}V${vGCSV || "\u2014"}M${vGCSM || "\u2014"})    Pain: ${vPain || "\u2014"}/10    GRBS: ${vGRBS || "\u2014"} mg/dL`));
      children.push(dH("PRIMARY ASSESSMENT (ABCDE)"));
      if (isPed) {
        children.push(dSH("Pediatric Assessment Triangle (PAT)"));
        const appearance = pat.appearance || {};
        children.push(dP(`Appearance \u2014 Tone: ${nv(appearance.tone || pat.tone, "Normal")}, Interactivity: ${nv(appearance.interactivity || pat.interactivity, "Normal")}, Consolability: ${nv(appearance.consolability || pat.consolability, "Normal")}, Look/Gaze: ${nv(appearance.lookGaze || pat.lookGaze, "Normal")}, Speech/Cry: ${nv(appearance.speechCry || pat.speechCry, "Normal")}`));
        children.push(dP(`Work of Breathing: ${nv(pat.workOfBreathing, "Normal")}    Circulation to Skin: ${nv(pat.circulationToSkin, "Normal")}`));
      }
      children.push(dSH("A \u2014 Airway"));
      const airwayStatus = airway.status || primary.airway_status;
      const airwayInterventions = airway.interventions || primary.airway_interventions || airway.intervention;
      dAlways("Status", airwayStatus, "Patent");
      dAlways("Interventions", airwayInterventions ? Array.isArray(airwayInterventions) ? airwayInterventions.join(", ") : airwayInterventions : "", "None required");
      dField("Cry", airway.cry);
      dField("Notes", airway.notes || primary.airway_additional_notes);
      children.push(dSH("B \u2014 Breathing"));
      const bRR = breathing.rr || breathing.respiratoryRate || primary.breathing_rr;
      const bSpO2 = breathing.spo2 || primary.breathing_spo2;
      const bEffort = breathing.effort || breathing.workOfBreathing || primary.breathing_work;
      children.push(dP(`RR: ${nv(bRR, vRR || "Normal")}    SpO2: ${nv(bSpO2, vSpO2 ? vSpO2 + "%" : "Normal")}    Effort: ${nv(bEffort, "Normal")}`));
      dAlways("Air Entry", breathing.airEntry, "Equal bilateral air entry");
      dAlways("Chest Expansion", breathing.chestExpansion, "Equal");
      dAlways("Added Sounds", breathing.addedSounds, "None");
      if (breathing.o2Device || primary.breathing_oxygen_device) dField("O2 Device", (breathing.o2Device || primary.breathing_oxygen_device) + (breathing.o2Flow || primary.breathing_oxygen_flow ? " @ " + (breathing.o2Flow || primary.breathing_oxygen_flow) + " L/min" : ""));
      dField("Interventions", breathing.intervention ? Array.isArray(breathing.intervention) ? breathing.intervention.join(", ") : breathing.intervention : "");
      dField("Notes", breathing.notes || primary.breathing_additional_notes);
      children.push(dSH("C \u2014 Circulation"));
      const cHR = circulation.hr || circulation.heartRate || primary.circulation_hr;
      const cBPS = circulation.bpSystolic || primary.circulation_bp_systolic || circulation.bloodPressure;
      const cBPD = circulation.bpDiastolic || primary.circulation_bp_diastolic;
      const cCRT = circulation.capillaryRefill || circulation.crt || primary.circulation_crt;
      children.push(dP(`HR: ${nv(cHR, vHR || "Normal")}    BP: ${cBPS && cBPD ? cBPS + "/" + cBPD : cBPS || (vBPS && vBPD ? vBPS + "/" + vBPD : "Normal")}    CRT: ${nv(cCRT, "<2 sec")}`));
      dAlways("Pulse Quality", circulation.pulseQuality || circulation.pulses, "Normal volume, regular");
      dAlways("Skin Color/Temp", circulation.skinColorTemp, "Normal color, warm peripheries");
      dField("Neck Veins", circulation.distendedNeckVeins);
      const cAdj = circulation.interventions || primary.circulation_adjuncts || circulation.intervention;
      dAlways("IV Access", cAdj ? Array.isArray(cAdj) ? cAdj.join(", ") : cAdj : circulation.ivAccess || "", "Not established");
      dField("Notes", circulation.notes || primary.circulation_additional_notes);
      children.push(dSH("D \u2014 Disability"));
      const dAVPU = disability.motorResponse || disability.avpuGcs || primary.disability_avpu;
      const dGE = disability.gcsE || primary.disability_gcs_e || vGCSE;
      const dGV = disability.gcsV || primary.disability_gcs_v || vGCSV;
      const dGM = disability.gcsM || primary.disability_gcs_m || vGCSM;
      const dPupilSize = disability.pupilSize || disability.pupils || primary.disability_pupils_size;
      const dPupilReact = disability.pupilReaction || primary.disability_pupils_reaction;
      const dGlucose = disability.glucose || primary.disability_grbs || vGRBS;
      const dGCSStr = dGE || dGV || dGM ? `${(parseInt(dGE) || 0) + (parseInt(dGV) || 0) + (parseInt(dGM) || 0)} (E${dGE || "\u2014"}V${dGV || "\u2014"}M${dGM || "\u2014"})` : vGCST ? vGCST : "15 (E4V5M6)";
      dAlways("AVPU", dAVPU, "Alert");
      children.push(dBold("GCS", dGCSStr));
      children.push(dP(`Pupils: ${nv(dPupilSize, "Equal, 3 mm")} \u2014 Reaction: ${nv(dPupilReact, "Briskly reactive bilaterally")}`));
      dAlways("Blood Glucose", dGlucose, "Normal");
      dField("Abnormal Responses", disability.abnormalResponses);
      dField("Notes", disability.notes || primary.disability_additional_notes);
      children.push(dSH("E \u2014 Exposure"));
      const eTemp = exposure.temperature || primary.exposure_temperature;
      dAlways("Temperature", eTemp, vTemp || "Normal");
      dAlways("Trauma", exposure.trauma, "None");
      dAlways("Signs of Trauma/Illness", exposure.signsOfTraumaIllness ? Array.isArray(exposure.signsOfTraumaIllness) ? exposure.signsOfTraumaIllness.join(", ") : exposure.signsOfTraumaIllness : "", "None detected");
      dField("Evidence of Infection", exposure.evidenceOfInfection);
      dField("Long Bone Deformities", exposure.longBoneDeformities);
      if (isPed && Object.keys(efast).length > 0) children.push(dP(`EFAST \u2014 Heart: ${nv(efast.heart, "Normal")}, Abdomen: ${nv(efast.abdomen, "Normal")}, Lungs: ${nv(efast.lungs, "Normal")}, Pelvis: ${nv(efast.pelvis, "Normal")}`));
      dField("Notes", exposure.notes || primary.exposure_additional_notes);
      children.push(dH("ADJUNCTS TO PRIMARY SURVEY"));
      dAlways("ECG", adjuncts.ecg_findings || adjuncts.ecg_status, "Not done");
      dAlways("Bedside Echo", adjuncts.bedside_echo, "Not done");
      if (adjuncts.efast_status || adjuncts.efast_notes) {
        children.push(dBold("EFAST", `${adjuncts.efast_status || ""}${adjuncts.efast_notes ? " - " + adjuncts.efast_notes : ""}`));
      } else {
        children.push(dBold("EFAST", "Not done"));
      }
      dField("ABG/VBG Notes", adjuncts.additional_notes);
      if (Object.keys(abgData).length > 0) {
        const abgParts = [];
        if (abgData.pH) abgParts.push(`pH: ${abgData.pH}`);
        if (abgData.pCO2) abgParts.push(`pCO2: ${abgData.pCO2}`);
        if (abgData.pO2) abgParts.push(`pO2: ${abgData.pO2}`);
        if (abgData.HCO3) abgParts.push(`HCO3: ${abgData.HCO3}`);
        if (abgData.BE) abgParts.push(`BE: ${abgData.BE}`);
        if (abgData.Lactate) abgParts.push(`Lactate: ${abgData.Lactate}`);
        if (abgData.SaO2) abgParts.push(`SaO2: ${abgData.SaO2}`);
        if (abgData.FiO2) abgParts.push(`FiO2: ${abgData.FiO2}`);
        if (abgData.Na) abgParts.push(`Na: ${abgData.Na}`);
        if (abgData.K) abgParts.push(`K: ${abgData.K}`);
        if (abgData.Cl) abgParts.push(`Cl: ${abgData.Cl}`);
        if (abgData.AnionGap) abgParts.push(`AG: ${abgData.AnionGap}`);
        if (abgData.Glucose) abgParts.push(`Glucose: ${abgData.Glucose}`);
        if (abgData.Hb) abgParts.push(`Hb: ${abgData.Hb}`);
        if (abgParts.length > 0) children.push(dBold("ABG Values", abgParts.join(" | ")));
      }
      if (isPed) {
        children.push(dH("SAMPLE HISTORY (PEDIATRIC)"));
        const signsObj = history.signsAndSymptoms || {};
        const signsText = history.signs_and_symptoms || "";
        if (Object.keys(signsObj).length > 0) {
          const sParts = [];
          if (signsObj.breathingDifficulty) sParts.push(`Breathing Difficulty: ${signsObj.breathingDifficulty}`);
          if (signsObj.fever) sParts.push(`Fever: ${signsObj.fever}`);
          if (signsObj.vomiting) sParts.push(`Vomiting: ${signsObj.vomiting}`);
          if (signsObj.decreasedOralIntake) sParts.push(`Decreased Oral Intake: ${signsObj.decreasedOralIntake}`);
          if (signsObj.timeCourse) sParts.push(`Time Course: ${signsObj.timeCourse}`);
          if (signsObj.notes) sParts.push(`Notes: ${signsObj.notes}`);
          children.push(dBold("Signs & Symptoms", sParts.length > 0 ? sParts.join(", ") : "As presenting complaint"));
        } else {
          children.push(dBold("Signs & Symptoms", signsText || "As presenting complaint"));
        }
        dAlways("Allergies", Array.isArray(history.allergies) ? history.allergies.join(", ") : history.allergies, "NKDA (No Known Drug Allergies)");
        dAlways("Current Medications", history.currentMedications || history.medications || history.drug_history, "None");
        dField("Last Dose Medications", history.lastDoseMedications);
        dField("Medications in Environment", history.medicationsInEnvironment);
        dAlways("Past Medical History", history.healthHistory || history.past_medical, "Nil significant");
        dField("Underlying Conditions", history.underlyingConditions);
        dAlways("Immunization Status", history.immunizationStatus, "Up to date as per schedule");
        dAlways("Last Meal", history.lastMeal || history.last_meal, "Not recorded");
        dField("LMP", history.lmp);
        dAlways("Events / HPI", history.events || history.hpi || history.events_hopi, "As presenting complaint");
        dField("Treatment Before Arrival", history.treatmentBeforeArrival);
      } else {
        children.push(dH("HISTORY (SAMPLE)"));
        dAlways("HPI / Events", history.hpi || history.events_hopi || data.sample?.eventsHopi, "As presenting complaint");
        dAlways("Past Medical History", Array.isArray(history.past_medical) ? history.past_medical.join(", ") : history.past_medical, "Nil significant");
        dAlways("Past Surgical History", history.past_surgical, "Nil");
        dAlways("Allergies", Array.isArray(history.allergies) ? history.allergies.join(", ") : history.allergies, "NKDA (No Known Drug Allergies)");
        dAlways("Medications / Drug History", history.medications || history.drug_history, "None");
        dAlways("Last Meal / LMP", history.last_meal || history.last_meal_lmp || history.lmp, "Not recorded");
      }
      if (isPed) {
        children.push(dH("PHYSICAL EXAMINATION (PEDIATRIC)"));
        const heent = exam.heent || data.heent || data.physical_exam?.heent || {};
        children.push(dSH("HEENT"));
        dAlways("Head", heent.head, "Normocephalic, Atraumatic");
        dAlways("Eyes", heent.eyes, "PERLA, No icterus");
        dAlways("Ears", heent.ears, "Normal");
        dAlways("Nose", heent.nose, "Normal");
        dAlways("Throat", heent.throat, "Normal, No pharyngitis");
        dAlways("Lymph Nodes", heent.lymphNodes, "No lymphadenopathy");
        children.push(dSH("Systemic"));
        dAlways("Respiratory", exam.respiratory || data.physical_exam?.respiratory || exam.respiratory_additional_notes, "Normal vesicular breath sounds, No added sounds, Equal air entry");
        dAlways("Cardiovascular", exam.cardiovascular || data.physical_exam?.cardiovascular || exam.cvs_additional_notes, "S1 S2 heard, No murmurs, No added sounds");
        dAlways("Abdomen", exam.abdomen || data.physical_exam?.abdomen || exam.abdomen_additional_notes, "Soft, Non-tender, No organomegaly, Bowel sounds present and normal");
        dField("Back", exam.back || data.physical_exam?.back);
        dAlways("Extremities", exam.extremities || data.physical_exam?.extremities || exam.extremities_additional_notes, "No edema, No deformities, Peripheral pulses present");
      } else {
        children.push(dH("PHYSICAL EXAMINATION"));
        children.push(dSH("General Examination"));
        const genFindings = [];
        if (exam.general_pallor) genFindings.push("Pallor+");
        if (exam.general_icterus) genFindings.push("Icterus+");
        if (exam.general_cyanosis) genFindings.push("Cyanosis+");
        if (exam.general_clubbing) genFindings.push("Clubbing+");
        if (exam.general_lymphadenopathy) genFindings.push("Lymphadenopathy+");
        if (exam.general_edema) genFindings.push("Edema+");
        dField("Appearance", exam.general_appearance);
        children.push(dP(genFindings.length > 0 ? genFindings.join(", ") : "No Pallor / No Icterus / No Cyanosis / No Clubbing / No Lymphadenopathy / No Edema"));
        dField("Notes", exam.general_additional_notes);
        children.push(dSH("CVS"));
        dAlways("Status", exam.cvs_status, "Normal");
        dAlways("S1/S2", exam.cvs_s1_s2, "S1 S2 heard, No added sounds");
        dAlways("Murmurs", exam.cvs_murmurs, "No murmurs");
        dField("Pulse", exam.cvs_pulse);
        dField("Apex Beat", exam.cvs_apexBeat);
        dField("Notes", exam.cvs_additional_notes);
        children.push(dSH("Respiratory"));
        dAlways("Status", exam.respiratory_status, "Normal");
        dAlways("Expansion", exam.respiratory_expansion, "Equal bilateral");
        dAlways("Breath Sounds", exam.respiratory_breath_sounds, "Normal vesicular breath sounds bilaterally");
        dAlways("Percussion", exam.respiratory_percussion, "Resonant bilaterally");
        dAlways("Added Sounds", exam.respiratory_added_sounds, "None");
        dField("Notes", exam.respiratory_additional_notes);
        children.push(dSH("Abdomen"));
        dAlways("Status", exam.abdomen_status, "Soft, Non-tender");
        dAlways("Bowel Sounds", exam.abdomen_bowel_sounds, "Present and normal");
        dAlways("Organomegaly", exam.abdomen_organomegaly, "None");
        dField("Percussion", exam.abdomen_percussion);
        dField("Notes", exam.abdomen_additional_notes);
        children.push(dSH("CNS"));
        dAlways("Status", exam.cns_status, "Normal");
        dAlways("Higher Mental Functions", exam.cns_higher_mental_functions, "Intact \u2014 oriented to time, place and person");
        dAlways("Cranial Nerves", exam.cns_cranial_nerves, "Intact");
        dAlways("Motor System", exam.cns_motor_system, "Power 5/5 in all limbs, tone normal");
        dAlways("Reflexes", exam.cns_reflexes, "Normal deep tendon reflexes");
        dField("Sensory System", exam.cns_sensory_system);
        dField("Notes", exam.cns_additional_notes);
        children.push(dSH("Extremities"));
        dAlways("Status", exam.extremities_status, "Normal");
        dAlways("Findings", exam.extremities_findings, "No edema, No cyanosis, Peripheral pulses present");
        dField("Notes", exam.extremities_additional_notes);
      }
      children.push(dH("INVESTIGATIONS"));
      if (Array.isArray(investigations.panels_selected) && investigations.panels_selected.length > 0) {
        children.push(dBold("Lab Panels", investigations.panels_selected.join(", ")));
      } else {
        children.push(dBold("Lab Panels", "None ordered"));
      }
      if (Array.isArray(investigations.individual_tests) && investigations.individual_tests.length > 0) children.push(dBold("Individual Tests", investigations.individual_tests.join(", ")));
      if (investigations.imaging) {
        children.push(dBold("Imaging", Array.isArray(investigations.imaging) ? investigations.imaging.join(", ") : investigations.imaging));
      } else {
        children.push(dBold("Imaging", "None ordered"));
      }
      dField("Results / Notes", investigations.results_notes);
      children.push(dH("TREATMENT"));
      const primaryDiag = treatment.primary_diagnosis || (Array.isArray(treatment.provisional_diagnoses) && treatment.provisional_diagnoses.length > 0 ? treatment.provisional_diagnoses[0] : "");
      dAlways("Primary Diagnosis", primaryDiag, "To be determined");
      if (Array.isArray(treatment.provisional_diagnoses) && treatment.provisional_diagnoses.length > 0) children.push(dBold("Provisional Diagnoses", treatment.provisional_diagnoses.join(", ")));
      if (treatment.differential_diagnoses) {
        const diffs = Array.isArray(treatment.differential_diagnoses) ? treatment.differential_diagnoses.join(", ") : treatment.differential_diagnoses;
        dField("Differential Diagnoses", diffs);
      }
      if (Array.isArray(treatment.interventions) && treatment.interventions.length > 0) children.push(dBold("Interventions", treatment.interventions.join(", ")));
      dField("Intervention Notes", treatment.intervention_notes);
      if (Array.isArray(treatment.medications) && treatment.medications.length > 0) {
        children.push(new Paragraph({ children: [new TextRun({ text: "Medications:", bold: true })], spacing: { before: 80, after: 40 } }));
        treatment.medications.forEach((med) => {
          children.push(dP(`  - ${med.name || med.drug_name || ""} ${med.dose || ""} ${med.route || ""} ${med.frequency || ""}`.trim()));
        });
      } else {
        children.push(dBold("Medications", "None prescribed"));
      }
      if (Array.isArray(treatment.infusions) && treatment.infusions.length > 0) {
        children.push(new Paragraph({ children: [new TextRun({ text: "Infusions:", bold: true })], spacing: { before: 80, after: 40 } }));
        treatment.infusions.forEach((inf) => {
          children.push(dP(`  - ${inf.name || inf.drug_name || inf.drug || ""} ${inf.dose || ""} in ${inf.dilution || ""} at ${inf.rate || ""}`.trim()));
        });
      }
      dAlways("IV Fluids", treatment.fluids, "None");
      dField("Other Medications", treatment.other_medications);
      children.push(dH("PROCEDURES PERFORMED"));
      if (Array.isArray(proceduresPerformed) && proceduresPerformed.length > 0) {
        proceduresPerformed.forEach((proc) => {
          if (typeof proc === "string") children.push(dP(`  - ${proc}`));
          else children.push(dP(`  - ${proc.name || "Procedure"}${proc.notes ? ": " + proc.notes : ""}`));
        });
      } else {
        children.push(dP("No procedures performed"));
      }
      dField("General Notes", proceduresNotes);
      if (erObs.notes || erObs.duration) {
        children.push(dH("ER OBSERVATION"));
        dField("Duration", erObs.duration);
        dField("Notes", erObs.notes);
      }
      children.push(dH("DISPOSITION"));
      dAlways("Type", disposition.type, "To be decided");
      dField("Admit To", disposition.admit_to || disposition.destination || disposition.department);
      dField("Room", disposition.admit_to_room);
      dField("Refer To", disposition.refer_to);
      dAlways("Condition at Discharge", disposition.condition_at_discharge || disposition.condition, "STABLE");
      dField("Notes", disposition.notes);
      if (data.mlc && data.mlc_details) {
        children.push(dH("MLC DETAILS"));
        dField("Nature of Incident", data.mlc_details.nature);
        dField("Date/Time", data.mlc_details.datetime);
        dField("Place", data.mlc_details.place);
        dField("Informant", data.mlc_details.informant);
      }
      const addNotes = Array.isArray(addendumNotes) ? addendumNotes.filter(Boolean) : [];
      if (addNotes.length > 0) {
        children.push(dH("ADDENDUM NOTES"));
        addNotes.forEach((note, i) => children.push(dP(`${i + 1}. ${note}`)));
      }
      dField("Case Status", data.status);
      if (data.created_at) children.push(dBold("Created", new Date(data.created_at).toLocaleString("en-IN")));
      if (data.updated_at) children.push(dBold("Last Updated", new Date(data.updated_at).toLocaleString("en-IN")));
      children.push(new Paragraph({ text: "This case sheet is generated from ErMate for clinical documentation purposes.", alignment: AlignmentType.CENTER, spacing: { before: 400 } }));
      const docxDoc = new Document({ sections: [{ properties: {}, children }] });
      const buffer = await Packer.toBuffer(docxDoc);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="casesheet_${(data.patient?.name || "patient").replace(/\s+/g, "_")}.docx"`);
      res.send(Buffer.from(buffer));
    } catch (err) {
      console.error("Case sheet DOCX generation error:", err);
      res.status(500).json({ error: "Failed to generate DOCX" });
    }
  });
  app2.post("/api/ai/interpret-abg", async (req, res) => {
    try {
      const { abg_values, patient_context } = req.body;
      if (!abg_values) {
        return res.status(400).json({ error: "ABG values are required" });
      }
      const { interpretABG: interpretABG2 } = await Promise.resolve().then(() => (init_aiDiagnosis(), aiDiagnosis_exports));
      const interpretation = await interpretABG2(abg_values, patient_context);
      res.json({ interpretation });
    } catch (error) {
      console.error("ABG interpretation error:", error);
      res.status(500).json({ error: "Failed to interpret ABG values" });
    }
  });
  app2.post("/api/ai/scan-abg", async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Image data is required" });
      }
      const { extractABGFromImage: extractABGFromImage2 } = await Promise.resolve().then(() => (init_aiDiagnosis(), aiDiagnosis_exports));
      const abgValues = await extractABGFromImage2(imageBase64);
      res.json({ abgValues });
    } catch (error) {
      console.error("ABG scan error:", error);
      res.status(500).json({ error: "Failed to extract ABG values from image" });
    }
  });
  app2.post("/api/ai/extract-from-image", async (req, res) => {
    try {
      const { imageBase64, patientContext } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Image data is required" });
      }
      const { extractClinicalDataFromImage: extractClinicalDataFromImage2 } = await Promise.resolve().then(() => (init_aiDiagnosis(), aiDiagnosis_exports));
      const extractedData = await extractClinicalDataFromImage2(imageBase64, patientContext);
      res.json({ extractedData });
    } catch (error) {
      console.error("Image extraction error:", error);
      res.status(500).json({ error: "Failed to extract data from image" });
    }
  });
  app2.post("/api/ai/diagnose", async (req, res) => {
    try {
      const { chiefComplaint, vitals, history, examination, age, gender, abgData, treatmentData } = req.body;
      if (!chiefComplaint) {
        return res.status(400).json({ error: "Chief complaint is required" });
      }
      let enhancedHistory = history || "";
      if (treatmentData) {
        const treatmentParts = [];
        if (treatmentData.medications?.length > 0) {
          const medsText = treatmentData.medications.map((m) => `${m.name || ""} ${m.dose || ""} ${m.route || ""} ${m.frequency || ""}`.trim()).filter(Boolean).join(", ");
          if (medsText) treatmentParts.push(`Medications administered: ${medsText}`);
        }
        if (treatmentData.fluids) treatmentParts.push(`IV Fluids: ${treatmentData.fluids}`);
        if (treatmentData.interventions) treatmentParts.push(`Other interventions: ${treatmentData.interventions}`);
        if (treatmentData.primaryDiagnosis) treatmentParts.push(`Working diagnosis: ${treatmentData.primaryDiagnosis}`);
        if (treatmentData.differentialDiagnoses) treatmentParts.push(`Differential diagnoses considered: ${treatmentData.differentialDiagnoses}`);
        if (treatmentParts.length > 0) {
          enhancedHistory = `${enhancedHistory}

Treatment administered:
${treatmentParts.join("\n")}`;
        }
      }
      const result = await generateDiagnosisSuggestions({
        chiefComplaint,
        vitals: vitals || {},
        history: enhancedHistory,
        examination: examination || "",
        age: age || 30,
        gender: gender || "Unknown",
        abgData: abgData || void 0
      });
      res.json(result);
    } catch (error) {
      console.error("AI diagnosis error:", error);
      res.status(500).json({ error: "Failed to generate diagnosis suggestions" });
    }
  });
  app2.post("/api/ai/feedback", async (req, res) => {
    try {
      const { suggestionId, caseId, feedbackType, userCorrection, suggestionText, userId } = req.body;
      if (!suggestionId || !feedbackType) {
        return res.status(400).json({ error: "Missing required fields (suggestionId, feedbackType)" });
      }
      if (!caseId || caseId.trim() === "") {
        return res.status(400).json({ error: "Valid caseId is required for feedback tracking" });
      }
      const feedback = {
        suggestionId,
        caseId,
        feedbackType,
        userCorrection,
        suggestionText,
        userId,
        timestamp: /* @__PURE__ */ new Date()
      };
      const result = await recordFeedback(feedback);
      if (result.success) {
        res.json({ success: true });
      } else {
        res.status(503).json({ error: result.error || "Failed to record feedback" });
      }
    } catch (error) {
      console.error("Feedback error:", error);
      res.status(500).json({ error: "Failed to record feedback" });
    }
  });
  app2.get("/api/ai/stats", async (_req, res) => {
    try {
      const stats = await getFeedbackStats();
      const insights = await getLearningInsights();
      res.json({ stats, insights });
    } catch (error) {
      console.error("Stats error:", error);
      res.status(500).json({ error: "Failed to get AI stats" });
    }
  });
  app2.post("/api/ai/discharge-summary", async (req, res) => {
    try {
      const { case_id, summary_data, full_case } = req.body;
      if (!summary_data && !full_case) {
        return res.status(400).json({ error: "Summary data is required" });
      }
      const s = (v) => {
        if (v == null) return "";
        if (Array.isArray(v)) return v.map((x) => typeof x === "object" ? x.text || x.name || JSON.stringify(x) : String(x)).filter(Boolean).join(", ");
        if (typeof v === "object") return v.text || v.name || "";
        return String(v);
      };
      const fc = full_case || {};
      const sd = summary_data || {};
      const pt = fc.patient || {};
      const patientName = s(pt.name) || s(pt.full_name) || "Unknown";
      const patientAge = s(pt.age) || s(sd.patient_age) || "Unknown";
      const patientSex = s(pt.sex) || s(pt.gender) || s(sd.patient_sex) || "";
      const uhid = s(pt.uhid) || s(pt.patient_id) || "Not recorded";
      const mlcStatus = fc.mlc ? "YES \u2014 MLC documented" : "No";
      const modeArrival = s(fc.mode_of_arrival) || "Not recorded";
      const arrivalDate = s(fc.arrival_date) || s(fc.created_at || "").split("T")[0] || "";
      const arrivalTime = s(fc.arrival_time) || "";
      const emResident = s(fc.em_resident) || s(sd.ed_resident) || "";
      const emConsultant = s(fc.em_consultant) || s(sd.ed_consultant) || "";
      const hist = fc.history || {};
      const complaint = s(fc.presenting_complaint?.text || fc.presenting_complaint) || s(sd.presenting_complaint) || "";
      const duration = s(fc.presenting_complaint?.duration) || "";
      const onset = s(fc.presenting_complaint?.onset_type) || "";
      const hpi = s(hist.hpi || hist.events_hopi) || s(sd.history_of_present_illness) || "";
      const signsSymptoms = s(hist.signs_and_symptoms) || "";
      const pastMedical = Array.isArray(hist.past_medical) ? hist.past_medical.join(", ") : s(hist.past_medical) || s(sd.past_medical_history) || "Nil significant";
      const pastSurgical = s(hist.past_surgical) || "Nil";
      const allergies = Array.isArray(hist.allergies) ? hist.allergies.join(", ") : s(hist.allergies) || s(sd.allergy) || "NKDA";
      const preMeds = s(hist.medications || hist.drug_history) || "None";
      const familyHx = s(hist.family_history) || s(sd.family_history) || "Not significant";
      const socialHx = s(hist.social_history) || "Not recorded";
      const ps = fc.primary_survey || {};
      const pa = fc.primary_assessment || {};
      const sdV = sd.vitals_arrival || {};
      const bp = s(ps.bp_systolic && ps.bp_diastolic ? `${ps.bp_systolic}/${ps.bp_diastolic}` : "") || s(pa.circulation_bp_systolic && pa.circulation_bp_diastolic ? `${pa.circulation_bp_systolic}/${pa.circulation_bp_diastolic}` : "") || sdV.bp || "";
      const hr = s(ps.heart_rate) || s(pa.circulation_hr) || sdV.hr || "";
      const rr = s(ps.breathing_rate) || s(pa.breathing_rr) || sdV.rr || "";
      const spo2 = s(ps.spo2) || s(pa.breathing_spo2) || sdV.spo2 || "";
      const temp = s(ps.temperature) || s(pa.exposure_temperature) || sdV.temp || "";
      const grbs = s(ps.grbs) || s(pa.disability_grbs) || sdV.grbs || "";
      const gcsE = s(ps.gcs_e) || s(pa.disability_gcs_e) || "";
      const gcsV = s(ps.gcs_v) || s(pa.disability_gcs_v) || "";
      const gcsM = s(ps.gcs_m) || s(pa.disability_gcs_m) || "";
      const gcsTot = s(ps.gcs_total) || s(pa.disability_gcs_total) || sdV.gcs || "";
      const airway = s(ps.airway || ps.airway_status) || s(pa.airway_status) || s(sd.primary_assessment?.airway) || "Patent, self-maintained";
      const auscultation = s(ps.auscultation) || s(pa.breathing_auscultation) || "Air entry bilaterally equal and clear";
      const workBreathing = s(ps.work_of_breathing) || s(pa.breathing_work_of_breathing) || "No accessory muscle use";
      const o2Device = s(ps.oxygen_device) || s(pa.breathing_oxygen_device) || "Room air";
      const crt = s(ps.crt) || s(pa.circulation_crt) || "< 2 seconds";
      const cvsFindings = s(ps.cvs_findings) || s(pa.circulation_cvs) || "";
      const ivAccess = s(ps.iv_access) || s(pa.circulation_iv_access) || "Not documented";
      const pupils = s(ps.pupils) || s(pa.disability_pupils) || "Bilaterally equal and reactive";
      const power = s(ps.power) || s(pa.disability_power) || "5/5 all four limbs";
      const focalDeficit = s(ps.focal_deficit) || s(pa.disability_focal_deficit) || "None";
      const exposure = s(ps.exposure_findings) || s(pa.exposure_findings) || s(sd.primary_assessment?.exposure) || "";
      const ex = fc.examination || {};
      const examGeneral = s(ex.general_appearance) || s(sd.systemic_exam?.general) || "Conscious, oriented, comfortable at rest";
      const examCVS = s(ex.cvs_additional_notes) || s(sd.systemic_exam?.cvs) || cvsFindings || "S1 S2 heard, no murmurs";
      const examRespiratory = s(ex.respiratory_additional_notes) || s(sd.systemic_exam?.chest) || auscultation;
      const examAbdomen = s(ex.abdomen_additional_notes) || s(sd.systemic_exam?.pa) || "Soft, non-tender, bowel sounds present";
      const examCNS = s(ex.cns_additional_notes) || s(sd.systemic_exam?.cns) || "No focal neurological deficit";
      const examExtremities = s(ex.extremities_findings || ex.musculoskeletal) || s(sd.systemic_exam?.extremities) || "No pedal oedema, pulses present";
      const examHEENT = s(ex.heent) || "Not examined";
      const inv = fc.investigations || {};
      const labsOrdered = Array.isArray(inv.panels_selected) ? inv.panels_selected.join(", ") : Array.isArray(inv.individual_tests) ? inv.individual_tests.join(", ") : s(inv.labs_ordered) || "Nil";
      const imagingOrdered = Array.isArray(inv.imaging) ? inv.imaging.join(", ") : s(inv.imaging) || "Nil";
      const ecg = s(inv.ecg) || s(pa.ecg_findings) || "Not done";
      const efast = s(inv.efast) || s(pa.efast_findings) || s(sd.primary_assessment?.efast) || "Not done";
      const resultsSummary = s(inv.results_notes || inv.results_summary) || "Pending";
      const vbgObj = inv.vbg || fc.vbg_results || {};
      const vbgParts = [];
      if (vbgObj.ph) vbgParts.push(`pH ${vbgObj.ph}`);
      if (vbgObj.pco2) vbgParts.push(`PCO2 ${vbgObj.pco2} mmHg`);
      if (vbgObj.hco3) vbgParts.push(`HCO3 ${vbgObj.hco3} mEq/L`);
      if (vbgObj.lactate) vbgParts.push(`Lactate ${vbgObj.lactate} mmol/L`);
      if (vbgObj.hemoglobin) vbgParts.push(`Hb ${vbgObj.hemoglobin} g/dL`);
      if (vbgObj.sodium) vbgParts.push(`Na ${vbgObj.sodium}`);
      if (vbgObj.potassium) vbgParts.push(`K ${vbgObj.potassium}`);
      if (vbgObj.creatinine) vbgParts.push(`Cr ${vbgObj.creatinine}`);
      const vbgSection = vbgParts.length > 0 ? vbgParts.join(" | ") : "Not done";
      if (process.env.NODE_ENV !== "production") {
        const missingPaths = [];
        const chk = (path3, obj) => {
          const val = path3.split(".").reduce((o, k) => o?.[k], obj);
          if (val === void 0 || val === null || val === "") missingPaths.push(path3);
        };
        chk("primary_survey.airway", fc);
        chk("primary_survey.auscultation", fc);
        chk("primary_survey.pupils", fc);
        chk("investigations.vbg", fc);
        chk("treatment.consultations", fc);
        chk("history.hpi", fc);
        chk("examination.general_appearance", fc);
        if (missingPaths.length > 0) {
          console.warn("[Discharge] Missing full_case paths:", missingPaths);
        }
      }
      const trt = fc.treatment || {};
      const medications = Array.isArray(trt.medications) ? trt.medications : [];
      const infusions = Array.isArray(trt.infusions) ? trt.infusions : [];
      const fluids = trt.fluids || "";
      const erMedsText = [
        ...medications.map((m) => `\u2022 ${m.name || m.drug || ""} ${m.dose || ""} ${m.route || ""} ${m.frequency || ""}`.trim()),
        ...infusions.map((f) => `\u2022 ${f.name || f.fluid || ""} ${f.dose || ""} ${f.rate ? `at ${f.rate}` : ""}${f.dilution ? ` in ${f.dilution}` : ""}`.trim()),
        ...fluids ? [`\u2022 ${fluids}`] : []
      ].filter(Boolean).join("\n") || "Nil";
      const dischargeMedsText = s(sd.discharge_medications) || "To be completed by treating physician";
      const medsText = erMedsText;
      const procData = fc.procedures || {};
      const procList = Array.isArray(procData.procedures_performed) ? procData.procedures_performed : [];
      const proceduresText = procList.map((p) => p.name || p).join(", ") || procData.general_notes || "Nil";
      const consultations = Array.isArray(trt.consultations) ? trt.consultations : [];
      const consultText = consultations.filter((c) => c.specialty || c.doctorName).length > 0 ? consultations.filter((c) => c.specialty || c.doctorName).map(
        (c) => `\u2022 ${c.specialty || "Specialist"}${c.doctorName ? ` (Dr. ${c.doctorName})` : ""}: ${c.adviceGiven || "Advice pending"}`
      ).join("\n") : "No specialist consultations during this visit";
      const psych = fc.psychological || fc.psychological_assessment || {};
      const psychAssessed = psych.assessed !== false && Object.keys(psych).length > 0;
      const psychText = psychAssessed ? [
        psych.suicidal_ideation ? "Suicidal Ideation: YES \u2014 flagged" : "Suicidal Ideation: No",
        psych.self_harm ? "Self-Harm History: YES \u2014 flagged" : "Self-Harm History: No",
        psych.intent_to_harm_others ? "Intent to Harm Others: YES \u2014 flagged" : "Intent to Harm Others: No",
        psych.substance_abuse ? "Substance Abuse: YES \u2014 flagged" : "Substance Abuse: No",
        psych.psychiatric_history ? "Psychiatric History: YES" : "Psychiatric History: No",
        psych.currently_on_psychiatric_treatment ? "On Psychiatric Rx: YES" : "On Psychiatric Rx: No",
        psych.has_support_system ? "Support System: Present" : "Support System: Not documented",
        psych.notes ? `Notes: ${psych.notes}` : ""
      ].filter(Boolean).join("\n") : "Psychological screen: Not assessed during this visit";
      const workingDx = s(trt.primary_diagnosis || trt.provisional_diagnoses?.[0]) || s(sd.diagnosis) || "To be determined";
      const differentials = Array.isArray(trt.differential_diagnoses) ? trt.differential_diagnoses.join(", ") : s(trt.differential_diagnoses) || "None documented";
      const dispData = fc.disposition || {};
      const dispPlan = s(dispData.type || dispData.disposition_type) || s(sd.disposition_type) || "Not specified";
      const conditionDx = s(dispData.condition || dispData.condition_at_discharge) || s(sd.condition_at_discharge) || "STABLE";
      const pendingReps = s(dispData.pending_reports || dispData.follow_up_pending) || "Nil";
      const followUp = s(dispData.follow_up || dispData.follow_up_instructions) || s(sd.follow_up_advice) || "As clinically indicated";
      if (!complaint && !hpi && !workingDx) {
        return res.status(400).json({
          error: "Please complete Chief Complaint, HPI, and Working Diagnosis before generating the discharge summary."
        });
      }
      const mappedData = {
        // Structured prompt fields
        patientName,
        patientAge,
        patientSex,
        uhid,
        mlcStatus,
        modeArrival,
        arrivalDate,
        arrivalTime,
        emResident,
        emConsultant,
        complaint,
        duration,
        onset,
        signsSymptoms,
        hpi,
        pastMedical,
        pastSurgical,
        allergies,
        preMeds,
        familyHx,
        socialHx,
        bp,
        hr,
        rr,
        spo2,
        temp,
        grbs,
        gcsE,
        gcsV,
        gcsM,
        gcsTot,
        airway,
        auscultation,
        workBreathing,
        o2Device,
        crt,
        cvsFindings,
        ivAccess,
        pupils,
        power,
        focalDeficit,
        exposure,
        examGeneral,
        examCVS,
        examRespiratory,
        examAbdomen,
        examCNS,
        examExtremities,
        examHEENT,
        labsOrdered,
        imagingOrdered,
        ecg,
        efast,
        resultsSummary,
        vbgSection,
        medsText,
        dischargeMedsText,
        proceduresText,
        consultText,
        psychText,
        workingDx,
        differentials,
        dispPlan,
        conditionDx,
        pendingReps,
        followUp,
        // Legacy fallback fields
        chief_complaint: complaint,
        diagnosis: workingDx,
        history_of_present_illness: hpi,
        past_medical_history: pastMedical,
        allergy: allergies,
        disposition_type: dispPlan,
        condition_at_discharge: conditionDx,
        patient: { age: patientAge, gender: patientSex },
        vitals: sdV,
        medications: medications.length > 0 ? medications : sd.discharge_medications,
        investigations: `Labs: ${labsOrdered}
Imaging: ${imagingOrdered}
ECG: ${ecg}
EFAST: ${efast}
VBG: ${vbgSection}
${resultsSummary}`,
        consultations_text: consultText,
        procedures: proceduresText,
        primary_assessment: { airway, auscultation, pupils, power, exposure },
        examination: { general_appearance: examGeneral, cvs_additional_notes: examCVS, respiratory_additional_notes: examRespiratory, abdomen_additional_notes: examAbdomen, cns_additional_notes: examCNS },
        primary_survey_findings: { airway, auscultation, work_of_breathing: workBreathing, oxygen_device: o2Device, crt, pupils, power, exposure_findings: exposure }
      };
      const result = await generateCourseInHospital(mappedData);
      res.json({
        success: true,
        summary: {
          course_in_hospital: result.course_in_hospital,
          diagnosis: result.diagnosis
        }
      });
    } catch (error) {
      console.error("Discharge summary generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate discharge summary" });
    }
  });
  app2.post("/api/ai/extract-clinical", async (req, res) => {
    try {
      const { transcription, patientContext } = req.body;
      if (!transcription) {
        return res.status(400).json({ error: "Transcription is required" });
      }
      const extracted = await extractClinicalDataFromVoice(transcription, patientContext);
      res.json({
        success: true,
        extracted
      });
    } catch (error) {
      console.error("Clinical extraction error:", error);
      res.status(500).json({ error: error.message || "Failed to extract clinical data" });
    }
  });
  app2.post("/api/voice/transcribe", upload.single("audio"), async (req, res) => {
    try {
      const file = req.file;
      console.log("[Voice Transcribe] Request received, file:", file ? `${file.originalname} (${file.size} bytes, ${file.mimetype})` : "NO FILE", "body keys:", Object.keys(req.body));
      if (!file) {
        return res.status(400).json({ error: "No audio file provided" });
      }
      if (file.size < 5e3) {
        console.warn(`[Voice Transcribe] File too small: ${file.size} bytes \u2014 likely silent or failed recording`);
        return res.status(400).json({ error: `Audio too small (${file.size} bytes) \u2014 recording may have failed or captured silence. Please try again closer to the microphone.` });
      }
      let patientContext;
      if (req.body.patientContext) {
        try {
          patientContext = JSON.parse(req.body.patientContext);
        } catch {
          patientContext = void 0;
        }
      }
      const mode = req.body.mode || "full";
      let filename = file.originalname || "voice.m4a";
      const { convertAudioToWav: convertAudioToWav2 } = await Promise.resolve().then(() => (init_audioConvert(), audioConvert_exports));
      const converted = await convertAudioToWav2(file.buffer, filename);
      const { isSarvamAvailable: isSarvamAvailable2, sarvamSpeechToText: sarvamSpeechToText2, sarvamTranslateToEnglish: sarvamTranslateToEnglish2 } = await Promise.resolve().then(() => (init_sarvamAI(), sarvamAI_exports));
      let transcript = "";
      let detectedLanguage = "en-IN";
      let englishTranscript = "";
      const fileTooLargeForSarvam = converted.buffer.length > 9e5;
      if (fileTooLargeForSarvam) {
        console.log("[Voice] File too large for Sarvam (", converted.buffer.length, "bytes), going straight to Whisper");
      }
      if (isSarvamAvailable2() && !fileTooLargeForSarvam) {
        try {
          console.log("[Voice] Sarvam STT: transcribing in original language...");
          const sarvamResult = await sarvamSpeechToText2(converted.buffer, converted.filename, "unknown");
          transcript = sarvamResult.transcript || "";
          detectedLanguage = sarvamResult.language_code || "en-IN";
          console.log("[Voice] Sarvam STT success. Language:", detectedLanguage, "Length:", transcript.length);
          if (transcript && detectedLanguage && !detectedLanguage.startsWith("en")) {
            console.log("[Voice] Non-English detected, translating to English...");
            try {
              const translated = await sarvamTranslateToEnglish2(transcript);
              englishTranscript = translated.translated_text || transcript;
              console.log("[Voice] Translation success. English length:", englishTranscript.length);
            } catch (translateErr) {
              console.warn("[Voice] Translation failed, using original:", translateErr);
              englishTranscript = transcript;
            }
          } else {
            englishTranscript = transcript;
          }
        } catch (sarvamError) {
          console.warn("[Voice] Sarvam STT failed, falling back to Whisper:", sarvamError);
          const result = await transcribeAndExtractVoice(converted.buffer, converted.filename, patientContext, "transcribe_only");
          transcript = result.transcript || "";
          englishTranscript = transcript;
        }
      } else {
        console.log("[Voice] Sarvam not available, using Whisper...");
        const result = await transcribeAndExtractVoice(converted.buffer, converted.filename, patientContext, "transcribe_only");
        transcript = result.transcript || "";
        englishTranscript = transcript;
      }
      res.json({ transcript, englishTranscript, detectedLanguage });
    } catch (error) {
      console.error("Voice transcription error:", error);
      res.status(500).json({ error: error.message || "Failed to transcribe audio" });
    }
  });
  app2.post("/api/voice/smart-dictation", upload.single("audio"), async (req, res) => {
    try {
      const file = req.file;
      console.log("[Smart Dictation] Request received, file:", file ? `${file.originalname} (${file.size} bytes, ${file.mimetype})` : "NO FILE", "body keys:", Object.keys(req.body));
      if (!file) {
        return res.status(400).json({ error: "No audio file provided" });
      }
      if (file.size < 5e3) {
        console.warn(`[Smart Dictation] File too small: ${file.size} bytes \u2014 likely silent or failed recording`);
        return res.status(400).json({ error: `Audio too small (${file.size} bytes) \u2014 recording may have failed. Please try again.` });
      }
      let patientContext;
      if (req.body.patientContext) {
        try {
          patientContext = JSON.parse(req.body.patientContext);
        } catch {
          patientContext = void 0;
        }
      }
      let filename = file.originalname || "voice.m4a";
      const { convertAudioToWav: convertAudioToWav2 } = await Promise.resolve().then(() => (init_audioConvert(), audioConvert_exports));
      const converted = await convertAudioToWav2(file.buffer, filename);
      const { isSarvamAvailable: isSarvamAvailable2, sarvamSpeechToTextTranslate: sarvamSpeechToTextTranslate2 } = await Promise.resolve().then(() => (init_sarvamAI(), sarvamAI_exports));
      const { extractSmartDictation: extractSmartDictation2 } = await Promise.resolve().then(() => (init_aiDiagnosis(), aiDiagnosis_exports));
      let transcript = "";
      const fileTooLargeForSarvam = converted.buffer.length > 9e5;
      if (fileTooLargeForSarvam) {
        console.log("[SmartDictation] File too large for Sarvam (", converted.buffer.length, "bytes), going straight to Whisper");
      }
      if (isSarvamAvailable2() && !fileTooLargeForSarvam) {
        try {
          console.log("[SmartDictation] Using Sarvam AI for speech-to-text");
          const sarvamResult = await sarvamSpeechToTextTranslate2(converted.buffer, converted.filename);
          transcript = sarvamResult.transcript || "";
          console.log("[SmartDictation] Sarvam STT success, transcript length:", transcript.length);
        } catch (sarvamError) {
          console.warn("[SmartDictation] Sarvam STT failed, falling back to Whisper:", sarvamError);
          const { transcribeAndExtractVoice: transcribeAndExtractVoice2 } = await Promise.resolve().then(() => (init_aiDiagnosis(), aiDiagnosis_exports));
          const fallbackResult = await transcribeAndExtractVoice2(converted.buffer, converted.filename, patientContext, "transcribe_only");
          transcript = fallbackResult.transcript || "";
        }
      } else {
        console.log("[SmartDictation] Using OpenAI Whisper for speech-to-text");
        const { transcribeAndExtractVoice: transcribeAndExtractVoice2 } = await Promise.resolve().then(() => (init_aiDiagnosis(), aiDiagnosis_exports));
        const result = await transcribeAndExtractVoice2(converted.buffer, converted.filename, patientContext, "transcribe_only");
        transcript = result.transcript || "";
      }
      if (!transcript || transcript.trim().length === 0) {
        return res.json({ transcript: "", extracted: null, error: "No speech detected" });
      }
      console.log("[SmartDictation] Extracting clinical data from transcript...");
      const extracted = await extractSmartDictation2(transcript, patientContext);
      res.json({ transcript, extracted });
    } catch (error) {
      console.error("Smart dictation error:", error);
      res.status(500).json({ error: error.message || "Failed to process dictation" });
    }
  });
  app2.post("/api/voice/translate", async (req, res) => {
    try {
      const { text: text2 } = req.body;
      if (!text2 || typeof text2 !== "string" || !text2.trim()) {
        return res.status(400).json({ error: "No text provided for translation" });
      }
      const { isSarvamAvailable: isSarvamAvailable2, sarvamTranslateToEnglish: sarvamTranslateToEnglish2 } = await Promise.resolve().then(() => (init_sarvamAI(), sarvamAI_exports));
      if (!isSarvamAvailable2()) {
        return res.json({ translated_text: text2, skipped: true, reason: "Sarvam AI not configured" });
      }
      console.log("[Translate] Translating text to English, length:", text2.length);
      const result = await sarvamTranslateToEnglish2(text2.trim());
      res.json({
        translated_text: result.translated_text,
        source_language: result.source_language_code,
        original_text: text2
      });
    } catch (error) {
      console.error("[Translate] Error:", error);
      res.json({ translated_text: req.body.text, skipped: true, reason: error.message });
    }
  });
  app2.post("/api/voice/extract-and-save", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "No auth token" });
      const {
        transcript,
        patientContext,
        patient,
        case_type,
        userId,
        userEmail
      } = req.body;
      if (!transcript || !transcript.trim()) {
        return res.status(400).json({ error: "No transcript provided" });
      }
      console.log("[ExtractAndSave] Transcript length:", transcript.length);
      const { extractSmartDictation: extractSmartDictation2 } = await Promise.resolve().then(() => (init_aiDiagnosis(), aiDiagnosis_exports));
      const timeout = new Promise(
        (_, reject) => setTimeout(() => reject(new Error("Extraction timed out after 45s")), 45e3)
      );
      const extracted = await Promise.race([
        extractSmartDictation2(transcript, patientContext),
        timeout
      ]);
      console.log("[ExtractAndSave] Extraction done. Chief complaint:", extracted.chiefComplaint || "(none)");
      const ex = extracted;
      const vs = ex.vitalsSuggested || {};
      const ps = ex.primarySurvey || {};
      const [sys, dia] = (vs.bp || ps.circulation?.bpSystolic ? `${ps.circulation?.bpSystolic || 120}/${ps.circulation?.bpDiastolic || 80}` : "120/80").split("/");
      const bpSys = parseInt(sys) || 120;
      const bpDia = parseInt(dia) || 80;
      const hr = parseInt(vs.hr || ps.circulation?.hr) || 80;
      const spo2 = parseInt(vs.spo2 || ps.breathing?.spo2) || 98;
      const rr = parseInt(vs.rr || ps.breathing?.rr) || 16;
      const gcs = parseInt(vs.gcs || ps.disability?.gcsTotal) || 15;
      let triage_color = "green", triage_priority = 4;
      if (spo2 < 90 || gcs < 9 || bpSys < 80) {
        triage_color = "red";
        triage_priority = 1;
      } else if (spo2 < 94 || gcs < 13 || bpSys < 100 || hr > 120 || rr > 30) {
        triage_color = "orange";
        triage_priority = 2;
      } else if (spo2 < 96 || hr > 100 || rr > 24 || bpSys > 180) {
        triage_color = "yellow";
        triage_priority = 3;
      } else if (hr > 90 || rr > 20) {
        triage_color = "green";
        triage_priority = 4;
      } else {
        triage_color = "blue";
        triage_priority = 5;
      }
      const vitals_at_arrival = {
        hr,
        bp_systolic: bpSys,
        bp_diastolic: bpDia,
        rr,
        spo2,
        temperature: parseFloat(vs.temperature || ps.exposure?.temperature) || 36.8,
        gcs_e: parseInt(ps.disability?.gcsE) || 4,
        gcs_v: parseInt(ps.disability?.gcsV) || 5,
        gcs_m: parseInt(ps.disability?.gcsM) || 6,
        grbs: parseInt(vs.grbs || ps.disability?.grbs) || 100,
        pain_score: 0
      };
      const presenting_complaint = {
        text: ex.chiefComplaint || "",
        onset_type: ex.onset || "Sudden",
        duration: ex.duration || "",
        course: ""
      };
      const em_resident = ex.emResident || patient?.informant_name || "";
      const em_consultant = ex.emConsultant || "";
      const createRes = await fetch(`${EXTERNAL_API}/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({
          patient,
          presenting_complaint,
          vitals_at_arrival,
          triage_color,
          triage_priority,
          em_resident,
          em_consultant,
          case_type
        })
      });
      if (!createRes.ok) {
        const errText = await createRes.text();
        console.error("[ExtractAndSave] Case create failed:", createRes.status, errText);
        return res.status(createRes.status).json({ error: `Case creation failed: ${errText}` });
      }
      const created = await createRes.json();
      const caseId = created.id || created._id || created.case_id;
      if (!caseId) return res.status(500).json({ error: "No case ID returned" });
      console.log("[ExtractAndSave] Case created:", caseId);
      const pastMedRaw = ex.pastMedicalHistory;
      const pastMedArr = Array.isArray(pastMedRaw) ? pastMedRaw.map((s) => s.trim()).filter((s) => s) : typeof pastMedRaw === "string" && pastMedRaw ? pastMedRaw.split(/[,;\/\n]+/).map((s) => s.trim()).filter((s) => s) : [];
      const symptomsArr = [];
      if (ex.symptoms?.length > 0) symptomsArr.push(...ex.symptoms);
      if (ex.associatedSymptoms) symptomsArr.push(ex.associatedSymptoms);
      const vbg = ex.vbgResults || {};
      const adjunctsAbg = {};
      if (vbg.ph) adjunctsAbg.pH = vbg.ph;
      if (vbg.pco2) adjunctsAbg.pCO2 = vbg.pco2;
      if (vbg.po2) adjunctsAbg.pO2 = vbg.po2;
      if (vbg.hco3) adjunctsAbg.HCO3 = vbg.hco3;
      if (vbg.be) adjunctsAbg.BE = vbg.be;
      if (vbg.lactate) adjunctsAbg.Lactate = vbg.lactate;
      if (vbg.hemoglobin) adjunctsAbg.Hb = vbg.hemoglobin;
      if (vbg.sodium) adjunctsAbg.Na = vbg.sodium;
      if (vbg.potassium) adjunctsAbg.K = vbg.potassium;
      if (vbg.chloride) adjunctsAbg.Cl = vbg.chloride;
      if (vbg.glucose) adjunctsAbg.Glucose = vbg.glucose;
      if (vbg.creatinine) adjunctsAbg.Creatinine = vbg.creatinine;
      if (vbg.bilirubin) adjunctsAbg.Bilirubin = vbg.bilirubin;
      const adj = ex.adjuncts || {};
      const vbgNotesParts = [];
      if (vbg.sampleType) vbgNotesParts.push(vbg.sampleType);
      Object.entries(adjunctsAbg).forEach(([k, v]) => vbgNotesParts.push(`${k}: ${v}`));
      const invOrdered = ex.investigationsOrdered || "";
      const invTests = invOrdered ? invOrdered.split(/[,;\/\n]+/).map((s) => s.trim()).filter((s) => s) : [];
      const updateRes = await fetch(`${EXTERNAL_API}/cases/${caseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({
          history: {
            hpi: ex.historyOfPresentIllness || transcript,
            events_hopi: ex.historyOfPresentIllness || transcript,
            signs_and_symptoms: symptomsArr.join(", "),
            past_medical: pastMedArr,
            past_surgical: ex.pastSurgicalHistory || "",
            allergies: ex.allergies ? ex.allergies.split(/[,;]+/).map((s) => s.trim()).filter((s) => s) : [],
            medications: ex.currentMedications || "",
            drug_history: ex.currentMedications || "",
            family_history: ex.familyHistory || "",
            social_history: ex.socialHistory || ""
          },
          primary_assessment: {
            airway_status: ps.airway?.status || "Patent",
            airway_additional_notes: ps.airway?.intervention || "",
            breathing_rr: rr || void 0,
            breathing_spo2: spo2 || void 0,
            breathing_oxygen_device: ps.breathing?.oxygenDevice || "Room air",
            breathing_additional_notes: ps.breathing?.auscultation || "",
            circulation_hr: hr || void 0,
            circulation_bp_systolic: bpSys || void 0,
            circulation_bp_diastolic: bpDia || void 0,
            circulation_additional_notes: ps.circulation?.cvs || "",
            disability_gcs_e: parseInt(ps.disability?.gcsE) || void 0,
            disability_gcs_v: parseInt(ps.disability?.gcsV) || void 0,
            disability_gcs_m: parseInt(ps.disability?.gcsM) || void 0,
            disability_grbs: parseFloat(ps.disability?.grbs || vs.grbs) || void 0,
            exposure_temperature: parseFloat(ps.exposure?.temperature || vs.temperature) || void 0,
            exposure_additional_notes: ps.exposure?.findings || ""
          },
          adjuncts: {
            ...adj.ecgDone ? { ecg_status: "Done", ecg_findings: adj.ecgFindings || "" } : {},
            ...adj.echoDone ? { bedside_echo: adj.echoFindings || "Done" } : {},
            ...adj.efastDone ? { efast_status: "Done", efast_notes: adj.efastFindings || "" } : {},
            ...Object.keys(adjunctsAbg).length > 0 ? { abg: adjunctsAbg } : {},
            ...vbgNotesParts.length > 0 ? { additional_notes: vbgNotesParts.join(" | ") } : {}
          },
          examination: {
            general_additional_notes: ex.examFindings?.general || "",
            cvs_additional_notes: ex.examFindings?.cvs || "",
            respiratory_additional_notes: ex.examFindings?.respiratory || "",
            abdomen_additional_notes: ex.examFindings?.abdomen || "",
            cns_additional_notes: ex.examFindings?.cns || ""
          },
          investigations: {
            ...invTests.length > 0 ? { individual_tests: invTests } : {},
            ...ex.imagingOrdered ? { imaging: [ex.imagingOrdered] } : {},
            ...invOrdered ? { results_notes: invOrdered } : {},
            ...Object.keys(adjunctsAbg).length > 0 ? { vbg: adjunctsAbg } : {}
          },
          treatment: {
            primary_diagnosis: ex.diagnosis?.[0] || "",
            provisional_diagnoses: ex.diagnosis || [],
            differential_diagnoses: ex.differentialDiagnosis || [],
            medications: ex.prescribedMedications || [],
            infusions: ex.prescribedInfusions || [],
            notes: ex.treatmentNotes || "",
            intervention_notes: ex.treatmentNotes || ""
          }
        })
      });
      if (!updateRes.ok) {
        const errText = await updateRes.text();
        console.warn("[ExtractAndSave] Clinical PUT failed (case still created):", updateRes.status, errText);
        return res.json({ success: true, caseId, extracted, warning: "Case created \u2014 some clinical fields may need manual entry." });
      }
      console.log("[ExtractAndSave] Clinical data saved for case:", caseId);
      try {
        const db2 = getDb();
        if (db2 && userId) {
          const { caseClinicalData: caseClinicalData2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
          await db2.insert(caseClinicalData2).values({ caseId, userId, payload: { extracted, transcript } });
          console.log("[ExtractAndSave] Local DB saved");
        }
      } catch (dbErr) {
        console.warn("[ExtractAndSave] Local DB failed (non-fatal):", dbErr);
      }
      if (userId) {
        try {
          const { incrementCaseCount: incrementCaseCount2 } = await Promise.resolve().then(() => (init_subscription(), subscription_exports));
          await incrementCaseCount2(userId, userEmail || "");
        } catch {
        }
      }
      return res.json({ success: true, caseId, extracted });
    } catch (err) {
      console.error("[ExtractAndSave] Error:", err);
      return res.status(500).json({ success: false, error: err.message || "Extract and save failed" });
    }
  });
  app2.post("/api/voice/extract-clinical", async (req, res) => {
    try {
      const { transcript, patientContext } = req.body;
      if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
        return res.status(400).json({ error: "No transcript text provided" });
      }
      console.log("[ExtractClinical] Processing transcript, length:", transcript.length);
      const { extractSmartDictation: extractSmartDictation2 } = await Promise.resolve().then(() => (init_aiDiagnosis(), aiDiagnosis_exports));
      const timeout = new Promise(
        (_, reject) => setTimeout(() => reject(new Error("Extraction timed out after 30s")), 3e4)
      );
      const extracted = await Promise.race([
        extractSmartDictation2(transcript, patientContext),
        timeout
      ]);
      res.json({ extracted });
    } catch (error) {
      console.error("Clinical extraction error:", error);
      res.status(500).json({ error: error.message || "Failed to extract clinical data" });
    }
  });
  app2.post("/api/voice/save-case", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "No auth token" });
      const {
        patient,
        presenting_complaint,
        vitals_at_arrival,
        triage_color,
        triage_priority,
        em_resident,
        em_consultant,
        case_type,
        history,
        primary_assessment,
        examination,
        treatment,
        userId,
        userEmail
      } = req.body;
      const createRes = await fetch(`${EXTERNAL_API}/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({
          patient,
          presenting_complaint,
          vitals_at_arrival,
          triage_color,
          triage_priority,
          em_resident,
          em_consultant,
          case_type
        })
      });
      if (!createRes.ok) {
        const errText = await createRes.text();
        console.error("[VoiceSave] Create failed:", createRes.status, errText);
        return res.status(createRes.status).json({ error: `Failed to create case: ${errText}` });
      }
      const created = await createRes.json();
      const caseId = created.id || created._id || created.case_id;
      if (!caseId) return res.status(500).json({ error: "No case ID returned from backend" });
      console.log("[VoiceSave] Case created:", caseId);
      const updateRes = await fetch(`${EXTERNAL_API}/cases/${caseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ history, primary_assessment, examination, treatment })
      });
      if (!updateRes.ok) {
        const errText = await updateRes.text();
        console.warn("[VoiceSave] Clinical update failed (case still created):", updateRes.status, errText);
        return res.json({ success: true, caseId, warning: "Case created but some clinical data may need to be re-entered manually." });
      }
      console.log("[VoiceSave] Clinical data saved for case:", caseId);
      try {
        const db2 = getDb();
        if (db2 && userId) {
          const { caseClinicalData: caseClinicalData2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
          await db2.insert(caseClinicalData2).values({ caseId, userId, payload: req.body });
          console.log("[VoiceSave] Local DB clinical data saved");
        }
      } catch (dbErr) {
        console.warn("[VoiceSave] Local DB save failed (non-fatal):", dbErr);
      }
      if (userId) {
        try {
          const { incrementCaseCount: incrementCaseCount2 } = await Promise.resolve().then(() => (init_subscription(), subscription_exports));
          await incrementCaseCount2(userId, userEmail || "");
        } catch {
        }
      }
      return res.json({ success: true, caseId });
    } catch (err) {
      console.error("[VoiceSave] Error:", err);
      return res.status(500).json({ success: false, error: err.message || "Save failed" });
    }
  });
  app2.post("/api/scan/document", upload.single("document"), async (req, res) => {
    try {
      const file = req.file;
      console.log("[Doc Scan] Request received, file:", file ? `${file.originalname} (${file.mimetype}, ${file.size} bytes)` : "none");
      if (!file) {
        return res.status(400).json({ error: "No document file provided" });
      }
      let patientContext;
      if (req.body.patientContext) {
        try {
          patientContext = JSON.parse(req.body.patientContext);
        } catch {
          patientContext = void 0;
        }
      }
      const isImage = file.mimetype.startsWith("image/");
      let parsedText = "";
      if (isImage) {
        const base64Image = file.buffer.toString("base64");
        const dataUrl = `data:${file.mimetype};base64,${base64Image}`;
        const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
        const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
        if (apiKey && baseURL) {
          console.log("[Doc Scan] Using OpenAI Vision for OCR...");
          try {
            const OpenAI3 = (await import("openai")).default;
            const openai = new OpenAI3({ apiKey, baseURL });
            const visionResponse = await openai.chat.completions.create({
              model: "gpt-4o",
              messages: [
                {
                  role: "system",
                  content: "You are a medical document OCR system. Extract ALL text from the provided medical document image exactly as written. Include all values, numbers, units, dates, and labels. Output the raw extracted text only, no commentary."
                },
                {
                  role: "user",
                  content: [
                    { type: "text", text: "Extract all text from this medical document:" },
                    { type: "image_url", image_url: { url: dataUrl, detail: "high" } }
                  ]
                }
              ],
              max_tokens: 4096
            });
            parsedText = visionResponse.choices[0]?.message?.content || "";
            console.log("[Doc Scan] OpenAI Vision OCR done, text length:", parsedText.length);
          } catch (visionErr) {
            console.warn("[Doc Scan] OpenAI Vision failed, trying Sarvam fallback:", visionErr.message);
          }
        }
        if (!parsedText) {
          const { isSarvamAvailable: isSarvamAvailable2, sarvamParsePDF: sarvamParsePDF2 } = await Promise.resolve().then(() => (init_sarvamAI(), sarvamAI_exports));
          if (isSarvamAvailable2()) {
            console.log("[Doc Scan] Using Sarvam AI fallback...");
            try {
              const { default: PDFDocument2 } = await import("pdfkit");
              const pdfBuffer = await new Promise((resolve2, reject) => {
                const doc = new PDFDocument2({ size: "A4" });
                const chunks = [];
                doc.on("data", (chunk) => chunks.push(chunk));
                doc.on("end", () => resolve2(Buffer.concat(chunks)));
                doc.on("error", reject);
                doc.image(file.buffer, 0, 0, { fit: [595, 842], align: "center", valign: "center" });
                doc.end();
              });
              parsedText = await sarvamParsePDF2(pdfBuffer, 1);
              console.log("[Doc Scan] Sarvam OCR done, text length:", parsedText.length);
            } catch (sarvamErr) {
              console.warn("[Doc Scan] Sarvam fallback also failed:", sarvamErr.message);
            }
          }
        }
      } else {
        const { isSarvamAvailable: isSarvamAvailable2, sarvamParsePDF: sarvamParsePDF2 } = await Promise.resolve().then(() => (init_sarvamAI(), sarvamAI_exports));
        if (isSarvamAvailable2()) {
          console.log("[Doc Scan] PDF document, using Sarvam AI...");
          parsedText = await sarvamParsePDF2(file.buffer, parseInt(req.body.pageNumber) || 1);
        }
      }
      if (!parsedText || parsedText.trim().length === 0) {
        return res.json({
          success: true,
          text: "",
          structured: null,
          message: "No text could be extracted from the document"
        });
      }
      let structured = null;
      const extractMode = req.body.mode || "clinical";
      if (extractMode === "clinical") {
        try {
          structured = await extractClinicalDataFromVoice(parsedText, patientContext);
        } catch (extractErr) {
          console.warn("[Doc Scan] Clinical extraction failed:", extractErr);
        }
      }
      res.json({
        success: true,
        text: parsedText,
        structured
      });
    } catch (error) {
      console.error("Document scan error:", error);
      res.status(500).json({ error: error.message || "Failed to scan document" });
    }
  });
  app2.get("/api/sarvam/status", async (_req, res) => {
    const { isSarvamAvailable: isSarvamAvailable2 } = await Promise.resolve().then(() => (init_sarvamAI(), sarvamAI_exports));
    res.json({ available: isSarvamAvailable2() });
  });
  app2.post("/api/treatment-history/save", async (req, res) => {
    try {
      const { userId, diagnosis, medications, infusions, patientAge, patientSex, caseId } = req.body;
      if (!diagnosis || !medications?.length && !infusions?.length) {
        return res.status(400).json({ error: "Diagnosis and at least one medication/infusion required" });
      }
      const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const db2 = getDb2();
      if (!db2) {
        return res.status(503).json({ error: "Database not available" });
      }
      const { treatmentHistory: treatmentHistory2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eq4, and } = await import("drizzle-orm");
      const ageGroup = parseInt(patientAge) <= 16 ? "pediatric" : "adult";
      const savedItems = [];
      for (const med of medications || []) {
        const existing = await db2.select().from(treatmentHistory2).where(and(
          eq4(treatmentHistory2.diagnosis, diagnosis),
          eq4(treatmentHistory2.drugName, med.name),
          eq4(treatmentHistory2.drugType, "medication")
        )).limit(1);
        if (existing.length > 0) {
          await db2.update(treatmentHistory2).set({
            usageCount: (existing[0].usageCount || 1) + 1,
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq4(treatmentHistory2.id, existing[0].id));
          savedItems.push({ ...existing[0], updated: true });
        } else {
          const newRecord = await db2.insert(treatmentHistory2).values({
            userId,
            diagnosis,
            drugName: med.name,
            dose: med.dose,
            route: med.route,
            frequency: med.frequency,
            drugType: "medication",
            ageGroup,
            patientAge: String(patientAge),
            patientSex,
            caseId
          }).returning();
          savedItems.push(newRecord[0]);
        }
      }
      for (const inf of infusions || []) {
        const existing = await db2.select().from(treatmentHistory2).where(and(
          eq4(treatmentHistory2.diagnosis, diagnosis),
          eq4(treatmentHistory2.drugName, inf.name),
          eq4(treatmentHistory2.drugType, "infusion")
        )).limit(1);
        if (existing.length > 0) {
          await db2.update(treatmentHistory2).set({
            usageCount: (existing[0].usageCount || 1) + 1,
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq4(treatmentHistory2.id, existing[0].id));
          savedItems.push({ ...existing[0], updated: true });
        } else {
          const newRecord = await db2.insert(treatmentHistory2).values({
            userId,
            diagnosis,
            drugName: inf.name,
            dose: inf.dose,
            dilution: inf.dilution,
            rate: inf.rate,
            drugType: "infusion",
            ageGroup,
            patientAge: String(patientAge),
            patientSex,
            caseId
          }).returning();
          savedItems.push(newRecord[0]);
        }
      }
      res.json({ success: true, savedCount: savedItems.length });
    } catch (error) {
      console.error("Treatment history save error:", error);
      res.status(500).json({ error: "Failed to save treatment history" });
    }
  });
  app2.get("/api/treatment-history/recommendations", async (req, res) => {
    try {
      const { diagnosis, ageGroup, limit = "10" } = req.query;
      if (!diagnosis) {
        return res.status(400).json({ error: "Diagnosis is required" });
      }
      const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const db2 = getDb2();
      if (!db2) {
        return res.status(503).json({ error: "Database not available" });
      }
      const { treatmentHistory: treatmentHistory2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eq4, and, ilike, desc: desc2 } = await import("drizzle-orm");
      let results = [];
      if (ageGroup && (ageGroup === "pediatric" || ageGroup === "adult")) {
        results = await db2.select().from(treatmentHistory2).where(and(
          ilike(treatmentHistory2.diagnosis, `%${diagnosis}%`),
          eq4(treatmentHistory2.ageGroup, ageGroup)
        )).orderBy(desc2(treatmentHistory2.usageCount)).limit(parseInt(limit));
      } else {
        results = await db2.select().from(treatmentHistory2).where(ilike(treatmentHistory2.diagnosis, `%${diagnosis}%`)).orderBy(desc2(treatmentHistory2.usageCount)).limit(parseInt(limit));
      }
      const medications = results.filter((r) => r.drugType === "medication");
      const infusions = results.filter((r) => r.drugType === "infusion");
      res.json({
        success: true,
        recommendations: {
          medications: medications.map((m) => ({
            name: m.drugName,
            dose: m.dose,
            route: m.route,
            frequency: m.frequency,
            usageCount: m.usageCount
          })),
          infusions: infusions.map((i) => ({
            name: i.drugName,
            dose: i.dose,
            dilution: i.dilution,
            rate: i.rate,
            usageCount: i.usageCount
          }))
        }
      });
    } catch (error) {
      console.error("Treatment recommendations error:", error);
      res.status(500).json({ error: "Failed to get recommendations" });
    }
  });
  app2.get("/api/subscription/status", async (req, res) => {
    try {
      const userId = req.query.userId;
      const userEmail = req.query.userEmail;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const sub = await getOrCreateSubscription(userId, userEmail || "");
      res.json({
        plan: sub.plan,
        status: sub.status,
        casesUsed: sub.casesUsed,
        casesLimit: sub.casesLimit,
        casesRemaining: sub.plan === "free" ? Math.max(0, sub.casesLimit - sub.casesUsed) : null,
        currentPeriodEnd: sub.currentPeriodEnd,
        priceInr: PREMIUM_PRICE_INR,
        freeCaseLimit: FREE_CASE_LIMIT
      });
    } catch (error) {
      console.error("Subscription status error:", error);
      res.status(500).json({ error: "Failed to get subscription status" });
    }
  });
  app2.post("/api/subscription/check-case", async (req, res) => {
    try {
      const { userId, userEmail } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const result = await canCreateCase(userId, userEmail || "");
      res.json(result);
    } catch (error) {
      console.error("Check case error:", error);
      res.status(500).json({ error: "Failed to check case limit" });
    }
  });
  app2.post("/api/subscription/increment-case", async (req, res) => {
    try {
      const { userId, userEmail } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const result = await incrementCaseCount(userId, userEmail || "");
      res.json(result);
    } catch (error) {
      console.error("Increment case error:", error);
      res.status(500).json({ error: "Failed to increment case count" });
    }
  });
  app2.post("/api/subscription/activate-premium", async (req, res) => {
    try {
      const { userId, stripeCustomerId, stripeSubscriptionId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      await activatePremium(userId, stripeCustomerId, stripeSubscriptionId);
      const sub = await getOrCreateSubscription(userId, "");
      res.json({ success: true, subscription: sub });
    } catch (error) {
      console.error("Activate premium error:", error);
      res.status(500).json({ error: "Failed to activate premium" });
    }
  });
  app2.post("/api/subscription/cancel", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      await cancelSubscription(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Cancel subscription error:", error);
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });
  app2.get("/api/em-reference/topics", (_req, res) => {
    res.json(EM_TOPICS);
  });
  app2.post("/api/em-reference/chat", async (req, res) => {
    try {
      const { messages, topic } = req.body;
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages array is required" });
      }
      const response = await getEMReferenceResponse(messages, topic);
      res.json({ response });
    } catch (error) {
      console.error("[EMReference] Chat error:", error);
      res.status(500).json({ error: "Failed to generate response" });
    }
  });
  app2.post("/api/em-reference/feedback", async (req, res) => {
    try {
      const { messageId, query, response, topic, feedbackType, feedbackComment, userId } = req.body;
      if (!messageId || !query || !response || !feedbackType) {
        return res.status(400).json({ error: "messageId, query, response, and feedbackType are required" });
      }
      if (!["helpful", "not_helpful"].includes(feedbackType)) {
        return res.status(400).json({ error: "feedbackType must be 'helpful' or 'not_helpful'" });
      }
      const db2 = getDb();
      await db2.insert(emReferenceFeedback).values({
        messageId,
        query,
        response,
        topic: topic || null,
        feedbackType,
        feedbackComment: feedbackComment || null,
        userId: userId || null
      });
      res.json({ success: true });
    } catch (error) {
      console.error("[EMReference] Feedback error:", error);
      res.status(500).json({ error: "Failed to save feedback" });
    }
  });
  app2.get("/api/em-reference/feedback/stats", async (_req, res) => {
    try {
      const db2 = getDb();
      const helpful = await db2.select({ count: count2() }).from(emReferenceFeedback).where(eq3(emReferenceFeedback.feedbackType, "helpful"));
      const notHelpful = await db2.select({ count: count2() }).from(emReferenceFeedback).where(eq3(emReferenceFeedback.feedbackType, "not_helpful"));
      res.json({
        helpful: helpful[0]?.count || 0,
        notHelpful: notHelpful[0]?.count || 0,
        total: (helpful[0]?.count || 0) + (notHelpful[0]?.count || 0)
      });
    } catch (error) {
      console.error("[EMReference] Feedback stats error:", error);
      res.status(500).json({ error: "Failed to get feedback stats" });
    }
  });
  app2.post("/api/feedback", async (req, res) => {
    try {
      const { userId, userEmail, userName, category, message, platform, appVersion } = req.body;
      if (!message || !message.trim()) {
        return res.status(400).json({ error: "Feedback message is required" });
      }
      const db2 = getDb();
      const [inserted] = await db2.insert(userFeedback).values({
        userId: userId || null,
        userEmail: userEmail || null,
        userName: userName || null,
        category: category || "general",
        message: message.trim(),
        platform: platform || null,
        appVersion: appVersion || null
      }).returning();
      res.json({ success: true, id: inserted.id });
    } catch (error) {
      console.error("[Feedback] Error saving feedback:", error);
      res.status(500).json({ error: "Failed to save feedback" });
    }
  });
  app2.get("/api/feedback", async (_req, res) => {
    try {
      const db2 = getDb();
      const items = await db2.select().from(userFeedback).orderBy(desc(userFeedback.createdAt)).limit(100);
      res.json(items);
    } catch (error) {
      console.error("[Feedback] Error fetching feedback:", error);
      res.status(500).json({ error: "Failed to fetch feedback" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs2 from "fs";
import * as path2 from "path";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    if (origin && origins.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      limit: "50mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false, limit: "50mb" }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path3 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path3.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path2.resolve(process.cwd(), "app.json");
    const appJsonContent = fs2.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, req, res) {
  const manifestPath = path2.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs2.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host") || "";
  const actualBaseUrl = `${protocol}://${host}`;
  let manifest = fs2.readFileSync(manifestPath, "utf-8");
  manifest = manifest.replace(/https:\/\/[^/]+\.(replit\.dev|replit\.app|picard\.replit\.dev)[^"]*?(?=\/\d{13}-)/g, actualBaseUrl);
  manifest = manifest.replace(/https:\/\/[^/]+\.(replit\.dev|replit\.app|picard\.replit\.dev)[^"]*?(?=\/assets\/)/g, actualBaseUrl);
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path2.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs2.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  const webAppTemplatePath = path2.resolve(process.cwd(), "server", "templates", "web-app.html");
  const webAppTemplate = fs2.existsSync(webAppTemplatePath) ? fs2.readFileSync(webAppTemplatePath, "utf-8") : null;
  app2.get("/web", (_req, res) => {
    if (webAppTemplate) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(webAppTemplate);
    } else {
      res.status(404).send("Web app not found");
    }
  });
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, req, res);
    }
    if (req.path === "/") {
      const webIndexPath = path2.resolve(process.cwd(), "static-build/web/index.html");
      if (fs2.existsSync(webIndexPath)) {
        return res.sendFile(webIndexPath);
      }
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.get("/manifest.webmanifest", (_req, res) => {
    const manifestPath = path2.resolve(process.cwd(), "static-build", "manifest.webmanifest");
    if (fs2.existsSync(manifestPath)) {
      res.setHeader("Content-Type", "application/manifest+json");
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(manifestPath);
    } else {
      res.status(404).json({ error: "PWA manifest not found" });
    }
  });
  app2.get("/sw.js", (_req, res) => {
    let cacheVersion = "ermate-pwa-v3";
    try {
      const entries = fs2.readdirSync(path2.resolve(process.cwd(), "static-build"));
      const tsFolder = entries.find((e) => /^\d{13}/.test(e));
      if (tsFolder) cacheVersion = `ermate-pwa-${tsFolder}`;
    } catch {
    }
    const offlineHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ErMate \u2014 Offline</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0a0e1a;color:#f0f4ff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}.card{background:#1a2236;border:1px solid #2a3a55;border-radius:20px;padding:40px 32px;max-width:400px;text-align:center}.icon{width:56px;height:56px;border-radius:14px;background:#1f2d45;display:flex;align-items:center;justify-content:center;margin:0 auto 20px}svg{width:28px;height:28px;stroke:#94a3b8;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}h2{font-size:20px;font-weight:700;margin-bottom:8px}p{font-size:14px;color:#94a3b8;line-height:1.6;margin-bottom:24px}a{display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:10px 24px;border-radius:10px;font-size:14px;font-weight:600}</style></head><body><div class="card"><div class="icon"><svg viewBox="0 0 24 24"><path d="M1 6s4-2 11-2 11 2 11 2"/><path d="M1 18s4 2 11 2 11-2 11-2"/><line x1="1" y1="12" x2="23" y2="12"/><line x1="12" y1="4" x2="12" y2="20"/></svg></div><h2>You are offline</h2><p>Cases you have already opened are available below. New cases and updates require a connection.</p><a href="/web">View Cached Cases</a></div></body></html>`;
    const swContent = `
const CACHE = '${cacheVersion}';
const PRECACHE = ['/web', '/assets/images/icon.png', '/assets/images/favicon.png'];

// Install \u2014 pre-cache key assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(PRECACHE).catch(function() {});
    }).then(function() { return self.skipWaiting(); })
  );
});

// Activate \u2014 delete old caches, claim clients immediately
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// Message \u2014 allow manual skip-waiting
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Offline fallback HTML
const OFFLINE_HTML = ${JSON.stringify(offlineHtml)};

// Fetch \u2014 network first, cache fallback, offline page last resort
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  // API calls \u2014 never cache, let them fail naturally if offline
  var url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request).then(function(networkRes) {
      // Network succeeded \u2014 update cache in background, return fresh response
      if (networkRes && networkRes.status === 200) {
        var clone = networkRes.clone();
        caches.open(CACHE).then(function(cache) { cache.put(event.request, clone); });
      }
      return networkRes;
    }).catch(function() {
      // Network failed \u2014 try cache
      return caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        // Nothing in cache \u2014 return offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html' } });
        }
        // For non-navigation (images, scripts) just fail silently
        return new Response('', { status: 503 });
      });
    })
  );
});
`.trim();
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Service-Worker-Allowed", "/");
    res.send(swContent);
  });
  app2.get("/assets/", (req, res, next) => {
    const unstablePath = req.query.unstable_path;
    if (!unstablePath) return next();
    const resolved = path2.resolve(process.cwd(), unstablePath.replace(/^\.\//, ""));
    const cwd = path2.resolve(process.cwd());
    if (!resolved.startsWith(cwd)) {
      return res.status(403).send("Forbidden");
    }
    if (fs2.existsSync(resolved)) {
      return res.sendFile(resolved);
    }
    next();
  });
  app2.use("/assets", express.static(path2.resolve(process.cwd(), "assets")));
  app2.use(express.static(path2.resolve(process.cwd(), "static-build")));
  app2.use(express.static(path2.resolve(process.cwd(), "static-build/web")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, _next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`express server serving on port ${port}`);
    }
  );
})();
