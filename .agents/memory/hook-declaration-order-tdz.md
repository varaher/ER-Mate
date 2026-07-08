---
name: React hook declaration order TDZ crash
description: A screen-wide crash that reproduces for every user regardless of data is often a hook ordering bug, not a data/feature bug.
---

A component crashed on every navigation to a screen (React Native / Expo, web bundle) with a minified `ReferenceError: Cannot access 'X' before initialization`. Root cause: a `useFocusEffect(useCallback(() => { ...; refetch(); }, [refetch]))` block was placed textually *before* the `const { refetch } = useQuery(...)` that declares `refetch`, later in the same function body. JS hoists `const` into a temporal dead zone, so referencing it in a callback defined earlier — even though the callback only *runs* later, after render — still throws once the effect's dependency array is evaluated during the same render pass.

**Why this matters:** the crash looked feature/data-specific at first (it was reported in the context of a specific feature relying on seeded data), but reproduced identically for a brand-new user with zero relevant data. That's the tell: if a crash on a screen happens for *every* user/dataset, suspect a hook-ordering or module-load bug in that screen's source, not the feature/data path being investigated.

**How to apply:** When a screen crashes with a TDZ-style error in a minified production bundle (variable names are obfuscated, e.g. `Ce`), don't try to decode the minified name — instead read the screen's source top-to-bottom and check that every `useCallback`/`useEffect`/`useFocusEffect` dependency array only references `const`/`let` bindings that are declared *earlier* in the function body (including bindings destructured from other hooks like `useQuery`). Fix by reordering the effect below the hook that declares the dependency.
