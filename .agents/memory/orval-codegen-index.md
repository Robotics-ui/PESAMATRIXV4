---
name: Orval codegen index fix
description: Orval regenerates lib/api-zod/src/index.ts on every run; the fix-zod-index.mjs script strips the stale types re-export to prevent duplicate name conflicts.
---

## The Problem
When Orval runs in `split` mode with `workspace` + `schemas` options, it regenerates `lib/api-zod/src/index.ts` with two barrel re-exports:
```
export * from "./generated/api";     // Zod runtime schemas
export * from './generated/types';   // TypeScript interfaces
```
Both files export symbols with the same names (e.g. `RejectMasterAccountBody`). TypeScript TS2308 "already exported" error results.

## The Fix
A post-codegen script `lib/api-spec/fix-zod-index.mjs` strips the `./generated/types` line after Orval runs. The codegen script in `lib/api-spec/package.json` is:
```
"codegen": "orval --config ./orval.config.ts && node fix-zod-index.mjs && pnpm -w run typecheck:libs"
```

**Why:** Zod schemas (in `api.ts`) already provide full type information via `z.infer<>`. The plain TypeScript interfaces in `types/` are redundant and cause name collisions for any request body schema that Orval names explicitly.

**How to apply:** Any time you add a named request body schema to `openapi.yaml` and see TS2308 after codegen, run the codegen — the fix script handles it automatically. Do not manually edit `lib/api-zod/src/index.ts`; it gets overwritten.

## Orval config note
The `schemas` option was removed from `lib/api-spec/orval.config.ts` to stop Orval from generating the `types/` directory entirely. If it gets added back, the conflict returns and the fix script becomes critical again.
