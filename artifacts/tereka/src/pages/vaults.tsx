import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  CreditCard,
  FileCheck2,
  HelpCircle,
  Landmark,
  Lock,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Split,
  ThumbsDown,
  ThumbsUp,
  Unlock,
  UserCheck,
  UserPlus,
  Users,
  Vote,
  Wallet,
  X,
} from 'lucide-react';
import { AppShell, PageHeading } from '@/components/layout';
import { formatCurrency, dateLabel } from '@/lib/finance';
import { useToast } from '@/hooks/use-toast';

export interface VaultMember {
  id: string;
  vaultId: string;
  userId?: string | null;
  name: string;
  phone: string;
  role: 'chairman' | 'treasurer' | 'keyholder' | 'member';
  targetContribution: number;
  totalContributed: number;
  joinedAt: string;
}

export interface VaultLedgerEntry {
  id: string;
  vaultId: string;
  memberId?: string | null;
  memberName: string;
  type: 'deposit' | 'payout';
  amount: number;
  currency: string;
  paymentMethod: string;
  reference?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface VaultVote {
  id: string;
  proposalId: string;
  memberId: string;
  memberName: string;
  vote: 'yes' | 'no';
  comment?: string | null;
  createdAt: string;
}

export interface PayoutProposal {
  id: string;
  vaultId: string;
  proposerMemberId: string;
  proposerName: string;
  title: string;
  amount: number;
  currency: string;
  destinationType: 'vendor_bank' | 'momo_number' | 'split_equally_to_members';
  recipientName: string;
  bankName?: string | null;
  accountNumber?: string | null;
  phone?: string | null;
  status: 'voting_active' | 'approved' | 'rejected' | 'disbursed';
  requiredVotes: number;
  yesVotesCount: number;
  noVotesCount: number;
  disbursedAt?: string | null;
  createdAt: string;
  votes?: VaultVote[];
  hasUserVoted?: boolean;
  userVote?: 'yes' | 'no' | null;
}

export interface VaultItem {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  lockType: 'time_locked' | 'target_locked' | 'both';
  unlockDate?: string | null;
  minSignaturesRequired: number;
  status: 'active' | 'unlocked' | 'archived';
  createdAt: string;
  membersCount: number;
  percentageComplete: number;
  remainingAmount: number;
  isLocked: boolean;
  isTimeLocked: boolean;
  isTargetLocked: boolean;
  userRole: string;
  activeProposalsCount: number;
}

const UGANDAN_BANKS = [
  'Stanbic Bank Uganda',
  'Centenary Bank',
  'dfcu Bank',
  'Absa Bank Uganda',
  'Standard Chartered Uganda',
  'Equity Bank Uganda',
  'PostBank Uganda',
  'Bank of Baroda',
  'DTB Uganda',
  'Finance Trust Bank',
];

export function Vaults() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // State
  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ballots' | 'members' | 'ledger'>('ballots');
  const [filterLock, setFilterLock] = useState<'all' | 'time' | 'target' | 'unlocked'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  // Forms
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    targetAmount: '10000000',
    lockType: 'time_locked' as 'time_locked' | 'target_locked' | 'both',
    unlockDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    minSignaturesRequired: 2,
  });

  const [proposeForm, setProposeForm] = useState({
    title: '',
    amount: '',
    destinationType: 'momo_number' as 'vendor_bank' | 'momo_number' | 'split_equally_to_members',
    recipientName: '',
    bankName: 'Stanbic Bank Uganda',
    accountNumber: '',
    phone: '',
  });

  const [depositForm, setDepositForm] = useState({
    memberId: '',
    memberName: '',
    amount: '100000',
    paymentMethod: 'mtn_momo' as 'mtn_momo' | 'airtel_money' | 'bank_transfer' | 'cash',
    reference: '',
    note: '',
  });

  const [memberForm, setMemberForm] = useState({
    name: '',
    phone: '',
    role: 'member' as 'chairman' | 'treasurer' | 'keyholder' | 'member',
    targetContribution: '1000000',
  });

  // Query Vaults List
  const vaultsQuery = useQuery<{
    vaults: VaultItem[];
    totalLockedSavings: number;
    activeVaultsCount: number;
    totalMembersCount: number;
    pendingBallotsCount: number;
  }>({
    queryKey: ['vaults'],
    queryFn: async () => {
      const token = localStorage.getItem('tereka_auth_token');
      const res = await fetch('/api/vaults', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to load vaults');
      return res.json();
    },
  });

  // Query Single Vault Details
  const vaultDetailQuery = useQuery<{
    vault: VaultItem & { userMemberId?: string };
    members: VaultMember[];
    ledger: VaultLedgerEntry[];
    proposals: PayoutProposal[];
  }>({
    queryKey: ['vault-detail', selectedVaultId],
    queryFn: async () => {
      const token = localStorage.getItem('tereka_auth_token');
      const res = await fetch(`/api/vaults/${selectedVaultId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to load vault details');
      return res.json();
    },
    enabled: !!selectedVaultId,
  });

  // Mutations
  const createVaultMutation = useMutation({
    mutationFn: async (payload: any) => {
      const token = localStorage.getItem('tereka_auth_token');
      const res = await fetch('/api/vaults', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create vault');
      }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['vaults'] });
      setShowCreateModal(false);
      setSelectedVaultId(data.vault.id);
      toast({
        title: 'Vault Created',
        description: `"${data.vault.title}" is now active and protected with multi-signature governance.`,
      });
    },
    onError: (err: any) => {
      toast({ title: 'Creation Failed', description: err.message, variant: 'destructive' });
    },
  });

  const proposePayoutMutation = useMutation({
    mutationFn: async (payload: any) => {
      const token = localStorage.getItem('tereka_auth_token');
      const res = await fetch(`/api/vaults/${selectedVaultId}/proposals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit proposal');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vault-detail', selectedVaultId] });
      qc.invalidateQueries({ queryKey: ['vaults'] });
      setShowProposeModal(false);
      setProposeForm({
        title: '',
        amount: '',
        destinationType: 'momo_number',
        recipientName: '',
        bankName: 'Stanbic Bank Uganda',
        accountNumber: '',
        phone: '',
      });
      toast({
        title: 'Payout Ballot Opened',
        description: 'Destination proposal is now live for member voting.',
      });
    },
    onError: (err: any) => {
      toast({ title: 'Proposal Error', description: err.message, variant: 'destructive' });
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ proposalId, vote, comment }: { proposalId: string; vote: 'yes' | 'no'; comment?: string }) => {
      const token = localStorage.getItem('tereka_auth_token');
      const res = await fetch(`/api/vaults/proposals/${proposalId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ vote, comment }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to cast vote');
      }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['vault-detail', selectedVaultId] });
      qc.invalidateQueries({ queryKey: ['vaults'] });
      toast({
        title: data.approved ? 'Destination Approved & Disbursed!' : 'Vote Cast',
        description: data.message,
      });
    },
    onError: (err: any) => {
      toast({ title: 'Voting Error', description: err.message, variant: 'destructive' });
    },
  });

  const depositMutation = useMutation({
    mutationFn: async (payload: any) => {
      const token = localStorage.getItem('tereka_auth_token');
      const res = await fetch(`/api/vaults/${selectedVaultId}/contribute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to record deposit');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vault-detail', selectedVaultId] });
      qc.invalidateQueries({ queryKey: ['vaults'] });
      setShowDepositModal(false);
      toast({ title: 'Deposit Recorded', description: 'Locked balance and ledger successfully updated.' });
    },
    onError: (err: any) => {
      toast({ title: 'Deposit Error', description: err.message, variant: 'destructive' });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async (payload: any) => {
      const token = localStorage.getItem('tereka_auth_token');
      const res = await fetch(`/api/vaults/${selectedVaultId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add member');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vault-detail', selectedVaultId] });
      qc.invalidateQueries({ queryKey: ['vaults'] });
      setShowAddMemberModal(false);
      setMemberForm({
        name: '',
        phone: '',
        role: 'member',
        targetContribution: '1000000',
      });
      toast({ title: 'Member Added', description: 'New member successfully enrolled in the vault.' });
    },
    onError: (err: any) => {
      toast({ title: 'Enrolment Error', description: err.message, variant: 'destructive' });
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim()) {
      alert('Please enter a vault title');
      return;
    }
    const target = Math.round(Number(createForm.targetAmount));
    if (!target || target < 10000) {
      alert('Minimum target amount is UGX 10,000');
      return;
    }

    createVaultMutation.mutate({
      title: createForm.title.trim(),
      description: createForm.description.trim() || undefined,
      targetAmount: target,
      currency: 'UGX',
      lockType: createForm.lockType,
      unlockDate: createForm.lockType !== 'target_locked' ? createForm.unlockDate : undefined,
      minSignaturesRequired: Number(createForm.minSignaturesRequired),
    });
  };

  const handleProposeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Math.round(Number(proposeForm.amount));
    if (!amount || amount < 500) {
      alert('Please enter a valid amount');
      return;
    }
    if (!proposeForm.recipientName.trim()) {
      alert('Please enter the recipient or vendor name');
      return;
    }

    proposePayoutMutation.mutate({
      title: proposeForm.title.trim() || `Payout to ${proposeForm.recipientName.trim()}`,
      amount,
      destinationType: proposeForm.destinationType,
      recipientName: proposeForm.recipientName.trim(),
      bankName: proposeForm.destinationType === 'vendor_bank' ? proposeForm.bankName : undefined,
      accountNumber: proposeForm.destinationType === 'vendor_bank' ? proposeForm.accountNumber.trim() : undefined,
      phone: proposeForm.destinationType === 'momo_number' ? proposeForm.phone.trim() : undefined,
    });
  };

  const handleDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Math.round(Number(depositForm.amount));
    if (!amount || amount < 500) {
      alert('Deposit must be at least UGX 500');
      return;
    }
    if (!depositForm.memberName.trim()) {
      alert('Please specify the contributing member');
      return;
    }

    depositMutation.mutate({
      memberId: depositForm.memberId || undefined,
      memberName: depositForm.memberName.trim(),
      amount,
      currency: 'UGX',
      paymentMethod: depositForm.paymentMethod,
      reference: depositForm.reference.trim() || undefined,
      note: depositForm.note.trim() || undefined,
    });
  };

  const handleMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.name.trim() || !memberForm.phone.trim()) {
      alert('Name and phone are required');
      return;
    }
    addMemberMutation.mutate({
      name: memberForm.name.trim(),
      phone: memberForm.phone.trim(),
      role: memberForm.role,
      targetContribution: Math.round(Number(memberForm.targetContribution)) || 0,
    });
  };

  // Filtered Vaults
  const vaults = vaultsQuery.data?.vaults || [];
  const filteredVaults = useMemo(() => {
    return vaults.filter((v) => {
      if (filterLock === 'time' && v.lockType === 'target_locked') return false;
      if (filterLock === 'target' && v.lockType === 'time_locked') return false;
      if (filterLock === 'unlocked' && v.isLocked) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return v.title.toLowerCase().includes(q) || (v.description && v.description.toLowerCase().includes(q));
      }
      return true;
    });
  }, [vaults, filterLock, searchQuery]);

  const selectedVault = vaultDetailQuery.data?.vault;
  const members = vaultDetailQuery.data?.members || [];
  const proposals = vaultDetailQuery.data?.proposals || [];
  const ledger = vaultDetailQuery.data?.ledger || [];

  return (
    <AppShell>
      <PageHeading
        eyebrow="Group & Family Savings"
        title="Tereka Vaults & SACCOs"
        description="Lock and protect funds together for land, emergency reserves, investment clubs, or family projects. Governed by multi-signature destination ballots."
        action={
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs font-bold text-primary-foreground shadow-md transition-all hover:scale-105 active:scale-95"
            data-testid="button-create-vault"
          >
            <Plus size={16} /> + Create Vault
          </button>
        }
      />

      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider">Total Locked Savings</span>
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <Lock size={15} />
            </span>
          </div>
          <p className="mt-3 font-serif text-2xl font-black text-foreground sm:text-3xl">
            {formatCurrency(vaultsQuery.data?.totalLockedSavings || 0, 'UGX')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Across all your active group vaults</p>
        </div>

        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider">Active Vaults</span>
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Building2 size={15} />
            </span>
          </div>
          <p className="mt-3 font-serif text-2xl font-black text-foreground sm:text-3xl">
            {vaultsQuery.data?.activeVaultsCount || 0}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Family, clubs, and SACCO pools</p>
        </div>

        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider">Members Enrolled</span>
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-500/10 text-blue-600">
              <Users size={15} />
            </span>
          </div>
          <p className="mt-3 font-serif text-2xl font-black text-foreground sm:text-3xl">
            {vaultsQuery.data?.totalMembersCount || 0}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Keyholders, treasurers, and savers</p>
        </div>

        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider">Active Destination Ballots</span>
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
              <Vote size={15} />
            </span>
          </div>
          <p className="mt-3 font-serif text-2xl font-black text-foreground sm:text-3xl">
            {vaultsQuery.data?.pendingBallotsCount || 0}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Awaiting multi-member signatures</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { key: 'all', label: 'All Vaults' },
              { key: 'time', label: 'Time-Locked' },
              { key: 'target', label: 'Target-Locked' },
              { key: 'unlocked', label: 'Unlocked' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterLock(tab.key)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                filterLock === tab.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'border border-border/60 bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search vaults..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-4 text-xs font-medium focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Vault Cards Grid */}
      {vaultsQuery.isLoading ? (
        <div className="mt-12 flex flex-col items-center justify-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground animate-pulse font-serif font-black">
            T
          </span>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Loading Vaults...</p>
        </div>
      ) : filteredVaults.length === 0 ? (
        <div className="mt-12 rounded-3xl border border-dashed border-border/80 bg-card/50 p-12 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary">
            <ShieldCheck size={28} />
          </span>
          <h3 className="mt-4 font-serif text-xl font-bold">No Vaults Found</h3>
          <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
            Create your first locked group savings vault for your family, project, or investment club to protect funds with
            multi-signature payout governance.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition-transform hover:scale-105"
          >
            <Plus size={15} /> Create Your First Vault
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredVaults.map((vault) => (
            <div
              key={vault.id}
              className="flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-6 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div>
                {/* Status and Lock Indicator */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {vault.isLocked ? (
                      <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 font-mono text-[10px] font-bold text-amber-600">
                        <Lock size={11} />
                        {vault.lockType === 'time_locked'
                          ? `Locked to ${vault.unlockDate}`
                          : vault.lockType === 'target_locked'
                          ? 'Target Locked'
                          : 'Time & Target Locked'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] font-bold text-emerald-600">
                        <Unlock size={11} /> Unlocked
                      </span>
                    )}
                  </div>

                  <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase text-muted-foreground">
                    {vault.userRole}
                  </span>
                </div>

                <h3 className="mt-4 font-serif text-xl font-bold text-foreground">{vault.title}</h3>
                {vault.description && (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {vault.description}
                  </p>
                )}

                {/* Progress Bar */}
                <div className="mt-5 rounded-2xl bg-secondary/40 p-4">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Locked Balance
                      </p>
                      <p className="font-serif text-xl font-black text-primary">
                        {formatCurrency(vault.currentAmount, 'UGX')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Target</p>
                      <p className="font-mono text-xs font-semibold text-foreground">
                        {formatCurrency(vault.targetAmount, 'UGX')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${vault.percentageComplete}%` }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{vault.percentageComplete}% Achieved</span>
                    <span>{formatCurrency(vault.remainingAmount, 'UGX')} remaining</span>
                  </div>
                </div>

                {/* Key Meta Badges */}
                <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1">
                    <Users size={12} /> {vault.membersCount} {vault.membersCount === 1 ? 'member' : 'members'}
                  </span>
                  <span className="flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1">
                    <FileCheck2 size={12} /> {vault.minSignaturesRequired} votes needed
                  </span>
                  {vault.activeProposalsCount > 0 && (
                    <span className="flex items-center gap-1 rounded-lg bg-amber-500/10 px-2.5 py-1 font-bold text-amber-600">
                      <Vote size={12} /> {vault.activeProposalsCount} active ballot
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedVaultId(vault.id);
                  setActiveTab('ballots');
                }}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 py-2.5 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                data-testid={`button-open-vault-${vault.id}`}
              >
                <ShieldCheck size={14} /> Open Vault & Ballots
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VAULT DETAIL MODAL / SCREEN                                                */}
      {/* ========================================================================= */}
      {selectedVault && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/60 bg-secondary/30 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground font-serif font-black">
                  T
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif text-xl font-bold text-foreground">{selectedVault.title}</h2>
                    {selectedVault.isLocked ? (
                      <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-amber-600">
                        <Lock size={10} /> Locked
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-600">
                        <Unlock size={10} /> Unlocked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Role: <strong className="uppercase text-foreground">{selectedVault.userRole}</strong> ·{' '}
                    {selectedVault.minSignaturesRequired} member votes required for payouts
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedVaultId(null)}
                className="rounded-xl p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content Scroll Area */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {/* Financial Progress Banner */}
              <div className="rounded-3xl bg-secondary/40 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Locked Vault Balance
                    </p>
                    <p className="font-serif text-3xl font-black text-primary sm:text-4xl">
                      {formatCurrency(selectedVault.currentAmount, 'UGX')}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Target: {formatCurrency(selectedVault.targetAmount, 'UGX')} (
                      {selectedVault.percentageComplete}% reached)
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setShowDepositModal(true)}
                      className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:scale-105"
                    >
                      <Plus size={14} /> Record Deposit
                    </button>

                    <button
                      onClick={() => setShowAddMemberModal(true)}
                      className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground hover:bg-secondary"
                    >
                      <UserPlus size={14} /> Add Member
                    </button>

                    <button
                      onClick={() => setShowProposeModal(true)}
                      className="flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground"
                    >
                      <Vote size={14} /> + Propose Payout Destination
                    </button>
                  </div>
                </div>

                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${selectedVault.percentageComplete}%` }}
                  />
                </div>
              </div>

              {/* Navigation Tabs inside Modal */}
              <div className="mt-6 flex border-b border-border/60">
                <button
                  onClick={() => setActiveTab('ballots')}
                  className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors ${
                    activeTab === 'ballots'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Vote size={14} /> Active Ballots & Payout Proposals ({proposals.length})
                </button>
                <button
                  onClick={() => setActiveTab('members')}
                  className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors ${
                    activeTab === 'members'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Users size={14} /> Member Roster ({members.length})
                </button>
                <button
                  onClick={() => setActiveTab('ledger')}
                  className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors ${
                    activeTab === 'ledger'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <FileCheck2 size={14} /> Vault Ledger ({ledger.length})
                </button>
              </div>

              {/* ============================================================= */}
              {/* TAB 1: ACTIVE BALLOTS & PAYOUT PROPOSALS                      */}
              {/* ============================================================= */}
              {activeTab === 'ballots' && (
                <div className="mt-6 space-y-4">
                  {proposals.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-border/80 p-8 text-center">
                      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary">
                        <Vote size={22} />
                      </span>
                      <h4 className="mt-3 font-serif text-lg font-bold">No Payout Ballots Active</h4>
                      <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                        Any member can propose a payout destination (vendor bank account, MoMo number, or member split).
                        Funds disburse once {selectedVault.minSignaturesRequired} 'Yes' votes are reached.
                      </p>
                      <button
                        onClick={() => setShowProposeModal(true)}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:scale-105"
                      >
                        <Vote size={14} /> + Propose Payout Destination
                      </button>
                    </div>
                  ) : (
                    proposals.map((proposal) => {
                      const yesVotes = proposal.yesVotesCount || 0;
                      const required = proposal.requiredVotes;
                      const percent = Math.min(100, Math.round((yesVotes / Math.max(1, required)) * 100));

                      return (
                        <div
                          key={proposal.id}
                          className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-serif text-lg font-bold text-foreground">
                                  {proposal.title}
                                </span>
                                {proposal.status === 'voting_active' && (
                                  <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-amber-600">
                                    Voting Active
                                  </span>
                                )}
                                {proposal.status === 'approved' && (
                                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-600">
                                    Approved & Disbursed
                                  </span>
                                )}
                                {proposal.status === 'rejected' && (
                                  <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-destructive">
                                    Rejected
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Proposed by <strong className="text-foreground">{proposal.proposerName}</strong> ·{' '}
                                {dateLabel(proposal.createdAt, true)}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="font-serif text-2xl font-black text-primary">
                                {formatCurrency(proposal.amount, 'UGX')}
                              </p>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                Requested Payout
                              </span>
                            </div>
                          </div>

                          {/* EXACT DESTINATION INFO BOX */}
                          <div className="mt-4 rounded-2xl border border-border/80 bg-secondary/30 p-4">
                            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Destination Details (Where funds are sent):
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              {proposal.destinationType === 'momo_number' && (
                                <div className="flex items-center gap-2">
                                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
                                    <Smartphone size={16} />
                                  </span>
                                  <div>
                                    <p className="text-xs font-bold text-foreground">
                                      Mobile Money: {proposal.phone}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                      Recipient: {proposal.recipientName}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {proposal.destinationType === 'vendor_bank' && (
                                <div className="flex items-center gap-2">
                                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-500/10 text-blue-600">
                                    <Landmark size={16} />
                                  </span>
                                  <div>
                                    <p className="text-xs font-bold text-foreground">
                                      {proposal.bankName || 'Commercial Bank'}: {proposal.accountNumber}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                      Account Name: {proposal.recipientName}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {proposal.destinationType === 'split_equally_to_members' && (
                                <div className="flex items-center gap-2">
                                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
                                    <Split size={16} />
                                  </span>
                                  <div>
                                    <p className="text-xs font-bold text-foreground">
                                      Equal Split Among All Registered Members
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                      Transferred directly to each member's registered MoMo number
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* LIVE VOTE COUNTER PROGRESS */}
                          <div className="mt-4">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-foreground">
                                Member Ballots: {yesVotes} of {required} 'Yes' votes confirmed
                              </span>
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {proposal.noVotesCount || 0} 'No' votes
                              </span>
                            </div>

                            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  proposal.status === 'approved' ? 'bg-emerald-500' : 'bg-primary'
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>

                          {/* VOTING BUTTONS */}
                          {proposal.status === 'voting_active' && (
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4">
                              {proposal.hasUserVoted ? (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <CheckCircle2 size={15} className="text-emerald-500" />
                                  <span>
                                    You have already voted{' '}
                                    <strong className="uppercase text-foreground">{proposal.userVote}</strong> on this
                                    ballot.
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => voteMutation.mutate({ proposalId: proposal.id, vote: 'yes' })}
                                    disabled={voteMutation.isPending}
                                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                                  >
                                    <ThumbsUp size={14} /> Approve Destination
                                  </button>

                                  <button
                                    onClick={() => voteMutation.mutate({ proposalId: proposal.id, vote: 'no' })}
                                    disabled={voteMutation.isPending}
                                    className="flex items-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs font-bold text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                  >
                                    <ThumbsDown size={14} /> Reject Destination
                                  </button>
                                </div>
                              )}

                              <p className="text-[11px] text-muted-foreground">1 member = 1 vote rule enforced</p>
                            </div>
                          )}

                          {/* Votes history list */}
                          {proposal.votes && proposal.votes.length > 0 && (
                            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                              {proposal.votes.map((v) => (
                                <span
                                  key={v.id}
                                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                    v.vote === 'yes'
                                      ? 'bg-emerald-500/10 text-emerald-600'
                                      : 'bg-destructive/10 text-destructive'
                                  }`}
                                >
                                  {v.memberName}: {v.vote.toUpperCase()}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* ============================================================= */}
              {/* TAB 2: MEMBER ROSTER TABLE                                    */}
              {/* ============================================================= */}
              {activeTab === 'members' && (
                <div className="mt-6 overflow-hidden rounded-3xl border border-border/80 bg-card">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border/60 bg-secondary/40 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="px-5 py-3.5">Member Name</th>
                          <th className="px-5 py-3.5">Role</th>
                          <th className="px-5 py-3.5">Contact Phone</th>
                          <th className="px-5 py-3.5 text-right">Target Commitment</th>
                          <th className="px-5 py-3.5 text-right">Contributed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {members.map((member) => {
                          const target = member.targetContribution || 0;
                          const contributed = member.totalContributed || 0;
                          const progress = target > 0 ? Math.min(100, Math.round((contributed / target) * 100)) : 0;

                          return (
                            <tr key={member.id} className="hover:bg-secondary/20">
                              <td className="px-5 py-4">
                                <p className="font-bold text-foreground">{member.name}</p>
                              </td>
                              <td className="px-5 py-4">
                                <span
                                  className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                                    member.role === 'chairman'
                                      ? 'bg-primary/15 text-primary'
                                      : member.role === 'treasurer'
                                      ? 'bg-emerald-500/15 text-emerald-600'
                                      : member.role === 'keyholder'
                                      ? 'bg-amber-500/15 text-amber-600'
                                      : 'bg-secondary text-muted-foreground'
                                  }`}
                                >
                                  {member.role}
                                </span>
                              </td>
                              <td className="px-5 py-4 font-mono text-muted-foreground">{member.phone}</td>
                              <td className="px-5 py-4 text-right font-medium text-foreground">
                                {target > 0 ? formatCurrency(target, 'UGX') : 'Open'}
                              </td>
                              <td className="px-5 py-4 text-right">
                                <span className="font-serif font-bold text-primary">
                                  {formatCurrency(contributed, 'UGX')}
                                </span>
                                {target > 0 && (
                                  <p className="text-[10px] text-muted-foreground">{progress}% of goal</p>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* TAB 3: VAULT LEDGER                                           */}
              {/* ============================================================= */}
              {activeTab === 'ledger' && (
                <div className="mt-6 space-y-3">
                  {ledger.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground">
                      No deposits or payouts recorded yet.
                    </div>
                  ) : (
                    ledger.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`grid h-9 w-9 place-items-center rounded-xl text-sm ${
                              entry.type === 'deposit'
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : 'bg-blue-500/10 text-blue-600'
                            }`}
                          >
                            {entry.type === 'deposit' ? '↗' : '↘'}
                          </span>
                          <div>
                            <p className="font-bold text-foreground">
                              {entry.type === 'deposit' ? `Deposit by ${entry.memberName}` : entry.memberName}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {dateLabel(entry.createdAt, true)} · {entry.paymentMethod.replace('_', ' ')}
                              {entry.note ? ` · ${entry.note}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p
                            className={`font-serif text-sm font-black ${
                              entry.type === 'deposit' ? 'text-emerald-600' : 'text-blue-600'
                            }`}
                          >
                            {entry.type === 'deposit' ? '+' : '−'}
                            {formatCurrency(entry.amount, 'UGX')}
                          </p>
                          {entry.reference && (
                            <span className="font-mono text-[9px] text-muted-foreground">{entry.reference}</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE VAULT                                                     */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-serif text-xl font-bold">Create Tereka Vault</h3>
              <button onClick={() => setShowCreateModal(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-foreground">Vault Title / Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mukisa Family Land Fund, Kampala Tech Investment Club"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-foreground">Target Savings Goal (UGX)</label>
                <input
                  type="number"
                  required
                  min={10000}
                  step={10000}
                  value={createForm.targetAmount}
                  onChange={(e) => setCreateForm({ ...createForm, targetAmount: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-foreground">Lock Condition</label>
                <select
                  value={createForm.lockType}
                  onChange={(e) => setCreateForm({ ...createForm, lockType: e.target.value as any })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium focus:border-primary focus:outline-none"
                >
                  <option value="time_locked">Time-Locked (Unlock after specific date)</option>
                  <option value="target_locked">Target-Locked (Unlock only when target is reached)</option>
                  <option value="both">Both (Must reach target AND mature past unlock date)</option>
                </select>
              </div>

              {createForm.lockType !== 'target_locked' && (
                <div>
                  <label className="font-bold text-foreground">Unlock Maturity Date</label>
                  <input
                    type="date"
                    required
                    value={createForm.unlockDate}
                    onChange={(e) => setCreateForm({ ...createForm, unlockDate: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium focus:border-primary focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="font-bold text-foreground">Required Destination Ballots (Signatures)</label>
                <select
                  value={createForm.minSignaturesRequired}
                  onChange={(e) => setCreateForm({ ...createForm, minSignaturesRequired: Number(e.target.value) })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium focus:border-primary focus:outline-none"
                >
                  <option value={1}>1 Signature (Direct Treasurer / Chairman Approval)</option>
                  <option value={2}>2 Signatures (Standard Dual Keyholder)</option>
                  <option value={3}>3 Signatures (Full Executive Consensus)</option>
                  <option value={5}>5 Signatures (Large SACCO Board)</option>
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Number of 'Yes' votes required from members before any payout can disburse.
                </p>
              </div>

              <div>
                <label className="font-bold text-foreground">Description & Purpose</label>
                <textarea
                  rows={2}
                  placeholder="What is this fund for? (e.g. buying land in Mukono, quarterly SACCO dividends)"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createVaultMutation.isPending}
                  className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:scale-105"
                >
                  {createVaultMutation.isPending ? 'Creating...' : 'Create Vault'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: PROPOSE PAYOUT DESTINATION                                       */}
      {/* ========================================================================= */}
      {showProposeModal && selectedVault && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="font-serif text-xl font-bold">Propose Payout Destination</h3>
                <p className="text-xs text-muted-foreground">
                  Opens a member ballot for {selectedVault.title}. Requires{' '}
                  {selectedVault.minSignaturesRequired} 'Yes' votes to disburse.
                </p>
              </div>
              <button onClick={() => setShowProposeModal(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleProposeSubmit} className="mt-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-foreground">Proposal Purpose / Reason</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Payment for Land Surveying, School Fees Transfer"
                  value={proposeForm.title}
                  onChange={(e) => setProposeForm({ ...proposeForm, title: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-foreground">Amount (UGX)</label>
                <input
                  type="number"
                  required
                  min={500}
                  max={selectedVault.currentAmount}
                  placeholder={`Max available: UGX ${selectedVault.currentAmount.toLocaleString()}`}
                  value={proposeForm.amount}
                  onChange={(e) => setProposeForm({ ...proposeForm, amount: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-foreground">Destination Type</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    { type: 'momo_number', label: 'Mobile Money', icon: Smartphone },
                    { type: 'vendor_bank', label: 'Bank Transfer', icon: Landmark },
                    { type: 'split_equally_to_members', label: 'Member Split', icon: Split },
                  ].map(({ type, label, icon: Icon }) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setProposeForm({ ...proposeForm, destinationType: type as any })}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-all ${
                        proposeForm.destinationType === type
                          ? 'border-primary bg-primary/10 font-bold text-primary shadow-sm'
                          : 'border-border/60 bg-card text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      <Icon size={18} />
                      <span className="text-[11px]">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-foreground">
                  {proposeForm.destinationType === 'split_equally_to_members'
                    ? 'Batch Title / Reference'
                    : 'Recipient / Vendor Full Name'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    proposeForm.destinationType === 'split_equally_to_members'
                      ? 'e.g. All Active Club Members'
                      : 'e.g. Mugisha Surveyors Ltd, Mukisa Emmanuel'
                  }
                  value={proposeForm.recipientName}
                  onChange={(e) => setProposeForm({ ...proposeForm, recipientName: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium focus:border-primary focus:outline-none"
                />
              </div>

              {proposeForm.destinationType === 'momo_number' && (
                <div>
                  <label className="font-bold text-foreground">Recipient Mobile Money Phone Number</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 0776155353 or 0701234567"
                    value={proposeForm.phone}
                    onChange={(e) => setProposeForm({ ...proposeForm, phone: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium focus:border-primary focus:outline-none"
                  />
                </div>
              )}

              {proposeForm.destinationType === 'vendor_bank' && (
                <>
                  <div>
                    <label className="font-bold text-foreground">Destination Bank</label>
                    <select
                      value={proposeForm.bankName}
                      onChange={(e) => setProposeForm({ ...proposeForm, bankName: e.target.value })}
                      className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium focus:border-primary focus:outline-none"
                    >
                      {UGANDAN_BANKS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-foreground">Account Number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 310008492001"
                      value={proposeForm.accountNumber}
                      onChange={(e) => setProposeForm({ ...proposeForm, accountNumber: e.target.value })}
                      className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium focus:border-primary focus:outline-none"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowProposeModal(false)}
                  className="rounded-xl px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={proposePayoutMutation.isPending}
                  className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:scale-105"
                >
                  {proposePayoutMutation.isPending ? 'Submitting...' : 'Open Destination Ballot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: RECORD DEPOSIT                                                   */}
      {/* ========================================================================= */}
      {showDepositModal && selectedVault && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-serif text-xl font-bold">Record Vault Deposit</h3>
              <button onClick={() => setShowDepositModal(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDepositSubmit} className="mt-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-foreground">Depositing Member</label>
                <select
                  value={depositForm.memberId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const m = members.find((x) => x.id === id);
                    setDepositForm({
                      ...depositForm,
                      memberId: id,
                      memberName: m ? m.name : '',
                    });
                  }}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium focus:border-primary focus:outline-none"
                >
                  <option value="">-- Select Member or Other --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role.toUpperCase()})
                    </option>
                  ))}
                </select>
                {!depositForm.memberId && (
                  <input
                    type="text"
                    required
                    placeholder="Or enter contributor name"
                    value={depositForm.memberName}
                    onChange={(e) => setDepositForm({ ...depositForm, memberName: e.target.value })}
                    className="mt-2 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium focus:border-primary focus:outline-none"
                  />
                )}
              </div>

              <div>
                <label className="font-bold text-foreground">Deposit Amount (UGX)</label>
                <input
                  type="number"
                  required
                  min={500}
                  step={1000}
                  value={depositForm.amount}
                  onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-foreground">Payment Method</label>
                <select
                  value={depositForm.paymentMethod}
                  onChange={(e) => setDepositForm({ ...depositForm, paymentMethod: e.target.value as any })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium focus:border-primary focus:outline-none"
                >
                  <option value="mtn_momo">MTN Mobile Money</option>
                  <option value="airtel_money">Airtel Money</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash in Safe</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-foreground">Reference / Transaction ID (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. MOMO-293849102"
                  value={depositForm.reference}
                  onChange={(e) => setDepositForm({ ...depositForm, reference: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="rounded-xl px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={depositMutation.isPending}
                  className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:scale-105"
                >
                  {depositMutation.isPending ? 'Recording...' : 'Record Deposit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ADD MEMBER                                                       */}
      {/* ========================================================================= */}
      {showAddMemberModal && selectedVault && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-serif text-xl font-bold">Enroll Vault Member</h3>
              <button onClick={() => setShowAddMemberModal(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleMemberSubmit} className="mt-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-foreground">Member Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Namubiru, David Kato"
                  value={memberForm.name}
                  onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-foreground">Phone Number</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 0776155353"
                  value={memberForm.phone}
                  onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-foreground">Assigned Role</label>
                <select
                  value={memberForm.role}
                  onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value as any })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium focus:border-primary focus:outline-none"
                >
                  <option value="member">Member (Can vote on ballots & save)</option>
                  <option value="keyholder">Keyholder (Authorized signatory on ballots)</option>
                  <option value="treasurer">Treasurer (Manages ledger & initiates payouts)</option>
                  <option value="chairman">Chairman (Executive signatory)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-foreground">Target Commitment (UGX)</label>
                <input
                  type="number"
                  min={0}
                  step={50000}
                  placeholder="e.g. 1000000"
                  value={memberForm.targetContribution}
                  onChange={(e) => setMemberForm({ ...memberForm, targetContribution: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="rounded-xl px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMemberMutation.isPending}
                  className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:scale-105"
                >
                  {addMemberMutation.isPending ? 'Adding...' : 'Enroll Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
