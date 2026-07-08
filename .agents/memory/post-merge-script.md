---
name: Post-merge script location
description: Where the post-merge setup hook script lives and what it must do in this project
---

The post-merge hook (runs automatically after a task-agent merge) was unconfigured, causing merges to fail with HOOK_NOT_FOUND.

**Why:** The project's `scripts/` directory is forbidden to modify (per Expo static-deployment constraints), so the post-merge script cannot live there. It was placed at `tools/post-merge.sh` instead and registered via `setPostMergeConfig({ scriptPath: "tools/post-merge.sh", timeoutMs: 180000 })`.

**How to apply:** If post-merge setup fails again with a missing-script error, check `tools/post-merge.sh` exists and is executable. The script only needs to run `npm install` and `rm -rf static-build` — DB tables self-migrate on server boot (see `server/db.ts` "table ready" logs), so no separate migration step is required. Deleting `static-build/` forces the next workflow start to rebuild the Expo static bundle so merged client changes take effect.
