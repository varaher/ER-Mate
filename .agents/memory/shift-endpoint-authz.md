---
name: Shift/department endpoints need membership check, not just auth
description: extractUserId() proves the caller is logged in, not that they belong to the department/shift they're requesting — every route that reads department/shift data must add an explicit active-membership check.
---

Being authenticated (a valid JWT / `extractUserId(req)` returning a userId) is not the same as being authorized for a specific department or shift. Several endpoints in `server/routes/shifts.ts` (shift slot counts, check-in) only checked authentication and let any logged-in user query or act on any department's shift data by guessing/incrementing IDs in the URL.

**Why:** These endpoints take a `departmentId`/`shiftId` path/route param directly from the client with no ownership check. Without a membership check, cross-department data leakage (slot counts) or cross-department action (checking into another team's shift) is possible for any authenticated user in the app, not just outsiders.

**How to apply:** Any new or existing route under `server/routes/shifts.ts` or `server/routes/department.ts` that accepts a `departmentId` (or resolves one via a `shiftId`/`caseId` lookup) must query `departmentMembers` for an active row matching `(userId, departmentId)` — and role-restrict further (e.g. `role === "hod"`) when the action is HOD-only — before returning data or performing the action. Reuse the existing pattern already used in `all-shift-cases` and `shift-cases`:
```ts
const myMem = await db.select().from(departmentMembers)
  .where(and(eq(departmentMembers.userId, userId), eq(departmentMembers.departmentId, departmentId), eq(departmentMembers.status, "active")))
  .limit(1);
if (!myMem.length) return res.status(403).json({ error: "Not a member of this department" });
```
Note: because of the userId-mismatch issue (see `dept-shift-bugs.md`), a legitimate member could still fail this check if their `department_members.user_id` hasn't been self-healed yet — the self-healing happens on `GET /api/department/my`, which the app calls on load, so this is a low-risk edge case but worth remembering if a real user reports a false 403.
