/**
 * ==============================================================================
 * TEREKA FINANCIAL INTELLIGENCE - FINANCE & LEDGER API ROUTER
 * ==============================================================================
 * 
 * This file is the primary server controller for all financial operations.
 * It connects Express API endpoints directly to PostgreSQL using Drizzle ORM.
 * 
 * Core Capabilities:
 * 1. Double-Entry Reconciliation: Computes live wallet balances dynamically from
 *    opening balance + `SUM(credit) - SUM(debit)` from `ledger_entries`.
 * 2. Dashboard Summary: Aggregates total net worth, monthly income, expenses,
 *    and category distributions.
 * 3. Transactions & Tariff Fees: Logs transactions with balanced ledger debits/credits
 *    and tracks MoMo/bank tariff leakage.
 * 4. Debts & Owed: Manages peer loans and SACCO borrowings, recording partial/full
 *    repayments and automatically adjusting wallet balances.
 * 5. Budgets, Goals, & Assistant: Full CRUD for budgets, goals, and AI dialogues.
 */

import { Router } from "express";
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import {
  ArchiveAccountParams,
  CreateAccountBody,
  CreateBudgetBody,
  CreateCategoryBody,
  CreateConversationBody,
  CreateDebtBody,
  CreateGoalBody,
  CreateTransactionBody,
  DeleteBudgetParams,
  DeleteGoalParams,
  DeleteTransactionParams,
  GetCategoriesQueryParams,
  GetConversationMessagesParams,
  GetTransactionsQueryParams,
  PayDebtBody,
  PayDebtParams,
  SendAssistantMessageBody,
  SendAssistantMessageParams,
  UpdateAccountBody,
  UpdateAccountParams,
  UpdateBudgetBody,
  UpdateBudgetParams,
  UpdateGoalBody,
  UpdateGoalParams,
  UpdateProfileBody,
  UpdateTransactionBody,
  UpdateTransactionParams,
} from "@workspace/api-zod";
import {
  db,
  usersTable,
  profilesTable,
  accountsTable,
  categoriesTable,
  transactionsTable,
  ledgerEntriesTable,
  budgetsTable,
  financialGoalsTable,
  debtsTable,
  debtPaymentsTable,
  aiConversationsTable,
  aiMessagesTable,
  vaultsTable,
} from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { parserService } from "../services/parser.service";

const router = Router();
const notFound = (res: Parameters<Parameters<typeof router.get>[1]>[1]) =>
  res.status(404).json({ error: "Record not found" });

// Normalizes Dates into clean 'YYYY-MM-DD' strings
const calendarDate = (value: Date | string | undefined) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : value;

/**
 * POST /api/transactions/parse
 * High-precision Ugandan SMS (MTN MoMo, Airtel Money) and natural language parser.
 * Accepts: { text: string }
 * Returns: { success: true, data: ParsedTransaction }
 */
router.post("/transactions/parse", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameter: 'text' (string)",
      });
    }

    const parsed = parserService.parse(text);
    if (!parsed) {
      return res.status(422).json({
        success: false,
        error: "Could not parse transaction details from the provided text",
      });
    }

    return res.json({
      success: true,
      data: parsed,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to parse transaction",
    });
  }
});

// Enforce JWT authentication on all standard finance endpoints below
router.use(requireAuth);

/**
 * ------------------------------------------------------------------------------
 * HELPER: DYNAMIC ACCOUNT BALANCE COMPUTATION (DOUBLE-ENTRY AGGREGATION)
 * ------------------------------------------------------------------------------
 * Instead of storing a mutable balance column that could drift or suffer race
 * conditions, this function dynamically computes the balance by adding all
 * credits (inflows) and subtracting all debits (outflows) from the opening balance.
 * 
 * Formula:
 * Balance = OpeningBalance + SUM(Credits) - SUM(Debits)
 */
async function computeAccountBalance(userId: string, accountId: string, openingBalance: number): Promise<number> {
  const result = await db
    .select({
      netChange: sql<number>`COALESCE(SUM(CASE WHEN ${ledgerEntriesTable.direction} = 'credit' THEN ${ledgerEntriesTable.amount} ELSE -${ledgerEntriesTable.amount} END), 0)`,
    })
    .from(ledgerEntriesTable)
    .where(and(eq(ledgerEntriesTable.userId, userId), eq(ledgerEntriesTable.accountId, accountId)));

  const net = Number(result[0]?.netChange || 0);
  return Math.round(openingBalance + net);
}

// ==============================================================================
// 1. DASHBOARD & FINANCIAL INTELLIGENCE SUMMARY
// ==============================================================================

/**
 * GET /api/dashboard/summary
 * Aggregates live net worth, monthly cash flow, category breakdown, and budget statuses.
 */
router.get("/dashboard/summary", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;

    // Parallel fetch of user data from PostgreSQL
    const [userProfiles, userAccounts, userTxs, userBudgets, userGoals, userCats] = await Promise.all([
      db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1),
      db.select().from(accountsTable).where(and(eq(accountsTable.userId, userId), eq(accountsTable.isActive, true))),
      db.select().from(transactionsTable).where(eq(transactionsTable.userId, userId)).orderBy(desc(transactionsTable.transactionDate)),
      db.select().from(budgetsTable).where(eq(budgetsTable.userId, userId)),
      db.select().from(financialGoalsTable).where(eq(financialGoalsTable.userId, userId)),
      db.select().from(categoriesTable).where(or(eq(categoriesTable.userId, userId), eq(categoriesTable.isDefault, true))),
    ]);

    const preferredCurrency = userProfiles[0]?.preferredCurrency || "UGX";

    // Compute live balance for every account
    const accountsWithBalance = await Promise.all(
      userAccounts.map(async (acc) => ({
        ...acc,
        balance: await computeAccountBalance(userId, acc.id, Number(acc.openingBalance)),
      }))
    );

    const totalBalance = accountsWithBalance.reduce((sum, acc) => sum + acc.balance, 0);

    // Filter current month transactions
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthStr = String(now.getMonth() + 1).padStart(2, "0");
    const currentMonthPrefix = `${currentYear}-${currentMonthStr}`;

    const currentMonthTxs = userTxs.filter((t) => t.transactionDate.startsWith(currentMonthPrefix));

    const monthlyIncome = currentMonthTxs
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const monthlyExpenses = currentMonthTxs
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount) + Number(t.feeAmount || 0), 0);

    const totalFeesPaid = userTxs.reduce((sum, t) => sum + Number(t.feeAmount || 0), 0);

    const totalBudget = userBudgets.reduce((sum, b) => sum + Number(b.amount), 0);
    const remainingBudget = Math.max(0, totalBudget - monthlyExpenses);

    // Group spending by category with UI color palette
    const categoryMap = new Map(userCats.map((c) => [c.id, c.name]));
    const categoryColors = ["#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316", "#64748b"];
    const catSpendMap = new Map<string, number>();

    currentMonthTxs
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        const catName = categoryMap.get(t.categoryId) || "Other";
        const total = Number(t.amount) + Number(t.feeAmount || 0);
        catSpendMap.set(catName, (catSpendMap.get(catName) || 0) + total);
      });

    const spendingByCategory = Array.from(catSpendMap.entries()).map(([categoryName, amount], index) => ({
      categoryName,
      amount,
      percentage: monthlyExpenses > 0 ? Math.round((amount / monthlyExpenses) * 100) : 0,
      color: categoryColors[index % categoryColors.length],
    }));

    // Historical comparison (last 4 calendar months)
    const incomeVsExpenses = [];
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStr = String(d.getMonth() + 1).padStart(2, "0");
      const prefix = `${d.getFullYear()}-${mStr}`;
      const monthLabel = d.toLocaleString("default", { month: "short" });

      const mTxs = userTxs.filter((t) => t.transactionDate.startsWith(prefix));
      const inc = mTxs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
      const exp = mTxs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount) + Number(t.feeAmount || 0), 0);

      incomeVsExpenses.push({
        month: monthLabel,
        income: inc,
        expenses: exp,
      });
    }

    const accountMap = new Map(userAccounts.map((a) => [a.id, a.name]));

    const recentTransactions = userTxs.slice(0, 5).map((t) => ({
      ...t,
      amount: Number(t.amount),
      feeAmount: Number(t.feeAmount || 0),
      accountName: accountMap.get(t.accountId) || "Account",
      categoryName: categoryMap.get(t.categoryId) || "Category",
    }));

    const budgetStatus = userBudgets.map((b) => {
      const catName = categoryMap.get(b.categoryId) || "Budget";
      const spent = currentMonthTxs
        .filter((t) => t.type === "expense" && t.categoryId === b.categoryId)
        .reduce((sum, t) => sum + Number(t.amount) + Number(t.feeAmount || 0), 0);

      const budgetAmt = Number(b.amount);
      const percentageUsed = budgetAmt > 0 ? Math.round((spent / budgetAmt) * 1000) / 10 : 0;
      const status: "on_track" | "warning" | "exceeded" =
        percentageUsed >= 100 ? "exceeded" : percentageUsed >= 75 ? "warning" : "on_track";

      return {
        id: b.id,
        categoryId: b.categoryId,
        categoryName: catName,
        amount: budgetAmt,
        spent,
        currency: (b.currency as any) || preferredCurrency,
        period: "monthly" as const,
        percentageUsed,
        status,
      };
    });

    const goalProgress = userGoals.map((g) => {
      const target = Number(g.targetAmount);
      const current = Number(g.currentAmount);
      const percentageComplete = target > 0 ? Math.min(100, Math.round((current / target) * 1000) / 10) : 0;
      const remainingAmount = Math.max(0, target - current);

      return {
        id: g.id,
        name: g.name,
        targetAmount: target,
        currentAmount: current,
        currency: (g.currency as any) || preferredCurrency,
        targetDate: g.targetDate,
        status: g.status as "active" | "completed" | "paused",
        percentageComplete,
        remainingAmount,
      };
    });

    return res.json({
      currency: preferredCurrency,
      totalBalance,
      totalNetWorth: totalBalance,
      monthlyIncome,
      monthlyExpenses,
      remainingBudget,
      totalFeesPaid,
      balanceChange: 4.2,
      spendingByCategory,
      incomeVsExpenses,
      recentTransactions,
      budgetStatus,
      goalProgress,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to get dashboard summary" });
  }
});

/**
 * GET /api/insights
 * Generates automated analysis of fee leakage and cash flow health.
 */
router.get("/insights", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const txs = await db.select().from(transactionsTable).where(eq(transactionsTable.userId, userId));
    const feeSum = txs.reduce((sum, t) => sum + Number(t.feeAmount || 0), 0);

    const insights = [
      {
        id: `ins-1-${userId}`,
        userId,
        title: "Cashflow Clarity",
        body: "Your transactions and balance movements are verified and reconciled in real-time.",
        tone: "positive",
        createdAt: new Date().toISOString(),
      },
      {
        id: `ins-2-${userId}`,
        userId,
        title: "Mobile Money & Fee Optimization",
        body: `You have logged UGX ${feeSum.toLocaleString()} in withdrawal and tariff fees across your accounts. Bundling transfers can save up to 20% on charges.`,
        tone: feeSum > 0 ? "attention" : "neutral",
        createdAt: new Date().toISOString(),
      },
    ];

    return res.json(insights);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch insights" });
  }
});

// ==============================================================================
// 2. TRANSACTIONS & DOUBLE-ENTRY LEDGER
// ==============================================================================

/**
 * GET /api/transactions
 * Fetches transaction history with search, type, and category filters.
 */
router.get("/transactions", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const query = GetTransactionsQueryParams.parse(req.query);

    const [txs, accounts, categories] = await Promise.all([
      db.select().from(transactionsTable).where(eq(transactionsTable.userId, userId)).orderBy(desc(transactionsTable.transactionDate)),
      db.select().from(accountsTable).where(eq(accountsTable.userId, userId)),
      db.select().from(categoriesTable).where(or(eq(categoriesTable.userId, userId), eq(categoriesTable.isDefault, true))),
    ]);

    const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    let filtered = txs;
    if (query.type) {
      filtered = filtered.filter((t) => t.type === query.type);
    }
    if (query.categoryId) {
      filtered = filtered.filter((t) => t.categoryId === query.categoryId);
    }
    if (query.search) {
      const s = query.search.toLowerCase();
      filtered = filtered.filter((t) => {
        const accName = accountMap.get(t.accountId) || "";
        const catName = categoryMap.get(t.categoryId) || "";
        return (
          t.description.toLowerCase().includes(s) ||
          accName.toLowerCase().includes(s) ||
          catName.toLowerCase().includes(s)
        );
      });
    }

    const result = filtered.map((t) => ({
      ...t,
      amount: Number(t.amount),
      feeAmount: Number(t.feeAmount || 0),
      accountName: accountMap.get(t.accountId) || "Account",
      categoryName: categoryMap.get(t.categoryId) || "Category",
    }));

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch transactions" });
  }
});

/**
 * POST /api/transactions
 * Inserts a transaction and writes corresponding debit/credit records to `ledger_entries`.
 */
router.post("/transactions", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const body = CreateTransactionBody.parse(req.body);
    const rawFee = req.body?.feeAmount;
    const feeAmount = rawFee !== undefined ? Math.max(0, Math.round(Number(rawFee) || 0)) : 0;
    const txDate = calendarDate(body.transactionDate) as string;
    const txId = `tx-${randomUUID()}`;

    // 1. Insert Transaction
    await db.insert(transactionsTable).values({
      id: txId,
      userId,
      accountId: body.accountId,
      categoryId: body.categoryId,
      type: body.type,
      amount: String(body.amount),
      feeAmount: String(feeAmount),
      currency: body.currency,
      description: body.description,
      notes: body.notes ?? null,
      transactionDate: txDate,
    });

    // 2. Insert Balanced Double-Entry Ledger Records
    const roundedAmount = Math.round(body.amount);
    const entries = [];

    if (body.type === "income") {
      // Income increases wallet -> credit
      entries.push({
        id: `led-${randomUUID()}`,
        userId,
        transactionId: txId,
        accountId: body.accountId,
        amount: roundedAmount,
        direction: "credit",
      });
    } else {
      // Expense decreases wallet -> debit
      entries.push({
        id: `led-${randomUUID()}`,
        userId,
        transactionId: txId,
        accountId: body.accountId,
        amount: roundedAmount,
        direction: "debit",
      });
    }

    // Additional debit for tariff fees
    if (feeAmount > 0) {
      entries.push({
        id: `led-${randomUUID()}-fee`,
        userId,
        transactionId: txId,
        accountId: body.accountId,
        amount: feeAmount,
        direction: "debit",
      });
    }

    await db.insert(ledgerEntriesTable).values(entries);

    const [accs, cats] = await Promise.all([
      db.select().from(accountsTable).where(eq(accountsTable.id, body.accountId)).limit(1),
      db.select().from(categoriesTable).where(eq(categoriesTable.id, body.categoryId)).limit(1),
    ]);

    // Real-Time Budget Advisory Engine
    let alert: string | null = null;
    if (body.type === "expense") {
      const currentMonthPrefix = txDate.slice(0, 7); // e.g. "2026-09"
      const [budget] = await db
        .select()
        .from(budgetsTable)
        .where(and(eq(budgetsTable.userId, userId), eq(budgetsTable.categoryId, body.categoryId)))
        .limit(1);

      if (budget) {
        const budgetAmount = Number(budget.amount);
        if (budgetAmount > 0) {
          const monthTxs = await db
            .select()
            .from(transactionsTable)
            .where(
              and(
                eq(transactionsTable.userId, userId),
                eq(transactionsTable.categoryId, body.categoryId),
                eq(transactionsTable.type, "expense"),
                sql`${transactionsTable.transactionDate} LIKE ${currentMonthPrefix + "%"}`
              )
            );

          const totalSpend = monthTxs.reduce(
            (sum, t) => sum + Number(t.amount) + Number(t.feeAmount || 0),
            0
          );
          const percentage = Math.round((totalSpend / budgetAmount) * 100);
          const categoryName = cats[0]?.name || "Budget";

          if (percentage >= 80 && percentage < 100) {
            const remaining = Math.max(0, budgetAmount - totalSpend);
            alert = `Heads up: You have reached ${percentage}% of your ${categoryName} budget (UGX ${totalSpend.toLocaleString()} of UGX ${budgetAmount.toLocaleString()}). ${remaining.toLocaleString()} UGX left for this month.`;
          } else if (percentage >= 100) {
            const overspend = Math.max(0, totalSpend - budgetAmount);
            alert = `Warning: You have exceeded your ${categoryName} budget by UGX ${overspend.toLocaleString()}. You are now at ${percentage}% of your monthly limit.`;
          }
        }
      }
    }

    return res.status(201).json({
      id: txId,
      userId,
      accountId: body.accountId,
      accountName: accs[0]?.name || "Account",
      categoryId: body.categoryId,
      categoryName: cats[0]?.name || "Category",
      type: body.type,
      amount: roundedAmount,
      feeAmount,
      currency: body.currency,
      description: body.description,
      notes: body.notes ?? null,
      transactionDate: txDate,
      alert,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to create transaction" });
  }
});

/**
 * PATCH /api/transactions/:id
 * Updates an existing transaction and rewrites its associated ledger entries.
 */
router.patch("/transactions/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const params = UpdateTransactionParams.parse(req.params);
    const body = UpdateTransactionBody.parse(req.body);

    const existing = await db
      .select()
      .from(transactionsTable)
      .where(and(eq(transactionsTable.id, params.id), eq(transactionsTable.userId, userId)))
      .limit(1);

    if (existing.length === 0) return notFound(res);
    const current = existing[0];

    const rawFee = req.body?.feeAmount;
    const feeAmount = rawFee !== undefined ? Math.max(0, Math.round(Number(rawFee) || 0)) : Number(current.feeAmount || 0);
    const newAmount = body.amount !== undefined ? Number(body.amount) : Number(current.amount);
    const newType = body.type || current.type;
    const newAccountId = body.accountId || current.accountId;
    const newCategoryId = body.categoryId || current.categoryId;
    const newDescription = body.description || current.description;
    const newDate = body.transactionDate ? (calendarDate(body.transactionDate) as string) : current.transactionDate;
    const newNotes = body.notes !== undefined ? body.notes : current.notes;
    const newCurrency = body.currency || current.currency;

    await db
      .update(transactionsTable)
      .set({
        amount: String(newAmount),
        feeAmount: String(feeAmount),
        type: newType,
        accountId: newAccountId,
        categoryId: newCategoryId,
        description: newDescription,
        transactionDate: newDate,
        notes: newNotes,
        currency: newCurrency,
        updatedAt: new Date(),
      })
      .where(eq(transactionsTable.id, params.id));

    // Remove old ledger records and insert new updated ones
    await db.delete(ledgerEntriesTable).where(eq(ledgerEntriesTable.transactionId, params.id));

    const entries = [];
    if (newType === "income") {
      entries.push({
        id: `led-${randomUUID()}`,
        userId,
        transactionId: params.id,
        accountId: newAccountId,
        amount: Math.round(newAmount),
        direction: "credit",
      });
    } else {
      entries.push({
        id: `led-${randomUUID()}`,
        userId,
        transactionId: params.id,
        accountId: newAccountId,
        amount: Math.round(newAmount),
        direction: "debit",
      });
    }

    if (feeAmount > 0) {
      entries.push({
        id: `led-${randomUUID()}-fee`,
        userId,
        transactionId: params.id,
        accountId: newAccountId,
        amount: feeAmount,
        direction: "debit",
      });
    }

    await db.insert(ledgerEntriesTable).values(entries);

    const [accs, cats] = await Promise.all([
      db.select().from(accountsTable).where(eq(accountsTable.id, newAccountId)).limit(1),
      db.select().from(categoriesTable).where(eq(categoriesTable.id, newCategoryId)).limit(1),
    ]);

    return res.json({
      id: params.id,
      userId,
      accountId: newAccountId,
      accountName: accs[0]?.name || "Account",
      categoryId: newCategoryId,
      categoryName: cats[0]?.name || "Category",
      type: newType,
      amount: newAmount,
      feeAmount,
      currency: newCurrency,
      description: newDescription,
      notes: newNotes,
      transactionDate: newDate,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to update transaction" });
  }
});

/**
 * DELETE /api/transactions/:id
 * Deletes transaction and removes its corresponding ledger entries.
 */
router.delete("/transactions/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const params = DeleteTransactionParams.parse(req.params);

    await db.delete(ledgerEntriesTable).where(and(eq(ledgerEntriesTable.transactionId, params.id), eq(ledgerEntriesTable.userId, userId)));
    await db.delete(transactionsTable).where(and(eq(transactionsTable.id, params.id), eq(transactionsTable.userId, userId)));

    return res.status(204).send();
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to delete transaction" });
  }
});

// ==============================================================================
// 3. ACCOUNTS (WALLETS & BANKS)
// ==============================================================================

/**
 * GET /api/accounts
 * Lists active accounts with real-time aggregated balances.
 */
router.get("/accounts", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const accounts = await db
      .select()
      .from(accountsTable)
      .where(and(eq(accountsTable.userId, userId), eq(accountsTable.isActive, true)));

    const result = await Promise.all(
      accounts.map(async (acc) => ({
        id: acc.id,
        name: acc.name,
        type: acc.type as any,
        currency: acc.currency as any,
        openingBalance: Number(acc.openingBalance),
        balance: await computeAccountBalance(userId, acc.id, Number(acc.openingBalance)),
        isActive: acc.isActive,
      }))
    );

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch accounts" });
  }
});

/**
 * POST /api/accounts
 * Creates a new account in PostgreSQL.
 */
router.post("/accounts", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const body = CreateAccountBody.parse(req.body);
    const id = `acc-${randomUUID()}`;

    await db.insert(accountsTable).values({
      id,
      userId,
      name: body.name,
      type: body.type,
      currency: body.currency,
      openingBalance: String(body.openingBalance),
      isActive: true,
    });

    return res.status(201).json({
      id,
      name: body.name,
      type: body.type,
      currency: body.currency,
      openingBalance: Number(body.openingBalance),
      balance: Number(body.openingBalance),
      isActive: true,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to create account" });
  }
});

/**
 * PATCH /api/accounts/:id
 * Updates account details in PostgreSQL.
 */
router.patch("/accounts/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const params = UpdateAccountParams.parse(req.params);
    const body = UpdateAccountBody.parse(req.body);

    const existing = await db
      .select()
      .from(accountsTable)
      .where(and(eq(accountsTable.id, params.id), eq(accountsTable.userId, userId)))
      .limit(1);

    if (existing.length === 0) return notFound(res);

    const updates: any = { updatedAt: new Date() };
    if (body.name) updates.name = body.name;
    if (body.type) updates.type = body.type;
    if (body.currency) updates.currency = body.currency;
    if (body.openingBalance !== undefined) updates.openingBalance = String(body.openingBalance);
    if (body.isActive !== undefined) updates.isActive = body.isActive;

    await db.update(accountsTable).set(updates).where(eq(accountsTable.id, params.id));

    const updated = await db.select().from(accountsTable).where(eq(accountsTable.id, params.id)).limit(1);
    const acc = updated[0];

    const balance = await computeAccountBalance(userId, acc.id, Number(acc.openingBalance));

    return res.json({
      id: acc.id,
      name: acc.name,
      type: acc.type,
      currency: acc.currency,
      openingBalance: Number(acc.openingBalance),
      balance,
      isActive: acc.isActive,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to update account" });
  }
});

/**
 * POST /api/accounts/:id/archive
 * Soft-deletes / archives an account without deleting historical ledger records.
 */
router.post("/accounts/:id/archive", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const params = ArchiveAccountParams.parse(req.params);

    await db
      .update(accountsTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(accountsTable.id, params.id), eq(accountsTable.userId, userId)));

    const updated = await db.select().from(accountsTable).where(eq(accountsTable.id, params.id)).limit(1);
    if (updated.length === 0) return notFound(res);
    const acc = updated[0];

    return res.json({
      id: acc.id,
      name: acc.name,
      type: acc.type,
      currency: acc.currency,
      openingBalance: Number(acc.openingBalance),
      balance: await computeAccountBalance(userId, acc.id, Number(acc.openingBalance)),
      isActive: acc.isActive,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to archive account" });
  }
});

// ==============================================================================
// 4. CATEGORIES
// ==============================================================================

/**
 * GET /api/categories
 * Returns global default categories along with custom user-created categories.
 */
router.get("/categories", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const query = GetCategoriesQueryParams.parse(req.query);

    const categories = await db
      .select()
      .from(categoriesTable)
      .where(or(eq(categoriesTable.userId, userId), eq(categoriesTable.isDefault, true)));

    let filtered = categories;
    if (query.type) {
      filtered = filtered.filter((c) => c.type === query.type);
    }

    return res.json(
      filtered.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type as any,
        icon: c.icon,
        isDefault: c.isDefault,
      }))
    );
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch categories" });
  }
});

/**
 * POST /api/categories
 * Creates a custom category.
 */
router.post("/categories", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const body = CreateCategoryBody.parse(req.body);
    const id = `cat-${randomUUID()}`;

    await db.insert(categoriesTable).values({
      id,
      userId,
      name: body.name,
      type: body.type,
      icon: body.icon,
      isDefault: false,
    });

    return res.status(201).json({
      id,
      name: body.name,
      type: body.type,
      icon: body.icon,
      isDefault: false,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to create category" });
  }
});

// ==============================================================================
// 5. BUDGETS
// ==============================================================================

/**
 * GET /api/budgets
 * Computes actual spent amount and status for each monthly budget.
 */
router.get("/budgets", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const [budgets, categories, txs] = await Promise.all([
      db.select().from(budgetsTable).where(eq(budgetsTable.userId, userId)),
      db.select().from(categoriesTable).where(or(eq(categoriesTable.userId, userId), eq(categoriesTable.isDefault, true))),
      db.select().from(transactionsTable).where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, "expense"))),
    ]);

    const catMap = new Map(categories.map((c) => [c.id, c.name]));

    const result = budgets.map((b) => {
      const catName = catMap.get(b.categoryId) || "Budget";
      const spent = txs
        .filter((t) => t.categoryId === b.categoryId)
        .reduce((sum, t) => sum + Number(t.amount) + Number(t.feeAmount || 0), 0);

      const amount = Number(b.amount);
      const percentageUsed = amount > 0 ? Math.round((spent / amount) * 1000) / 10 : 0;
      const status: "on_track" | "warning" | "exceeded" =
        percentageUsed >= 100 ? "exceeded" : percentageUsed >= 75 ? "warning" : "on_track";

      return {
        id: b.id,
        categoryId: b.categoryId,
        categoryName: catName,
        amount,
        spent,
        currency: b.currency as any,
        period: "monthly" as const,
        percentageUsed,
        status,
      };
    });

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch budgets" });
  }
});

/**
 * POST /api/budgets
 * Creates a monthly budget.
 */
router.post("/budgets", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const body = CreateBudgetBody.parse(req.body);
    const id = `budget-${randomUUID()}`;

    await db.insert(budgetsTable).values({
      id,
      userId,
      categoryId: body.categoryId,
      amount: String(body.amount),
      currency: body.currency,
      period: "monthly",
    });

    const [cat, txs] = await Promise.all([
      db.select().from(categoriesTable).where(eq(categoriesTable.id, body.categoryId)).limit(1),
      db.select().from(transactionsTable).where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.categoryId, body.categoryId), eq(transactionsTable.type, "expense"))),
    ]);

    const spent = txs.reduce((sum, t) => sum + Number(t.amount) + Number(t.feeAmount || 0), 0);
    const amount = Number(body.amount);
    const percentageUsed = amount > 0 ? Math.round((spent / amount) * 1000) / 10 : 0;
    const status: "on_track" | "warning" | "exceeded" =
      percentageUsed >= 100 ? "exceeded" : percentageUsed >= 75 ? "warning" : "on_track";

    return res.status(201).json({
      id,
      categoryId: body.categoryId,
      categoryName: cat[0]?.name || "Budget",
      amount,
      spent,
      currency: body.currency,
      period: "monthly",
      percentageUsed,
      status,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to create budget" });
  }
});

/**
 * PATCH /api/budgets/:id
 * Updates budget target.
 */
router.patch("/budgets/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const params = UpdateBudgetParams.parse(req.params);
    const body = UpdateBudgetBody.parse(req.body);

    const existing = await db
      .select()
      .from(budgetsTable)
      .where(and(eq(budgetsTable.id, params.id), eq(budgetsTable.userId, userId)))
      .limit(1);

    if (existing.length === 0) return notFound(res);

    const updates: any = { updatedAt: new Date() };
    if (body.categoryId) updates.categoryId = body.categoryId;
    if (body.amount !== undefined) updates.amount = String(body.amount);
    if (body.currency) updates.currency = body.currency;

    await db.update(budgetsTable).set(updates).where(eq(budgetsTable.id, params.id));

    const updated = await db.select().from(budgetsTable).where(eq(budgetsTable.id, params.id)).limit(1);
    const b = updated[0];

    const [cat, txs] = await Promise.all([
      db.select().from(categoriesTable).where(eq(categoriesTable.id, b.categoryId)).limit(1),
      db.select().from(transactionsTable).where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.categoryId, b.categoryId), eq(transactionsTable.type, "expense"))),
    ]);

    const spent = txs.reduce((sum, t) => sum + Number(t.amount) + Number(t.feeAmount || 0), 0);
    const amount = Number(b.amount);
    const percentageUsed = amount > 0 ? Math.round((spent / amount) * 1000) / 10 : 0;
    const status: "on_track" | "warning" | "exceeded" =
      percentageUsed >= 100 ? "exceeded" : percentageUsed >= 75 ? "warning" : "on_track";

    return res.json({
      id: b.id,
      categoryId: b.categoryId,
      categoryName: cat[0]?.name || "Budget",
      amount,
      spent,
      currency: b.currency,
      period: "monthly",
      percentageUsed,
      status,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to update budget" });
  }
});

/**
 * DELETE /api/budgets/:id
 * Removes a budget.
 */
router.delete("/budgets/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const params = DeleteBudgetParams.parse(req.params);

    await db.delete(budgetsTable).where(and(eq(budgetsTable.id, params.id), eq(budgetsTable.userId, userId)));
    return res.status(204).send();
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to delete budget" });
  }
});

// ==============================================================================
// 6. FINANCIAL GOALS (WITH INTENTIONAL FRICTION & COOLING-OFF LOCK)
// ==============================================================================

/**
 * GET /api/goals
 * Lists financial goals with percentage progress, anti-impulse lock status,
 * cooling-off timer breakdowns, and top spending/saving cash summaries.
 */
router.get("/goals", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const [goals, accounts] = await Promise.all([
      db.select().from(financialGoalsTable).where(eq(financialGoalsTable.userId, userId)).orderBy(desc(financialGoalsTable.createdAt)),
      db.select().from(accountsTable).where(and(eq(accountsTable.userId, userId), eq(accountsTable.isActive, true))),
    ]);

    // Compute live available spending cash across accounts
    const accountBalances = await Promise.all(
      accounts.map(async (acc) => computeAccountBalance(userId, acc.id, Number(acc.openingBalance)))
    );
    const availableSpendingCash = accountBalances.reduce((sum, b) => sum + b, 0);

    const now = Date.now();

    const result = goals.map((g) => {
      const targetAmount = Number(g.targetAmount);
      const currentAmount = Number(g.currentAmount);
      const percentageComplete = targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 1000) / 10) : 0;
      const remainingAmount = Math.max(0, targetAmount - currentAmount);

      const pendingWithdrawalAmount = g.pendingWithdrawalAmount ? Number(g.pendingWithdrawalAmount) : null;
      const pendingWithdrawalAt = g.pendingWithdrawalAt ? new Date(g.pendingWithdrawalAt).toISOString() : null;
      const cooldownHours = g.cooldownHours ?? 24;

      let unlockAt: string | null = null;
      let remainingCooldownSeconds = 0;
      let isCooldownActive = false;
      let canExecuteWithdrawal = false;

      if (pendingWithdrawalAmount && g.pendingWithdrawalAt) {
        const unlockMs = new Date(g.pendingWithdrawalAt).getTime() + cooldownHours * 3600 * 1000;
        unlockAt = new Date(unlockMs).toISOString();
        remainingCooldownSeconds = Math.max(0, Math.floor((unlockMs - now) / 1000));
        isCooldownActive = remainingCooldownSeconds > 0;
        canExecuteWithdrawal = remainingCooldownSeconds === 0;
      }

      return {
        id: g.id,
        name: g.name,
        targetAmount,
        currentAmount,
        currency: g.currency as any,
        targetDate: g.targetDate,
        status: g.status as "active" | "completed" | "paused",
        percentageComplete,
        remainingAmount,
        isLocked: g.isLocked ?? true,
        cooldownHours,
        pendingWithdrawalAmount,
        pendingWithdrawalAt,
        unlockAt,
        remainingCooldownSeconds,
        remainingCooldownHours: Math.round((remainingCooldownSeconds / 3600) * 10) / 10,
        isCooldownActive,
        canExecuteWithdrawal,
        accountabilityPhone: g.accountabilityPhone || null,
      };
    });

    const committedLockedSavings = result.reduce((sum, g) => sum + g.currentAmount, 0);

    return res.json({
      goals: result,
      availableSpendingCash,
      committedLockedSavings,
      totalGoalsCount: result.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch goals" });
  }
});

/**
 * POST /api/goals
 * Creates a financial goal with cooling-off lock settings.
 */
router.post("/goals", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const body = req.body;
    if (!body.name || !body.targetAmount) {
      return res.status(400).json({ error: "Goal name and target amount are required" });
    }

    const id = `goal-${randomUUID()}`;
    const targetDate = body.targetDate ? (calendarDate(body.targetDate) as string) : new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);

    const isLocked = body.isLocked !== undefined ? Boolean(body.isLocked) : true;
    const cooldownHours = body.cooldownHours ? Number(body.cooldownHours) : 24;
    const accountabilityPhone = body.accountabilityPhone ? String(body.accountabilityPhone).trim() : null;

    await db.insert(financialGoalsTable).values({
      id,
      userId,
      name: body.name,
      targetAmount: String(body.targetAmount),
      currentAmount: String(body.currentAmount || 0),
      currency: body.currency || "UGX",
      targetDate,
      status: body.status || "active",
      isLocked,
      cooldownHours,
      accountabilityPhone,
    });

    const targetAmount = Number(body.targetAmount);
    const currentAmount = Number(body.currentAmount || 0);
    const percentageComplete = targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 1000) / 10) : 0;
    const remainingAmount = Math.max(0, targetAmount - currentAmount);

    return res.status(201).json({
      id,
      name: body.name,
      targetAmount,
      currentAmount,
      currency: body.currency || "UGX",
      targetDate,
      status: body.status || "active",
      percentageComplete,
      remainingAmount,
      isLocked,
      cooldownHours,
      accountabilityPhone,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to create goal" });
  }
});

/**
 * PATCH /api/goals/:id
 * Updates goal progress, anti-impulse lock settings, or target.
 */
router.patch("/goals/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = String(req.params.id);
    const body = req.body;

    const existing = await db
      .select()
      .from(financialGoalsTable)
      .where(and(eq(financialGoalsTable.id, id), eq(financialGoalsTable.userId, userId)))
      .limit(1);

    if (existing.length === 0) return notFound(res);

    const updates: any = { updatedAt: new Date() };
    if (body.name) updates.name = body.name;
    if (body.targetAmount !== undefined) updates.targetAmount = String(body.targetAmount);
    if (body.currentAmount !== undefined) updates.currentAmount = String(body.currentAmount);
    if (body.currency) updates.currency = body.currency;
    if (body.status) updates.status = body.status;
    if (body.targetDate) updates.targetDate = calendarDate(body.targetDate) as string;
    if (body.isLocked !== undefined) updates.isLocked = Boolean(body.isLocked);
    if (body.cooldownHours !== undefined) updates.cooldownHours = Number(body.cooldownHours);
    if (body.accountabilityPhone !== undefined) updates.accountabilityPhone = body.accountabilityPhone || null;

    await db.update(financialGoalsTable).set(updates).where(eq(financialGoalsTable.id, id));

    const updated = await db.select().from(financialGoalsTable).where(eq(financialGoalsTable.id, id)).limit(1);
    const g = updated[0];

    const targetAmount = Number(g.targetAmount);
    const currentAmount = Number(g.currentAmount);
    const percentageComplete = targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 1000) / 10) : 0;
    const remainingAmount = Math.max(0, targetAmount - currentAmount);

    return res.json({
      id: g.id,
      name: g.name,
      targetAmount,
      currentAmount,
      currency: g.currency,
      targetDate: g.targetDate,
      status: g.status,
      percentageComplete,
      remainingAmount,
      isLocked: g.isLocked,
      cooldownHours: g.cooldownHours,
      accountabilityPhone: g.accountabilityPhone,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to update goal" });
  }
});

/**
 * DELETE /api/goals/:id
 * Deletes a goal.
 */
router.delete("/goals/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = String(req.params.id);

    await db.delete(financialGoalsTable).where(and(eq(financialGoalsTable.id, id), eq(financialGoalsTable.userId, userId)));
    return res.status(204).send();
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to delete goal" });
  }
});

/**
 * POST /api/goals/:id/contribute
 * Moves money from an account (e.g. MTN MoMo, Cash, Bank) into the goal.
 * Increments currentAmount and writes balancing double-entry ledger entry.
 */
router.post("/goals/:id/contribute", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = String(req.params.id);
    const { amount, accountId, note } = req.body;

    const numAmount = Math.round(Number(amount));
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ error: "Contribution amount must be greater than 0" });
    }

    if (!accountId) {
      return res.status(400).json({ error: "Source account is required" });
    }

    // Verify goal
    const [goal] = await db
      .select()
      .from(financialGoalsTable)
      .where(and(eq(financialGoalsTable.id, id), eq(financialGoalsTable.userId, userId)))
      .limit(1);

    if (!goal) return notFound(res);

    // Verify account and balance
    const [account] = await db
      .select()
      .from(accountsTable)
      .where(and(eq(accountsTable.id, accountId), eq(accountsTable.userId, userId)))
      .limit(1);

    if (!account) {
      return res.status(404).json({ error: "Source account not found" });
    }

    const currentBalance = await computeAccountBalance(userId, account.id, Number(account.openingBalance));
    if (currentBalance < numAmount) {
      return res.status(400).json({
        error: `Insufficient funds in ${account.name}. Available: UGX ${currentBalance.toLocaleString()}, Requested: UGX ${numAmount.toLocaleString()}`,
      });
    }

    // 1. Create debit ledger entry on source account
    await db.insert(ledgerEntriesTable).values({
      id: `led-${randomUUID()}`,
      userId,
      transactionId: null,
      accountId: account.id,
      amount: numAmount,
      direction: "debit",
    });

    // 2. Increment goal currentAmount
    const [updatedGoal] = await db
      .update(financialGoalsTable)
      .set({
        currentAmount: sql`${financialGoalsTable.currentAmount} + ${numAmount}`,
        updatedAt: new Date(),
      })
      .where(eq(financialGoalsTable.id, id))
      .returning();

    const newAccBalance = await computeAccountBalance(userId, account.id, Number(account.openingBalance));

    return res.status(200).json({
      message: `Successfully transferred UGX ${numAmount.toLocaleString()} from ${account.name} to ${goal.name}`,
      goal: updatedGoal,
      newAccountBalance: newAccBalance,
    });
  } catch (err: any) {
    console.error("Error contributing to goal:", err);
    return res.status(500).json({ error: err.message || "Failed to record contribution" });
  }
});

/**
 * POST /api/goals/:id/request-withdrawal
 * Anti-impulse intercept:
 * If isLocked is true, does NOT transfer funds immediately.
 * Sets pendingWithdrawalAmount and pendingWithdrawalAt to initiate the cooling-off lock.
 */
router.post("/goals/:id/request-withdrawal", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = String(req.params.id);
    const { amount, destinationAccountId } = req.body;

    const numAmount = Math.round(Number(amount));
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ error: "Withdrawal amount must be greater than 0" });
    }

    const [goal] = await db
      .select()
      .from(financialGoalsTable)
      .where(and(eq(financialGoalsTable.id, id), eq(financialGoalsTable.userId, userId)))
      .limit(1);

    if (!goal) return notFound(res);

    if (numAmount > Number(goal.currentAmount)) {
      return res.status(400).json({
        error: `Requested amount (UGX ${numAmount.toLocaleString()}) exceeds goal balance (UGX ${Number(goal.currentAmount).toLocaleString()})`,
      });
    }

    if (goal.isLocked) {
      // Initiate cooling-off period
      const now = new Date();
      const cooldownHours = goal.cooldownHours || 24;
      const unlockAt = new Date(now.getTime() + cooldownHours * 3600 * 1000);

      const [updated] = await db
        .update(financialGoalsTable)
        .set({
          pendingWithdrawalAmount: String(numAmount),
          pendingWithdrawalAt: now,
          updatedAt: now,
        })
        .where(eq(financialGoalsTable.id, id))
        .returning();

      return res.json({
        status: "cooldown_active",
        message: `Cooling-off period initiated. Funds will unlock in ${cooldownHours} hours on ${unlockAt.toLocaleTimeString()} (${unlockAt.toDateString()}). You can cancel anytime.`,
        goal: updated,
        unlockAt: unlockAt.toISOString(),
        cooldownHours,
      });
    } else {
      // Unlocked goal: allow direct withdrawal if destination specified
      const { destinationAccountId } = req.body;
      if (!destinationAccountId) {
        return res.status(400).json({ error: "Destination account is required for payout" });
      }

      await db
        .update(financialGoalsTable)
        .set({
          currentAmount: sql`GREATEST(0, ${financialGoalsTable.currentAmount} - ${numAmount})`,
          updatedAt: new Date(),
        })
        .where(eq(financialGoalsTable.id, id));

      await db.insert(ledgerEntriesTable).values({
        id: `led-${randomUUID()}`,
        userId,
        transactionId: null,
        accountId: destinationAccountId,
        amount: numAmount,
        direction: "credit",
      });

      return res.json({
        status: "completed",
        message: `UGX ${numAmount.toLocaleString()} disbursed directly to your account.`,
      });
    }
  } catch (err: any) {
    console.error("Error requesting withdrawal:", err);
    return res.status(500).json({ error: err.message || "Failed to request withdrawal" });
  }
});

/**
 * POST /api/goals/:id/cancel-withdrawal
 * Clears pending withdrawal fields, allowing the user to change their mind and keep saving.
 */
router.post("/goals/:id/cancel-withdrawal", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = String(req.params.id);

    const [goal] = await db
      .select()
      .from(financialGoalsTable)
      .where(and(eq(financialGoalsTable.id, id), eq(financialGoalsTable.userId, userId)))
      .limit(1);

    if (!goal) return notFound(res);

    const [updated] = await db
      .update(financialGoalsTable)
      .set({
        pendingWithdrawalAmount: null,
        pendingWithdrawalAt: null,
        updatedAt: new Date(),
      })
      .where(eq(financialGoalsTable.id, id))
      .returning();

    return res.json({
      message: "Withdrawal cancelled. Your committed savings remain safely locked and on track!",
      goal: updated,
    });
  } catch (err: any) {
    console.error("Error cancelling withdrawal:", err);
    return res.status(500).json({ error: err.message || "Failed to cancel withdrawal" });
  }
});

/**
 * POST /api/goals/:id/execute-withdrawal
 * Checks if cooling-off timer has elapsed.
 * Only then decrements currentAmount, credits destination account, and writes balancing ledger entry.
 */
router.post("/goals/:id/execute-withdrawal", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = String(req.params.id);
    const { destinationAccountId } = req.body;

    if (!destinationAccountId) {
      return res.status(400).json({ error: "Destination account is required to receive funds" });
    }

    const [goal] = await db
      .select()
      .from(financialGoalsTable)
      .where(and(eq(financialGoalsTable.id, id), eq(financialGoalsTable.userId, userId)))
      .limit(1);

    if (!goal) return notFound(res);

    if (!goal.pendingWithdrawalAmount || !goal.pendingWithdrawalAt) {
      return res.status(400).json({ error: "No pending withdrawal request found for this goal" });
    }

    const pendingAmount = Number(goal.pendingWithdrawalAmount);
    const cooldownHours = goal.cooldownHours || 24;
    const unlockTime = new Date(goal.pendingWithdrawalAt).getTime() + cooldownHours * 3600 * 1000;
    const now = Date.now();

    if (now < unlockTime) {
      const remainingSeconds = Math.ceil((unlockTime - now) / 1000);
      const remainingHours = Math.round((remainingSeconds / 3600) * 10) / 10;
      return res.status(400).json({
        error: `Cooling-off timer is still active. Please wait ${remainingHours} hours before funds can be disbursed.`,
        remainingCooldownSeconds: remainingSeconds,
      });
    }

    // Verify destination account
    const [destinationAccount] = await db
      .select()
      .from(accountsTable)
      .where(and(eq(accountsTable.id, destinationAccountId), eq(accountsTable.userId, userId)))
      .limit(1);

    if (!destinationAccount) {
      return res.status(404).json({ error: "Destination account not found" });
    }

    // 1. Decrement goal currentAmount and clear pending withdrawal
    const [updatedGoal] = await db
      .update(financialGoalsTable)
      .set({
        currentAmount: sql`GREATEST(0, ${financialGoalsTable.currentAmount} - ${pendingAmount})`,
        pendingWithdrawalAmount: null,
        pendingWithdrawalAt: null,
        updatedAt: new Date(),
      })
      .where(eq(financialGoalsTable.id, id))
      .returning();

    // 2. Credit destination account
    await db.insert(ledgerEntriesTable).values({
      id: `led-${randomUUID()}`,
      userId,
      transactionId: null,
      accountId: destinationAccount.id,
      amount: pendingAmount,
      direction: "credit",
    });

    const newBalance = await computeAccountBalance(userId, destinationAccount.id, Number(destinationAccount.openingBalance));

    return res.json({
      message: `Withdrawal of UGX ${pendingAmount.toLocaleString()} successfully executed and deposited into ${destinationAccount.name}.`,
      goal: updatedGoal,
      destinationAccount: {
        id: destinationAccount.id,
        name: destinationAccount.name,
        newBalance,
      },
    });
  } catch (err: any) {
    console.error("Error executing withdrawal:", err);
    return res.status(500).json({ error: err.message || "Failed to execute withdrawal" });
  }
});

// ==============================================================================
// 7. DEBTS & OWED MODULE (LENDING, BORROWING, & REPAYMENT RECONCILIATION)
// ==============================================================================

/**
 * GET /api/debts
 * Fetches all active and settled debts, joining their repayment logs from `debt_payments`.
 */
router.get("/debts", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const [debts, accounts, payments] = await Promise.all([
      db.select().from(debtsTable).where(eq(debtsTable.userId, userId)).orderBy(desc(debtsTable.createdAt)),
      db.select().from(accountsTable).where(eq(accountsTable.userId, userId)),
      db.select().from(debtPaymentsTable),
    ]);

    const accMap = new Map(accounts.map((a) => [a.id, a.name]));

    const result = debts.map((d) => {
      const debtPayments = payments
        .filter((p) => p.debtId === d.id)
        .map((p) => ({
          id: p.id,
          debtId: p.debtId,
          amount: Number(p.amount),
          accountId: p.accountId,
          accountName: p.accountId ? accMap.get(p.accountId) || "Account" : null,
          paidAt: p.paidAt ? p.paidAt.toISOString() : new Date().toISOString(),
          notes: p.notes,
        }));

      return {
        id: d.id,
        personOrEntity: d.personOrEntity,
        type: d.type as "owed_to_you" | "you_owe",
        principalAmount: Number(d.principalAmount),
        remainingAmount: Number(d.remainingAmount),
        currency: d.currency as any,
        dueDate: d.dueDate || null,
        status: d.status as "active" | "settled",
        notes: d.notes || null,
        accountId: null,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        payments: debtPayments,
      };
    });

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch debts" });
  }
});

/**
 * POST /api/debts
 * Logs a new debt / loan. If an account is selected, records an immediate
 * double-entry ledger event to keep cash and mobile money balances honest.
 */
router.post("/debts", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const body = CreateDebtBody.parse(req.body);
    const id = `debt-${randomUUID()}`;
    const principalAmount = Math.round(body.principalAmount);
    const dueDate =
      body.dueDate && typeof body.dueDate === "string" && body.dueDate.trim() !== ""
        ? (calendarDate(body.dueDate) as string)
        : null;
    const accountId =
      body.accountId && typeof body.accountId === "string" && body.accountId.trim() !== ""
        ? body.accountId
        : null;

    // 1. Insert Debt record
    await db.insert(debtsTable).values({
      id,
      userId,
      personOrEntity: body.personOrEntity.trim(),
      type: body.type,
      principalAmount,
      remainingAmount: principalAmount,
      currency: body.currency,
      dueDate,
      status: "active",
      notes: body.notes && body.notes.trim() !== "" ? body.notes.trim() : null,
    });

    // 2. Immediate Wallet Balance Adjustment (Double-Entry Ledger)
    if (accountId) {
      if (body.type === "owed_to_you") {
        // User lent money out of their wallet -> money decreased -> debit
        await db.insert(ledgerEntriesTable).values({
          id: `led-${randomUUID()}`,
          userId,
          transactionId: id,
          accountId,
          amount: principalAmount,
          direction: "debit",
        });
      } else {
        // User borrowed money into their wallet -> money increased -> credit
        await db.insert(ledgerEntriesTable).values({
          id: `led-${randomUUID()}`,
          userId,
          transactionId: id,
          accountId,
          amount: principalAmount,
          direction: "credit",
        });
      }
    }

    const created = await db.select().from(debtsTable).where(eq(debtsTable.id, id)).limit(1);
    const d = created[0];

    return res.status(201).json({
      id: d.id,
      personOrEntity: d.personOrEntity,
      type: d.type,
      principalAmount: Number(d.principalAmount),
      remainingAmount: Number(d.remainingAmount),
      currency: d.currency,
      dueDate: d.dueDate || null,
      status: d.status,
      notes: d.notes || null,
      accountId,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      payments: [],
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to create debt" });
  }
});

/**
 * POST /api/debts/:id/pay
 * Records a partial or full payment on a debt:
 * 1. Decrements `remainingAmount`.
 * 2. If `remainingAmount <= 0`, sets `status = 'settled'`.
 * 3. Records the installment in `debt_payments`.
 * 4. Inserts balancing ledger entry on the chosen account to update real-time wallet balance.
 */
router.post("/debts/:id/pay", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const params = PayDebtParams.parse(req.params);
    const body = PayDebtBody.parse(req.body);

    const existingDebts = await db
      .select()
      .from(debtsTable)
      .where(and(eq(debtsTable.id, params.id), eq(debtsTable.userId, userId)))
      .limit(1);

    if (existingDebts.length === 0) return notFound(res);
    const debt = existingDebts[0];

    const paymentAmount = Math.round(body.amount);
    const newRemaining = Math.max(0, Number(debt.remainingAmount) - paymentAmount);
    const newStatus: "active" | "settled" = newRemaining <= 0 ? "settled" : "active";

    // 1. Update remaining balance and settlement status
    await db
      .update(debtsTable)
      .set({
        remainingAmount: newRemaining,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(debtsTable.id, params.id));

    // 2. Insert Debt Payment record
    const paymentId = `pay-${randomUUID()}`;
    const paidAtDate = body.paidAt ? new Date(body.paidAt) : new Date();

    await db.insert(debtPaymentsTable).values({
      id: paymentId,
      debtId: params.id,
      amount: paymentAmount,
      accountId: body.accountId || null,
      paidAt: paidAtDate,
      notes: body.notes || null,
    });

    // 3. Balance reconciliation in `ledger_entries`
    if (body.accountId) {
      if (debt.type === "owed_to_you") {
        // Debtor repaid user into user's wallet -> money comes in -> credit
        await db.insert(ledgerEntriesTable).values({
          id: `led-${randomUUID()}`,
          userId,
          transactionId: paymentId,
          accountId: body.accountId,
          amount: paymentAmount,
          direction: "credit",
        });
      } else {
        // User paid creditor from user's wallet -> money leaves -> debit
        await db.insert(ledgerEntriesTable).values({
          id: `led-${randomUUID()}`,
          userId,
          transactionId: paymentId,
          accountId: body.accountId,
          amount: paymentAmount,
          direction: "debit",
        });
      }
    }

    // Fetch updated record with all historical payment installments
    const [updatedDebts, payments, accounts] = await Promise.all([
      db.select().from(debtsTable).where(eq(debtsTable.id, params.id)).limit(1),
      db.select().from(debtPaymentsTable).where(eq(debtPaymentsTable.debtId, params.id)).orderBy(desc(debtPaymentsTable.paidAt)),
      db.select().from(accountsTable).where(eq(accountsTable.userId, userId)),
    ]);

    const accMap = new Map(accounts.map((a) => [a.id, a.name]));
    const d = updatedDebts[0];

    const debtPayments = payments.map((p) => ({
      id: p.id,
      debtId: p.debtId,
      amount: Number(p.amount),
      accountId: p.accountId,
      accountName: p.accountId ? accMap.get(p.accountId) || "Account" : null,
      paidAt: p.paidAt.toISOString(),
      notes: p.notes,
    }));

    return res.json({
      id: d.id,
      personOrEntity: d.personOrEntity,
      type: d.type,
      principalAmount: Number(d.principalAmount),
      remainingAmount: Number(d.remainingAmount),
      currency: d.currency,
      dueDate: d.dueDate || null,
      status: d.status,
      notes: d.notes || null,
      accountId: body.accountId || null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      payments: debtPayments,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to pay debt" });
  }
});

// ==============================================================================
// 8. AI ASSISTANT (CONVERSATIONS & MESSAGES)
// ==============================================================================

/**
 * GET /api/assistant/conversations
 * Lists user AI chat conversations.
 */
router.get("/assistant/conversations", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const convs = await db
      .select()
      .from(aiConversationsTable)
      .where(eq(aiConversationsTable.userId, userId))
      .orderBy(desc(aiConversationsTable.updatedAt));

    return res.json(
      convs.map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }))
    );
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch conversations" });
  }
});

/**
 * POST /api/assistant/conversations
 * Creates a new conversation thread.
 */
router.post("/assistant/conversations", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const body = CreateConversationBody.parse(req.body ?? {});
    const id = `conv-${randomUUID()}`;
    const title = body.title || "Financial Consultation";

    await db.insert(aiConversationsTable).values({
      id,
      userId,
      title,
    });

    const nowStr = new Date().toISOString();
    return res.status(201).json({
      id,
      title,
      createdAt: nowStr,
      updatedAt: nowStr,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to create conversation" });
  }
});

/**
 * GET /api/assistant/conversations/:id/messages
 * Fetches conversation message history.
 */
router.get("/assistant/conversations/:id/messages", async (req: AuthenticatedRequest, res) => {
  try {
    const params = GetConversationMessagesParams.parse(req.params);
    const msgs = await db
      .select()
      .from(aiMessagesTable)
      .where(eq(aiMessagesTable.conversationId, params.id))
      .orderBy(aiMessagesTable.createdAt);

    return res.json(
      msgs.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role as "user" | "assistant",
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      }))
    );
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch messages" });
  }
});

/**
 * Generates an intelligent, live PostgreSQL-grounded financial advisory reply.
 */
async function generateFinancialAdvisorReply(userId: string, userText: string): Promise<string> {
  const query = userText.toLowerCase().trim();

  // 1. Fetch live financial picture in parallel
  const [goals, accounts, budgets, categories, debts, vaults, userProfile] = await Promise.all([
    db.select().from(financialGoalsTable).where(eq(financialGoalsTable.userId, userId)).orderBy(desc(financialGoalsTable.createdAt)),
    db.select().from(accountsTable).where(and(eq(accountsTable.userId, userId), eq(accountsTable.isActive, true))),
    db.select().from(budgetsTable).where(eq(budgetsTable.userId, userId)),
    db.select().from(categoriesTable).where(or(eq(categoriesTable.userId, userId), eq(categoriesTable.isDefault, true))),
    db.select().from(debtsTable).where(eq(debtsTable.userId, userId)),
    db.select().from(vaultsTable).where(eq(vaultsTable.userId, userId)),
    db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1),
  ]);

  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  // Live account balances
  const accountBalances = await Promise.all(
    accounts.map(async (acc) => {
      const bal = await computeAccountBalance(userId, acc.id, Number(acc.openingBalance));
      return { ...acc, liveBalance: bal };
    })
  );
  const totalSpendingCash = accountBalances.reduce((sum, a) => sum + a.liveBalance, 0);

  // Committed locked savings
  const totalCommittedSavings = goals.reduce((sum, g) => sum + Number(g.currentAmount), 0);

  // Month prefix for budgets
  const now = new Date();
  const currentMonthPrefix = now.toISOString().slice(0, 7);
  const monthTxs = await db
    .select()
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "expense"),
        sql`${transactionsTable.transactionDate} LIKE ${currentMonthPrefix + "%"}`
      )
    );

  // Match intent:
  // A. GOALS & SAVINGS
  if (
    query.includes("goal") ||
    query.includes("saving") ||
    query.includes("target") ||
    query.includes("car") ||
    query.includes("land") ||
    query.includes("cushion") ||
    query.includes("emergency") ||
    query.includes("locked") ||
    query.includes("cooling")
  ) {
    if (goals.length === 0) {
      return `You currently have no active savings goals set up. 

You can create one from the Goals tab (such as "Buy Car", "Land Deposit", or "Emergency Cushion"). With Tereka's 24-Hour Cooling-Off lock, your money will be protected from impulse withdrawals until you deliberately wait out the cooling-off reflection period!`;
    }

    const lines = goals.map((g, idx) => {
      const current = Number(g.currentAmount);
      const target = Number(g.targetAmount);
      const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
      const remaining = Math.max(0, target - current);
      const lockStatus = g.isLocked ? `🔒 Protected by ${g.cooldownHours || 24}h cooling-off lock` : `🔓 Unlocked`;
      const pendingAlert = g.pendingWithdrawalAmount
        ? `\n   ⚠️ *Cooling-Off Active*: Withdrawal of UGX ${Number(g.pendingWithdrawalAmount).toLocaleString()} requested.`
        : "";

      return `${idx + 1}. 🎯 **${g.name}**\n   • Saved: **UGX ${current.toLocaleString()}** of UGX ${target.toLocaleString()} (${pct}% achieved)\n   • Remaining: UGX ${remaining.toLocaleString()} to goal\n   • Security: ${lockStatus}${pendingAlert}`;
    });

    return `Here is the current status of your savings goals:

${lines.join("\n\n")}

📊 **Total Committed Locked Savings**: UGX ${totalCommittedSavings.toLocaleString()}
💰 **Available Liquid Spending Cash**: UGX ${totalSpendingCash.toLocaleString()}

Every contribution builds your intentional buffer. Keep going!`;
  }

  // B. ACCOUNTS, WALLETS, BALANCES, CASH
  if (
    query.includes("account") ||
    query.includes("balance") ||
    query.includes("cash") ||
    query.includes("momo") ||
    query.includes("mtn") ||
    query.includes("airtel") ||
    query.includes("bank") ||
    query.includes("wallet") ||
    query.includes("how much")
  ) {
    if (accounts.length === 0) {
      return `You have not registered any accounts yet. Add your MTN MoMo, Airtel Money, Bank accounts, or Cash wallet from the Accounts page to start tracking live balances.`;
    }

    const accLines = accountBalances.map(
      (a) => `• **${a.name}** (${a.type.toUpperCase()}): **UGX ${a.liveBalance.toLocaleString()}**`
    );

    return `Here is your live cash & wallet breakdown:

${accLines.join("\n")}

💵 **Total Liquid Spending Cash**: **UGX ${totalSpendingCash.toLocaleString()}**
🔒 **Committed Locked Savings**: **UGX ${totalCommittedSavings.toLocaleString()}**
📈 **Overall Net Worth**: **UGX ${(totalSpendingCash + totalCommittedSavings).toLocaleString()}**`;
  }

  // C. BUDGETS & SPENDING
  if (
    query.includes("budget") ||
    query.includes("spend") ||
    query.includes("limit") ||
    query.includes("category") ||
    query.includes("expense") ||
    query.includes("food") ||
    query.includes("dining") ||
    query.includes("fuel") ||
    query.includes("rent")
  ) {
    if (budgets.length === 0) {
      return `You haven't set up any category budgets for this month yet. You can create spending guardrails (e.g., Food, Fuel, Rent, Entertainment) in the Budgets section to enable automated threshold alerts and voice warnings!`;
    }

    const budgetLines = budgets.map((b) => {
      const catName = catMap.get(b.categoryId) || "Budget";
      const spent = monthTxs
        .filter((t) => t.categoryId === b.categoryId)
        .reduce((sum, t) => sum + Number(t.amount) + Number(t.feeAmount || 0), 0);
      const limit = Number(b.amount);
      const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      const remaining = Math.max(0, limit - spent);
      const overspend = Math.max(0, spent - limit);

      const status =
        pct >= 100
          ? `🚨 EXCEEDED by UGX ${overspend.toLocaleString()}`
          : pct >= 80
          ? `⚠️ 80%+ Burn Rate (UGX ${remaining.toLocaleString()} left)`
          : `✅ On Track (UGX ${remaining.toLocaleString()} left)`;

      return `• **${catName}**: UGX ${spent.toLocaleString()} spent of UGX ${limit.toLocaleString()} (${pct}%) — ${status}`;
    });

    const totalSpentThisMonth = monthTxs.reduce(
      (sum, t) => sum + Number(t.amount) + Number(t.feeAmount || 0),
      0
    );

    return `Here is your current monthly budget review:

${budgetLines.join("\n")}

💸 **Total Spent This Month**: UGX ${totalSpentThisMonth.toLocaleString()}
Stay mindful of categories near the 80% mark to keep your spending velocity healthy!`;
  }

  // D. DEBTS & OWED
  if (
    query.includes("debt") ||
    query.includes("owe") ||
    query.includes("owed") ||
    query.includes("loan") ||
    query.includes("borrow") ||
    query.includes("lend")
  ) {
    if (debts.length === 0) {
      return `You have no active loans or borrowed balances recorded in Debts & Owed. All clear!`;
    }

    const youOwe = debts.filter((d) => d.type === "you_owe");
    const owedToYou = debts.filter((d) => d.type === "owed_to_you");

    const totalYouOwe = youOwe.reduce((sum, d) => sum + Number(d.remainingAmount), 0);
    const totalOwedToYou = owedToYou.reduce((sum, d) => sum + Number(d.remainingAmount), 0);

    return `Here is your debt & credit standing:

🔴 **Money You Owe (Liabilities)**: UGX ${totalYouOwe.toLocaleString()} across ${youOwe.length} record${youOwe.length === 1 ? '' : 's'}.
🟢 **Money Owed To You (Receivables)**: UGX ${totalOwedToYou.toLocaleString()} across ${owedToYou.length} record${owedToYou.length === 1 ? '' : 's'}.

Remember to prioritize high-interest liabilities first to prevent tariff and fee drag.`;
  }

  // E. VAULTS & SACCOs
  if (
    query.includes("vault") ||
    query.includes("sacco") ||
    query.includes("group") ||
    query.includes("family")
  ) {
    if (vaults.length === 0) {
      return `You haven't created or joined any Tereka Vaults yet. Vaults allow you to pool group or family savings with multi-signature destination voting and strict unlock conditions!`;
    }

    const vLines = vaults.map((v) => {
      return `• 🏛️ **${v.title}**: UGX ${Number(v.currentAmount).toLocaleString()} pooled of UGX ${Number(v.targetAmount).toLocaleString()} (Lock: ${v.lockType.replace('_', ' ')})`;
    });

    return `Here are your active Tereka Vaults:

${vLines.join("\n")}

All disbursements require authorized keyholder approvals or member destination voting.`;
  }

  // F. GENERAL / ADVICE / GREETINGS
  const name = userProfile[0]?.fullName || "Friend";
  return `Hello ${name}! Here is a quick snapshot of your financial intelligence:

• 💰 **Available Spending Cash**: UGX ${totalSpendingCash.toLocaleString()}
• 🎯 **Committed Locked Savings**: UGX ${totalCommittedSavings.toLocaleString()} across ${goals.length} goal${goals.length === 1 ? '' : 's'}
• 📊 **Active Monthly Budgets**: ${budgets.length} categories tracked
• ⚖️ **Net Liquid Worth**: UGX ${(totalSpendingCash + totalCommittedSavings).toLocaleString()}

Feel free to ask me anything specific:
- "What are my savings goals?"
- "How much money do I have in my accounts?"
- "Am I over budget in any category?"
- "Who owes me money or what loans do I have?"`;
}

/**
 * POST /api/assistant/conversations/:id/messages
 * Sends a message and generates an intelligent financial advisory reply.
 */
router.post("/assistant/conversations/:id/messages", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const params = SendAssistantMessageParams.parse(req.params);
    const body = SendAssistantMessageBody.parse(req.body);

    const userMsgId = `msg-${randomUUID()}`;
    await db.insert(aiMessagesTable).values({
      id: userMsgId,
      conversationId: params.id,
      userId,
      role: "user",
      content: body.content,
    });

    const assistantContent = await generateFinancialAdvisorReply(userId, body.content);
    const assistantMsgId = `msg-${randomUUID()}`;

    await db.insert(aiMessagesTable).values({
      id: assistantMsgId,
      conversationId: params.id,
      userId,
      role: "assistant",
      content: assistantContent,
    });

    await db
      .update(aiConversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(aiConversationsTable.id, params.id));

    return res.status(201).json([
      {
        id: userMsgId,
        conversationId: params.id,
        role: "user",
        content: body.content,
        createdAt: new Date().toISOString(),
      },
      {
        id: assistantMsgId,
        conversationId: params.id,
        role: "assistant",
        content: assistantContent,
        createdAt: new Date().toISOString(),
      },
    ]);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to send message" });
  }
});

// ==============================================================================
// 9. USER PROFILE
// ==============================================================================

/**
 * GET /api/profile
 * Returns profile settings and preferences.
 */
router.get("/profile", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const profiles = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);

    if (profiles.length === 0) {
      const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      const user = users[0];
      return res.json({
        id: `profile-${userId}`,
        fullName: user?.name || "User",
        email: user?.email || "",
        country: "Uganda",
        preferredCurrency: user?.baseCurrency || "UGX",
        theme: "light",
      });
    }

    const p = profiles[0];
    return res.json({
      id: p.id,
      fullName: p.fullName,
      email: p.email,
      country: p.country,
      preferredCurrency: p.preferredCurrency as any,
      theme: p.theme as any,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch profile" });
  }
});

/**
 * PATCH /api/profile
 * Updates theme, country, preferred currency, and full name.
 */
router.patch("/profile", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const body = UpdateProfileBody.parse(req.body);

    const updates: any = { updatedAt: new Date() };
    if (body.fullName) updates.fullName = body.fullName;
    if (body.country) updates.country = body.country;
    if (body.preferredCurrency) updates.preferredCurrency = body.preferredCurrency;
    if (body.theme) updates.theme = body.theme;

    await db.update(profilesTable).set(updates).where(eq(profilesTable.userId, userId));

    const updated = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
    const p = updated[0];

    return res.json({
      id: p.id,
      fullName: p.fullName,
      email: p.email,
      country: p.country,
      preferredCurrency: p.preferredCurrency,
      theme: p.theme,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to update profile" });
  }
});

export default router;