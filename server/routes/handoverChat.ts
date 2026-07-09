import type { Express, Request, Response } from "express";
import { extractUserId } from "../lib/auth";
import { getPool } from "../db";

const HANDOVER_CHAT_SYSTEM_PROMPT = `You are ErMate Handover — a conversational clinical AI assistant for emergency department shift handovers in Indian hospitals.

Your job, across the whole conversation:
1. Listen to the doctor describe their patients in any language, any format, any order, any length.
2. Extract each patient's information and keep a running, up-to-date list.
3. Ask a small number of smart follow-up questions once you have an initial set of patients.
4. Apply corrections and additions the doctor makes conversationally.
5. Signal when the handover is ready to be finalized into a document.

EXTRACTION — for each patient, track these exact keys (this mirrors the standard hospital "ER Doctors Handover Sheet" paper form, so map to it faithfully):
- bedNumber: string ("Not mentioned" if absent)
- patientName: string ("Unknown" if not given)
- age: string ("" if not given)
- sex: string ("M" | "F" | "")
- presentingComplaints: string (the "Presenting complaints" the patient came in with — chief complaint at the door, distinct from working diagnosis)
- pastMedicalHistory: string (the "Past medical history" column — known comorbidities, prior surgeries, chronic conditions; "Nil known" if explicitly none, "" if not mentioned)
- diagnosis: string (the "Provisional diagnosis" column — working diagnosis)
- status: one of "critical" | "unstable" | "stable" | "for_discharge" — infer clinically
- vitals: object with optional string fields: bp, hr, spo2, rr, temp (only include ones actually mentioned)
- activeIssues: string[] (what's currently running/happening — infusions, lines, active problems)
- medications: string[] (running infusions or critical drugs currently administered)
- managementDone: string[] (the "Management plan — Done" column — actions/treatment already completed this shift)
- pendingTasks: string[] (the "Management plan — To be done" column — what the receiving/night team must still do)
- criticalAlerts: string[] (allergies, DNR, high-risk drugs — anything that must not be missed)
- awaitingResults: string[] (pending investigations / results)
- bystanderUpdateTime: string (the "Bystander Update given time" column — when the attender/family was last updated, e.g. "14:30"; "" if not mentioned)

LANGUAGE: Understand Hindi, Malayalam, Tamil, Kannada, Telugu, Marathi, Punjabi, Bengali, English, and any mix. Always respond in English.

CONVERSATION FLOW:
- Turn 1 (doctor dumps patient info): extract everything you can into "patients". In "reply", briefly confirm what you captured (e.g. "Got it. Here are your N patients structured.").
- If askedFollowUp is currently false and you now have at least one patient: in the SAME reply, ask up to 3 short, high-value follow-up questions as a numbered list — prioritize: allergies for patients on high-alert drugs, who is receiving the handover (receivingDoctor), and whether anyone is for discharge tonight. Set askedFollowUp to true.
- If the doctor is answering follow-up questions or says something like "that's it", "done", "generate", "finish", "ready": incorporate any final details (e.g. receivingDoctor field, remove discharged patients or mark them for_discharge), set readyToFinalize to true, and reply with a short confirmation like "Perfect. Handover ready."
- If the doctor gives a correction ("actually bed 3 is female", "change bed 7 OT time to midnight") or an addition ("add one more patient..."), update ONLY the relevant patient(s) in the full patients array, keep everyone else unchanged, briefly confirm the change in "reply", and keep readyToFinalize as false unless they also indicate they're done.
- Never invent information not given by the doctor. If nothing has been said yet, "reply" should be the opening prompt: "Tell me about your patients. Speak or type — any order, any language, as much as you want. I'll structure it."

CRITICAL: You must return the FULL current list of patients every turn (not just the changed one) — the array you return replaces the previous one entirely.

RESPONSE FORMAT — respond ONLY as a valid JSON object, nothing else:
{
  "reply": "conversational message to show the doctor (can include a numbered follow-up question list as plain text with line breaks)",
  "patients": [ ...full current patient list, using the schema above... ],
  "receivingDoctor": "name of doctor receiving the handover, or empty string if not yet known",
  "askedFollowUp": boolean,
  "readyToFinalize": boolean
}`;

export function registerHandoverChatRoutes(app: Express): void {
  // ── POST /api/handover/chat ─────────────────────────────────────────────────
  app.post("/api/handover/chat", async (req: Request, res: Response) => {
    try {
      const { messages, currentMessage, askedFollowUp, handoverId, fromDoctorName } = req.body as {
        messages?: { role: "user" | "assistant"; content: string }[];
        currentMessage?: string;
        askedFollowUp?: boolean;
        handoverId?: string;
        fromDoctorName?: string;
      };

      if (!currentMessage || typeof currentMessage !== "string" || !currentMessage.trim()) {
        return res.status(400).json({ error: "No message provided" });
      }

      const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
      const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      if (!apiKey || !baseURL) {
        return res.status(503).json({ error: "Handover chat is temporarily unavailable. Please try again shortly." });
      }

      const userId = extractUserId(req);
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey, baseURL });

      const history = Array.isArray(messages) ? messages.slice(-20) : [];
      const fullHistory = Array.isArray(messages) ? messages : [];
      const stateNote = `\n\n[Conversation state: askedFollowUp=${askedFollowUp ? "true" : "false"}]`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: HANDOVER_CHAT_SYSTEM_PROMPT + stateNote },
          ...history.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: currentMessage },
        ],
        max_tokens: 2500,
        temperature: 0.3,
      });

      const raw = completion.choices[0]?.message?.content || "{}";
      let parsed: {
        reply?: string;
        patients?: unknown[];
        receivingDoctor?: string;
        askedFollowUp?: boolean;
        readyToFinalize?: boolean;
      };
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = {};
      }

      console.log(`[HandoverChat] userId=${userId || "anon"} chars=${currentMessage.length} patients=${Array.isArray(parsed.patients) ? parsed.patients.length : 0}`);

      const patients = Array.isArray(parsed.patients) ? parsed.patients : [];
      const criticalCount = (patients as any[]).filter((p) =>
        p?.status === "critical" || p?.status === "unstable"
      ).length;

      const responsePayload: {
        reply: string;
        patients: unknown[];
        receivingDoctor: string;
        askedFollowUp: boolean;
        readyToFinalize: boolean;
        sessionId?: string;
      } = {
        reply: parsed.reply || "I didn't quite catch that — could you tell me about your patients again?",
        patients,
        receivingDoctor: parsed.receivingDoctor || "",
        askedFollowUp: !!parsed.askedFollowUp,
        readyToFinalize: !!parsed.readyToFinalize,
      };

      // Persist the session server-side (upsert on active session for this user/handoverId)
      if (userId) {
        const p = getPool();
        if (p) {
          const updatedMessages = [
            ...fullHistory,
            { role: "user", content: currentMessage },
            { role: "assistant", content: responsePayload.reply },
          ];
          if (handoverId) {
            // Update a specific session by id
            await p.query(
              `UPDATE handover_sessions
               SET messages = $1, patients = $2, receiving_doctor = $3,
                   asked_follow_up = $4, ready_to_finalize = $5,
                   patient_count = $6, critical_count = $7,
                   to_doctor_name = COALESCE(NULLIF($8, ''), to_doctor_name),
                   from_doctor_name = COALESCE(NULLIF($9, ''), from_doctor_name),
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $10 AND user_id = $11`,
              [
                JSON.stringify(updatedMessages),
                JSON.stringify(responsePayload.patients),
                responsePayload.receivingDoctor,
                responsePayload.askedFollowUp,
                responsePayload.readyToFinalize,
                patients.length,
                criticalCount,
                responsePayload.receivingDoctor || "",
                fromDoctorName || "",
                handoverId,
                userId,
              ]
            ).catch((e) => console.error("[HandoverChat] failed to update session:", e));
            responsePayload.sessionId = handoverId;
          } else {
            // Upsert active session (one active per user) — returns the session id
            const upsertResult = await p.query(
              `INSERT INTO handover_sessions (user_id, messages, patients, receiving_doctor, asked_follow_up, ready_to_finalize, status, patient_count, critical_count, from_doctor_name, to_doctor_name, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9, $10, CURRENT_TIMESTAMP)
               ON CONFLICT (user_id) WHERE status = 'active'
               DO UPDATE SET messages = $2, patients = $3, receiving_doctor = $4, asked_follow_up = $5, ready_to_finalize = $6,
                   patient_count = $7, critical_count = $8,
                   from_doctor_name = COALESCE(NULLIF($9, ''), handover_sessions.from_doctor_name),
                   to_doctor_name = COALESCE(NULLIF($10, ''), handover_sessions.to_doctor_name),
                   updated_at = CURRENT_TIMESTAMP
               RETURNING id`,
              [
                userId,
                JSON.stringify(updatedMessages),
                JSON.stringify(responsePayload.patients),
                responsePayload.receivingDoctor,
                responsePayload.askedFollowUp,
                responsePayload.readyToFinalize,
                patients.length,
                criticalCount,
                fromDoctorName || "",
                responsePayload.receivingDoctor || "",
              ]
            ).catch((e) => { console.error("[HandoverChat] failed to persist session:", e); return null; });
            if (upsertResult && upsertResult.rows.length > 0) {
              responsePayload.sessionId = upsertResult.rows[0].id;
            }
          }
        }
      }

      return res.json(responsePayload);
    } catch (err) {
      console.error("[HandoverChat] error:", err);
      return res.status(500).json({ error: "Failed to process handover message. Please try again." });
    }
  });

  // ── GET /api/handover/session ───────────────────────────────────────────────
  // Fetch the doctor's current active session (cross-device resume)
  app.get("/api/handover/session", async (req: Request, res: Response) => {
    try {
      const userId = extractUserId(req);
      if (!userId) return res.status(401).json({ error: "No auth token" });
      const p = getPool();
      if (!p) return res.json({ session: null });
      const result = await p.query(
        `SELECT id, messages, patients, receiving_doctor, asked_follow_up, ready_to_finalize, updated_at, from_doctor_name, to_doctor_name
         FROM handover_sessions WHERE user_id = $1 AND status = 'active' LIMIT 1`,
        [userId]
      );
      if (result.rows.length === 0) return res.json({ session: null });
      const row = result.rows[0];
      return res.json({
        session: {
          id: row.id,
          messages: row.messages || [],
          patients: row.patients || [],
          receivingDoctor: row.receiving_doctor || "",
          askedFollowUp: !!row.asked_follow_up,
          readyToFinalize: !!row.ready_to_finalize,
          updatedAt: row.updated_at,
          fromDoctorName: row.from_doctor_name || "",
          toDoctorName: row.to_doctor_name || "",
        },
      });
    } catch (err) {
      console.error("[HandoverChat] session fetch error:", err);
      return res.status(500).json({ error: "Failed to load handover session." });
    }
  });

  // ── DELETE /api/handover/session ────────────────────────────────────────────
  // Archive the active session (status → 'completed') so it appears in history.
  // Optionally saves final_sheet if provided in the body.
  app.delete("/api/handover/session", async (req: Request, res: Response) => {
    try {
      const userId = extractUserId(req);
      if (!userId) return res.status(401).json({ error: "No auth token" });
      const p = getPool();
      if (!p) return res.json({ ok: true });
      const { finalSheet } = req.body || {};
      await p.query(
        `UPDATE handover_sessions
         SET status = 'completed',
             final_sheet = COALESCE($2, final_sheet),
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND status = 'active'`,
        [userId, finalSheet ? JSON.stringify(finalSheet) : null]
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error("[HandoverChat] session archive error:", err);
      return res.status(500).json({ error: "Failed to reset handover session." });
    }
  });

  // ── GET /api/handovers ──────────────────────────────────────────────────────
  // List all handover sessions for the current user, ordered newest first.
  app.get("/api/handovers", async (req: Request, res: Response) => {
    try {
      const userId = extractUserId(req);
      if (!userId) return res.status(401).json({ error: "No auth token" });
      const p = getPool();
      if (!p) return res.json({ handovers: [] });
      const limit = Math.min(parseInt(String(req.query.limit || "30"), 10), 100);
      const offset = Math.max(parseInt(String(req.query.offset || "0"), 10), 0);
      const result = await p.query(
        `SELECT id, status, created_at, updated_at,
                from_doctor_name, to_doctor_name, receiving_doctor,
                patient_count, critical_count, ready_to_finalize
         FROM handover_sessions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );
      return res.json({ handovers: result.rows });
    } catch (err) {
      console.error("[HandoverChat] list error:", err);
      return res.status(500).json({ error: "Failed to load handovers." });
    }
  });

  // ── GET /api/handovers/:id ──────────────────────────────────────────────────
  // Load a specific handover session by id (for reopening a draft/completed one).
  app.get("/api/handovers/:id", async (req: Request, res: Response) => {
    try {
      const userId = extractUserId(req);
      if (!userId) return res.status(401).json({ error: "No auth token" });
      const { id } = req.params;
      const p = getPool();
      if (!p) return res.status(503).json({ error: "Database unavailable" });
      const result = await p.query(
        `SELECT id, status, messages, patients, receiving_doctor, asked_follow_up,
                ready_to_finalize, created_at, updated_at,
                from_doctor_name, to_doctor_name, patient_count, critical_count, final_sheet
         FROM handover_sessions
         WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Handover not found" });
      const row = result.rows[0];
      return res.json({
        session: {
          id: row.id,
          status: row.status,
          messages: row.messages || [],
          patients: row.patients || [],
          receivingDoctor: row.receiving_doctor || "",
          askedFollowUp: !!row.asked_follow_up,
          readyToFinalize: !!row.ready_to_finalize,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          fromDoctorName: row.from_doctor_name || "",
          toDoctorName: row.to_doctor_name || "",
          patientCount: row.patient_count || 0,
          criticalCount: row.critical_count || 0,
          finalSheet: row.final_sheet || null,
        },
      });
    } catch (err) {
      console.error("[HandoverChat] get-by-id error:", err);
      return res.status(500).json({ error: "Failed to load handover." });
    }
  });

  // ── PATCH /api/handovers/:id ────────────────────────────────────────────────
  // Update a session's status and/or final_sheet (e.g. after sharing).
  app.patch("/api/handovers/:id", async (req: Request, res: Response) => {
    try {
      const userId = extractUserId(req);
      if (!userId) return res.status(401).json({ error: "No auth token" });
      const { id } = req.params;
      const { status, finalSheet, toDoctorName, fromDoctorName } = req.body || {};
      const p = getPool();
      if (!p) return res.status(503).json({ error: "Database unavailable" });
      await p.query(
        `UPDATE handover_sessions
         SET status = COALESCE($3, status),
             final_sheet = COALESCE($4, final_sheet),
             to_doctor_name = COALESCE(NULLIF($5, ''), to_doctor_name),
             from_doctor_name = COALESCE(NULLIF($6, ''), from_doctor_name),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2`,
        [id, userId, status || null, finalSheet ? JSON.stringify(finalSheet) : null, toDoctorName || "", fromDoctorName || ""]
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error("[HandoverChat] patch error:", err);
      return res.status(500).json({ error: "Failed to update handover." });
    }
  });
}
