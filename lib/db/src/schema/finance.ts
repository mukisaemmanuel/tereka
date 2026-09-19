/**
 * ==============================================================================
 * TEREKA FINANCIAL INTELLIGENCE - POSTGRESQL DATABASE SCHEMA (DRIZZLE ORM)
 * ==============================================================================
 * 
 * This file defines the complete relational database schema for Tereka.
 * 
 * Architecture Highlights:
 * 1. Double-Entry Accounting:
 *    Account balances are not stored as mutable numbers. Instead, live balances
 *    are computed from `accounts.opening_balance` + aggregated `ledger_entries` (debits/credits).
 * 
 * 2. Mobile Money & Fee Isolation:
 *    Transactions store both base `amount` and dedicated `fee_amount` (tariffs).
 * 
 * 3. Debts & Owed Module:
 *    Tracks peer lending (`owed_to_you` - Asset) and borrowing (`you_owe` - Liability),
 *    with installment payments in `debt_payments` and balancing ledger entries.
 * 
 * 4. Budgets & Financial Goals:
 *    Monthly spending targets and long-term asset reserves.
 * 
 * 5. AI Financial Assistant:
 *    Conversations and message logs for context-aware financial intelligence.
 */

import {
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Standard timestamp columns applied to tables
 */
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/**
 * ------------------------------------------------------------------------------
 * 1. USERS TABLE
 * ------------------------------------------------------------------------------
 * Core user identity and password hash storage.
 */
export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  baseCurrency: text("base_currency").notNull().default("UGX"),
  ...timestamps,
});

/**
 * ------------------------------------------------------------------------------
 * 2. PROFILES TABLE
 * ------------------------------------------------------------------------------
 * User profile settings, preferred display currency, and theme preferences.
 */
export const profilesTable = pgTable("profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  country: text("country").notNull(),
  preferredCurrency: text("preferred_currency").notNull().default("UGX"),
  theme: text("theme").notNull().default("system"),
  ...timestamps,
});

/**
 * ------------------------------------------------------------------------------
 * 3. ACCOUNTS TABLE
 * ------------------------------------------------------------------------------
 * Represents financial containers (Mobile Money wallets, Banks, Cash, SACCOs).
 * - Live balance = openingBalance + SUM(credits) - SUM(debits) from `ledger_entries`.
 */
export const accountsTable = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(), // e.g., "MTN MoMo", "Stanbic Bank"
  type: text("type").notNull(), // e.g., 'mobile_money', 'bank', 'cash', 'sacco'
  currency: text("currency").notNull().default("UGX"),
  openingBalance: numeric("opening_balance", { precision: 18, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

/**
 * ------------------------------------------------------------------------------
 * 4. CATEGORIES TABLE
 * ------------------------------------------------------------------------------
 * Classifications for transactions (Income & Expenses).
 * Global defaults have `isDefault: true`, while users can create custom ones.
 */
export const categoriesTable = pgTable("categories", {
  id: text("id").primaryKey(),
  userId: text("user_id"), // null for global default categories
  name: text("name").notNull(),
  type: text("type").notNull(), // 'income' | 'expense'
  icon: text("icon").notNull().default("circle"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * ------------------------------------------------------------------------------
 * 5. TRANSACTIONS TABLE
 * ------------------------------------------------------------------------------
 * Financial events (income or expense) logged by the user.
 */
export const transactionsTable = pgTable("transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  accountId: text("account_id").notNull(),
  categoryId: text("category_id").notNull(),
  type: text("type").notNull(), // 'income' | 'expense'
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  feeAmount: numeric("fee_amount", { precision: 18, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("UGX"),
  description: text("description").notNull(),
  notes: text("notes"),
  transactionDate: date("transaction_date", { mode: "string" }).notNull(),
  ...timestamps,
});

/**
 * ------------------------------------------------------------------------------
 * 6. LEDGER ENTRIES TABLE (DOUBLE-ENTRY ACCOUNTING)
 * ------------------------------------------------------------------------------
 * Immutable debit and credit entries that guarantee balance integrity.
 * - 'credit': Increases account balance (e.g. income received, loan repayment received)
 * - 'debit': Decreases account balance (e.g. expense paid, loan disbursed, fee deducted)
 */
export const ledgerEntriesTable = pgTable("ledger_entries", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  transactionId: text("transaction_id"),
  accountId: text("account_id").notNull(),
  amount: integer("amount").notNull(),
  direction: text("direction").notNull(), // 'debit' | 'credit'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * ------------------------------------------------------------------------------
 * 7. BUDGETS TABLE
 * ------------------------------------------------------------------------------
 * Monthly spending targets linked to specific expense categories.
 */
export const budgetsTable = pgTable("budgets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  categoryId: text("category_id").notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("UGX"),
  period: text("period").notNull().default("monthly"),
  startDate: date("start_date", { mode: "string" }),
  endDate: date("end_date", { mode: "string" }),
  ...timestamps,
});

/**
 * ------------------------------------------------------------------------------
 * 8. FINANCIAL GOALS TABLE
 * ------------------------------------------------------------------------------
 * Long-term targets (e.g. Emergency Reserve, Land Deposit, Vehicle Fund).
 */
export const financialGoalsTable = pgTable("financial_goals", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  targetAmount: numeric("target_amount", { precision: 18, scale: 2 }).notNull(),
  currentAmount: numeric("current_amount", { precision: 18, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("UGX"),
  targetDate: date("target_date", { mode: "string" }).notNull(),
  status: text("status").notNull().default("active"), // 'active' | 'completed' | 'paused'
  ...timestamps,
});

/**
 * ------------------------------------------------------------------------------
 * 9. DEBTS TABLE (DEBTS & OWED MODULE)
 * ------------------------------------------------------------------------------
 * Tracks obligations between the user and third parties.
 * - 'owed_to_you': Peer lending (Asset)
 * - 'you_owe': Borrowing / SACCO credit (Liability)
 */
export const debtsTable = pgTable("debts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  personOrEntity: text("person_or_entity").notNull(), // Counterparty name
  type: text("type").notNull(), // 'owed_to_you' | 'you_owe'
  principalAmount: integer("principal_amount").notNull(),
  remainingAmount: integer("remaining_amount").notNull(),
  currency: text("currency").notNull().default("UGX"),
  dueDate: date("due_date", { mode: "string" }),
  status: text("status").notNull().default("active"), // 'active' | 'settled'
  notes: text("notes"),
  ...timestamps,
});

/**
 * ------------------------------------------------------------------------------
 * 10. DEBT PAYMENTS TABLE
 * ------------------------------------------------------------------------------
 * Individual repayment installments logged against a specific debt.
 */
export const debtPaymentsTable = pgTable("debt_payments", {
  id: text("id").primaryKey(),
  debtId: text("debt_id").notNull(),
  amount: integer("amount").notNull(),
  accountId: text("account_id"), // Wallet/bank used for this repayment
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * ------------------------------------------------------------------------------
 * 11. AI CONVERSATIONS & MESSAGES TABLES
 * ------------------------------------------------------------------------------
 * History of consultations with Tereka AI.
 */
export const aiConversationsTable = pgTable("ai_conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  ...timestamps,
});

export const aiMessagesTable = pgTable("ai_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  userId: text("user_id"),
  role: text("role").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * ------------------------------------------------------------------------------
 * 12. CAMPAIGNS TABLE (COMMUNITY & EVENT FUNDRAISING)
 * ------------------------------------------------------------------------------
 * Handles event fundraising (Kwanjula, Wedding, Mabugo / Funerals, Medical, etc.).
 * Includes event image support (`imageUrl`), destination wallet, target progress,
 * and public shareable slug.
 */
export const campaignsTable = pgTable("campaigns", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull().default("general"), // 'kwanjula' | 'wedding' | 'mabugo' | 'medical' | 'graduation' | 'general'
  targetAmount: integer("target_amount").notNull(),
  currency: text("currency").notNull().default("UGX"),
  deadline: date("deadline", { mode: "string" }),
  accountId: text("account_id"), // Linked wallet/bank for funds (e.g. MTN MoMo, Airtel Money)
  imageUrl: text("image_url"), // Event flyer, banner, or image URL
  status: text("status").notNull().default("active"), // 'active' | 'completed' | 'paused'
  ...timestamps,
});

/**
 * ------------------------------------------------------------------------------
 * 13. CAMPAIGN CONTRIBUTIONS TABLE
 * ------------------------------------------------------------------------------
 * Real-time community contributions with contributor name, phone, payment method,
 * and supportive messages.
 */
export const campaignContributionsTable = pgTable("campaign_contributions", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull(),
  contributorName: text("contributor_name").notNull(),
  contributorPhone: text("contributor_phone"),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("UGX"),
  paymentMethod: text("payment_method").notNull().default("mtn_momo"), // 'mtn_momo' | 'airtel_money' | 'bank_transfer' | 'cash'
  reference: text("reference"),
  message: text("message"),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * ------------------------------------------------------------------------------
 * 14. ZOD INSERT SCHEMAS & TYPES
 * ------------------------------------------------------------------------------
 * Generated Drizzle-Zod schemas for runtime schema validation and TypeScript inference.
 */
export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true, updatedAt: true });
export const insertProfileSchema = createInsertSchema(profilesTable).omit({ createdAt: true, updatedAt: true });
export const insertAccountSchema = createInsertSchema(accountsTable).omit({ createdAt: true, updatedAt: true });
export const insertCategorySchema = createInsertSchema(categoriesTable).omit({ createdAt: true });
export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ createdAt: true, updatedAt: true });
export const insertLedgerEntrySchema = createInsertSchema(ledgerEntriesTable).omit({ createdAt: true });
export const insertBudgetSchema = createInsertSchema(budgetsTable).omit({ createdAt: true, updatedAt: true });
export const insertGoalSchema = createInsertSchema(financialGoalsTable).omit({ createdAt: true, updatedAt: true });
export const insertDebtSchema = createInsertSchema(debtsTable).omit({ createdAt: true, updatedAt: true });
export const insertDebtPaymentSchema = createInsertSchema(debtPaymentsTable).omit({ createdAt: true });
export const insertConversationSchema = createInsertSchema(aiConversationsTable).omit({ createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(aiMessagesTable).omit({ createdAt: true });
export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({ createdAt: true, updatedAt: true });
export const insertCampaignContributionSchema = createInsertSchema(campaignContributionsTable).omit({ createdAt: true });

export type User = z.infer<typeof insertUserSchema>;
export type Profile = z.infer<typeof insertProfileSchema>;
export type Account = z.infer<typeof insertAccountSchema>;
export type Category = z.infer<typeof insertCategorySchema>;
export type Transaction = z.infer<typeof insertTransactionSchema>;
export type LedgerEntry = z.infer<typeof insertLedgerEntrySchema>;
export type Budget = z.infer<typeof insertBudgetSchema>;
export type FinancialGoal = z.infer<typeof insertGoalSchema>;
export type Debt = z.infer<typeof insertDebtSchema>;
export type DebtPayment = z.infer<typeof insertDebtPaymentSchema>;
export type Conversation = z.infer<typeof insertConversationSchema>;
export type Message = z.infer<typeof insertMessageSchema>;
export type Campaign = z.infer<typeof insertCampaignSchema>;
export type CampaignContribution = z.infer<typeof insertCampaignContributionSchema>;