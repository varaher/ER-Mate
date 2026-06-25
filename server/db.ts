import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

const connectionString = process.env.DATABASE_URL;

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let pool: Pool | null = null;

export function getDb() {
  if (!connectionString) {
    console.warn("DATABASE_URL not set, database operations will not work");
    return null;
  }
  
  if (!db) {
    pool = new Pool({ connectionString });
    db = drizzle(pool, { schema });
  }
  
  return db;
}

export function getPool(): Pool | null {
  if (!connectionString) return null;
  if (!pool) {
    pool = new Pool({ connectionString });
    db = drizzle(pool, { schema });
  }
  return pool;
}

export async function ensureAuthSessionsTable(): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT,
        email TEXT NOT NULL,
        encrypted_password TEXT NOT NULL,
        iv TEXT NOT NULL,
        tag TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        expires_at TIMESTAMP NOT NULL
      )
    `);
    await p.query(`CREATE INDEX IF NOT EXISTS auth_sessions_email_idx ON auth_sessions(email)`);
    console.log("[DB] auth_sessions table ready");
  } catch (e) {
    console.error("[DB] Failed to ensure auth_sessions table:", e);
  }
}
