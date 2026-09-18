# Tereka Financial Intelligence

Tereka is a modern personal financial intelligence platform designed to help users understand their cashflow, manage transactions, track accounts, monitor category budgets, achieve savings goals, and interact with an AI financial assistant.

## Run & Operate

### Development Servers
- **Frontend App (Vite)**: `pnpm --filter @workspace/tereka run dev`
  - Runs on `http://127.0.0.1:5180` (or configured `PORT`)
  - Proxies `/api/*` calls automatically to backend at `http://127.0.0.1:5050`
- **Backend API (Express)**: `pnpm --filter @workspace/api-server run build && pnpm --filter @workspace/api-server run start`
  - Runs on `http://127.0.0.1:5050` (or configured `PORT`)
  - Health endpoint: `http://127.0.0.1:5050/api/healthz`

### Workspace Build & Validation
- `pnpm run typecheck` — full TypeScript typecheck across all workspace packages and libraries
- `pnpm run build` — typecheck and production build of all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate client React Query hooks and Zod schemas from `lib/api-spec/openapi.yaml`
- `pnpm --filter @workspace/db run push` — push Drizzle ORM schema to Postgres (dev)

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (e.g. `postgresql://user:password@localhost:5432/tereka`)
- `PORT` — Port override for server and frontend processes
- `BASE_PATH` — Base URL path (defaults to `/`)

## Stack

- **Monorepo**: pnpm workspaces, Node.js 24, TypeScript 5.9
- **Frontend**: React 19, Vite 7, Tailwind CSS v4, Radix UI Primitives, Lucide React, Recharts, Wouter, TanStack React Query
- **Backend API**: Express 5, Pino & Pino-HTTP logging, CORS, Zod validation
- **Database & Persistence**: PostgreSQL, Drizzle ORM, `drizzle-zod`
- **API Spec & Codegen**: OpenAPI 3.0 (`lib/api-spec`), Orval generator (`lib/api-client-react`, `lib/api-zod`)
- **Build System**: esbuild (backend bundle), Vite (frontend bundle)

## Where Things Live

```
.
├── artifacts/
│   ├── tereka/                      # React frontend application
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── finance.tsx      # Dashboard, Transactions, Accounts, Budgets, Goals, Assistant, Settings
│   │   │   │   ├── auth.tsx         # Login, Signup, Forgot Password screens
│   │   │   │   └── not-found.tsx    # 404 page
│   │   │   ├── components/          # Reusable UI & layout primitives
│   │   │   ├── lib/                 # Auth context, utilities, formatting
│   │   │   ├── App.tsx              # Application root, routing & query client
│   │   │   └── index.css            # Design system tokens and styles
│   │   └── vite.config.ts           # Vite configuration & API proxy setup
│   └── api-server/                  # Express backend API
│       ├── src/
│       │   ├── routes/              # Route handlers (finance, auth, health)
│       │   ├── services/            # Finance service logic & calculation engine
│       │   ├── middlewares/         # Auth and validation middlewares
│       │   ├── app.ts               # Express application configuration
│       │   └── index.ts             # Server entry point (port 5050)
│       └── build.mjs                # esbuild bundle script
├── lib/
│   ├── api-spec/                    # OpenAPI specification (`openapi.yaml`) & Orval config
│   ├── api-client-react/            # Generated React Query hooks & API client
│   ├── api-zod/                     # Generated Zod validation schemas
│   └── db/                          # Drizzle ORM schemas & database connection
└── package.json                     # Root workspace configuration
```

## Architecture Decisions

- **Contract-First API**: All API schemas and endpoints are defined in OpenAPI (`lib/api-spec/openapi.yaml`) and auto-generated into typed React Query hooks (`@workspace/api-client-react`) and Zod models (`@workspace/api-zod`).
- **Separation of Concerns**: Financial calculations (net worth, cashflow, budget warnings, goal projections) are centralized in the backend service layer.
- **Server Demo Store with Database Readiness**: Ships with an in-memory/demo store for rapid exploration and testing without credentials, with Drizzle database schemas ready for production PostgreSQL persistence.
- **Security & Validation**: Strict request/response validation with Zod schemas generated directly from the OpenAPI contract.

## Key Features

- **Financial Dashboard**: Overview of net worth, monthly income, expenses, cashflow metrics, spending breakdowns, and smart insights.
- **Transactions Management**: Track income/expense records with category tagging, account linkage, date filters, and search.
- **Account Tracking**: Monitor bank accounts, savings, credit cards, and investments with balance updates.
- **Budgets & Thresholds**: Set category-level monthly budgets with progress indicators and over-budget warnings.
- **Savings Goals**: Define targets, target dates, calculate remaining amounts, and log contributions.
- **AI Financial Assistant**: Integrated assistant interface to ask financial guidance questions and receive contextual answers.
- **User Settings & Theming**: Profile management and customizable display preferences (Light/Dark themes).

## Gotchas

- When modifying `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen` to update types and React Query hooks.
- In development, the frontend Vite server proxies `/api` requests to port `5050`. Ensure the backend API server is running alongside the frontend.

