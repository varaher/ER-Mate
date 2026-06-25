import type { Request, Response, NextFunction } from "express";

export function decodeJwt(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export function extractUserId(req: Request): string | null {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];
  if (!token) return null;
  const payload = decodeJwt(token);
  if (!payload) return null;
  return payload.sub || payload.id || payload.user_id || payload.email || null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = extractUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).userId = userId;
  next();
}
