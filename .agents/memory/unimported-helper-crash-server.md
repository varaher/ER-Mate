---
name: Unimported helper crashes whole server
description: tsx (no type-checking dev runtime) lets an unimported function reference through until it's actually called, then it crashes the entire Node process, not just the request.
---

## The rule
Under `tsx` (used for `server:dev`), TypeScript type errors like "Cannot find name 'X'" do NOT stop the server from starting. The route registers fine. The crash only happens the first time that code path executes, and it's an uncaught `ReferenceError` that takes down the whole Express process — every user, not just the caller of that one endpoint.

**Why:** `tsx` transpiles without a blocking type-check pass, so `npx tsc --noEmit` catching the error and the dev server actually running the broken code are two independent signals. A route added/edited without running it end-to-end (or without `tsc --noEmit` in CI) can ship a landmine that only detonates in production traffic.

**How to apply:**
- After adding/editing a server route that uses a helper (auth extraction, DB pool, etc.), actually call it once (curl/smoke test) — don't rely on `tsc --noEmit` alone, and don't assume "it compiles under tsx" means "it's correct."
- If a request to a newly-touched route hangs/times out or curl exits with a connection-reset, immediately check `refresh_all_logs` for an uncaught exception — it likely killed the whole server, not just that request.
- When wiring a new route into an existing large `routes.ts`, double check the top-of-file import list actually includes every helper you reference (e.g. `extractUserId` from `./lib/auth`) — easy to miss when copy-pasting a pattern from another route that already had the import.
