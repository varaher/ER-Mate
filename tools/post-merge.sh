#!/bin/bash
set -e

npm install --no-audit --no-fund

# Force a static rebuild so merged client changes are picked up on next start.
# Server-side DB tables self-migrate on boot (see server/db.ts "table ready" logs),
# so no separate migration step is needed here.
rm -rf static-build
