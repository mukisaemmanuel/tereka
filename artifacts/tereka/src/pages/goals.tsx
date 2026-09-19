import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Clock,
  Edit3,
  Flame,
  Goal as GoalIcon,
  HandCoins,
  Hourglass,
  Lock,
  LockOpen,
  Phone,
  PiggyBank,
  Plus,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { AppShell, Button, Card, EmptyState, Field, Modal, PageHeading, Skeleton, inputClass } from '@/components/layout';
import { compactMoney, dateLabel, formatCurrency, money } from '@/lib/finance';
import { useToast } from '@/hooks/use-toast';

interface FinancialGoalItem {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: 'UGX';
  targetDate?: string | null;
  status: 'active' | 'completed' | 'paused';
  percentageComplete: number;
  remainingAmount: number;
  isLocked: boolean;
  cooldownHours: number;
  pendingWithdrawalAmount: number | null;
  pendingWithdrawalAt: string | null;
  unlockAt: string | null;
  remainingCooldownSeconds: number;
  remainingCooldownHours: number;
  isCooldownActive: boolean;
  canExecuteWithdrawal: boolean;
  accountabilityPhone?: string | null;
}

interface GoalsResponse {
  goals: FinancialGoalItem[];
  availableSpendingCash: number;
  committedLockedSavings: number;
  totalGoalsCount: number;
}

interface AccountItem {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance?: number;
  openingBalance: string | number;
  isActive: boolean;
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('tereka_auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function Goals() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinancialGoalItem | null>(null);
  const [depositGoal, setDepositGoal] = useState<FinancialGoalItem | null>(null);
  const [withdrawGoal, setWithdrawGoal] = useState<FinancialGoalItem | null>(null);
  const [executeGoal, setExecuteGoal] = useState<FinancialGoalItem | null>(null);

  // Filter
  const [filter, setFilter] = useState<'all' | 'active' | 'locked' | 'cooldown'>('all');

  // Query Goals with 5-second interval for live countdowns
  const {
    data: goalsData,
    isLoading: isGoalsLoading,
    isError: isGoalsError,
    refetch: refetchGoals,
  } = useQuery<GoalsResponse>({
    queryKey: ['goals-summary'],
    queryFn: async () => {
      const res = await fetch('/api/goals', { headers: getAuthHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch goals');
      }
      return res.json();
    },
    refetchInterval: 10000,
  });

  // Query User Accounts (to fund or withdraw to)
  const { data: accountsData } = useQuery<{ accounts?: AccountItem[] } | AccountItem[]>({
    queryKey: ['accounts-for-goals'],
    queryFn: async () => {
      const res = await fetch('/api/accounts', { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const accounts: AccountItem[] = useMemo(() => {
    if (!accountsData) return [];
    if (Array.isArray(accountsData)) return accountsData;
    if (Array.isArray(accountsData.accounts)) return accountsData.accounts;
    return [];
  }, [accountsData]);

  const goals = goalsData?.goals || [];
  const availableSpendingCash = goalsData?.availableSpendingCash ?? 0;
  const committedLockedSavings = goalsData?.committedLockedSavings ?? 0;

  // Mutations
  const cancelWithdrawalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      const res = await fetch(`/api/goals/${goalId}/cancel-withdrawal`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to cancel withdrawal');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: '🎉 Smart Decision! Withdrawal Cancelled',
        description: data.message || 'Your funds remain locked and protected towards your goal.',
      });
      qc.invalidateQueries({ queryKey: ['goals-summary'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Error cancelling withdrawal',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      const res = await fetch(`/api/goals/${goalId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete goal');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Goal Deleted', description: 'Savings goal removed.' });
      qc.invalidateQueries({ queryKey: ['goals-summary'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // Filtered Goals
  const filteredGoals = useMemo(() => {
    return goals.filter((g) => {
      if (filter === 'active') return g.status === 'active';
      if (filter === 'locked') return g.isLocked;
      if (filter === 'cooldown') return g.isCooldownActive;
      return true;
    });
  }, [goals, filter]);

  return (
    <AppShell>
      <PageHeading
        eyebrow="Financial Discipline & Intentional Friction"
        title="Savings Goals & Cooling-Off Lock"
        description="Build real wealth by separating liquid spending money from protected, impulse-resistant savings."
        action={
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2.5 rounded-2xl shadow-sm"
            data-testid="button-add-goal"
          >
            <Plus size={18} />
            <span>New Savings Goal</span>
          </Button>
        }
      />

      {/* 1. DISTINCT HEADERS: AVAILABLE SPENDING CASH VS COMMITTED LOCKED SAVINGS */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Available Spending Cash Card */}
        <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card to-secondary/30 p-6 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Liquid Pocket
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Unrestricted</span>
              </div>
              <h2 className="mt-2 text-lg font-bold tracking-tight text-foreground">
                Available Spending Cash
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Total liquid balance in wallets, cash, and active current accounts.
              </p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-inner">
              <Wallet size={24} />
            </div>
          </div>

          <div className="mt-5 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {money(availableSpendingCash)}
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <span>Ready for daily transactions</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">Safe to spend</span>
          </div>
        </div>

        {/* Committed Locked Savings Card */}
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-card p-6 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                  <Lock size={12} className="text-amber-600 dark:text-amber-400" />
                  Intentional Friction Active
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-amber-600/80 dark:text-amber-400/80">
                  24h Cooling-Off
                </span>
              </div>
              <h2 className="mt-2 text-lg font-bold tracking-tight text-foreground">
                Committed Locked Savings
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Anti-impulse reserves. Protected by mandatory cooling-off delays before any withdrawal.
              </p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shadow-inner">
              <ShieldCheck size={26} />
            </div>
          </div>

          <div className="mt-5 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {money(committedLockedSavings)}
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <span>{goals.length} Protected Goal{goals.length === 1 ? '' : 's'}</span>
            <span className="font-medium text-amber-600 dark:text-amber-400">Impulse-proof</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Subtitle */}
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-foreground">Your Goals</h3>
          <p className="text-xs text-muted-foreground">
            Review progress, deposit into your dreams, or manage cooling-off periods.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-2xl border border-border bg-card p-1">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === 'all'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({goals.length})
          </button>
          <button
            onClick={() => setFilter('locked')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === 'locked'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Locked ({goals.filter((g) => g.isLocked).length})
          </button>
          <button
            onClick={() => setFilter('cooldown')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === 'cooldown'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-amber-600 dark:text-amber-400 hover:text-amber-500'
            }`}
          >
            In Cooldown ({goals.filter((g) => g.isCooldownActive).length})
          </button>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="mt-5">
        {isGoalsLoading ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-64 rounded-3xl" />
            ))}
          </div>
        ) : isGoalsError ? (
          <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-8 text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
            <h3 className="mt-3 font-serif text-xl font-bold">Failed to load goals</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              We couldn't retrieve your savings goals. Please try again.
            </p>
            <Button variant="secondary" onClick={() => refetchGoals()} className="mt-4">
              <RefreshCw size={16} className="mr-1.5" />
              Try Again
            </Button>
          </div>
        ) : filteredGoals.length === 0 ? (
          <Card className="rounded-3xl p-10 text-center">
            <EmptyState
              title="No savings goals found"
              body="Create your first goal to begin locking away money safely from impulse spending."
              action={
                <Button
                  onClick={() => setIsCreateOpen(true)}
                  className="bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-2xl"
                  data-testid="button-empty-add-goal"
                >
                  <Plus size={16} className="mr-1.5" /> Set a Savings Goal
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {filteredGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onDeposit={() => setDepositGoal(goal)}
                onWithdraw={() => setWithdrawGoal(goal)}
                onExecutePayout={() => setExecuteGoal(goal)}
                onEdit={() => setEditingGoal(goal)}
                onDelete={() => {
                  if (
                    window.confirm(
                      `Are you sure you want to delete the "${goal.name}" goal? Any existing balance must be withdrawn first.`
                    )
                  ) {
                    deleteGoalMutation.mutate(goal.id);
                  }
                }}
                onCancelWithdrawal={() => cancelWithdrawalMutation.mutate(goal.id)}
                isCancelling={cancelWithdrawalMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {isCreateOpen && (
        <CreateGoalModal
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => {
            setIsCreateOpen(false);
            qc.invalidateQueries({ queryKey: ['goals-summary'] });
          }}
        />
      )}

      {editingGoal && (
        <EditGoalModal
          goal={editingGoal}
          onClose={() => setEditingGoal(null)}
          onSuccess={() => {
            setEditingGoal(null);
            qc.invalidateQueries({ queryKey: ['goals-summary'] });
          }}
        />
      )}

      {depositGoal && (
        <DepositGoalModal
          goal={depositGoal}
          accounts={accounts}
          onClose={() => setDepositGoal(null)}
          onSuccess={() => {
            setDepositGoal(null);
            qc.invalidateQueries({ queryKey: ['goals-summary'] });
            qc.invalidateQueries({ queryKey: ['accounts-for-goals'] });
          }}
        />
      )}

      {withdrawGoal && (
        <RealityCheckWithdrawalModal
          goal={withdrawGoal}
          accounts={accounts}
          onClose={() => setWithdrawGoal(null)}
          onSuccess={() => {
            setWithdrawGoal(null);
            qc.invalidateQueries({ queryKey: ['goals-summary'] });
          }}
        />
      )}

      {executeGoal && (
        <ExecutePayoutModal
          goal={executeGoal}
          accounts={accounts}
          onClose={() => setExecuteGoal(null)}
          onSuccess={() => {
            setExecuteGoal(null);
            qc.invalidateQueries({ queryKey: ['goals-summary'] });
            qc.invalidateQueries({ queryKey: ['accounts-for-goals'] });
          }}
        />
      )}
    </AppShell>
  );
}

// ==============================================================================
// GOAL CARD COMPONENT
// ==============================================================================
interface GoalCardProps {
  goal: FinancialGoalItem;
  onDeposit: () => void;
  onWithdraw: () => void;
  onExecutePayout: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCancelWithdrawal: () => void;
  isCancelling: boolean;
}

function GoalCard({
  goal,
  onDeposit,
  onWithdraw,
  onExecutePayout,
  onEdit,
  onDelete,
  onCancelWithdrawal,
  isCancelling,
}: GoalCardProps) {
  // Live seconds countdown state for local responsiveness
  const [secondsRemaining, setSecondsRemaining] = useState(goal.remainingCooldownSeconds);

  useEffect(() => {
    setSecondsRemaining(goal.remainingCooldownSeconds);
  }, [goal.remainingCooldownSeconds]);

  useEffect(() => {
    if (!goal.isCooldownActive || secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [goal.isCooldownActive, secondsRemaining]);

  const formattedCountdown = useMemo(() => {
    if (secondsRemaining <= 0) return '0h 0m (Unlocked)';
    const hours = Math.floor(secondsRemaining / 3600);
    const mins = Math.floor((secondsRemaining % 3600) / 60);
    const secs = secondsRemaining % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  }, [secondsRemaining]);

  const isCooldownReady = goal.pendingWithdrawalAmount && secondsRemaining === 0;

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-3xl border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-md ${
        goal.isCooldownActive
          ? 'border-amber-500/50 ring-1 ring-amber-500/20'
          : 'border-border/80'
      }`}
      data-testid={`goal-card-${goal.id}`}
    >
      <div>
        {/* Top Badges & Actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Padlock Badge */}
            {goal.isLocked ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 border border-amber-500/30">
                <Lock size={12} className="text-amber-600 dark:text-amber-400" />
                {goal.cooldownHours || 24}-Hour Cooldown Protected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                <LockOpen size={12} />
                Unlocked
              </span>
            )}

            {goal.status === 'completed' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <Check size={12} /> Goal Achieved!
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="rounded-xl p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title="Edit Goal"
              data-testid={`button-edit-goal-${goal.id}`}
            >
              <Edit3 size={15} />
            </button>
            <button
              onClick={onDelete}
              className="rounded-xl p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Delete Goal"
              data-testid={`button-delete-goal-${goal.id}`}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Goal Title & Target Date */}
        <div className="mt-4 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/20 text-primary font-bold shadow-inner">
            <Target size={22} />
          </div>
          <div>
            <h3 className="font-serif text-xl font-bold tracking-tight text-foreground">
              {goal.name}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {goal.targetDate ? `Target: ${dateLabel(goal.targetDate, true)}` : 'Open-ended goal'}
              {goal.accountabilityPhone && (
                <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-primary">
                  <Phone size={10} /> {goal.accountabilityPhone}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Financial Progress */}
        <div className="mt-6 flex items-baseline justify-between">
          <div>
            <p className="font-mono text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              {money(goal.currentAmount)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Target of {money(goal.targetAmount)}
            </p>
          </div>
          <div className="text-right">
            <span className="font-mono text-2xl font-black text-primary">
              {goal.percentageComplete}%
            </span>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {money(goal.remainingAmount)} to go
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-secondary/80">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, Math.max(3, goal.percentageComplete))}%` }}
          />
        </div>

        {/* 2. AMBER COUNTDOWN ALERT (IF WITHDRAWAL IS PENDING) */}
        {goal.pendingWithdrawalAmount && goal.pendingWithdrawalAmount > 0 && (
          <div
            className={`mt-5 rounded-2xl border p-4 transition-all animate-in fade-in-50 duration-300 ${
              isCooldownReady
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100'
            }`}
            data-testid={`amber-countdown-alert-${goal.id}`}
          >
            <div className="flex items-start gap-3">
              {isCooldownReady ? (
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 animate-spin-slow" />
              )}

              <div className="flex-1 space-y-2">
                <div className="font-semibold text-sm leading-snug">
                  {isCooldownReady ? (
                    <span>
                      ✅ <strong>{money(goal.pendingWithdrawalAmount)}</strong> cooling-off timer has
                      finished! You may now disburse these funds.
                    </span>
                  ) : (
                    <span>
                      ⚠️ <strong>{money(goal.pendingWithdrawalAmount)}</strong> withdrawal requested.
                      Cooling-off timer active:{' '}
                      <span className="font-mono underline decoration-amber-500 font-bold">
                        {formattedCountdown}
                      </span>{' '}
                      remaining. You can still change your mind.
                    </span>
                  )}
                </div>

                <p className="text-xs opacity-85 leading-relaxed">
                  {isCooldownReady
                    ? 'The 24-hour reflection interval has passed. You can finalize the transfer to your chosen account, or cancel to keep your streak alive!'
                    : 'The Digital Bank Walk provides intentional friction against impulse spending. Sleep on it — your money is safe.'}
                </p>

                {/* Prominent Action Buttons on Pending Card */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onCancelWithdrawal}
                    disabled={isCancelling}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-bold shadow-sm transition-transform active:scale-95 disabled:opacity-50"
                    data-testid={`button-cancel-withdrawal-${goal.id}`}
                  >
                    <ShieldCheck size={14} />
                    <span>Cancel Withdrawal & Keep Saving</span>
                  </button>

                  {isCooldownReady && (
                    <button
                      type="button"
                      onClick={onExecutePayout}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-3.5 py-2 text-xs font-bold shadow-sm transition-transform active:scale-95"
                      data-testid={`button-execute-withdrawal-${goal.id}`}
                    >
                      <ArrowUpRight size={14} />
                      <span>Complete Payout to Account</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Card Action Buttons (Deposit / Withdraw) */}
      <div className="mt-6 flex items-center gap-2 border-t border-border/60 pt-4">
        <Button
          onClick={onDeposit}
          variant="secondary"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold border border-border/80 hover:bg-secondary/90 hover:text-primary transition-all"
          data-testid={`button-deposit-goal-${goal.id}`}
        >
          <ArrowDownLeft size={14} className="text-emerald-600 dark:text-emerald-400" />
          <span>+ Deposit / Save</span>
        </Button>

        <Button
          onClick={onWithdraw}
          variant="secondary"
          disabled={goal.currentAmount <= 0 || Boolean(goal.pendingWithdrawalAmount)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold border border-border/80 hover:bg-secondary/90 hover:text-amber-600 transition-all disabled:opacity-40"
          data-testid={`button-withdraw-goal-${goal.id}`}
          title={
            goal.pendingWithdrawalAmount
              ? 'A withdrawal is currently in cooling-off'
              : goal.currentAmount <= 0
              ? 'No funds in this goal'
              : 'Withdraw with intentional friction'
          }
        >
          <ArrowUpRight size={14} className="text-amber-600 dark:text-amber-400" />
          <span>Withdraw</span>
        </Button>
      </div>
    </div>
  );
}

// ==============================================================================
// 3. THE REALITY-CHECK INTERCEPT WITHDRAWAL MODAL
// ==============================================================================
interface RealityCheckModalProps {
  goal: FinancialGoalItem;
  accounts: AccountItem[];
  onClose: () => void;
  onSuccess: () => void;
}

function RealityCheckWithdrawalModal({ goal, accounts, onClose, onSuccess }: RealityCheckModalProps) {
  const { toast } = useToast();
  const [amountStr, setAmountStr] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState(accounts[0]?.id || '');
  const [hasConfirmedFriction, setHasConfirmedFriction] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amount = Number(amountStr) || 0;
  const cooldownHours = goal.cooldownHours || 24;

  // Reality Check Calculations: Calculate estimated delay on the goal
  const delayCalculations = useMemo(() => {
    if (!amount || amount <= 0) return null;

    // Projected new balance and completion drop
    const newCurrent = Math.max(0, goal.currentAmount - amount);
    const newPercentage =
      goal.targetAmount > 0
        ? Math.min(100, Math.round((newCurrent / goal.targetAmount) * 1000) / 10)
        : 0;

    // Estimate delay: assume an average monthly saving pace based on target or current progress
    // If user has target amount, say reasonable monthly commitment is ~10-15% of target
    const assumedMonthlyPace = Math.max(100000, Math.round(goal.targetAmount * 0.1));
    const delayMonths = Math.max(0.2, Math.round((amount / assumedMonthlyPace) * 10) / 10);
    const delayWeeks = Math.max(1, Math.round(delayMonths * 4.3));

    return {
      newCurrent,
      newPercentage,
      percentageDrop: Math.round((goal.percentageComplete - newPercentage) * 10) / 10,
      delayWeeks,
      delayMonths,
      delayLabel:
        delayWeeks > 8
          ? `${delayMonths} month${delayMonths === 1 ? '' : 's'}`
          : `${delayWeeks} week${delayWeeks === 1 ? '' : 's'}`,
    };
  }, [amount, goal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      toast({ title: 'Invalid Amount', description: 'Enter a withdrawal amount greater than zero.' });
      return;
    }
    if (amount > goal.currentAmount) {
      toast({
        title: 'Insufficient Balance',
        description: `You only have ${money(goal.currentAmount)} saved in this goal.`,
        variant: 'destructive',
      });
      return;
    }
    if (goal.isLocked && !hasConfirmedFriction) {
      toast({
        title: 'Confirmation Required',
        description: 'Please acknowledge the 24-hour cooling-off lock to proceed.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/goals/${goal.id}/request-withdrawal`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          amount,
          destinationAccountId: destinationAccountId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to request withdrawal');
      }

      if (data.status === 'cooldown_active') {
        toast({
          title: '⏳ Cooling-Off Period Initiated',
          description: data.message,
        });
      } else {
        toast({
          title: 'Withdrawal Completed',
          description: data.message || `Disbursed ${money(amount)} to your account.`,
        });
      }

      onSuccess();
    } catch (err: any) {
      toast({
        title: 'Withdrawal Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="The Digital Bank Walk — Reality Check" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Anti-Impulse Badge */}
        <div className="flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            <strong>Anti-Impulse Protection:</strong> This intercept forces deliberate reflection before
            you touch your hard-earned savings.
          </span>
        </div>

        {/* Current Goal Status */}
        <div className="rounded-2xl border border-border bg-secondary/30 p-4">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Goal Name:</span>
            <span className="font-semibold text-foreground">{goal.name}</span>
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
            <span>Saved Balance:</span>
            <span className="font-mono font-bold text-foreground">{money(goal.currentAmount)}</span>
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
            <span>Progress:</span>
            <span className="font-mono font-bold text-primary">{goal.percentageComplete}%</span>
          </div>
        </div>

        {/* Amount Input */}
        <Field label="Withdrawal Amount (UGX)">
          <div className="space-y-2">
            <input
              type="number"
              min="1000"
              max={goal.currentAmount}
              step="1000"
              required
              placeholder="e.g., 200000"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className={inputClass}
              data-testid="input-withdraw-amount"
            />
            {/* Quick Percentage Chips */}
            <div className="flex gap-2">
              {[0.25, 0.5, 0.75, 1.0].map((pct) => {
                const val = Math.round(goal.currentAmount * pct);
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setAmountStr(String(val))}
                    className="flex-1 rounded-xl border border-border bg-card py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-all"
                  >
                    {pct * 100}% ({compactMoney(val)})
                  </button>
                );
              })}
            </div>
          </div>
        </Field>

        {/* Dynamic Reality-Check Warning Box */}
        {delayCalculations && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-xs space-y-2 text-destructive animate-in fade-in duration-200">
            <div className="flex items-center gap-1.5 font-bold text-sm text-destructive">
              <AlertTriangle size={16} />
              <span>Are you sure?</span>
            </div>
            <p className="leading-relaxed">
              Withdrawing <strong>{money(amount)}</strong> for an impulse purchase will delay your{' '}
              <strong>"{goal.name}"</strong> target by approximately{' '}
              <span className="font-bold underline">{delayCalculations.delayLabel}</span> based on
              your savings pace.
            </p>
            <div className="grid grid-cols-2 gap-2 border-t border-destructive/20 pt-2 font-mono text-[11px]">
              <div>
                <span className="text-muted-foreground">Progress: </span>
                <span className="line-through">{goal.percentageComplete}%</span> →{' '}
                <span className="font-bold text-destructive">{delayCalculations.newPercentage}%</span>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground">Remaining: </span>
                <span className="font-bold">{money(goal.targetAmount - delayCalculations.newCurrent)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Friction Notice */}
        {goal.isLocked ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2 text-xs text-amber-950 dark:text-amber-200">
            <div className="flex items-center gap-1.5 font-bold">
              <Clock size={16} className="text-amber-600 dark:text-amber-400" />
              <span>Mandatory 24-Hour Cooling-Off Friction</span>
            </div>
            <p className="leading-relaxed">
              Funds will <strong>not</strong> be sent to your wallet immediately. A{' '}
              <strong>{cooldownHours}-hour cooling-off period</strong> will begin. You can change your
              mind and cancel at any point during the countdown to keep your money safe.
            </p>
            <label className="mt-3 flex items-start gap-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                required
                checked={hasConfirmedFriction}
                onChange={(e) => setHasConfirmedFriction(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                data-testid="checkbox-confirm-friction"
              />
              <span className="font-semibold select-none">
                I understand funds will enter a {cooldownHours}-hour lock and will NOT be released
                immediately.
              </span>
            </label>
          </div>
        ) : (
          <Field label="Destination Account">
            <select
              value={destinationAccountId}
              onChange={(e) => setDestinationAccountId(e.target.value)}
              className={inputClass}
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.type})
                </option>
              ))}
            </select>
          </Field>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-2xl px-4 py-2.5"
          >
            Cancel & Keep Saving
          </Button>
          <Button
            type="submit"
            disabled={
              isSubmitting ||
              amount <= 0 ||
              amount > goal.currentAmount ||
              (goal.isLocked && !hasConfirmedFriction)
            }
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-2xl px-5 py-2.5 shadow-sm"
            data-testid="button-confirm-withdrawal"
          >
            {isSubmitting
              ? 'Processing...'
              : goal.isLocked
              ? `Start ${cooldownHours}-Hour Cooling-Off`
              : 'Withdraw Funds'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ==============================================================================
// DEPOSIT / CONTRIBUTE MODAL
// ==============================================================================
interface DepositModalProps {
  goal: FinancialGoalItem;
  accounts: AccountItem[];
  onClose: () => void;
  onSuccess: () => void;
}

function DepositGoalModal({ goal, accounts, onClose, onSuccess }: DepositModalProps) {
  const { toast } = useToast();
  const [sourceAccountId, setSourceAccountId] = useState(accounts[0]?.id || '');
  const [amountStr, setAmountStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amount = Number(amountStr) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceAccountId) {
      toast({ title: 'Select Account', description: 'Please choose an account to pay from.' });
      return;
    }
    if (amount <= 0) {
      toast({ title: 'Invalid Amount', description: 'Please enter an amount to save.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/goals/${goal.id}/contribute`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          sourceAccountId,
          amount,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to deposit to goal');
      }

      toast({
        title: '🎉 Contribution Recorded!',
        description: data.message || `Saved ${money(amount)} into ${goal.name}.`,
      });
      onSuccess();
    } catch (err: any) {
      toast({
        title: 'Deposit Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={`Deposit into "${goal.name}"`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-2xl border border-border bg-secondary/30 p-4">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Goal:</span>
            <span className="font-semibold text-foreground">{goal.name}</span>
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>Current Progress:</span>
            <span className="font-mono font-bold text-primary">
              {money(goal.currentAmount)} / {money(goal.targetAmount)} ({goal.percentageComplete}%)
            </span>
          </div>
        </div>

        <Field label="Source Account / Wallet">
          <select
            value={sourceAccountId}
            onChange={(e) => setSourceAccountId(e.target.value)}
            className={inputClass}
            required
            data-testid="select-source-account"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({acc.type.toUpperCase()})
              </option>
            ))}
          </select>
        </Field>

        <Field label="Deposit Amount (UGX)">
          <div className="space-y-2">
            <input
              type="number"
              min="1000"
              step="1000"
              required
              placeholder="e.g., 50000"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className={inputClass}
              data-testid="input-deposit-amount"
            />
            <div className="flex flex-wrap gap-2">
              {[20000, 50000, 100000, 500000].map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => setAmountStr(String(quick))}
                  className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  +{compactMoney(quick)}
                </button>
              ))}
            </div>
          </div>
        </Field>

        <div className="flex items-center justify-end gap-3 pt-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || amount <= 0}
            className="bg-primary text-primary-foreground font-bold rounded-2xl px-5"
            data-testid="button-submit-deposit"
          >
            {isSubmitting ? 'Saving...' : `Deposit ${amount > 0 ? money(amount) : ''}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ==============================================================================
// EXECUTE PAYOUT MODAL (WHEN COOLDOWN HAS ELAPSED)
// ==============================================================================
interface ExecutePayoutModalProps {
  goal: FinancialGoalItem;
  accounts: AccountItem[];
  onClose: () => void;
  onSuccess: () => void;
}

function ExecutePayoutModal({ goal, accounts, onClose, onSuccess }: ExecutePayoutModalProps) {
  const { toast } = useToast();
  const [destinationAccountId, setDestinationAccountId] = useState(accounts[0]?.id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pendingAmount = goal.pendingWithdrawalAmount || 0;

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destinationAccountId) {
      toast({ title: 'Select Account', description: 'Please choose where to receive the funds.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/goals/${goal.id}/execute-withdrawal`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ destinationAccountId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete payout');
      }

      toast({
        title: '✅ Payout Completed!',
        description: data.message || `Disbursed ${money(pendingAmount)} to your account.`,
      });
      onSuccess();
    } catch (err: any) {
      toast({
        title: 'Execution Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Complete Payout After Cooling-Off" onClose={onClose}>
      <form onSubmit={handleExecute} className="space-y-4">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-950 dark:text-emerald-100">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span>Cooling-Off Period Successfully Completed</span>
          </div>
          <p className="mt-1">
            You waited out the full reflection timer. You may now deposit the requested{' '}
            <strong>{money(pendingAmount)}</strong> into your wallet or account.
          </p>
        </div>

        <Field label="Destination Account">
          <select
            value={destinationAccountId}
            onChange={(e) => setDestinationAccountId(e.target.value)}
            className={inputClass}
            required
            data-testid="select-payout-destination"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({acc.type.toUpperCase()})
              </option>
            ))}
          </select>
        </Field>

        <div className="flex items-center justify-end gap-3 pt-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !destinationAccountId}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl px-5"
            data-testid="button-confirm-payout"
          >
            {isSubmitting ? 'Transferring...' : `Disburse ${money(pendingAmount)}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ==============================================================================
// CREATE GOAL MODAL
// ==============================================================================
function CreateGoalModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [targetAmountStr, setTargetAmountStr] = useState('');
  const [initialAmountStr, setInitialAmountStr] = useState('0');
  const [targetDate, setTargetDate] = useState('');
  const [isLocked, setIsLocked] = useState(true);
  const [cooldownHours, setCooldownHours] = useState(24);
  const [accountabilityPhone, setAccountabilityPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetAmount = Number(targetAmountStr);
    const currentAmount = Number(initialAmountStr) || 0;

    if (!name.trim()) {
      toast({ title: 'Goal Name Required', description: 'Please provide a name for this goal.' });
      return;
    }
    if (!targetAmount || targetAmount <= 0) {
      toast({ title: 'Invalid Target', description: 'Target amount must be greater than zero.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          targetAmount,
          currentAmount,
          currency: 'UGX',
          targetDate: targetDate || undefined,
          isLocked,
          cooldownHours,
          accountabilityPhone: accountabilityPhone.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create goal');
      }

      toast({
        title: '🎯 Savings Goal Created!',
        description: `"${name}" is ready with ${isLocked ? '24h Cooling-Off Lock' : 'standard'} protection.`,
      });
      onSuccess();
    } catch (err: any) {
      toast({
        title: 'Error Creating Goal',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Set a New Savings Goal" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Goal Name">
          <input
            type="text"
            required
            placeholder="e.g., Buy Car, Land Deposit, Emergency Cushion"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            data-testid="input-goal-name"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Target Amount (UGX)">
            <input
              type="number"
              min="10000"
              step="10000"
              required
              placeholder="e.g., 5000000"
              value={targetAmountStr}
              onChange={(e) => setTargetAmountStr(e.target.value)}
              className={inputClass}
              data-testid="input-target-amount"
            />
          </Field>

          <Field label="Initial Deposit (UGX, optional)">
            <input
              type="number"
              min="0"
              step="1000"
              placeholder="0"
              value={initialAmountStr}
              onChange={(e) => setInitialAmountStr(e.target.value)}
              className={inputClass}
              data-testid="input-initial-amount"
            />
          </Field>
        </div>

        <Field label="Target Completion Date (Optional)">
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className={inputClass}
            data-testid="input-target-date"
          />
        </Field>

        {/* Cooling-Off Lock Toggle */}
        <div className="rounded-2xl border border-border bg-secondary/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-xs font-bold text-foreground">Anti-Impulse Cooling-Off Lock</p>
                <p className="text-[11px] text-muted-foreground">
                  Enforce an intentional waiting period before withdrawals can occur.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isLocked}
              onChange={(e) => setIsLocked(e.target.checked)}
              className="h-5 w-5 rounded border-border text-primary focus:ring-primary"
              data-testid="checkbox-toggle-lock"
            />
          </div>

          {isLocked && (
            <div className="pt-2 border-t border-border/60">
              <Field label="Cooling-Off Period (Hours)">
                <select
                  value={cooldownHours}
                  onChange={(e) => setCooldownHours(Number(e.target.value))}
                  className={inputClass}
                >
                  <option value={12}>12 Hours (Short walk)</option>
                  <option value={24}>24 Hours (Recommended Digital Bank Walk)</option>
                  <option value={48}>48 Hours (Major purchase deliberation)</option>
                  <option value={72}>72 Hours (Strict lock)</option>
                </select>
              </Field>
            </div>
          )}
        </div>

        <Field label="Accountability Partner Phone (Optional SMS Alert)">
          <input
            type="tel"
            placeholder="e.g., +256770123456"
            value={accountabilityPhone}
            onChange={(e) => setAccountabilityPhone(e.target.value)}
            className={inputClass}
            data-testid="input-accountability-phone"
          />
        </Field>

        <div className="flex items-center justify-end gap-3 pt-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-primary text-primary-foreground font-bold rounded-2xl px-5"
            data-testid="button-create-goal-submit"
          >
            {isSubmitting ? 'Creating...' : 'Create Protected Goal'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ==============================================================================
// EDIT GOAL MODAL
// ==============================================================================
function EditGoalModal({
  goal,
  onClose,
  onSuccess,
}: {
  goal: FinancialGoalItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(goal.name);
  const [targetAmountStr, setTargetAmountStr] = useState(String(goal.targetAmount));
  const [targetDate, setTargetDate] = useState(goal.targetDate ? goal.targetDate.slice(0, 10) : '');
  const [isLocked, setIsLocked] = useState(goal.isLocked);
  const [cooldownHours, setCooldownHours] = useState(goal.cooldownHours || 24);
  const [accountabilityPhone, setAccountabilityPhone] = useState(goal.accountabilityPhone || '');
  const [status, setStatus] = useState<string>(goal.status);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetAmount = Number(targetAmountStr);

    if (!name.trim()) {
      toast({ title: 'Goal Name Required', description: 'Please provide a name.' });
      return;
    }
    if (!targetAmount || targetAmount <= 0) {
      toast({ title: 'Invalid Target', description: 'Target amount must be greater than zero.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          targetAmount,
          targetDate: targetDate || undefined,
          isLocked,
          cooldownHours,
          status,
          accountabilityPhone: accountabilityPhone.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update goal');
      }

      toast({ title: 'Goal Updated', description: `Changes to "${name}" saved successfully.` });
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Update Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={`Edit "${goal.name}"`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Goal Name">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Target Amount (UGX)">
          <input
            type="number"
            min="10000"
            step="10000"
            required
            value={targetAmountStr}
            onChange={(e) => setTargetAmountStr(e.target.value)}
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Target Date">
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputClass}
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </Field>
        </div>

        <div className="rounded-2xl border border-border bg-secondary/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-xs font-bold text-foreground">Anti-Impulse Cooling-Off Lock</p>
                <p className="text-[11px] text-muted-foreground">
                  Protect savings against immediate withdrawal.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isLocked}
              onChange={(e) => setIsLocked(e.target.checked)}
              className="h-5 w-5 rounded border-border text-primary focus:ring-primary"
            />
          </div>

          {isLocked && (
            <div className="pt-2 border-t border-border/60">
              <Field label="Cooling-Off Period (Hours)">
                <select
                  value={cooldownHours}
                  onChange={(e) => setCooldownHours(Number(e.target.value))}
                  className={inputClass}
                >
                  <option value={12}>12 Hours</option>
                  <option value={24}>24 Hours</option>
                  <option value={48}>48 Hours</option>
                  <option value={72}>72 Hours</option>
                </select>
              </Field>
            </div>
          )}
        </div>

        <Field label="Accountability Phone">
          <input
            type="tel"
            value={accountabilityPhone}
            onChange={(e) => setAccountabilityPhone(e.target.value)}
            className={inputClass}
          />
        </Field>

        <div className="flex items-center justify-end gap-3 pt-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-primary text-primary-foreground font-bold rounded-2xl px-5"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
