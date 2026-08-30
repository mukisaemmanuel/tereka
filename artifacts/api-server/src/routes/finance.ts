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

router.get("/dashboard/summary", (_req, res) => res.json(getDashboardSummary()));
router.get("/insights", (_req, res) => res.json(listInsights()));

router.get("/transactions", (req, res) => {
  const query = GetTransactionsQueryParams.parse(req.query);
  res.json(listTransactions(query));
});
router.post("/transactions", (req, res) => {
  const body = CreateTransactionBody.parse(req.body);
  return res.status(201).json(createTransaction({
    ...body,
    notes: body.notes ?? null,
    transactionDate: calendarDate(body.transactionDate) as string,
  }));
});
router.patch("/transactions/:id", (req, res) => {
  const params = UpdateTransactionParams.parse(req.params);
  const body = UpdateTransactionBody.parse(req.body);
  const transaction = updateTransaction(params.id, {
    ...(body.type ? { type: body.type } : {}),
    ...(body.currency ? { currency: body.currency } : {}),
    ...(body.amount !== undefined ? { amount: body.amount } : {}),
    ...(body.accountId ? { accountId: body.accountId } : {}),
    ...(body.categoryId ? { categoryId: body.categoryId } : {}),
    ...(body.description ? { description: body.description } : {}),
    ...(body.transactionDate ? { transactionDate: calendarDate(body.transactionDate) as string } : {}),
    ...(body.notes === undefined ? {} : { notes: body.notes }),
  });
  return transaction ? res.json(transaction) : notFound(res);
});
router.delete("/transactions/:id", (req, res) => {
  const params = DeleteTransactionParams.parse(req.params);
  return deleteTransaction(params.id) ? res.status(204).send() : notFound(res);
});

router.get("/accounts", (_req, res) => res.json(listAccounts()));
router.post("/accounts", (req, res) => res.status(201).json(createAccount(CreateAccountBody.parse(req.body))));
router.patch("/accounts/:id", (req, res) => {
  const params = UpdateAccountParams.parse(req.params);
  const account = updateAccount(params.id, UpdateAccountBody.parse(req.body));
  return account ? res.json(account) : notFound(res);
});
router.post("/accounts/:id/archive", (req, res) => {
  const params = ArchiveAccountParams.parse(req.params);
  const account = archiveAccount(params.id);
  return account ? res.json(account) : notFound(res);
});

router.get("/categories", (req, res) => {
  const query = GetCategoriesQueryParams.parse(req.query);
  res.json(listCategories(query.type));
});
router.post("/categories", (req, res) => res.status(201).json(createCategory(CreateCategoryBody.parse(req.body))));

router.get("/budgets", (_req, res) => res.json(listBudgets()));
router.post("/budgets", (req, res) => res.status(201).json(createBudget(CreateBudgetBody.parse(req.body))));
router.patch("/budgets/:id", (req, res) => {
  const params = UpdateBudgetParams.parse(req.params);
  const budget = updateBudget(params.id, UpdateBudgetBody.parse(req.body));
  return budget ? res.json(budget) : notFound(res);
});
router.delete("/budgets/:id", (req, res) => {
  const params = DeleteBudgetParams.parse(req.params);
  return deleteBudget(params.id) ? res.status(204).send() : notFound(res);
});

router.get("/goals", (_req, res) => res.json(listGoals()));
router.post("/goals", (req, res) => {
  const body = CreateGoalBody.parse(req.body);
  return res.status(201).json(createGoal({ ...body, targetDate: calendarDate(body.targetDate) as string }));
});
router.patch("/goals/:id", (req, res) => {
  const params = UpdateGoalParams.parse(req.params);
  const body = UpdateGoalBody.parse(req.body);
  const goal = updateGoal(params.id, {
    ...(body.name ? { name: body.name } : {}),
    ...(body.targetAmount !== undefined ? { targetAmount: body.targetAmount } : {}),
    ...(body.currentAmount !== undefined ? { currentAmount: body.currentAmount } : {}),
    ...(body.currency ? { currency: body.currency } : {}),
    ...(body.status ? { status: body.status } : {}),
    ...(body.targetDate ? { targetDate: calendarDate(body.targetDate) as string } : {}),
  });
  return goal ? res.json(goal) : notFound(res);
});
router.delete("/goals/:id", (req, res) => {
  const params = DeleteGoalParams.parse(req.params);
  return deleteGoal(params.id) ? res.status(204).send() : notFound(res);
});

router.get("/assistant/conversations", (_req, res) => res.json(listConversations()));
router.post("/assistant/conversations", (req, res) => {
  const body = CreateConversationBody.parse(req.body ?? {});
  res.status(201).json(createConversation(body.title));
});
router.get("/assistant/conversations/:id/messages", (req, res) => {
  const params = GetConversationMessagesParams.parse(req.params);
  res.json(listMessages(params.id));
});
router.post("/assistant/conversations/:id/messages", (req, res) => {
  const params = SendAssistantMessageParams.parse(req.params);
  const body = SendAssistantMessageBody.parse(req.body);
  const result = sendMessage(params.id, body.content);
  return result ? res.status(201).json(result) : notFound(res);
});

router.get("/profile", (_req, res) => res.json(getProfile()));
router.patch("/profile", (req, res) => res.json(updateProfile(UpdateProfileBody.parse(req.body))));

export default router;