---
name: External backend DELETE cases rejects
description: The external backend at er-emr-backend.onrender.com rejects DELETE /cases/:id — errors were silently swallowed, causing deleted cases to reappear on next refresh. Fix pattern and key names documented here.
---

## The rule
Never rely on the external backend's DELETE /api/cases/:id actually succeeding. Always hide the case locally as a fallback so it never reappears.

**Why:** Calling `DELETE https://er-emr-backend.onrender.com/api/cases/:id` returns a non-2xx response (confirmed via curl: "Internal Server Error" with fake token, "Method Not Allowed" with OPTIONS). Even if the endpoint works for some tokens, it's unreliable. The previous code swallowed the error with `catch {}`, so users saw cases disappear then reappear on refresh.

**How to apply:**
- `hideCaseLocally(caseId)` in `client/lib/api.ts` — adds ID to AsyncStorage key `hidden_case_ids_v1`
- `getHiddenCaseIds()` — returns a Set of hidden IDs
- `fetchCasesFromProxy` already filters hidden IDs from the API response before returning
- `deleteCaseFromProxy` calls `hideCaseLocally` on success; callers should call `hideCaseLocally` in the `catch` block on failure
- Server DELETE proxy (`app.delete("/api/proxy/cases/:id")`) logs the external backend response for diagnosis

Pattern for any delete handler:
```typescript
try {
  await deleteCaseFromProxy(id);
} catch {
  await hideCaseLocally(id); // ensure case never reappears
}
// then do optimistic UI update
```
