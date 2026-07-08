---
name: External backend PUT /cases/:id requires full patient object
description: Any partial patient update (rename, age/sex fix, etc.) fails with 422 unless the ENTIRE patient object is sent
---

The external backend's `PUT /cases/:id` validates the entire `patient` object as a strict
schema, not a merge patch. It requires ALL of: name, age, sex, phone, address,
arrival_datetime, mode_of_arrival, brought_by, informant_name, informant_reliability,
identification_mark. Sending only the changed field(s) (e.g. `{ patient: { name } }` for a
"rename" action, or cherry-picking just name+age+sex) is rejected with 422 as soon as the
case has any of the other required fields already set.

**Why:** The external backend treats `patient` as a full-replace object, not a merge patch,
even though the app's own semantics (a "rename" button, an "update age" field) suggest a
partial update. An earlier fix that only backfilled age/sex/phone still 422'd once real
cases had the other identity fields (address, informant_name, etc.) populated.

**How to apply:** Any server route that mutates a subset of `patient` fields on an existing
case must fetch the full current case first (`GET /cases/:id`), spread the ENTIRE existing
`patient` object, then overlay only the changed field(s) on top — never construct the
payload by listing out specific field names to carry over. Pattern:
`{ ...currentPatient, ...clientOverrides, name: newName.trim() }`. This generalizes to any
other partial-update flow that touches `patient` (not just rename) — apply the same
fetch-full-merge-then-PUT approach rather than a per-field allowlist.
