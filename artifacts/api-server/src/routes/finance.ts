import { Router } from "express";
import {
  ArchiveAccountParams,
  CreateAccountBody,
  CreateBudgetBody,
  CreateCategoryBody,
  CreateConversationBody,
  CreateGoalBody,
  CreateTransactionBody,
  DeleteBudgetParams,
  DeleteGoalParams,
  DeleteTransactionParams,
  GetCategoriesQueryParams,
  GetConversationMessagesParams,
  GetTransactionsQueryParams,
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
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import {
  archiveAccount,
  createAccount,
  createBudget,
  createCategory,
  createConversation,
  createGoal,
  createTransaction,
  deleteBudget,
  deleteGoal,
  deleteTransaction,
  getAccountBalance,
  getDashboardSummary,
  getProfile,
  listAccounts,
  listBudgets,
  listCategories,
  listConversations,
  listGoals,
  listInsights,
  listMessages,
  listTransactions,
  sendMessage,
  updateAccount,
  updateBudget,
  updateGoal,
  updateProfile,
  updateTransaction,
} from "../services/finance-store";

const router = Router();
const notFound = (res: Parameters<Parameters<typeof router.get>[1]>[1]) => res.status(404).json({ error: "Record not found" });
const calendarDate = (value: Date | string | undefined) => value instanceof Date ? value.toISOString().slice(0, 10) : value;

// Protect all finance endpoints with token authentication
router.use(requireAuth);

router.get("/dashboard/summary", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  return res.json(getDashboardSummary(userId));
});

router.get("/insights", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  return res.json(listInsights(userId));
});

router.get("/transactions", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const query = GetTransactionsQueryParams.parse(req.query);
  return res.json(listTransactions(userId, query));
});

router.post("/transactions", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const body = CreateTransactionBody.parse(req.body);
  const rawFee = req.body?.feeAmount;
  const feeAmount = rawFee !== undefined ? Math.max(0, Math.round(Number(rawFee) || 0)) : 0;
  return res.status(201).json(createTransaction(userId, {
    ...body,
    feeAmount,
    notes: body.notes ?? null,
    transactionDate: calendarDate(body.transactionDate) as string,
  }));
});

router.patch("/transactions/:id", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const params = UpdateTransactionParams.parse(req.params);
  const body = UpdateTransactionBody.parse(req.body);
  const rawFee = req.body?.feeAmount;
  const feeAmount = rawFee !== undefined ? Math.max(0, Math.round(Number(rawFee) || 0)) : undefined;
  const transaction = updateTransaction(userId, params.id, {
    ...(body.type ? { type: body.type } : {}),
    ...(body.currency ? { currency: body.currency } : {}),
    ...(body.amount !== undefined ? { amount: body.amount } : {}),
    ...(feeAmount !== undefined ? { feeAmount } : {}),
    ...(body.accountId ? { accountId: body.accountId } : {}),
    ...(body.categoryId ? { categoryId: body.categoryId } : {}),
    ...(body.description ? { description: body.description } : {}),
    ...(body.transactionDate ? { transactionDate: calendarDate(body.transactionDate) as string } : {}),
    ...(body.notes === undefined ? {} : { notes: body.notes }),
  });
  return transaction ? res.json(transaction) : notFound(res);
});

router.delete("/transactions/:id", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const params = DeleteTransactionParams.parse(req.params);
  return deleteTransaction(userId, params.id) ? res.status(204).send() : notFound(res);
});

router.get("/accounts", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const accounts = listAccounts(userId).map((account) => ({
    ...account,
    balance: Math.round(getAccountBalance(userId, account.id)),
  }));
  return res.json(accounts);
});

router.post("/accounts", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  return res.status(201).json(createAccount(userId, CreateAccountBody.parse(req.body)));
});

router.patch("/accounts/:id", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const params = UpdateAccountParams.parse(req.params);
  const account = updateAccount(userId, params.id, UpdateAccountBody.parse(req.body));
  return account ? res.json(account) : notFound(res);
});

router.post("/accounts/:id/archive", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const params = ArchiveAccountParams.parse(req.params);
  const account = archiveAccount(userId, params.id);
  return account ? res.json(account) : notFound(res);
});

router.get("/categories", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const query = GetCategoriesQueryParams.parse(req.query);
  return res.json(listCategories(userId, query.type));
});

router.post("/categories", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  return res.status(201).json(createCategory(userId, CreateCategoryBody.parse(req.body)));
});

router.get("/budgets", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  return res.json(listBudgets(userId));
});

router.post("/budgets", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  return res.status(201).json(createBudget(userId, CreateBudgetBody.parse(req.body)));
});

router.patch("/budgets/:id", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const params = UpdateBudgetParams.parse(req.params);
  const budget = updateBudget(userId, params.id, UpdateBudgetBody.parse(req.body));
  return budget ? res.json(budget) : notFound(res);
});

router.delete("/budgets/:id", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const params = DeleteBudgetParams.parse(req.params);
  return deleteBudget(userId, params.id) ? res.status(204).send() : notFound(res);
});

router.get("/goals", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  return res.json(listGoals(userId));
});

router.post("/goals", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const body = CreateGoalBody.parse(req.body);
  return res.status(201).json(createGoal(userId, { ...body, targetDate: calendarDate(body.targetDate) as string }));
});

router.patch("/goals/:id", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const params = UpdateGoalParams.parse(req.params);
  const body = UpdateGoalBody.parse(req.body);
  const goal = updateGoal(userId, params.id, {
    ...(body.name ? { name: body.name } : {}),
    ...(body.targetAmount !== undefined ? { targetAmount: body.targetAmount } : {}),
    ...(body.currentAmount !== undefined ? { currentAmount: body.currentAmount } : {}),
    ...(body.currency ? { currency: body.currency } : {}),
    ...(body.status ? { status: body.status } : {}),
    ...(body.targetDate ? { targetDate: calendarDate(body.targetDate) as string } : {}),
  });
  return goal ? res.json(goal) : notFound(res);
});

router.delete("/goals/:id", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const params = DeleteGoalParams.parse(req.params);
  return deleteGoal(userId, params.id) ? res.status(204).send() : notFound(res);
});

router.get("/assistant/conversations", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  return res.json(listConversations(userId));
});

router.post("/assistant/conversations", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const body = CreateConversationBody.parse(req.body ?? {});
  return res.status(201).json(createConversation(userId, body.title));
});

router.get("/assistant/conversations/:id/messages", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const params = GetConversationMessagesParams.parse(req.params);
  return res.json(listMessages(userId, params.id));
});

router.post("/assistant/conversations/:id/messages", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const params = SendAssistantMessageParams.parse(req.params);
  const body = SendAssistantMessageBody.parse(req.body);
  const result = sendMessage(userId, params.id, body.content);
  return result ? res.status(201).json(result) : notFound(res);
});

router.get("/profile", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  return res.json(getProfile(userId));
});

router.patch("/profile", (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  return res.json(updateProfile(userId, UpdateProfileBody.parse(req.body)));
});

export default router;