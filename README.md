# Tereka — Financial Intelligence Platform

Tereka is a personal financial intelligence platform built for tracking income, expenses, accounts, category budgets, savings goals, debts, and cashflow in Ugandan Shillings (UGX), powered by an AI financial assistant.

---

## 🚀 How to Run the System

Tereka runs with two active services:
1. **Backend API Server** (Express) on `http://localhost:5050`
2. **Frontend Web App** (Vite + React) on `http://localhost:5180`

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Push Database Schema (PostgreSQL)
Ensure your `DATABASE_URL` is set in your environment:
```bash
npx drizzle-kit push
```

### 3. Start Backend API Server (Terminal 1)
```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```
* API runs at `http://localhost:5050`
* Health Check: `http://localhost:5050/api/healthz`

### 4. Start Frontend Web App (Terminal 2)
```bash
pnpm --filter @workspace/tereka run dev
```
* App runs at `http://localhost:5180`
* Automatically proxies `/api/*` requests to the backend server.

---

## 🛠️ Workspace Commands

- `pnpm run typecheck` — Run TypeScript type checking across all workspace packages
- `pnpm run build` — Build all workspace libraries and applications
- `npx drizzle-kit push` — Push Drizzle ORM schema to Postgres
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate React Query hooks & Zod schemas from `lib/api-spec/openapi.yaml`

---

## 🏗️ Tech Stack

- **Frontend**: React 19, Vite 7, Tailwind CSS, Radix UI Primitives, Lucide Icons, Recharts, Wouter, TanStack React Query
- **Backend**: Node.js, Express 5, Pino logging, Zod validation
- **Database**: PostgreSQL with Drizzle ORM
- **API Spec**: OpenAPI 3.0 with Orval client code generation

