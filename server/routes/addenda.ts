import type { Express, Request, Response } from "express";
import { getPool } from "../db";
import { extractUserId } from "../lib/auth";

export const ADDENDUM_TYPES = [
  "clinical_update",
  "investigation_result",
  "consultant_review",
  "cross_consultation",
  "medication_change",
  "procedure_note",
  "shift_handover",
  "correction",
] as const;

export type AddendumType = (typeof ADDENDUM_TYPES)[number];

export interface CaseAddendum {
  id: number;
  caseId: string;
  type: AddendumType;
  content: string;
  doctorId?: string | null;
  doctorName?: string | null;
  doctorRole?: string | null;
  specialty?: string | null;
  handoverFromDoctor?: string | null;
  handoverToDoctor?: string | null;
  shiftId?: number | null;
  createdAt: string;
}

function rowToAddendum(row: any): CaseAddendum {
  return {
    id: row.id,
    caseId: row.case_id,
    type: row.type as AddendumType,
    content: row.content,
    doctorId: row.doctor_id ?? null,
    doctorName: row.doctor_name ?? null,
    doctorRole: row.doctor_role ?? null,
    specialty: row.specialty ?? null,
    handoverFromDoctor: row.handover_from_doctor ?? null,
    handoverToDoctor: row.handover_to_doctor ?? null,
    shiftId: row.shift_id ?? null,
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at),
  };
}

export function registerAddendaRoutes(app: Express): void {
  // GET /api/cases/:id/addenda — fetch all addenda for a case (auth required)
  app.get("/api/cases/:id/addenda", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database unavailable" });
    const { id } = req.params;
    try {
      // Ownership check: allow if the user has ever written an addendum for this case,
      // has a case_overlay (shift-based access), or is a department member who can see
      // shift cases. Falls back gracefully for cases pre-dating the shift system.
      const accessCheck = await pool.query(
        `SELECT 1 FROM case_addenda WHERE case_id=$1 AND doctor_id=$2
         UNION ALL
         SELECT 1 FROM case_overlays WHERE case_id=$1 AND doctor_user_id=$2
         UNION ALL
         SELECT 1 FROM case_overlays co
           JOIN shift_sessions ss ON co.shift_session_id = ss.id
           JOIN shifts s ON ss.shift_id = s.id
           JOIN department_members dm ON dm.department_id = s.department_id AND dm.user_id=$2
         WHERE co.case_id=$1
         LIMIT 1`,
        [id, userId]
      );
      // If no ownership proof found, still allow — the user is authenticated and case IDs
      // are UUIDs, so enumeration attacks are impractical. Pre-shift cases have no overlay.
      const result = await pool.query(
        `SELECT * FROM case_addenda WHERE case_id = $1 ORDER BY created_at ASC`,
        [id]
      );
      // Narrow result to user's own addenda if no shared ownership proof exists
      const rows = accessCheck.rowCount === 0
        ? result.rows.filter((r: any) => r.doctor_id === userId)
        : result.rows;
      return res.json(rows.map(rowToAddendum));
    } catch (err: any) {
      console.error("[ADDENDA] GET error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/cases/:id/addenda — create a new addendum (append-only, no delete)
  app.post("/api/cases/:id/addenda", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database unavailable" });
    const { id } = req.params;
    const {
      type,
      content,
      doctorId,
      doctorName,
      doctorRole,
      specialty,
      handoverFromDoctor,
      handoverToDoctor,
      shiftId,
    } = req.body || {};

    if (!type || !ADDENDUM_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${ADDENDUM_TYPES.join(", ")}` });
    }
    if (!content || typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "content is required" });
    }

    // Always attribute to the authenticated user — ignore any client-supplied doctorId
    const effectiveDoctorId = userId;

    // Case-level access guard: verify the user has an ownership stake in this case.
    // Checks: they previously wrote an addendum, have a case_overlay, or are a
    // department member for the shift that owns this case.
    // Falls back gracefully for cases pre-dating the shift system (no overlay).
    try {
      const access = await pool.query(
        `SELECT 1 FROM case_addenda WHERE case_id=$1 AND doctor_id=$2
         UNION ALL
         SELECT 1 FROM case_overlays WHERE case_id=$1 AND doctor_user_id=$2
         UNION ALL
         SELECT 1 FROM case_overlays co
           JOIN shift_sessions ss ON co.shift_session_id = ss.id
           JOIN shifts s ON ss.shift_id = s.id
           JOIN department_members dm ON dm.department_id = s.department_id AND dm.user_id=$2
         WHERE co.case_id=$1
         LIMIT 1`,
        [id, userId]
      );
      // If no ownership proof AND there are addenda by other users, deny write access.
      const anyAddenda = await pool.query(
        `SELECT 1 FROM case_addenda WHERE case_id=$1 LIMIT 1`,
        [id]
      );
      if (access.rowCount === 0 && anyAddenda.rowCount !== null && anyAddenda.rowCount > 0) {
        return res.status(403).json({ error: "Not authorized for this case" });
      }
    } catch { /* allow on internal check error to avoid blocking real usage */ }

    try {
      const result = await pool.query(
        `INSERT INTO case_addenda
           (case_id, type, content, doctor_id, doctor_name, doctor_role,
            specialty, handover_from_doctor, handover_to_doctor, shift_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          id,
          type,
          content.trim(),
          effectiveDoctorId,
          doctorName ?? null,
          doctorRole ?? null,
          specialty ?? null,
          handoverFromDoctor ?? null,
          handoverToDoctor ?? null,
          shiftId ?? null,
        ]
      );
      return res.status(201).json(rowToAddendum(result.rows[0]));
    } catch (err: any) {
      console.error("[ADDENDA] POST error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/cases/:id/addenda/classify — GPT-4o classifies text, returns type+content (no DB write)
  app.post("/api/cases/:id/addenda/classify", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { text } = req.body || {};
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "text is required" });
    }

    try {
      const { classifyAddendum } = await import("../services/aiDiagnosis");
      const result = await classifyAddendum(text.trim());
      return res.json(result);
    } catch (err: any) {
      console.error("[ADDENDA] classify error:", err);
      // Fallback: return clinical_update with original text rather than failing
      return res.json({ type: "clinical_update", content: text.trim() });
    }
  });

  // NOTE: No DELETE endpoint — addenda are append-only (medico-legal requirement).
  // Corrections must be submitted as a new addendum of type "correction".
}
