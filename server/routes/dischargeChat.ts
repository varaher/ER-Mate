import type { Express, Request, Response } from "express";
import { extractUserId } from "../lib/auth";

const DISCHARGE_CHAT_SYSTEM_PROMPT = `You are ErMate Discharge — a conversational clinical AI assistant for Emergency Department discharge summaries in Indian hospitals.

Your job is to guide the ER doctor through all sections of a discharge summary in a natural, efficient conversation. Ask progressively, 2–3 fields at a time. Acknowledge each answer briefly before moving on.

SECTIONS TO COVER IN ORDER:
1. Patient basics: name, age, sex, MLC (yes/no/number), allergy
2. Vitals at arrival: HR, BP, SpO2, Pain Score, GRBS, Temp
3. Presenting complaints (chief complaint at the door)
4. History of present illness
5. Past medical/surgical history
6. Family/gynaecological history, LMP (if applicable)
7. General examination findings
8. Primary Assessment:
   A — Airway: Patent / Threatened / Compromised, Intervention
   B — Breathing: Work of breathing, Air entry, Subcutaneous emphysema, EFAST, Interventions
   C — Circulation: CRT, Distended neck veins, PCT, Long bone deformity, FAST, Interventions
   D — Disability: AVPU, GCS (E/V/M), Pupils, GRBS
   E — Exposure: Temp, Trauma findings, Log roll
9. Secondary assessment: Pallor/Icterus/Cyanosis/Clubbing/Lymphadenopathy/Edema; CHEST, CVS, P/A, CNS, EXTREMITIES
10. Course in hospital (treatments given, procedures done, response)
11. Investigations and results
12. Diagnosis at time of discharge
13. Discharge medications
14. Disposition: Normal Discharge / Discharge at Request / DAMA / Referred
15. Condition at discharge: STABLE or UNSTABLE
16. Vitals at time of discharge: HR, BP, SpO2, Pain Score, GRBS, Temp
17. Follow-up advice

LANGUAGE: Understand Hindi, Malayalam, Tamil, Kannada, Telugu, Marathi, English, and any mix. Always respond in English.

CONVERSATION FLOW:
- Start: Ask for patient name, age, sex together.
- Each turn: ask 2–3 fields, wait for the answer, acknowledge briefly, then move to next fields.
- If a field is not applicable or not available ("nil", "N/A", "none"), accept it and move on.
- If the doctor says "done", "finish", "that's all", "generate", "okay done" — set readyToFinalize to true and give a closing summary line.
- Never invent or guess data not provided. Leave fields as "" if not mentioned yet.

EXTRACTION SCHEMA — keep this updated every turn with whatever has been captured so far:
{
  "patient": {
    "name": string,
    "age": string,
    "sex": string ("M" | "F" | ""),
    "mlc": string,
    "allergy": string
  },
  "vitalsArrival": { "hr": string, "bp": string, "spo2": string, "painScore": string, "grbs": string, "temp": string },
  "presentingComplaints": string,
  "historyPresentIllness": string,
  "pastHistory": string,
  "familyHistory": string,
  "lmp": string,
  "generalExamination": string,
  "primaryAssessment": {
    "airway": string,
    "breathing": string,
    "circulation": string,
    "disability": string,
    "exposure": string
  },
  "secondaryAssessment": {
    "general": string,
    "chest": string,
    "cvs": string,
    "abdomen": string,
    "cns": string,
    "extremities": string
  },
  "courseInHospital": string,
  "investigations": string,
  "diagnosis": string,
  "dischargeMedications": string,
  "disposition": string,
  "conditionAtDischarge": string,
  "vitalsDischarge": { "hr": string, "bp": string, "spo2": string, "painScore": string, "grbs": string, "temp": string },
  "followUpAdvice": string
}

RESPONSE FORMAT — respond ONLY as a valid JSON object, nothing else:
{
  "reply": "conversational message to show the doctor (brief acknowledge + next 2-3 questions)",
  "summary": { ...full discharge summary schema above, updated with all captured fields so far... },
  "readyToFinalize": boolean,
  "currentSection": string (e.g. "Vitals at Arrival", "Primary Assessment", "Diagnosis")
}`;

const EMPTY_SUMMARY = {
  patient: { name: "", age: "", sex: "", mlc: "", allergy: "" },
  vitalsArrival: { hr: "", bp: "", spo2: "", painScore: "", grbs: "", temp: "" },
  presentingComplaints: "",
  historyPresentIllness: "",
  pastHistory: "",
  familyHistory: "",
  lmp: "",
  generalExamination: "",
  primaryAssessment: { airway: "", breathing: "", circulation: "", disability: "", exposure: "" },
  secondaryAssessment: { general: "", chest: "", cvs: "", abdomen: "", cns: "", extremities: "" },
  courseInHospital: "",
  investigations: "",
  diagnosis: "",
  dischargeMedications: "",
  disposition: "",
  conditionAtDischarge: "",
  vitalsDischarge: { hr: "", bp: "", spo2: "", painScore: "", grbs: "", temp: "" },
  followUpAdvice: "",
};

export function registerDischargeChatRoutes(app: Express): void {
  app.post("/api/discharge/chat", async (req: Request, res: Response) => {
    try {
      const {
        messages,
        currentMessage,
        currentSummary,
      } = req.body as {
        messages?: { role: "user" | "assistant"; content: string }[];
        currentMessage?: string;
        currentSummary?: typeof EMPTY_SUMMARY;
      };

      if (!currentMessage || typeof currentMessage !== "string" || !currentMessage.trim()) {
        return res.status(400).json({ error: "No message provided" });
      }

      const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
      const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      if (!apiKey || !baseURL) {
        return res.status(503).json({ error: "Discharge chat is temporarily unavailable." });
      }

      extractUserId(req); // verify auth

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey, baseURL });

      const history = Array.isArray(messages) ? messages.slice(-20) : [];
      const summaryNote = currentSummary
        ? `\n\n[Current summary state: ${JSON.stringify(currentSummary)}]`
        : "";

      const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: DISCHARGE_CHAT_SYSTEM_PROMPT },
        ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user", content: currentMessage + summaryNote },
      ];

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: chatMessages,
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const raw = response.choices[0]?.message?.content || "{}";
      let parsed: any = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { reply: "Sorry, I had trouble processing that. Could you say that again?", summary: currentSummary || EMPTY_SUMMARY, readyToFinalize: false };
      }

      return res.json({
        reply: parsed.reply || "Could you tell me more?",
        summary: parsed.summary || currentSummary || EMPTY_SUMMARY,
        readyToFinalize: !!parsed.readyToFinalize,
        currentSection: parsed.currentSection || "",
      });
    } catch (err: any) {
      console.error("Discharge chat error:", err);
      return res.status(500).json({ error: "Discharge chat failed. Please try again." });
    }
  });
}
