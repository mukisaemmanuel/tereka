# Tereka Financial Intelligence

Tereka is a modern personal financial intelligence platform designed to help users understand their cashflow, manage transactions, track accounts, monitor category budgets, achieve savings goals, and interact with an AI financial assistant.

## Quick Start Guide: How to Run the System

Tereka consists of two servers running together:
1. **Backend API Server** (Express) on `http://localhost:5050`
2. **Frontend Web App** (Vite + React) on `http://localhost:5180`

---

### Step 1: Install Dependencies
Open your terminal in the root project directory and run:
```bash
pnpm install
```

---

### Step 2: Push Database Schema (PostgreSQL)
Ensure your `DATABASE_URL` environment variable is set (or configured in your `.env` file):
```bash
npx drizzle-kit push
```

---

### Step 3: Start the Backend API Server (Terminal 1)
Open a terminal and run:
```bash
# Build the backend bundle
pnpm --filter @workspace/api-server run build

# Start the API server
pnpm --filter @workspace/api-server run start
```
* **API URL**: `http://localhost:5050`
* **Health Check**: `http://localhost:5050/api/healthz` (should return `{"status":"ok"}`)

---

### Step 4: Start the Frontend App (Terminal 2)
Open a second terminal window and run:
```bash
pnpm --filter @workspace/tereka run dev
```
* **App URL**: `http://localhost:5180`
* The frontend automatically proxies all `/api/*` requests to `http://localhost:5050`.

---

### Step 5: Open in Your Browser
Visit [`http://localhost:5180`](http://localhost:5180) in your web browser.

---

## Workspace Commands

| Task | Command | Description |
| :--- | :--- | :--- |
| **Typecheck** | `pnpm run typecheck` | Run full TypeScript typecheck across all packages |
| **Full Build** | `pnpm run build` | Build all workspace libraries and artifacts |
| **Push DB** | `npx drizzle-kit push` | Push Drizzle schema directly to PostgreSQL |
| **Regen API** | `pnpm --filter @workspace/api-spec run codegen` | Regenerate React Query hooks & Zod schemas from OpenAPI |

---

## Environment Variables

| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://postgres:password@localhost:5432/tereka` | PostgreSQL connection string |
| `PORT` | `5050` (backend) / `5180` (frontend) | Port overrides |
| `NODE_ENV` | `development` / `production` | Environment mode |

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

