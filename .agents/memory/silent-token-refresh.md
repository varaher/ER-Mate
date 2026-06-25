---
name: Silent token refresh architecture
description: How ErMate handles JWT expiry without a backend refresh endpoint
---

The external backend (er-emr-backend.onrender.com) issues short-lived JWTs with no /auth/refresh endpoint and no control over expiry duration.

**Solution: server-side encrypted credential cache**

- `auth_sessions` PostgreSQL table: id, email, encrypted_password (AES-256-GCM), iv, tag, expires_at (90 days)
- `POST /api/auth/store-creds` — called after every login; encrypts password with SESSION_SECRET; returns a `session_token` (UUID, safe to store on device)
- `POST /api/auth/silent-refresh` — client sends session_token; server decrypts password; re-calls external /auth/login; returns fresh access_token

**Client flow in `client/lib/api.ts` `tryRefreshToken()`:**
1. Try external /auth/refresh with refresh_token (in case backend adds it later) 
2. Fall back to POST /api/auth/silent-refresh with stored session_token
3. If both fail → handleLogout() → clean "session expired" screen

**Proactive expiry:** `getValidToken()` decodes JWT exp claim, refreshes 5 min before expiry so doctors never hit 401 during a shift.

**Concurrency lock:** `_refreshPromise` singleton prevents multiple simultaneous refresh calls.

**`/web/bundle.js` cache:** served with `Cache-Control: no-cache` (fixed in server/index.ts) since filename never changes between deploys. Timestamp-based iOS/Android bundles keep `immutable`.

**Why:** External backend token expiry caused raw `{"detail":"Token expired"}` JSON on the dashboard — first thing doctors see on opening the app.
