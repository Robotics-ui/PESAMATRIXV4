# PESAMATRIX V2

Cloud-to-cloud copy trading SaaS platform powered by MetaApi CopyFactory, with M-Pesa STK Push subscriptions (trading-days-only countdown).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/pesamatrix run dev` — run the React frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `SESSION_SECRET` — JWT signing secret (already set)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (at `/`)
- API: Express 5 (at `/api`)
- DB: PostgreSQL + Drizzle ORM
- Auth: JWT (bcryptjs + jsonwebtoken, 30-day tokens)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Scheduler: node-cron (subscription expiry check every 30 min)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle ORM table definitions
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks
- `lib/api-zod/src/generated/api.ts` — generated Zod schemas
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/scheduler.ts` — auto-suspension cron job
- `artifacts/pesamatrix/src/pages/` — frontend pages
- `artifacts/pesamatrix/src/hooks/use-auth.tsx` — JWT auth context

## Architecture decisions

- **Demo mode**: If `METAAPI_TOKEN` is missing, MetaApi operations are local-only. If `MPESA_*` env vars are missing, payments are simulated immediately (demo/dev).
- **Trading-day countdown**: Subscription expiry uses calendar days but the UI shows trading days remaining (Mon–Fri). Auto-suspension scheduler runs every 30 min.
- **JWT auth**: Tokens stored in localStorage, injected via `setAuthTokenGetter` from `@workspace/api-client-react`.
- **Admin seed**: `admin@pesamatrix.com` / `Admin@2024!` seeded on first run. Demo trader: `trader@pesamatrix.com` / `Trader@2024!` with 5-day active subscription.
- **Scheduler**: `node-cron` runs every 30 min, expires subscriptions past their `endDate`, suspends all bindings for affected slave accounts.

## Product

- **Auth**: Register/Login with JWT tokens
- **Subscribe**: M-Pesa STK Push payment with trading-day-only countdown timer
- **Master Accounts**: Add MetaApi signal provider accounts
- **Slave Accounts**: Add follower accounts that copy from masters
- **Strategies**: Create CopyFactory strategies linking masters to copy logic
- **Bindings**: Bind slave accounts to strategies with lot multipliers
- **Trade Logs**: View full history of copied trades with P/L
- **Admin Panel**: Manage users, subscriptions, revenue stats, and pricing settings

## User preferences

- Blue (#2563eb) and green (#16a34a) color scheme, dark mode default
- No emojis in code or UI

## Gotchas

- Generated hook names from Orval use `useList*` for GET-all endpoints, not `useGet*`. E.g. `useListMasterAccounts` not `useGetMasterAccounts`.
- Query key functions follow `getList*QueryKey` or `getGet*QueryKey` pattern. Check `lib/api-client-react/src/generated/api.ts` for exact names.
- Do NOT run `pnpm dev` at workspace root. Use `restart_workflow` to start/stop services.
- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `lib/api-spec/openapi.yaml`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
