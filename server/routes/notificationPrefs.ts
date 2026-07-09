import type { Express, Request, Response } from "express";
import { getPool } from "../db";
import { extractUserId } from "../lib/auth";

/**
 * GET /api/notifications/prefs
 * Returns the server-side notification preferences for the authenticated user.
 * Currently tracks: caseUpdates (maps to notif_case_updates on department_members).
 * Returns defaults if the user has no department membership.
 */
async function getPrefs(req: Request, res: Response) {
  const userId = extractUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const pool = getPool();
  if (!pool) return res.status(503).json({ error: "Database unavailable" });

  try {
    const result = await pool.query(
      `SELECT notif_case_updates FROM department_members
       WHERE user_id = $1 AND status = 'active'
       LIMIT 1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.json({ caseUpdates: true });
    }

    const row = result.rows[0];
    return res.json({
      caseUpdates: row.notif_case_updates !== false,
    });
  } catch (err: any) {
    console.error("[notifPrefs] GET error:", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * PUT /api/notifications/prefs
 * Updates server-side notification preferences for the authenticated user.
 * Body: { caseUpdates: boolean }
 * Updates all active department_members rows for this user (a doctor may be
 * in more than one department; preferences apply globally).
 */
async function putPrefs(req: Request, res: Response) {
  const userId = extractUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const pool = getPool();
  if (!pool) return res.status(503).json({ error: "Database unavailable" });

  const { caseUpdates } = req.body ?? {};

  if (typeof caseUpdates !== "boolean") {
    return res.status(400).json({ error: "caseUpdates must be a boolean" });
  }

  try {
    await pool.query(
      `UPDATE department_members
       SET notif_case_updates = $1
       WHERE user_id = $2 AND status = 'active'`,
      [caseUpdates, userId]
    );
    return res.json({ caseUpdates });
  } catch (err: any) {
    console.error("[notifPrefs] PUT error:", err);
    return res.status(500).json({ error: err.message });
  }
}

export function registerNotificationPrefsRoutes(app: Express): void {
  app.get("/api/notifications/prefs", getPrefs);
  app.put("/api/notifications/prefs", putPrefs);
}
