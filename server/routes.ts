import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from "docx";
import multer from "multer";
import crypto from "crypto";
import { generateDiagnosisSuggestions, recordFeedback, getFeedbackStats, getLearningInsights, generateCourseInHospital, extractClinicalDataFromVoice, transcribeAndExtractVoice, generateRoundsDebrief, type AIFeedback, type FeedbackResult, type ExtractedClinicalData } from "./services/aiDiagnosis";
import { getOrCreateSubscription, canCreateCase, incrementCaseCount, activatePremium, activatePlan, cancelSubscription, FREE_CASE_LIMIT, PREMIUM_PRICE_INR } from "./services/subscription";
import { createPaymentLink, verifyWebhookSignature } from "./services/razorpayService";
import { PLAN_AMOUNTS_PAISE } from "./config/pricing";
import { getEMReferenceResponse, EM_TOPICS, type EMReferenceMessage } from "./services/emReference";
import { getDb, getPool, ensureAuthSessionsTable, ensureDepartmentTables, ensurePasswordResetTable } from "./db";
import { emReferenceFeedback, userFeedback } from "@shared/schema";
import { eq, desc, count, sql as drizzleSql } from "drizzle-orm";
import { registerDepartmentRoutes } from "./routes/department";
import { registerShiftRoutes } from "./routes/shifts";
import { registerEscalationRoutes } from "./routes/escalations";

// ─── AES-256-GCM helpers for credential encryption ───────────────────────────
const CIPHER_ALGO = "aes-256-gcm";
function _encKey(): Buffer {
  const secret = process.env.SESSION_SECRET || "ermate-fallback-dev-key-change-in-prod";
  return crypto.createHash("sha256").update(secret).digest();
}
function encryptPassword(text: string): { enc: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(CIPHER_ALGO, _encKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return {
    enc: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}
function decryptPassword(enc: string, iv: string, tag: string): string {
  const decipher = crypto.createDecipheriv(CIPHER_ALGO, _encKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(enc, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

interface VitalsData {
  hr?: string;
  bp?: string;
  rr?: string;
  spo2?: string;
  gcs?: string;
  pain_score?: string;
  grbs?: string;
  temp?: string;
}

interface DischargeSummaryData {
  patient: {
    name: string;
    age: string | number;
    sex: string;
    phone?: string;
  };
  discharge_summary: {
    mlc?: boolean;
    allergy?: string;
    vitals_arrival?: VitalsData;
    presenting_complaint?: string;
    history_of_present_illness?: string;
    past_medical_history?: string;
    family_history?: string;
    lmp?: string;
    primary_assessment?: {
      airway?: string;
      breathing?: string;
      circulation?: string;
      disability?: string;
      exposure?: string;
      efast?: string;
    };
    secondary_assessment?: {
      pallor?: boolean;
      icterus?: boolean;
      cyanosis?: boolean;
      clubbing?: boolean;
      lymphadenopathy?: boolean;
      edema?: boolean;
    };
    systemic_exam?: {
      chest?: string;
      cvs?: string;
      pa?: string;
      cns?: string;
      extremities?: string;
    };
    course_in_hospital?: string;
    investigations?: string;
    diagnosis?: string;
    discharge_medications?: string;
    disposition_type?: string;
    condition_at_discharge?: string;
    vitals_discharge?: VitalsData;
    follow_up_advice?: string;
    ed_resident?: string;
    ed_consultant?: string;
    sign_time_resident?: string;
    sign_time_consultant?: string;
    discharge_date?: string;
    treatment_given?: string;
    medications?: string;
    follow_up?: string;
    instructions?: string;
    doctor_name?: string;
  };
  created_at?: string;
}

function formatDate(dateString?: string): string {
  if (!dateString) return new Date().toLocaleDateString("en-IN");
  try {
    return new Date(dateString).toLocaleDateString("en-IN");
  } catch {
    return new Date().toLocaleDateString("en-IN");
  }
}

function formatVitals(vitals: any): string {
  if (!vitals) return "";
  const parts: string[] = [];
  if (vitals.hr) parts.push(`HR: ${vitals.hr}`);
  const bp = vitals.bp || ((vitals.bp_systolic || vitals.bp_diastolic) ? `${vitals.bp_systolic || "-"}/${vitals.bp_diastolic || "-"}` : "");
  if (bp) parts.push(`BP: ${bp}`);
  if (vitals.rr) parts.push(`RR: ${vitals.rr}`);
  if (vitals.spo2) parts.push(`SpO2: ${vitals.spo2}%`);
  const temp = vitals.temperature || vitals.temp;
  if (temp) parts.push(`Temp: ${temp}\u00B0F`);
  const gcsE = vitals.gcs_e; const gcsV = vitals.gcs_v; const gcsM = vitals.gcs_m;
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

function formatSecondaryAssessment(assessment: DischargeSummaryData["discharge_summary"]["secondary_assessment"]): string {
  if (!assessment) return "";
  const findings: string[] = [];
  if (assessment.pallor) findings.push("Pallor");
  if (assessment.icterus) findings.push("Icterus");
  if (assessment.cyanosis) findings.push("Cyanosis");
  if (assessment.clubbing) findings.push("Clubbing");
  if (assessment.lymphadenopathy) findings.push("Lymphadenopathy");
  if (assessment.edema) findings.push("Edema");
  return findings.length > 0 ? findings.join(", ") : "No significant findings";
}

const linkCodes = new Map<string, { userId: string; userEmail: string; userName: string; token: string; createdAt: number; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [code, data] of linkCodes.entries()) {
    if (now > data.expiresAt) {
      linkCodes.delete(code);
    }
  }
}, 60000);

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function decodeJwt(token: string): Record<string, any> | null {
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

export async function registerRoutes(app: Express, existingServer?: Server): Promise<Server> {
  // Ensure all local tables exist (idempotent — safe to run on every startup)
  ensureAuthSessionsTable().catch(() => {});
  ensureDepartmentTables().catch(() => {});
  ensurePasswordResetTable().catch(() => {});

  const EXTERNAL_API = process.env.EXPO_PUBLIC_EXTERNAL_API_URL || "https://er-emr-backend.onrender.com/api";

  app.get("/api/proxy/cases", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "No auth token" });

      const externalRes = await fetch(`${EXTERNAL_API}/cases`, {
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
      });

      const responseText = await externalRes.text();
      if (!externalRes.ok) {
        try { return res.status(externalRes.status).json(JSON.parse(responseText)); }
        catch { return res.status(externalRes.status).send(responseText); }
      }

      let casesData: any[];
      try {
        const parsed = JSON.parse(responseText);
        casesData = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.data) ? parsed.data : []);
      } catch {
        return res.status(500).json({ error: "Invalid response from backend" });
      }

      if (casesData.length === 0) return res.json([]);

      // Collect all possible user identifiers:
      // 1. From JWT payload (server-decoded)
      const token = authHeader.replace(/^Bearer\s+/i, "");
      const jwtPayload = decodeJwt(token);
      const jwtUserId = jwtPayload?.sub || jwtPayload?.id || jwtPayload?.user_id || jwtPayload?.userId;
      const jwtEmail   = jwtPayload?.email;

      // 2. From query params (client-provided — most reliable since client has the full user object)
      const qUserId = (req.query.userId as string | undefined)?.trim();
      const qEmail  = (req.query.email  as string | undefined)?.trim().toLowerCase();

      // Merge: prefer client-supplied, fall back to JWT
      const userId    = qUserId   || (jwtUserId ? String(jwtUserId) : undefined);
      const userEmail = qEmail    || (jwtEmail ? String(jwtEmail).toLowerCase() : undefined);

      const sample = casesData[0];
      const caseKeys = Object.keys(sample);
      const hasUserField =
        "doctor_id" in sample || "user_id" in sample ||
        "created_by" in sample || "created_by_user_id" in sample ||
        "doctor_email" in sample;

      // Diagnostic: log first case's identity fields alongside what we're filtering by
      const diagFields = {
        doctor_id: sample.doctor_id,
        user_id: sample.user_id,
        created_by: sample.created_by,
        created_by_user_id: sample.created_by_user_id,
        doctor_email: sample.doctor_email,
      };
      console.log(`[PROXY] Filter by → userId="${userId}" email="${userEmail}"`);
      console.log(`[PROXY] Sample case identity fields:`, JSON.stringify(diagFields));

      if (!hasUserField) {
        console.log(`[PROXY] No user field found on cases (keys: ${caseKeys.join(", ")}). Returning all ${casesData.length}.`);
        return res.json(casesData);
      }

      // If we have no identifiers at all, return all (better than 0)
      if (!userId && !userEmail) {
        console.log(`[PROXY] No userId or email available — returning all ${casesData.length} cases (pass ?userId=&email= for filtering).`);
        return res.json(casesData);
      }

      const toStr = (v: any) => (v === null || v === undefined ? "" : String(v).trim());

      const filtered = casesData.filter((c: any) => {
        // Email match (case-insensitive — most reliable cross-format identifier)
        if (userEmail) {
          const cEmail = toStr(c.doctor_email).toLowerCase();
          if (cEmail && cEmail === userEmail) return true;
        }
        // ID match — compare as string to handle integer vs string mismatch
        if (userId) {
          const uid = toStr(userId);
          if (uid && (
            toStr(c.doctor_id)           === uid ||
            toStr(c.user_id)             === uid ||
            toStr(c.created_by)          === uid ||
            toStr(c.created_by_user_id)  === uid
          )) return true;
        }
        return false;
      });

      console.log(`[PROXY] Cases: ${casesData.length} total → ${filtered.length} for user (id="${userId}" email="${userEmail}")`);

      // If 0 matched by our filter, check whether ALL returned cases share a single
      // created_by_user_id — this means the external backend already pre-filtered by the
      // authenticated user's JWT, but uses a different internal UUID than what the JWT
      // sub/id field exposes. Trust the backend's auth in that case.
      if (filtered.length === 0 && casesData.length > 0) {
        const uniqueOwners = new Set(
          casesData.map((c: any) => toStr(c.created_by_user_id)).filter(Boolean)
        );
        if (uniqueOwners.size === 1) {
          console.log(
            `[PROXY] 0 matched by ID/email but all ${casesData.length} cases share 1 owner UUID — ` +
            `backend pre-filtered by auth token. Returning all. ` +
            `(JWT sub="${userId}" vs case owner="${[...uniqueOwners][0]}")`
          );
          return res.json(casesData);
        }
        console.warn(
          `[PROXY] 0 cases matched. JWT payload keys: ${jwtPayload ? Object.keys(jwtPayload).join(", ") : "null"}. ` +
          `Client provided userId="${qUserId}" email="${qEmail}". Unique case owners: ${uniqueOwners.size}.`
        );
      }

      return res.json(filtered);
    } catch (err: any) {
      console.error("[PROXY] GET /cases error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/proxy/cases/:id", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "No auth token" });
      const { id } = req.params;
      const externalRes = await fetch(`${EXTERNAL_API}/cases/${id}`, {
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
      });
      const responseText = await externalRes.text();
      try { return res.status(externalRes.status).json(JSON.parse(responseText)); }
      catch { return res.status(externalRes.status).send(responseText); }
    } catch (err: any) {
      console.error("[PROXY] GET /cases/:id error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/proxy/cases/:id", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "No auth token" });

      const { id } = req.params;
      const externalRes = await fetch(`${EXTERNAL_API}/cases/${id}`, {
        method: "DELETE",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
      });

      const responseText = await externalRes.text();
      try { return res.status(externalRes.status).json(JSON.parse(responseText)); }
      catch { return res.status(externalRes.status).send(responseText); }
    } catch (err: any) {
      console.error("[PROXY] DELETE /cases/:id error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // Rename patient: update just the patient name on the external backend
  app.patch("/api/cases/:id/rename", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "No auth token" });
      const { id } = req.params;
      const { name } = req.body || {};
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "name is required" });
      }
      const externalRes = await fetch(`${EXTERNAL_API}/cases/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ patient: { name: name.trim() } }),
      });
      const responseText = await externalRes.text();
      try { return res.status(externalRes.status).json(JSON.parse(responseText)); }
      catch { return res.status(externalRes.status).send(responseText); }
    } catch (err: any) {
      console.error("[RENAME] error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // Chat-update: save extracted clinical data from ErMate chat back to the case
  app.post("/api/proxy/cases/:id/chat-update", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "No auth token" });
      const { id } = req.params;
      const { extracted: ex = {} } = req.body || {};

      // Map SmartDictationExtracted → external backend case format
      const updateBody: Record<string, any> = {};

      if (ex.chiefComplaint) {
        updateBody.presenting_complaint = { text: ex.chiefComplaint };
      }

      const histFields: Record<string, any> = {};
      if (ex.historyOfPresentIllness) histFields.hpi = ex.historyOfPresentIllness;
      if (ex.chiefComplaint) histFields.signs_and_symptoms = ex.chiefComplaint;
      if (ex.allergies) histFields.allergies = ex.allergies.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean);
      if (ex.currentMedications) histFields.medications = ex.currentMedications;
      if (ex.pastMedicalHistory) histFields.past_medical = ex.pastMedicalHistory;
      if (ex.familyHistory) histFields.family_history = ex.familyHistory;
      if (ex.socialHistory) histFields.social_history = ex.socialHistory;
      if (Object.keys(histFields).length > 0) updateBody.history = histFields;

      const primaryFields: Record<string, any> = {};
      // Support both legacy flat fields (heartRate/bloodPressure) and SmartDictationExtracted shape (vitalsSuggested.*)
      const vs = ex.vitalsSuggested || {};
      const hrVal   = vs.hr   || ex.heartRate;
      const bpVal   = vs.bp   || ex.bloodPressure;
      const spo2Val = vs.spo2 || ex.spo2;
      const rrVal   = vs.rr   || ex.respiratoryRate;
      const tmpVal  = vs.temperature || ex.temperature;
      const gcsVal  = vs.gcs  || ex.gcs;
      const grbsVal = vs.grbs || ex.grbs;
      if (hrVal)   primaryFields.circulation_hr = hrVal;
      if (bpVal) {
        const bp = String(bpVal).split(/[/\\-]/);
        if (bp[0]) primaryFields.circulation_bp_systolic = bp[0].trim();
        if (bp[1]) primaryFields.circulation_bp_diastolic = bp[1].trim();
      }
      if (spo2Val) primaryFields.breathing_spo2 = spo2Val;
      if (rrVal)   primaryFields.breathing_rr = rrVal;
      if (tmpVal)  primaryFields.exposure_temperature = tmpVal;
      if (gcsVal)  primaryFields.disability_gcs_total = gcsVal;
      if (grbsVal) primaryFields.disability_grbs = grbsVal;
      if (Object.keys(primaryFields).length > 0) updateBody.primary_assessment = primaryFields;

      const examFields: Record<string, any> = {};
      // Support both legacy flat fields and SmartDictationExtracted examFindings shape
      const ef = ex.examFindings || {};
      if (ef.general    || ex.generalExamination)  examFields.general        = ef.general    || ex.generalExamination;
      if (ef.cvs        || ex.cardiovascularExam)  examFields.cardiovascular  = ef.cvs        || ex.cardiovascularExam;
      if (ef.respiratory|| ex.respiratoryExam)     examFields.respiratory     = ef.respiratory|| ex.respiratoryExam;
      if (ef.abdomen    || ex.abdomenExam)         examFields.abdomen         = ef.abdomen    || ex.abdomenExam;
      if (ef.cns        || ex.cnsExam)             examFields.cns             = ef.cns        || ex.cnsExam;
      if (ef.heent)                                examFields.heent           = ef.heent;
      if (ef.musculoskeletal)                      examFields.musculoskeletal = ef.musculoskeletal;
      if (Object.keys(examFields).length > 0) updateBody.examination = examFields;

      const treatFields: Record<string, any> = {};
      // Support both legacy medications and SmartDictationExtracted prescribedMedications
      const medsData = ex.prescribedMedications || ex.medications;
      if (medsData?.length) treatFields.medications = medsData;
      const infsData = ex.prescribedInfusions || ex.infusions;
      if (infsData?.length) treatFields.infusions = infsData;
      if (ex.procedures?.length) treatFields.procedures_performed = ex.procedures;
      if (ex.investigationsOrdered || ex.investigations) treatFields.investigations_ordered = ex.investigationsOrdered || ex.investigations;
      if (ex.imagingOrdered) treatFields.imaging = ex.imagingOrdered;
      if (Object.keys(treatFields).length > 0) updateBody.treatment = treatFields;

      if (ex.provisionalDiagnosis) updateBody.disposition = { provisional_diagnosis: ex.provisionalDiagnosis };

      if (Object.keys(updateBody).length === 0) {
        return res.json({ success: true, updated: false });
      }

      const externalRes = await fetch(`${EXTERNAL_API}/cases/${id}`, {
        method: "PUT",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(updateBody),
      });

      const responseText = await externalRes.text();
      try { return res.status(externalRes.status).json(JSON.parse(responseText)); }
      catch { return res.status(externalRes.status).send(responseText); }
    } catch (err: any) {
      console.error("[PROXY] POST /cases/:id/chat-update error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/proxy/clinical-data/:caseId", async (req: Request, res: Response) => {
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
      const db = getDb();
      if (!db) return res.status(503).json({ error: "Database unavailable" });

      const { caseClinicalData } = await import("@shared/schema");
      const { sql: drizzleSqlFn } = await import("drizzle-orm");
      await db.insert(caseClinicalData).values({
        caseId,
        userId,
        payload,
      }).onConflictDoUpdate({
        target: [caseClinicalData.caseId, caseClinicalData.userId],
        set: {
          payload,
          updatedAt: drizzleSqlFn`CURRENT_TIMESTAMP`,
        },
      });

      console.log(`[CLINICAL] Saved clinical data for case ${caseId} user ${userId}`);
      return res.json({ success: true });
    } catch (err: any) {
      console.error("[CLINICAL] POST error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/proxy/clinical-data/:caseId", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "No auth token" });
      const token = authHeader.replace(/^Bearer\s+/i, "");
      const jwtPayload = decodeJwt(token);
      if (!jwtPayload) return res.status(401).json({ error: "Invalid token" });
      const userId = jwtPayload.sub || jwtPayload.id || jwtPayload.user_id || jwtPayload.email;
      if (!userId) return res.status(401).json({ error: "Cannot identify user" });

      const { caseId } = req.params;
      const db = getDb();
      if (!db) return res.status(503).json({ error: "Database unavailable" });

      const { caseClinicalData } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      const rows = await db.select().from(caseClinicalData)
        .where(and(eq(caseClinicalData.caseId, caseId), eq(caseClinicalData.userId, userId)))
        .limit(1);

      if (rows.length === 0) return res.json({ found: false });
      return res.json({ found: true, payload: rows[0].payload, updatedAt: rows[0].updatedAt });
    } catch (err: any) {
      console.error("[CLINICAL] GET error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/generate-link-code", async (req: Request, res: Response) => {
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
        expiresAt: now + expiresIn * 1000,
      });

      const domain = process.env.REPLIT_DOMAINS
        ? process.env.REPLIT_DOMAINS.split(",")[0].trim()
        : process.env.REPLIT_DEV_DOMAIN || process.env.REPL_SLUG + ".replit.app";
      const url = `https://${domain}/web?code=${code}`;

      res.json({
        success: true,
        data: {
          code,
          url,
          expires_in: expiresIn,
        },
      });
    } catch (error) {
      console.error("[Link Code] Generate error:", error);
      res.status(500).json({ error: "Failed to generate link code" });
    }
  });

  app.get("/api/auth/verify-link-code", async (req: Request, res: Response) => {
    try {
      const code = (req.query.code as string || "").toUpperCase();

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
          name: linkData.userName,
        },
      });
    } catch (error) {
      console.error("[Link Code] Verify error:", error);
      res.status(500).json({ error: "Failed to verify link code" });
    }
  });

  // ── QR-based device linking ──────────────────────────────────────────────
  const qrSessions = new Map<string, {
    status: "pending" | "approved";
    authToken?: string;
    userId?: string;
    userEmail?: string;
    userName?: string;
    createdAt: number;
    expiresAt: number;
  }>();

  setInterval(() => {
    const now = Date.now();
    for (const [t, d] of qrSessions.entries()) {
      if (now > d.expiresAt) qrSessions.delete(t);
    }
  }, 60000);

  app.post("/api/device-link/generate", async (req: Request, res: Response) => {
    try {
      const { randomUUID } = await import("crypto");
      const token = randomUUID();
      const expiresIn = 300;
      qrSessions.set(token, {
        status: "pending",
        createdAt: Date.now(),
        expiresAt: Date.now() + expiresIn * 1000,
      });
      const domain = process.env.REPLIT_DOMAINS
        ? process.env.REPLIT_DOMAINS.split(",")[0].trim()
        : process.env.REPLIT_DEV_DOMAIN || (process.env.REPL_SLUG || "ermate") + ".replit.app";
      const qrUrl = `https://${domain}/web?qr_token=${token}`;
      return res.json({ success: true, token, qr_url: qrUrl, expires_in: expiresIn });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/device-link/approve", async (req: Request, res: Response) => {
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
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/device-link/status", async (req: Request, res: Response) => {
    try {
      const token = (req.query.token as string || "").trim();
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
          user: { id: session.userId, email: session.userEmail, name: session.userName },
        };
        qrSessions.delete(token);
        return res.json(result);
      }
      return res.json({ status: "pending", expires_in: Math.floor((session.expiresAt - Date.now()) / 1000) });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/manifest.json", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/manifest+json");
    res.json({
      name: "ErMate",
      short_name: "ErMate",
      description: "Emergency Room EMR — voice-powered case documentation",
      start_url: "/web",
      display: "standalone",
      background_color: "#0a0e1a",
      theme_color: "#3b82f6",
      orientation: "portrait-primary",
      icons: [
        { src: "/assets/images/icon.png", sizes: "192x192", type: "image/png" },
        { src: "/assets/images/icon.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ],
    });
  });

  app.post("/api/auth/google", async (req: Request, res: Response) => {
    try {
      const { idToken, accessToken, name, email, password } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const EXTERNAL_API = "https://er-emr-backend.onrender.com/api";

      const safeJsonParse = async (response: globalThis.Response) => {
        const text = await response.text();
        try {
          return JSON.parse(text);
        } catch {
          console.warn("[Google Auth] Non-JSON response:", text.substring(0, 200));
          return null;
        }
      };

      // If a password was explicitly provided (link-account flow), use it
      const loginPassword = password || email;

      // Try 1: login with provided password or email as password
      let loginRes = await fetch(`${EXTERNAL_API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: loginPassword }),
      });

      if (loginRes.ok) {
        const loginData = await safeJsonParse(loginRes);
        if (loginData) {
          // Cache credentials so password-reset flow can retrieve the current password later
          try {
            const pool = getPool();
            if (pool) {
              const { enc, iv, tag } = encryptPassword(loginPassword);
              const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
              const jwtPayload = loginData.token ? decodeJwt(loginData.token) : null;
              const userId = jwtPayload?.sub || jwtPayload?.id || jwtPayload?.user_id || "";
              await pool.query("DELETE FROM auth_sessions WHERE email = $1", [email.toLowerCase().trim()]);
              await pool.query(
                `INSERT INTO auth_sessions (user_id, email, encrypted_password, iv, tag, expires_at) VALUES ($1, $2, $3, $4, $5, $6)`,
                [userId, email.toLowerCase().trim(), enc, iv, tag, expiresAt]
              );
            }
          } catch (cacheErr) {
            console.warn("[Google Auth] Could not cache credentials:", cacheErr);
          }
          return res.json(loginData);
        }
      }

      // Try 2: attempt registration for new Google users
      const registerRes = await fetch(`${EXTERNAL_API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || email.split("@")[0],
          email,
          password: email,
          role: "resident",
        }),
      });

      if (registerRes.ok) {
        const registerData = await safeJsonParse(registerRes);
        if (registerData) return res.json(registerData);
      }

      const regErrorText = await registerRes.text().catch(() => "");
      console.error("[Google Auth] Registration failed:", regErrorText);

      // If email is already registered, this user has an existing account with a
      // different password — guide them to sign in with email/password instead.
      const emailAlreadyExists =
        regErrorText.toLowerCase().includes("already registered") ||
        regErrorText.toLowerCase().includes("already exists") ||
        regErrorText.toLowerCase().includes("duplicate");

      if (emailAlreadyExists) {
        return res.status(401).json({
          error:
            "An account with this email already exists. Please sign in using your email and password instead.",
        });
      }

      // Try 3: one more login attempt in case registration just succeeded on the backend
      loginRes = await fetch(`${EXTERNAL_API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: email }),
      });

      if (loginRes.ok) {
        const loginData = await safeJsonParse(loginRes);
        if (loginData) return res.json(loginData);
      }

      return res.status(401).json({ error: "Google sign-in failed. The server may be temporarily unavailable — please try again in a moment." });
    } catch (error) {
      console.error("[Google Auth] Error:", error);
      res.status(500).json({ error: "Google sign-in failed. Please try again." });
    }
  });

  // Login proxy — routes through our server to handle Render cold-start retries
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const EXT = "https://er-emr-backend.onrender.com/api";
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const attempt = async (timeoutMs: number) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const r = await fetch(`${EXT}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        return r;
      } catch (err: any) {
        clearTimeout(timer);
        if (err.name === "AbortError") return null; // timed out
        throw err;
      }
    };
    try {
      // First attempt — 20 s (fast path when backend is warm)
      let r = await attempt(20000);
      // Second attempt — 40 s (allow time for Render cold start)
      if (!r) {
        console.warn("[Login] First attempt timed out, retrying for cold start...");
        r = await attempt(40000);
      }
      if (!r) {
        return res.status(503).json({ error: "Server is taking too long to respond. Please try again." });
      }
      const text = await r.text();
      let data: any = null;
      try { data = JSON.parse(text); } catch {}
      if (r.ok && data) {
        console.log(`[Login] Success for ${email}`);
        // Cache credentials so password-reset flow can retrieve the current password later
        try {
          const pool = getPool();
          if (pool) {
            const { enc, iv, tag } = encryptPassword(password);
            const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
            const jwtPayload = data.token ? decodeJwt(data.token) : null;
            const userId = jwtPayload?.sub || jwtPayload?.id || jwtPayload?.user_id || "";
            await pool.query("DELETE FROM auth_sessions WHERE email = $1", [email.toLowerCase().trim()]);
            await pool.query(
              `INSERT INTO auth_sessions (user_id, email, encrypted_password, iv, tag, expires_at) VALUES ($1, $2, $3, $4, $5, $6)`,
              [userId, email.toLowerCase().trim(), enc, iv, tag, expiresAt]
            );
          }
        } catch (cacheErr) {
          console.warn("[Login] Could not cache credentials:", cacheErr);
        }
        return res.json(data);
      }
      const errorMsg = data?.detail || data?.error || data?.message || "Invalid credentials";
      return res.status(r.status).json({ error: errorMsg });
    } catch (err) {
      console.error("[Login] Error:", err);
      return res.status(500).json({ error: "Login failed. Please try again." });
    }
  });

  // Registration proxy — forwards to external backend and handles email-send failures gracefully
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const EXTERNAL_API = "https://er-emr-backend.onrender.com/api";
    try {
      const registerRes = await fetch(`${EXTERNAL_API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });

      if (registerRes.ok) {
        const data = await registerRes.json().catch(() => null);
        if (data) return res.json(data);
      }

      const errorText = await registerRes.text().catch(() => "");

      // If the external backend crashed with a 5xx (e.g. welcome-email failure),
      // the user may have been created. Try logging in to confirm.
      if (registerRes.status >= 500) {
        console.warn("[Register] External backend returned 5xx — trying login to check if user was created:", errorText);
        const loginRes = await fetch(`${EXTERNAL_API}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: req.body.email, password: req.body.password }),
        });
        if (loginRes.ok) {
          const loginData = await loginRes.json().catch(() => null);
          if (loginData) return res.json(loginData);
        }
      }

      // Pass the original error back (400 = validation, 409 = duplicate, etc.)
      let parsed: any = null;
      try { parsed = JSON.parse(errorText); } catch {}
      const errorMsg = parsed?.detail || parsed?.error || parsed?.message || errorText || "Registration failed";
      return res.status(registerRes.status || 400).json({ error: errorMsg });
    } catch (err) {
      console.error("[Register] Error:", err);
      return res.status(500).json({ error: "Registration failed. Please try again." });
    }
  });

  app.post("/api/auth/change-password", async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters" });
      }
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // For Google users, currentPassword is not sent from the client.
      // The external backend stores their email as the default password on Google sign-up.
      // Decode the JWT to get the email and use it as the fallback current_password.
      let resolvedCurrentPassword = currentPassword;
      if (!resolvedCurrentPassword) {
        const token = authHeader.replace(/^Bearer\s+/i, "");
        const payload = decodeJwt(token);
        const email = payload?.email;
        if (email) {
          resolvedCurrentPassword = email.toLowerCase().trim();
          console.log("[ChangePassword] Google user — using email as current_password");
        }
      }

      const EXTERNAL_API = "https://er-emr-backend.onrender.com/api";
      const response = await fetch(`${EXTERNAL_API}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": authHeader },
        body: JSON.stringify({ current_password: resolvedCurrentPassword, new_password: newPassword }),
      });
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return res.json({ success: true, message: data.message || "Password changed successfully." });
      }
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData.detail || errData.message || errData.error || "Could not change password.";
      return res.status(response.status).json({ error: errMsg });
    } catch (error) {
      console.error("[Change Password] Error:", error);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });

      const pool = getPool();
      if (!pool) return res.status(503).json({ error: "Database unavailable" });

      const crypto = await import("crypto");
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Invalidate any existing tokens for this email
      await pool.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE email = $1 AND used_at IS NULL", [email.toLowerCase()]);
      // Store new token
      await pool.query(
        "INSERT INTO password_reset_tokens (email, token, expires_at) VALUES ($1, $2, $3)",
        [email.toLowerCase(), token, expiresAt]
      );

      const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || "ermate.in";
      const resetUrl = `https://${domain}/reset-password?token=${token}`;

      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        // If domain not verified yet, Resend only allows sending to the account owner's email.
        // RESEND_FROM_DOMAIN env var should be set to "ermate.in" once verified on resend.com/domains.
        const fromDomain = process.env.RESEND_FROM_DOMAIN || "resend.dev";
        const fromAddress = fromDomain === "resend.dev"
          ? "ErMate <onboarding@resend.dev>"
          : `ErMate <noreply@${fromDomain}>`;
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: fromAddress,
            to: [email.toLowerCase()],
            subject: "Reset your ErMate password",
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:12px">
                <div style="text-align:center;margin-bottom:24px">
                  <div style="display:inline-block;background:#10b981;border-radius:12px;padding:12px 16px">
                    <span style="color:#fff;font-size:22px;font-weight:700">ErMate</span>
                  </div>
                </div>
                <h2 style="color:#0f172a;font-size:20px;margin-bottom:8px">Reset your password</h2>
                <p style="color:#475569;font-size:15px;line-height:1.6;margin-bottom:24px">
                  We received a request to reset your ErMate password. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.
                </p>
                <a href="${resetUrl}" style="display:block;background:#10b981;color:#fff;text-align:center;padding:14px 24px;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;margin-bottom:24px">
                  Reset Password
                </a>
                <p style="color:#94a3b8;font-size:13px;line-height:1.5">
                  If you didn't request this, you can safely ignore this email — your password won't change.<br><br>
                  Or copy this link into your browser:<br>
                  <span style="color:#10b981;word-break:break-all">${resetUrl}</span>
                </p>
              </div>
            `,
          }),
        }).then(async r => {
          if (!r.ok) console.error("[ForgotPassword] Resend error:", await r.text());
          else console.log(`[ForgotPassword] Reset email sent to ${email}`);
        });
      } else {
        console.warn("[ForgotPassword] RESEND_API_KEY not set — skipping email");
      }

      return res.json({ success: true, message: "If an account exists with this email, a password reset link has been sent." });
    } catch (error) {
      console.error("[Forgot Password] Error:", error);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  // Verify a reset token (GET — used by the reset-password web page)
  app.get("/api/auth/verify-reset-token", async (req: Request, res: Response) => {
    try {
      const token = (req.query.token as string || "").trim();
      if (!token) return res.status(400).json({ error: "Token required" });
      const pool = getPool();
      if (!pool) return res.status(503).json({ error: "Database unavailable" });
      const result = await pool.query(
        "SELECT email FROM password_reset_tokens WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()",
        [token]
      );
      if (result.rows.length === 0) return res.status(410).json({ error: "This link has expired or already been used." });
      return res.json({ valid: true, email: result.rows[0].email });
    } catch (error) {
      console.error("[VerifyResetToken] Error:", error);
      return res.status(500).json({ error: "Something went wrong." });
    }
  });

  // Submit new password
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) return res.status(400).json({ error: "Token and new password are required" });
      if (newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

      const pool = getPool();
      if (!pool) return res.status(503).json({ error: "Database unavailable" });

      const result = await pool.query(
        "SELECT email FROM password_reset_tokens WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()",
        [token]
      );
      if (result.rows.length === 0) return res.status(410).json({ error: "This link has expired or already been used." });

      const email = result.rows[0].email;

      // Mark token as used
      await pool.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE token = $1", [token]);

      // Change password on external backend
      const EXT = "https://er-emr-backend.onrender.com/api";

      // Build list of passwords to try for the login step (most likely first):
      // 1. Current stored password from auth_sessions (regular email users who previously logged in)
      // 2. Their email (Google-registered users whose default password = email)
      const tryPasswords: string[] = [];
      try {
        const sessionRow = await pool.query(
          "SELECT encrypted_password, iv, tag FROM auth_sessions WHERE email = $1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
          [email.toLowerCase()]
        );
        if (sessionRow.rows.length > 0) {
          const { encrypted_password, iv, tag } = sessionRow.rows[0];
          tryPasswords.push(decryptPassword(encrypted_password, iv, tag));
        }
      } catch (e) {
        console.warn("[ResetPassword] Could not retrieve stored credentials:", e);
      }
      tryPasswords.push(email); // Google fallback: email = default password

      // Login helper with cold-start retry (same pattern as the login proxy)
      const tryLogin = async (emailAddr: string, pw: string): Promise<string | null> => {
        const label = pw === emailAddr ? "email-as-password" : "stored-credential";
        for (const timeoutMs of [20000, 45000]) {
          try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), timeoutMs);
            const lr = await fetch(`${EXT}/auth/login`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: emailAddr.trim().toLowerCase(), password: pw }),
              signal: ctrl.signal,
            });
            clearTimeout(timer);
            const ld = await lr.json().catch(() => null);
            console.log(`[ResetPassword] Login attempt (${label}, ${timeoutMs}ms):`, lr.status, JSON.stringify(ld)?.substring(0, 120));
            if (lr.ok && (ld?.token || ld?.access_token)) return ld.token || ld.access_token;
            if (!lr.ok) break; // Wrong password — no point retrying with longer timeout
          } catch (e: any) {
            if (e?.name === "AbortError") {
              console.warn(`[ResetPassword] Login attempt (${label}) timed out after ${timeoutMs}ms — retrying`);
              continue;
            }
            throw e;
          }
        }
        return null;
      };

      let authToken: string | null = null;
      let usedPassword: string | null = null;
      for (const pw of tryPasswords) {
        const tok = await tryLogin(email, pw);
        if (tok) { authToken = tok; usedPassword = pw; break; }
      }

      if (!authToken) {
        // We could not authenticate to the external backend — the password cannot be changed.
        // This typically means the user's current password is unknown (never logged in via our proxy,
        // or logged in via Google with a non-email password). The reset link itself is valid; the
        // limitation is that we have no way to authenticate on their behalf.
        console.error(`[ResetPassword] Cannot authenticate to external backend for ${email} — aborting reset`);
        // Re-open the token so the user can try again (un-mark it as used)
        await pool.query("UPDATE password_reset_tokens SET used_at = NULL WHERE token = $1 AND used_at IS NOT NULL", [token]);
        return res.status(500).json({
          error: "Password reset could not be completed. Please sign in with Google if your account was created that way, or contact support at support@ermate.in.",
          code: "AUTH_FAILED",
        });
      }

      // Authenticated — now change the password on the external backend
      const cpRes = await fetch(`${EXT}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${authToken}` },
        body: JSON.stringify({ current_password: usedPassword, new_password: newPassword }),
      });
      if (!cpRes.ok) {
        const cpErr = await cpRes.text().catch(() => "");
        console.error("[ResetPassword] change-password failed:", cpRes.status, cpErr);
        await pool.query("UPDATE password_reset_tokens SET used_at = NULL WHERE token = $1 AND used_at IS NOT NULL", [token]);
        return res.status(500).json({
          error: "Password reset failed. Please try again or contact support at support@ermate.in.",
          code: "CHANGE_FAILED",
        });
      }

      // Cache new credentials in auth_sessions so future logins/resets work
      const { enc, iv: newIv, tag: newTag } = encryptPassword(newPassword);
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
      await pool.query("DELETE FROM auth_sessions WHERE email = $1", [email.toLowerCase()]);
      await pool.query(
        `INSERT INTO auth_sessions (user_id, email, encrypted_password, iv, tag, expires_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        ["", email.toLowerCase(), enc, newIv, newTag, expiresAt]
      );

      console.log(`[ResetPassword] Password reset successfully for ${email}`);
      return res.json({ success: true, message: "Password reset successfully. You can now sign in with your new password." });
    } catch (error) {
      console.error("[Reset Password] Error:", error);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  // ─── User profile (role: consultant / resident / doctor) ─────────────────
  app.get("/api/profile", async (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || (req.headers["x-user-id"] as string);
      if (!userId) return res.status(400).json({ error: "userId required" });
      const pool = getPool();
      if (!pool) return res.status(503).json({ error: "Database unavailable" });
      const result = await pool.query(
        "SELECT role FROM user_profiles WHERE user_id = $1",
        [userId]
      );
      const role = result.rows[0]?.role || "doctor";
      return res.json({ role });
    } catch (err) {
      console.error("[Profile GET] Error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/profile", async (req: Request, res: Response) => {
    try {
      const { userId, role } = req.body as { userId?: string; role?: string };
      if (!userId || !role) return res.status(400).json({ error: "userId and role required" });
      const validRoles = ["consultant", "resident", "doctor", "hod"];
      if (!validRoles.includes(role)) return res.status(400).json({ error: "Invalid role" });
      const pool = getPool();
      if (!pool) return res.status(503).json({ error: "Database unavailable" });
      await pool.query(
        `INSERT INTO user_profiles (user_id, role, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) DO UPDATE SET role = $2, updated_at = CURRENT_TIMESTAMP`,
        [userId, role]
      );
      return res.json({ success: true, role });
    } catch (err) {
      console.error("[Profile PUT] Error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  // ─── Silent re-authentication session management ──────────────────────────
  // Store encrypted credentials server-side so the app can silently re-login
  // when the external backend token expires. Password never leaves the server
  // in plaintext — only the non-sensitive session_token is sent to the client.

  app.post("/api/auth/store-creds", async (req: Request, res: Response) => {
    try {
      const { email, password, userId } = req.body as { email?: string; password?: string; userId?: string };
      if (!email || !password) {
        return res.status(400).json({ error: "email and password are required" });
      }
      const pool = getPool();
      if (!pool) return res.status(503).json({ error: "Database unavailable" });

      const { enc, iv, tag } = encryptPassword(password);
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

      // Remove any existing sessions for this email
      await pool.query("DELETE FROM auth_sessions WHERE email = $1", [email]);

      const result = await pool.query(
        `INSERT INTO auth_sessions (user_id, email, encrypted_password, iv, tag, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [userId || null, email, enc, iv, tag, expiresAt]
      );

      const sessionToken = result.rows[0]?.id;
      console.log(`[StoreCreds] Session stored for ${email}`);
      return res.json({ session_token: sessionToken });
    } catch (error) {
      console.error("[StoreCreds] Error:", error);
      return res.status(500).json({ error: "Failed to store session" });
    }
  });

  app.post("/api/auth/silent-refresh", async (req: Request, res: Response) => {
    try {
      const { session_token } = req.body as { session_token?: string };
      if (!session_token) {
        return res.status(400).json({ error: "session_token is required" });
      }
      const pool = getPool();
      if (!pool) return res.status(503).json({ error: "Database unavailable" });

      const result = await pool.query(
        "SELECT * FROM auth_sessions WHERE id = $1",
        [session_token]
      );
      const session = result.rows[0];
      if (!session) return res.status(404).json({ error: "Session not found" });
      if (new Date() > new Date(session.expires_at)) {
        await pool.query("DELETE FROM auth_sessions WHERE id = $1", [session_token]);
        return res.status(401).json({ error: "Session expired — please log in again" });
      }

      const password = decryptPassword(session.encrypted_password, session.iv, session.tag);
      const EXT = process.env.EXPO_PUBLIC_EXTERNAL_API_URL || "https://er-emr-backend.onrender.com/api";
      const loginRes = await fetch(`${EXT}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: session.email, password }),
      });

      if (!loginRes.ok) {
        console.warn(`[SilentRefresh] External login failed with ${loginRes.status} for ${session.email}`);
        return res.status(401).json({ error: "Re-authentication failed — please log in again" });
      }

      const data = await loginRes.json();
      if (!data.access_token) {
        return res.status(401).json({ error: "No token returned from server" });
      }

      console.log(`[SilentRefresh] Token refreshed silently for ${session.email}`);
      return res.json({ access_token: data.access_token, refresh_token: data.refresh_token });
    } catch (error) {
      console.error("[SilentRefresh] Error:", error);
      return res.status(500).json({ error: "Silent refresh failed" });
    }
  });

  app.post("/api/export/handover-pdf", async (req: Request, res: Response) => {
    try {
      const { cases, doctorName, receivingDoctor, shiftDate, shiftTime } = req.body as {
        cases: Array<{ caseData: any; bed: string; pendingPlan: string }>;
        doctorName: string;
        receivingDoctor?: string;
        shiftDate: string;
        shiftTime: string;
      };

      if (!cases || !Array.isArray(cases) || cases.length === 0) {
        return res.status(400).json({ error: "No cases provided" });
      }

      const { default: PDFDoc } = await import("pdfkit");
      const doc = new PDFDoc({
        size: "A4",
        layout: "landscape",
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => {
        const buf = Buffer.concat(chunks);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="handover_${shiftDate.replace(/\//g, "-")}.pdf"`);
        res.send(buf);
      });

      const nv = (v: any, d = "—") => {
        if (v === undefined || v === null || v === "") return d;
        if (Array.isArray(v)) return v.filter(Boolean).join(", ") || d;
        return String(v);
      };

      // ── Colour palette ───────────────────────────────────────────────────
      const DARK = "#0D1117";
      const GREEN = "#1DB870";
      const GRAY = "#6B7280";
      const BORDER = "#D1D5DB";
      const P_COLORS: Record<number, string> = {
        1: "#EF4444", 2: "#F97316", 3: "#EAB308", 4: "#22C55E", 5: "#3B82F6",
      };
      const P_LABELS: Record<number, string> = {
        1: "P1 Red", 2: "P2 Orange", 3: "P3 Yellow", 4: "P4 Green", 5: "P5 Blue",
      };

      // ── Layout constants ────────────────────────────────────────────────
      const PW = 841.89;
      const PH = 595.28;
      const ML = 14;
      const MR = 14;
      const tableW = PW - ML - MR;   // 813.89

      // 8 columns: Bed | Patient | Complaint | Diagnosis | Vitals | Ix | Treatment | Pending
      const COLS = [
        { label: "Bed",                     w: 60  },
        { label: "Patient",                 w: 88  },
        { label: "Complaint / Summary",     w: 100 },
        { label: "Provisional Diagnosis",   w: 108 },
        { label: "Initial Vitals + VBG/ECG",w: 95  },
        { label: "Key Investigations",      w: 102 },
        { label: "Treatment / Consults",    w: 110 },
        { label: "Pending / Plan",          w: 150.89 },
      ];

      const HDR_BAND = 52;   // dark top banner
      const COL_HDR  = 18;   // column label row
      const ROW_H    = 68;
      const LEGEND_H = 16;
      const FONT_H   = 6.8;
      const FONT_C   = 8;
      const FONT_SM  = 7;
      const PAD      = 5;

      // ── 1. Dark header band ──────────────────────────────────────────────
      doc.rect(0, 0, PW, HDR_BAND).fill(DARK);

      // Title left
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#FFFFFF")
        .text("EMERGENCY DOCTORS HANDOVER SHEET", ML, 10, { width: 360 });
      doc.fontSize(7.5).font("Helvetica").fillColor("rgba(255,255,255,0.45)")
        .text("ErMate · Varah Group · All times in IST", ML, 25);

      // Date/time right (green monospace simulation with Helvetica-Bold)
      const dateStr = `${shiftDate}  ·  ${shiftTime}`;
      doc.fontSize(10).font("Helvetica-Bold").fillColor(GREEN)
        .text(dateStr, PW - 320, 10, { width: 306, align: "right" });
      doc.fontSize(7.5).font("Helvetica").fillColor("rgba(255,255,255,0.55)")
        .text(`Handing over: ${doctorName}`, PW - 320, 27, { width: 306, align: "right" });
      doc.fontSize(7.5).font("Helvetica").fillColor("rgba(255,255,255,0.45)")
        .text(`Receiving: ${receivingDoctor || "________________"}`, PW - 320, 38, { width: 306, align: "right" });

      // ── 2. Column header row ─────────────────────────────────────────────
      const colY = HDR_BAND;
      doc.rect(0, colY, PW, COL_HDR).fill("#F1F3F1");
      doc.moveTo(0, colY + COL_HDR).lineTo(PW, colY + COL_HDR)
        .strokeColor(BORDER).lineWidth(1.2).stroke();

      let cx = ML;
      COLS.forEach((col, ci) => {
        if (ci > 0) {
          doc.moveTo(cx, colY).lineTo(cx, colY + COL_HDR)
            .strokeColor(BORDER).lineWidth(0.5).stroke();
        }
        doc.fontSize(FONT_H).font("Helvetica-Bold").fillColor("#4B5563")
          .text(col.label.toUpperCase(), cx + PAD, colY + 5, {
            width: col.w - PAD * 2,
            lineBreak: false,
          });
        cx += col.w;
      });

      // ── 3. Data rows ─────────────────────────────────────────────────────
      const tableTop = colY + COL_HDR;

      cases.forEach((entry, ri) => {
        const cd    = entry.caseData || {};
        const pat   = cd.patient || {};
        const vitals = cd.vitals_at_arrival || cd.triage?.vitals || {};
        const primary = cd.primary_assessment || cd.abcde || {};
        const tx    = cd.treatment || {};
        const inv   = cd.investigations || {};
        const complaint = cd.presenting_complaint?.text || cd.presenting_complaint || "";
        const invPanels = inv.panels_selected || inv.individual_tests || [];
        const priority = cd.triage_priority || 4;
        const pColor = P_COLORS[priority] || "#9CA3AF";

        // Cell 0: Bed
        const bedStr = entry.bed || "—";
        const pLabel = P_LABELS[priority] || `P${priority}`;

        // Cell 1: Patient
        const ageSex = [pat.age ? `${pat.age}y` : "", pat.sex].filter(Boolean).join(" · ");
        const status  = cd.status === "completed" || cd.status === "discharged" ? "Discharged" : "Active";

        // Cell 2: Complaint
        const complaintStr = nv(complaint);

        // Cell 3: Diagnosis
        const dxList: string[] = [];
        if (tx.primary_diagnosis) dxList.push(tx.primary_diagnosis);
        if (tx.provisional_diagnoses?.length) {
          tx.provisional_diagnoses.slice(0, 2).forEach((d: any) => {
            const t = typeof d === "string" ? d : d?.text || d?.diagnosis || "";
            if (t) dxList.push(t);
          });
        }
        const dxStr = dxList.join("\n") || "—";

        // Cell 4: Vitals
        const hr   = vitals.hr   || primary.circulation_hr    || "";
        const bps  = vitals.bp_systolic  && vitals.bp_diastolic ? `${vitals.bp_systolic}/${vitals.bp_diastolic}` : "";
        const spo2 = vitals.spo2 || primary.breathing_spo2    || "";
        const rr   = vitals.rr   || primary.breathing_rr      || "";
        const temp = vitals.temperature || primary.exposure_temperature || "";
        const grbs = vitals.grbs || primary.disability_grbs   || "";
        const gcsE = vitals.gcs_e || primary.disability_gcs_e || "";
        const gcsV = vitals.gcs_v || primary.disability_gcs_v || "";
        const gcsM = vitals.gcs_m || primary.disability_gcs_m || "";
        const gcsParts = [gcsE, gcsV, gcsM].filter(Boolean);
        const gcs = gcsParts.length === 3 ? `GCS ${gcsParts.join("+")}=${+gcsE + +gcsV + +gcsM}` : "";
        const vitalLines = [
          hr   ? `HR  ${hr} bpm` : "",
          bps  ? `BP  ${bps}` : "",
          spo2 ? `SpO2 ${spo2}%` : "",
          rr   ? `RR  ${rr}/min` : "",
          temp ? `Temp ${temp}` : "",
          grbs ? `GRBS ${grbs}` : "",
          gcs,
        ].filter(Boolean);

        // Cell 5: Investigations
        const invLines: string[] = [];
        if (Array.isArray(invPanels) && invPanels.length) {
          invPanels.slice(0, 3).forEach((p: any) => invLines.push(String(p)));
        }
        const labR = inv.lab_results || inv.other_tests;
        if (labR && invLines.length === 0) invLines.push(String(labR).slice(0, 60));
        if (invLines.length === 0) invLines.push("—");

        // Cell 6: Treatment
        const medLines: string[] = [];
        if (tx.medications?.length) {
          tx.medications.slice(0, 4).forEach((m: any) => {
            const n = typeof m === "string" ? m : m?.drug || m?.name || "";
            if (n) medLines.push(n);
          });
        }
        const consults = [tx.consults].flat().filter(Boolean).join(", ") || tx.consultation || "";
        if (consults) medLines.push(`Consult: ${consults}`);
        if (medLines.length === 0) medLines.push("—");

        // Cell 7: Pending/Plan
        const pendingStr = entry.pendingPlan || "—";

        const rowY = tableTop + ri * ROW_H;
        const isEven = ri % 2 === 0;

        // row background
        doc.rect(ML, rowY, tableW, ROW_H).fill(isEven ? "#FAFCFA" : "#FFFFFF");

        // priority color strip (4px)
        doc.rect(ML, rowY, 4, ROW_H).fill(pColor);

        // horizontal border
        doc.moveTo(ML, rowY + ROW_H).lineTo(ML + tableW, rowY + ROW_H)
          .strokeColor("#EFEFEF").lineWidth(0.5).stroke();

        // Draw cells
        cx = ML;

        // -- Col 0: Bed --
        const bedColW = COLS[0].w;
        doc.fontSize(12).font("Helvetica-Bold").fillColor(DARK)
          .text(bedStr, cx + PAD + 4, rowY + 8, { width: bedColW - PAD * 2 - 4 });
        // Priority badge
        const badgeTxt = pLabel;
        const badgeX = cx + PAD + 4;
        const badgeY = rowY + 28;
        const badgeW = bedColW - PAD * 2 - 6;
        const badgeH = 12;
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 3)
          .fill(`${pColor}22`);
        doc.fontSize(FONT_SM - 0.5).font("Helvetica-Bold").fillColor(pColor)
          .text(badgeTxt, badgeX, badgeY + 3, { width: badgeW, align: "center", lineBreak: false });
        cx += bedColW;

        // -- Col 1: Patient --
        if (cx > ML) {
          doc.moveTo(cx, rowY).lineTo(cx, rowY + ROW_H)
            .strokeColor("#F0F0F0").lineWidth(0.5).stroke();
        }
        const patColW = COLS[1].w;
        doc.fontSize(FONT_C - 0.5).font("Helvetica-Bold").fillColor(DARK)
          .text(pat.name || "Unknown", cx + PAD, rowY + PAD + 2, { width: patColW - PAD * 2 });
        doc.fontSize(FONT_SM).font("Helvetica").fillColor(GRAY)
          .text(ageSex, cx + PAD, rowY + PAD + 15, { width: patColW - PAD * 2 });
        doc.fontSize(FONT_SM - 0.5).font("Helvetica").fillColor(GRAY)
          .text(status, cx + PAD, rowY + PAD + 26, { width: patColW - PAD * 2 });
        cx += patColW;

        // -- Remaining 6 cols --
        const cellData = [
          { text: complaintStr, maxH: ROW_H - PAD * 2 },
          { text: dxStr,        maxH: ROW_H - PAD * 2 },
          { text: vitalLines.join("\n"), maxH: ROW_H - PAD * 2 },
          { text: invLines.join("\n"),   maxH: ROW_H - PAD * 2 },
          { text: medLines.join("\n"),   maxH: ROW_H - PAD * 2 },
          { text: pendingStr,            maxH: ROW_H - PAD * 2 },
        ];

        cellData.forEach((cell, ci) => {
          const col = COLS[ci + 2];
          doc.moveTo(cx, rowY).lineTo(cx, rowY + ROW_H)
            .strokeColor("#F0F0F0").lineWidth(0.5).stroke();

          // Pending/Plan col gets arrow prefix on each line
          let rendered = cell.text;
          if (ci === 5 && rendered !== "—") {
            rendered = rendered.split("\n").map((l) => `> ${l}`).join("\n");
          }

          doc.fontSize(FONT_C).font("Helvetica").fillColor("#374151")
            .text(rendered, cx + PAD, rowY + PAD + 2, {
              width: col.w - PAD * 2,
              height: cell.maxH,
              lineBreak: true,
              ellipsis: true,
            });
          cx += col.w;
        });
      });

      // ── 4. Outer table border ─────────────────────────────────────────────
      const totalDataH = cases.length * ROW_H;
      doc.rect(ML, tableTop, tableW, totalDataH)
        .strokeColor(BORDER).lineWidth(0.8).stroke();

      // ── 5. Legend row ─────────────────────────────────────────────────────
      const legendY = tableTop + totalDataH;
      doc.rect(0, legendY, PW, LEGEND_H).fill("#FFFFFF");
      doc.moveTo(0, legendY).lineTo(PW, legendY)
        .strokeColor("#F0F0F0").lineWidth(0.8).stroke();

      let lx = ML + 2;
      doc.fontSize(6.5).font("Helvetica-Bold").fillColor(GRAY)
        .text("PRIORITY:", lx, legendY + 4, { lineBreak: false });
      lx += 42;

      const legendItems = [
        { label: "P1 Red — Immediate",    color: "#EF4444" },
        { label: "P2 Orange — Urgent",    color: "#F97316" },
        { label: "P3 Yellow — Semi-urgent",color: "#EAB308" },
        { label: "P4 Green — Non-urgent", color: "#22C55E" },
        { label: "P5 Blue — Review",      color: "#3B82F6" },
      ];
      legendItems.forEach((item) => {
        doc.roundedRect(lx, legendY + 4, 8, 8, 1.5).fill(item.color);
        doc.fontSize(6.5).font("Helvetica").fillColor("#4B5563")
          .text(item.label, lx + 11, legendY + 4.5, { lineBreak: false });
        lx += 92;
      });

      // Right side legend key
      doc.fontSize(6.5).font("Helvetica").fillColor(GRAY)
        .text("Pending  ·  Done  ·  Consult  ·  Urgent action", PW - 200, legendY + 4, { width: 186, align: "right" });

      // ── 6. Footer strip ───────────────────────────────────────────────────
      const footerY = legendY + LEGEND_H;
      const footerH = PH - footerY;
      if (footerH > 0) {
        doc.rect(0, footerY, PW, footerH).fill("#F9FAF9");
        doc.moveTo(0, footerY).lineTo(PW, footerY)
          .strokeColor(BORDER).lineWidth(1).stroke();

        // Left: generated info
        doc.fontSize(7).font("Helvetica").fillColor(GRAY)
          .text(
            `Generated by ErMate  ·  ${cases.length} active case${cases.length !== 1 ? "s" : ""}  ·  ${shiftDate} ${shiftTime} IST`,
            ML, footerY + 6
          );
        doc.fontSize(7).font("Helvetica").fillColor(GRAY)
          .text(`Handing over: ${doctorName}  ·  Department: Emergency Medicine`, ML, footerY + 16);
        doc.fontSize(6.5).font("Helvetica").fillColor("#9CA3AF")
          .text("This document is confidential. For clinical handover use only.", ML, footerY + 26);

        // Signature blocks — right side
        const sigW = 130;
        const sig1X = PW - MR - sigW * 2 - 24;
        const sig2X = PW - MR - sigW;
        const sigLineY = footerY + (footerH > 35 ? footerH - 14 : 6);

        doc.moveTo(sig1X, sigLineY).lineTo(sig1X + sigW, sigLineY)
          .strokeColor(BORDER).lineWidth(0.8).stroke();
        doc.fontSize(6.5).font("Helvetica").fillColor(GRAY)
          .text("HANDING OVER DOCTOR", sig1X, sigLineY + 3, { width: sigW, align: "center" });

        doc.moveTo(sig2X, sigLineY).lineTo(sig2X + sigW, sigLineY)
          .strokeColor(BORDER).lineWidth(0.8).stroke();
        doc.fontSize(6.5).font("Helvetica").fillColor(GRAY)
          .text("RECEIVING DOCTOR", sig2X, sigLineY + 3, { width: sigW, align: "center" });
      }

      doc.end();
    } catch (error) {
      console.error("[HANDOVER] PDF error:", error);
      res.status(500).json({ error: "Failed to generate handover PDF" });
    }
  });

  app.post("/api/export/discharge-pdf", async (req: Request, res: Response) => {
    try {
      const data: DischargeSummaryData = req.body;
      
      if (!data.patient || !data.discharge_summary) {
        return res.status(400).json({ error: "Missing patient or discharge summary data" });
      }

      const ds = data.discharge_summary;
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 40, bottom: 40, left: 50, right: 50 },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
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

  app.post("/api/export/discharge-docx", async (req: Request, res: Response) => {
    try {
      const data: DischargeSummaryData = req.body;
      
      if (!data.patient || !data.discharge_summary) {
        return res.status(400).json({ error: "Missing patient or discharge summary data" });
      }

      const ds = data.discharge_summary;
      const children: Paragraph[] = [];

      children.push(
        new Paragraph({
          text: "DISCHARGE SUMMARY",
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }),
        new Paragraph({
          text: "Emergency Department",
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        })
      );

      children.push(
        new Paragraph({
          text: "PATIENT INFORMATION",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
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
          spacing: { before: 300, after: 100 },
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
          spacing: { before: 300, after: 100 },
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
            spacing: { before: 300, after: 100 },
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
            spacing: { before: 300, after: 100 },
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
          spacing: { before: 200 },
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
            new TextRun({ text: `ED Consultant: ${ds.ed_consultant || "_________________"}` }),
          ],
          spacing: { before: 400 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Sign and Time: ${ds.sign_time_resident || "_________________"}` }),
            new TextRun({ text: "     |     " }),
            new TextRun({ text: `Sign and Time: ${ds.sign_time_consultant || "_________________"}` }),
          ],
          spacing: { before: 100 },
        }),
        new Paragraph({ text: `Date: ${ds.discharge_date || formatDate()}`, spacing: { before: 100, after: 300 } })
      );

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "This discharge summary provides clinical information meant to facilitate continuity of patient care. For statutory purposes, a treatment/discharge certificate shall be issued on request. For a disability certificate, approach a Government-constituted Medical Board.",
              italics: true,
              size: 18,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200 },
        })
      );

      const docxDoc = new Document({
        sections: [
          {
            properties: {},
            children,
          },
        ],
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

  app.post("/api/export/casesheet-pdf", async (req: Request, res: Response) => {
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

      const nv = (val: any, dflt: string) => {
        if (val === undefined || val === null || val === "") return dflt;
        if (Array.isArray(val)) return val.length > 0 ? val.filter(Boolean).join(", ") : dflt;
        return String(val);
      };

      console.log("[EXPORT] PDF casesheet | isPediatric:", isPed);

      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(chunks);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="casesheet_${(data.patient?.name || "patient").replace(/\s+/g, "_")}.pdf"`);
        res.send(pdfBuffer);
      });

      const pdfLine = () => { doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke(); };
      const pdfHeading = (t: string) => {
        doc.moveDown(0.3);
        doc.fontSize(11).font("Helvetica-Bold").text(t.toUpperCase());
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.2);
        doc.fontSize(10).font("Helvetica");
      };
      const pdfSubHeading = (t: string) => { doc.moveDown(0.15); doc.fontSize(10).font("Helvetica-Bold").text(t); doc.font("Helvetica"); };
      const pdfField = (label: string, val: any, dflt: string = "") => {
        const display = (val !== undefined && val !== null && val !== "") ? String(val) : dflt;
        if (display !== "") doc.text(`${label}: ${display}`);
      };
      const pdfAlways = (label: string, val: any, dflt: string) => {
        const display = (val !== undefined && val !== null && val !== "") ? String(val) : dflt;
        doc.text(`${label}: ${display}`);
      };
      const ensureSpace = (needed = 80) => { if (doc.y > 750 - needed) doc.addPage(); };

      // ─── HEADER ───────────────────────────────────────────────────────────────
      doc.fontSize(16).font("Helvetica-Bold").text("EMERGENCY DEPARTMENT CASE SHEET", { align: "center" });
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica").text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, { align: "center" });
      doc.moveDown(0.4);
      pdfLine();

      // ─── PATIENT INFORMATION ──────────────────────────────────────────────────
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

      // ─── VITALS AT ARRIVAL ────────────────────────────────────────────────────
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
      const vGCST = vitals.gcs_total || vitals.gcs || (vGCSE || vGCSV || vGCSM ? `${(parseInt(vGCSE)||0)+(parseInt(vGCSV)||0)+(parseInt(vGCSM)||0)}` : "");
      const vPain = vitals.pain_score || "";
      const vGRBS = vitals.grbs || vitals.glucose || "";
      doc.text(`HR: ${vHR || "—"} bpm    BP: ${vBPS && vBPD ? vBPS+"/"+vBPD : vBPS || "—"} mmHg    RR: ${vRR || "—"} /min    SpO2: ${vSpO2 || "—"}%`);
      doc.text(`Temp: ${vTemp || "—"} °F    GCS: ${vGCST || "—"} (E${vGCSE||"—"}V${vGCSV||"—"}M${vGCSM||"—"})    Pain: ${vPain || "—"}/10    GRBS: ${vGRBS || "—"} mg/dL`);
      doc.moveDown(0.3);

      // ─── PRIMARY ASSESSMENT (ABCDE) ───────────────────────────────────────────
      ensureSpace();
      pdfHeading("PRIMARY ASSESSMENT (ABCDE)");

      if (isPed) {
        pdfSubHeading("Pediatric Assessment Triangle (PAT)");
        const appearance = pat.appearance || {};
        doc.text(`Appearance — Tone: ${nv(appearance.tone || pat.tone, "Normal")}, Interactivity: ${nv(appearance.interactivity || pat.interactivity, "Normal")}, Consolability: ${nv(appearance.consolability || pat.consolability, "Normal")}, Look/Gaze: ${nv(appearance.lookGaze || pat.lookGaze, "Normal")}, Speech/Cry: ${nv(appearance.speechCry || pat.speechCry, "Normal")}`);
        doc.text(`Work of Breathing: ${nv(pat.workOfBreathing, "Normal")}    Circulation to Skin: ${nv(pat.circulationToSkin, "Normal")}`);
        doc.moveDown(0.15);
      }

      pdfSubHeading("A — Airway");
      const airwayStatus = airway.status || primary.airway_status;
      const airwayInterventions = airway.interventions || primary.airway_interventions || airway.intervention;
      pdfAlways("Status", airwayStatus, "Patent");
      pdfAlways("Interventions", airwayInterventions ? (Array.isArray(airwayInterventions) ? airwayInterventions.join(", ") : airwayInterventions) : "", "None required");
      if (airway.cry) pdfField("Cry", airway.cry);
      pdfField("Notes", airway.notes || primary.airway_additional_notes);

      pdfSubHeading("B — Breathing");
      const bRR = breathing.rr || breathing.respiratoryRate || primary.breathing_rr;
      const bSpO2 = breathing.spo2 || primary.breathing_spo2;
      const bEffort = breathing.effort || breathing.workOfBreathing || primary.breathing_work;
      doc.text(`RR: ${nv(bRR, vRR || "Normal")}    SpO2: ${nv(bSpO2, vSpO2 ? vSpO2+"%" : "Normal")}    Effort: ${nv(bEffort, "Normal")}`);
      pdfAlways("Air Entry", breathing.airEntry, "Equal bilateral air entry");
      pdfAlways("Chest Expansion", breathing.chestExpansion, "Equal");
      pdfAlways("Added Sounds", breathing.addedSounds, "None");
      if (breathing.o2Device || primary.breathing_oxygen_device) doc.text(`O2 Device: ${breathing.o2Device || primary.breathing_oxygen_device}${(breathing.o2Flow || primary.breathing_oxygen_flow) ? " @ "+(breathing.o2Flow || primary.breathing_oxygen_flow)+" L/min" : ""}`);
      if (breathing.intervention) pdfField("Interventions", Array.isArray(breathing.intervention) ? breathing.intervention.join(", ") : breathing.intervention);
      pdfField("Notes", breathing.notes || primary.breathing_additional_notes);

      pdfSubHeading("C — Circulation");
      const cHR = circulation.hr || circulation.heartRate || primary.circulation_hr;
      const cBPS = circulation.bpSystolic || primary.circulation_bp_systolic || circulation.bloodPressure;
      const cBPD = circulation.bpDiastolic || primary.circulation_bp_diastolic;
      const cCRT = circulation.capillaryRefill || circulation.crt || primary.circulation_crt;
      doc.text(`HR: ${nv(cHR, vHR || "Normal")}    BP: ${cBPS && cBPD ? cBPS+"/"+cBPD : (cBPS || (vBPS && vBPD ? vBPS+"/"+vBPD : "Normal"))}    CRT: ${nv(cCRT, "<2 sec")}`);
      pdfAlways("Pulse Quality", circulation.pulseQuality || circulation.pulses, "Normal volume, regular");
      pdfAlways("Skin Color/Temp", circulation.skinColorTemp, "Normal color, warm peripheries");
      if (circulation.distendedNeckVeins) pdfField("Neck Veins", circulation.distendedNeckVeins);
      const cAdj = circulation.interventions || primary.circulation_adjuncts || circulation.intervention;
      pdfAlways("IV Access", cAdj ? (Array.isArray(cAdj) ? cAdj.join(", ") : cAdj) : (circulation.ivAccess || ""), "Not established");
      pdfField("Notes", circulation.notes || primary.circulation_additional_notes);

      pdfSubHeading("D — Disability");
      const dAVPU = disability.motorResponse || disability.avpuGcs || primary.disability_avpu;
      const dGE = disability.gcsE || primary.disability_gcs_e || vGCSE;
      const dGV = disability.gcsV || primary.disability_gcs_v || vGCSV;
      const dGM = disability.gcsM || primary.disability_gcs_m || vGCSM;
      const dPupilSize = disability.pupilSize || disability.pupils || primary.disability_pupils_size;
      const dPupilReact = disability.pupilReaction || primary.disability_pupils_reaction;
      const dGlucose = disability.glucose || primary.disability_grbs || vGRBS;
      const dGCSStr = (dGE || dGV || dGM) ? `${(parseInt(dGE)||0)+(parseInt(dGV)||0)+(parseInt(dGM)||0)} (E${dGE||"—"}V${dGV||"—"}M${dGM||"—"})` : (vGCST ? vGCST : "15 (E4V5M6)");
      pdfAlways("AVPU", dAVPU, "Alert");
      doc.text(`GCS: ${dGCSStr}`);
      doc.text(`Pupils: ${nv(dPupilSize, "Equal, 3 mm")} — Reaction: ${nv(dPupilReact, "Briskly reactive bilaterally")}`);
      pdfAlways("Blood Glucose", dGlucose, "Normal");
      if (disability.abnormalResponses) pdfField("Abnormal Responses", disability.abnormalResponses);
      pdfField("Notes", disability.notes || primary.disability_additional_notes);

      pdfSubHeading("E — Exposure");
      const eTemp = exposure.temperature || primary.exposure_temperature;
      pdfAlways("Temperature", eTemp, vTemp || "Normal");
      pdfAlways("Trauma", exposure.trauma, "None");
      pdfAlways("Signs of Trauma/Illness", exposure.signsOfTraumaIllness ? (Array.isArray(exposure.signsOfTraumaIllness) ? exposure.signsOfTraumaIllness.join(", ") : exposure.signsOfTraumaIllness) : "", "None detected");
      if (exposure.evidenceOfInfection) pdfField("Evidence of Infection", exposure.evidenceOfInfection);
      if (exposure.longBoneDeformities) pdfField("Long Bone Deformities", exposure.longBoneDeformities);
      if (isPed && Object.keys(efast).length > 0) {
        doc.text(`EFAST — Heart: ${nv(efast.heart, "Normal")}, Abdomen: ${nv(efast.abdomen, "Normal")}, Lungs: ${nv(efast.lungs, "Normal")}, Pelvis: ${nv(efast.pelvis, "Normal")}`);
      }
      pdfField("Notes", exposure.notes || primary.exposure_additional_notes);
      doc.moveDown(0.3);

      // ─── ADJUNCTS ─────────────────────────────────────────────────────────────
      ensureSpace();
      pdfHeading("ADJUNCTS TO PRIMARY SURVEY");
      pdfAlways("ECG", adjuncts.ecg_findings || adjuncts.ecg_status, "Not done");
      pdfAlways("Bedside Echo", adjuncts.bedside_echo, "Not done");
      if (adjuncts.efast_status || adjuncts.efast_notes) {
        doc.text(`EFAST: ${adjuncts.efast_status || ""}${adjuncts.efast_notes ? " - "+adjuncts.efast_notes : ""}`);
      } else {
        doc.text("EFAST: Not done");
      }
      pdfField("ABG/VBG Notes", adjuncts.additional_notes);
      if (Object.keys(abgData).length > 0) {
        pdfSubHeading("ABG Values");
        const abgParts: string[] = [];
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

      // ─── HISTORY ──────────────────────────────────────────────────────────────
      ensureSpace();
      if (isPed) {
        pdfHeading("SAMPLE HISTORY (PEDIATRIC)");
        const signsObj = history.signsAndSymptoms || {};
        const signsText = history.signs_and_symptoms || "";
        if (Object.keys(signsObj).length > 0) {
          const sParts: string[] = [];
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

      // ─── PHYSICAL EXAMINATION ─────────────────────────────────────────────────
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
        const genFindings: string[] = [];
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
        pdfAlways("Higher Mental Functions", exam.cns_higher_mental_functions, "Intact — oriented to time, place and person");
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

      // ─── INVESTIGATIONS ───────────────────────────────────────────────────────
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

      // ─── TREATMENT ────────────────────────────────────────────────────────────
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
        treatment.medications.forEach((med: any) => {
          doc.text(`  - ${(med.name || med.drug_name || "")} ${med.dose || ""} ${med.route || ""} ${med.frequency || ""}`.trim());
        });
      } else {
        doc.text("Medications: None prescribed");
      }
      if (Array.isArray(treatment.infusions) && treatment.infusions.length > 0) {
        pdfSubHeading("Infusions:");
        treatment.infusions.forEach((inf: any) => {
          doc.text(`  - ${(inf.name || inf.drug_name || inf.drug || "")} ${inf.dose || ""} in ${inf.dilution || ""} at ${inf.rate || ""}`.trim());
        });
      }
      pdfAlways("IV Fluids", treatment.fluids, "None");
      pdfField("Other Medications", treatment.other_medications);
      doc.moveDown(0.3);

      // ─── PROCEDURES ───────────────────────────────────────────────────────────
      ensureSpace();
      pdfHeading("PROCEDURES PERFORMED");
      if (Array.isArray(proceduresPerformed) && proceduresPerformed.length > 0) {
        proceduresPerformed.forEach((proc: any) => {
          if (typeof proc === "string") doc.text(`  - ${proc}`);
          else doc.text(`  - ${proc.name || "Procedure"}${proc.notes ? ": "+proc.notes : ""}`);
        });
      } else {
        doc.text("No procedures performed");
      }
      pdfField("General Notes", proceduresNotes);
      doc.moveDown(0.3);

      // ─── ER OBSERVATION ───────────────────────────────────────────────────────
      if (erObs.notes || erObs.duration) {
        ensureSpace();
        pdfHeading("ER OBSERVATION");
        pdfField("Duration", erObs.duration);
        pdfField("Notes", erObs.notes);
        doc.moveDown(0.3);
      }

      // ─── DISPOSITION ──────────────────────────────────────────────────────────
      ensureSpace();
      pdfHeading("DISPOSITION");
      pdfAlways("Type", disposition.type, "To be decided");
      pdfField("Admit To", disposition.admit_to || disposition.destination || disposition.department);
      pdfField("Room", disposition.admit_to_room);
      pdfField("Refer To", disposition.refer_to);
      pdfAlways("Condition at Discharge", disposition.condition_at_discharge || disposition.condition, "STABLE");
      pdfField("Notes", disposition.notes);
      doc.moveDown(0.3);

      // ─── MLC ──────────────────────────────────────────────────────────────────
      if (data.mlc && data.mlc_details) {
        ensureSpace();
        pdfHeading("MLC DETAILS");
        pdfField("Nature of Incident", data.mlc_details.nature);
        pdfField("Date/Time", data.mlc_details.datetime);
        pdfField("Place", data.mlc_details.place);
        pdfField("Informant", data.mlc_details.informant);
        doc.moveDown(0.3);
      }

      // ─── ADDENDUM ─────────────────────────────────────────────────────────────
      const addNotes = Array.isArray(addendumNotes) ? addendumNotes.filter(Boolean) : [];
      if (addNotes.length > 0) {
        ensureSpace();
        pdfHeading("ADDENDUM NOTES");
        addNotes.forEach((note: string, i: number) => doc.text(`${i + 1}. ${note}`));
        doc.moveDown(0.3);
      }

      // ─── CASE INFO ────────────────────────────────────────────────────────────
      ensureSpace(40);
      doc.moveDown(0.3);
      pdfLine();
      doc.moveDown(0.2);
      pdfField("Case Status", data.status);
      if (data.created_at) doc.text(`Created: ${new Date(data.created_at).toLocaleString("en-IN")}`);
      if (data.updated_at) doc.text(`Last Updated: ${new Date(data.updated_at).toLocaleString("en-IN")}`);

      // ─── FOOTER ───────────────────────────────────────────────────────────────
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

  app.post("/api/export/casesheet-docx", async (req: Request, res: Response) => {
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

      const nv = (val: any, dflt: string) => {
        if (val === undefined || val === null || val === "") return dflt;
        if (Array.isArray(val)) return val.length > 0 ? val.filter(Boolean).join(", ") : dflt;
        return String(val);
      };

      console.log("[EXPORT] DOCX casesheet | isPediatric:", isPed);

      const children: Paragraph[] = [];

      const dH = (t: string) => new Paragraph({ text: t.toUpperCase(), heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } });
      const dSH = (t: string) => new Paragraph({ children: [new TextRun({ text: t, bold: true, underline: {} })], spacing: { before: 120, after: 40 } });
      const dP = (t: string) => new Paragraph({ text: t, spacing: { after: 40 } });
      const dBold = (label: string, val: string) => new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun({ text: val })], spacing: { after: 40 } });
      const dField = (label: string, val: any) => { if (val !== undefined && val !== null && val !== "") children.push(dBold(label, String(val))); };
      const dAlways = (label: string, val: any, dflt: string) => children.push(dBold(label, nv(val, dflt)));

      // ─── HEADER ───────────────────────────────────────────────────────────────
      children.push(
        new Paragraph({ text: "EMERGENCY DEPARTMENT CASE SHEET", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 100 } }),
        new Paragraph({ text: `Generated: ${new Date().toLocaleDateString("en-IN")}`, alignment: AlignmentType.CENTER, spacing: { after: 300 } })
      );

      // ─── PATIENT INFORMATION ──────────────────────────────────────────────────
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

      // ─── VITALS AT ARRIVAL ────────────────────────────────────────────────────
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
      const vGCST = vitals.gcs_total || vitals.gcs || (vGCSE || vGCSV || vGCSM ? `${(parseInt(vGCSE)||0)+(parseInt(vGCSV)||0)+(parseInt(vGCSM)||0)}` : "");
      const vPain = vitals.pain_score || "";
      const vGRBS = vitals.grbs || vitals.glucose || "";
      children.push(dP(`HR: ${vHR || "—"} bpm    BP: ${vBPS && vBPD ? vBPS+"/"+vBPD : vBPS || "—"} mmHg    RR: ${vRR || "—"} /min    SpO2: ${vSpO2 || "—"}%`));
      children.push(dP(`Temp: ${vTemp || "—"} °F    GCS: ${vGCST || "—"} (E${vGCSE||"—"}V${vGCSV||"—"}M${vGCSM||"—"})    Pain: ${vPain || "—"}/10    GRBS: ${vGRBS || "—"} mg/dL`));

      // ─── PRIMARY ASSESSMENT (ABCDE) ───────────────────────────────────────────
      children.push(dH("PRIMARY ASSESSMENT (ABCDE)"));

      if (isPed) {
        children.push(dSH("Pediatric Assessment Triangle (PAT)"));
        const appearance = pat.appearance || {};
        children.push(dP(`Appearance — Tone: ${nv(appearance.tone || pat.tone, "Normal")}, Interactivity: ${nv(appearance.interactivity || pat.interactivity, "Normal")}, Consolability: ${nv(appearance.consolability || pat.consolability, "Normal")}, Look/Gaze: ${nv(appearance.lookGaze || pat.lookGaze, "Normal")}, Speech/Cry: ${nv(appearance.speechCry || pat.speechCry, "Normal")}`));
        children.push(dP(`Work of Breathing: ${nv(pat.workOfBreathing, "Normal")}    Circulation to Skin: ${nv(pat.circulationToSkin, "Normal")}`));
      }

      children.push(dSH("A — Airway"));
      const airwayStatus = airway.status || primary.airway_status;
      const airwayInterventions = airway.interventions || primary.airway_interventions || airway.intervention;
      dAlways("Status", airwayStatus, "Patent");
      dAlways("Interventions", airwayInterventions ? (Array.isArray(airwayInterventions) ? airwayInterventions.join(", ") : airwayInterventions) : "", "None required");
      dField("Cry", airway.cry);
      dField("Notes", airway.notes || primary.airway_additional_notes);

      children.push(dSH("B — Breathing"));
      const bRR = breathing.rr || breathing.respiratoryRate || primary.breathing_rr;
      const bSpO2 = breathing.spo2 || primary.breathing_spo2;
      const bEffort = breathing.effort || breathing.workOfBreathing || primary.breathing_work;
      children.push(dP(`RR: ${nv(bRR, vRR || "Normal")}    SpO2: ${nv(bSpO2, vSpO2 ? vSpO2+"%" : "Normal")}    Effort: ${nv(bEffort, "Normal")}`));
      dAlways("Air Entry", breathing.airEntry, "Equal bilateral air entry");
      dAlways("Chest Expansion", breathing.chestExpansion, "Equal");
      dAlways("Added Sounds", breathing.addedSounds, "None");
      if (breathing.o2Device || primary.breathing_oxygen_device) dField("O2 Device", (breathing.o2Device || primary.breathing_oxygen_device) + ((breathing.o2Flow || primary.breathing_oxygen_flow) ? " @ "+(breathing.o2Flow || primary.breathing_oxygen_flow)+" L/min" : ""));
      dField("Interventions", breathing.intervention ? (Array.isArray(breathing.intervention) ? breathing.intervention.join(", ") : breathing.intervention) : "");
      dField("Notes", breathing.notes || primary.breathing_additional_notes);

      children.push(dSH("C — Circulation"));
      const cHR = circulation.hr || circulation.heartRate || primary.circulation_hr;
      const cBPS = circulation.bpSystolic || primary.circulation_bp_systolic || circulation.bloodPressure;
      const cBPD = circulation.bpDiastolic || primary.circulation_bp_diastolic;
      const cCRT = circulation.capillaryRefill || circulation.crt || primary.circulation_crt;
      children.push(dP(`HR: ${nv(cHR, vHR || "Normal")}    BP: ${cBPS && cBPD ? cBPS+"/"+cBPD : (cBPS || (vBPS && vBPD ? vBPS+"/"+vBPD : "Normal"))}    CRT: ${nv(cCRT, "<2 sec")}`));
      dAlways("Pulse Quality", circulation.pulseQuality || circulation.pulses, "Normal volume, regular");
      dAlways("Skin Color/Temp", circulation.skinColorTemp, "Normal color, warm peripheries");
      dField("Neck Veins", circulation.distendedNeckVeins);
      const cAdj = circulation.interventions || primary.circulation_adjuncts || circulation.intervention;
      dAlways("IV Access", cAdj ? (Array.isArray(cAdj) ? cAdj.join(", ") : cAdj) : (circulation.ivAccess || ""), "Not established");
      dField("Notes", circulation.notes || primary.circulation_additional_notes);

      children.push(dSH("D — Disability"));
      const dAVPU = disability.motorResponse || disability.avpuGcs || primary.disability_avpu;
      const dGE = disability.gcsE || primary.disability_gcs_e || vGCSE;
      const dGV = disability.gcsV || primary.disability_gcs_v || vGCSV;
      const dGM = disability.gcsM || primary.disability_gcs_m || vGCSM;
      const dPupilSize = disability.pupilSize || disability.pupils || primary.disability_pupils_size;
      const dPupilReact = disability.pupilReaction || primary.disability_pupils_reaction;
      const dGlucose = disability.glucose || primary.disability_grbs || vGRBS;
      const dGCSStr = (dGE || dGV || dGM) ? `${(parseInt(dGE)||0)+(parseInt(dGV)||0)+(parseInt(dGM)||0)} (E${dGE||"—"}V${dGV||"—"}M${dGM||"—"})` : (vGCST ? vGCST : "15 (E4V5M6)");
      dAlways("AVPU", dAVPU, "Alert");
      children.push(dBold("GCS", dGCSStr));
      children.push(dP(`Pupils: ${nv(dPupilSize, "Equal, 3 mm")} — Reaction: ${nv(dPupilReact, "Briskly reactive bilaterally")}`));
      dAlways("Blood Glucose", dGlucose, "Normal");
      dField("Abnormal Responses", disability.abnormalResponses);
      dField("Notes", disability.notes || primary.disability_additional_notes);

      children.push(dSH("E — Exposure"));
      const eTemp = exposure.temperature || primary.exposure_temperature;
      dAlways("Temperature", eTemp, vTemp || "Normal");
      dAlways("Trauma", exposure.trauma, "None");
      dAlways("Signs of Trauma/Illness", exposure.signsOfTraumaIllness ? (Array.isArray(exposure.signsOfTraumaIllness) ? exposure.signsOfTraumaIllness.join(", ") : exposure.signsOfTraumaIllness) : "", "None detected");
      dField("Evidence of Infection", exposure.evidenceOfInfection);
      dField("Long Bone Deformities", exposure.longBoneDeformities);
      if (isPed && Object.keys(efast).length > 0) children.push(dP(`EFAST — Heart: ${nv(efast.heart, "Normal")}, Abdomen: ${nv(efast.abdomen, "Normal")}, Lungs: ${nv(efast.lungs, "Normal")}, Pelvis: ${nv(efast.pelvis, "Normal")}`));
      dField("Notes", exposure.notes || primary.exposure_additional_notes);

      // ─── ADJUNCTS ─────────────────────────────────────────────────────────────
      children.push(dH("ADJUNCTS TO PRIMARY SURVEY"));
      dAlways("ECG", adjuncts.ecg_findings || adjuncts.ecg_status, "Not done");
      dAlways("Bedside Echo", adjuncts.bedside_echo, "Not done");
      if (adjuncts.efast_status || adjuncts.efast_notes) {
        children.push(dBold("EFAST", `${adjuncts.efast_status || ""}${adjuncts.efast_notes ? " - "+adjuncts.efast_notes : ""}`));
      } else {
        children.push(dBold("EFAST", "Not done"));
      }
      dField("ABG/VBG Notes", adjuncts.additional_notes);
      if (Object.keys(abgData).length > 0) {
        const abgParts: string[] = [];
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

      // ─── HISTORY ──────────────────────────────────────────────────────────────
      if (isPed) {
        children.push(dH("SAMPLE HISTORY (PEDIATRIC)"));
        const signsObj = history.signsAndSymptoms || {};
        const signsText = history.signs_and_symptoms || "";
        if (Object.keys(signsObj).length > 0) {
          const sParts: string[] = [];
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

      // ─── PHYSICAL EXAMINATION ─────────────────────────────────────────────────
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
        const genFindings: string[] = [];
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
        dAlways("Higher Mental Functions", exam.cns_higher_mental_functions, "Intact — oriented to time, place and person");
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

      // ─── INVESTIGATIONS ───────────────────────────────────────────────────────
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

      // ─── TREATMENT ────────────────────────────────────────────────────────────
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
        treatment.medications.forEach((med: any) => {
          children.push(dP(`  - ${(med.name || med.drug_name || "")} ${med.dose || ""} ${med.route || ""} ${med.frequency || ""}`.trim()));
        });
      } else {
        children.push(dBold("Medications", "None prescribed"));
      }
      if (Array.isArray(treatment.infusions) && treatment.infusions.length > 0) {
        children.push(new Paragraph({ children: [new TextRun({ text: "Infusions:", bold: true })], spacing: { before: 80, after: 40 } }));
        treatment.infusions.forEach((inf: any) => {
          children.push(dP(`  - ${(inf.name || inf.drug_name || inf.drug || "")} ${inf.dose || ""} in ${inf.dilution || ""} at ${inf.rate || ""}`.trim()));
        });
      }
      dAlways("IV Fluids", treatment.fluids, "None");
      dField("Other Medications", treatment.other_medications);

      // ─── PROCEDURES ───────────────────────────────────────────────────────────
      children.push(dH("PROCEDURES PERFORMED"));
      if (Array.isArray(proceduresPerformed) && proceduresPerformed.length > 0) {
        proceduresPerformed.forEach((proc: any) => {
          if (typeof proc === "string") children.push(dP(`  - ${proc}`));
          else children.push(dP(`  - ${proc.name || "Procedure"}${proc.notes ? ": "+proc.notes : ""}`));
        });
      } else {
        children.push(dP("No procedures performed"));
      }
      dField("General Notes", proceduresNotes);

      // ─── ER OBSERVATION ───────────────────────────────────────────────────────
      if (erObs.notes || erObs.duration) {
        children.push(dH("ER OBSERVATION"));
        dField("Duration", erObs.duration);
        dField("Notes", erObs.notes);
      }

      // ─── DISPOSITION ──────────────────────────────────────────────────────────
      children.push(dH("DISPOSITION"));
      dAlways("Type", disposition.type, "To be decided");
      dField("Admit To", disposition.admit_to || disposition.destination || disposition.department);
      dField("Room", disposition.admit_to_room);
      dField("Refer To", disposition.refer_to);
      dAlways("Condition at Discharge", disposition.condition_at_discharge || disposition.condition, "STABLE");
      dField("Notes", disposition.notes);

      // ─── MLC ──────────────────────────────────────────────────────────────────
      if (data.mlc && data.mlc_details) {
        children.push(dH("MLC DETAILS"));
        dField("Nature of Incident", data.mlc_details.nature);
        dField("Date/Time", data.mlc_details.datetime);
        dField("Place", data.mlc_details.place);
        dField("Informant", data.mlc_details.informant);
      }

      // ─── ADDENDUM ─────────────────────────────────────────────────────────────
      const addNotes = Array.isArray(addendumNotes) ? addendumNotes.filter(Boolean) : [];
      if (addNotes.length > 0) {
        children.push(dH("ADDENDUM NOTES"));
        addNotes.forEach((note: string, i: number) => children.push(dP(`${i + 1}. ${note}`)));
      }

      // ─── CASE INFO ────────────────────────────────────────────────────────────
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

  app.post("/api/ai/interpret-abg", async (req: Request, res: Response) => {
    try {
      const { abg_values, patient_context, userId } = req.body;
      
      if (!abg_values) {
        return res.status(400).json({ error: "ABG values are required" });
      }
      const { interpretABG } = await import("./services/aiDiagnosis");
      const interpretation = await interpretABG(abg_values, patient_context);
      
      res.json({ interpretation });
    } catch (error) {
      console.error("ABG interpretation error:", error);
      res.status(500).json({ error: "Failed to interpret ABG values" });
    }
  });

  app.post("/api/ai/scan-abg", async (req: Request, res: Response) => {
    try {
      const { imageBase64, userId } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ error: "Image data is required" });
      }
      const { extractABGFromImage } = await import("./services/aiDiagnosis");
      const abgValues = await extractABGFromImage(imageBase64);
      
      res.json({ abgValues });
    } catch (error) {
      console.error("ABG scan error:", error);
      res.status(500).json({ error: "Failed to extract ABG values from image" });
    }
  });

  app.post("/api/ai/extract-from-image", async (req: Request, res: Response) => {
    try {
      const { imageBase64, patientContext, userId } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ error: "Image data is required" });
      }
      const { extractClinicalDataFromImage } = await import("./services/aiDiagnosis");
      const extractedData = await extractClinicalDataFromImage(imageBase64, patientContext);
      
      res.json({ extractedData });
    } catch (error) {
      console.error("Image extraction error:", error);
      res.status(500).json({ error: "Failed to extract data from image" });
    }
  });

  app.post("/api/ai/diagnose", async (req: Request, res: Response) => {
    try {
      const { chiefComplaint, vitals, history, examination, age, gender, abgData, treatmentData, userId } = req.body;
      
      if (!chiefComplaint) {
        return res.status(400).json({ error: "Chief complaint is required" });
      }
      let enhancedHistory = history || "";
      if (treatmentData) {
        const treatmentParts: string[] = [];
        if (treatmentData.medications?.length > 0) {
          const medsText = treatmentData.medications.map((m: any) => `${m.name || ""} ${m.dose || ""} ${m.route || ""} ${m.frequency || ""}`.trim()).filter(Boolean).join(", ");
          if (medsText) treatmentParts.push(`Medications administered: ${medsText}`);
        }
        if (treatmentData.fluids) treatmentParts.push(`IV Fluids: ${treatmentData.fluids}`);
        if (treatmentData.interventions) treatmentParts.push(`Other interventions: ${treatmentData.interventions}`);
        if (treatmentData.primaryDiagnosis) treatmentParts.push(`Working diagnosis: ${treatmentData.primaryDiagnosis}`);
        if (treatmentData.differentialDiagnoses) treatmentParts.push(`Differential diagnoses considered: ${treatmentData.differentialDiagnoses}`);
        if (treatmentParts.length > 0) {
          enhancedHistory = `${enhancedHistory}\n\nTreatment administered:\n${treatmentParts.join("\n")}`;
        }
      }

      const result = await generateDiagnosisSuggestions({
        chiefComplaint,
        vitals: vitals || {},
        history: enhancedHistory,
        examination: examination || "",
        age: age || 30,
        gender: gender || "Unknown",
        abgData: abgData || undefined,
      });

      res.json(result);
    } catch (error) {
      console.error("AI diagnosis error:", error);
      res.status(500).json({ error: "Failed to generate diagnosis suggestions" });
    }
  });

  app.post("/api/ai/feedback", async (req: Request, res: Response) => {
    try {
      const { suggestionId, caseId, feedbackType, userCorrection, suggestionText, userId } = req.body;
      
      if (!suggestionId || !feedbackType) {
        return res.status(400).json({ error: "Missing required fields (suggestionId, feedbackType)" });
      }

      // caseId is optional for chat feedback (case may not yet be committed)
      const resolvedCaseId = caseId?.trim() || "chat_session";

      const feedback: AIFeedback = {
        suggestionId,
        caseId: resolvedCaseId,
        feedbackType,
        userCorrection,
        suggestionText,
        userId,
        timestamp: new Date(),
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

  app.get("/api/ai/stats", async (_req: Request, res: Response) => {
    try {
      const stats = await getFeedbackStats();
      const insights = await getLearningInsights();
      res.json({ stats, insights });
    } catch (error) {
      console.error("Stats error:", error);
      res.status(500).json({ error: "Failed to get AI stats" });
    }
  });

  app.post("/api/ai/discharge-summary", async (req: Request, res: Response) => {
    try {
      const { case_id, summary_data, full_case } = req.body;

      if (!summary_data && !full_case) {
        return res.status(400).json({ error: "Summary data is required" });
      }

      // ── helpers ────────────────────────────────────────────────────────────
      const s = (v: any): string => {
        if (v == null) return "";
        if (Array.isArray(v)) return v.map((x: any) => (typeof x === "object" ? x.text || x.name || JSON.stringify(x) : String(x))).filter(Boolean).join(", ");
        if (typeof v === "object") return v.text || v.name || "";
        return String(v);
      };

      // Use full_case when available (preferred), else fall back to summary_data fields
      const fc = full_case || {};
      const sd = summary_data || {};

      // ── patient ────────────────────────────────────────────────────────────
      const pt = fc.patient || {};
      const patientName = s(pt.name) || s(pt.full_name) || "Unknown";
      const patientAge  = s(pt.age)  || s(sd.patient_age) || "Unknown";
      const patientSex  = s(pt.sex)  || s(pt.gender)      || s(sd.patient_sex) || "";
      const uhid        = s(pt.uhid) || s(pt.patient_id)  || "Not recorded";
      const mlcStatus   = fc.mlc ? "YES — MLC documented" : "No";
      const modeArrival = s(fc.mode_of_arrival) || "Not recorded";
      const arrivalDate = s(fc.arrival_date) || s(fc.created_at || "").split("T")[0] || "";
      const arrivalTime = s(fc.arrival_time) || "";
      const emResident  = s(fc.em_resident)  || s(sd.ed_resident)   || "";
      const emConsultant= s(fc.em_consultant)|| s(sd.ed_consultant) || "";

      // ── history / complaint ────────────────────────────────────────────────
      const hist = fc.history || {};
      const complaint   = s(fc.presenting_complaint?.text || fc.presenting_complaint) || s(sd.presenting_complaint) || "";
      const duration    = s(fc.presenting_complaint?.duration) || "";
      const onset       = s(fc.presenting_complaint?.onset_type) || "";
      const hpi         = s(hist.hpi || hist.events_hopi) || s(sd.history_of_present_illness) || "";
      const signsSymptoms = s(hist.signs_and_symptoms) || "";
      const pastMedical = Array.isArray(hist.past_medical) ? hist.past_medical.join(", ") : s(hist.past_medical) || s(sd.past_medical_history) || "Nil significant";
      const pastSurgical= s(hist.past_surgical) || "Nil";
      const allergies   = Array.isArray(hist.allergies) ? hist.allergies.join(", ") : s(hist.allergies) || s(sd.allergy) || "NKDA";
      const preMeds     = s(hist.medications || hist.drug_history) || "None";
      const familyHx    = s(hist.family_history) || s(sd.family_history) || "Not significant";
      const socialHx    = s(hist.social_history) || "Not recorded";

      // ── primary survey / vitals ────────────────────────────────────────────
      const ps  = fc.primary_survey  || {};
      const pa  = fc.primary_assessment || {};
      const sdV = (sd.vitals_arrival || {}) as Record<string, string>;

      const bp     = s(ps.bp_systolic && ps.bp_diastolic ? `${ps.bp_systolic}/${ps.bp_diastolic}` : "") || s(pa.circulation_bp_systolic && pa.circulation_bp_diastolic ? `${pa.circulation_bp_systolic}/${pa.circulation_bp_diastolic}` : "") || sdV.bp || "";
      const hr     = s(ps.heart_rate) || s(pa.circulation_hr) || sdV.hr || "";
      const rr     = s(ps.breathing_rate) || s(pa.breathing_rr) || sdV.rr || "";
      const spo2   = s(ps.spo2) || s(pa.breathing_spo2) || sdV.spo2 || "";
      const temp   = s(ps.temperature) || s(pa.exposure_temperature) || sdV.temp || "";
      const grbs   = s(ps.grbs) || s(pa.disability_grbs) || sdV.grbs || "";
      const gcsE   = s(ps.gcs_e) || s(pa.disability_gcs_e) || "";
      const gcsV   = s(ps.gcs_v) || s(pa.disability_gcs_v) || "";
      const gcsM   = s(ps.gcs_m) || s(pa.disability_gcs_m) || "";
      const gcsTot = s(ps.gcs_total) || s(pa.disability_gcs_total) || sdV.gcs || "";

      const airway         = s(ps.airway || ps.airway_status)         || s(pa.airway_status)  || s((sd.primary_assessment as any)?.airway)  || "Patent, self-maintained";
      const auscultation   = s(ps.auscultation)                       || s(pa.breathing_auscultation)                                    || "Air entry bilaterally equal and clear";
      const workBreathing  = s(ps.work_of_breathing)                  || s(pa.breathing_work_of_breathing)                               || "No accessory muscle use";
      const o2Device       = s(ps.oxygen_device)                      || s(pa.breathing_oxygen_device)                                   || "Room air";
      const crt            = s(ps.crt)                                || s(pa.circulation_crt)                                           || "< 2 seconds";
      const cvsFindings    = s(ps.cvs_findings)                       || s(pa.circulation_cvs)                                           || "";
      const ivAccess       = s(ps.iv_access)                          || s(pa.circulation_iv_access)                                     || "Not documented";
      const pupils         = s(ps.pupils)                             || s(pa.disability_pupils)                                         || "Bilaterally equal and reactive";
      const power          = s(ps.power)                              || s(pa.disability_power)                                          || "5/5 all four limbs";
      const focalDeficit   = s(ps.focal_deficit)                      || s(pa.disability_focal_deficit)                                  || "None";
      const exposure       = s(ps.exposure_findings)                  || s(pa.exposure_findings)                                         || s((sd.primary_assessment as any)?.exposure) || "";

      // ── systemic examination ───────────────────────────────────────────────
      const ex = fc.examination || {};
      const examGeneral     = s(ex.general_appearance)            || s((sd.systemic_exam as any)?.general)      || "Conscious, oriented, comfortable at rest";
      const examCVS         = s(ex.cvs_additional_notes)          || s((sd.systemic_exam as any)?.cvs)          || cvsFindings || "S1 S2 heard, no murmurs";
      const examRespiratory = s(ex.respiratory_additional_notes)  || s((sd.systemic_exam as any)?.chest)        || auscultation;
      const examAbdomen     = s(ex.abdomen_additional_notes)      || s((sd.systemic_exam as any)?.pa)           || "Soft, non-tender, bowel sounds present";
      const examCNS         = s(ex.cns_additional_notes)          || s((sd.systemic_exam as any)?.cns)          || "No focal neurological deficit";
      const examExtremities = s(ex.extremities_findings || ex.musculoskeletal) || s((sd.systemic_exam as any)?.extremities) || "No pedal oedema, pulses present";
      const examHEENT       = s(ex.heent) || "Not examined";

      // ── investigations ─────────────────────────────────────────────────────
      const inv = fc.investigations || {};
      const labsOrdered  = Array.isArray(inv.panels_selected) ? inv.panels_selected.join(", ") : (Array.isArray(inv.individual_tests) ? inv.individual_tests.join(", ") : s(inv.labs_ordered) || "Nil");
      const imagingOrdered = Array.isArray(inv.imaging) ? inv.imaging.join(", ") : s(inv.imaging) || "Nil";
      const ecg           = s(inv.ecg)  || s(pa.ecg_findings)  || "Not done";
      const efast         = s(inv.efast)|| s(pa.efast_findings) || s((sd.primary_assessment as any)?.efast) || "Not done";
      const resultsSummary= s(inv.results_notes || inv.results_summary) || "Pending";

      // VBG — prefer structured object from investigations.vbg
      const vbgObj = inv.vbg || fc.vbg_results || {};
      const vbgParts: string[] = [];
      if (vbgObj.ph)         vbgParts.push(`pH ${vbgObj.ph}`);
      if (vbgObj.pco2)       vbgParts.push(`PCO2 ${vbgObj.pco2} mmHg`);
      if (vbgObj.hco3)       vbgParts.push(`HCO3 ${vbgObj.hco3} mEq/L`);
      if (vbgObj.lactate)    vbgParts.push(`Lactate ${vbgObj.lactate} mmol/L`);
      if (vbgObj.hemoglobin) vbgParts.push(`Hb ${vbgObj.hemoglobin} g/dL`);
      if (vbgObj.sodium)     vbgParts.push(`Na ${vbgObj.sodium}`);
      if (vbgObj.potassium)  vbgParts.push(`K ${vbgObj.potassium}`);
      if (vbgObj.creatinine) vbgParts.push(`Cr ${vbgObj.creatinine}`);
      const vbgSection = vbgParts.length > 0 ? vbgParts.join(" | ") : "Not done";

      // ── path validator — warn in dev if key fields are missing ───────────────
      if (process.env.NODE_ENV !== "production") {
        const missingPaths: string[] = [];
        const chk = (path: string, obj: any) => {
          const val = path.split(".").reduce((o: any, k: string) => o?.[k], obj);
          if (val === undefined || val === null || val === "") missingPaths.push(path);
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

      // ── treatment ──────────────────────────────────────────────────────────
      const trt = fc.treatment || {};
      // medications may be in treatment.medications (CaseSheet/Voice) OR top-level
      // drugs_administered (external backend response shape)
      const rawMeds = trt.medications || fc.drugs_administered || trt.drugs_administered || [];
      const medications: any[]  = Array.isArray(rawMeds) ? rawMeds : (rawMeds ? [rawMeds] : []);
      const infusions: any[]    = Array.isArray(trt.infusions)     ? trt.infusions    : [];
      const fluids: any         = trt.fluids || "";
      // ER treatment meds — what was GIVEN in the emergency (not discharge prescription)
      const erMedsText = [
        ...medications.map((m: any) => `• ${m.name || m.drug || ""} ${m.dose || ""} ${m.route || ""} ${m.frequency || ""}`.trim()),
        ...infusions.map((f: any)   => `• ${f.name || f.fluid || ""} ${f.dose || ""} ${f.rate ? `at ${f.rate}` : ""}${f.dilution ? ` in ${f.dilution}` : ""}`.trim()),
        ...(fluids ? [`• ${fluids}`] : []),
      ].filter(Boolean).join("\n") || "Nil";
      // Discharge medications — doctor-confirmed prescription for after discharge
      const dischargeMedsText = s(sd.discharge_medications) || "To be completed by treating physician";
      // medsText alias for backward-compat with the prompt function
      const medsText = erMedsText;

      // ── procedures ─────────────────────────────────────────────────────────
      const procData = fc.procedures || {};
      // procedures_performed may be in fc.procedures.procedures_performed (CaseSheet) OR
      // top-level fc.procedures_performed (external backend response shape)
      const rawProcs = procData.procedures_performed || fc.procedures_performed || [];
      const procList: any[] = Array.isArray(rawProcs) ? rawProcs : (rawProcs ? [rawProcs] : []);
      const proceduresText = procList.map((p: any) => p.name || p).join(", ") || procData.general_notes || "Nil";

      // ── consultations ──────────────────────────────────────────────────────
      const consultations: any[] = Array.isArray(trt.consultations) ? trt.consultations : [];
      const consultText = consultations.filter((c: any) => c.specialty || c.doctorName).length > 0
        ? consultations.filter((c: any) => c.specialty || c.doctorName).map((c: any) =>
            `• ${c.specialty || "Specialist"}${c.doctorName ? ` (Dr. ${c.doctorName})` : ""}: ${c.adviceGiven || "Advice pending"}`
          ).join("\n")
        : "No specialist consultations during this visit";

      // ── psychological ──────────────────────────────────────────────────────
      const psych = fc.psychological || fc.psychological_assessment || {};
      const psychAssessed = psych.assessed !== false && Object.keys(psych).length > 0;
      const psychText = psychAssessed ? [
        psych.suicidal_ideation ? "Suicidal Ideation: YES — flagged" : "Suicidal Ideation: No",
        psych.self_harm ? "Self-Harm History: YES — flagged" : "Self-Harm History: No",
        psych.intent_to_harm_others ? "Intent to Harm Others: YES — flagged" : "Intent to Harm Others: No",
        psych.substance_abuse ? "Substance Abuse: YES — flagged" : "Substance Abuse: No",
        psych.psychiatric_history ? "Psychiatric History: YES" : "Psychiatric History: No",
        psych.currently_on_psychiatric_treatment ? "On Psychiatric Rx: YES" : "On Psychiatric Rx: No",
        psych.has_support_system ? "Support System: Present" : "Support System: Not documented",
        psych.notes ? `Notes: ${psych.notes}` : "",
      ].filter(Boolean).join("\n")
        : "Psychological screen: Not assessed during this visit";

      // ── diagnosis / disposition ────────────────────────────────────────────
      const workingDx    = s(trt.primary_diagnosis || trt.provisional_diagnoses?.[0]) || s(sd.diagnosis) || "To be determined";
      const differentials= Array.isArray(trt.differential_diagnoses) ? trt.differential_diagnoses.join(", ") : s(trt.differential_diagnoses) || "None documented";
      const dispData     = fc.disposition || {};
      const dispPlan     = s(dispData.type || dispData.disposition_type) || s(sd.disposition_type) || "Not specified";
      const conditionDx  = s(dispData.condition || dispData.condition_at_discharge) || s(sd.condition_at_discharge) || "STABLE";
      const pendingReps  = s(dispData.pending_reports || dispData.follow_up_pending) || "Nil";
      const followUp     = s(dispData.follow_up || dispData.follow_up_instructions) || s(sd.follow_up_advice) || "As clinically indicated";

      // ── validation ─────────────────────────────────────────────────────────
      if (!complaint && !hpi && !workingDx) {
        return res.status(400).json({
          error: "Please complete Chief Complaint, HPI, and Working Diagnosis before generating the discharge summary."
        });
      }

      const mappedData = {
        // Structured prompt fields
        patientName, patientAge, patientSex, uhid, mlcStatus, modeArrival,
        arrivalDate, arrivalTime, emResident, emConsultant,
        complaint, duration, onset, signsSymptoms, hpi,
        pastMedical, pastSurgical, allergies, preMeds, familyHx, socialHx,
        bp, hr, rr, spo2, temp, grbs, gcsE, gcsV, gcsM, gcsTot,
        airway, auscultation, workBreathing, o2Device, crt, cvsFindings, ivAccess,
        pupils, power, focalDeficit, exposure,
        examGeneral, examCVS, examRespiratory, examAbdomen, examCNS, examExtremities, examHEENT,
        labsOrdered, imagingOrdered, ecg, efast, resultsSummary, vbgSection,
        medsText, dischargeMedsText, proceduresText, consultText, psychText,
        workingDx, differentials, dispPlan, conditionDx, pendingReps, followUp,
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
        investigations: `Labs: ${labsOrdered}\nImaging: ${imagingOrdered}\nECG: ${ecg}\nEFAST: ${efast}\nVBG: ${vbgSection}\n${resultsSummary}`,
        consultations_text: consultText,
        procedures: proceduresText,
        primary_assessment: { airway, auscultation, pupils, power, exposure } as any,
        examination: { general_appearance: examGeneral, cvs_additional_notes: examCVS, respiratory_additional_notes: examRespiratory, abdomen_additional_notes: examAbdomen, cns_additional_notes: examCNS } as any,
        primary_survey_findings: { airway, auscultation, work_of_breathing: workBreathing, oxygen_device: o2Device, crt, pupils, power, exposure_findings: exposure } as any,
      };

      const result = await generateCourseInHospital(mappedData);

      res.json({
        success: true,
        summary: {
          course_in_hospital: result.course_in_hospital,
          diagnosis: result.diagnosis,
        }
      });
    } catch (error) {
      console.error("Discharge summary generation error:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to generate discharge summary" });
    }
  });

  app.post("/api/ai/extract-clinical", async (req: Request, res: Response) => {
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
      res.status(500).json({ error: (error as Error).message || "Failed to extract clinical data" });
    }
  });

  app.post("/api/voice/transcribe", upload.single('audio'), async (req: Request, res: Response) => {
    try {
      const file = req.file;
      console.log("[Voice Transcribe] Request received, file:", file ? `${file.originalname} (${file.size} bytes, ${file.mimetype})` : "NO FILE", "body keys:", Object.keys(req.body));
      if (!file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      if (file.size < 5000) {
        console.warn(`[Voice Transcribe] File too small: ${file.size} bytes — likely silent or failed recording`);
        return res.status(400).json({ error: `Audio too small (${file.size} bytes) — recording may have failed or captured silence. Please try again closer to the microphone.` });
      }

      let patientContext;
      if (req.body.patientContext) {
        try {
          patientContext = JSON.parse(req.body.patientContext);
        } catch {
          patientContext = undefined;
        }
      }
      
      const mode = req.body.mode || 'full';
      let filename = file.originalname || 'voice.m4a';

      const { convertAudioToWav } = await import("./services/audioConvert");
      const converted = await convertAudioToWav(file.buffer, filename);

      const { isSarvamAvailable, sarvamSpeechToText, sarvamTranslateToEnglish } = await import("./services/sarvamAI");

      let transcript = '';
      let detectedLanguage = 'en-IN';
      let englishTranscript = '';

      // Skip Sarvam for large files (>900KB ≈ >25 seconds) — Sarvam has a 30s hard limit
      const fileTooLargeForSarvam = converted.buffer.length > 900_000;
      if (fileTooLargeForSarvam) {
        console.log("[Voice] File too large for Sarvam (", converted.buffer.length, "bytes), going straight to Whisper");
      }

      if (isSarvamAvailable() && !fileTooLargeForSarvam) {
        try {
          console.log("[Voice] Sarvam STT: transcribing in original language...");
          const sarvamResult = await sarvamSpeechToText(converted.buffer, converted.filename, "unknown");
          transcript = sarvamResult.transcript || '';
          detectedLanguage = sarvamResult.language_code || 'en-IN';
          console.log("[Voice] Sarvam STT success. Language:", detectedLanguage, "Length:", transcript.length);

          // Translate to English if not already English
          if (transcript && detectedLanguage && !detectedLanguage.startsWith('en')) {
            console.log("[Voice] Non-English detected, translating to English...");
            try {
              const translated = await sarvamTranslateToEnglish(transcript);
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
          const result = await transcribeAndExtractVoice(converted.buffer, converted.filename, patientContext, 'transcribe_only');
          transcript = result.transcript || '';
          englishTranscript = transcript;
        }
      } else {
        console.log("[Voice] Sarvam not available, using Whisper...");
        const result = await transcribeAndExtractVoice(converted.buffer, converted.filename, patientContext, 'transcribe_only');
        transcript = result.transcript || '';
        englishTranscript = transcript;
      }

      res.json({ transcript, englishTranscript, detectedLanguage });
    } catch (error) {
      console.error("Voice transcription error:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to transcribe audio" });
    }
  });

  app.post("/api/voice/smart-dictation", upload.single('audio'), async (req: Request, res: Response) => {
    try {
      const file = req.file;
      console.log("[Smart Dictation] Request received, file:", file ? `${file.originalname} (${file.size} bytes, ${file.mimetype})` : "NO FILE", "body keys:", Object.keys(req.body));
      if (!file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      if (file.size < 5000) {
        console.warn(`[Smart Dictation] File too small: ${file.size} bytes — likely silent or failed recording`);
        return res.status(400).json({ error: `Audio too small (${file.size} bytes) — recording may have failed. Please try again.` });
      }

      let patientContext;
      if (req.body.patientContext) {
        try {
          patientContext = JSON.parse(req.body.patientContext);
        } catch {
          patientContext = undefined;
        }
      }

      let filename = file.originalname || 'voice.m4a';

      const { convertAudioToWav } = await import("./services/audioConvert");
      const converted = await convertAudioToWav(file.buffer, filename);

      const { isSarvamAvailable, sarvamSpeechToTextTranslate } = await import("./services/sarvamAI");
      const { extractSmartDictation } = await import("./services/aiDiagnosis");

      // Deduplicate looping transcripts (Sarvam/Whisper hallucination where a
      // sentence repeats many times). Keeps each unique sentence only once.
      function cleanTranscript(text: string): string {
        if (!text || text.length < 80) return text;
        const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
        if (sentences.length < 5) return text;
        const counts: Record<string, number> = {};
        for (const s of sentences) {
          const key = s.toLowerCase().replace(/\s+/g, ' ').slice(0, 50);
          counts[key] = (counts[key] || 0) + 1;
        }
        const maxRepeat = Math.max(...Object.values(counts));
        if (maxRepeat <= 2) return text;
        const seen = new Set<string>();
        const unique: string[] = [];
        for (const s of sentences) {
          const key = s.toLowerCase().replace(/\s+/g, ' ').slice(0, 50);
          if (!seen.has(key)) { seen.add(key); unique.push(s); }
        }
        console.warn(`[SmartDictation] Audio loop detected — deduped ${sentences.length} → ${unique.length} sentences`);
        return unique.join(' ');
      }

      let transcript = '';

      // Skip Sarvam for large files (>900KB ≈ >25 seconds) — Sarvam has a 30s hard limit
      const fileTooLargeForSarvam = converted.buffer.length > 900_000;
      if (fileTooLargeForSarvam) {
        console.log("[SmartDictation] File too large for Sarvam (", converted.buffer.length, "bytes), going straight to Whisper");
      }

      if (isSarvamAvailable() && !fileTooLargeForSarvam) {
        try {
          console.log("[SmartDictation] Using Sarvam AI for speech-to-text");
          const sarvamResult = await sarvamSpeechToTextTranslate(converted.buffer, converted.filename);
          transcript = sarvamResult.transcript || '';
          console.log("[SmartDictation] Sarvam STT success, transcript length:", transcript.length);
        } catch (sarvamError) {
          console.warn("[SmartDictation] Sarvam STT failed, falling back to Whisper:", sarvamError);
          const { transcribeAndExtractVoice } = await import("./services/aiDiagnosis");
          const fallbackResult = await transcribeAndExtractVoice(converted.buffer, converted.filename, patientContext, 'transcribe_only');
          transcript = fallbackResult.transcript || '';
        }
      } else {
        console.log("[SmartDictation] Using OpenAI Whisper for speech-to-text");
        const { transcribeAndExtractVoice } = await import("./services/aiDiagnosis");
        const result = await transcribeAndExtractVoice(converted.buffer, converted.filename, patientContext, 'transcribe_only');
        transcript = result.transcript || '';
      }

      if (!transcript || transcript.trim().length === 0) {
        return res.json({ transcript: '', extracted: null, error: 'No speech detected' });
      }

      // Clean looping / hallucinated repeats before extraction
      transcript = cleanTranscript(transcript);

      console.log("[SmartDictation] Extracting clinical data from transcript...");
      const extracted = await extractSmartDictation(transcript, patientContext);

      res.json({ transcript, extracted });
    } catch (error) {
      console.error("Smart dictation error:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to process dictation" });
    }
  });

  app.post("/api/voice/translate", async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: "No text provided for translation" });
      }

      const { isSarvamAvailable, sarvamTranslateToEnglish } = await import("./services/sarvamAI");

      if (!isSarvamAvailable()) {
        return res.json({ translated_text: text, skipped: true, reason: "Sarvam AI not configured" });
      }

      console.log("[Translate] Translating text to English, length:", text.length);
      const result = await sarvamTranslateToEnglish(text.trim());

      res.json({
        translated_text: result.translated_text,
        source_language: result.source_language_code,
        original_text: text,
      });
    } catch (error) {
      console.error("[Translate] Error:", error);
      res.json({ translated_text: req.body.text, skipped: true, reason: (error as Error).message });
    }
  });

  app.post("/api/voice/extract-and-save", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "No auth token" });

      const {
        transcript, patientContext,
        patient, case_type,
        userId, userEmail,
      } = req.body;

      if (!transcript || !transcript.trim()) {
        return res.status(400).json({ error: "No transcript provided" });
      }

      console.log("[ExtractAndSave] Transcript length:", transcript.length);

      // Step 1 — AI extraction
      const { extractSmartDictation } = await import("./services/aiDiagnosis");
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Extraction timed out after 45s")), 45000)
      );
      const extracted = await Promise.race([
        extractSmartDictation(transcript, patientContext),
        timeout,
      ]);

      console.log("[ExtractAndSave] Extraction done. Chief complaint:", (extracted as any).chiefComplaint || "(none)");

      // Step 2 — Build vitals + triage from extracted data
      const ex = extracted as any;
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
      if (spo2 < 90 || gcs < 9 || bpSys < 80) { triage_color = "red"; triage_priority = 1; }
      else if (spo2 < 94 || gcs < 13 || bpSys < 100 || hr > 120 || rr > 30) { triage_color = "orange"; triage_priority = 2; }
      else if (spo2 < 96 || hr > 100 || rr > 24 || bpSys > 180) { triage_color = "yellow"; triage_priority = 3; }
      else if (hr > 90 || rr > 20) { triage_color = "green"; triage_priority = 4; }
      else { triage_color = "blue"; triage_priority = 5; }

      const temperature = parseFloat(vs.temperature || ps.exposure?.temperature) || 36.8;
      const gcsE = parseInt(ps.disability?.gcsE) || 4;
      const gcsV = parseInt(ps.disability?.gcsV) || 5;
      const gcsM = parseInt(ps.disability?.gcsM) || 6;
      const grbs = parseInt(vs.grbs || ps.disability?.grbs) || 100;

      const vitals_at_arrival = {
        hr, bp_systolic: bpSys, bp_diastolic: bpDia, rr, spo2,
        temperature,
        gcs_e: gcsE,
        gcs_v: gcsV,
        gcs_m: gcsM,
        grbs,
        pain_score: 0,
      };

      const presenting_complaint = {
        text: ex.chiefComplaint || "",
        onset_type: ex.onset || "Sudden",
        duration: ex.duration || "",
        course: "",
      };

      const em_resident = ex.emResident || patient?.informant_name || "";
      const em_consultant = ex.emConsultant || "";

      // Step 3 — Create case on external backend
      const createRes = await fetch(`${EXTERNAL_API}/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({
          patient, presenting_complaint, vitals_at_arrival,
          triage_color, triage_priority, em_resident, em_consultant, case_type,
        }),
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

      // Step 4 — Build and push clinical data
      // pastMedicalHistory may be returned as array (rule 6) or string (schema) — handle both
      const pastMedRaw = ex.pastMedicalHistory;
      // Log the raw type so we can verify schema fix in production logs
      console.log(`[ExtractAndSave] PMH type: ${Array.isArray(pastMedRaw) ? "array" : typeof pastMedRaw}, value: ${JSON.stringify(pastMedRaw)?.slice(0, 120)}`);

      // Continuation words that indicate the comma is WITHIN a condition, not between two conditions
      // e.g. "CKD, baseline GFR 2.9" → should NOT split; "CAD, ACS, STEMI" → should split
      const PMH_CONTINUATION = /^(baseline|with\s|grade\s|stage\s|class\s|on\s|per\s|approx|approximately|uncontrolled|controlled|bilateral|unilateral|and\s|or\s|at\s|from\s|since\s|till\s)/i;

      function splitPMHString(str: string): string[] {
        const result: string[] = [];
        // First split on unambiguous separators: semicolons and newlines
        for (const chunk of str.split(/[;\n]+/)) {
          const parts = chunk.split(/,\s*/);
          let current = parts[0];
          for (let i = 1; i < parts.length; i++) {
            if (PMH_CONTINUATION.test(parts[i])) {
              // Comma is within one condition — keep joined
              current = current + ", " + parts[i];
            } else {
              if (current.trim()) result.push(current.trim());
              current = parts[i];
            }
          }
          if (current.trim()) result.push(current.trim());
        }
        return result.filter(s => s.length > 0);
      }

      const pastMedArr: string[] = Array.isArray(pastMedRaw)
        ? pastMedRaw.map((s: string) => s.trim()).filter((s: string) => s)
        : typeof pastMedRaw === "string" && pastMedRaw
          ? splitPMHString(pastMedRaw)
          : [];

      const symptomsArr: string[] = [];
      if (ex.symptoms?.length > 0) symptomsArr.push(...ex.symptoms);
      if (ex.associatedSymptoms) symptomsArr.push(ex.associatedSymptoms);
      // Deduplicate case-insensitively
      const seenSymptoms = new Set<string>();
      const uniqueSymptoms = symptomsArr.filter(s => {
        const key = s.trim().toLowerCase();
        if (seenSymptoms.has(key)) return false;
        seenSymptoms.add(key);
        return true;
      });

      // VBG → adjuncts.abg (keys must match export reader: pH, pCO2, Lactate, Na, K, Hb etc.)
      const vbg = ex.vbgResults || {};
      const adjunctsAbg: Record<string, string> = {};
      if (vbg.ph)         adjunctsAbg.pH       = vbg.ph;
      if (vbg.pco2)       adjunctsAbg.pCO2     = vbg.pco2;
      if (vbg.po2)        adjunctsAbg.pO2      = vbg.po2;
      if (vbg.hco3)       adjunctsAbg.HCO3     = vbg.hco3;
      if (vbg.be)         adjunctsAbg.BE       = vbg.be;
      if (vbg.lactate)    adjunctsAbg.Lactate  = vbg.lactate;
      if (vbg.hemoglobin) adjunctsAbg.Hb       = vbg.hemoglobin;
      if (vbg.sodium)     adjunctsAbg.Na       = vbg.sodium;
      if (vbg.potassium)  adjunctsAbg.K        = vbg.potassium;
      if (vbg.chloride)   adjunctsAbg.Cl       = vbg.chloride;
      if (vbg.glucose)    adjunctsAbg.Glucose  = vbg.glucose;
      if (vbg.creatinine) adjunctsAbg.Creatinine = vbg.creatinine;
      if (vbg.bilirubin)  adjunctsAbg.Bilirubin  = vbg.bilirubin;

      const adj = ex.adjuncts || {};
      const vbgNotesParts: string[] = [];
      if (vbg.sampleType) vbgNotesParts.push(vbg.sampleType);
      Object.entries(adjunctsAbg).forEach(([k, v]) => vbgNotesParts.push(`${k}: ${v}`));

      // Investigations: split investigationsOrdered into individual tests
      const invOrdered = ex.investigationsOrdered || "";
      const invTests: string[] = invOrdered
        ? invOrdered.split(/[,;\/\n]+/).map((s: string) => s.trim()).filter((s: string) => s)
        : [];

      const updateRes = await fetch(`${EXTERNAL_API}/cases/${caseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({
          // ── HISTORY (SAMPLE) ────────────────────────────────────────────────
          history: {
            hpi: ex.historyOfPresentIllness || transcript,
            events_hopi: ex.historyOfPresentIllness || transcript,
            signs_and_symptoms: uniqueSymptoms.join(", "),
            past_medical: pastMedArr,
            past_surgical: ex.pastSurgicalHistory || "",
            allergies: ex.allergies ? ex.allergies.split(/[,;]+/).map((s: string) => s.trim()).filter((s: string) => s) : [],
            medications: ex.currentMedications || "",
            drug_history: ex.currentMedications || "",
            family_history: ex.familyHistory || "",
            social_history: ex.socialHistory || "",
            additional_notes: ex.menstrualHistory || "",
          },
          // Mirror the sample object (backend reads this directly for SAMPLE history display)
          sample: {
            eventsHopi: ex.historyOfPresentIllness || transcript,
            signsSymptoms: uniqueSymptoms.join(", "),
            pastMedicalHistory: pastMedArr,
            allergies: ex.allergies ? ex.allergies.split(/[,;]+/).map((s: string) => s.trim()).filter((s: string) => s) : [],
            medications: ex.currentMedications || "",
            lastMeal: "",
            lmp: ex.menstrualHistory || "",
          },
          // ── PRIMARY ASSESSMENT ──────────────────────────────────────────────
          primary_assessment: {
            airway_status: ps.airway?.status || "Patent",
            airway_interventions: [],
            airway_additional_notes: ps.airway?.findings || "",
            breathing_rr: rr,
            breathing_spo2: spo2,
            breathing_oxygen_device: ps.breathing?.oxygenDevice || "Room air",
            breathing_oxygen_flow: 0,
            breathing_work: ps.breathing?.workOfBreathing || "Normal",
            breathing_air_entry: ["Equal"],
            breathing_additional_notes: ps.breathing?.auscultation || "",
            circulation_hr: hr,
            circulation_bp_systolic: bpSys,
            circulation_bp_diastolic: bpDia,
            circulation_crt: 2,
            circulation_adjuncts: ps.circulation?.ivAccess ? [ps.circulation.ivAccess] : [],
            circulation_additional_notes: ps.circulation?.cvs || "",
            disability_avpu: "Alert",
            disability_gcs_e: parseInt(ps.disability?.gcsE) || gcsE,
            disability_gcs_v: parseInt(ps.disability?.gcsV) || gcsV,
            disability_gcs_m: parseInt(ps.disability?.gcsM) || gcsM,
            disability_grbs: parseFloat(ps.disability?.grbs || vs.grbs) || grbs,
            disability_pupils_size: ps.disability?.pupils?.includes("mm") ? ps.disability.pupils : "Normal",
            disability_pupils_reaction: "Reactive",
            disability_additional_notes: ps.disability?.focalDeficit || "",
            exposure_temperature: parseFloat(ps.exposure?.temperature || vs.temperature) || temperature,
            exposure_additional_notes: ps.exposure?.findings || "",
          },
          // Mirror abcde (backend also reads from this)
          abcde: {
            airway: { status: ps.airway?.status || "Patent", notes: ps.airway?.findings || "", abcdeStatus: "stable" },
            breathing: { rr, spo2, oxygenDevice: ps.breathing?.oxygenDevice || "Room air", effort: "Normal", notes: ps.breathing?.auscultation || "", abcdeStatus: "stable" },
            circulation: { hr, bpSystolic: bpSys, bpDiastolic: bpDia, capillaryRefill: "Normal", notes: ps.circulation?.cvs || "", abcdeStatus: "stable" },
            disability: { motorResponse: "Alert", gcsE: String(gcsE), gcsV: String(gcsV), gcsM: String(gcsM), glucose: String(grbs), pupils: "Equal", pupilReaction: "Reactive", notes: "", abcdeStatus: "stable" },
            exposure: { temperature: String(temperature), findings: ps.exposure?.findings || "", notes: "", abcdeStatus: "stable" },
          },
          // ── ADJUNCTS ────────────────────────────────────────────────────────
          adjuncts: {
            ecg_status: adj.ecgDone ? "Done" : "",
            ecg_findings: adj.ecgFindings || "",
            bedside_echo: adj.echoDone ? (adj.echoFindings || "Done") : "",
            efast_status: adj.efastDone ? "Done" : "",
            efast_notes: adj.efastFindings || "",
            additional_notes: vbgNotesParts.join(" | "),
            // ABG/VBG — lowercase keys matching CaseSheetScreen buildPayload
            abg: {
              sample_type: vbg.sampleType || (vbg.ph ? "VBG" : ""),
              ph: vbg.ph || "",
              pco2: vbg.pco2 || "",
              po2: vbg.po2 || "",
              hco3: vbg.hco3 || "",
              be: vbg.be || "",
              lactate: vbg.lactate || "",
              sao2: "",
              fio2: "",
              na: vbg.sodium || "",
              k: vbg.potassium || "",
              cl: vbg.chloride || "",
              anion_gap: "",
              glucose: vbg.glucose || "",
              hb: vbg.hemoglobin || "",
              aa_gradient: "",
              status: vbg.ph ? "done" : "",
              interpretation: "",
              final_diagnosis: "",
            },
          },
          // ── EXAMINATION ─────────────────────────────────────────────────────
          examination: {
            general_pallor: false, general_icterus: false, general_cyanosis: false,
            general_clubbing: false, general_lymphadenopathy: false, general_edema: false,
            general_additional_notes: ex.examFindings?.general || "",
            cvs_status: "Normal", cvs_s1_s2: "Normal", cvs_pulse: "Regular",
            cvs_pulse_rate: hr,
            cvs_apex_beat: "Normal", cvs_added_sounds: "", cvs_murmurs: "",
            cvs_additional_notes: ex.examFindings?.cvs || "",
            respiratory_status: "Normal", respiratory_expansion: "Equal",
            respiratory_percussion: "Resonant", respiratory_breath_sounds: "Vesicular",
            respiratory_vocal_resonance: "Normal", respiratory_added_sounds: "",
            respiratory_additional_notes: ex.examFindings?.respiratory || "",
            abdomen_status: "Normal", abdomen_umbilical: "Normal",
            abdomen_organomegaly: "", abdomen_percussion: "Tympanic",
            abdomen_bowel_sounds: "Present",
            abdomen_additional_notes: ex.examFindings?.abdomen || "",
            cns_status: "Normal", cns_higher_mental: "Intact",
            cns_cranial_nerves: "Intact", cns_sensory_system: "Intact",
            cns_motor_system: "Normal", cns_reflexes: "Normal",
            cns_additional_notes: ex.examFindings?.cns || "",
            extremities_status: "Normal",
            extremities_findings: ex.examFindings?.musculoskeletal || "",
          },
          // ── INVESTIGATIONS ──────────────────────────────────────────────────
          investigations: {
            panels_selected: invTests,
            imaging: ex.imagingOrdered ? [ex.imagingOrdered] : [],
            results_notes: invOrdered || "",
            ...(Object.keys(adjunctsAbg).length > 0 ? { vbg: adjunctsAbg } : {}),
          },
          // ── TREATMENT ───────────────────────────────────────────────────────
          treatment: {
            primary_diagnosis: ex.diagnosis?.[0] || "",
            provisional_diagnoses: ex.diagnosis?.length ? ex.diagnosis : [],
            differential_diagnoses: ex.differentialDiagnosis?.length ? ex.differentialDiagnosis : [],
            medications: ex.prescribedMedications || [],
            infusions: ex.prescribedInfusions || [],
            fluids: ex.prescribedInfusions?.map((inf: any) => `${inf.name || ""}${inf.rate ? ` @ ${inf.rate}` : ""}`).join(", ") || "",
            other_medications: ex.treatmentNotes || "",
            intervention_notes: ex.treatmentNotes || "",
          },
          // ── TOP-LEVEL FIELDS ────────────────────────────────────────────────
          presenting_complaint: {
            text: ex.chiefComplaint || "",
            onset_type: ex.onset || "Sudden",
            duration: ex.duration || "",
            course: "",
          },
          mode_of_arrival: patient?.mode_of_arrival || "Walk-in",
          mlc: false,
          psychological: {
            assessed: false, suicidalIdeation: false, selfHarm: false,
            intentToHarmOthers: false, substanceAbuse: false, psychiatricHistory: false,
            currentlyOnPsychiatricTreatment: false, hasSupportSystem: true, notes: "",
          },
        }),
      });

      if (!updateRes.ok) {
        const errText = await updateRes.text();
        console.warn("[ExtractAndSave] Clinical PUT failed (case still created):", updateRes.status, errText);
        return res.json({ success: true, caseId, extracted, warning: "Case created — some clinical fields may need manual entry." });
      }

      console.log("[ExtractAndSave] Clinical data saved for case:", caseId);

      // Step 5 — Local DB (best-effort)
      try {
        const db = getDb();
        if (db && userId) {
          const { caseClinicalData } = await import("@shared/schema");
          await db.insert(caseClinicalData).values({ caseId, userId, payload: { extracted, transcript } });
          console.log("[ExtractAndSave] Local DB saved");
        }
      } catch (dbErr) {
        console.warn("[ExtractAndSave] Local DB failed (non-fatal):", dbErr);
      }

      // Step 6 — Subscription increment (best-effort)
      if (userId) {
        try {
          const { incrementCaseCount } = await import("./services/subscription");
          await incrementCaseCount(userId, userEmail || "");
        } catch {}
      }

      return res.json({ success: true, caseId, extracted });
    } catch (err: any) {
      console.error("[ExtractAndSave] Error:", err);
      return res.status(500).json({ success: false, error: err.message || "Extract and save failed" });
    }
  });

  app.post("/api/voice/extract-clinical", async (req: Request, res: Response) => {
    try {
      const { transcript, patientContext } = req.body;
      if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
        return res.status(400).json({ error: "No transcript text provided" });
      }

      console.log("[ExtractClinical] Processing transcript, length:", transcript.length);

      const { extractSmartDictation } = await import("./services/aiDiagnosis");

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Extraction timed out after 45s")), 45000)
      );

      const extracted = await Promise.race([
        extractSmartDictation(transcript, patientContext),
        timeout,
      ]);

      res.json({ success: true, extracted });
    } catch (error) {
      console.error("Clinical extraction error:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to extract clinical data" });
    }
  });

  app.post("/api/voice/chat", async (req: Request, res: Response) => {
    try {
      const { messages, currentMessage, patientContext, hasCaseNote } = req.body;
      if (!currentMessage || typeof currentMessage !== "string" || !currentMessage.trim()) {
        return res.status(400).json({ error: "No message provided" });
      }

      const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
      const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      if (!apiKey || !baseURL) {
        return res.status(503).json({ error: "AI not configured" });
      }

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey, baseURL });

      const ctx = patientContext || {};
      const patientLine = [
        ctx.name ? `Name: ${ctx.name}` : null,
        ctx.age ? `Age: ${ctx.age} years` : null,
        ctx.sex ? `Sex: ${ctx.sex}` : null,
        ctx.chiefComplaint ? `Chief Complaint: ${ctx.chiefComplaint}` : null,
      ].filter(Boolean).join(", ") || "Unknown patient";

      const systemPrompt = `You are Arya — ErMate's AI clinical assistant for emergency medicine.
Current patient: ${patientLine}

Your role: Be a knowledgeable, concise ER clinical assistant. You process dictations, generate documentation, answer clinical questions about this patient, and produce any ER note or summary requested.

RESPONSE FORMAT (respond ONLY as valid JSON, nothing else):
{
  "reply": "1–2 sentence response. Be brief and specific.",
  "type": "case_update" | "addendum" | "discharge_summary" | "referral" | "procedure_note" | "note" | "general",
  "extracted": { ...clinical fields... } | null,
  "specialContent": "full text for addendums/summaries/procedure notes" | null
}

TYPE RULES:
- "case_update": doctor provides ANY clinical data — whether by voice dictation OR by typing (corrections, additions, updates). hasCaseNote=false → extract ALL provided fields into extracted; reply confirms what was captured. Also use when doctor types something like "presenting complaint is X", "patient is Y years old", "diagnosis is Z", "differential is A and B", "patient is allergic to X", "vitals are HR X BP Y".
- "addendum": doctor provides ANY clinical data AND hasCaseNote=true → extract ONLY the new/changed fields into extracted; put a brief addendum text in specialContent; reply is a 1-line confirmation of what changed. Also use when doctor TYPES a correction after a case note already exists.
- CORRECTION RULE (CRITICAL): When a doctor types a correction or additional clinical fact — e.g. "presenting complaint is neck pain", "differentials are fibromyalgia and thyroiditis", "patient has no allergies" — this is ALWAYS case_update (hasCaseNote=false) or addendum (hasCaseNote=true). It is NEVER "general". Always populate extracted with the corrected fields.
- "discharge_summary": doctor says "discharge summary", "DS", "summary" → generate complete professional ER discharge summary in specialContent; extracted = null
- "referral": doctor says "referral letter", "refer to [hospital/specialist]" → generate formal referral letter in specialContent; extracted = null
- "procedure_note": doctor asks for ANY of the following → generate a complete formal procedure note in specialContent; extracted = null:
    • RSI / rapid sequence intubation note
    • Intubation note / airway management note
    • Central line note / central venous catheter (CVC) note
    • Arterial line note / intra-arterial catheter note
    • Death summary / death note / cremation certificate note
    • Any other procedure: lumbar puncture, chest drain, pericardiocentesis, DC cardioversion, defibrillation, wound suturing, fasciotomy, etc.
    PROCEDURE NOTE FORMAT in specialContent:
    PROCEDURE: [name]
    DATE / TIME: [use current context or "as documented"]
    PATIENT: [name and age from context]
    INDICATION: [why procedure was done — from dictation or inferred from context]
    OPERATOR: [doctor's name if mentioned, else "EM Physician"]
    ASSISTANT: [if mentioned]
    CONSENT: [Informed verbal consent obtained / Emergency procedure / Not applicable]
    TECHNIQUE: [concise step-by-step description specific to the procedure]
    COMPLICATIONS: [None encountered / list if mentioned]
    OUTCOME / STATUS: [Successful / Unsuccessful / finding]
    POST-PROCEDURE CARE: [monitoring, checks, follow-up]
- "note": doctor says "add a note", "note:", "clinical note" → put note text in specialContent AND in extracted.treatmentNotes
- "general": ONLY for pure clinical questions with NO patient data — e.g. "What is the dose of amoxicillin?", "What are the criteria for STEMI?", "Explain GCS". If the doctor is providing ANY patient-specific clinical information (even typed as a sentence), use case_update or addendum instead. extracted = null ONLY for general.
- Current hasCaseNote status: ${hasCaseNote ? "TRUE — case note already exists, new dictations are ADDENDUM" : "FALSE — no case note yet, use case_update"}

ADDENDUM FORMAT (for specialContent when type=addendum):
Plain text, section headers for new data only. Example:
"UPDATED VITALS
• SpO2 improved to 98% post-O2
ADDITIONAL TREATMENT
• Metoprolol 25mg PO added
INVESTIGATIONS
• ECG: Sinus tachycardia resolving"

EXTRACTION SCHEMA — Extract from the dictation. Return as nested JSON inside "extracted". All fields are optional unless stated.

PATIENT:
- patientName: full name (string)
- patientAge: age in years as string (e.g. "45")
- patientSex: "Male" | "Female" | "Other"
- chiefComplaint: ALWAYS extract — brief phrase with duration (e.g. "Chest pain × 2 hours", "Neck pain and body ache × 1-2 months").
  Recognize ALL of these dictation patterns:
  • "presented with complaint of [X]" → chiefComplaint: X
  • "presented with [X]" → chiefComplaint: X
  • "presenting complaint is [X]" → chiefComplaint: X
  • "complaint of [X]" / "c/o [X]" → chiefComplaint: X
  • "came with [X]" / "brought with [X]" → chiefComplaint: X
  • "chief complaint is [X]" → chiefComplaint: X
  • "patient has [X] since [duration]" → chiefComplaint: X × duration
  • First symptom or symptom cluster mentioned in the dictation
  NEVER output null or omit chiefComplaint if ANY symptom is mentioned. Duration is mandatory if stated.

HISTORY:
- historyOfPresentIllness: 2–4 sentence prose narrative (onset, duration, progression, context). No vitals/exam/investigations here.
- associatedSymptoms: other symptoms alongside main complaint
- pastMedicalHistory: known conditions BEFORE this visit — default "No significant past medical history"
- pastSurgicalHistory: previous surgeries if mentioned
- allergies: drug/food allergies — default "NKDA" if none stated
- currentMedications: medications patient was taking BEFORE this ER visit (NOT what you are giving now) — default "Nil"
- familyHistory: family history if mentioned
- socialHistory: social habits, occupation if mentioned
- symptoms: array of individual symptoms mentioned

- psychological: only set fields to true if EXPLICITLY mentioned by doctor:
  { suicidalIdeation: bool, selfHarmHistory: bool, intentToHarmOthers: bool, substanceAbuse: bool,
    psychiatricHistory: bool, currentlyOnPsychiatricTreatment: bool, hasSupportSystem: bool, notes: string }

VITALS (numbers precisely):
- vitalsSuggested.hr: heart rate number only (e.g. "112")
- vitalsSuggested.bp: "systolic/diastolic" (e.g. "100/60")
- vitalsSuggested.spo2: SpO2 percentage only (e.g. "94"). If two readings are mentioned (e.g. "SpO2 89, then 100% on O2" or "SpO2 89 room air, 100% with oxygen"), extract the FIRST (room air) reading as the value, and include both readings in abcdeFindings.breathing.notes (e.g. "SpO2 89% on room air → 100% on supplemental O2"). Never average or invent a value between the two.
- vitalsSuggested.rr: respiratory rate (e.g. "18")
- vitalsSuggested.temperature: with unit — if value > 41 assume Fahrenheit. Always include unit (e.g. "103°F", "38.5°C")
- vitalsSuggested.grbs: blood glucose number (e.g. "280")

PRIMARY SURVEY (ABCDE):
- primarySurveyText: full A–E one-line-per-letter summary string (always return for case_update, using defaults for letters not mentioned)
- abcdeFindings.airway: { status:"Normal"|"Abnormal", position:"Self-maintained"|"Head tilt/Chin lift"|"Jaw thrust", patency:"Patent"|"Partially obstructed"|"Completely obstructed", cause:"None"|"Tongue fall"|"Secretions"|"Blood/Vomitus"|"Foreign body"|"Edema", notes:string }
- abcdeFindings.breathing: { status:"Normal"|"Abnormal", notes:string }
- abcdeFindings.circulation: { status:"Normal"|"Abnormal", notes:string }
- abcdeFindings.disability: { status:"Normal"|"Abnormal", notes:string }
- abcdeFindings.exposure: { status:"Normal"|"Abnormal", notes:string }

ADJUNCTS:
- ecgInterpretation: plain text ECG finding (e.g. "STEMI anterior wall", "Atrial fibrillation", "Normal sinus rhythm") — default "Not done"
- ecgStructured: { performed:bool, findings:string, rhythm:string, stChanges:string }
- abgSummary: plain text ABG/VBG interpretation (e.g. "Metabolic acidosis — pH 7.28, HCO3 16, lactate 5") — default "Not done"
- abgStructured: { performed:bool, ph:string, pco2:string, hco3:string, lactate:string, notes:string }

EXAMINATION:
- examFindings.general: general exam text — default "Conscious, alert, well-oriented, no acute distress"
- examFindings.cvs: cardiovascular — default "S1S2 heard, no murmurs"
- examFindings.respiratory: respiratory — default "Air entry bilaterally equal, no adventitious sounds"
- examFindings.abdomen: abdominal — default "Soft, non-tender, bowel sounds present"
- examFindings.cns: neurological — default "No focal neurological deficit"
- examStructured.general: { pallor:bool, icterus:bool, cyanosis:bool, clubbing:bool, lymphadenopathy:bool, edema:bool }
  Rules: "pallor present" → pallor:true. "no pallor" → pallor:false. Only set to true if explicitly mentioned.

TREATMENT (ER — what you are giving NOW, not what patient was taking before):
- prescribedMedications: [{name, dose, route, frequency}] — drugs administered in ER
  Indian drug name mapping: Ecosprin→Aspirin, Brilinta→Ticagrelor, Zidot→Azithromycin, Calpol→Paracetamol, Pan/Ompras→Pantoprazole, Duolin→Ipratropium+Salbutamol, OHG→Metformin, Aug→Amoxiclav-Clavulanate, Budecort→Budesonide
- prescribedInfusions: [{name, dose, dilution, rate}] — IV fluids and drips (NS bolus, RL, Dopamine drip)
- investigationsOrdered: comma-separated lab tests ordered (CBC, RFT, LFT, troponin, d-dimer, etc.)
- imagingOrdered: imaging ordered (X-ray chest, CT head, USG abdomen, Echo)
- treatmentNotes: other management plans, freeform notes

PROCEDURES — set boolean true ONLY if doctor says they performed or are performing it:
- procedures.resuscitation.cpr: "CPR", "chest compressions", "resuscitation started"
- procedures.airway.endotrachealIntubation: "intubated", "ETT", "RSI", "rapid sequence intubation"
- procedures.airway.lmaInsertion: "LMA", "supraglottic airway"
- procedures.airway.cricothyrotomy: "cric", "surgical airway", "cricothyrotomy"
- procedures.airway.bvmVentilation: "BVM", "bag-mask", "bagged the patient"
- procedures.airway.niv: "BiPAP", "CPAP", "NIV", "non-invasive ventilation"
- procedures.vascular.centralLine: "central line", "CVC", "internal jugular", "subclavian", "femoral line"
- procedures.vascular.peripheralIV: "IV access", "cannula", "peripheral line", "drip started"
- procedures.vascular.intraosseousAccess: "IO access", "intraosseous"
- procedures.vascular.arterialLine: "arterial line", "A-line", "radial line"
- procedures.chest.chestTube: "chest tube", "intercostal drain", "ICD inserted"
- procedures.chest.needleDecompression: "needle decompression", "tension pneumo treated"
- procedures.chest.pericardiocentesis: "pericardiocentesis", "cardiac tamponade drained"
- procedures.chest.thoracentesis: "thoracentesis", "pleural tap"
- procedures.neuro.lumbarPuncture: "LP", "lumbar puncture", "CSF sent"
- procedures.gu.foleyCatheter: "Foley's", "urinary catheter", "catheterized"
- procedures.gi.ngTube: "NG tube", "nasogastric tube", "Ryle's tube"
- procedures.gi.gastricLavage: "gastric lavage", "gastric wash"
- procedures.wound.woundClosure: "sutured", "wound closure", "stitched"
- procedures.wound.woundIrrigation: "wound irrigated", "wound washed"
- procedures.ortho.fractureSplinting: "splint", "POP", "plaster"
- procedures.ortho.jointReduction: "reduction done", "joint reduced", "relocated"

LMP RULE: If patient is female, ALWAYS extract LMP from the history and populate menstrualHistory.
- If not mentioned → menstrualHistory: "Not mentioned"
- Format: "DD/MM/YY" or "Not mentioned"

GCS COMPONENTS: When GCS is mentioned, extract individual E/V/M components if stated:
- abcdeFindings.disability.gcsE, gcsV, gcsM (as strings, e.g. "4", "5", "6")
- In primarySurveyText D section, show: "GCS: E4 V5 M6 (15/15)" format

TEMPERATURE: Always output with unit. Auto-convert for display:
- If > 41 → Fahrenheit. Output as "103°F" AND also include Celsius in notes: "103°F (39.4°C)"
- If ≤ 41 → Celsius. Output as "38.5°C" AND also include Fahrenheit: "38.5°C (101.3°F)"
- vitalsSuggested.temperature: always include unit + conversion in parentheses

EFAST: If mentioned → extract to a new field efastFindings: string (e.g. "No free fluid seen", "Pericardial effusion noted")

HISTORY OF PRESENT ILLNESS: historyOfPresentIllness MUST be a full paragraph (2–5 sentences):
- Include: time of onset, character of symptom, location, radiation, associated symptoms, relieving/aggravating factors, relevant negative history
- NOT bullet points. A clinical narrative paragraph.
- Example: "Patient presented with abdominal pain since the previous evening at approximately 5:30 PM. The pain was initially located in the epigastric region and subsequently migrated to the right iliac fossa. The patient reports associated nausea and chills. No history of vomiting, diarrhea, hematemesis, melena, or urinary complaints."

DIAGNOSIS:
- diagnosis: array of working diagnoses (first = primary)
- differentialDiagnosis: array of differential diagnoses — each WITH clinical reasoning in parentheses
  Format: "Diagnosis name (reasoning — key finding 1 + key finding 2)"
  Example: ["Acute appendicitis (most likely — pain migration to RIF + tachycardia)", "Acute gastroenteritis (possible — nausea and diarrhea)", "Mesenteric adenitis (possible — young female, lymphadenopathy pattern)", "Ureteric colic right side (less likely — no urinary symptoms)"]
  Minimum 3 differentials, maximum 5. Always include reasoning.

DISPOSITION:
- dispositionSuggested.type: "Admit" | "Discharge" | "Refer" | "LAMA" | "Absconded" | "Death" — if explicitly mentioned
- dispositionSuggested.admitTo: ward/ICU if admitting (e.g. "Medical ICU", "CCU", "General Ward")
- dispositionSuggested.referTo: specialty or consultant if referring (e.g. "Cardiology", "Medicine", "Dr. Neeraj")
- dispositionSuggested.durationInER: time in ER if mentioned

COMPLETENESS MANDATE — For type=case_update, ALWAYS return defaults for every section not explicitly dictated:
- pastMedicalHistory → "No significant past medical history"
- allergies → "NKDA"
- currentMedications → "Nil"
- primarySurveyText → ALWAYS return full A–E string. For any letter not mentioned, use:
    A default: "Patent, self-maintained"  B default: "Equal bilateral air entry, no respiratory distress"
    C default: "Adequate perfusion, no features of shock"  D default: "GCS 15, alert and oriented"
    E default: "No significant findings on exposure"
    Format: "A: <finding>. B: <finding>. C: <finding>. D: <finding>. E: <finding>."
- ecgInterpretation → "Not done"
- abgSummary → "Not done"
- examFindings.general → "Conscious, alert, well-oriented, no acute distress"
- examFindings.cvs → "S1S2 heard, no murmurs, no added heart sounds"
- examFindings.respiratory → "Air entry bilaterally equal and clear, no adventitious sounds"
- examFindings.abdomen → "Soft, non-tender, bowel sounds present"
- examFindings.cns → "No focal neurological deficit"

CRITICAL RULES:
1. currentMedications = BEFORE ER visit. prescribedMedications = what you are giving NOW. NEVER mix.
2. Temperature without unit: if > 41 → Fahrenheit ("103°F"). Always include unit.
3. Procedures: only set true if the doctor PERFORMED or IS PERFORMING them. "Give IV access" → peripheralIV:true.
4. Psychological flags: only set true if explicitly mentioned. Never infer.
5. Exam toggles (pallor etc): only set true if present; false if explicitly absent.

PAEDIATRIC-SPECIFIC RULES (apply when age ≤ 16):
- Extract patientWeight: "12kg child" → "12", "weighs 20 kg" → "20". Always in kg as a string.
- Drug doses are weight-based: "paracetamol 15mg/kg" → dose:"15mg/kg". Include calculatedDose if weight is known.
- HEENT findings → examFindings.heent: "throat red", "bulging fontanelle", "sunken fontanelle", "ear discharge", "conjunctival pallor"
- Back exam → examFindings.back: "spinal tenderness", "sacral edema", "vertebral step-off"
- Condition at time of shift → dispositionSuggested.conditionAtShift: "stable for transfer" → "Stable"; "unstable" / "critical" / P1 → "Unstable"
- Full ABG panel — extract ALL values when blood gas is mentioned:
  abgStructured.po2, .be (base excess), .sao2, .fio2 (21 = room air), .na, .k, .cl, .ag (anion gap = Na - Cl - HCO3, normal 8–12), .glucose, .hb, .aaGradient
- Auto ABG interpretation: when abgStructured is populated, ALWAYS set finalAbgDiagnosis with a clinical interpretation:
  • pH <7.35 + low HCO3 → "Metabolic acidosis"  pH <7.35 + high pCO2 → "Respiratory acidosis"
  • pH >7.45 + high HCO3 → "Metabolic alkalosis"  pH >7.45 + low pCO2 → "Respiratory alkalosis"
  • Anion gap >12 → "High anion gap metabolic acidosis"  Lactate >2 → append "with elevated lactate"
  • Example: "Metabolic acidosis with elevated lactate (AG 18, pH 7.26, Lactate 5.2)"
- Age-appropriate vital flagging — in primarySurveyText note if HR or RR is outside range for age:
  HR ranges: <1yr 100–160; 1–3yr 90–150; 3–6yr 80–140; 6–12yr 70–120; 12+yr 60–100
  RR ranges: <1yr 30–60; 1–3yr 24–40; 3–6yr 22–34; 6–12yr 18–30; 12+yr 12–20
  BP (SBP): <1yr 70–100; 1–3yr 80–110; 3–6yr 80–110; 6–12yr 85–120; 12+yr 90–130
  Flag: "HR 160 — tachycardic for age (3yr)" in the C section of primarySurveyText
- Fontanelle findings in HEENT: "bulging fontanelle" → flag raised ICP; "sunken fontanelle" → flag dehydration
- Paediatric exam has no general toggles (pallor/icterus etc — do NOT set examStructured.general for paeds; include those findings in heent or general text instead)

REPLY EXAMPLES:
- case_update: "Captured — fever 2 days, vitals including temp 103°F, ABCDE assessment, medications, labs ordered, and admission plan documented."
- addendum: "Addendum added — vitals, differential diagnoses, and fluids updated."
- discharge_summary: "Discharge summary generated for ${ctx.name || 'this patient'}."
- referral: "Referral letter prepared."
- note: "Note added."

Always use the conversation history for context. Keep replies SHORT (1–2 sentences). Be clinical and direct.`;

      const history: { role: "user" | "assistant"; content: string }[] = Array.isArray(messages) ? messages : [];
      const chatMessages = [
        { role: "system" as const, content: systemPrompt },
        ...history.map((m: any) => ({ role: m.role as "user" | "assistant", content: String(m.content) })),
        { role: "user" as const, content: currentMessage },
      ];

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: chatMessages,
        response_format: { type: "json_object" },
        max_tokens: 3500,
        temperature: 0.3,
      });

      const raw = completion.choices[0]?.message?.content || "{}";
      let parsed: any = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { reply: "I processed your input but couldn't format the response. Please try again.", type: "general", extracted: null, specialContent: null };
      }

      res.json({
        reply: parsed.reply || "Understood.",
        type: parsed.type || "general",
        extracted: parsed.extracted || null,
        specialContent: parsed.specialContent || null,
      });
    } catch (error) {
      console.error("[CaseChat] error:", error);
      res.status(500).json({ error: (error as Error).message || "Chat failed" });
    }
  });

  app.post("/api/voice/save-case", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "No auth token" });

      const { patient, extracted: extractedInput, transcript, case_type, userId, userEmail } = req.body;

      if (!extractedInput) return res.status(400).json({ error: "No extracted data provided" });

      const ex = extractedInput as any;
      const vs = ex.vitalsSuggested || {};
      const ps = ex.primarySurvey || {};

      // Build vitals + triage
      const [sys, dia] = (vs.bp || (ps.circulation?.bpSystolic ? `${ps.circulation.bpSystolic}/${ps.circulation.bpDiastolic}` : "120/80")).split("/");
      const bpSys = parseInt(sys) || 120;
      const bpDia = parseInt(dia) || 80;
      const hr = parseInt(vs.hr || ps.circulation?.hr) || 80;
      const spo2 = parseInt(vs.spo2 || ps.breathing?.spo2) || 98;
      const rr = parseInt(vs.rr || ps.breathing?.rr) || 16;
      const gcs = parseInt(vs.gcs || ps.disability?.gcsTotal) || 15;
      const gcsE = parseInt(ps.disability?.gcsE) || 4;
      const gcsV = parseInt(ps.disability?.gcsV) || 5;
      const gcsM = parseInt(ps.disability?.gcsM) || 6;
      const grbs = parseInt(vs.grbs || ps.disability?.grbs) || 100;
      const temperature = parseFloat(vs.temperature || ps.exposure?.temperature) || 36.8;

      // Age-adjusted triage thresholds (pediatric-aware)
      // parseAgeToYears handles "8m"/"8 months" → 0.667, "4" → 4, "4y" → 4
      const _ageStr = String(patient?.age || "").toLowerCase().trim();
      const ptAge = (() => {
        if ((_ageStr.endsWith('m') || _ageStr.includes('mo') || _ageStr.includes('month')) &&
            !_ageStr.includes('yr') && !_ageStr.includes('year')) {
          return (parseFloat(_ageStr) || 0) / 12;
        }
        return parseFloat(_ageStr) || 99;
      })();
      let hrHigh: number, rrHigh: number, bpCrit: number, bpWarn: number;
      if (ptAge < 1)       { hrHigh = 160; rrHigh = 60; bpCrit = 60; bpWarn = 70; }
      else if (ptAge < 5)  { hrHigh = 140; rrHigh = 40; bpCrit = 60; bpWarn = 70; }
      else if (ptAge < 12) { hrHigh = 120; rrHigh = 30; bpCrit = 70; bpWarn = 80; }
      else if (ptAge < 16) { hrHigh = 100; rrHigh = 24; bpCrit = 75; bpWarn = 90; }
      else                 { hrHigh = 100; rrHigh = 20; bpCrit = 80; bpWarn = 100; }

      let triage_color = "green", triage_priority = 4;
      if (spo2 < 90 || gcs < 9 || bpSys < bpCrit) { triage_color = "red"; triage_priority = 1; }
      else if (spo2 < 94 || gcs < 13 || bpSys < bpWarn || hr > hrHigh || rr > rrHigh) { triage_color = "orange"; triage_priority = 2; }
      else if (spo2 < 96 || hr > Math.round(hrHigh * 0.85) || rr > Math.round(rrHigh * 1.2) || bpSys > 180) { triage_color = "yellow"; triage_priority = 3; }
      else if (hr > Math.round(hrHigh * 0.75) || rr > rrHigh) { triage_color = "green"; triage_priority = 4; }
      else { triage_color = "blue"; triage_priority = 5; }

      const vitals_at_arrival = { hr, bp_systolic: bpSys, bp_diastolic: bpDia, rr, spo2, temperature, gcs_e: gcsE, gcs_v: gcsV, gcs_m: gcsM, grbs, pain_score: 0 };
      const presenting_complaint = { text: ex.chiefComplaint || "", onset_type: ex.onset || "Sudden", duration: ex.duration || "", course: "" };
      const em_resident = ex.emResident || patient?.informant_name || "";
      const em_consultant = ex.emConsultant || "";

      // Create case
      const createRes = await fetch(`${EXTERNAL_API}/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ patient, presenting_complaint, vitals_at_arrival, triage_color, triage_priority, em_resident, em_consultant, case_type }),
      });
      if (!createRes.ok) {
        const errText = await createRes.text();
        return res.status(createRes.status).json({ error: `Failed to create case: ${errText}` });
      }
      const created = await createRes.json();
      const caseId = created.id || created._id || created.case_id;
      if (!caseId) return res.status(500).json({ error: "No case ID returned" });

      console.log("[VoiceSave] Case created:", caseId);

      // Build clinical payload (same as extract-and-save)
      const PMH_CONTINUATION = /^(baseline|with\s|grade\s|stage\s|class\s|on\s|per\s|approx|approximately|uncontrolled|controlled|bilateral|unilateral|and\s|or\s|at\s|from\s|since\s|till\s)/i;
      const splitPMHStr = (str: string): string[] => {
        const result: string[] = [];
        for (const chunk of str.split(/[;\n]+/)) {
          const parts = chunk.split(/,\s*/);
          let current = parts[0];
          for (let i = 1; i < parts.length; i++) {
            if (PMH_CONTINUATION.test(parts[i])) { current = current + ", " + parts[i]; }
            else { if (current.trim()) result.push(current.trim()); current = parts[i]; }
          }
          if (current.trim()) result.push(current.trim());
        }
        return result.filter(s => s.length > 0);
      };
      const pastMedRaw = ex.pastMedicalHistory;
      const pastMedArr: string[] = Array.isArray(pastMedRaw)
        ? pastMedRaw.map((s: string) => s.trim()).filter((s: string) => s)
        : typeof pastMedRaw === "string" && pastMedRaw ? splitPMHStr(pastMedRaw) : [];

      const symptomsArr: string[] = [];
      if (ex.symptoms?.length > 0) symptomsArr.push(...ex.symptoms);
      if (ex.associatedSymptoms) symptomsArr.push(ex.associatedSymptoms);
      const seenS = new Set<string>();
      const uniqueSymptoms = symptomsArr.filter(s => { const k = s.trim().toLowerCase(); if (seenS.has(k)) return false; seenS.add(k); return true; });

      const vbg = ex.vbgResults || {};
      const adjunctsAbg: Record<string, string> = {};
      if (vbg.ph)         adjunctsAbg.pH = vbg.ph;
      if (vbg.pco2)       adjunctsAbg.pCO2 = vbg.pco2;
      if (vbg.po2)        adjunctsAbg.pO2 = vbg.po2;
      if (vbg.hco3)       adjunctsAbg.HCO3 = vbg.hco3;
      if (vbg.be)         adjunctsAbg.BE = vbg.be;
      if (vbg.lactate)    adjunctsAbg.Lactate = vbg.lactate;
      if (vbg.hemoglobin) adjunctsAbg.Hb = vbg.hemoglobin;
      if (vbg.sodium)     adjunctsAbg.Na = vbg.sodium;
      if (vbg.potassium)  adjunctsAbg.K = vbg.potassium;
      if (vbg.chloride)   adjunctsAbg.Cl = vbg.chloride;
      if (vbg.glucose)    adjunctsAbg.Glucose = vbg.glucose;
      if (vbg.creatinine) adjunctsAbg.Creatinine = vbg.creatinine;
      if (vbg.bilirubin)  adjunctsAbg.Bilirubin = vbg.bilirubin;

      const adj = ex.adjuncts || {};
      const vbgNotesParts: string[] = [];
      if (vbg.sampleType) vbgNotesParts.push(vbg.sampleType);
      Object.entries(adjunctsAbg).forEach(([k, v]) => vbgNotesParts.push(`${k}: ${v}`));

      const invOrdered = ex.investigationsOrdered || "";
      const invTests: string[] = invOrdered ? invOrdered.split(/[,;\/\n]+/).map((s: string) => s.trim()).filter((s: string) => s) : [];

      const updateRes = await fetch(`${EXTERNAL_API}/cases/${caseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({
          history: {
            hpi: ex.historyOfPresentIllness || transcript || "",
            events_hopi: ex.historyOfPresentIllness || transcript || "",
            signs_and_symptoms: uniqueSymptoms.join(", "),
            past_medical: pastMedArr,
            past_surgical: ex.pastSurgicalHistory || "",
            allergies: ex.allergies ? ex.allergies.split(/[,;]+/).map((s: string) => s.trim()).filter((s: string) => s) : [],
            medications: ex.currentMedications || "",
            drug_history: ex.currentMedications || "",
            family_history: ex.familyHistory || "",
            social_history: ex.socialHistory || "",
            additional_notes: ex.menstrualHistory || "",
          },
          sample: {
            eventsHopi: ex.historyOfPresentIllness || transcript || "",
            signsSymptoms: uniqueSymptoms.join(", "),
            pastMedicalHistory: pastMedArr,
            allergies: ex.allergies ? ex.allergies.split(/[,;]+/).map((s: string) => s.trim()).filter((s: string) => s) : [],
            medications: ex.currentMedications || "",
            lastMeal: ex.lastMeal || "", lmp: ex.menstrualHistory || "",
          },
          primary_assessment: {
            airway_status: ps.airway?.status || "Patent", airway_interventions: [], airway_additional_notes: ps.airway?.findings || "",
            breathing_rr: rr, breathing_spo2: spo2, breathing_oxygen_device: ps.breathing?.oxygenDevice || "Room air",
            breathing_oxygen_flow: 0, breathing_work: ps.breathing?.workOfBreathing || "Normal",
            breathing_air_entry: ["Equal"], breathing_additional_notes: ps.breathing?.auscultation || "",
            circulation_hr: hr, circulation_bp_systolic: bpSys, circulation_bp_diastolic: bpDia, circulation_crt: 2,
            circulation_adjuncts: ps.circulation?.ivAccess ? [ps.circulation.ivAccess] : [],
            circulation_additional_notes: ps.circulation?.cvs || "",
            disability_avpu: "Alert", disability_gcs_e: gcsE, disability_gcs_v: gcsV, disability_gcs_m: gcsM,
            disability_grbs: grbs, disability_pupils_size: "Normal", disability_pupils_reaction: "Reactive",
            disability_additional_notes: ps.disability?.focalDeficit || "",
            exposure_temperature: temperature, exposure_additional_notes: ps.exposure?.findings || "",
          },
          abcde: {
            airway: { status: ps.airway?.status || "Patent", notes: ps.airway?.findings || "", abcdeStatus: "stable" },
            breathing: { rr, spo2, oxygenDevice: ps.breathing?.oxygenDevice || "Room air", effort: "Normal", notes: ps.breathing?.auscultation || "", abcdeStatus: "stable" },
            circulation: { hr, bpSystolic: bpSys, bpDiastolic: bpDia, capillaryRefill: "Normal", notes: ps.circulation?.cvs || "", abcdeStatus: "stable" },
            disability: { motorResponse: "Alert", gcsE: String(gcsE), gcsV: String(gcsV), gcsM: String(gcsM), glucose: String(grbs), pupils: "Equal", pupilReaction: "Reactive", notes: "", abcdeStatus: "stable" },
            exposure: { temperature: String(temperature), findings: ps.exposure?.findings || "", notes: "", abcdeStatus: "stable" },
          },
          adjuncts: {
            ecg_status: adj.ecgDone ? "Done" : "", ecg_findings: adj.ecgFindings || "",
            bedside_echo: adj.echoDone ? (adj.echoFindings || "Done") : "",
            efast_status: adj.efastDone ? "Done" : "", efast_notes: adj.efastFindings || "",
            additional_notes: vbgNotesParts.join(" | "),
            abg: {
              sample_type: vbg.sampleType || (vbg.ph ? "VBG" : ""),
              ph: vbg.ph || "", pco2: vbg.pco2 || "", po2: vbg.po2 || "",
              hco3: vbg.hco3 || "", be: vbg.be || "", lactate: vbg.lactate || "",
              sao2: "", fio2: "", na: vbg.sodium || "", k: vbg.potassium || "",
              cl: vbg.chloride || "", anion_gap: "", glucose: vbg.glucose || "",
              hb: vbg.hemoglobin || "", aa_gradient: "",
              status: vbg.ph ? "done" : "", interpretation: "", final_diagnosis: "",
            },
          },
          examination: {
            general_pallor: false, general_icterus: false, general_cyanosis: false, general_clubbing: false,
            general_lymphadenopathy: false, general_edema: false, general_additional_notes: ex.examFindings?.general || "",
            cvs_status: "Normal", cvs_s1_s2: "Normal", cvs_pulse: "Regular", cvs_pulse_rate: hr,
            cvs_apex_beat: "Normal", cvs_added_sounds: "", cvs_murmurs: "", cvs_additional_notes: ex.examFindings?.cvs || "",
            respiratory_status: "Normal", respiratory_expansion: "Equal", respiratory_percussion: "Resonant",
            respiratory_breath_sounds: "Vesicular", respiratory_vocal_resonance: "Normal", respiratory_added_sounds: "",
            respiratory_additional_notes: ex.examFindings?.respiratory || "",
            abdomen_status: "Normal", abdomen_umbilical: "Normal", abdomen_organomegaly: "", abdomen_percussion: "Tympanic",
            abdomen_bowel_sounds: "Present", abdomen_additional_notes: ex.examFindings?.abdomen || "",
            cns_status: "Normal", cns_higher_mental: "Intact", cns_cranial_nerves: "Intact", cns_sensory_system: "Intact",
            cns_motor_system: "Normal", cns_reflexes: "Normal", cns_additional_notes: ex.examFindings?.cns || "",
            extremities_status: "Normal", extremities_findings: ex.examFindings?.musculoskeletal || "",
          },
          investigations: {
            panels_selected: invTests,
            imaging: ex.imagingOrdered ? [ex.imagingOrdered] : [],
            results_notes: invOrdered || "",
            ...(Object.keys(adjunctsAbg).length > 0 ? { vbg: adjunctsAbg } : {}),
          },
          treatment: {
            primary_diagnosis: ex.diagnosis?.[0] || "",
            provisional_diagnoses: ex.diagnosis?.length ? ex.diagnosis : [],
            differential_diagnoses: ex.differentialDiagnosis?.length ? ex.differentialDiagnosis : [],
            medications: ex.prescribedMedications || [],
            infusions: ex.prescribedInfusions || [],
            fluids: ex.prescribedInfusions?.map((inf: any) => `${inf.name || ""}${inf.rate ? ` @ ${inf.rate}` : ""}`).join(", ") || "",
            other_medications: ex.treatmentNotes || "",
            intervention_notes: ex.treatmentNotes || "",
          },
          presenting_complaint,
          mode_of_arrival: patient?.mode_of_arrival || "Walk-in",
          mlc: false,
          psychological: {
            assessed: false, suicidalIdeation: false, selfHarm: false,
            intentToHarmOthers: false, substanceAbuse: false, psychiatricHistory: false,
            currentlyOnPsychiatricTreatment: false, hasSupportSystem: true, notes: "",
          },
        }),
      });

      if (!updateRes.ok) {
        const errText = await updateRes.text();
        console.warn("[VoiceSave] Clinical PUT failed:", updateRes.status, errText);
        return res.json({ success: true, caseId, warning: "Case created — some clinical fields may need manual entry." });
      }

      console.log("[VoiceSave] Clinical data saved for case:", caseId);

      // Local DB (best-effort)
      try {
        const db = getDb();
        if (db && userId) {
          const { caseClinicalData } = await import("@shared/schema");
          await db.insert(caseClinicalData).values({ caseId, userId, payload: { extracted: extractedInput, transcript } });
        }
      } catch {}

      // Subscription count (best-effort)
      if (userId) {
        try {
          const { incrementCaseCount } = await import("./services/subscription");
          await incrementCaseCount(userId, userEmail || "");
        } catch {}
      }

      return res.json({ success: true, caseId });
    } catch (err: any) {
      console.error("[VoiceSave] Error:", err);
      return res.status(500).json({ success: false, error: err.message || "Save failed" });
    }
  });

  app.post("/api/scan/document", upload.single('document'), async (req: Request, res: Response) => {
    try {
      const file = req.file;
      console.log("[Doc Scan] Request received, file:", file ? `${file.originalname} (${file.mimetype}, ${file.size} bytes)` : "none");
      if (!file) {
        return res.status(400).json({ error: "No document file provided" });
      }

      const scanUserId = req.body.userId as string | undefined;

      let patientContext;
      if (req.body.patientContext) {
        try { patientContext = JSON.parse(req.body.patientContext); } catch { patientContext = undefined; }
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
            const OpenAI = (await import("openai")).default;
            const openai = new OpenAI({ apiKey, baseURL });
            const visionResponse = await openai.chat.completions.create({
              model: "gpt-4o",
              messages: [
                {
                  role: "system",
                  content: "You are a medical document OCR system. Extract ALL text from the provided medical document image exactly as written. Include all values, numbers, units, dates, and labels. Output the raw extracted text only, no commentary.",
                },
                {
                  role: "user",
                  content: [
                    { type: "text", text: "Extract all text from this medical document:" },
                    { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
                  ],
                },
              ],
              max_tokens: 4096,
            });
            parsedText = visionResponse.choices[0]?.message?.content || "";
            console.log("[Doc Scan] OpenAI Vision OCR done, text length:", parsedText.length);
          } catch (visionErr) {
            console.warn("[Doc Scan] OpenAI Vision failed, trying Sarvam fallback:", (visionErr as Error).message);
          }
        }

        if (!parsedText) {
          const { isSarvamAvailable, sarvamParsePDF } = await import("./services/sarvamAI");
          if (isSarvamAvailable()) {
            console.log("[Doc Scan] Using Sarvam AI fallback...");
            try {
              const { default: PDFDocument } = await import("pdfkit");
              const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
                const doc = new PDFDocument({ size: "A4" });
                const chunks: Buffer[] = [];
                doc.on("data", (chunk: Buffer) => chunks.push(chunk));
                doc.on("end", () => resolve(Buffer.concat(chunks)));
                doc.on("error", reject);
                doc.image(file.buffer, 0, 0, { fit: [595, 842], align: "center", valign: "center" });
                doc.end();
              });
              parsedText = await sarvamParsePDF(pdfBuffer, 1);
              console.log("[Doc Scan] Sarvam OCR done, text length:", parsedText.length);
            } catch (sarvamErr) {
              console.warn("[Doc Scan] Sarvam fallback also failed:", (sarvamErr as Error).message);
            }
          }
        }
      } else {
        const { isSarvamAvailable, sarvamParsePDF } = await import("./services/sarvamAI");
        if (isSarvamAvailable()) {
          console.log("[Doc Scan] PDF document, using Sarvam AI...");
          parsedText = await sarvamParsePDF(file.buffer, parseInt(req.body.pageNumber) || 1);
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
        structured,
      });
    } catch (error) {
      console.error("Document scan error:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to scan document" });
    }
  });

  app.get("/api/sarvam/status", async (_req: Request, res: Response) => {
    const { isSarvamAvailable } = await import("./services/sarvamAI");
    res.json({ available: isSarvamAvailable() });
  });

  app.post("/api/treatment-history/save", async (req: Request, res: Response) => {
    try {
      const { userId, diagnosis, medications, infusions, patientAge, patientSex, caseId } = req.body;
      
      if (!diagnosis || (!medications?.length && !infusions?.length)) {
        return res.status(400).json({ error: "Diagnosis and at least one medication/infusion required" });
      }

      const { getDb } = await import("./db");
      const db = getDb();
      if (!db) {
        return res.status(503).json({ error: "Database not available" });
      }
      const { treatmentHistory } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      const ageGroup = parseInt(patientAge) <= 16 ? "pediatric" : "adult";
      const savedItems: any[] = [];

      for (const med of (medications || [])) {
        const existing = await db.select().from(treatmentHistory)
          .where(and(
            eq(treatmentHistory.diagnosis, diagnosis),
            eq(treatmentHistory.drugName, med.name),
            eq(treatmentHistory.drugType, "medication")
          ))
          .limit(1);

        if (existing.length > 0) {
          await db.update(treatmentHistory)
            .set({ 
              usageCount: (existing[0].usageCount || 1) + 1,
              updatedAt: new Date()
            })
            .where(eq(treatmentHistory.id, existing[0].id));
          savedItems.push({ ...existing[0], updated: true });
        } else {
          const newRecord = await db.insert(treatmentHistory).values({
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
            caseId,
          }).returning();
          savedItems.push(newRecord[0]);
        }
      }

      for (const inf of (infusions || [])) {
        const existing = await db.select().from(treatmentHistory)
          .where(and(
            eq(treatmentHistory.diagnosis, diagnosis),
            eq(treatmentHistory.drugName, inf.name),
            eq(treatmentHistory.drugType, "infusion")
          ))
          .limit(1);

        if (existing.length > 0) {
          await db.update(treatmentHistory)
            .set({ 
              usageCount: (existing[0].usageCount || 1) + 1,
              updatedAt: new Date()
            })
            .where(eq(treatmentHistory.id, existing[0].id));
          savedItems.push({ ...existing[0], updated: true });
        } else {
          const newRecord = await db.insert(treatmentHistory).values({
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
            caseId,
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

  app.get("/api/treatment-history/recommendations", async (req: Request, res: Response) => {
    try {
      const { diagnosis, ageGroup, limit = "10" } = req.query;
      
      if (!diagnosis) {
        return res.status(400).json({ error: "Diagnosis is required" });
      }

      const { getDb } = await import("./db");
      const db = getDb();
      if (!db) {
        return res.status(503).json({ error: "Database not available" });
      }
      const { treatmentHistory } = await import("@shared/schema");
      const { eq, and, ilike, desc } = await import("drizzle-orm");

      let results: any[] = [];
      
      if (ageGroup && (ageGroup === "pediatric" || ageGroup === "adult")) {
        results = await db.select().from(treatmentHistory)
          .where(and(
            ilike(treatmentHistory.diagnosis, `%${diagnosis}%`),
            eq(treatmentHistory.ageGroup, ageGroup as string)
          ))
          .orderBy(desc(treatmentHistory.usageCount))
          .limit(parseInt(limit as string));
      } else {
        results = await db.select().from(treatmentHistory)
          .where(ilike(treatmentHistory.diagnosis, `%${diagnosis}%`))
          .orderBy(desc(treatmentHistory.usageCount))
          .limit(parseInt(limit as string));
      }

      const medications = results.filter((r: any) => r.drugType === "medication");
      const infusions = results.filter((r: any) => r.drugType === "infusion");

      res.json({ 
        success: true, 
        recommendations: {
          medications: medications.map((m: any) => ({
            name: m.drugName,
            dose: m.dose,
            route: m.route,
            frequency: m.frequency,
            usageCount: m.usageCount,
          })),
          infusions: infusions.map((i: any) => ({
            name: i.drugName,
            dose: i.dose,
            dilution: i.dilution,
            rate: i.rate,
            usageCount: i.usageCount,
          })),
        }
      });
    } catch (error) {
      console.error("Treatment recommendations error:", error);
      res.status(500).json({ error: "Failed to get recommendations" });
    }
  });

  app.get("/api/subscription/status", async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const userEmail = req.query.userEmail as string;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      const sub = await getOrCreateSubscription(userId, userEmail || "");
      const isTrial = sub.plan === "trial";
      const isPaid = sub.plan !== "free" && sub.plan !== "trial";
      res.json({
        plan: sub.plan,
        status: sub.status,
        casesUsed: sub.casesUsed,
        casesLimit: sub.casesLimit,
        casesRemaining: sub.plan === "free" ? Math.max(0, sub.casesLimit - sub.casesUsed) : null,
        currentPeriodEnd: sub.currentPeriodEnd,
        priceInr: PREMIUM_PRICE_INR,
        freeCaseLimit: FREE_CASE_LIMIT,
        isTrial,
        trialEnd: isTrial ? sub.currentPeriodEnd : null,
      });
    } catch (error) {
      console.error("Subscription status error:", error);
      res.status(500).json({ error: "Failed to get subscription status" });
    }
  });

  app.post("/api/subscription/check-case", async (req: Request, res: Response) => {
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

  app.post("/api/subscription/increment-case", async (req: Request, res: Response) => {
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

  app.post("/api/subscription/activate-premium", async (req: Request, res: Response) => {
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

  app.post("/api/subscription/cancel", async (req: Request, res: Response) => {
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

  app.post("/api/subscription/create-checkout", async (req: Request, res: Response) => {
    try {
      const { plan, billingCycle } = req.body as { plan: string; billingCycle: string };
      if (!["base", "pro"].includes(plan)) {
        return res.status(400).json({ error: "Invalid plan" });
      }
      if (!["monthly", "annual"].includes(billingCycle)) {
        return res.status(400).json({ error: "Invalid billing cycle" });
      }

      const authHeader = req.headers.authorization;
      const token = authHeader?.replace("Bearer ", "") || "";

      let userId = "";
      let userEmail = "";
      let userName = "";
      try {
        const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
        userId = payload.sub || payload.id || "";
        userEmail = payload.email || "";
        userName = payload.name || payload.fullName || "";
      } catch { /* token not parseable – proceed without */ }

      const amountPaise = PLAN_AMOUNTS_PAISE[plan as "base" | "pro"][billingCycle as "monthly" | "annual"];
      const planLabel = plan === "base" ? "Base" : "Pro";
      const cycleLabel = billingCycle === "annual" ? "Annual" : "Monthly";
      const description = `ErMate ${planLabel} Plan — ${cycleLabel}`;

      const domain = "ermate.in";
      const callbackUrl = `https://${domain}/payment-callback?plan=${plan}&cycle=${billingCycle}`;
      const ts = Date.now().toString().slice(-10);
      const uid = (userId || "anon").slice(-8);
      const referenceId = `sub_${uid}_${plan[0]}${billingCycle[0]}_${ts}`;

      const { url, id } = await createPaymentLink({
        amountPaise,
        description,
        customerEmail: userEmail || undefined,
        customerName: userName || undefined,
        referenceId,
        callbackUrl,
        notes: { userId, plan, cycle: billingCycle, userEmail },
      });

      console.log(`[Razorpay] Payment link created: ${id} for user=${userId} plan=${plan} cycle=${billingCycle}`);
      return res.json({ url });
    } catch (error) {
      console.error("[Razorpay] Checkout error:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  app.post("/api/subscription/team/checkout", async (req: Request, res: Response) => {
    try {
      const { consultants = 0, residents = 0, billingCycle = "monthly" } = req.body as {
        consultants: number; residents: number; billingCycle: string;
      };
      const totalDrs = consultants + residents;
      if (totalDrs < 4) return res.status(400).json({ error: "Minimum 4 doctors required" });

      const authHeader = req.headers.authorization;
      const token = authHeader?.replace("Bearer ", "") || "";
      let userId = "";
      let userEmail = "";
      let userName = "";
      try {
        const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
        userId = payload.sub || payload.id || "";
        userEmail = payload.email || "";
        userName = payload.name || payload.fullName || "";
      } catch { /* non-fatal */ }

      // Calculate amount in paise
      const consultantRateMonthly = 59900;  // ₹599 in paise
      const residentRateMonthly   = 39900;  // ₹399 in paise
      const consultantRateAnnual  = 599000; // ₹5990 in paise
      const residentRateAnnual    = 399000; // ₹3990 in paise

      const amountPaise = billingCycle === "annual"
        ? (consultants * consultantRateAnnual) + (residents * residentRateAnnual)
        : (consultants * consultantRateMonthly) + (residents * residentRateMonthly);

      const amountRs = Math.round(amountPaise / 100);
      const cycleLabel = billingCycle === "annual" ? "Annual" : "Monthly";
      const description = `ErMate Team Plan — ${consultants}C + ${residents}R · ${cycleLabel} · ₹${amountRs.toLocaleString("en-IN")}`;

      const domain = "ermate.in";
      const callbackUrl = `https://${domain}/payment-callback?plan=team&cycle=${billingCycle}`;
      const ts = Date.now().toString().slice(-10);
      const uid = (userId || "anon").slice(-8);
      const referenceId = `team_${uid}_${ts}`;

      const { url, id } = await createPaymentLink({
        amountPaise,
        description,
        customerEmail: userEmail || undefined,
        customerName: userName || undefined,
        referenceId,
        callbackUrl,
        notes: {
          userId,
          type: "team",
          plan: "team",
          cycle: billingCycle,
          consultants: String(consultants),
          residents: String(residents),
          userEmail,
        },
      });

      console.log(`[Razorpay] Team link created: ${id} user=${userId} ${consultants}C+${residents}R ${billingCycle}`);
      return res.json({ url });
    } catch (error) {
      console.error("[Razorpay] Team checkout error:", error);
      res.status(500).json({ error: "Failed to create team checkout" });
    }
  });

  app.post("/api/webhooks/razorpay", async (req: Request, res: Response) => {
    try {
      const signature = req.headers["x-razorpay-signature"] as string || "";
      const rawBody = JSON.stringify(req.body);

      if (process.env.RAZORPAY_WEBHOOK_SECRET) {
        const valid = verifyWebhookSignature(rawBody, signature);
        if (!valid) {
          console.warn("[Razorpay] Invalid webhook signature");
          return res.status(400).json({ error: "Invalid signature" });
        }
      }

      const event = req.body?.event as string;
      const payload = req.body?.payload;

      console.log(`[Razorpay] Webhook event: ${event}`);

      if (event === "payment_link.paid") {
        const linkEntity = payload?.payment_link?.entity;
        const notes = linkEntity?.notes as Record<string, string> | undefined;
        const userId = notes?.userId;
        const plan = notes?.plan as "base" | "pro" | undefined;
        const cycle = (notes?.cycle || "monthly") as "monthly" | "annual";
        const paymentLinkId = linkEntity?.id as string;

        if (userId && plan && ["base", "pro"].includes(plan)) {
          await activatePlan(userId, plan, cycle, paymentLinkId);
          console.log(`[Razorpay] Plan activated: userId=${userId} plan=${plan} cycle=${cycle}`);
        }
      }

      if (event === "subscription.activated") {
        const subEntity = payload?.subscription?.entity;
        const notes = subEntity?.notes as Record<string, string> | undefined;
        const userId = notes?.userId;
        const plan = (notes?.plan || "pro") as "base" | "pro";
        const cycle = (notes?.cycle || "monthly") as "monthly" | "annual";
        if (userId) {
          await activatePlan(userId, plan, cycle);
          console.log(`[Razorpay] Subscription activated: userId=${userId}`);
        }
      }

      if (event === "subscription.charged") {
        // Razorpay fires this each billing cycle for active subscriptions — extend Pro by one period
        const subEntity = payload?.subscription?.entity;
        const notes = subEntity?.notes as Record<string, string> | undefined;
        const userId = notes?.userId;
        const cycle = (notes?.cycle || "monthly") as "monthly" | "annual";
        const plan = (notes?.plan || "pro") as "base" | "pro";
        if (userId) {
          await activatePlan(userId, plan, cycle);
          console.log(`[Razorpay] subscription.charged — extended: userId=${userId} plan=${plan}`);
        }
      }

      if (event === "payment.captured") {
        // Handle team plan payment captured via payment link
        const paymentEntity = payload?.payment?.entity;
        const notes = paymentEntity?.notes as Record<string, string> | undefined;
        const type = notes?.type;
        const userId = notes?.userId;
        if (type === "team" && userId) {
          // Team activation goes through the department setup flow in the app.
          // Log here so support can manually activate if webhook is missed.
          console.log(`[Razorpay] Team payment captured: userId=${userId} consultants=${notes?.consultants} residents=${notes?.residents} cycle=${notes?.cycle}`);
        }
      }

      if (event === "subscription.cancelled") {
        const subEntity = payload?.subscription?.entity;
        const notes = subEntity?.notes as Record<string, string> | undefined;
        const userId = notes?.userId;
        if (userId) {
          await cancelSubscription(userId);
          console.log(`[Razorpay] Subscription cancelled: userId=${userId}`);
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error("[Razorpay] Webhook error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  app.get("/payment-callback", (req: Request, res: Response) => {
    const status = req.query.razorpay_payment_link_status as string || "";
    const plan = req.query.plan as string || "";
    const cycle = req.query.cycle as string || "";
    const paid = status === "paid";

    const title = paid
      ? `${plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : ""} Plan Activated!`
      : "Payment Pending";

    const subtitle = paid
      ? `Your ${cycle === "annual" ? "annual" : "monthly"} subscription is now active. Return to the ErMate app to get started.`
      : "Your payment is being processed. Return to the ErMate app — your account will be updated shortly.";

    const color = paid ? "#1DB870" : "#F59E0B";
    const icon = paid ? "✓" : "⏳";

    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ErMate Payment</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #F5F6F8; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    .card { background: white; border-radius: 20px; padding: 40px 32px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .icon { width: 72px; height: 72px; border-radius: 50%; background: ${color}18; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 32px; }
    h1 { font-size: 22px; font-weight: 700; color: #0D1117; margin-bottom: 12px; }
    p { font-size: 15px; color: #6B7280; line-height: 1.6; margin-bottom: 28px; }
    .btn { display: inline-block; background: ${color}; color: white; font-size: 16px; font-weight: 600; padding: 14px 28px; border-radius: 12px; text-decoration: none; }
    .brand { margin-top: 24px; font-size: 13px; color: #9CA3AF; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${subtitle}</p>
    <a href="ermate://" class="btn">Return to ErMate</a>
    <div class="brand">ErMate by Varah Group</div>
  </div>
</body>
</html>`);
  });

  app.get("/reset-password", (_req: Request, res: Response) => {
    const path = require("path");
    const fs = require("fs");
    const filePath = path.join(__dirname, "templates", "reset-password.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.send(fs.readFileSync(filePath, "utf8"));
  });

  app.get("/api/em-reference/topics", (_req: Request, res: Response) => {
    res.json(EM_TOPICS);
  });

  app.post("/api/em-reference/chat", async (req: Request, res: Response) => {
    try {
      const { messages, topic, userId } = req.body as {
        messages: EMReferenceMessage[];
        topic?: string;
        userId?: string;
      };

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

  app.post("/api/em-reference/feedback", async (req: Request, res: Response) => {
    try {
      const { messageId, query, response, topic, feedbackType, feedbackComment, userId } = req.body;

      if (!messageId || !query || !response || !feedbackType) {
        return res.status(400).json({ error: "messageId, query, response, and feedbackType are required" });
      }

      if (!["helpful", "not_helpful"].includes(feedbackType)) {
        return res.status(400).json({ error: "feedbackType must be 'helpful' or 'not_helpful'" });
      }

      const db = getDb()!;
      await db.insert(emReferenceFeedback).values({
        messageId,
        query,
        response,
        topic: topic || null,
        feedbackType,
        feedbackComment: feedbackComment || null,
        userId: userId || null,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("[EMReference] Feedback error:", error);
      res.status(500).json({ error: "Failed to save feedback" });
    }
  });

  app.get("/api/em-reference/feedback/stats", async (_req: Request, res: Response) => {
    try {
      const db = getDb()!;
      const helpful = await db.select({ count: count() }).from(emReferenceFeedback).where(eq(emReferenceFeedback.feedbackType, "helpful"));
      const notHelpful = await db.select({ count: count() }).from(emReferenceFeedback).where(eq(emReferenceFeedback.feedbackType, "not_helpful"));

      res.json({
        helpful: helpful[0]?.count || 0,
        notHelpful: notHelpful[0]?.count || 0,
        total: (helpful[0]?.count || 0) + (notHelpful[0]?.count || 0),
      });
    } catch (error) {
      console.error("[EMReference] Feedback stats error:", error);
      res.status(500).json({ error: "Failed to get feedback stats" });
    }
  });

  app.post("/api/feedback", async (req: Request, res: Response) => {
    try {
      const { userId, userEmail, userName, category, message, platform, appVersion } = req.body;
      if (!message || !message.trim()) {
        return res.status(400).json({ error: "Feedback message is required" });
      }
      const db = getDb()!;
      const [inserted] = await db.insert(userFeedback).values({
        userId: userId || null,
        userEmail: userEmail || null,
        userName: userName || null,
        category: category || "general",
        message: message.trim(),
        platform: platform || null,
        appVersion: appVersion || null,
      }).returning();
      res.json({ success: true, id: inserted.id });
    } catch (error) {
      console.error("[Feedback] Error saving feedback:", error);
      res.status(500).json({ error: "Failed to save feedback" });
    }
  });

  app.get("/api/feedback", async (_req: Request, res: Response) => {
    try {
      const db = getDb()!;
      const items = await db.select().from(userFeedback).orderBy(desc(userFeedback.createdAt)).limit(100);
      res.json(items);
    } catch (error) {
      console.error("[Feedback] Error fetching feedback:", error);
      res.status(500).json({ error: "Failed to fetch feedback" });
    }
  });

  app.post("/api/rounds/debrief", async (req: Request, res: Response) => {
    try {
      const { caseData, mode, userId } = req.body;
      if (!caseData || !mode) {
        return res.status(400).json({ error: "caseData and mode are required" });
      }
      const text = await generateRoundsDebrief(caseData, mode);
      res.json({ text });
    } catch (error) {
      console.error("[Rounds] Debrief error:", error);
      res.status(500).json({ error: "Failed to generate debrief" });
    }
  });

  registerDepartmentRoutes(app);
  registerShiftRoutes(app);
  registerEscalationRoutes(app);

  const httpServer = existingServer ?? createServer(app);

  return httpServer;
}
