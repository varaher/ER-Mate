import type { Express, Request, Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db";
import { extractUserId } from "../lib/auth";
import { sendPushToMany } from "../services/pushService";
import { escalations, shiftSessions, departmentMembers, pushTokens } from "@shared/schema";

export function registerEscalationRoutes(app: Express) {
  // ── POST /api/escalations ────────────────────────────────────
  app.post("/api/escalations", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const { caseId, departmentId, reason, toConsultantId } = req.body;
      if (!caseId || !departmentId) return res.status(400).json({ error: "caseId and departmentId required" });
      const [esc] = await db
        .insert(escalations)
        .values({
          caseId,
          departmentId,
          fromResidentId: userId,
          toConsultantId: toConsultantId || null,
          reason: reason || null,
          status: "pending",
        })
        .returning();
      const activeSessions = await db
        .select()
        .from(shiftSessions)
        .where(and(eq(shiftSessions.departmentId, departmentId), eq(shiftSessions.status, "active"), eq(shiftSessions.roleForShift, "consultant")));
      if (activeSessions.length > 0) {
        const consultantIds = activeSessions.map((s) => s.userId);
        const tokenRows = await Promise.all(
          consultantIds.map((cId) =>
            db.select({ token: pushTokens.token }).from(pushTokens).where(eq(pushTokens.userId, cId))
          )
        );
        const allTokens = tokenRows.flat().map((r) => r.token);
        if (allTokens.length > 0) {
          await sendPushToMany(allTokens, "Escalation Request", `A resident has escalated a case for review.${reason ? " Reason: " + reason : ""}`, { type: "escalation", caseId, escalationId: esc.id });
        }
      }
      res.json({ success: true, escalation: esc });
    } catch (e) {
      console.error("[Escalation] Create error:", e);
      res.status(500).json({ error: "Failed to create escalation" });
    }
  });

  // ── GET /api/escalations/department/:departmentId ────────────
  app.get("/api/escalations/department/:departmentId", async (req: Request, res: Response) => {
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
      if (!myMem.length) return res.status(403).json({ error: "Not a member" });
      const items = await db
        .select()
        .from(escalations)
        .where(eq(escalations.departmentId, departmentId))
        .orderBy(desc(escalations.escalatedAt));
      res.json({ escalations: items });
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch escalations" });
    }
  });

  // ── PATCH /api/escalations/:id/review ───────────────────────
  app.patch("/api/escalations/:id/review", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const escalationId = parseInt(req.params.id);
      const { reviewNote } = req.body;
      const [updated] = await db
        .update(escalations)
        .set({ reviewedBy: userId, reviewedAt: new Date(), reviewNote: reviewNote || null, status: "reviewed" })
        .where(and(eq(escalations.id, escalationId), eq(escalations.status, "pending")))
        .returning();
      if (!updated) return res.status(404).json({ error: "Escalation not found or already reviewed" });
      const tokenRows = await db
        .select({ token: pushTokens.token })
        .from(pushTokens)
        .where(eq(pushTokens.userId, updated.fromResidentId));
      if (tokenRows.length) {
        await sendPushToMany(tokenRows.map((r) => r.token), "Escalation Reviewed", `A consultant has reviewed your escalation.${reviewNote ? " Note: " + reviewNote : ""}`, { type: "escalation_reviewed", escalationId });
      }
      res.json({ success: true, escalation: updated });
    } catch (e) {
      res.status(500).json({ error: "Failed to review escalation" });
    }
  });

  // ── GET /api/escalations/mine ────────────────────────────────
  app.get("/api/escalations/mine", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const items = await db
        .select()
        .from(escalations)
        .where(eq(escalations.fromResidentId, userId))
        .orderBy(desc(escalations.escalatedAt))
        .limit(20);
      res.json({ escalations: items });
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch my escalations" });
    }
  });
}
