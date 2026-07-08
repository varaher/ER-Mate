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
  app.post("/api/handover/chat", async (req: Request, res: Response) => {
    try {
      const { messages, currentMessage, askedFollowUp } = req.body as {
        messages?: { role: "user" | "assistant"; content: string }[];
        currentMessage?: string;
        askedFollowUp?: boolean;
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

      const responsePayload = {
        reply: parsed.reply || "I didn't quite catch that — could you tell me about your patients again?",
        patients: Array.isArray(parsed.patients) ? parsed.patients : [],
        receivingDoctor: parsed.receivingDoctor || "",
        askedFollowUp: !!parsed.askedFollowUp,
        readyToFinalize: !!parsed.readyToFinalize,
      };

      // Persist the session server-side so the same handover is visible across
      // devices (phone/desktop) for the logged-in user, not just in local memory.
      if (userId) {
        const p = getPool();
        if (p) {
          const updatedMessages = [
            ...fullHistory,
            { role: "user", content: currentMessage },
            { role: "assistant", content: responsePayload.reply },
          ];
          p.query(
            `INSERT INTO handover_sessions (user_id, messages, patients, receiving_doctor, asked_follow_up, ready_to_finalize, status, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'active', CURRENT_TIMESTAMP)
             ON CONFLICT (user_id) WHERE status = 'active'
             DO UPDATE SET messages = $2, patients = $3, receiving_doctor = $4, asked_follow_up = $5, ready_to_finalize = $6, updated_at = CURRENT_TIMESTAMP`,
            [
              userId,
              JSON.stringify(updatedMessages),
              JSON.stringify(responsePayload.patients),
              responsePayload.receivingDoctor,
              responsePayload.askedFollowUp,
              responsePayload.readyToFinalize,
            ]
          ).catch((e) => console.error("[HandoverChat] failed to persist session:", e));
        }
      }

      return res.json(responsePayload);
    } catch (err) {
      console.error("[HandoverChat] error:", err);
      return res.status(500).json({ error: "Failed to process handover message. Please try again." });
    }
  });

  // Fetch the doctor's active handover session, if any — used so the same
  // conversation can be resumed on any device (phone, desktop web, etc).
  app.get("/api/handover/session", async (req: Request, res: Response) => {
    try {
      const userId = extractUserId(req);
      if (!userId) return res.status(401).json({ error: "No auth token" });
      const p = getPool();
      if (!p) return res.json({ session: null });
      const result = await p.query(
        `SELECT messages, patients, receiving_doctor, asked_follow_up, ready_to_finalize, updated_at
         FROM handover_sessions WHERE user_id = $1 AND status = 'active' LIMIT 1`,
        [userId]
      );
      if (result.rows.length === 0) return res.json({ session: null });
      const row = result.rows[0];
      return res.json({
        session: {
          messages: row.messages || [],
          patients: row.patients || [],
          receivingDoctor: row.receiving_doctor || "",
          askedFollowUp: !!row.asked_follow_up,
          readyToFinalize: !!row.ready_to_finalize,
          updatedAt: row.updated_at,
        },
      });
    } catch (err) {
      console.error("[HandoverChat] session fetch error:", err);
      return res.status(500).json({ error: "Failed to load handover session." });
    }
  });

  // Clear the doctor's active handover session (e.g. "Start a new handover"
  // or after finalizing) so a stale session doesn't reappear on other devices.
  app.delete("/api/handover/session", async (req: Request, res: Response) => {
    try {
      const userId = extractUserId(req);
      if (!userId) return res.status(401).json({ error: "No auth token" });
      const p = getPool();
      if (!p) return res.json({ ok: true });
      await p.query(`DELETE FROM handover_sessions WHERE user_id = $1 AND status = 'active'`, [userId]);
      return res.json({ ok: true });
    } catch (err) {
      console.error("[HandoverChat] session delete error:", err);
      return res.status(500).json({ error: "Failed to reset handover session." });
    }
  });
}
