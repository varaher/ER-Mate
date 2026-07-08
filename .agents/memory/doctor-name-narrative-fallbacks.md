---
name: Doctor-name and AI-narrative default fallback pattern
description: How case-creation em_resident defaulting and AI-generated narrative text should be layered into pre-existing document templates, not used as full replacements.
---

## em_resident (doctor name) defaulting
Case-creation routes accept `ex.emResident` (from AI extraction) but previously fell back straight to `patient?.informant_name` — which is the *patient's next-of-kin*, not the doctor. Never use patient/informant fields as a doctor-name fallback.

**Fix pattern:** decode the JWT (`payload.name || payload.fullName`) as a fallback in addition to any `userName` sent explicitly in the request body from the client. Order of precedence: AI-extracted name > client-sent userName > JWT name claim > (existing weaker fallback).

**Why:** the logged-in doctor's identity is always available via their auth token even when AI extraction/dictation didn't mention a name — that should be preferred over an unrelated patient field.

## AI narrative text should extend templates, not replace them
When an AI endpoint returns a narrative/summary string meant for one section of a larger structured document (e.g. discharge summary), do not use `json.summary` as the entire document. Pass it as an override parameter into the specific section of the template generator function instead, so all other sections (patient info, vitals, signatures, etc.) are preserved.

**How to apply:** anywhere a generator function assembles a multi-section document client-side and a server AI call can enrich one section, add an optional override param to the generator rather than swapping the whole output.
