import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { eq, and, desc, or } from "drizzle-orm";
import { getDb } from "../db";
import { extractUserId } from "../lib/auth";
import { sendInviteExistingUser, sendInviteNewUser } from "../services/emailService";
import { sendPushNotification } from "../services/pushService";
import {
  departments,
  departmentMembers,
  departmentInvites,
  shifts,
  shiftSessions,
  pushTokens,
} from "@shared/schema";

export function registerDepartmentRoutes(app: Express) {
  // ── POST /api/department/create ──────────────────────────────
  app.post("/api/department/create", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { name, hospitalName, morningStart, morningEnd, eveningStart, eveningEnd, nightStart, nightEnd } = req.body;
    if (!name) return res.status(400).json({ error: "Department name required" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const existing = await db
        .select({ id: departmentMembers.id })
        .from(departmentMembers)
        .where(and(eq(departmentMembers.userId, userId), eq(departmentMembers.status, "active")))
        .limit(1);
      if (existing.length > 0) {
        return res.status(400).json({ error: "You are already in a department" });
      }
      const { hodName, hodEmail } = req.body;
      const [dept] = await db
        .insert(departments)
        .values({ name: name.trim(), hospitalName: hospitalName?.trim() || null, hodUserId: userId })
        .returning();
      await db.insert(departmentMembers).values({
        departmentId: dept.id,
        userId,
        role: "hod",
        status: "active",
        name: hodName?.trim() || null,
        email: hodEmail?.trim() || null,
        joinedAt: new Date(),
      });
      const defaultShifts = [
        { name: "Morning", startTime: morningStart || "06:00", endTime: morningEnd || "14:00" },
        { name: "Evening", startTime: eveningStart || "14:00", endTime: eveningEnd || "22:00" },
        { name: "Night", startTime: nightStart || "22:00", endTime: nightEnd || "06:00" },
      ];
      for (const s of defaultShifts) {
        await db.insert(shifts).values({ departmentId: dept.id, ...s });
      }
      res.json({ success: true, department: dept });
    } catch (e) {
      console.error("[Dept] Create error:", e);
      res.status(500).json({ error: "Failed to create department" });
    }
  });

  // ── GET /api/department/my ───────────────────────────────────
  app.get("/api/department/my", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const membership = await db
        .select()
        .from(departmentMembers)
        .where(and(eq(departmentMembers.userId, userId), eq(departmentMembers.status, "active")))
        .limit(1);
      if (!membership.length) return res.json({ department: null, membership: null, shifts: [] });
      const mem = membership[0];
      const dept = await db
        .select()
        .from(departments)
        .where(eq(departments.id, mem.departmentId))
        .limit(1);
      const deptShifts = await db
        .select()
        .from(shifts)
        .where(eq(shifts.departmentId, mem.departmentId));
      res.json({ department: dept[0] || null, membership: mem, shifts: deptShifts });
    } catch (e) {
      console.error("[Dept] My error:", e);
      res.status(500).json({ error: "Failed to fetch department" });
    }
  });

  // ── GET /api/department/:id/members ─────────────────────────
  app.get("/api/department/:id/members", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const departmentId = parseInt(req.params.id);
      const myMembership = await db
        .select()
        .from(departmentMembers)
        .where(and(eq(departmentMembers.userId, userId), eq(departmentMembers.departmentId, departmentId), eq(departmentMembers.status, "active")))
        .limit(1);
      if (!myMembership.length) return res.status(403).json({ error: "Not a member" });
      const members = await db
        .select()
        .from(departmentMembers)
        .where(eq(departmentMembers.departmentId, departmentId))
        .orderBy(departmentMembers.invitedAt);
      const invites = await db
        .select()
        .from(departmentInvites)
        .where(and(eq(departmentInvites.departmentId, departmentId)));
      res.json({ members, invites });
    } catch (e) {
      console.error("[Dept] Members error:", e);
      res.status(500).json({ error: "Failed to fetch members" });
    }
  });

  // ── POST /api/department/:id/invite ─────────────────────────
  app.post("/api/department/:id/invite", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const departmentId = parseInt(req.params.id);
      const { email, role, inviterName } = req.body;
      if (!email || !role) return res.status(400).json({ error: "email and role required" });
      const myMembership = await db
        .select()
        .from(departmentMembers)
        .where(and(eq(departmentMembers.userId, userId), eq(departmentMembers.departmentId, departmentId), eq(departmentMembers.status, "active")))
        .limit(1);
      if (!myMembership.length || !["hod"].includes(myMembership[0].role)) {
        return res.status(403).json({ error: "Only HOD can invite members" });
      }
      const dept = await db.select().from(departments).where(eq(departments.id, departmentId)).limit(1);
      if (!dept.length) return res.status(404).json({ error: "Department not found" });
      const deptName = dept[0].name;
      const token = crypto.randomBytes(24).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.insert(departmentInvites).values({
        departmentId,
        email: email.toLowerCase().trim(),
        role,
        token,
        expiresAt,
      });
      const domain = process.env.EXPO_PUBLIC_DOMAIN
        ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
        : "https://er-mate.replit.app";
      await sendInviteNewUser(email, inviterName || "Your HOD", deptName, role, token, domain);
      res.json({ success: true, token, inviteLink: `${domain}/invite?token=${token}`, email: email.toLowerCase().trim() });
    } catch (e) {
      console.error("[Dept] Invite error:", e);
      res.status(500).json({ error: "Failed to send invite" });
    }
  });

  // ── POST /api/department/members/:memberId/accept ────────────
  app.post("/api/department/members/:memberId/accept", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const memberId = parseInt(req.params.memberId);
      const [updated] = await db
        .update(departmentMembers)
        .set({ status: "active", joinedAt: new Date() })
        .where(and(eq(departmentMembers.id, memberId), eq(departmentMembers.userId, userId), eq(departmentMembers.status, "pending")))
        .returning();
      if (!updated) return res.status(404).json({ error: "Invite not found" });
      res.json({ success: true });
    } catch (e) {
      console.error("[Dept] Accept error:", e);
      res.status(500).json({ error: "Failed to accept invite" });
    }
  });

  // ── POST /api/department/members/:memberId/decline ───────────
  app.post("/api/department/members/:memberId/decline", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const memberId = parseInt(req.params.memberId);
      await db
        .update(departmentMembers)
        .set({ status: "inactive", removedAt: new Date() })
        .where(and(eq(departmentMembers.id, memberId), eq(departmentMembers.userId, userId)));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to decline invite" });
    }
  });

  // ── DELETE /api/department/:id/members/:targetUserId ────────
  app.delete("/api/department/:id/members/:targetUserId", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const departmentId = parseInt(req.params.id);
      const targetUserId = req.params.targetUserId;
      const myMembership = await db
        .select()
        .from(departmentMembers)
        .where(and(eq(departmentMembers.userId, userId), eq(departmentMembers.departmentId, departmentId), eq(departmentMembers.role, "hod"), eq(departmentMembers.status, "active")))
        .limit(1);
      if (!myMembership.length) return res.status(403).json({ error: "Only HOD can remove members" });
      await db
        .update(departmentMembers)
        .set({ status: "inactive", removedAt: new Date() })
        .where(and(eq(departmentMembers.userId, targetUserId), eq(departmentMembers.departmentId, departmentId)));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to remove member" });
    }
  });

  // ── GET /api/department/:id/admin ───────────────────────────
  app.get("/api/department/:id/admin", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const departmentId = parseInt(req.params.id);
      const myMembership = await db
        .select()
        .from(departmentMembers)
        .where(and(eq(departmentMembers.userId, userId), eq(departmentMembers.departmentId, departmentId), eq(departmentMembers.role, "hod"), eq(departmentMembers.status, "active")))
        .limit(1);
      if (!myMembership.length) return res.status(403).json({ error: "HOD only" });
      const members = await db
        .select()
        .from(departmentMembers)
        .where(and(eq(departmentMembers.departmentId, departmentId), eq(departmentMembers.status, "active")));
      const activeSessions = await db
        .select()
        .from(shiftSessions)
        .where(and(eq(shiftSessions.departmentId, departmentId), eq(shiftSessions.status, "active")))
        .orderBy(shiftSessions.checkedInAt);
      const deptShifts = await db.select().from(shifts).where(eq(shifts.departmentId, departmentId));
      res.json({ members, activeSessions, shifts: deptShifts });
    } catch (e) {
      console.error("[Dept] Admin error:", e);
      res.status(500).json({ error: "Failed to fetch admin data" });
    }
  });

  // ── GET /api/department/invites/pending ─────────────────────
  app.get("/api/department/invites/pending", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const pending = await db
        .select()
        .from(departmentMembers)
        .where(and(eq(departmentMembers.userId, userId), eq(departmentMembers.status, "pending")));
      const withDept = await Promise.all(
        pending.map(async (m) => {
          const dept = await db.select().from(departments).where(eq(departments.id, m.departmentId)).limit(1);
          return { ...m, department: dept[0] || null };
        })
      );
      res.json({ invites: withDept });
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch pending invites" });
    }
  });

  // ── POST /api/department/push-token ─────────────────────────
  app.post("/api/department/push-token", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const { token, platform } = req.body;
      if (!token) return res.status(400).json({ error: "token required" });
      const existing = await db.select().from(pushTokens).where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token))).limit(1);
      if (!existing.length) {
        await db.insert(pushTokens).values({ userId, token, platform: platform || null });
      } else {
        await db.update(pushTokens).set({ updatedAt: new Date() }).where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)));
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to save push token" });
    }
  });

  // ── POST /api/department/invite/join ────────────────────────
  // Authenticated doctor clicks the invite link and joins the department
  app.post("/api/department/invite/join", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const { token, name } = req.body;
      if (!token) return res.status(400).json({ error: "token required" });
      const invite = await db
        .select()
        .from(departmentInvites)
        .where(eq(departmentInvites.token, token))
        .limit(1);
      if (!invite.length) return res.status(404).json({ error: "Invite not found" });
      const inv = invite[0];
      if (inv.acceptedAt) return res.status(409).json({ error: "Invite already used" });
      if (new Date() > inv.expiresAt) return res.status(410).json({ error: "Invite expired" });
      // Check not already in a department
      const existing = await db
        .select({ id: departmentMembers.id })
        .from(departmentMembers)
        .where(and(eq(departmentMembers.userId, userId), eq(departmentMembers.status, "active")))
        .limit(1);
      if (existing.length) return res.status(400).json({ error: "Already in a department" });
      // Create member row
      const [member] = await db.insert(departmentMembers).values({
        departmentId: inv.departmentId,
        userId,
        role: inv.role,
        status: "active",
        name: name?.trim() || null,
        email: inv.email,
        joinedAt: new Date(),
      }).returning();
      // Mark invite accepted
      await db.update(departmentInvites).set({ acceptedAt: new Date() }).where(eq(departmentInvites.id, inv.id));
      res.json({ success: true, member });
    } catch (e) {
      console.error("[Dept] Join error:", e);
      res.status(500).json({ error: "Failed to join department" });
    }
  });

  // ── GET /api/department/invite/accept?token=xxx ─────────────
  app.get("/api/department/invite/accept", async (req: Request, res: Response) => {
    const { token } = req.query as { token?: string };
    if (!token) return res.status(400).json({ error: "token required" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const invite = await db
        .select()
        .from(departmentInvites)
        .where(and(eq(departmentInvites.token, token)))
        .limit(1);
      if (!invite.length) return res.status(404).json({ error: "Invite not found" });
      const inv = invite[0];
      if (inv.acceptedAt) return res.json({ accepted: true, invite: inv });
      if (new Date() > inv.expiresAt) return res.status(410).json({ error: "Invite expired" });
      res.json({ invite: inv });
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch invite" });
    }
  });
}
