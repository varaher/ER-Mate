---
name: Team System architecture
description: Key decisions for the ErMate Team System (departments, shifts, handovers, escalations).
---

## Architecture

**Data ownership:**
- Local PostgreSQL: departments, department_members, department_invites, shifts, shift_sessions, case_overlays, escalations, department_billing, push_tokens
- External backend (er-emr-backend.onrender.com): all clinical case data
- Merge happens client-side on `caseId` (text, no FK constraint possible)

**Backend structure:**
- Route files: `server/routes/department.ts`, `server/routes/shifts.ts`, `server/routes/escalations.ts`
- Registered at bottom of `registerRoutes()` in `server/routes.ts` before `return httpServer`
- Auth: `server/lib/auth.ts` — `extractUserId()` decodes JWT sub/id field; no npm jwt package
- Push: `server/services/pushService.ts` — Expo Push API, no extra npm package
- Email: `server/services/emailService.ts` — Resend API, gracefully skips if no RESEND_API_KEY

**Frontend structure:**
- `client/context/DepartmentContext.tsx` — wraps app inside DepartmentProvider (in App.tsx, inside AuthProvider)
- `ShiftSelectScreen` shown as Modal overlay from App.tsx (not a stack screen) — appears automatically when user has dept but no active shift
- New stack screens: SetupDepartment, ManageRoster, AdminDashboard, HandoverDetail, Escalation

**HOD flow:** Profile → Set Up Department → creates dept + 3 default shifts → ManageRoster → invite by email
**Doctor flow:** Login → ShiftSelectScreen modal → check in → on-duty; Profile → End Shift to check out
**Handover flow:** Cases screen → Hand Over → selects shift → POST /api/handover/create
**Escalation flow:** Case sheet → Escalate → POST /api/escalations → pushes to on-duty consultants

**WhatsApp share:** "Coming Soon" placeholder everywhere (not implemented).
