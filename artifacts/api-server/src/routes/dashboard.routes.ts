/**
 * ==============================================================================
 * TEREKA FINANCIAL INTELLIGENCE - DASHBOARD ROUTES
 * ==============================================================================
 *
 * Implements dashboard aggregation with strict calculation rules:
 * - "Income This Month": strictly SUM(amount) from transactions where type = 'income'
 *   and date falls within the current calendar month. Returns 0 if no income transactions.
 * - "Spent This Month": strictly SUM(amount + feeAmount) from transactions where
 *   type = 'expense' and date falls within the current calendar month. Returns 0 if no expense transactions.
 * - Live account balances dynamic aggregation from opening balance + credit - debit.
 */

import { Router } from "express";
import { and, desc, eq, or, sql } from "drizzle-orm";
import {
  db,
  profilesTable,
  accountsTable,
  transactionsTable,
  ledgerEntriesTable,
  budgetsTable,
  financialGoalsTable,
  categoriesTable,
} from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

/**
 * Computes live wallet balance dynamically from opening balance + SUM(credit) - SUM(debit)
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

/**
 * GET /api/dashboard/summary & GET /api/summary
 * Strictly calculates:
 * - incomeThisMonth: SUM(amount) where type = 'income' and within current calendar month (0 if zero income transactions)
 * - spentThisMonth: SUM(amount + feeAmount) where type = 'expense' and within current calendar month (0 if zero expense transactions)
 */
export async function getDashboardSummary(req: AuthenticatedRequest, res: any) {
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

    // Filter transactions strictly falling within current calendar month
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentMonthStr = String(currentMonth + 1).padStart(2, "0");
    const currentMonthPrefix = `${currentYear}-${currentMonthStr}`;

    const currentMonthTxs = userTxs.filter((t) => {
      if (!t.transactionDate) return false;
      if (t.transactionDate.startsWith(currentMonthPrefix)) return true;
      const d = new Date(t.transactionDate);
      return !isNaN(d.getTime()) && d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });

    const incomeTxs = currentMonthTxs.filter((t) => t.type === "income");
    const expenseTxs = currentMonthTxs.filter((t) => t.type === "expense");

    // Strict SUM(amount) where type = 'income' and within current calendar month
    // Returns 0 if user has zero income transactions
    const incomeThisMonth = incomeTxs.length > 0
      ? incomeTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0)
      : 0;

    // Strict SUM(amount + feeAmount) where type = 'expense' and within current calendar month
    // Returns 0 if user has zero expense transactions
    const spentThisMonth = expenseTxs.length > 0
      ? expenseTxs.reduce((sum, t) => sum + Number(t.amount || 0) + Number(t.feeAmount || 0), 0)
      : 0;

    const monthlyIncome = incomeThisMonth;
    const monthlyExpenses = spentThisMonth;

    const totalFeesPaid = userTxs.reduce((sum, t) => sum + Number(t.feeAmount || 0), 0);
    const totalBudget = userBudgets.reduce((sum, b) => sum + Number(b.amount), 0);
    const remainingBudget = Math.max(0, totalBudget - monthlyExpenses);

    // Group spending by category with UI color palette
    const categoryMap = new Map(userCats.map((c) => [c.id, c.name]));
    const categoryColors = ["#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316", "#64748b"];
    const catSpendMap = new Map<string, number>();

    expenseTxs.forEach((t) => {
      const catName = categoryMap.get(t.categoryId) || "Other";
      const total = Number(t.amount || 0) + Number(t.feeAmount || 0);
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
      const inc = mTxs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount || 0), 0);
      const exp = mTxs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount || 0) + Number(t.feeAmount || 0), 0);

      incomeVsExpenses.push({
        month: monthLabel,
        income: inc,
        expenses: exp,
      });
    }

    const accountMap = new Map(userAccounts.map((a) => [a.id, a.name]));

    const recentTransactions = userTxs.slice(0, 5).map((t) => ({
      ...t,
      amount: Number(t.amount || 0),
      feeAmount: Number(t.feeAmount || 0),
      accountName: accountMap.get(t.accountId) || "Account",
      categoryName: categoryMap.get(t.categoryId) || "Category",
    }));

    const budgetStatus = userBudgets.map((b) => {
      const catName = categoryMap.get(b.categoryId) || "Budget";
      const spent = expenseTxs
        .filter((t) => t.categoryId === b.categoryId)
        .reduce((sum, t) => sum + Number(t.amount || 0) + Number(t.feeAmount || 0), 0);

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
      incomeThisMonth,
      spentThisMonth,
      remainingBudget,
      totalFeesPaid,
      balanceChange: totalBalance > 0 ? 4.2 : 0,
      spendingByCategory,
      incomeVsExpenses,
      recentTransactions,
      budgetStatus,
      goalProgress,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to get dashboard summary" });
  }
}

router.get("/dashboard/summary", getDashboardSummary);
router.get("/summary", getDashboardSummary);

export default router;
