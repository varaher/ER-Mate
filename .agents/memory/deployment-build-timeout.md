---
name: Deployment build Metro timeout fix
description: Why production publish fails with iOS/Android bundle timeout and how to prevent it
---

## The problem
Production build (cloudrun) always starts Metro from a cold cache. Compiling iOS/Android bundles takes ~3-4 min from cold; the build script hard timeout is 2 min → "Download timeout after 2m". Local dev succeeds only because Metro transform cache warms up between attempts.

## The fix (applied)
Two-part solution:
1. Deployment build command (.replit [deployment].build) now includes REPLIT_INTERNAL_APP_DOMAIN=er-mate.replit.app. This tells scripts/build.js to use the production domain when checking or creating the static build.
2. Pre-commit the static-build with production-domain URLs. Before each publish, run: REPLIT_INTERNAL_APP_DOMAIN=er-mate.replit.app npm run expo:static:build locally (Metro cache warm after any recent dev build → ~4 seconds). The production build then calls checkExistingBuild("https://er-mate.replit.app"), finds matching manifests + bundles, prints "Static bundles already exist - skipping rebuild", and skips Metro entirely.

## Key rule before every publish
Ensure static-build/ios/manifest.json has launchAsset.url starting with https://er-mate.replit.app AND the corresponding bundle files exist under static-build/{timestamp}/_expo/static/js/{ios,android}/bundle.js (size > 1 KB each).

Verify with: python3 -c "import json; m=json.load(open('static-build/ios/manifest.json')); print(m['launchAsset']['url'])"

## Pre-build command
REPLIT_INTERNAL_APP_DOMAIN=er-mate.replit.app npm run expo:static:build
