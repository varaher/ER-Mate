import type { Express, Request, Response } from "express";
import { eq, and, isNull, desc } from "drizzle-orm";
import { getDb } from "../db";
import { extractUserId } from "../lib/auth";
import { sendPushToMany } from "../services/pushService";
import {
  shifts,
  shiftSessions,
  departmentMembers,
  caseOverlays,
  pushTokens,
} from "@shared/schema";

export function registerShiftRoutes(app: Express) {
  // ── GET /api/shifts/department/:departmentId/counts ──────────
  app.get("/api/shifts/department/:departmentId/counts", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const departmentId = parseInt(req.params.departmentId);
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
      const tokenRows = await db.select({ token: pushTokens.token }).from(pushTokens).where(eq(pushTokens.userId, sess.userId));
      if (tokenRows.length) {
        await sendPushToMany(tokenRows.map((r) => r.token), "Shift Ended by Admin", "Your shift session was ended by the HOD. Please check in again when ready.", { type: "force_logout" });
      }
      res.json({ success: true });
    } catch (e) {
      console.error("[Shifts] Force logout error:", e);
      res.status(500).json({ error: "Failed to force logout" });
    }
  });

  // ── POST /api/handover/create ────────────────────────────────
  app.post("/api/handover/create", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const { caseId, toShiftId, bedNumber, pendingNotes, departmentId, shiftSessionId } = req.body;
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
