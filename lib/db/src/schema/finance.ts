import {
  boolean,
  date,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const profilesTable = pgTable("profiles", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  country: text("country").notNull(),
  preferredCurrency: text("preferred_currency").notNull().default("UGX"),
  theme: text("theme").notNull().default("system"),
  ...timestamps,
});

export const accountsTable = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  currency: text("currency").notNull(),
  openingBalance: numeric("opening_balance", { precision: 18, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const categoriesTable = pgTable("categories", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  icon: text("icon").notNull().default("circle"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamps.createdAt,
});

export const transactionsTable = pgTable("transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  accountId: text("account_id").notNull(),
  categoryId: text("category_id").notNull(),
  type: text("type").notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  description: text("description").notNull(),
  notes: text("notes"),
  transactionDate: date("transaction_date", { mode: "string" }).notNull(),
  ...timestamps,
});

export const budgetsTable = pgTable("budgets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  categoryId: text("category_id").notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  period: text("period").notNull().default("monthly"),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  ...timestamps,
});

export const financialGoalsTable = pgTable("financial_goals", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  targetAmount: numeric("target_amount", { precision: 18, scale: 2 }).notNull(),
  currentAmount: numeric("current_amount", { precision: 18, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  targetDate: date("target_date", { mode: "string" }).notNull(),
  status: text("status").notNull().default("active"),
  ...timestamps,
});

export const aiConversationsTable = pgTable("ai_conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  ...timestamps,
});

export const aiMessagesTable = pgTable("ai_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamps.createdAt,
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({ createdAt: true, updatedAt: true });
export const insertAccountSchema = createInsertSchema(accountsTable).omit({ createdAt: true, updatedAt: true });
export const insertCategorySchema = createInsertSchema(categoriesTable).omit({ createdAt: true });
export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ createdAt: true, updatedAt: true });
export const insertBudgetSchema = createInsertSchema(budgetsTable).omit({ createdAt: true, updatedAt: true });
export const insertGoalSchema = createInsertSchema(financialGoalsTable).omit({ createdAt: true, updatedAt: true });
export const insertConversationSchema = createInsertSchema(aiConversationsTable).omit({ createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(aiMessagesTable).omit({ createdAt: true });

export type Profile = z.infer<typeof insertProfileSchema>;
export type Account = z.infer<typeof insertAccountSchema>;
export type Category = z.infer<typeof insertCategorySchema>;
export type Transaction = z.infer<typeof insertTransactionSchema>;
export type Budget = z.infer<typeof insertBudgetSchema>;
export type FinancialGoal = z.infer<typeof insertGoalSchema>;
export type Conversation = z.infer<typeof insertConversationSchema>;
export type Message = z.infer<typeof insertMessageSchema>;