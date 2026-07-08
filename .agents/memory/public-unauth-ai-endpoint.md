---
name: Public unauthenticated AI endpoint pattern
description: How to safely expose a free, no-login AI-powered tool alongside an auth-gated app
---

When a product needs a public, no-login "try it free" AI feature living inside an otherwise auth-gated app (e.g. a paste-and-structure tool), keep it structurally separate from the authenticated feature it resembles:

- New standalone route file (`server/routes/<feature>Public.ts`) exporting its own `registerXxxRoutes(app)`, registered alongside the other route registrations — do not bolt public logic onto an existing authenticated router.
- New standalone screen registered in **both** the unauthenticated and authenticated navigator stacks (so logged-in users can reach it too), with an entry-point link from the login screen.
- No `express-rate-limit` package is installed in this project; a public unauthenticated AI endpoint needs its own custom in-memory per-IP rate limiter (bucket + resetAt map, cleaned via an unref'd `setInterval`) since there's no auth/session to key off of.
- Do not log or persist the raw pasted text server-side (PHI/privacy risk) — only log length + IP. Return structured JSON only; format any shareable text (e.g. WhatsApp message) client-side from the structured data rather than trusting the model to also produce display-ready text.

**Why:** keeps the free/public surface from silently weakening the security or data-handling posture of the paid/authenticated product, and avoids uncontrolled AI cost exposure from anonymous traffic.

**How to apply:** any time a "free public version" of an existing authenticated feature is requested, replicate this split (separate route file + separate screen + own rate limiter) rather than adding an `optionalAuth` bypass to the existing authenticated code path.
