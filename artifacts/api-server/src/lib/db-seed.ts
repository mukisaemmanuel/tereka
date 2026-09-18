import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
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
} from "@workspace/db";
import { hashPassword } from "./auth";
import { logger } from "./logger";

export const defaultCategoryIds = {
  salary: "category-salary",
  utilities: "category-utilities",
  transport: "category-transport",
  food: "category-food",
  fees: "category-fees",
  entertainment: "category-entertainment",
  shopping: "category-shopping",
  education: "category-education",
};

const defaultCategories = [
  { id: defaultCategoryIds.salary, name: "Salary & Income", type: "income", icon: "briefcase", isDefault: true },
  { id: defaultCategoryIds.utilities, name: "Utilities & Yaka", type: "expense", icon: "zap", isDefault: true },
  { id: defaultCategoryIds.transport, name: "Transport & Boda", type: "expense", icon: "car", isDefault: true },
  { id: defaultCategoryIds.food, name: "Food & Groceries", type: "expense", icon: "utensils", isDefault: true },
  { id: defaultCategoryIds.fees, name: "Bank & MoMo Fees", type: "expense", icon: "receipt", isDefault: true },
  { id: defaultCategoryIds.entertainment, name: "Entertainment", type: "expense", icon: "sparkles", isDefault: true },
  { id: defaultCategoryIds.shopping, name: "Shopping", type: "expense", icon: "shopping-bag", isDefault: true },
  { id: defaultCategoryIds.education, name: "Education", type: "expense", icon: "book-open", isDefault: true },
];

export const DEMO_USER_ID = "user-demo-mukisa";

export async function seedInitialDatabase() {
  try {
    // 1. Seed global default categories
    for (const cat of defaultCategories) {
      const existing = await db.select().from(categoriesTable).where(eq(categoriesTable.id, cat.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(categoriesTable).values({
          id: cat.id,
          name: cat.name,
          type: cat.type,
          icon: cat.icon,
          isDefault: true,
        });
      }
    }

    // 2. Check if demo user exists
    const existingDemo = await db.select().from(usersTable).where(eq(usersTable.id, DEMO_USER_ID)).limit(1);
    if (existingDemo.length === 0) {
      logger.info("Seeding demo user into PostgreSQL database...");

      // User
      await db.insert(usersTable).values({
        id: DEMO_USER_ID,
        name: "Emmanuel Mukisa",
        email: "mukisa@example.com",
        passwordHash: hashPassword("password123"),
        baseCurrency: "UGX",
      });

      // Profile
      await db.insert(profilesTable).values({
        id: "profile-demo-mukisa",
        userId: DEMO_USER_ID,
        fullName: "Emmanuel Mukisa",
        email: "mukisa@example.com",
        country: "Uganda",
        preferredCurrency: "UGX",
        theme: "light",
      });

      // Accounts
      const demoAccounts = [
        { id: "account-mtn-momo", name: "MTN MoMo", type: "mobile_money", currency: "UGX", openingBalance: "1450000" },
        { id: "account-airtel-money", name: "Airtel Money", type: "mobile_money", currency: "UGX", openingBalance: "650000" },
        { id: "account-stanbic-ug", name: "Stanbic Bank Uganda", type: "bank", currency: "UGX", openingBalance: "5200000" },
        { id: "account-physical-cash", name: "Physical Cash", type: "cash", currency: "UGX", openingBalance: "180000" },
      ];

      for (const acc of demoAccounts) {
        await db.insert(accountsTable).values({
          id: acc.id,
          userId: DEMO_USER_ID,
          name: acc.name,
          type: acc.type,
          currency: acc.currency,
          openingBalance: acc.openingBalance,
          isActive: true,
        });
      }

      // Demo Transactions & Ledger Entries
      const demoTxs = [
        { id: "tx-yaka-power", type: "expense", amount: "65000", feeAmount: "1200", currency: "UGX", accountId: "account-mtn-momo", categoryId: defaultCategoryIds.utilities, description: "Yaka Prepaid Electricity Token (Umeme)", notes: "Token Ref: 4829-1029-4820", transactionDate: "2026-08-28" },
        { id: "tx-boda-fuel", type: "expense", amount: "35000", feeAmount: "0", currency: "UGX", accountId: "account-physical-cash", categoryId: defaultCategoryIds.transport, description: "Boda fuel & Shell refill", notes: "Kampala commute fuel", transactionDate: "2026-08-27" },
        { id: "tx-momo-cashout", type: "expense", amount: "150000", feeAmount: "2850", currency: "UGX", accountId: "account-mtn-momo", categoryId: defaultCategoryIds.fees, description: "MoMo Cash Out & Agent Withdrawal", notes: "Agent fee UGX 2,850 deducted", transactionDate: "2026-08-25" },
        { id: "tx-aug-salary", type: "income", amount: "6800000", feeAmount: "0", currency: "UGX", accountId: "account-stanbic-ug", categoryId: defaultCategoryIds.salary, description: "Monthly Consulting Salary", notes: "Direct EFT transfer from client", transactionDate: "2026-08-24" },
        { id: "tx-airtel-groceries", type: "expense", amount: "125000", feeAmount: "1000", currency: "UGX", accountId: "account-airtel-money", categoryId: defaultCategoryIds.food, description: "Capital Shoppers Nakawa", notes: "Airtel merchant payment", transactionDate: "2026-08-22" },
        { id: "tx-stanbic-rent", type: "expense", amount: "1600000", feeAmount: "2500", currency: "UGX", accountId: "account-stanbic-ug", categoryId: defaultCategoryIds.utilities, description: "Apartment Rent & Service Fee", notes: "Bank transfer to landlord", transactionDate: "2026-08-02" },
      ];

      for (const tx of demoTxs) {
        await db.insert(transactionsTable).values({
          id: tx.id,
          userId: DEMO_USER_ID,
          accountId: tx.accountId,
          categoryId: tx.categoryId,
          type: tx.type,
          amount: tx.amount,
          feeAmount: tx.feeAmount,
          currency: tx.currency,
          description: tx.description,
          notes: tx.notes,
          transactionDate: tx.transactionDate,
        });

        const amountNum = Math.round(Number(tx.amount));
        const feeNum = Math.round(Number(tx.feeAmount || 0));

        if (tx.type === "income") {
          await db.insert(ledgerEntriesTable).values({
            id: `led-${randomUUID()}`,
            userId: DEMO_USER_ID,
            transactionId: tx.id,
            accountId: tx.accountId,
            amount: amountNum,
            direction: "credit",
          });
        } else {
          await db.insert(ledgerEntriesTable).values({
            id: `led-${randomUUID()}`,
            userId: DEMO_USER_ID,
            transactionId: tx.id,
            accountId: tx.accountId,
            amount: amountNum,
            direction: "debit",
          });
        }

        if (feeNum > 0) {
          await db.insert(ledgerEntriesTable).values({
            id: `led-${randomUUID()}-fee`,
            userId: DEMO_USER_ID,
            transactionId: tx.id,
            accountId: tx.accountId,
            amount: feeNum,
            direction: "debit",
          });
        }
      }

      // Demo Budgets
      await db.insert(budgetsTable).values([
        { id: "budget-utilities", userId: DEMO_USER_ID, categoryId: defaultCategoryIds.utilities, amount: "250000", currency: "UGX", period: "monthly" },
        { id: "budget-transport", userId: DEMO_USER_ID, categoryId: defaultCategoryIds.transport, amount: "300000", currency: "UGX", period: "monthly" },
        { id: "budget-food", userId: DEMO_USER_ID, categoryId: defaultCategoryIds.food, amount: "650000", currency: "UGX", period: "monthly" },
        { id: "budget-fees", userId: DEMO_USER_ID, categoryId: defaultCategoryIds.fees, amount: "50000", currency: "UGX", period: "monthly" },
      ]);

      // Demo Goals
      await db.insert(financialGoalsTable).values([
        { id: "goal-emergency", userId: DEMO_USER_ID, name: "Emergency Reserve Fund", targetAmount: "12000000", currentAmount: "7350000", currency: "UGX", targetDate: "2027-01-31", status: "active" },
        { id: "goal-land", userId: DEMO_USER_ID, name: "Mukono Land Plot Deposit", targetAmount: "18000000", currentAmount: "4500000", currency: "UGX", targetDate: "2027-12-15", status: "active" },
      ]);

      // Demo Debts
      await db.insert(debtsTable).values([
        {
          id: "debt-john-k",
          userId: DEMO_USER_ID,
          personOrEntity: "John Katende",
          type: "owed_to_you",
          principalAmount: 450000,
          remainingAmount: 200000,
          currency: "UGX",
          dueDate: "2026-10-15",
          status: "active",
          notes: "Emergency loan for car repairs",
        },
        {
          id: "debt-sacco-loan",
          userId: DEMO_USER_ID,
          personOrEntity: "Wandegeya SACCO",
          type: "you_owe",
          principalAmount: 1500000,
          remainingAmount: 900000,
          currency: "UGX",
          dueDate: "2026-11-30",
          status: "active",
          notes: "Short-term development advance",
        },
      ]);

      // Demo Debt Repayments
      await db.insert(debtPaymentsTable).values([
        {
          id: "pay-john-1",
          debtId: "debt-john-k",
          amount: 250000,
          accountId: "account-mtn-momo",
          notes: "First installment via MoMo",
        },
        {
          id: "pay-sacco-1",
          debtId: "debt-sacco-loan",
          amount: 600000,
          accountId: "account-stanbic-ug",
          notes: "Monthly installment transfer",
        },
      ]);

      // Demo Welcome Conversation
      const convId = "conversation-demo";
      await db.insert(aiConversationsTable).values({
        id: convId,
        userId: DEMO_USER_ID,
        title: "Welcome to Tereka",
      });

      await db.insert(aiMessagesTable).values({
        id: `msg-${randomUUID()}`,
        conversationId: convId,
        userId: DEMO_USER_ID,
        role: "assistant",
        content: "Hello Emmanuel! Welcome to Tereka Financial Intelligence. Your accounts, transactions, and debts in UGX are synced to PostgreSQL. Chat with me anytime for cashflow analysis!",
      });

      logger.info("Demo user successfully seeded into PostgreSQL!");
    }
  } catch (error) {
    logger.error({ err: error }, "Error during initial database seeding");
  }
}
