/**
 * ==============================================================================
 * TEREKA FINANCIAL INTELLIGENCE - DEBTS & OWED MODULE (FRONTEND)
 * ==============================================================================
 * 
 * This page provides a unified view for managing peer lending and borrowing:
 * 
 * Key Components:
 * 1. Summary Cards:
 *    - "Total Owed to You" (Asset / Money lent out)
 *    - "Total You Owe" (Liability / Money borrowed)
 *    - "Net Position" (Net balance between assets and liabilities)
 * 
 * 2. Segmented Tabs & Filters:
 *    - Toggle between "Owed to You" and "You Owe"
 *    - Filter by Status: "Active only", "Settled only", "All records"
 * 
 * 3. Debt Card:
 *    - Counterparty name, principal vs. remaining balance, progress bar (% settled),
 *      due date warning, and repayment history dropdown.
 * 
 * 4. Add Debt Modal:
 *    - Logs new borrowing/lending with East African zero-decimal formatting and
 *      optional instant wallet disbursement/receipt.
 * 
 * 5. Record Repayment Modal:
 *    - Logs partial or full settlements, updates remaining balance in real time,
 *      and synchronizes with selected payment wallets (e.g. MTN MoMo, Physical Cash).
 */

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Clock,
  Coins,
  CreditCard,
  Handshake,
  History,
  Plus,
  RefreshCw,
  Sparkles,
  User,
  Wallet,
} from 'lucide-react';
import {
  Currency,
  DebtStatus,
  DebtType,
  getGetAccountsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetDebtsQueryKey,
  useCreateDebt,
  useGetAccounts,
  useGetDebts,
  useGetProfile,
  usePayDebt,
  type Account,
  type Currency as CurrencyType,
  type Debt,
  type DebtPayment,
} from '@workspace/api-client-react';
import { AppShell, Button, Card, EmptyState, Field, Modal, PageHeading, Skeleton, inputClass } from '@/components/layout';
import { compactMoney, dateLabel, formatCurrency } from '@/lib/finance';

const currencies = Object.values(Currency);

/**
 * Fallback error state if the API is temporarily unreachable
 */
function ErrorState({ retry }: { retry: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
      <p className="font-serif text-xl">Unable to load debts</p>
      <p className="mt-2 text-sm text-muted-foreground">Could not connect to your debt and liability ledger.</p>
      <Button variant="secondary" onClick={retry} className="mt-4" data-testid="button-retry-debts">
        <RefreshCw size={15} /> Try again
      </Button>
    </div>
  );
}

/**
 * Main Debts & Owed page container
 */
export function Debts() {
  const qc = useQueryClient();
  const debtsQuery = useGetDebts();
  const accountsQuery = useGetAccounts();
  const profileQuery = useGetProfile();

  // Tab & Filter States
  const [activeTab, setActiveTab] = useState<'owed_to_you' | 'you_owe'>('owed_to_you');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'settled'>('active');
  
  // Modal States
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [repayModalDebt, setRepayModalDebt] = useState<Debt | null>(null);

  const debts = debtsQuery.data || [];
  const accounts = (accountsQuery.data || []).filter((a) => a.isActive);
  const userCurrency = profileQuery.data?.preferredCurrency || 'UGX';

  // 1. Compute total money owed to user (Asset)
  const totalOwedToYou = useMemo(() => {
    return debts
      .filter((d) => d.type === 'owed_to_you' && d.status === 'active')
      .reduce((sum, d) => sum + d.remainingAmount, 0);
  }, [debts]);

  // 2. Compute total money user owes to others (Liability)
  const totalYouOwe = useMemo(() => {
    return debts
      .filter((d) => d.type === 'you_owe' && d.status === 'active')
      .reduce((sum, d) => sum + d.remainingAmount, 0);
  }, [debts]);

  // 3. Net Liquidity Position
  const netPosition = totalOwedToYou - totalYouOwe;

  // 4. Filter list based on selected tab and active/settled filter
  const filteredDebts = useMemo(() => {
    return debts.filter((d) => {
      if (d.type !== activeTab) return false;
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      return true;
    });
  }, [debts, activeTab, statusFilter]);

  const owedToYouCount = debts.filter((d) => d.type === 'owed_to_you' && d.status === 'active').length;
  const youOweCount = debts.filter((d) => d.type === 'you_owe' && d.status === 'active').length;

  return (
    <AppShell>
      <PageHeading
        eyebrow="Commitments & Cashflow"
        title="Debts & Owed"
        description="Track peer loans, SACCO borrowings, and credit in one balanced view. Reconcile repayments directly to your mobile money or cash wallets."
        action={
          <Button onClick={() => setAddModalOpen(true)} data-testid="button-add-debt-main">
            <Plus size={16} /> Log a debt / loan
          </Button>
        }
      />

      {/* Summary Cards: Asset, Liability, Net Position */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Card 1: Owed to You */}
        <Card className="relative overflow-hidden p-5">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-emerald-500/10" />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Owed to You (Asset)</p>
              </div>
              <p className="mt-3 text-2xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalOwedToYou, userCurrency)}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {owedToYouCount} active {owedToYouCount === 1 ? 'person owes' : 'people owe'} you
              </p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ArrowDownLeft size={20} />
            </span>
          </div>
        </Card>

        {/* Card 2: You Owe */}
        <Card className="relative overflow-hidden p-5">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-amber-500/10" />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">You Owe (Liability)</p>
              </div>
              <p className="mt-3 text-2xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400">
                {formatCurrency(totalYouOwe, userCurrency)}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {youOweCount} active {youOweCount === 1 ? 'obligation' : 'obligations'} to clear
              </p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ArrowUpRight size={20} />
            </span>
          </div>
        </Card>

        {/* Card 3: Net Position */}
        <Card className="relative overflow-hidden p-5">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-primary/10" />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Net Position</p>
              </div>
              <p className={`mt-3 text-2xl font-extrabold tracking-tight ${netPosition >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {netPosition >= 0 ? '+' : '−'}
                {formatCurrency(Math.abs(netPosition), userCurrency)}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {netPosition >= 0 ? 'Net positive liquidity owed' : 'Net liability outstanding'}
              </p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary">
              <Handshake size={20} />
            </span>
          </div>
        </Card>
      </div>

      {/* Main Section */}
      <div className="mt-8 space-y-6">
        {/* Segmented Tab Controls & Filters */}
        <div className="flex flex-col justify-between gap-4 border-b border-border/80 pb-4 sm:flex-row sm:items-center">
          <div className="flex rounded-2xl bg-secondary/70 p-1">
            <button
              onClick={() => setActiveTab('owed_to_you')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'owed_to_you'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="tab-owed-to-you"
            >
              <ArrowDownLeft size={14} className="text-emerald-500" />
              <span>Owed to You</span>
              {owedToYouCount > 0 && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] text-emerald-700 dark:text-emerald-300">
                  {owedToYouCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('you_owe')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'you_owe'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="tab-you-owe"
            >
              <ArrowUpRight size={14} className="text-amber-500" />
              <span>You Owe</span>
              {youOweCount > 0 && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] text-amber-700 dark:text-amber-300">
                  {youOweCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className={`${inputClass} !py-1.5 !text-xs sm:w-36`}
              data-testid="select-debt-status-filter"
            >
              <option value="active">Active only</option>
              <option value="settled">Settled only</option>
              <option value="all">All records</option>
            </select>
          </div>
        </div>

        {/* List of Debts */}
        {debtsQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        ) : debtsQuery.isError ? (
          <ErrorState retry={() => debtsQuery.refetch()} />
        ) : filteredDebts.length === 0 ? (
          <Card className="p-8">
            <EmptyState
              title={
                activeTab === 'owed_to_you'
                  ? statusFilter === 'settled'
                    ? 'No settled loans to show'
                    : 'No money currently owed to you'
                  : statusFilter === 'settled'
                  ? 'No settled borrowings to show'
                  : 'You have no outstanding liabilities'
              }
              body={
                activeTab === 'owed_to_you'
                  ? 'When you lend money to friends, family, or partners, log it here to track repayments accurately.'
                  : 'Track SACCO credits, salary advances, or peer borrowings so your net worth reflects reality.'
              }
              action={
                <Button onClick={() => setAddModalOpen(true)} data-testid="button-empty-add-debt">
                  <Plus size={15} /> Log debt record
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredDebts.map((debt) => (
              <DebtCard
                key={debt.id}
                debt={debt}
                onRepay={() => setRepayModalDebt(debt)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal: Add New Debt / Loan */}
      {addModalOpen && (
        <AddDebtModal
          accounts={accounts}
          defaultCurrency={userCurrency}
          initialType={activeTab}
          onClose={() => setAddModalOpen(false)}
        />
      )}

      {/* Modal: Record Repayment Installment */}
      {repayModalDebt && (
        <RepaymentModal
          debt={repayModalDebt}
          accounts={accounts}
          onClose={() => setRepayModalDebt(null)}
        />
      )}
    </AppShell>
  );
}

/**
 * Individual Debt Card displaying borrower/creditor, remaining amount, and progress bar
 */
function DebtCard({ debt, onRepay }: { debt: Debt; onRepay: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const isOwedToYou = debt.type === 'owed_to_you';
  const isSettled = debt.status === 'settled' || debt.remainingAmount <= 0;

  // Percentage calculation
  const percentageSettled =
    debt.principalAmount > 0
      ? Math.min(100, Math.round(((debt.principalAmount - debt.remainingAmount) / debt.principalAmount) * 100))
      : 100;

  // Overdue check
  const isOverdue =
    !isSettled && debt.dueDate && new Date(debt.dueDate).getTime() < new Date().setHours(0, 0, 0, 0);

  return (
    <Card className="flex flex-col justify-between p-5 transition-shadow hover:shadow-md">
      <div>
        {/* Top Badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                isOwedToYou
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
              }`}
            >
              {isOwedToYou ? 'Owed to You' : 'You Owe'}
            </span>
            <h3 className="mt-2 truncate font-serif text-lg font-bold text-foreground">
              {debt.personOrEntity}
            </h3>
          </div>

          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
              isSettled
                ? 'bg-primary/10 text-primary'
                : isOverdue
                ? 'bg-destructive/10 text-destructive'
                : 'bg-secondary text-muted-foreground'
            }`}
          >
            {isSettled ? (
              <>
                <CheckCircle2 size={13} /> Settled
              </>
            ) : isOverdue ? (
              <>
                <Clock size={13} /> Overdue
              </>
            ) : (
              'Active'
            )}
          </span>
        </div>

        {/* Amounts & Progress */}
        <div className="mt-4 rounded-xl bg-secondary/40 p-3">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Remaining</span>
            <span className="font-mono text-base font-extrabold text-foreground">
              {formatCurrency(debt.remainingAmount, debt.currency)}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between text-xs text-muted-foreground">
            <span>Original Principal:</span>
            <span>{formatCurrency(debt.principalAmount, debt.currency)}</span>
          </div>

          {/* Visual Progress Bar */}
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div
                className={`h-full transition-all duration-500 ${
                  isSettled ? 'bg-primary' : isOwedToYou ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${percentageSettled}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>{percentageSettled}% paid</span>
              <span>{formatCurrency(debt.principalAmount - debt.remainingAmount, debt.currency)} cleared</span>
            </div>
          </div>
        </div>

        {/* Due Date & Notes */}
        <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
          {debt.dueDate && (
            <div className="flex items-center gap-1.5">
              <Calendar size={13} className={isOverdue ? 'text-destructive' : 'text-muted-foreground'} />
              <span>Due: {dateLabel(debt.dueDate, true)}</span>
            </div>
          )}
          {debt.notes && (
            <p className="line-clamp-2 italic text-foreground/70">
              "{debt.notes}"
            </p>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-5 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-2">
          {isSettled ? (
            <span className="text-xs font-semibold text-primary">Fully cleared</span>
          ) : (
            <Button
              onClick={onRepay}
              variant="primary"
              className="!py-1.5 !text-xs"
              data-testid={`button-repay-debt-${debt.id}`}
            >
              <Coins size={14} /> Record Repayment
            </Button>
          )}

          {debt.payments && debt.payments.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"
              data-testid={`button-toggle-history-${debt.id}`}
            >
              <History size={13} />
              <span>{debt.payments.length} {debt.payments.length === 1 ? 'payment' : 'payments'}</span>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>

        {/* Repayment History Accordion */}
        {expanded && debt.payments && debt.payments.length > 0 && (
          <div className="mt-3 divide-y divide-border/60 rounded-xl border border-border bg-card p-3 text-xs">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Repayment Log</p>
            {debt.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-semibold text-foreground">
                    {formatCurrency(p.amount, debt.currency)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.accountName ? `via ${p.accountName} · ` : ''}
                    {dateLabel(p.paidAt)}
                  </p>
                  {p.notes && <p className="text-[11px] italic text-muted-foreground/80">{p.notes}</p>}
                </div>
                <Check size={14} className="text-primary" />
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Modal for creating a new Debt / Peer Loan record
 */
function AddDebtModal({
  accounts,
  defaultCurrency,
  initialType,
  onClose,
}: {
  accounts: Account[];
  defaultCurrency: CurrencyType;
  initialType: 'owed_to_you' | 'you_owe';
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const createDebt = useCreateDebt();

  const [type, setType] = useState<DebtType>(initialType as DebtType);
  const [personOrEntity, setPersonOrEntity] = useState('');
  const [principalAmount, setPrincipalAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyType>(defaultCurrency);
  const [dueDate, setDueDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Math.round(Number(principalAmount));
    if (!amountNum || amountNum <= 0) {
      alert('Please enter a valid principal amount greater than 0.');
      return;
    }
    if (!personOrEntity.trim()) {
      alert('Please enter the name of the person or entity.');
      return;
    }

    createDebt.mutate(
      {
        data: {
          personOrEntity: personOrEntity.trim(),
          type,
          principalAmount: amountNum,
          currency,
          dueDate: dueDate && dueDate.trim() !== '' ? dueDate : undefined,
          accountId: accountId && accountId.trim() !== '' ? accountId : undefined,
          notes: notes && notes.trim() !== '' ? notes.trim() : undefined,
        },
      },
      {
        onSuccess: () => {
          // Invalidate and refresh all debt, account, and summary views
          qc.invalidateQueries({ queryKey: getGetDebtsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetAccountsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          onClose();
        },
        onError: (err: any) => {
          console.error('Failed to create debt record:', err);
          alert(err.message || 'Could not save debt record to database. Please check your connection.');
        },
      }
    );
  };

  return (
    <Modal title="Log a Debt / Loan" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type Toggle: Lent vs Borrowed */}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-secondary/60 p-1">
          <button
            type="button"
            onClick={() => setType('owed_to_you')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
              type === 'owed_to_you' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
            data-testid="select-type-owed-to-you"
          >
            <ArrowDownLeft size={14} className="text-emerald-500" />
            <span>I Lent Money</span>
          </button>
          <button
            type="button"
            onClick={() => setType('you_owe')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
              type === 'you_owe' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
            data-testid="select-type-you-owe"
          >
            <ArrowUpRight size={14} className="text-amber-500" />
            <span>I Borrowed Money</span>
          </button>
        </div>

        <Field label="Counterparty (Person or Entity)">
          <input
            required
            type="text"
            value={personOrEntity}
            onChange={(e) => setPersonOrEntity(e.target.value)}
            placeholder={type === 'owed_to_you' ? 'e.g. John Katende, Sarah Namubiru' : 'e.g. Wandegeya SACCO, Bank loan'}
            className={inputClass}
            data-testid="input-debt-person"
          />
        </Field>

        <Field label="Principal Amount (UGX)">
          <input
            required
            type="number"
            min="1"
            step="1"
            value={principalAmount}
            onChange={(e) => setPrincipalAmount(e.target.value)}
            placeholder="0"
            className={inputClass}
            data-testid="input-debt-amount"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Due Date (Optional)">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
              data-testid="input-debt-due-date"
            />
          </Field>

          <Field label={type === 'owed_to_you' ? 'Lent from Account' : 'Received into Account'}>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={inputClass}
              data-testid="select-debt-funding-account"
            >
              <option value="">Do not adjust wallet</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Notes / Agreement Details">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Car repair advance, 0% interest"
            className={inputClass}
            data-testid="input-debt-notes"
          />
        </Field>

        <div className="mt-4 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            data-testid="button-cancel-debt"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createDebt.isPending}
            data-testid="button-save-debt"
          >
            {createDebt.isPending ? 'Saving to ledger…' : 'Save Debt Record'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Modal for recording a partial or full repayment on a debt
 */
function RepaymentModal({
  debt,
  accounts,
  onClose,
}: {
  debt: Debt;
  accounts: Account[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const payDebt = usePayDebt();

  const [amount, setAmount] = useState(String(debt.remainingAmount));
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const isOwedToYou = debt.type === 'owed_to_you';

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Math.round(Number(amount));
    if (!amountNum || amountNum <= 0) {
      alert('Please enter a valid repayment amount.');
      return;
    }

    payDebt.mutate(
      {
        id: debt.id,
        data: {
          amount: amountNum,
          accountId: accountId && accountId.trim() !== '' ? accountId : undefined,
          paidAt: paidAt ? new Date(paidAt).toISOString() : undefined,
          notes: notes && notes.trim() !== '' ? notes.trim() : undefined,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetDebtsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetAccountsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          onClose();
        },
        onError: (err: any) => {
          console.error('Failed to record repayment:', err);
          alert(err.message || 'Could not record repayment. Please try again.');
        },
      }
    );
  };

  return (
    <Modal title="Record Repayment" onClose={onClose}>
      <div className="mb-4 rounded-2xl bg-secondary/50 p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Debt Context</p>
        <div className="mt-1 flex items-baseline justify-between">
          <p className="font-serif text-lg font-bold">{debt.personOrEntity}</p>
          <span className="font-mono text-sm font-extrabold text-foreground">
            {formatCurrency(debt.remainingAmount, debt.currency)} remaining
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {isOwedToYou
            ? 'Receiving payment from debtor into your wallet.'
            : 'Paying back your obligation out of your chosen account.'}
        </p>
      </div>

      <form onSubmit={handlePay} className="space-y-4">
        <Field label="Repayment Amount">
          <div className="space-y-2">
            <input
              required
              type="number"
              min="1"
              max={debt.remainingAmount}
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className={inputClass}
              data-testid="input-repay-amount"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAmount(String(debt.remainingAmount))}
                className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-primary hover:bg-secondary/80"
                data-testid="button-repay-full-balance"
              >
                Pay Full Balance ({formatCurrency(debt.remainingAmount, debt.currency)})
              </button>
              {debt.remainingAmount > 100000 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(Math.round(debt.remainingAmount / 2)))}
                  className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-secondary/80"
                >
                  50% ({formatCurrency(Math.round(debt.remainingAmount / 2), debt.currency)})
                </button>
              )}
            </div>
          </div>
        </Field>

        <Field label={isOwedToYou ? 'Deposit to Account' : 'Pay from Account'}>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className={inputClass}
            data-testid="select-repay-account"
          >
            <option value="">Do not adjust balance</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment Date">
            <input
              required
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className={inputClass}
              data-testid="input-repay-date"
            />
          </Field>

          <Field label="Reference / Notes">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. MoMo Ref: 981290"
              className={inputClass}
              data-testid="input-repay-notes"
            />
          </Field>
        </div>

        <div className="mt-4 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            data-testid="button-cancel-repayment"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={payDebt.isPending}
            data-testid="button-submit-repayment"
          >
            {payDebt.isPending ? 'Processing repayment…' : 'Confirm Repayment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default Debts;
