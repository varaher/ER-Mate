#!/bin/bash
set -e

npm install --no-audit --no-fund

# Rebuild static bundles with the production domain so the deployment build
# finds pre-built bundles and skips Metro entirely (Metro times out in prod).
# Metro's on-disk transform cache (node_modules/.cache/metro) is warm after
# any recent workflow run, so this rebuild typically completes in < 30s.
rm -rf static-build
REPLIT_INTERNAL_APP_DOMAIN=er-mate.replit.app npm run expo:static:build
