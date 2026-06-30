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

export async function ensureDepartmentTables(): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        hospital_name TEXT,
        hod_user_id TEXT NOT NULL,
        max_concurrent INTEGER DEFAULT 8,
        allow_overflow BOOLEAN DEFAULT true,
        plan TEXT DEFAULT 'team',
        billing_active BOOLEAN DEFAULT false,
        payment_subscription_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS department_members (
        id SERIAL PRIMARY KEY,
        department_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        joined_at TIMESTAMP,
        removed_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS department_invites (
        id SERIAL PRIMARY KEY,
        department_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        accepted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS shifts (
        id SERIAL PRIMARY KEY,
        department_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        max_consultants INTEGER DEFAULT 2,
        max_residents INTEGER DEFAULT 6
      );

      CREATE TABLE IF NOT EXISTS shift_sessions (
        id SERIAL PRIMARY KEY,
        shift_id INTEGER NOT NULL,
        department_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        role_for_shift TEXT NOT NULL,
        checked_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checked_out_at TIMESTAMP,
        status TEXT DEFAULT 'active',
        force_logout_by TEXT,
        force_logout_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS case_overlays (
        id SERIAL PRIMARY KEY,
        case_id TEXT NOT NULL,
        department_id INTEGER NOT NULL,
        shift_session_id INTEGER,
        handover_status TEXT DEFAULT 'active',
        handed_over_to_shift_id INTEGER,
        handed_over_by_user_id TEXT,
        handed_over_at TIMESTAMP,
        received_by_user_id TEXT,
        received_at TIMESTAMP,
        bed_number TEXT,
        pending_notes TEXT,
        consultant_reviewed_by TEXT,
        consultant_reviewed_at TIMESTAMP,
        consultant_note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS escalations (
        id SERIAL PRIMARY KEY,
        case_id TEXT NOT NULL,
        department_id INTEGER NOT NULL,
        from_resident_id TEXT NOT NULL,
        to_consultant_id TEXT,
        reason TEXT,
        escalated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_by TEXT,
        reviewed_at TIMESTAMP,
        review_note TEXT,
        status TEXT DEFAULT 'pending'
      );

      CREATE TABLE IF NOT EXISTS department_billing (
        id SERIAL PRIMARY KEY,
        department_id INTEGER NOT NULL,
        consultant_count INTEGER DEFAULT 0,
        resident_count INTEGER DEFAULT 0,
        consultant_rate INTEGER DEFAULT 59900,
        resident_rate INTEGER DEFAULT 39900,
        billing_cycle TEXT DEFAULT 'monthly',
        payment_subscription_id TEXT,
        payment_customer_id TEXT,
        status TEXT DEFAULT 'pending',
        current_period_start TIMESTAMP,
        current_period_end TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS push_tokens (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL,
        platform TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Idempotent column migrations — covers all columns added since initial deploy
    await p.query(`
      ALTER TABLE department_members ADD COLUMN IF NOT EXISTS name TEXT;
      ALTER TABLE department_members ADD COLUMN IF NOT EXISTS email TEXT;
      ALTER TABLE department_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP;
      ALTER TABLE department_members ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP;

      ALTER TABLE departments ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE;
      ALTER TABLE departments ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'team';
      ALTER TABLE departments ADD COLUMN IF NOT EXISTS payment_subscription_id TEXT;
      ALTER TABLE departments ADD COLUMN IF NOT EXISTS billing_active BOOLEAN DEFAULT false;
      ALTER TABLE departments ADD COLUMN IF NOT EXISTS allow_overflow BOOLEAN DEFAULT true;
      ALTER TABLE departments ADD COLUMN IF NOT EXISTS max_concurrent INTEGER DEFAULT 8;

      ALTER TABLE shift_sessions ADD COLUMN IF NOT EXISTS force_logout_by TEXT;
      ALTER TABLE shift_sessions ADD COLUMN IF NOT EXISTS force_logout_at TIMESTAMP;

      ALTER TABLE rota_assignments ADD COLUMN IF NOT EXISTS day_of_week INTEGER;

      ALTER TABLE case_overlays ADD COLUMN IF NOT EXISTS handover_status TEXT DEFAULT 'active';
      ALTER TABLE case_overlays ADD COLUMN IF NOT EXISTS handed_over_to_shift_id INTEGER;
      ALTER TABLE case_overlays ADD COLUMN IF NOT EXISTS handed_over_by_user_id TEXT;
      ALTER TABLE case_overlays ADD COLUMN IF NOT EXISTS handed_over_at TIMESTAMP;
      ALTER TABLE case_overlays ADD COLUMN IF NOT EXISTS received_by_user_id TEXT;
      ALTER TABLE case_overlays ADD COLUMN IF NOT EXISTS received_at TIMESTAMP;
      ALTER TABLE case_overlays ADD COLUMN IF NOT EXISTS bed_number TEXT;
      ALTER TABLE case_overlays ADD COLUMN IF NOT EXISTS pending_notes TEXT;
      ALTER TABLE case_overlays ADD COLUMN IF NOT EXISTS consultant_reviewed_by TEXT;
      ALTER TABLE case_overlays ADD COLUMN IF NOT EXISTS consultant_reviewed_at TIMESTAMP;
      ALTER TABLE case_overlays ADD COLUMN IF NOT EXISTS consultant_note TEXT;
      ALTER TABLE case_overlays ADD COLUMN IF NOT EXISTS patient_name TEXT;
      ALTER TABLE case_overlays ADD COLUMN IF NOT EXISTS patient_age TEXT;
      ALTER TABLE case_overlays ADD COLUMN IF NOT EXISTS chief_complaint TEXT;
      ALTER TABLE case_overlays ADD COLUMN IF NOT EXISTS triage_priority INTEGER;
      ALTER TABLE case_overlays ADD COLUMN IF NOT EXISTS doctor_user_id TEXT;
      ALTER TABLE case_overlays ADD COLUMN IF NOT EXISTS doctor_name TEXT;
    `);
    // Generate invite_token for any departments that don't have one (Node.js side)
    const depts = await p.query("SELECT id FROM departments WHERE invite_token IS NULL");
    const cryptoM = await import("crypto");
    for (const row of depts.rows) {
      const tok = cryptoM.randomBytes(16).toString("hex");
      await p.query("UPDATE departments SET invite_token = $1 WHERE id = $2", [tok, row.id]);
    }
    console.log("[DB] Department tables ready");
  } catch (e) {
    console.error("[DB] Failed to ensure department tables:", e);
  }
}

export async function ensurePasswordResetTable(): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        email TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS prt_token_idx ON password_reset_tokens(token);
      CREATE INDEX IF NOT EXISTS prt_email_idx ON password_reset_tokens(email);
    `);
    console.log("[DB] password_reset_tokens table ready");
  } catch (e) {
    console.error("[DB] Failed to ensure password_reset_tokens table:", e);
  }
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
