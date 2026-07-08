import type { Express, Request, Response } from "express";
import { eq, and, isNull, desc } from "drizzle-orm";
import { getDb, getPool } from "../db";
import { extractUserId } from "../lib/auth";
import { sendPushToMany } from "../services/pushService";
import {
  shifts,
  shiftSessions,
  departmentMembers,
  caseOverlays,
  pushTokens,
} from "@shared/schema";

// ── Helper: write shift_handover addendum to clinical timeline ────────────────
async function writeHandoverAddendum(opts: {
  caseId: string;
  userId: string;
  fromDoctorName?: string;
  toDoctorName?: string;
  pendingNotes?: string;
}): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    const { caseId, userId, fromDoctorName, toDoctorName, pendingNotes } = opts;
    const content = [
      pendingNotes ? `Pending tasks / notes: ${pendingNotes}` : "Shift handover completed.",
      toDoctorName ? `Handing over to: ${toDoctorName}` : null,
    ].filter(Boolean).join("\n");

    await pool.query(
      `INSERT INTO case_addenda
         (case_id, type, content, doctor_id, handover_from_doctor, handover_to_doctor)
       VALUES ($1, 'shift_handover', $2, $3, $4, $5)`,
      [caseId, content, userId, fromDoctorName || null, toDoctorName || null]
    );
  } catch (err) {
    console.warn("[Handover] Failed to write shift_handover addendum:", err);
  }
}

export function registerShiftRoutes(app: Express) {
  // ── GET /api/shifts/department/:departmentId/counts ──────────
  app.get("/api/shifts/department/:departmentId/counts", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const departmentId = parseInt(req.params.departmentId);
      const myMem = await db
        .select()
        .from(departmentMembers)
        .where(and(eq(departmentMembers.userId, userId), eq(departmentMembers.departmentId, departmentId), eq(departmentMembers.status, "active")))
        .limit(1);
      if (!myMem.length) {
        return res.status(403).json({ error: "Not a member of this department" });
      }
      const deptShifts = await db.select().from(shifts).where(eq(shifts.departmentId, departmentId));
      const activeSessions = await db
        .select()
        .from(shiftSessions)
        .where(and(eq(shiftSessions.departmentId, departmentId), eq(shiftSessions.status, "active")));
      const counts = deptShifts.map((s) => {
        const shiftSess = activeSessions.filter((ss) => ss.shiftId === s.id);
        return {
          ...s,
          consultantsActive: shiftSess.filter((ss) => ss.roleForShift === "consultant").length,
          residentsActive: shiftSess.filter((ss) => ss.roleForShift === "resident").length,
          totalActive: shiftSess.length,
        };
      });
      res.json({ shifts: counts });
    } catch (e) {
      console.error("[Shifts] Counts error:", e);
      res.status(500).json({ error: "Failed to fetch shift counts" });
    }
  });

  // ── GET /api/shifts/session/active ──────────────────────────
  app.get("/api/shifts/session/active", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const session = await db
        .select()
        .from(shiftSessions)
        .where(and(eq(shiftSessions.userId, userId), eq(shiftSessions.status, "active")))
        .limit(1);
      if (!session.length) return res.json({ session: null });
      const shift = await db.select().from(shifts).where(eq(shifts.id, session[0].shiftId)).limit(1);
      res.json({ session: session[0], shift: shift[0] || null });
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch active session" });
    }
  });

  // ── POST /api/shifts/:shiftId/checkin ───────────────────────
  app.post("/api/shifts/:shiftId/checkin", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const shiftId = parseInt(req.params.shiftId);
      const { roleForShift } = req.body;
      if (!roleForShift) return res.status(400).json({ error: "roleForShift required" });
      const existing = await db
        .select()
        .from(shiftSessions)
        .where(and(eq(shiftSessions.userId, userId), eq(shiftSessions.status, "active")))
        .limit(1);
      if (existing.length) {
        return res.status(400).json({ error: "Already checked in to a shift" });
      }
      const shift = await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1);
      if (!shift.length) return res.status(404).json({ error: "Shift not found" });
      const s = shift[0];
      const myMem = await db
        .select()
        .from(departmentMembers)
        .where(and(eq(departmentMembers.userId, userId), eq(departmentMembers.departmentId, s.departmentId), eq(departmentMembers.status, "active")))
        .limit(1);
      if (!myMem.length) {
        return res.status(403).json({ error: "Not a member of this department" });
      }
      const activeSessions = await db
        .select()
        .from(shiftSessions)
        .where(and(eq(shiftSessions.shiftId, shiftId), eq(shiftSessions.status, "active")));
      const consultantsActive = activeSessions.filter((ss) => ss.roleForShift === "consultant").length;
      const residentsActive = activeSessions.filter((ss) => ss.roleForShift === "resident").length;
      if (roleForShift === "consultant" && consultantsActive >= (s.maxConsultants ?? 2)) {
        return res.status(409).json({ error: "Consultant slots full", slotsAvailable: 0 });
      }
      if (roleForShift === "resident" && residentsActive >= (s.maxResidents ?? 6)) {
        return res.status(409).json({ error: "Resident slots full", slotsAvailable: 0 });
      }
      const [session] = await db
        .insert(shiftSessions)
        .values({ shiftId, departmentId: s.departmentId, userId, roleForShift, status: "active" })
        .returning();
      res.json({ success: true, session, shift: s });
    } catch (e) {
      console.error("[Shifts] Checkin error:", e);
      res.status(500).json({ error: "Failed to check in" });
    }
  });

  // ── POST /api/shifts/sessions/:sessionId/checkout ───────────
  app.post("/api/shifts/sessions/:sessionId/checkout", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const sessionId = parseInt(req.params.sessionId);
      const unhanded = await db
        .select()
        .from(caseOverlays)
        .where(and(eq(caseOverlays.shiftSessionId, sessionId), eq(caseOverlays.handoverStatus, "active")));
      if (unhanded.length > 0) {
        return res.status(400).json({
          error: `You have ${unhanded.length} case(s) not yet handed over. Hand them over or mark them complete before logging out.`,
          pendingCases: unhanded.length,
        });
      }
      const [updated] = await db
        .update(shiftSessions)
        .set({ checkedOutAt: new Date(), status: "completed" })
        .where(and(eq(shiftSessions.id, sessionId), eq(shiftSessions.userId, userId), eq(shiftSessions.status, "active")))
        .returning();
      if (!updated) return res.status(404).json({ error: "Session not found or not yours" });
      res.json({ success: true });
    } catch (e) {
      console.error("[Shifts] Checkout error:", e);
      res.status(500).json({ error: "Failed to check out" });
    }
  });

  // ── POST /api/shifts/sessions/:sessionId/force-logout ───────
  app.post("/api/shifts/sessions/:sessionId/force-logout", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const sessionId = parseInt(req.params.sessionId);
      const session = await db.select().from(shiftSessions).where(eq(shiftSessions.id, sessionId)).limit(1);
      if (!session.length) return res.status(404).json({ error: "Session not found" });
      const sess = session[0];
      const myMem = await db
        .select()
        .from(departmentMembers)
        .where(and(eq(departmentMembers.userId, userId), eq(departmentMembers.departmentId, sess.departmentId), eq(departmentMembers.role, "hod"), eq(departmentMembers.status, "active")))
        .limit(1);
      if (!myMem.length) return res.status(403).json({ error: "HOD only" });
      await db
        .update(shiftSessions)
        .set({ status: "force_logout", forceLogoutBy: userId, forceLogoutAt: new Date(), checkedOutAt: new Date() })
        .where(eq(shiftSessions.id, sessionId));
      try {
        const tokenRows = await db.select({ token: pushTokens.token }).from(pushTokens).where(eq(pushTokens.userId, sess.userId));
        if (tokenRows.length) {
          await sendPushToMany(tokenRows.map((r) => r.token), "Shift Ended by Admin", "Your shift session was ended by the HOD. Please check in again when ready.", { type: "force_logout" });
        }
      } catch (pushErr) {
        console.warn("[Shifts] Force logout push failed (non-fatal):", pushErr);
      }
      res.json({ success: true });
    } catch (e) {
      console.error("[Shifts] Force logout error:", e);
      res.status(500).json({ error: "Failed to force logout" });
    }
  });

  // ── POST /api/shifts/:shiftId/assign-member (HOD only) ──────
  app.post("/api/shifts/:shiftId/assign-member", async (req: Request, res: Response) => {
    const hodUserId = extractUserId(req);
    if (!hodUserId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const shiftId = parseInt(req.params.shiftId);
      const { targetUserId, roleForShift } = req.body;
      if (!targetUserId || !roleForShift) return res.status(400).json({ error: "targetUserId and roleForShift required" });
      const shift = await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1);
      if (!shift.length) return res.status(404).json({ error: "Shift not found" });
      const s = shift[0];
      const hodMem = await db.select().from(departmentMembers)
        .where(and(eq(departmentMembers.userId, hodUserId), eq(departmentMembers.departmentId, s.departmentId), eq(departmentMembers.role, "hod"), eq(departmentMembers.status, "active")))
        .limit(1);
      if (!hodMem.length) return res.status(403).json({ error: "HOD only" });
      const existing = await db.select().from(shiftSessions)
        .where(and(eq(shiftSessions.userId, targetUserId), eq(shiftSessions.status, "active")))
        .limit(1);
      if (existing.length) return res.status(400).json({ error: "Member already on shift" });
      const activeSessions = await db.select().from(shiftSessions)
        .where(and(eq(shiftSessions.shiftId, shiftId), eq(shiftSessions.status, "active")));
      const consultantsActive = activeSessions.filter((ss) => ss.roleForShift === "consultant").length;
      const residentsActive = activeSessions.filter((ss) => ss.roleForShift === "resident").length;
      if (roleForShift === "consultant" && consultantsActive >= (s.maxConsultants ?? 2)) {
        return res.status(409).json({ error: "Consultant slots full" });
      }
      if (roleForShift === "resident" && residentsActive >= (s.maxResidents ?? 6)) {
        return res.status(409).json({ error: "Resident slots full" });
      }
      const [session] = await db.insert(shiftSessions)
        .values({ shiftId, departmentId: s.departmentId, userId: targetUserId, roleForShift, status: "active" })
        .returning();
      res.json({ success: true, session });
    } catch (e) {
      console.error("[Shifts] Assign member error:", e);
      res.status(500).json({ error: "Failed to assign member" });
    }
  });

  // ── POST /api/handover/create ────────────────────────────────
  app.post("/api/handover/create", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const { caseId, toShiftId, bedNumber, pendingNotes, departmentId, shiftSessionId,
              fromDoctorName, toDoctorName } = req.body;
      if (!caseId || !departmentId) return res.status(400).json({ error: "caseId and departmentId required" });
      const existing = await db
        .select()
        .from(caseOverlays)
        .where(and(eq(caseOverlays.caseId, caseId), eq(caseOverlays.departmentId, departmentId)))
        .limit(1);
      if (existing.length) {
        const [updated] = await db
          .update(caseOverlays)
          .set({
            handoverStatus: "handed_over",
            handedOverToShiftId: toShiftId || null,
            handedOverByUserId: userId,
            handedOverAt: new Date(),
            bedNumber: bedNumber || null,
            pendingNotes: pendingNotes || null,
          })
          .where(eq(caseOverlays.id, existing[0].id))
          .returning();

        // Write shift_handover addendum to clinical timeline
        await writeHandoverAddendum({ caseId, userId, fromDoctorName, toDoctorName, pendingNotes });

        return res.json({ success: true, overlay: updated });
      }
      const [overlay] = await db
        .insert(caseOverlays)
        .values({
          caseId,
          departmentId,
          shiftSessionId: shiftSessionId || null,
          handoverStatus: "handed_over",
          handedOverToShiftId: toShiftId || null,
          handedOverByUserId: userId,
          handedOverAt: new Date(),
          bedNumber: bedNumber || null,
          pendingNotes: pendingNotes || null,
        })
        .returning();

      // Write shift_handover addendum to clinical timeline
      await writeHandoverAddendum({ caseId, userId, fromDoctorName, toDoctorName, pendingNotes });

      res.json({ success: true, overlay });
    } catch (e) {
      console.error("[Handover] Create error:", e);
      res.status(500).json({ error: "Failed to create handover" });
    }
  });

  // ── POST /api/handover/:overlayId/receive ───────────────────
  app.post("/api/handover/:overlayId/receive", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const overlayId = parseInt(req.params.overlayId);
      const [updated] = await db
        .update(caseOverlays)
        .set({ handoverStatus: "received", receivedByUserId: userId, receivedAt: new Date() })
        .where(and(eq(caseOverlays.id, overlayId), eq(caseOverlays.handoverStatus, "handed_over")))
        .returning();
      if (!updated) return res.status(404).json({ error: "Handover not found" });
      res.json({ success: true, overlay: updated });
    } catch (e) {
      res.status(500).json({ error: "Failed to receive handover" });
    }
  });

  // ── GET /api/handover/incoming/:departmentId ─────────────────
  app.get("/api/handover/incoming/:departmentId", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const departmentId = parseInt(req.params.departmentId);
      const activeSession = await db
        .select()
        .from(shiftSessions)
        .where(and(eq(shiftSessions.userId, userId), eq(shiftSessions.status, "active")))
        .limit(1);
      const shiftId = activeSession[0]?.shiftId;
      let incoming;
      if (shiftId) {
        incoming = await db
          .select()
          .from(caseOverlays)
          .where(and(eq(caseOverlays.departmentId, departmentId), eq(caseOverlays.handedOverToShiftId, shiftId), eq(caseOverlays.handoverStatus, "handed_over")))
          .orderBy(desc(caseOverlays.handedOverAt));
      } else {
        incoming = await db
          .select()
          .from(caseOverlays)
          .where(and(eq(caseOverlays.departmentId, departmentId), eq(caseOverlays.handoverStatus, "handed_over")))
          .orderBy(desc(caseOverlays.handedOverAt));
      }
      res.json({ incoming });
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch incoming handovers" });
    }
  });

  // ── POST /api/cases/:caseId/register-shift ──────────────────
  // Called after commit to link a case to the current shift overlay
  app.post("/api/cases/:caseId/register-shift", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const { caseId } = req.params;
      const { departmentId, shiftSessionId, patientName, patientAge, chiefComplaint, triagePriority, bedNumber, doctorName } = req.body;
      if (!departmentId) return res.status(400).json({ error: "departmentId required" });

      // If client didn't know about an HOD-assigned session, look it up server-side
      let resolvedSessionId: number | null = shiftSessionId || null;
      if (!resolvedSessionId) {
        const activeSession = await db
          .select()
          .from(shiftSessions)
          .where(and(eq(shiftSessions.userId, userId), eq(shiftSessions.departmentId, departmentId), eq(shiftSessions.status, "active")))
          .limit(1);
        if (activeSession.length) {
          resolvedSessionId = activeSession[0].id;
        }
      }

      const existing = await db
        .select()
        .from(caseOverlays)
        .where(and(eq(caseOverlays.caseId, caseId), eq(caseOverlays.departmentId, departmentId)))
        .limit(1);

      if (existing.length) {
        const [updated] = await db
          .update(caseOverlays)
          .set({
            shiftSessionId: resolvedSessionId || existing[0].shiftSessionId,
            patientName: patientName || existing[0].patientName,
            patientAge: patientAge || existing[0].patientAge,
            chiefComplaint: chiefComplaint || existing[0].chiefComplaint,
            triagePriority: triagePriority ?? existing[0].triagePriority,
            doctorUserId: userId,
            doctorName: doctorName || existing[0].doctorName,
            bedNumber: bedNumber || existing[0].bedNumber,
          })
          .where(eq(caseOverlays.id, existing[0].id))
          .returning();
        return res.json({ success: true, overlay: updated });
      }

      const [overlay] = await db
        .insert(caseOverlays)
        .values({
          caseId,
          departmentId,
          shiftSessionId: resolvedSessionId,
          patientName: patientName || null,
          patientAge: patientAge || null,
          chiefComplaint: chiefComplaint || null,
          triagePriority: triagePriority ?? null,
          doctorUserId: userId,
          doctorName: doctorName || null,
          bedNumber: bedNumber || null,
          handoverStatus: "active",
        })
        .returning();
      res.json({ success: true, overlay, resolvedSession: !!resolvedSessionId });
    } catch (e) {
      console.error("[ShiftOverlay] Register error:", e);
      res.status(500).json({ error: "Failed to register case" });
    }
  });

  // ── GET /api/shifts/:shiftId/cases ──────────────────────────
  // Returns all case overlays registered under a shift (for shift dashboard)
  app.get("/api/shifts/:shiftId/cases", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const shiftId = parseInt(req.params.shiftId);

      // Get all active sessions in this shift
      const sessions = await db
        .select()
        .from(shiftSessions)
        .where(and(eq(shiftSessions.shiftId, shiftId), eq(shiftSessions.status, "active")));

      if (!sessions.length) return res.json({ cases: [] });

      const sessionIds = sessions.map((s) => s.id);

      // Get overlays for these sessions (cases registered in this shift)
      let overlays: any[] = [];
      for (const sid of sessionIds) {
        const rows = await db
          .select()
          .from(caseOverlays)
          .where(eq(caseOverlays.shiftSessionId, sid));
        overlays.push(...rows);
      }

      // Also find overlays by doctorUserId matching session userIds (cases registered without sessionId)
      const sessionUserIds = sessions.map((s) => s.userId);
      const shift = await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1);
      if (!shift.length) return res.json({ cases: [] });
      const departmentId = shift[0].departmentId;

      // Get requesting user's membership role
      const myMem = await db
        .select()
        .from(departmentMembers)
        .where(and(eq(departmentMembers.userId, userId), eq(departmentMembers.departmentId, departmentId)))
        .limit(1);
      const myRole = myMem[0]?.role || "resident";

      // Filter based on role
      const deduped = [...new Map(overlays.map((o) => [o.id, o])).values()];
      const filtered = myRole === "resident"
        ? deduped.filter((o) => o.doctorUserId === userId || o.handedOverByUserId === userId)
        : deduped; // consultant / HOD sees all

      // Fetch addenda counts and last addendum for all case IDs in bulk
      const allCaseIds = filtered.map((o) => o.caseId).filter(Boolean);
      const addendaMap: Record<string, { addendaCount: number; lastAddendum: { type: string; content: string; createdAt: string; doctorName: string | null } | null }> = {};
      if (allCaseIds.length > 0) {
        const pool = getPool();
        if (pool) {
          try {
            const addendaRows = await pool.query(
              `SELECT case_id, type, content, doctor_name, created_at
               FROM case_addenda
               WHERE case_id = ANY($1::text[])
               ORDER BY created_at ASC`,
              [allCaseIds]
            );
            for (const row of addendaRows.rows) {
              if (!addendaMap[row.case_id]) {
                addendaMap[row.case_id] = { addendaCount: 0, lastAddendum: null };
              }
              addendaMap[row.case_id].addendaCount += 1;
              addendaMap[row.case_id].lastAddendum = {
                type: row.type,
                content: row.content,
                createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
                doctorName: row.doctor_name ?? null,
              };
            }
          } catch (addendaErr) {
            console.warn("[ShiftCases] addenda fetch skipped:", addendaErr);
          }
        }
      }

      // Attach session info (role for shift) and addenda metadata
      const result = filtered.map((overlay) => {
        const sess = sessions.find((s) => s.id === overlay.shiftSessionId);
        const addendaMeta = addendaMap[overlay.caseId] || { addendaCount: 0, lastAddendum: null };
        return {
          ...overlay,
          roleForShift: sess?.roleForShift || null,
          isOwn: overlay.doctorUserId === userId,
          addendaCount: addendaMeta.addendaCount,
          lastAddendum: addendaMeta.lastAddendum,
        };
      });

      res.json({ cases: result, myRole });
    } catch (e) {
      console.error("[ShiftCases] Error:", e);
      res.status(500).json({ error: "Failed to fetch shift cases" });
    }
  });

  // ── GET /api/department/:deptId/all-shift-cases ──────────────
  // HOD view: all active shift cases across all shifts in a department
  app.get("/api/department/:deptId/all-shift-cases", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const departmentId = parseInt(req.params.deptId);
      const myMem = await db
        .select()
        .from(departmentMembers)
        .where(and(eq(departmentMembers.userId, userId), eq(departmentMembers.departmentId, departmentId)))
        .limit(1);
      if (!myMem.length || myMem[0].role !== "hod") {
        return res.status(403).json({ error: "HOD only" });
      }

      const deptShifts = await db.select().from(shifts).where(eq(shifts.departmentId, departmentId));
      const activeSessions = await db
        .select()
        .from(shiftSessions)
        .where(and(eq(shiftSessions.departmentId, departmentId), eq(shiftSessions.status, "active")));

      const sessionIds = activeSessions.map((s) => s.id);

      // Fetch all overlays for this department (covers both shift-linked and no-session cases)
      const allDeptOverlays = await db
        .select()
        .from(caseOverlays)
        .where(eq(caseOverlays.departmentId, departmentId));

      // Keep overlays that either belong to an active session or have no session (saved without checking in)
      const allOverlays = allDeptOverlays.filter(
        (o) => o.shiftSessionId == null || sessionIds.includes(o.shiftSessionId)
      );

      // Fetch addenda counts in bulk for all overlay case IDs
      const hodCaseIds = allOverlays.map((o) => o.caseId).filter(Boolean);
      const hodAddendaMap: Record<string, number> = {};
      if (hodCaseIds.length > 0) {
        const pool = getPool();
        if (pool) {
          try {
            const addendaCounts = await pool.query(
              `SELECT case_id, COUNT(*)::int AS cnt
               FROM case_addenda WHERE case_id = ANY($1::text[])
               GROUP BY case_id`,
              [hodCaseIds]
            );
            for (const row of addendaCounts.rows) {
              hodAddendaMap[row.case_id] = row.cnt;
            }
          } catch (addendaErr) {
            console.warn("[HODCases] addenda count fetch skipped:", addendaErr);
          }
        }
      }

      const result = allOverlays.map((o) => {
        const sess = activeSessions.find((s) => s.id === o.shiftSessionId);
        const shift = deptShifts.find((sh) => sh.id === sess?.shiftId);
        return {
          ...o,
          shiftName: shift?.name || null,
          roleForShift: sess?.roleForShift || null,
          isOwn: o.doctorUserId === userId,
          addendaCount: hodAddendaMap[o.caseId] || 0,
        };
      });

      res.json({ cases: result, shifts: deptShifts });
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch department cases" });
    }
  });

  // ── POST /api/cases/:caseId/consultant-review ────────────────
  app.post("/api/cases/:caseId/consultant-review", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const { caseId } = req.params;
      const { note, departmentId } = req.body;
      if (!note) return res.status(400).json({ error: "Note required" });

      const existing = await db
        .select()
        .from(caseOverlays)
        .where(eq(caseOverlays.caseId, caseId))
        .limit(1);

      if (!existing.length) {
        return res.status(404).json({ error: "Case not registered in department" });
      }

      const [updated] = await db
        .update(caseOverlays)
        .set({ consultantReviewedBy: userId, consultantReviewedAt: new Date(), consultantNote: note })
        .where(eq(caseOverlays.id, existing[0].id))
        .returning();

      res.json({ success: true, overlay: updated });
    } catch (e) {
      console.error("[ConsultantReview] Error:", e);
      res.status(500).json({ error: "Failed to save review" });
    }
  });

  // ── GET /api/handover/case/:caseId ──────────────────────────
  app.get("/api/handover/case/:caseId", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const overlay = await db
        .select()
        .from(caseOverlays)
        .where(eq(caseOverlays.caseId, req.params.caseId))
        .limit(1);
      res.json({ overlay: overlay[0] || null });
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch overlay" });
    }
  });
}

// ── Auto-expire sessions whose shift ended > 1 hour ago ──────
// Called on a schedule (every 5 minutes) from server/index.ts
export async function autoExpireShiftSessions(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    const rows = await db
      .select({ session: shiftSessions, shift: shifts })
      .from(shiftSessions)
      .innerJoin(shifts, eq(shiftSessions.shiftId, shifts.id))
      .where(eq(shiftSessions.status, "active"));

    const now = new Date();
    const toExpire: number[] = [];

    for (const { session, shift } of rows) {
      const checkedInAt = new Date(session.checkedInAt);
      const [endH, endM] = shift.endTime.split(":").map(Number);
      const [startH, startM] = shift.startTime.split(":").map(Number);
      const endTotalMins = endH * 60 + endM;
      const startTotalMins = startH * 60 + startM;

      // Build the deadline: checkedInAt date @ endTime, +1 hr grace
      const deadline = new Date(checkedInAt);
      deadline.setHours(endH, endM, 0, 0);
      // Night shift wraps midnight (e.g. 22:00-06:00) → endTime is next day
      if (endTotalMins <= startTotalMins) {
        deadline.setDate(deadline.getDate() + 1);
      }
      // Add 1-hour grace period
      deadline.setTime(deadline.getTime() + 60 * 60 * 1000);

      if (now > deadline) {
        toExpire.push(session.id);
      }
    }

    if (toExpire.length > 0) {
      for (const sid of toExpire) {
        await db
          .update(shiftSessions)
          .set({ status: "auto_expired", checkedOutAt: new Date() })
          .where(eq(shiftSessions.id, sid));
      }
      console.log(`[AutoExpire] Expired ${toExpire.length} shift session(s)`);
    }
    return toExpire.length;
  } catch (e) {
    console.error("[AutoExpire] Error:", e);
    return 0;
  }
}
