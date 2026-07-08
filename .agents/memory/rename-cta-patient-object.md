---
name: External backend PUT /cases/:id requires full patient object
description: Rename-only PATCH to a case fails with 422 unless age/sex are also sent
---

The external backend's `PUT /cases/:id` validates the entire `patient` object, not a
partial update. Sending `{ patient: { name } }` alone (e.g. for a "rename" action) is
rejected with 422 because `age`/`sex` are required fields in that object.

**Why:** The external backend treats `patient` as a full-replace object, not a merge
patch, even though the app's own semantics (a "rename" button) suggest a partial update.

**How to apply:** Any server route that mutates a subset of `patient` fields on an
existing case must first fetch the current case (`GET /cases/:id`) to backfill the
missing required fields (age, sex, phone), or the client must already have those values
locally and include them in the request — before sending the `PUT`. Prefer having the
client pass through fields it already holds (e.g. from the case list item) to avoid an
extra round trip, with server-side backfill as a fallback for safety.
