---
name: Orval hook naming
description: Naming conventions for Orval-generated React Query hooks and query key functions in this project
---

## Rule
Orval generates hook and query-key names directly from the OpenAPI `operationId`. Always grep `lib/api-client-react/src/generated/api.ts` for the exact names — never guess.

## Observed patterns
- GET-all list endpoints → `useList*` (e.g. `useListMasterAccounts`, `useListStrategies`, `useListBindings`, `useListTradeLogs`, `useListAdminUsers`)
- GET-single endpoints → `useGet*` (e.g. `useGetMasterAccount`, `useGetMySubscription`, `useGetDashboardSummary`, `useGetAdminStats`, `useGetAdminSettings`)
- Query key functions: `getList*QueryKey` for list hooks, `getGet*QueryKey` for single hooks (e.g. `getListMasterAccountsQueryKey`, `getGetAdminSettingsQueryKey`)

## Why
Using wrong hook names (e.g. `useGetMasterAccounts` instead of `useListMasterAccounts`) causes a runtime module-export error that is hard to trace without checking the generated file.

## How to apply
Before writing any hook import from `@workspace/api-client-react`, run:
```
grep -E "^export (function|const) use" lib/api-client-react/src/generated/api.ts
grep -E "^export const get.*QueryKey" lib/api-client-react/src/generated/api.ts
```
