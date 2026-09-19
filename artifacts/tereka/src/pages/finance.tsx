import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { ArrowDownLeft, ArrowUpRight, Check, CheckCircle2, Edit3, Filter, Landmark, MoreHorizontal, Plus, Receipt, RefreshCw, Search, Send, ShieldAlert, Smartphone, Sparkles, Target, Trash2, Volume2, Wallet } from 'lucide-react';
import {
  Currency, ProfileTheme, TransactionType, useArchiveAccount, useCreateAccount, useCreateBudget, useCreateCategory, useCreateConversation, useCreateGoal, useCreateTransaction, useDeleteBudget, useDeleteGoal, useDeleteTransaction, useGetAccounts, useGetBudgets, useGetCategories, useGetConversationMessages, useGetConversations, useGetDashboardSummary, useGetGoals, useGetInsights, useGetProfile, useGetTransactions, useSendAssistantMessage, useUpdateAccount, useUpdateBudget, useUpdateGoal, useUpdateProfile, useUpdateTransaction,
  getGetAccountsQueryKey, getGetBudgetsQueryKey, getGetCategoriesQueryKey, getGetConversationMessagesQueryKey, getGetConversationsQueryKey, getGetGoalsQueryKey, getGetProfileQueryKey, getGetTransactionsQueryKey,
} from '@workspace/api-client-react';
import type { Account, Budget, Category, Conversation, Currency as CurrencyType, FinancialGoal, Transaction, TransactionType as TransactionTypeValue } from '@workspace/api-client-react';
import { AppShell, Button, Card, EmptyState, Field, Modal, PageHeading, Skeleton, inputClass } from '@/components/layout';
import { DashboardCharts } from '@/components/finance-charts';
import { compactMoney, dateLabel, formatCurrency, money, transactionIcon } from '@/lib/finance';
import { applyTheme } from '@/lib/theme';
import { speak, useBudgetAlert } from '@/lib/budget-alerts';

const currencies = Object.values(Currency);
const txTypes = Object.values(TransactionType);
function ErrorState({ retry }: { retry: () => void }) {
  return <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center"><p className="font-serif text-xl">That view needs a moment.</p><p className="mt-2 text-sm text-muted-foreground">We couldn't load this part of your money picture.</p><Button variant="secondary" onClick={retry} className="mt-4" data-testid="button-retry"><RefreshCw size={15} /> Try again</Button></div>;
}

function StatCard({ label, value, detail, accent = 'primary', icon: Icon }: { label: string; value: string; detail: string; accent?: string; icon: typeof Wallet }) {
  return <Card className="relative overflow-hidden p-5"><div className={`absolute right-0 top-0 h-20 w-20 translate-x-7 -translate-y-7 rounded-full ${accent === 'gold' ? 'bg-accent/20' : 'bg-primary/10'}`} /><div className="relative flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-3 text-2xl font-extrabold tracking-tight">{value}</p><p className="mt-2 text-xs text-muted-foreground">{detail}</p></div><span className={`grid h-9 w-9 place-items-center rounded-xl ${accent === 'gold' ? 'bg-accent/20 text-primary' : 'bg-secondary text-primary'}`}><Icon size={17} /></span></div></Card>;
}

function AiFinancialWatchCard({ budgets, loading }: { budgets: Budget[]; loading: boolean }) {
  const watchList = (budgets || []).filter((b) => (b.percentageUsed ?? 0) >= 80);

  return (
    <Card className="mt-5 overflow-hidden border-amber-500/30 bg-gradient-to-br from-card via-card to-amber-500/5 p-5 sm:p-6" data-testid="card-ai-financial-watch">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shadow-inner">
            <ShieldAlert size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-xl font-bold tracking-tight text-foreground">
                AI Financial Watch
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">
                <Sparkles size={11} /> Real-Time Monitor
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Automated threshold detection for categories currently approaching or exceeding limits (&ge;80% capacity).
            </p>
          </div>
        </div>
        {watchList.length > 0 && (
          <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full self-start sm:self-auto">
            {watchList.length} Categor{watchList.length === 1 ? 'y' : 'ies'} On Watch
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      ) : watchList.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-950 dark:text-emerald-100">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="flex-1">
            <span className="font-semibold text-sm">All Budgets Within Safe Guardrails</span>
            <p className="mt-0.5 text-xs opacity-85">
              No categories have exceeded 80% capacity this month. Your spending velocity is healthy and on track.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {watchList.map((cat) => {
            const isOver = (cat.percentageUsed ?? 0) >= 100;
            const remaining = Math.max(0, cat.amount - cat.spent);
            const overspend = Math.max(0, cat.spent - cat.amount);
            const adviceText = isOver
              ? `Warning: You have exceeded your ${cat.categoryName} budget by UGX ${overspend.toLocaleString()}. You are now at ${cat.percentageUsed}% of your monthly limit.`
              : `Heads up: You have reached ${cat.percentageUsed}% of your ${cat.categoryName} budget (UGX ${cat.spent.toLocaleString()} of UGX ${cat.amount.toLocaleString()}). ${remaining.toLocaleString()} UGX left for this month.`;

            return (
              <div
                key={cat.id}
                className={`rounded-2xl border p-4 transition-all flex flex-col justify-between ${
                  isOver
                    ? 'border-red-500/40 bg-red-500/10 text-red-950 dark:text-red-100'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100'
                }`}
                data-testid={`watch-category-${cat.id}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-foreground">{cat.categoryName}</h3>
                      <p className="text-xs opacity-75 mt-0.5">
                        {isOver ? (
                          <span className="font-semibold text-red-600 dark:text-red-400">
                            Exceeded by {formatCurrency(overspend, cat.currency)}
                          </span>
                        ) : (
                          <span>{formatCurrency(remaining, cat.currency)} remaining</span>
                        )}
                      </p>
                    </div>
                    <span
                      className={`font-mono text-xs font-extrabold px-2.5 py-0.5 rounded-lg ${
                        isOver ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'
                      }`}
                    >
                      {cat.percentageUsed}%
                    </span>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary/80">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isOver ? 'bg-red-600' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, cat.percentageUsed ?? 0)}%` }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] opacity-80">
                    <span>Spent {formatCurrency(cat.spent, cat.currency)}</span>
                    <span>Limit {formatCurrency(cat.amount, cat.currency)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => speak(adviceText)}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-card/80 py-1.5 text-xs font-semibold text-foreground hover:bg-card hover:border-primary/50 transition-all shadow-2xs"
                  title="Listen to voice advice"
                >
                  <Volume2 size={13} className="text-primary" />
                  <span>Listen to Warning</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function Dashboard() {
  const summaryQuery = useGetDashboardSummary(); const insightQuery = useGetInsights(); const budgetsQuery = useGetBudgets();
  const summary = summaryQuery.data; const insights = insightQuery.data || []; const budgets = budgetsQuery.data || [];
  if (summaryQuery.isLoading) return <AppShell><DashboardSkeleton /></AppShell>;
  if (summaryQuery.isError || !summary) return <AppShell><ErrorState retry={() => summaryQuery.refetch()} /></AppShell>;
  
  const totalNetWorth = (summary as any).totalNetWorth ?? summary.totalBalance;
  const totalFeesPaid = (summary as any).totalFeesPaid ?? 0;

  return (
    <AppShell>
      <PageHeading
        eyebrow="Financial Intelligence"
        title="Your money, in focus."
        description="A quiet overview of the choices you've made and the progress they are creating."
        action={<Link href="/transactions" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90" data-testid="link-add-from-dashboard"><Plus size={16} /> Add transaction</Link>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Net Worth"
          value={formatCurrency(totalNetWorth, summary.currency)}
          detail="Across your mobile money, bank accounts, and cash"
          icon={Wallet}
        />
        <StatCard
          label="Income this month"
          value={compactMoney(summary.monthlyIncome, summary.currency)}
          detail="Money in, so far"
          accent="gold"
          icon={ArrowDownLeft}
        />
        <StatCard
          label="Spent this month"
          value={compactMoney(summary.monthlyExpenses, summary.currency)}
          detail="Across all accounts"
          icon={ArrowUpRight}
        />
        <StatCard
          label="Fee Leakage"
          value={formatCurrency(totalFeesPaid, summary.currency || 'UGX')}
          detail="MoMo & Bank Tariffs"
          accent="gold"
          icon={Receipt}
        />
      </div>

      {/* AI Financial Watch: Real-time budget threshold monitoring (&ge;80% capacity) */}
      <AiFinancialWatchCard budgets={budgets} loading={budgetsQuery.isLoading} />

      <DashboardCharts summary={summary} />
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Latest movement</p>
              <h2 className="mt-2 font-serif text-2xl">Recent transactions</h2>
            </div>
            <Link href="/transactions" className="text-xs font-bold text-primary hover:underline" data-testid="link-see-transactions">See all</Link>
          </div>
          <div className="divide-y divide-border">
            {(summary.recentTransactions || []).slice(0, 5).map((tx) => <TransactionRow key={tx.id} transaction={tx} currency={summary.currency} />)}
          </div>
          {!summary.recentTransactions?.length && <EmptyState title="Your story starts here" body="Add your first transaction and Tereka will begin finding your rhythm." />}
        </Card>
        <Insights insights={insights} loading={insightQuery.isLoading} />
      </div>
    </AppShell>
  );
}

function DashboardSkeleton() { return <><div className="mb-8"><Skeleton className="h-3 w-28" /><Skeleton className="mt-4 h-12 w-80" /><Skeleton className="mt-3 h-4 w-96 max-w-full" /></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}</div><div className="mt-5 grid gap-5 xl:grid-cols-2"><Skeleton className="h-80" /><Skeleton className="h-80" /></div></>; }

function Insights({ insights, loading }: { insights: any[]; loading: boolean }) {
  return <Card className="overflow-hidden"><div className="bg-primary p-5 text-primary-foreground sm:p-6"><div className="flex items-center gap-2 text-accent"><Sparkles size={17} /><span className="font-mono text-[10px] uppercase tracking-widest">Tereka noticed</span></div><h2 className="mt-3 font-serif text-2xl">A little more signal.</h2><p className="mt-2 text-xs leading-5 text-primary-foreground/65">Patterns worth seeing, without the noise.</p></div>{loading ? <div className="space-y-4 p-5"><Skeleton className="h-14" /><Skeleton className="h-14" /></div> : insights.length ? <div className="divide-y divide-border">{insights.slice(0, 3).map((insight) => <div key={insight.id} className="p-5"><p className="text-sm font-bold">{insight.title}</p><p className="mt-1.5 text-xs leading-5 text-muted-foreground">{insight.body}</p></div>)}</div> : <EmptyState title="The signal is forming" body="Keep logging your money and useful patterns will appear here." />}</Card>;
}

function TransactionRow({ transaction: tx, currency }: { transaction: Transaction; currency?: CurrencyType }) {
  return <div className="flex items-center gap-3 py-3"><span className={`grid h-9 w-9 place-items-center rounded-xl text-lg ${tx.type === 'income' ? 'bg-primary/10 text-primary' : 'bg-secondary text-primary'}`}>{transactionIcon(tx)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{tx.description}</p><p className="truncate text-xs text-muted-foreground">{tx.categoryName} · {dateLabel(tx.transactionDate)}</p></div><p className={`font-mono text-xs font-medium ${tx.type === 'income' ? 'text-primary' : 'text-foreground'}`}>{tx.type === 'income' ? '+' : '−'}{formatCurrency(tx.amount, tx.currency || currency)}</p></div>;
}

type TransactionForm = { type: TransactionTypeValue; amount: string; currency: CurrencyType; accountId: string; categoryId: string; description: string; notes: string; transactionDate: string };
const blankTx = (): TransactionForm => ({ type: 'expense', amount: '', currency: 'UGX', accountId: '', categoryId: '', description: '', notes: '', transactionDate: new Date().toISOString().slice(0, 10) });

function Transactions() {
  const qc = useQueryClient(); const [search, setSearch] = useState(''); const [type, setType] = useState<'all' | TransactionTypeValue>('all'); const [modal, setModal] = useState<'add' | Transaction | null>(null);
  const { triggerBudgetAlert } = useBudgetAlert();
  const params = { search: search || undefined, type: type === 'all' ? undefined : type }; const query = useGetTransactions(params); const accounts = useGetAccounts(); const categories = useGetCategories(); const create = useCreateTransaction(); const update = useUpdateTransaction(); const remove = useDeleteTransaction();
  const list = query.data || []; const editing = modal && modal !== 'add' ? modal : null;
  const save = (form: TransactionForm) => {
    const data = { ...form, currency: 'UGX' as CurrencyType, amount: Number(form.amount), notes: form.notes || undefined };
    if (editing) {
      update.mutate({ id: editing.id, data }, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetTransactionsQueryKey(params) });
          qc.invalidateQueries({ queryKey: getGetBudgetsQueryKey() });
          setModal(null);
        }
      });
    } else {
      create.mutate({ data }, {
        onSuccess: (res: any) => {
          qc.invalidateQueries({ queryKey: getGetTransactionsQueryKey(params) });
          qc.invalidateQueries({ queryKey: getGetBudgetsQueryKey() });
          setModal(null);
          const alertMsg = res?.alert || res?.data?.alert;
          if (alertMsg) {
            triggerBudgetAlert(alertMsg);
          }
        }
      });
    }
  };
  return <AppShell><PageHeading eyebrow="Money movement" title="Transactions" description="Every entry is a piece of context. Keep the picture honest." action={<Button onClick={() => setModal('add')} data-testid="button-add-transaction"><Plus size={16} /> Add transaction</Button>} /><Card className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-border bg-secondary/35 p-4 sm:flex-row"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-3.5 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search descriptions or categories" className={`${inputClass} pl-10`} data-testid="input-search-transactions" /></div><div className="flex gap-2"><select value={type} onChange={(e) => setType(e.target.value as any)} className={`${inputClass} sm:w-36`} data-testid="select-transaction-type"><option value="all">All types</option><option value="income">Income</option><option value="expense">Expenses</option></select><Button variant="secondary" className="px-3" title="Filters are ready" data-testid="button-filter-transactions"><Filter size={16} /></Button></div></div>{query.isLoading ? <div className="space-y-4 p-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12" />)}</div> : query.isError ? <div className="p-5"><ErrorState retry={() => query.refetch()} /></div> : list.length ? <div className="divide-y divide-border">{list.map((tx) => <div key={tx.id} className="group flex items-center gap-3 px-4 py-1 hover:bg-secondary/25 sm:px-6"><div className="min-w-0 flex-1"><TransactionRow transaction={tx} /></div><div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"><button onClick={() => setModal(tx)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-primary" data-testid={`button-edit-transaction-${tx.id}`}><Edit3 size={15} /></button><button onClick={() => { if (window.confirm('Delete this transaction?')) remove.mutate({ id: tx.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetTransactionsQueryKey(params) }) }); }} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" data-testid={`button-delete-transaction-${tx.id}`}><Trash2 size={15} /></button></div></div>)}</div> : <EmptyState title="No transactions here yet" body="Try another search, or add the first entry to your money story." action={<Button onClick={() => setModal('add')} data-testid="button-empty-add-transaction"><Plus size={15} /> Add transaction</Button>} />}</Card>{modal && <TransactionModal initial={editing || undefined} accounts={accounts.data || []} categories={categories.data || []} pending={create.isPending || update.isPending} onClose={() => setModal(null)} onSave={save} />}</AppShell>;
}

function TransactionModal({ initial, accounts, categories, pending, onClose, onSave }: { initial?: Transaction; accounts: Account[]; categories: Category[]; pending: boolean; onClose: () => void; onSave: (form: TransactionForm) => void }) {
  const [form, setForm] = useState<TransactionForm>(initial ? { type: initial.type, amount: String(initial.amount), currency: 'UGX', accountId: initial.accountId, categoryId: initial.categoryId, description: initial.description, notes: initial.notes || '', transactionDate: initial.transactionDate.slice(0, 10) } : blankTx());
  const set = (key: keyof TransactionForm, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  return (
    <Modal title={initial ? 'Edit transaction' : 'Add transaction'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select value={form.type} onChange={(e) => set('type', e.target.value)} className={inputClass} data-testid="select-form-transaction-type">
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </Field>
          <Field label="Amount (UGX)">
            <input required type="number" min="1" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0" className={inputClass} data-testid="input-form-transaction-amount" />
          </Field>
        </div>
        <Field label="Description">
          <input required value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What was this for?" className={inputClass} data-testid="input-form-transaction-description" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Account">
            <select required value={form.accountId} onChange={(e) => set('accountId', e.target.value)} className={inputClass} data-testid="select-form-transaction-account">
              <option value="">Choose account</option>
              {accounts.filter((a) => a.isActive).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Category">
            <select required value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} className={inputClass} data-testid="select-form-transaction-category">
              <option value="">Choose category</option>
              {categories.filter((c) => c.type === form.type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input required type="date" value={form.transactionDate} onChange={(e) => set('transactionDate', e.target.value)} className={inputClass} data-testid="input-form-transaction-date" />
          </Field>
          <Field label="Notes">
            <input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional" className={inputClass} data-testid="input-form-transaction-notes" />
          </Field>
        </div>
        <div className="mt-4 flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} data-testid="button-cancel-transaction">
            Cancel
          </Button>
          <Button type="submit" disabled={pending} data-testid="button-save-transaction">
            {pending ? 'Saving…' : initial ? 'Save changes' : 'Add transaction'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function getAccountProviderBadge(account: Account) {
  const nameLower = (account.name || '').toLowerCase();
  const type: string = account.type || 'other';

  if (type === 'mobile_money') {
    if (nameLower.includes('mtn') || nameLower.includes('momo')) {
      return { tag: 'MTN MoMo', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' };
    }
    if (nameLower.includes('airtel')) {
      return { tag: 'Airtel Money', className: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30' };
    }
    return { tag: 'Mobile Money', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' };
  }

  if (type === 'bank') {
    if (nameLower.includes('stanbic')) {
      return { tag: 'Stanbic Bank Uganda', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30' };
    }
    if (nameLower.includes('centenary')) {
      return { tag: 'Centenary Bank', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' };
    }
    if (nameLower.includes('dfcu')) {
      return { tag: 'dfcu Bank', className: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30' };
    }
    if (nameLower.includes('absa')) {
      return { tag: 'Absa Bank Uganda', className: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30' };
    }
    return { tag: 'Commercial Bank', className: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30' };
  }

  if (type === 'cash') {
    return { tag: 'Physical Cash', className: 'bg-stone-500/15 text-stone-700 dark:text-stone-400 border-stone-500/30' };
  }

  if (type === 'sacco' || type === 'savings') {
    return { tag: 'SACCO / Club', className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30' };
  }

  return { tag: account.type.replace('_', ' '), className: 'bg-secondary text-muted-foreground border-border' };
}

function Accounts() {
  const qc = useQueryClient(); const query = useGetAccounts(); const [modal, setModal] = useState<'add' | Account | null>(null); const create = useCreateAccount(); const update = useUpdateAccount(); const archive = useArchiveAccount(); const accounts = query.data || [];
  const save = (data: any, id?: string) => { const onSuccess = () => { qc.invalidateQueries({ queryKey: getGetAccountsQueryKey() }); setModal(null); }; if (id) update.mutate({ id, data }, { onSuccess }); else create.mutate({ data }, { onSuccess }); };
  return (
    <AppShell>
      <PageHeading eyebrow="Your foundations" title="Accounts" description="The places your money rests, moves through, and grows." action={<Button onClick={() => setModal('add')} data-testid="button-add-account"><Plus size={16} /> Add account</Button>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="bg-primary p-5 text-primary-foreground sm:col-span-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary-foreground/60">Across active accounts</p>
          <p className="mt-3 font-serif text-4xl">{formatCurrency(accounts.filter((a) => a.isActive).reduce((sum, a) => sum + a.balance, 0), accounts[0]?.currency)}</p>
          <p className="mt-2 text-xs text-primary-foreground/60">Your connected view, in one place.</p>
        </Card>
        <Card className="flex flex-col justify-between p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Active accounts</p>
          <p className="mt-4 text-4xl font-extrabold">{accounts.filter((a) => a.isActive).length}</p>
          <p className="text-xs text-muted-foreground">Keep it simple and useful.</p>
        </Card>
      </div>
      {query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}</div>
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : accounts.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const badge = getAccountProviderBadge(account);
            return (
              <Card key={account.id} className={`group p-5 ${!account.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary">
                    {account.type === 'mobile_money' ? <Smartphone size={19} /> : account.type === 'cash' ? <Wallet size={19} /> : <Landmark size={19} />}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${badge.className}`}>
                      {badge.tag}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => setModal(account)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-primary" data-testid={`button-edit-account-${account.id}`}>
                        <Edit3 size={15} />
                      </button>
                      {account.isActive && (
                        <button
                          onClick={() => {
                            if (window.confirm('Archive this account? Its history will be kept.')) {
                              archive.mutate({ id: account.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetAccountsQueryKey() }) });
                            }
                          }}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          data-testid={`button-archive-account-${account.id}`}
                        >
                          <MoreHorizontal size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <p className="mt-5 text-base font-bold">{account.name}</p>
                <p className="mt-1 text-xs capitalize text-muted-foreground">{account.type.replace('_', ' ')} · {account.currency}</p>
                <p className="mt-4 font-mono text-2xl font-bold">{formatCurrency(account.balance, account.currency)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{account.isActive ? 'Active balance (ledger synced)' : 'Archived account'}</p>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card><EmptyState title="Give your money a home" body="Add a bank, mobile wallet, or cash account to see your full balance." action={<Button onClick={() => setModal('add')} data-testid="button-empty-add-account"><Plus size={15} /> Add account</Button>} /></Card>
      )}
      {modal && <AccountModal initial={modal !== 'add' ? modal : undefined} pending={create.isPending || update.isPending} onClose={() => setModal(null)} onSave={save} />}
    </AppShell>
  );
}

function AccountModal({ initial, pending, onClose, onSave }: { initial?: Account; pending: boolean; onClose: () => void; onSave: (data: any, id?: string) => void }) {
  const [name, setName] = useState(initial?.name || '');
  const [type, setType] = useState(initial?.type || 'bank');
  const [opening, setOpening] = useState(String(initial?.openingBalance || ''));
  return (
    <Modal title={initial ? 'Edit account' : 'Add account'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ name, type, currency: 'UGX', openingBalance: Number(opening) }, initial?.id);
        }}
        className="space-y-4"
      >
        <Field label="Account name">
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. MTN MoMo main" className={inputClass} data-testid="input-account-name" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={inputClass} data-testid="select-account-type">
              <option value="bank">Bank</option>
              <option value="mobile_money">Mobile money</option>
              <option value="cash">Cash</option>
              <option value="savings">Savings</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Opening balance (UGX)">
            <input required type="number" min="0" value={opening} onChange={(e) => setOpening(e.target.value)} className={inputClass} data-testid="input-account-opening" />
          </Field>
        </div>
        <div className="mt-4 flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} data-testid="button-cancel-account">
            Cancel
          </Button>
          <Button type="submit" disabled={pending} data-testid="button-save-account">
            {pending ? 'Saving…' : initial ? 'Save changes' : 'Add account'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Budgets() {
  const qc = useQueryClient();
  const query = useGetBudgets();
  const categories = useGetCategories({ type: 'expense' });
  const createCategory = useCreateCategory();
  const [modal, setModal] = useState<'add' | Budget | null>(null);
  const [categoryModal, setCategoryModal] = useState(false);
  const create = useCreateBudget();
  const update = useUpdateBudget();
  const remove = useDeleteBudget();
  const budgets = query.data || [];
  const save = (data: any, id?: string) => {
    const onSuccess = () => {
      qc.invalidateQueries({ queryKey: getGetBudgetsQueryKey() });
      setModal(null);
    };
    if (id) update.mutate({ id, data }, { onSuccess });
    else create.mutate({ data }, { onSuccess });
  };
  return (
    <AppShell>
      <PageHeading eyebrow="Spend with intention" title="Budgets" description="A gentle guardrail for the things that matter this month." action={<Button onClick={() => setModal('add')} data-testid="button-add-budget"><Plus size={16} /> New budget</Button>} />
      {query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}</div>
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : budgets.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {budgets.map((budget, i) => (
            <Card key={budget.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary">{['⌁', '⌂', '→', '•'][i % 4]}</span>
                  <div>
                    <p className="text-sm font-bold">{budget.categoryName}</p>
                    <p className="mt-0.5 text-xs capitalize text-muted-foreground">{budget.period} plan</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setModal(budget)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-primary" data-testid={`button-edit-budget-${budget.id}`}><Edit3 size={15} /></button>
                  <button onClick={() => { if (window.confirm('Delete this budget?')) remove.mutate({ id: budget.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetBudgetsQueryKey() }) }); }} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" data-testid={`button-delete-budget-${budget.id}`}><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="mt-7 flex items-end justify-between">
                <p className="font-mono text-xl">{money(budget.spent, budget.currency)} <span className="text-xs text-muted-foreground">of {money(budget.amount, budget.currency)}</span></p>
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${budget.status === 'exceeded' ? 'bg-destructive/10 text-destructive' : budget.status === 'warning' ? 'bg-accent/25 text-foreground' : 'bg-primary/10 text-primary'}`}>{budget.status.replace('_', ' ')}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                <div className={`h-full rounded-full ${budget.status === 'exceeded' ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${Math.min(100, budget.percentageUsed)}%` }} />
              </div>
              <p className="mt-2 text-right font-mono text-[10px] text-muted-foreground">{budget.percentageUsed}% used</p>
            </Card>
          ))}
        </div>
      ) : (
        <Card><EmptyState title="A plan for your month" body="Set a budget for one category. It can be a guide, not a restriction." action={<Button onClick={() => setModal('add')} data-testid="button-empty-add-budget"><Plus size={15} /> Create a budget</Button>} /></Card>
      )}
      <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
        <div>
          <p className="text-sm font-bold">Need another category?</p>
          <p className="mt-1 text-xs text-muted-foreground">Create a custom label for your real life.</p>
        </div>
        <Button variant="secondary" onClick={() => setCategoryModal(true)} data-testid="button-add-category"><Plus size={15} /> New category</Button>
      </div>
      {modal && <BudgetModal initial={modal !== 'add' ? modal : undefined} categories={categories.data || []} pending={create.isPending || update.isPending} onClose={() => setModal(null)} onSave={save} />}
      {categoryModal && <CategoryModal pending={createCategory.isPending} onClose={() => setCategoryModal(false)} onSave={(data) => createCategory.mutate({ data }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetCategoriesQueryKey({ type: 'expense' }) }); setCategoryModal(false); } })} />}
    </AppShell>
  );
}

function BudgetModal({ initial, categories, pending, onClose, onSave }: { initial?: Budget; categories: Category[]; pending: boolean; onClose: () => void; onSave: (data: any, id?: string) => void }) {
  const [categoryId, setCategoryId] = useState(initial?.categoryId || categories[0]?.id || '');
  const [amount, setAmount] = useState(String(initial?.amount || ''));
  return (
    <Modal title={initial ? 'Edit budget' : 'New monthly budget'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSave({ categoryId, amount: Number(amount), currency: 'UGX', period: 'monthly' }, initial?.id); }} className="space-y-4">
        <Field label="Category">
          <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass} data-testid="select-budget-category">
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Monthly amount (UGX)">
          <input required type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} data-testid="input-budget-amount" />
        </Field>
        <div className="mt-4 flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} data-testid="button-cancel-budget">
            Cancel
          </Button>
          <Button type="submit" disabled={pending} data-testid="button-save-budget">
            {pending ? 'Saving…' : initial ? 'Save changes' : 'Create budget'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CategoryModal({ pending, onClose, onSave }: { pending: boolean; onClose: () => void; onSave: (data: any) => void }) {
  const [name, setName] = useState('');
  return (
    <Modal title="New category" onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSave({ name, type: 'expense', icon: 'circle' }); }}>
        <Field label="Category name">
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Family support" className={inputClass} data-testid="input-category-name" />
        </Field>
        <div className="mt-4 flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} data-testid="button-cancel-category">
            Cancel
          </Button>
          <Button type="submit" disabled={pending} data-testid="button-save-category">
            {pending ? 'Creating…' : 'Create category'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Goals() {
  const qc = useQueryClient();
  const query = useGetGoals();
  const [modal, setModal] = useState<'add' | FinancialGoal | null>(null);
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const remove = useDeleteGoal();
  const goals = query.data || [];
  const save = (data: any, id?: string) => {
    const onSuccess = () => {
      qc.invalidateQueries({ queryKey: getGetGoalsQueryKey() });
      setModal(null);
    };
    if (id) update.mutate({ id, data }, { onSuccess });
    else create.mutate({ data }, { onSuccess });
  };
  return (
    <AppShell>
      <PageHeading eyebrow="Forward motion" title="Goals" description="The things your money is making possible — one contribution at a time." action={<Button onClick={() => setModal('add')} data-testid="button-add-goal"><Plus size={16} /> New goal</Button>} />
      {query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">{[1, 2].map((i) => <Skeleton key={i} className="h-52" />)}</div>
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : goals.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {goals.map((goal) => (
            <Card key={goal.id} className="p-5 sm:p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/25 text-primary"><Target size={20} /></span>
                  <div>
                    <h2 className="font-serif text-xl">{goal.name}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Target {dateLabel(goal.targetDate, true)}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setModal(goal)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-primary" data-testid={`button-edit-goal-${goal.id}`}><Edit3 size={15} /></button>
                  <button onClick={() => { if (window.confirm('Delete this goal?')) remove.mutate({ id: goal.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetGoalsQueryKey() }) }); }} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" data-testid={`button-delete-goal-${goal.id}`}><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="mt-7 flex items-end justify-between">
                <div>
                  <p className="font-mono text-2xl">{money(goal.currentAmount, goal.currency)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">of {money(goal.targetAmount, goal.currency)}</p>
                </div>
                <p className="font-mono text-xl text-primary">{goal.percentageComplete}%</p>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, goal.percentageComplete)}%` }} />
              </div>
              <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                <span>{goal.status}</span>
                <span>{money(goal.remainingAmount, goal.currency)} to go</span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card><EmptyState title="Give a goal a number" body="A named destination makes progress easier to feel." action={<Button onClick={() => setModal('add')} data-testid="button-empty-add-goal"><Plus size={15} /> Set a goal</Button>} /></Card>
      )}
      {modal && <GoalModal initial={modal !== 'add' ? modal : undefined} pending={create.isPending || update.isPending} onClose={() => setModal(null)} onSave={save} />}
    </AppShell>
  );
}

function GoalModal({ initial, pending, onClose, onSave }: { initial?: FinancialGoal; pending: boolean; onClose: () => void; onSave: (data: any, id?: string) => void }) {
  const [name, setName] = useState(initial?.name || '');
  const [target, setTarget] = useState(String(initial?.targetAmount || ''));
  const [current, setCurrent] = useState(String(initial?.currentAmount || ''));
  const [date, setDate] = useState(initial?.targetDate?.slice(0, 10) || '');
  const [status, setStatus] = useState(initial?.status || 'active');
  return (
    <Modal title={initial ? 'Edit goal' : 'New savings goal'} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ name, targetAmount: Number(target), currentAmount: Number(current), currency: 'UGX', targetDate: date, status }, initial?.id);
        }}
      >
        <Field label="What are you building toward?">
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. A home down payment" className={inputClass} data-testid="input-goal-name" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target amount (UGX)">
            <input required type="number" min="1" value={target} onChange={(e) => setTarget(e.target.value)} className={inputClass} data-testid="input-goal-target" />
          </Field>
          <Field label="Already saved (UGX)">
            <input required type="number" min="0" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} data-testid="input-goal-current" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target date">
            <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} data-testid="input-goal-date" />
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as any)} className={inputClass} data-testid="select-goal-status">
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </Field>
        </div>
        <div className="mt-4 flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} data-testid="button-cancel-goal">
            Cancel
          </Button>
          <Button type="submit" disabled={pending} data-testid="button-save-goal">
            {pending ? 'Saving…' : initial ? 'Save changes' : 'Create goal'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function Assistant() {
  const qc = useQueryClient(); const conversationsQuery = useGetConversations(); const [conversationId, setConversationId] = useState(''); const [draft, setDraft] = useState('');
  const conversations = conversationsQuery.data || []; const activeId = conversationId || conversations[0]?.id || ''; const messagesQuery = useGetConversationMessages(activeId, { query: { enabled: Boolean(activeId), queryKey: getGetConversationMessagesQueryKey(activeId) } }); const createConversation = useCreateConversation(); const send = useSendAssistantMessage();
  const newConversation = () => createConversation.mutate({ data: { title: 'New money conversation' } }, { onSuccess: (conversation) => { setConversationId(conversation.id); qc.invalidateQueries({ queryKey: getGetConversationsQueryKey() }); } });
  const submit = () => { if (!draft.trim() || !activeId) return; const content = draft.trim(); send.mutate({ id: activeId, data: { content } }, { onSuccess: (messages) => qc.setQueryData(getGetConversationMessagesQueryKey(activeId), messages) }); };
  return <AppShell><PageHeading eyebrow="Your thinking partner" title="Tereka AI" description="Ask the questions that are hard to answer from a spreadsheet. Tereka keeps it practical." action={<Button variant="secondary" onClick={newConversation} disabled={createConversation.isPending} data-testid="button-new-conversation"><Plus size={16} /> New conversation</Button>} /><div className="grid min-h-[560px] gap-5 lg:grid-cols-[250px_1fr]"><Card className="hidden p-3 lg:block"><p className="px-3 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Your conversations</p><div className="space-y-1">{conversations.map((conversation: Conversation) => <button key={conversation.id} onClick={() => setConversationId(conversation.id)} className={`w-full rounded-xl px-3 py-3 text-left text-sm ${activeId === conversation.id ? 'bg-secondary font-bold text-primary' : 'text-muted-foreground hover:bg-secondary/60'}`} data-testid={`button-conversation-${conversation.id}`}><span className="block truncate">{conversation.title}</span><span className="mt-1 block font-mono text-[10px] font-normal opacity-60">{dateLabel(conversation.updatedAt)}</span></button>)}</div>{!conversations.length && <p className="px-3 py-4 text-xs leading-5 text-muted-foreground">Start a conversation and your questions will live here.</p>}</Card><Card className="flex min-h-[560px] flex-col overflow-hidden"><div className="flex items-center gap-3 border-b border-border bg-secondary/30 p-4 sm:p-5"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground"><Sparkles size={18} /></span><div><p className="text-sm font-bold">{conversations.find((c) => c.id === activeId)?.title || 'A fresh start'}</p><p className="mt-0.5 text-xs text-muted-foreground">Personal, practical, private</p></div></div>{!activeId ? <EmptyState title="Start with a question" body="Try asking what changed in your spending this month, or how to make room for a goal." action={<Button onClick={newConversation} data-testid="button-start-conversation"><Sparkles size={15} /> Start conversation</Button>} /> : <><div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-7">{messagesQuery.isLoading ? <><Skeleton className="h-16 w-3/4" /><Skeleton className="ml-auto h-12 w-2/3" /></> : messagesQuery.isError ? <ErrorState retry={() => messagesQuery.refetch()} /> : (messagesQuery.data || []).length ? (messagesQuery.data || []).map((message) => <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-secondary text-foreground'}`} data-testid={`message-${message.id}`}>{message.content}</div></div>) : <div className="py-10 text-center"><p className="font-serif text-2xl">What would make money feel clearer today?</p><div className="mt-5 flex flex-wrap justify-center gap-2">{['Where did I spend most this month?', 'Can I afford my savings goal?', 'Help me make a simple plan'].map((q) => <button key={q} onClick={() => setDraft(q)} className="rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary" data-testid={`button-suggestion-${q.slice(0, 5)}`}>{q}</button>)}</div></div>}{send.isPending && <div className="flex"><div className="rounded-2xl rounded-bl-sm bg-secondary px-4 py-3 text-xs text-muted-foreground">Thinking through it…</div></div>}</div><div className="border-t border-border p-4"><div className="flex items-end gap-2 rounded-2xl border border-input bg-background p-2 focus-within:border-primary"><textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} placeholder="Ask about your money…" rows={1} className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground" data-testid="input-assistant-message" /><button onClick={submit} disabled={send.isPending || !draft.trim()} className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40" data-testid="button-send-assistant"><Send size={16} /></button></div><p className="mt-2 text-center font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">Enter to send · Shift + Enter for a new line</p></div></>}</Card></div></AppShell>;
}

export function Settings() {
  const qc = useQueryClient(); const query = useGetProfile(); const update = useUpdateProfile(); const profile = query.data; const [name, setName] = useState(''); const [country, setCountry] = useState(''); const [theme, setTheme] = useState<ProfileTheme>('light'); const [initialized, setInitialized] = useState(false);
  if (profile && !initialized) { setName(profile.fullName); setCountry(profile.country); setTheme(profile.theme); setInitialized(true); }
  useEffect(() => { if (initialized) applyTheme(theme); }, [theme, initialized]);
  const save = () => update.mutate({ data: { fullName: name, country, preferredCurrency: 'UGX', theme } }, { onSuccess: (data) => { qc.setQueryData(getGetProfileQueryKey(), data); applyTheme(theme); } });
  if (query.isLoading) return <AppShell><Skeleton className="h-12 w-72" /><Skeleton className="mt-8 h-80 max-w-2xl" /></AppShell>;
  if (query.isError || !profile) return <AppShell><ErrorState retry={() => query.refetch()} /></AppShell>;
  return <AppShell><PageHeading eyebrow="Your preferences" title="Settings" description="Make Tereka feel like your own space." /><div className="max-w-3xl space-y-5"><Card className="p-5 sm:p-7"><div className="mb-6 flex items-center gap-4"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary font-serif text-xl text-primary-foreground">{name.slice(0, 1).toUpperCase()}</span><div><h2 className="font-serif text-2xl">{name || 'Your profile'}</h2><p className="mt-1 text-sm text-muted-foreground">{profile.email}</p></div></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Full name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} data-testid="input-profile-name" /></Field><Field label="Country"><input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Uganda" className={inputClass} data-testid="input-profile-country" /></Field></div></Card><Card className="p-5 sm:p-7"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Appearance</p><h2 className="mt-2 font-serif text-2xl">Choose your atmosphere</h2><div className="mt-5 grid gap-3 sm:grid-cols-3">{(['light', 'dark', 'system'] as ProfileTheme[]).map((option) => <button key={option} onClick={() => setTheme(option)} className={`rounded-2xl border p-4 text-left ${theme === option ? 'border-primary bg-secondary' : 'border-border hover:border-primary/40'}`} data-testid={`button-theme-${option}`}><span className={`mb-4 block h-12 rounded-xl ${option === 'dark' ? 'bg-sidebar' : option === 'system' ? 'bg-gradient-to-r from-background via-background to-sidebar' : 'bg-background border border-border'}`} /><p className="text-sm font-bold capitalize">{option}</p><p className="mt-1 text-xs text-muted-foreground">{option === 'system' ? 'Follow device' : `Use ${option} mode`}</p></button>)}</div></Card><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{update.isSuccess ? 'Saved just now.' : 'Changes are saved when you choose Save.'}</p><Button onClick={save} disabled={update.isPending} data-testid="button-save-settings">{update.isPending ? 'Saving…' : 'Save preferences'} <Check size={16} /></Button></div></div></AppShell>;
}

export { Dashboard, Transactions, Accounts, Budgets, Goals };