---
name: Typography constants usage
description: The Typography export in client/constants/theme.ts uses style-object keys, not numeric size shortcuts.
---

## Rule
`Typography` in `client/constants/theme.ts` exports **style objects**, not plain numbers.

Valid keys: `h1`, `h2`, `h3`, `h4`, `body`, `bodyMedium`, `small`, `label`, `caption`, `link`

Each value is `{ fontSize: number, fontWeight: string }` — meant to be spread into styles.

**Wrong (causes undefined fontSize at runtime):**
```typescript
fontSize: Typography.sm    // undefined!
fontSize: Typography.xs    // undefined!
fontSize: Typography.base  // undefined!
```

**Correct options:**
```typescript
fontSize: Typography.small.fontSize   // 14
fontSize: 12                          // inline number
...Typography.small                   // spread (adds fontWeight too)
```

**Why:** Many pre-existing files also misuse `Typography.sm` etc. — they silently fail (undefined fontSize) but don't crash. New screens should use inline numbers or `.fontSize` property access.

**Mapping:**
- xxl → 24, xl → 20, lg → 18, base → 16, sm → 14, xs → 12
