# Tereka Financial Intelligence

Tereka helps people understand their money, make calmer decisions, and build toward meaningful financial goals.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/tereka/src/pages/finance.tsx` — authenticated product pages and finance CRUD flows
- `artifacts/tereka/src/components/layout.tsx` — shared shell, navigation, cards, forms, and modal primitives
- `artifacts/tereka/src/lib/finance.ts` — currency, date, and transaction presentation utilities
- `artifacts/api-server/src/services/finance-store.ts` — demo finance service and reusable calculation layer
- `artifacts/api-server/src/routes/finance.ts` — typed finance API routes
- `lib/api-spec/openapi.yaml` — source of truth for API contracts
- `lib/db/src/schema/finance.ts` — PostgreSQL/Drizzle schema for the future persisted implementation

## Architecture decisions

- API contracts are defined in OpenAPI first and generated into the shared client and Zod packages.
- Financial calculations live in the finance service layer instead of React components.
- The first usable build runs with a server-side demo store so the product can be explored without exposing credentials or pretending third-party money integrations exist.
- The database schema is prepared separately for authenticated, user-scoped persistence when the auth provider is connected.

## Product

The app includes a dashboard with cashflow and spending signals, transaction management, account tracking, budgets with warnings, savings goals, a controlled assistant surface, and profile/theme settings. Authentication screens are included as the next connection point for Supabase/Clerk-style auth.

## User preferences

None yet.

## Gotchas

- The Vite build expects `PORT` and `BASE_PATH`; the managed web workflow supplies both.
- After changing `lib/api-spec/openapi.yaml`, run the API codegen command before using new client hooks.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
