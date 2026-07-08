---
name: Shared AI-prompt-building helpers prevent drift
description: How to avoid two endpoints silently diverging when they both build similar GPT prompts from the same underlying clinical data.
---

## Rule
When two or more API endpoints independently transform the same underlying data (e.g. a case's addenda/timeline) into a GPT prompt, extract the shared data-formatting and section-structure logic into named helper functions in a services module, and have every call site use them — rather than each endpoint hand-rolling its own copy of the formatting/prompt text.

**Why:** In this codebase, `POST /api/ai/discharge-summary` (server/services/aiDiagnosis.ts `generateCourseInHospital`) and `POST /api/ai/discharge-from-timeline` (inline prompt in server/routes.ts) each independently fetched `case_addenda`, formatted the timeline, computed ER stay duration, and defined the discharge-narrative section list. They started similar but drifted (different section names/order, different duration wording, different addendum formatting detail) because there was no single source of truth — a fix or improvement made to one was never mirrored to the other.

**How to apply:** Extract three kinds of shared pieces when you see this pattern:
1. A data-fetching + formatting helper (e.g. `buildAddendaTimeline(caseId, arrivalMs?)`) that returns both the formatted text and any derived values (like duration) needed downstream.
2. A "wording" helper for any sentence that must read identically regardless of entry point (e.g. `erDurationStatement(duration)`).
3. A section-structure helper (e.g. `addendaNarrativeSections(duration?)`) that both prompts interpolate, instead of each hardcoding its own numbered list.

Place these in the shared services module (not routes.ts) so all call sites — including future new entry points — import and use the same implementation.
