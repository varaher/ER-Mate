---
name: Handover Chat mirrors hospital paper handover forms
description: Why the Handover Chat patient schema maps 1:1 to standard hospital "ER Doctors Handover Sheet" paper columns
---

Real hospital ER handover paper forms (e.g. the Rajagiri Hospital "Emergency Department
Doctors Handover Sheet") use a fixed column set: Patient Label, Presenting complaints, Past
medical history, Provisional diagnosis, Management plan (split into Done / To be done), and
Bystander Update given time.

**Why:** Doctors already have this exact mental model burned in from years of filling the
paper form. When ErMate's Handover Chat structures a conversation into columns, matching
those exact labels (not inventing new terminology) makes the AI output instantly legible
during a handover, and lets doctors sanity-check "did I give ErMate everything the paper form
asks for" at a glance.

**How to apply:** The GPT-4o extraction schema in `server/routes/handoverChat.ts` explicitly
maps each paper column to a patient field (`presentingComplaints`, `pastMedicalHistory`,
`diagnosis` = provisional diagnosis, `managementDone` / `pendingTasks` = management plan done
vs to-be-done, `bystanderUpdateTime`), on top of the richer fields ErMate already captures
(vitals, criticalAlerts, awaitingResults, medications) that go beyond what the paper form
tracks. When asked to add more "required sections" from a hospital's physical form, extend
this same patient schema and its three consumers in lockstep: the chat card UI in
`HandoverChatScreen.tsx`, and both `buildHandoverText`/`buildWhatsappText` string builders
(these feed WhatsApp share, Copy, and PDF export — all three reuse the same builder, so no
separate PDF-specific work is needed).
