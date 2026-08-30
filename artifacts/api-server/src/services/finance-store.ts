import { randomUUID } from "node:crypto";

export type Currency = "UGX" | "KES" | "TZS" | "RWF" | "USD";
export type TransactionType = "income" | "expense";
export type AccountType = "cash" | "mobile_money" | "bank" | "savings" | "other";

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon: string;
  isDefault: boolean;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: Currency;
  openingBalance: number;
  balance: number;
  isActive: boolean;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: Currency;
  accountId: string;
  accountName: string;
  categoryId: string;
  categoryName: string;
  description: string;
  notes: string | null;
  transactionDate: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  spent: number;
  currency: Currency;
  period: "monthly";
  percentageUsed: number;
  status: "on_track" | "warning" | "exceeded";
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: Currency;
  targetDate: string;
  status: "active" | "completed" | "paused";
  percentageComplete: number;
  remainingAmount: number;
}

export interface FinancialInsight {
  id: string;
  title: string;
  body: string;
  tone: "positive" | "neutral" | "attention";
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  country: string;
  preferredCurrency: Currency;
  theme: "light" | "dark" | "system";
}

const accountIds = {
  momo: "account-mtn-momo",
  bank: "account-stanbic",
  cash: "account-cash",
};

const categoryIds = {
  salary: "category-salary",
  food: "category-food",
  transport: "category-transport",
  rent: "category-rent",
  utilities: "category-utilities",
  entertainment: "category-entertainment",
  shopping: "category-shopping",
  education: "category-education",
};

const categories: Category[] = [
  { id: categoryIds.salary, name: "Salary", type: "income", icon: "briefcase", isDefault: true },
  { id: categoryIds.food, name: "Food", type: "expense", icon: "utensils", isDefault: true },
  { id: categoryIds.transport, name: "Transport", type: "expense", icon: "car", isDefault: true },
  { id: categoryIds.rent, name: "Rent", type: "expense", icon: "home", isDefault: true },
  { id: categoryIds.utilities, name: "Utilities", type: "expense", icon: "zap", isDefault: true },
  { id: categoryIds.entertainment, name: "Entertainment", type: "expense", icon: "sparkles", isDefault: true },
  { id: categoryIds.shopping, name: "Shopping", type: "expense", icon: "shopping-bag", isDefault: true },
  { id: categoryIds.education, name: "Education", type: "expense", icon: "book-open", isDefault: true },
];

const accounts: Account[] = [
  { id: accountIds.momo, name: "MTN Mobile Money", type: "mobile_money", currency: "UGX", openingBalance: 1250000, balance: 0, isActive: true },
  { id: accountIds.bank, name: "Stanbic Everyday", type: "bank", currency: "UGX", openingBalance: 4820000, balance: 0, isActive: true },
  { id: accountIds.cash, name: "Cash wallet", type: "cash", currency: "UGX", openingBalance: 180000, balance: 0, isActive: true },
];

const transactions: Transaction[] = [
  { id: "tx-salary", type: "income", amount: 6800000, currency: "UGX", accountId: accountIds.bank, accountName: "Stanbic Everyday", categoryId: categoryIds.salary, categoryName: "Salary", description: "August salary", notes: "Monthly pay", transactionDate: "2026-08-25" },
  { id: "tx-rent", type: "expense", amount: 1600000, currency: "UGX", accountId: accountIds.bank, accountName: "Stanbic Everyday", categoryId: categoryIds.rent, categoryName: "Rent", description: "Apartment rent", notes: null, transactionDate: "2026-08-03" },
  { id: "tx-groceries", type: "expense", amount: 285000, currency: "UGX", accountId: accountIds.momo, accountName: "MTN Mobile Money", categoryId: categoryIds.food, categoryName: "Food", description: "Weekly groceries", notes: null, transactionDate: "2026-08-28" },
  { id: "tx-commute", type: "expense", amount: 92000, currency: "UGX", accountId: accountIds.momo, accountName: "MTN Mobile Money", categoryId: categoryIds.transport, categoryName: "Transport", description: "Ride-hailing and boda", notes: null, transactionDate: "2026-08-27" },
  { id: "tx-internet", type: "expense", amount: 145000, currency: "UGX", accountId: accountIds.momo, accountName: "MTN Mobile Money", categoryId: categoryIds.utilities, categoryName: "Utilities", description: "Home internet", notes: null, transactionDate: "2026-08-21" },
  { id: "tx-dinner", type: "expense", amount: 180000, currency: "UGX", accountId: accountIds.cash, accountName: "Cash wallet", categoryId: categoryIds.entertainment, categoryName: "Entertainment", description: "Dinner with friends", notes: null, transactionDate: "2026-08-17" },
  { id: "tx-course", type: "expense", amount: 420000, currency: "UGX", accountId: accountIds.bank, accountName: "Stanbic Everyday", categoryId: categoryIds.education, categoryName: "Education", description: "Product course", notes: "Investing in growth", transactionDate: "2026-08-12" },
  { id: "tx-june-salary", type: "income", amount: 6800000, currency: "UGX", accountId: accountIds.bank, accountName: "Stanbic Everyday", categoryId: categoryIds.salary, categoryName: "Salary", description: "July salary", notes: null, transactionDate: "2026-07-25" },
  { id: "tx-july-food", type: "expense", amount: 710000, currency: "UGX", accountId: accountIds.momo, accountName: "MTN Mobile Money", categoryId: categoryIds.food, categoryName: "Food", description: "Food and groceries", notes: null, transactionDate: "2026-07-16" },
];

const budgets: Array<Omit<Budget, "categoryName" | "spent" | "percentageUsed" | "status">> = [
  { id: "budget-food", categoryId: categoryIds.food, amount: 650000, currency: "UGX", period: "monthly" },
  { id: "budget-transport", categoryId: categoryIds.transport, amount: 320000, currency: "UGX", period: "monthly" },
  { id: "budget-entertainment", categoryId: categoryIds.entertainment, amount: 250000, currency: "UGX", period: "monthly" },
  { id: "budget-education", categoryId: categoryIds.education, amount: 500000, currency: "UGX", period: "monthly" },
];

const goals: FinancialGoal[] = [
  { id: "goal-emergency", name: "Emergency fund", targetAmount: 12000000, currentAmount: 7350000, currency: "UGX", targetDate: "2027-01-31", status: "active", percentageComplete: 61.25, remainingAmount: 4650000 },
  { id: "goal-laptop", name: "New laptop", targetAmount: 4800000, currentAmount: 3120000, currency: "UGX", targetDate: "2026-11-30", status: "active", percentageComplete: 65, remainingAmount: 1680000 },
];

const conversations: Conversation[] = [
  { id: "conversation-welcome", title: "Your money, made clearer", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-28T14:20:00.000Z" },
];

const messages: Message[] = [
  { id: "message-welcome", conversationId: "conversation-welcome", role: "assistant", content: "I’m here to help you understand your money. Ask me about spending, budgets, or your goals.", createdAt: "2026-08-01T08:00:00.000Z" },
];

const profile: Profile = {
  id: "demo-profile",
  fullName: "Amina Nansubuga",
  email: "amina@example.com",
  country: "Uganda",
  preferredCurrency: "UGX",
  theme: "light",
};

const nowIso = () => new Date().toISOString();
const numberValue = (value: unknown, fallback = 0) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
};

function recalculateBalances() {
  for (const account of accounts) {
    const related = transactions.filter((transaction) => transaction.accountId === account.id);
    account.balance = account.openingBalance + related.reduce((sum, transaction) => (
      sum + (transaction.type === "income" ? transaction.amount : -transaction.amount)
    ), 0);
  }
}

function categoryById(id: string) {
  return categories.find((category) => category.id === id);
}

function accountById(id: string) {
  return accounts.find((account) => account.id === id);
}

function withBudgetStatus(budget: (typeof budgets)[number]): Budget {
  const category = categoryById(budget.categoryId);
  const spent = transactions
    .filter((transaction) => transaction.type === "expense" && transaction.categoryId === budget.categoryId && transaction.transactionDate.startsWith("2026-08"))
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const percentageUsed = budget.amount ? Math.round((spent / budget.amount) * 1000) / 10 : 0;
  const status = percentageUsed >= 100 ? "exceeded" : percentageUsed >= 75 ? "warning" : "on_track";
  return { ...budget, categoryName: category?.name ?? "Other", spent, percentageUsed, status };
}

export function listCategories(type?: TransactionType) {
  return type ? categories.filter((category) => category.type === type) : categories;
}

export function createCategory(input: Omit<Category, "id" | "isDefault">) {
  const category = { ...input, id: randomUUID(), isDefault: false };
  categories.push(category);
  return category;
}

export function listAccounts() {
  recalculateBalances();
  return accounts;
}

export function createAccount(input: Omit<Account, "id" | "balance" | "isActive">) {
  const account = { ...input, id: randomUUID(), balance: input.openingBalance, isActive: true };
  accounts.push(account);
  return account;
}

export function updateAccount(id: string, input: Partial<Omit<Account, "id" | "balance">>) {
  const account = accountById(id);
  if (!account) return undefined;
  Object.assign(account, input);
  recalculateBalances();
  return account;
}

export function archiveAccount(id: string) {
  return updateAccount(id, { isActive: false });
}

export function listTransactions(filters?: { search?: string; type?: TransactionType; categoryId?: string }) {
  const search = filters?.search?.toLowerCase();
  return transactions
    .filter((transaction) => !filters?.type || transaction.type === filters.type)
    .filter((transaction) => !filters?.categoryId || transaction.categoryId === filters.categoryId)
    .filter((transaction) => !search || [transaction.description, transaction.categoryName, transaction.accountName].some((value) => value.toLowerCase().includes(search)))
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
}

export function createTransaction(input: Omit<Transaction, "id" | "accountName" | "categoryName">) {
  const account = accountById(input.accountId);
  const category = categoryById(input.categoryId);
  const transaction = {
    ...input,
    id: randomUUID(),
    accountName: account?.name ?? "Unknown account",
    categoryName: category?.name ?? "Other",
  };
  transactions.push(transaction);
  recalculateBalances();
  return transaction;
}

export function updateTransaction(id: string, input: Partial<Omit<Transaction, "id" | "accountName" | "categoryName">>) {
  const transaction = transactions.find((item) => item.id === id);
  if (!transaction) return undefined;
  Object.assign(transaction, input);
  const account = accountById(transaction.accountId);
  const category = categoryById(transaction.categoryId);
  transaction.accountName = account?.name ?? transaction.accountName;
  transaction.categoryName = category?.name ?? transaction.categoryName;
  recalculateBalances();
  return transaction;
}

export function deleteTransaction(id: string) {
  const index = transactions.findIndex((transaction) => transaction.id === id);
  if (index === -1) return false;
  transactions.splice(index, 1);
  recalculateBalances();
  return true;
}

export function listBudgets() {
  return budgets.map(withBudgetStatus);
}

export function createBudget(input: Omit<(typeof budgets)[number], "id">) {
  const budget = { ...input, id: randomUUID() };
  budgets.push(budget);
  return withBudgetStatus(budget);
}

export function updateBudget(id: string, input: Partial<Omit<(typeof budgets)[number], "id">>) {
  const budget = budgets.find((item) => item.id === id);
  if (!budget) return undefined;
  Object.assign(budget, input);
  return withBudgetStatus(budget);
}

export function deleteBudget(id: string) {
  const index = budgets.findIndex((budget) => budget.id === id);
  if (index === -1) return false;
  budgets.splice(index, 1);
  return true;
}

export function listGoals() {
  return goals;
}

export function createGoal(input: Omit<FinancialGoal, "id" | "percentageComplete" | "remainingAmount">) {
  const goal = {
    ...input,
    id: randomUUID(),
    percentageComplete: Math.min(100, Math.round((input.currentAmount / input.targetAmount) * 1000) / 10),
    remainingAmount: Math.max(0, input.targetAmount - input.currentAmount),
  };
  goals.push(goal);
  return goal;
}

export function updateGoal(id: string, input: Partial<Omit<FinancialGoal, "id" | "percentageComplete" | "remainingAmount">>) {
  const goal = goals.find((item) => item.id === id);
  if (!goal) return undefined;
  Object.assign(goal, input);
  goal.percentageComplete = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 1000) / 10);
  goal.remainingAmount = Math.max(0, goal.targetAmount - goal.currentAmount);
  return goal;
}

export function deleteGoal(id: string) {
  const index = goals.findIndex((goal) => goal.id === id);
  if (index === -1) return false;
  goals.splice(index, 1);
  return true;
}

export function getDashboardSummary() {
  recalculateBalances();
  const monthTransactions = transactions.filter((transaction) => transaction.transactionDate.startsWith("2026-08"));
  const monthlyIncome = monthTransactions.filter((transaction) => transaction.type === "income").reduce((sum, transaction) => sum + transaction.amount, 0);
  const monthlyExpenses = monthTransactions.filter((transaction) => transaction.type === "expense").reduce((sum, transaction) => sum + transaction.amount, 0);
  const categoryTotals = new Map<string, number>();
  for (const transaction of monthTransactions.filter((item) => item.type === "expense")) {
    categoryTotals.set(transaction.categoryName, (categoryTotals.get(transaction.categoryName) ?? 0) + transaction.amount);
  }
  const categoryEntries = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]);
  const palette = ["#0f766e", "#2563eb", "#d97706", "#7c3aed", "#db2777", "#0891b2"];
  const totalCategorySpend = categoryEntries.reduce((sum, [, amount]) => sum + amount, 0);
  const budgetStatus = listBudgets();
  return {
    currency: "UGX" as Currency,
    totalBalance: accounts.reduce((sum, account) => sum + account.balance, 0),
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
      { month: "Mar", income: 6200000, expenses: 2980000 },
      { month: "Apr", income: 6400000, expenses: 3210000 },
      { month: "May", income: 6600000, expenses: 3860000 },
      { month: "Jun", income: 6800000, expenses: 4120000 },
      { month: "Jul", income: 6800000, expenses: 3720000 },
      { month: "Aug", income: monthlyIncome, expenses: monthlyExpenses },
    ],
    recentTransactions: listTransactions().slice(0, 6),
    budgetStatus,
    goalProgress: listGoals(),
  };
}

export function listInsights(): FinancialInsight[] {
  const foodBudget = withBudgetStatus(budgets[0]);
  return [
    {
      id: "insight-food",
      title: foodBudget.status === "warning" ? "Food is nearing its limit" : "Food is on track",
      body: foodBudget.status === "warning"
        ? `You have used ${foodBudget.percentageUsed}% of your food budget. A lighter week could keep you on track.`
        : "Your food spending is within the plan you set for this month.",
      tone: foodBudget.status === "warning" ? "attention" : "positive",
      createdAt: nowIso(),
    },
    {
      id: "insight-goal",
      title: "Your emergency fund is building",
      body: "You are 61.3% of the way to your emergency fund goal. Keep the monthly habit going.",
      tone: "positive",
      createdAt: nowIso(),
    },
  ];
}

export function listConversations() {
  return conversations;
}

export function createConversation(title?: string) {
  const conversation = { id: randomUUID(), title: title?.trim() || "New money conversation", createdAt: nowIso(), updatedAt: nowIso() };
  conversations.unshift(conversation);
  return conversation;
}

export function listMessages(conversationId: string) {
  return messages.filter((message) => message.conversationId === conversationId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function sendMessage(conversationId: string, content: string) {
  const conversation = conversations.find((item) => item.id === conversationId);
  if (!conversation) return undefined;
  const userMessage: Message = { id: randomUUID(), conversationId, role: "user", content, createdAt: nowIso() };
  const assistantMessage: Message = {
    id: randomUUID(),
    conversationId,
    role: "assistant",
    content: "Based on the information I can see, you’re making steady progress. I can help you compare categories, check your budgets, or think through a specific expense.",
    createdAt: nowIso(),
  };
  messages.push(userMessage, assistantMessage);
  conversation.updatedAt = assistantMessage.createdAt;
  return [userMessage, assistantMessage];
}

export function getProfile() {
  return profile;
}

export function updateProfile(input: Partial<Omit<Profile, "id" | "email">>) {
  Object.assign(profile, input);
  return profile;
}

recalculateBalances();

export const safeNumber = numberValue;