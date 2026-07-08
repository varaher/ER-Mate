import type { Express, Request, Response } from "express";
import OpenAI from "openai";

// ── Simple in-memory IP rate limiter ───────────────────────────────────────
// This endpoint is intentionally public (no login) so it needs its own
// abuse guard independent of the app's AI-credits system.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 10;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return true;
  bucket.count += 1;
  return false;
}

// Periodic cleanup so the map doesn't grow unbounded
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets.entries()) {
    if (now > bucket.resetAt) rateBuckets.delete(ip);
  }
}, RATE_LIMIT_WINDOW_MS).unref();

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!apiKey || !baseURL) return null;
  return new OpenAI({ apiKey, baseURL });
}

const HANDOVER_SYSTEM_PROMPT = `You are ErMate Handover — a clinical structuring assistant for Indian Emergency Department shift handovers.

A doctor has pasted raw, messy text describing one or more patients (copied from a hospital EMR, WhatsApp message, or typed notes). It may mix English with Hindi, Malayalam, Tamil, Kannada, Telugu, Marathi, Punjabi, Bengali, or other Indian languages.

Extract EVERY patient mentioned and structure them. For each patient return an object with these exact keys:
- bedNumber: string (e.g. "Bed 3", "Room 5"; "Not mentioned" if absent)
- patientName: string ("Unknown" if not given)
- age: string ("" if not given)
- sex: string ("M" | "F" | "" )
- diagnosis: string (working diagnosis / chief complaint)
- status: one of "critical" | "unstable" | "stable" | "for_discharge" — infer clinically from the description
- vitals: object with optional string fields: bp, hr, spo2, rr, temp (only include ones actually mentioned)
- activeIssues: string[] (what is currently happening / running, e.g. infusions, lines, active problems)
- medications: string[] (running infusions or critical drugs currently administered)
- pendingTasks: string[] (what the receiving/night team must do)
- criticalAlerts: string[] (anything that must not be missed — allergies, DNR, high-risk drugs)
- awaitingResults: string[] (pending investigations / results)

Rules:
- Never invent information that isn't in the text. If something is not mentioned, omit it or use an empty array/"" as appropriate — do not guess vitals or diagnoses.
- If the paste is messy or unstructured, still extract everything you can.
- Always respond in English regardless of the input language.
- Return ONLY a JSON object of the exact shape: { "patients": [ ... ] }. No extra commentary.`;

export function registerHandoverPublicRoutes(app: Express): void {
  app.post("/api/handover/structure", async (req: Request, res: Response) => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";

    if (isRateLimited(ip)) {
      return res.status(429).json({
        error: "Too many requests. Please wait a few minutes before structuring another handover.",
      });
    }

    const { rawText } = (req.body || {}) as { rawText?: string };
    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ error: "Please paste your handover notes first." });
    }
    if (rawText.length > 8000) {
      return res.status(400).json({ error: "That's a lot of text — please paste under 8,000 characters at a time." });
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(503).json({ error: "Handover structuring is temporarily unavailable. Please try again shortly." });
    }

    try {
      console.log(`[HandoverPublic] structure request from ip=${ip} chars=${rawText.length}`);
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: HANDOVER_SYSTEM_PROMPT },
          { role: "user", content: rawText },
        ],
        max_tokens: 2500,
        temperature: 0.2,
      });

      const raw = completion.choices[0]?.message?.content || "{}";
      let parsed: { patients?: unknown[] };
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { patients: [] };
      }
      const patients = Array.isArray(parsed.patients) ? parsed.patients : [];

      if (patients.length === 0) {
        return res.status(422).json({
          error: "Couldn't find any patient details in that text. Try including a name/bed number, diagnosis, and status for at least one patient.",
        });
      }

      return res.json({ patients });
    } catch (err) {
      console.error("[HandoverPublic] structuring error:", err);
      return res.status(500).json({ error: "Failed to structure the handover. Please try again." });
    }
  });
}
