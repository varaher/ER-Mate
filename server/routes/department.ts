import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { eq, and, desc, or } from "drizzle-orm";
import { getDb, getPool } from "../db";
import { extractUserId } from "../lib/auth";
import { sendPushNotification } from "../services/pushService";
import {
  departments,
  departmentMembers,
  departmentInvites,
  shifts,
  shiftSessions,
  pushTokens,
} from "@shared/schema";

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  "1018674231904-qjp0qr7bvc3sh792mq74inbf02gdqtkb.apps.googleusercontent.com";

async function verifyGoogleCredential(cred: { type: string; token: string }) {
  try {
    if (cred.type === "id_token") {
      const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${cred.token}`);
      if (!r.ok) return null;
      const d = await r.json();
      if (d.aud !== GOOGLE_CLIENT_ID && d.aud !== GOOGLE_CLIENT_ID.split(".")[0]) return null;
      return { sub: d.sub, email: d.email, name: d.name };
    } else if (cred.type === "access_token") {
      const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${cred.token}` },
      });
      if (!r.ok) return null;
      const d = await r.json();
      return { sub: d.sub, email: d.email, name: d.name };
    }
    return null;
  } catch {
    return null;
  }
}

async function notifyHOD(db: ReturnType<typeof getDb>, departmentId: number, message: string) {
  if (!db) return;
  try {
    const hodMembership = await db
      .select({ userId: departmentMembers.userId })
      .from(departmentMembers)
      .where(and(eq(departmentMembers.departmentId, departmentId), eq(departmentMembers.role, "hod"), eq(departmentMembers.status, "active")))
      .limit(1);
    if (!hodMembership.length) return;
    const hodTokens = await db
      .select({ token: pushTokens.token })
      .from(pushTokens)
      .where(eq(pushTokens.userId, hodMembership[0].userId));
    for (const pt of hodTokens) {
      await sendPushNotification(pt.token, "New Join Request", message).catch(() => {});
    }
  } catch {}
}

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

      // Generate a shareable invite token for the department
      const inviteToken = crypto.randomBytes(16).toString("hex");

      const [dept] = await db
        .insert(departments)
        .values({ name: name.trim(), hospitalName: hospitalName?.trim() || null, hodUserId: userId })
        .returning();

      // Set invite_token via raw SQL (Drizzle schema may not have this column yet)
      const pool = getPool();
      if (pool) {
        await pool.query("UPDATE departments SET invite_token = $1 WHERE id = $2", [inviteToken, dept.id]);
      }

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

      const baseUrl = process.env.APP_URL || "https://ermate.in";
      const inviteLink = `${baseUrl}/join?token=${inviteToken}`;

      res.json({ success: true, department: { ...dept, inviteToken }, inviteLink });
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

      // Use raw pool to get invite_token which may not be in Drizzle schema
      const pool = getPool();
      let deptRow: any = null;
      if (pool) {
        const r = await pool.query("SELECT *, invite_token FROM departments WHERE id = $1 LIMIT 1", [mem.departmentId]);
        deptRow = r.rows[0] || null;
      } else {
        const dept = await db.select().from(departments).where(eq(departments.id, mem.departmentId)).limit(1);
        deptRow = dept[0] || null;
      }

      const deptShifts = await db.select().from(shifts).where(eq(shifts.departmentId, mem.departmentId));
      const baseUrl = process.env.APP_URL || "https://ermate.in";
      const inviteLink = deptRow?.invite_token ? `${baseUrl}/join?token=${deptRow.invite_token}` : null;

      // Count pending members
      const pool2 = getPool();
      let pendingCount = 0;
      if (pool2) {
        const pr = await pool2.query(
          "SELECT COUNT(*) FROM department_members WHERE department_id = $1 AND status = 'pending'",
          [mem.departmentId]
        );
        pendingCount = parseInt(pr.rows[0]?.count || "0", 10);
      }

      res.json({ department: deptRow, membership: mem, shifts: deptShifts, inviteLink, pendingCount });
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

      // Get invite link (HOD only)
      let inviteLink: string | null = null;
      if (myMembership[0].role === "hod") {
        const pool = getPool();
        if (pool) {
          const r = await pool.query("SELECT invite_token FROM departments WHERE id = $1 LIMIT 1", [departmentId]);
          const tok = r.rows[0]?.invite_token;
          if (tok) {
            const baseUrl = process.env.APP_URL || "https://ermate.in";
            inviteLink = `${baseUrl}/join?token=${tok}`;
          }
        }
      }

      res.json({ members, invites, inviteLink });
    } catch (e) {
      console.error("[Dept] Members error:", e);
      res.status(500).json({ error: "Failed to fetch members" });
    }
  });

  // ── GET /api/department/join/:token — public, returns dept info ─────────
  app.get("/api/department/join/:token", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "DB unavailable" });
    try {
      const { token } = req.params;
      if (!token) return res.status(400).json({ error: "Token required" });
      const r = await pool.query(
        "SELECT id, name, hospital_name FROM departments WHERE invite_token = $1 LIMIT 1",
        [token]
      );
      if (!r.rows.length) return res.status(404).json({ error: "Invalid or expired invite link" });
      const dept = r.rows[0];
      res.json({ deptId: dept.id, deptName: dept.name, hospitalName: dept.hospital_name || "" });
    } catch (e) {
      console.error("[Dept] Join lookup error:", e);
      res.status(500).json({ error: "Failed to look up invite" });
    }
  });

  // ── POST /api/department/join/:token — doctor requests to join (pending) ─
  app.post("/api/department/join/:token", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "DB unavailable" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const { token } = req.params;
      const { name, role, googleCredential, email: bodyEmail, googleSub } = req.body;

      if (!token) return res.status(400).json({ error: "Token required" });
      if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
      if (!["consultant", "resident"].includes(role)) return res.status(400).json({ error: "Invalid role" });
      if (!googleCredential) return res.status(400).json({ error: "Google credential required" });

      // Verify Google credential
      const googleInfo = await verifyGoogleCredential(googleCredential);
      // Allow fallback: use provided googleSub/email if server-side verification passes  
      const userId = googleInfo?.sub || googleSub;
      const email = googleInfo?.email || bodyEmail;
      if (!userId) return res.status(401).json({ error: "Google sign-in verification failed. Please try again." });

      // Look up department by token
      const deptResult = await pool.query(
        "SELECT id, name, hospital_name FROM departments WHERE invite_token = $1 LIMIT 1",
        [token]
      );
      if (!deptResult.rows.length) return res.status(404).json({ error: "Invalid or expired invite link" });
      const dept = deptResult.rows[0];
      const departmentId = dept.id;

      // Check not already active in any department
      const existingActive = await db
        .select({ id: departmentMembers.id })
        .from(departmentMembers)
        .where(and(eq(departmentMembers.userId, userId), eq(departmentMembers.status, "active")))
        .limit(1);
      if (existingActive.length) return res.status(400).json({ error: "You are already an active member of a department." });

      // Check not already pending for this department
      const existingPending = await db
        .select({ id: departmentMembers.id })
        .from(departmentMembers)
        .where(and(eq(departmentMembers.userId, userId), eq(departmentMembers.departmentId, departmentId), eq(departmentMembers.status, "pending")))
        .limit(1);
      if (existingPending.length) return res.status(409).json({ error: "You already have a pending request for this department." });

      // Create pending member row
      await db.insert(departmentMembers).values({
        departmentId,
        userId,
        role,
        status: "pending",
        name: name.trim(),
        email: email?.toLowerCase() || null,
      });

      // Notify HOD
      await notifyHOD(db, departmentId, `${name.trim()} has requested to join ${dept.name}`);

      res.json({ success: true, message: "Your request has been sent. The HOD will approve you shortly." });
    } catch (e) {
      console.error("[Dept] Join post error:", e);
      res.status(500).json({ error: "Failed to submit join request" });
    }
  });

  // ── GET /api/department/:id/pending — HOD only ───────────────
  app.get("/api/department/:id/pending", async (req: Request, res: Response) => {
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
      const pending = await db
        .select()
        .from(departmentMembers)
        .where(and(eq(departmentMembers.departmentId, departmentId), eq(departmentMembers.status, "pending")))
        .orderBy(departmentMembers.invitedAt);
      res.json({ pending });
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch pending requests" });
    }
  });

  // ── POST /api/department/members/:memberId/approve — HOD approves ────────
  app.post("/api/department/members/:memberId/approve", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const memberId = parseInt(req.params.memberId);
      // Get the member row to find the departmentId
      const memberRows = await db
        .select()
        .from(departmentMembers)
        .where(and(eq(departmentMembers.id, memberId), eq(departmentMembers.status, "pending")))
        .limit(1);
      if (!memberRows.length) return res.status(404).json({ error: "Pending request not found" });
      const member = memberRows[0];

      // Verify requester is HOD of that department
      const hodCheck = await db
        .select()
        .from(departmentMembers)
        .where(and(eq(departmentMembers.userId, userId), eq(departmentMembers.departmentId, member.departmentId), eq(departmentMembers.role, "hod"), eq(departmentMembers.status, "active")))
        .limit(1);
      if (!hodCheck.length) return res.status(403).json({ error: "Only the HOD can approve members" });

      const [updated] = await db
        .update(departmentMembers)
        .set({ status: "active", joinedAt: new Date() })
        .where(eq(departmentMembers.id, memberId))
        .returning();

      // Notify the approved doctor
      const doctorTokens = await db.select({ token: pushTokens.token }).from(pushTokens).where(eq(pushTokens.userId, member.userId));
      const dept = await db.select({ name: departments.name }).from(departments).where(eq(departments.id, member.departmentId)).limit(1);
      for (const pt of doctorTokens) {
        await sendPushNotification(pt.token, "Request Approved", `You have been approved to join ${dept[0]?.name || "the department"}.`).catch(() => {});
      }

      res.json({ success: true, member: updated });
    } catch (e) {
      console.error("[Dept] Approve error:", e);
      res.status(500).json({ error: "Failed to approve member" });
    }
  });

  // ── POST /api/department/members/:memberId/decline — HOD declines ────────
  app.post("/api/department/members/:memberId/decline", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    try {
      const memberId = parseInt(req.params.memberId);
      const memberRows = await db
        .select()
        .from(departmentMembers)
        .where(and(eq(departmentMembers.id, memberId), eq(departmentMembers.status, "pending")))
        .limit(1);
      if (!memberRows.length) return res.status(404).json({ error: "Pending request not found" });
      const member = memberRows[0];

      const hodCheck = await db
        .select()
        .from(departmentMembers)
        .where(and(eq(departmentMembers.userId, userId), eq(departmentMembers.departmentId, member.departmentId), eq(departmentMembers.role, "hod"), eq(departmentMembers.status, "active")))
        .limit(1);
      if (!hodCheck.length) return res.status(403).json({ error: "Only the HOD can decline members" });

      await db
        .update(departmentMembers)
        .set({ status: "inactive", removedAt: new Date() })
        .where(eq(departmentMembers.id, memberId));

      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to decline request" });
    }
  });

  // ── POST /api/department/:id/regenerate-invite ───────────────
  app.post("/api/department/:id/regenerate-invite", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "DB unavailable" });
    try {
      const departmentId = parseInt(req.params.id);
      const hodCheck = await db
        .select()
        .from(departmentMembers)
        .where(and(eq(departmentMembers.userId, userId), eq(departmentMembers.departmentId, departmentId), eq(departmentMembers.role, "hod"), eq(departmentMembers.status, "active")))
        .limit(1);
      if (!hodCheck.length) return res.status(403).json({ error: "Only the HOD can regenerate the invite link" });
      const newToken = crypto.randomBytes(16).toString("hex");
      await pool.query("UPDATE departments SET invite_token = $1 WHERE id = $2", [newToken, departmentId]);
      const baseUrl = process.env.APP_URL || "https://ermate.in";
      res.json({ success: true, inviteLink: `${baseUrl}/join?token=${newToken}` });
    } catch (e) {
      res.status(500).json({ error: "Failed to regenerate invite link" });
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

  // ── GET /api/department/invite/accept?token=xxx ─────────────
  // Legacy route kept for backward compatibility
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
