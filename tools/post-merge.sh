#!/bin/bash
set -e

npm install --no-audit --no-fund

# Rebuild static bundles with the production domain so the deployment build
# finds pre-built bundles and skips Metro entirely (Metro times out in prod).
# This is best-effort: if Metro times out (e.g. after adding new packages that
# bust the transform cache), the merge still succeeds and the workflow's
# running Metro server will warm the cache for the next deploy attempt.
rm -rf static-build
set +e
REPLIT_INTERNAL_APP_DOMAIN=er-mate.replit.app npm run expo:static:build
BUILD_EXIT=$?
set -e

if [ $BUILD_EXIT -ne 0 ]; then
  echo "WARNING: Static bundle build failed or timed out (exit $BUILD_EXIT)."
  echo "The next deployment will trigger a Metro rebuild."
  echo "If this was a cold cache miss, re-run the workflow and retry publishing."
fi

exit 0
