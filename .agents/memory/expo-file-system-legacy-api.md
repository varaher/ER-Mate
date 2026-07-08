---
name: expo-file-system SDK 54 legacy API
description: expo-file-system's default export changed API shape in Expo SDK 54; use the /legacy subpath for the old writeAsStringAsync/documentDirectory API.
---

On Expo SDK 54, `expo-file-system`'s top-level API changed. Code written against the old
`FileSystem.documentDirectory` + `FileSystem.writeAsStringAsync(uri, base64, { encoding: ... })`
pattern (e.g. downloading a blob and writing it to disk before sharing) must import from
`expo-file-system/legacy`, not the bare `expo-file-system` package root.

**Why:** the new default export uses a different (file-instance-based) API; importing the
old pattern from the bare package silently type-errors or behaves unexpectedly.

**How to apply:** when adding any PDF/file-export-then-share flow (fetch blob → write to
FileSystem.documentDirectory → expo-sharing), import as
`import * as FileSystem from 'expo-file-system/legacy'` to match the existing working
pattern already used in the codebase's discharge/handover export screens.
