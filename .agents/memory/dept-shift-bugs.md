---
name: Department shift system bugs
description: Two bugs in the team shift system — route ordering causing 500s, and userId mismatch between join flow and app auth causing membership lookup to fail.
---

## Bug 1 — Route ordering: invites/pending 500

**Rule:** Specific routes must always be registered BEFORE parameterized routes with the same prefix in Express.

**What happened:** `GET /api/department/invites/pending` was registered AFTER `GET /api/department/:id/pending`. Express matched `/invites/pending` with `:id = "invites"`, so `parseInt("invites") = NaN` was passed to the DB query for `department_id`, causing a PostgreSQL error → catch block → 500.

**Why:** Express evaluates routes in registration order. A parameterized segment like `:id` greedily matches any literal segment, so `/api/department/invites/pending` will NEVER reach a route registered after `/:id/pending`.

**How to apply:** Whenever adding a literal route like `/api/department/invites/pending`, check whether any earlier-registered `/:id/something` route with the same trailing segment exists. If yes, move the literal route BEFORE it.

## Bug 2 — userId mismatch: team members can't find membership

**Rule:** The join flow stores `userId = Google sub` (from Google OAuth), but the app JWT sub is the external backend's UUID. These are different. Membership lookups by userId alone will silently fail.

**Fix:** In `GET /api/department/my`, after failing the userId lookup, fall back to looking up by email via `auth_sessions` table (`user_id` → `email`), then query `department_members` by email. On a match, self-heal by updating `department_members.user_id` to the current JWT sub with a raw SQL UPDATE. This is a one-time fix per user on their first app login after joining.

**Why:** The join happens in a browser via Google Sign-In; the app uses the external backend's UUID from its own auth system. These two identity systems use different IDs for the same user. Email is the stable cross-system identifier.

**How to apply:** Any endpoint that resolves a team member by userId should consider adding the same email-based fallback if the primary lookup fails.
