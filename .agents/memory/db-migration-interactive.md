---
name: DB schema migration interactive prompts
description: drizzle-kit push blocks on interactive stdin prompts when new tables exist; workaround is direct SQL.
---

## Rule
Never rely on `npm run db:push` for non-interactive CI-style environments. It prompts "is table X created or renamed?" for every new table and blocks forever waiting for stdin.

**Why:** drizzle-kit push uses an interactive CLI that expects a TTY for table-rename disambiguation. Even piping `\n` characters doesn't work reliably.

**How to apply:** When schema changes add new tables, apply them directly:
```javascript
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(`CREATE TABLE IF NOT EXISTS ...`).then(...);
```
Run via: `node -e "const { Pool } = require('pg'); ..."` in bash.

This is always safe with `CREATE TABLE IF NOT EXISTS` — idempotent and non-destructive.
