---
name: CopyFactory API quirks
description: Two critical MetaApi CopyFactory gotchas — wrong role field name and expired TLS cert workaround.
---

## Rule 1: Role field name is `copyFactoryRoles`, not `roles`

When assigning CopyFactory roles via the MetaApi provisioning API (PUT `/users/current/accounts/:id`), the correct body is:

```json
{ "copyFactoryRoles": ["PROVIDER"] }   // for master accounts
{ "copyFactoryRoles": ["SUBSCRIBER"] } // for slave accounts
```

Do NOT use `{ "roles": [...] }` — MetaApi returns HTTP 400 "Unexpected value" for that field name.

**Why:** The provisioning API supports multiple role types; `copyFactoryRoles` is the CopyFactory-specific sub-field. The MetaApi response body shows `"copyFactoryRoles": []` confirming the correct name.

**How to apply:** Any PUT to the MetaApi provisioning accounts endpoint for CopyFactory role assignment must use `copyFactoryRoles` with uppercase values (`PROVIDER`, `SUBSCRIBER`).

---

## Rule 2: CopyFactory domain has an expired TLS cert

`copyfactory-api-v1.agiliumtrade.agiliumtrade.ai` has an expired TLS certificate. All `fetch()` calls to this domain throw `certificate has expired`.

**Fix:** Temporarily set `process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"` scoped to the CopyFactory fetch call, then restore the previous value in a `finally` block. This is safe because CopyFactory calls are sequential (account poller), not concurrent.

```typescript
const isCopyFactory = url.includes("copyfactory-api-v1");
const prevTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
if (isCopyFactory) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
try {
  response = await fetch(url, { ... });
} finally {
  if (isCopyFactory) {
    if (prevTlsReject === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevTlsReject;
  }
}
```

**Why NOT undici Agent:** `undici@8.x` (installed by pnpm) requires Node.js 22+. We run Node.js 20.20.0. The `Agent` import crashes at runtime with `webidl.util.markAsUncloneable is not a function`.

**How to apply:** This is already implemented in `callMetaApi()` in `artifacts/api-server/src/lib/metaapi.ts`. Do not remove it until MetaApi renews their cert.
