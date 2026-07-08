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
      const result = await pool.query(
        `SELECT * FROM case_addenda WHERE case_id = $1 ORDER BY created_at ASC`,
        [id]
      );
      return res.json(result.rows.map(rowToAddendum));
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

    // Enforce ownership: doctorId must match the authenticated user
    const effectiveDoctorId = doctorId || userId;

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

  // NOTE: No DELETE endpoint — addenda are append-only (medico-legal requirement).
  // Corrections must be submitted as a new addendum of type "correction".
}
