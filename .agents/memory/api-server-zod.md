---
name: api-server zod import
description: api-server has no direct zod dependency. Never import from zod/v4 there; use manual validation or @workspace/api-zod generated schemas.
---

## The Rule
`artifacts/api-server` does NOT have `zod` as a dependency. Importing `from "zod/v4"` or `from "zod"` in any file under `artifacts/api-server/src/` will cause TS2307 "Cannot find module" errors.

**Why:** The api-server was designed to consume only the pre-generated Zod schemas from `@workspace/api-zod`. Direct zod usage was intentionally avoided.

## How to apply
For route validation in api-server, use one of:
1. **Generated schemas** — import from `@workspace/api-zod` (e.g. `SuspendUserParams`, `CreateMasterAccountBody`)
2. **Manual validation** — `parseInt(String(req.params.id ?? ""), 10)`, `typeof req.body?.reason === "string"`

If you genuinely need to add a new Zod schema for an api-server route, add it to `openapi.yaml` and run codegen so it ends up in `@workspace/api-zod`.
