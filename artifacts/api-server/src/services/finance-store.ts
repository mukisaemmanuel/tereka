import { randomUUID } from "node:crypto";
import { hashPassword } from "../lib/auth";

// 1. Strict types
export type CurrencyCode = "UGX" | "KES" | "TZS" | "RWF" | "USD";
export type Currency = CurrencyCode; // Backward compatibility alias

export type AccountCategory = "mobile_money" | "bank" | "cash" | "sacco";
export type AccountType = AccountCategory | "savings" | "other"; // Backward compatibility alias

export type TransactionType = "income" | "expense";
export type LedgerDirection = "debit" | "credit";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  baseCurrency: CurrencyCode;
  createdAt: string;
}

export interface Category {
  id: string;
  userId?: string;
  name: string;
  type: TransactionType;
  icon: string;
  isDefault: boolean;
}

// 2. Double-entry structures: Account without stored mutable balance
export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountCategory;
  category: AccountCategory;
  currency: CurrencyCode;
  openingBalance: number;
  isActive: boolean;
}

export interface LedgerEntry {
  id: string;
  userId: string;
  transactionId: string;
  accountId: string;
  amount: number; // Integer representation in currency units
  direction: LedgerDirection;
}

// Transaction containing an array of LedgerEntry items and a dedicated feeAmount field
export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  feeAmount: number;
  currency: CurrencyCode;
  accountId: string;
  accountName: string;
  categoryId: string;
  categoryName: string;
  description: string;
  notes: string | null;
  transactionDate: string;
  entries: LedgerEntry[];
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  spent: number;
  currency: CurrencyCode;
  period: "monthly";
  percentageUsed: number;
  status: "on_track" | "warning" | "exceeded";
}

export interface FinancialGoal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: CurrencyCode;
  targetDate: string;
  status: "active" | "completed" | "paused";
  percentageComplete: number;
  remainingAmount: number;
}

export interface FinancialInsight {
  id: string;
  userId: string;
  title: string;
  body: string;
  tone: "positive" | "neutral" | "attention";
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  userId: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface Profile {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  country: string;
  preferredCurrency: CurrencyCode;
  theme: "light" | "dark" | "system";
}

// In-memory data store
export const users: User[] = [];
export const accounts: Account[] = [];
export const ledgerEntries: LedgerEntry[] = [];
export const transactions: Transaction[] = [];
export const budgets: Array<Omit<Budget, "categoryName" | "spent" | "percentageUsed" | "status">> = [];
export const goals: FinancialGoal[] = [];
export const conversations: Conversation[] = [];
export const messages: Message[] = [];
export const profiles: Profile[] = [];
export const categories: Category[] = [];

// Global categories
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

const defaultCategories: Category[] = [
  { id: defaultCategoryIds.salary, name: "Salary & Income", type: "income", icon: "briefcase", isDefault: true },
  { id: defaultCategoryIds.utilities, name: "Utilities & Yaka", type: "expense", icon: "zap", isDefault: true },
  { id: defaultCategoryIds.transport, name: "Transport & Boda", type: "expense", icon: "car", isDefault: true },
  { id: defaultCategoryIds.food, name: "Food & Groceries", type: "expense", icon: "utensils", isDefault: true },
  { id: defaultCategoryIds.fees, name: "Bank & MoMo Fees", type: "expense", icon: "receipt", isDefault: true },
  { id: defaultCategoryIds.entertainment, name: "Entertainment", type: "expense", icon: "sparkles", isDefault: true },
  { id: defaultCategoryIds.shopping, name: "Shopping", type: "expense", icon: "shopping-bag", isDefault: true },
  { id: defaultCategoryIds.education, name: "Education", type: "expense", icon: "book-open", isDefault: true },
];

categories.push(...defaultCategories);

const nowIso = () => new Date().toISOString();

// Helper to build ledger entries
function buildLedgerEntries(tx: {
  id: string;
  userId: string;
  accountId: string;
  type: TransactionType;
  amount: number;
  feeAmount: number;
}): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  const roundedAmount = Math.round(tx.amount);
  const roundedFee = Math.round(tx.feeAmount || 0);

  if (tx.type === "income") {
    entries.push({
      id: `led-${randomUUID()}`,
      userId: tx.userId,
      transactionId: tx.id,
      accountId: tx.accountId,
      amount: roundedAmount,
      direction: "credit",
    });
    if (roundedFee > 0) {
      entries.push({
        id: `led-${randomUUID()}-fee`,
        userId: tx.userId,
        transactionId: tx.id,
        accountId: tx.accountId,
        amount: roundedFee,
        direction: "debit",
      });
    }
  } else {
    entries.push({
      id: `led-${randomUUID()}`,
      userId: tx.userId,
      transactionId: tx.id,
      accountId: tx.accountId,
      amount: roundedAmount,
      direction: "debit",
    });
    if (roundedFee > 0) {
      entries.push({
        id: `led-${randomUUID()}-fee`,
        userId: tx.userId,
        transactionId: tx.id,
        accountId: tx.accountId,
        amount: roundedFee,
        direction: "debit",
      });
    }
  }

  return entries;
}

// Helper to seed a transaction
function seedTransaction(tx: {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  feeAmount?: number;
  currency: CurrencyCode;
  accountId: string;
  accountName: string;
  categoryId: string;
  categoryName: string;
  description: string;
  notes: string | null;
  transactionDate: string;
}) {
  const feeAmount = tx.feeAmount ?? 0;
  const entries = buildLedgerEntries({
    id: tx.id,
    userId: tx.userId,
    accountId: tx.accountId,
    type: tx.type,
    amount: tx.amount,
    feeAmount,
  });

  ledgerEntries.push(...entries);
  transactions.push({
    ...tx,
    feeAmount,
    entries,
  });
}

// -------------------------------------------------------------
// Initialize Default Demo User and Mock Financial Intelligence
// -------------------------------------------------------------
export const DEMO_USER_ID = "user-demo-mukisa";

const demoUser: User = {
  id: DEMO_USER_ID,
  name: "Emmanuel Mukisa",
  email: "mukisa@example.com",
  passwordHash: hashPassword("password123"),
  baseCurrency: "UGX",
  createdAt: "2026-08-01T00:00:00.000Z",
};
users.push(demoUser);

profiles.push({
  id: "profile-demo-mukisa",
  userId: DEMO_USER_ID,
  fullName: "Emmanuel Mukisa",
  email: "mukisa@example.com",
  country: "Uganda",
  preferredCurrency: "UGX",
  theme: "light",
});

export const demoAccountIds = {
  momo: "account-mtn-momo",
  mpesa: "account-safaricom-mpesa",
  stanbic: "account-stanbic-ug",
  cash: "account-physical-cash",
};

accounts.push(
  {
    id: demoAccountIds.momo,
    userId: DEMO_USER_ID,
    name: "MTN MoMo",
    type: "mobile_money",
    category: "mobile_money",
    currency: "UGX",
    openingBalance: 1450000,
    isActive: true,
  },
  {
    id: demoAccountIds.mpesa,
    userId: DEMO_USER_ID,
    name: "Safaricom M-Pesa",
    type: "mobile_money",
    category: "mobile_money",
    currency: "KES",
    openingBalance: 24500,
    isActive: true,
  },
  {
    id: demoAccountIds.stanbic,
    userId: DEMO_USER_ID,
    name: "Stanbic Bank Uganda",
    type: "bank",
    category: "bank",
    currency: "UGX",
    openingBalance: 5200000,
    isActive: true,
  },
  {
    id: demoAccountIds.cash,
    userId: DEMO_USER_ID,
    name: "Physical Cash",
    type: "cash",
    category: "cash",
    currency: "UGX",
    openingBalance: 180000,
    isActive: true,
  },
);

seedTransaction({
  id: "tx-yaka-power",
  userId: DEMO_USER_ID,
  type: "expense",
  amount: 65000,
  feeAmount: 1200,
  currency: "UGX",
  accountId: demoAccountIds.momo,
  accountName: "MTN MoMo",
  categoryId: defaultCategoryIds.utilities,
  categoryName: "Utilities & Yaka",
  description: "Yaka Prepaid Electricity Token (Umeme)",
  notes: "Token Ref: 4829-1029-4820 with MoMo utility convenience fee",
  transactionDate: "2026-08-28",
});

seedTransaction({
  id: "tx-boda-fuel",
  userId: DEMO_USER_ID,
  type: "expense",
  amount: 35000,
  feeAmount: 0,
  currency: "UGX",
  accountId: demoAccountIds.cash,
  accountName: "Physical Cash",
  categoryId: defaultCategoryIds.transport,
  categoryName: "Transport & Boda",
  description: "Boda fuel & Shell refill",
  notes: "Kampala commute fuel top-up",
  transactionDate: "2026-08-27",
});

seedTransaction({
  id: "tx-momo-cashout",
  userId: DEMO_USER_ID,
  type: "expense",
  amount: 150000,
  feeAmount: 2850,
  currency: "UGX",
  accountId: demoAccountIds.momo,
  accountName: "MTN MoMo",
  categoryId: defaultCategoryIds.fees,
  categoryName: "Bank & MoMo Fees",
  description: "MoMo Cash Out & Agent Withdrawal",
  notes: "Agent fee UGX 2,850 deducted",
  transactionDate: "2026-08-25",
});

seedTransaction({
  id: "tx-aug-salary",
  userId: DEMO_USER_ID,
  type: "income",
  amount: 6800000,
  feeAmount: 0,
  currency: "UGX",
  accountId: demoAccountIds.stanbic,
  accountName: "Stanbic Bank Uganda",
  categoryId: defaultCategoryIds.salary,
  categoryName: "Salary & Income",
  description: "Monthly Consulting Salary",
  notes: "Direct EFT transfer from client",
  transactionDate: "2026-08-24",
});

seedTransaction({
  id: "tx-safari-groceries",
  userId: DEMO_USER_ID,
  type: "expense",
  amount: 4500,
  feeAmount: 35,
  currency: "KES",
  accountId: demoAccountIds.mpesa,
  accountName: "Safaricom M-Pesa",
  categoryId: defaultCategoryIds.food,
  categoryName: "Food & Groceries",
  description: "Naivas Supermarket via Buy Goods",
  notes: "M-Pesa till payment",
  transactionDate: "2026-08-22",
});

seedTransaction({
  id: "tx-stanbic-rent",
  userId: DEMO_USER_ID,
  type: "expense",
  amount: 1600000,
  feeAmount: 2500,
  currency: "UGX",
  accountId: demoAccountIds.stanbic,
  accountName: "Stanbic Bank Uganda",
  categoryId: defaultCategoryIds.utilities,
  categoryName: "Utilities & Yaka",
  description: "Apartment Rent & Service Fee",
  notes: "Bank transfer to landlord",
  transactionDate: "2026-08-02",
});

budgets.push(
  { id: "budget-utilities", userId: DEMO_USER_ID, categoryId: defaultCategoryIds.utilities, amount: 250000, currency: "UGX", period: "monthly" },
  { id: "budget-transport", userId: DEMO_USER_ID, categoryId: defaultCategoryIds.transport, amount: 300000, currency: "UGX", period: "monthly" },
  { id: "budget-food", userId: DEMO_USER_ID, categoryId: defaultCategoryIds.food, amount: 650000, currency: "UGX", period: "monthly" },
  { id: "budget-fees", userId: DEMO_USER_ID, categoryId: defaultCategoryIds.fees, amount: 50000, currency: "UGX", period: "monthly" },
);

goals.push(
  {
    id: "goal-emergency",
    userId: DEMO_USER_ID,
    name: "Emergency Reserve Fund",
    targetAmount: 12000000,
    currentAmount: 7350000,
    currency: "UGX",
    targetDate: "2027-01-31",
    status: "active",
    percentageComplete: 61.25,
    remainingAmount: 4650000,
  },
  {
    id: "goal-laptop",
    userId: DEMO_USER_ID,
    name: "MacBook Pro Setup",
    targetAmount: 5000000,
    currentAmount: 3250000,
    currency: "UGX",
    targetDate: "2026-11-30",
    status: "active",
    percentageComplete: 65,
    remainingAmount: 1750000,
  },
);

conversations.push({
  id: "conversation-welcome",
  userId: DEMO_USER_ID,
  title: "East Africa Financial Intelligence",
  createdAt: "2026-08-01T08:00:00.000Z",
  updatedAt: "2026-08-28T14:20:00.000Z",
});

messages.push({
  id: "message-welcome",
  userId: DEMO_USER_ID,
  conversationId: "conversation-welcome",
  role: "assistant",
  content: "Welcome to Tereka. I can help track your MTN MoMo, M-Pesa, Stanbic, and cash flows, monitor Yaka consumption, and optimize mobile money fees.",
  createdAt: "2026-08-01T08:00:00.000Z",
});

// -------------------------------------------------------------
// User Management & Starter Data Seeding
// -------------------------------------------------------------

export function findUserByEmail(email: string): User | undefined {
  return users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
}

export function findUserById(id: string): User | undefined {
  return users.find((u) => u.id === id);
}

export function seedStarterDataForUser(user: User): void {
  const currency = user.baseCurrency || "UGX";

  // Starter profile
  profiles.push({
    id: `profile-${user.id}`,
    userId: user.id,
    fullName: user.name,
    email: user.email,
    country: currency === "KES" ? "Kenya" : currency === "TZS" ? "Tanzania" : currency === "RWF" ? "Rwanda" : "Uganda",
    preferredCurrency: currency,
    theme: "light",
  });

  // Starter accounts: Physical Cash and Mobile Money / Bank
  const cashAccount: Account = {
    id: `account-cash-${user.id}`,
    userId: user.id,
    name: "Physical Cash",
    type: "cash",
    category: "cash",
    currency,
    openingBalance: 50000,
    isActive: true,
  };

  const mobileMoneyName = currency === "KES" ? "Safaricom M-Pesa" : currency === "TZS" ? "Vodacom M-Pesa" : currency === "RWF" ? "MTN MoMo Rwanda" : "MTN MoMo";
  const momoAccount: Account = {
    id: `account-momo-${user.id}`,
    userId: user.id,
    name: mobileMoneyName,
    type: "mobile_money",
    category: "mobile_money",
    currency,
    openingBalance: 200000,
    isActive: true,
  };

  accounts.push(cashAccount, momoAccount);

  // Starter Budgets
  budgets.push(
    { id: `budget-food-${user.id}`, userId: user.id, categoryId: defaultCategoryIds.food, amount: currency === "USD" ? 200 : 300000, currency, period: "monthly" },
    { id: `budget-transport-${user.id}`, userId: user.id, categoryId: defaultCategoryIds.transport, amount: currency === "USD" ? 100 : 150000, currency, period: "monthly" },
    { id: `budget-utilities-${user.id}`, userId: user.id, categoryId: defaultCategoryIds.utilities, amount: currency === "USD" ? 80 : 100000, currency, period: "monthly" },
  );

  // Starter Goal
  goals.push({
    id: `goal-emergency-${user.id}`,
    userId: user.id,
    name: "Emergency Reserve Fund",
    targetAmount: currency === "USD" ? 1000 : 2000000,
    currentAmount: currency === "USD" ? 250 : 250000,
    currency,
    targetDate: "2027-06-30",
    status: "active",
    percentageComplete: 12.5,
    remainingAmount: currency === "USD" ? 750 : 1750000,
  });

  // Starter Welcome Conversation
  const conversationId = `conversation-${user.id}`;
  conversations.push({
    id: conversationId,
    userId: user.id,
    title: "Welcome to Tereka",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  messages.push({
    id: `msg-${randomUUID()}`,
    userId: user.id,
    conversationId,
    role: "assistant",
    content: `Hello ${user.name}! Welcome to Tereka Financial Intelligence. Your starter accounts (${cashAccount.name} and ${momoAccount.name}) in ${currency} are ready. You can log expenses, track budgets, and chat with me anytime for cashflow insights.`,
    createdAt: nowIso(),
  });
}

export function createUser(input: {
  name: string;
  email: string;
  passwordHash: string;
  baseCurrency?: CurrencyCode;
}): User {
  const user: User = {
    id: `user-${randomUUID()}`,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    passwordHash: input.passwordHash,
    baseCurrency: input.baseCurrency || "UGX",
    createdAt: nowIso(),
  };

  users.push(user);
  seedStarterDataForUser(user);
  return user;
}

// -------------------------------------------------------------
// Scoped Data Queries and Mutations
// -------------------------------------------------------------

export function getAccountBalance(userId: string, accountId: string): number {
  const account = accounts.find((a) => a.id === accountId && a.userId === userId);
  const opening = account ? account.openingBalance : 0;

  const entries = ledgerEntries.filter((entry) => entry.accountId === accountId && entry.userId === userId);
  const netFromLedger = entries.reduce((sum, entry) => {
    if (entry.direction === "credit") {
      return sum + entry.amount;
    } else {
      return sum - entry.amount;
    }
  }, 0);

  return opening + netFromLedger;
}

export function categoryById(userId: string, id: string) {
  return categories.find((category) => category.id === id && (category.userId === undefined || category.userId === userId));
}

export function accountById(userId: string, id: string) {
  return accounts.find((account) => account.id === id && account.userId === userId);
}

function withBudgetStatus(userId: string, budget: (typeof budgets)[number]): Budget {
  const category = categoryById(userId, budget.categoryId);
  const userTransactions = transactions.filter((t) => t.userId === userId);
  const spent = userTransactions
    .filter((transaction) => transaction.type === "expense" && transaction.categoryId === budget.categoryId)
    .reduce((sum, transaction) => sum + transaction.amount + (transaction.feeAmount || 0), 0);
  const percentageUsed = budget.amount ? Math.round((spent / budget.amount) * 1000) / 10 : 0;
  const status = percentageUsed >= 100 ? "exceeded" : percentageUsed >= 75 ? "warning" : "on_track";
  return { ...budget, categoryName: category?.name ?? "Other", spent, percentageUsed, status };
}

export function listCategories(userId: string, type?: TransactionType) {
  const userCats = categories.filter((category) => category.userId === undefined || category.userId === userId);
  return type ? userCats.filter((category) => category.type === type) : userCats;
}

export function createCategory(userId: string, input: Omit<Category, "id" | "isDefault" | "userId">) {
  const category: Category = { ...input, id: `cat-${randomUUID()}`, userId, isDefault: false };
  categories.push(category);
  return category;
}

export function listAccounts(userId: string) {
  return accounts
    .filter((account) => account.userId === userId && account.isActive)
    .map((account) => ({
      ...account,
      balance: getAccountBalance(userId, account.id),
    }));
}

export function createAccount(userId: string, input: {
  name: string;
  type: string;
  currency: CurrencyCode;
  openingBalance: number;
  category?: AccountCategory;
}) {
  const category = (input.category ?? (["mobile_money", "bank", "cash", "sacco"].includes(input.type) ? input.type : "cash")) as AccountCategory;
  const account: Account = {
    id: `acc-${randomUUID()}`,
    userId,
    name: input.name,
    type: category,
    category,
    currency: input.currency,
    openingBalance: input.openingBalance,
    isActive: true,
  };
  accounts.push(account);
  return {
    ...account,
    balance: getAccountBalance(userId, account.id),
  };
}

export function updateAccount(userId: string, id: string, input: Partial<{
  name: string;
  type: string;
  category: AccountCategory;
  currency: CurrencyCode;
  openingBalance: number;
  isActive: boolean;
}>) {
  const account = accountById(userId, id);
  if (!account) return undefined;
  if (input.name !== undefined) account.name = input.name;
  if (input.currency !== undefined) account.currency = input.currency;
  if (input.openingBalance !== undefined) account.openingBalance = input.openingBalance;
  if (input.isActive !== undefined) account.isActive = input.isActive;
  if (input.type !== undefined) {
    account.type = (["mobile_money", "bank", "cash", "sacco"].includes(input.type) ? input.type : account.type) as AccountCategory;
    account.category = account.type;
  }
  if (input.category !== undefined) {
    account.category = input.category;
    account.type = input.category;
  }
  return {
    ...account,
    balance: getAccountBalance(userId, account.id),
  };
}

export function archiveAccount(userId: string, id: string) {
  return updateAccount(userId, id, { isActive: false });
}

export function listTransactions(userId: string, filters?: { search?: string; type?: TransactionType; categoryId?: string }) {
  const search = filters?.search?.toLowerCase();
  return transactions
    .filter((transaction) => transaction.userId === userId)
    .filter((transaction) => !filters?.type || transaction.type === filters.type)
    .filter((transaction) => !filters?.categoryId || transaction.categoryId === filters.categoryId)
    .filter((transaction) => !search || [transaction.description, transaction.categoryName, transaction.accountName].some((value) => value.toLowerCase().includes(search)))
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
}

export function createTransaction(userId: string, input: Omit<Transaction, "id" | "accountName" | "categoryName" | "entries" | "feeAmount" | "userId"> & { feeAmount?: number }) {
  const account = accountById(userId, input.accountId);
  const category = categoryById(userId, input.categoryId);
  const id = `tx-${randomUUID()}`;
  const feeAmount = input.feeAmount ?? 0;

  const entries = buildLedgerEntries({
    id,
    userId,
    accountId: input.accountId,
    type: input.type,
    amount: input.amount,
    feeAmount,
  });

  ledgerEntries.push(...entries);

  const transaction: Transaction = {
    ...input,
    id,
    userId,
    feeAmount,
    accountName: account?.name ?? "Unknown account",
    categoryName: category?.name ?? "Other",
    entries,
  };

  transactions.push(transaction);
  return transaction;
}

export function updateTransaction(userId: string, id: string, input: Partial<Omit<Transaction, "id" | "accountName" | "categoryName" | "entries" | "userId">>) {
  const transaction = transactions.find((item) => item.id === id && item.userId === userId);
  if (!transaction) return undefined;

  Object.assign(transaction, input);
  const account = accountById(userId, transaction.accountId);
  const category = categoryById(userId, transaction.categoryId);
  transaction.accountName = account?.name ?? transaction.accountName;
  transaction.categoryName = category?.name ?? transaction.categoryName;

  // Re-generate ledger entries
  const oldEntryIndices: number[] = [];
  ledgerEntries.forEach((entry, idx) => {
    if (entry.transactionId === id && entry.userId === userId) oldEntryIndices.push(idx);
  });
  for (let i = oldEntryIndices.length - 1; i >= 0; i--) {
    ledgerEntries.splice(oldEntryIndices[i], 1);
  }

  const newEntries = buildLedgerEntries({
    id: transaction.id,
    userId,
    accountId: transaction.accountId,
    type: transaction.type,
    amount: transaction.amount,
    feeAmount: transaction.feeAmount ?? 0,
  });
  ledgerEntries.push(...newEntries);
  transaction.entries = newEntries;

  return transaction;
}

export function deleteTransaction(userId: string, id: string) {
  const index = transactions.findIndex((transaction) => transaction.id === id && transaction.userId === userId);
  if (index === -1) return false;
  transactions.splice(index, 1);

  const remainingLedger = ledgerEntries.filter((entry) => !(entry.transactionId === id && entry.userId === userId));
  ledgerEntries.length = 0;
  ledgerEntries.push(...remainingLedger);

  return true;
}

export function listBudgets(userId: string) {
  return budgets
    .filter((b) => b.userId === userId)
    .map((budget) => withBudgetStatus(userId, budget));
}

export function createBudget(userId: string, input: Omit<(typeof budgets)[number], "id" | "userId">) {
  const budget = { ...input, id: `budget-${randomUUID()}`, userId };
  budgets.push(budget);
  return withBudgetStatus(userId, budget);
}

export function updateBudget(userId: string, id: string, input: Partial<Omit<(typeof budgets)[number], "id" | "userId">>) {
  const budget = budgets.find((item) => item.id === id && item.userId === userId);
  if (!budget) return undefined;
  Object.assign(budget, input);
  return withBudgetStatus(userId, budget);
}

export function deleteBudget(userId: string, id: string) {
  const index = budgets.findIndex((budget) => budget.id === id && budget.userId === userId);
  if (index === -1) return false;
  budgets.splice(index, 1);
  return true;
}

export function listGoals(userId: string) {
  return goals.filter((g) => g.userId === userId);
}

export function createGoal(userId: string, input: Omit<FinancialGoal, "id" | "percentageComplete" | "remainingAmount" | "userId">) {
  const goal: FinancialGoal = {
    ...input,
    id: `goal-${randomUUID()}`,
    userId,
    percentageComplete: Math.min(100, Math.round((input.currentAmount / input.targetAmount) * 1000) / 10),
    remainingAmount: Math.max(0, input.targetAmount - input.currentAmount),
  };
  goals.push(goal);
  return goal;
}

export function updateGoal(userId: string, id: string, input: Partial<Omit<FinancialGoal, "id" | "percentageComplete" | "remainingAmount" | "userId">>) {
  const goal = goals.find((item) => item.id === id && item.userId === userId);
  if (!goal) return undefined;
  Object.assign(goal, input);
  goal.percentageComplete = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 1000) / 10);
  goal.remainingAmount = Math.max(0, goal.targetAmount - goal.currentAmount);
  return goal;
}

export function deleteGoal(userId: string, id: string) {
  const index = goals.findIndex((goal) => goal.id === id && goal.userId === userId);
  if (index === -1) return false;
  goals.splice(index, 1);
  return true;
}

export const FX_RATES_TO_UGX: Record<CurrencyCode, number> = {
  UGX: 1,
  KES: 28.5,
  USD: 3700,
  TZS: 1.4,
  RWF: 2.8,
};

export function calculateNetWorth(userId: string, baseCurrency: CurrencyCode = "UGX"): number {
  const userAccounts = accounts.filter((a) => a.userId === userId && a.isActive);
  const baseRateToUGX = FX_RATES_TO_UGX[baseCurrency] ?? 1;

  const totalInUGX = userAccounts.reduce((sum, account) => {
    const balance = getAccountBalance(userId, account.id);
    const rateToUGX = FX_RATES_TO_UGX[account.currency] ?? 1;
    return sum + balance * rateToUGX;
  }, 0);

  return Math.round(totalInUGX / baseRateToUGX);
}

export function getDashboardSummary(userId: string) {
  const user = findUserById(userId);
  const currency: CurrencyCode = user?.baseCurrency || "UGX";
  const userTransactions = transactions.filter((transaction) => transaction.userId === userId);
  const userAccounts = accounts.filter((a) => a.userId === userId && a.isActive);

  const monthlyIncome = userTransactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const monthlyExpenses = userTransactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + transaction.amount + (transaction.feeAmount || 0), 0);

  const totalFeesPaid = userTransactions.reduce((sum, transaction) => sum + (transaction.feeAmount || 0), 0);
  const totalNetWorth = calculateNetWorth(userId, currency);

  const categoryTotals = new Map<string, number>();
  for (const transaction of userTransactions.filter((item) => item.type === "expense")) {
    const total = transaction.amount + (transaction.feeAmount || 0);
    categoryTotals.set(transaction.categoryName, (categoryTotals.get(transaction.categoryName) ?? 0) + total);
  }

  const categoryEntries = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]);
  const palette = ["#0f766e", "#2563eb", "#d97706", "#7c3aed", "#db2777", "#0891b2"];
  const totalCategorySpend = categoryEntries.reduce((sum, [, amount]) => sum + amount, 0);
  const budgetStatus = listBudgets(userId);

  // Sum balances of all base currency accounts
  const totalBalance = userAccounts
    .filter((a) => a.currency === currency)
    .reduce((sum, account) => sum + Math.round(getAccountBalance(userId, account.id)), 0);

  return {
    currency,
    totalBalance,
    totalNetWorth,
    totalFeesPaid,
    monthlyIncome,
    monthlyExpenses,
    remainingBudget: budgetStatus.reduce((sum, budget) => sum + Math.max(0, budget.amount - budget.spent), 0),
    balanceChange: monthlyIncome - monthlyExpenses,
    spendingByCategory: categoryEntries.map(([categoryName, amount], index) => ({
      categoryName,
      amount,
      percentage: totalCategorySpend ? Math.round((amount / totalCategorySpend) * 1000) / 10 : 0,
      color: palette[index % palette.length],
    })),
    incomeVsExpenses: [
      { month: "May", income: Math.round(monthlyIncome * 0.9), expenses: Math.round(monthlyExpenses * 0.85) },
      { month: "Jun", income: Math.round(monthlyIncome * 0.95), expenses: Math.round(monthlyExpenses * 0.9) },
      { month: "Jul", income: Math.round(monthlyIncome * 0.98), expenses: Math.round(monthlyExpenses * 0.95) },
      { month: "Aug", income: monthlyIncome, expenses: monthlyExpenses },
    ],
    recentTransactions: listTransactions(userId).slice(0, 6),
    budgetStatus,
    goalProgress: listGoals(userId),
  };
}

export function listInsights(userId: string): FinancialInsight[] {
  const userBudgets = listBudgets(userId);
  const userGoals = listGoals(userId);

  const insights: FinancialInsight[] = [];
  if (userBudgets.length > 0) {
    const topBudget = userBudgets[0];
    insights.push({
      id: `insight-budget-${userId}`,
      userId,
      title: `${topBudget.categoryName} Budget Signal`,
      body: `You've used ${topBudget.percentageUsed}% of your ${topBudget.categoryName} budget this month.`,
      tone: topBudget.status === "warning" || topBudget.status === "exceeded" ? "attention" : "positive",
      createdAt: nowIso(),
    });
  }

  if (userGoals.length > 0) {
    const topGoal = userGoals[0];
    insights.push({
      id: `insight-goal-${userId}`,
      userId,
      title: `${topGoal.name} Momentum`,
      body: `You are ${topGoal.percentageComplete}% toward your ${topGoal.name} target.`,
      tone: "positive",
      createdAt: nowIso(),
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: `insight-welcome-${userId}`,
      userId,
      title: "Welcome to Financial Intelligence",
      body: "Add your everyday transactions and set monthly targets to get personalized cashflow signals.",
      tone: "positive",
      createdAt: nowIso(),
    });
  }

  return insights;
}

export function listConversations(userId: string) {
  return conversations.filter((c) => c.userId === userId);
}

export function createConversation(userId: string, title?: string) {
  const conversation: Conversation = {
    id: `conv-${randomUUID()}`,
    userId,
    title: title?.trim() || "New money conversation",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  conversations.unshift(conversation);
  return conversation;
}

export function listMessages(userId: string, conversationId: string) {
  return messages
    .filter((message) => message.conversationId === conversationId && message.userId === userId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function sendMessage(userId: string, conversationId: string, content: string) {
  const conversation = conversations.find((item) => item.id === conversationId && item.userId === userId);
  if (!conversation) return undefined;

  const userMessage: Message = { id: `msg-${randomUUID()}`, userId, conversationId, role: "user", content, createdAt: nowIso() };
  
  const userAccounts = listAccounts(userId);
  const accountNames = userAccounts.map((a) => a.name).join(", ") || "Physical Cash";
  
  const assistantMessage: Message = {
    id: `msg-${randomUUID()}`,
    userId,
    conversationId,
    role: "assistant",
    content: `Based on your double-entry ledger across ${accountNames}, your transactions and balances are being tracked cleanly. You can ask me about upcoming bills, budget usage, or how to reach your savings goals faster.`,
    createdAt: nowIso(),
  };

  messages.push(userMessage, assistantMessage);
  conversation.updatedAt = assistantMessage.createdAt;
  return [userMessage, assistantMessage];
}

export function getProfile(userId: string) {
  let profile = profiles.find((p) => p.userId === userId);
  if (!profile) {
    const user = findUserById(userId);
    profile = {
      id: `profile-${userId}`,
      userId,
      fullName: user?.name || "Tereka Member",
      email: user?.email || "user@example.com",
      country: "Uganda",
      preferredCurrency: user?.baseCurrency || "UGX",
      theme: "light",
    };
    profiles.push(profile);
  }
  return profile;
}

export function updateProfile(userId: string, input: Partial<Omit<Profile, "id" | "email">> & { email?: string }) {
  const profile = getProfile(userId);
  Object.assign(profile, input);
  if (input.preferredCurrency) {
    const user = findUserById(userId);
    if (user) user.baseCurrency = input.preferredCurrency;
  }
  return profile;
}