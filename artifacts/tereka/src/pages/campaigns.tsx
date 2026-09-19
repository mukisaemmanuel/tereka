import { useState, useRef, type ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Calendar,
  Check,
  Coins,
  Copy,
  ExternalLink,
  HeartHandshake,
  Image as ImageIcon,
  MessageSquare,
  PartyPopper,
  Plus,
  Share2,
  Trash2,
  Upload,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { AppShell, Button, Card, EmptyState, Field, Modal, PageHeading, Skeleton, inputClass } from '@/components/layout';
import { formatCurrency, dateLabel } from '@/lib/finance';
import { useGetAccounts, type Account } from '@workspace/api-client-react';

export interface Campaign {
  id: string;
  userId: string;
  slug: string;
  title: string;
  description: string | null;
  type: 'kwanjula' | 'wedding' | 'mabugo' | 'medical' | 'graduation' | 'general';
  targetAmount: number;
  currency: string;
  deadline: string | null;
  accountId: string | null;
  recipientPhone?: string | null;
  recipientName?: string | null;
  imageUrl: string | null;
  status: 'active' | 'completed' | 'paused';
  totalRaised: number;
  remainingAmount: number;
  contributorsCount: number;
  percentageComplete: number;
  createdAt?: string;
}

export interface Contribution {
  id: string;
  campaignId: string;
  contributorName: string;
  contributorPhone?: string | null;
  amount: number;
  currency: string;
  paymentMethod: string;
  reference?: string | null;
  message?: string | null;
  isAnonymous: boolean;
  paidAt: string;
}

const eventTypeThemes: Record<string, { label: string; badgeClass: string; defaultBanner: string; icon: string }> = {
  kwanjula: {
    label: 'Kwanjula / Introduction',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    defaultBanner: 'linear-gradient(135deg, #78350f 0%, #d97706 50%, #f59e0b 100%)',
    icon: '💍',
  },
  wedding: {
    label: 'Wedding Reception',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    defaultBanner: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #10b981 100%)',
    icon: '💐',
  },
  mabugo: {
    label: 'Mabugo / Funeral Support',
    badgeClass: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
    defaultBanner: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)',
    icon: '🕊️',
  },
  medical: {
    label: 'Medical Emergency',
    badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    defaultBanner: 'linear-gradient(135deg, #881337 0%, #e11d48 50%, #fb7185 100%)',
    icon: '🩺',
  },
  graduation: {
    label: 'Graduation / Birthday',
    badgeClass: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
    defaultBanner: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 50%, #6366f1 100%)',
    icon: '🎓',
  },
  general: {
    label: 'General Fundraiser',
    badgeClass: 'bg-primary/15 text-primary border-primary/30',
    defaultBanner: 'linear-gradient(135deg, #13231e 0%, #1f4236 50%, #2e6250 100%)',
    icon: '🤝',
  },
};

export function Campaigns() {
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [modal, setModal] = useState(false);
  const [detailsModal, setDetailsModal] = useState<Campaign | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const accountsQuery = useGetAccounts();
  const accounts = accountsQuery.data || [];

  const campaignsQuery = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const token = localStorage.getItem('tereka_auth_token');
      const res = await fetch('/api/campaigns', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to load campaigns');
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem('tereka_auth_token');
      const res = await fetch(`/api/campaigns/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to delete campaign');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      if (detailsModal) setDetailsModal(null);
    },
  });

  const campaigns = campaignsQuery.data || [];
  const totalRaisedAcrossAll = campaigns.reduce((sum, c) => sum + (c.totalRaised || 0), 0);
  const totalContributorsCount = campaigns.reduce((sum, c) => sum + (c.contributorsCount || 0), 0);

  const handleCopyLink = (slug: string) => {
    const url = `${window.location.origin}/c/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 3000);
  };

  return (
    <AppShell>
      <PageHeading
        eyebrow="Community & Events"
        title="Campaigns & Fundraisers"
        description="Raise funds transparently for weddings, kwanjula, mabugo, medical needs, or community projects in Ugandan Shillings (UGX)."
        action={
          <Button onClick={() => setModal(true)} data-testid="button-create-campaign">
            <Plus size={16} /> New Campaign
          </Button>
        }
      />

      {/* Summary Metrics */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <PartyPopper size={20} />
            </span>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Active Events</p>
              <p className="mt-1 font-serif text-3xl font-bold">{campaigns.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Coins size={20} />
            </span>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Total Raised</p>
              <p className="mt-1 font-serif text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalRaisedAcrossAll, 'UGX')}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary text-primary">
              <Users size={20} />
            </span>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Contributors</p>
              <p className="mt-1 font-serif text-3xl font-bold">{totalContributorsCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Campaigns Grid */}
      {campaignsQuery.isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-96 rounded-3xl" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <EmptyState
            title="Start your first community fundraiser"
            body="Create a transparent campaign for a wedding, introduction (kwanjula), funeral support (mabugo), or medical need with mobile money integration."
            action={
              <Button onClick={() => setModal(true)} data-testid="button-empty-create-campaign">
                <Plus size={15} /> Create a Campaign
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => {
            const theme = eventTypeThemes[campaign.type] || eventTypeThemes.general;
            const isFinished = campaign.percentageComplete >= 100;

            return (
              <Card
                key={campaign.id}
                className="group flex flex-col overflow-hidden transition-all hover:shadow-xl"
                data-testid={`campaign-card-${campaign.id}`}
              >
                {/* Event Image Banner */}
                <div className="relative h-44 w-full overflow-hidden bg-secondary">
                  {campaign.imageUrl ? (
                    <img
                      src={campaign.imageUrl}
                      alt={campaign.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center p-6 text-white"
                      style={{ background: theme.defaultBanner }}
                    >
                      <div className="text-center">
                        <span className="text-4xl">{theme.icon}</span>
                        <p className="mt-2 font-serif text-lg font-bold drop-shadow-md">{theme.label}</p>
                      </div>
                    </div>
                  )}

                  {/* Badges on Banner */}
                  <div className="absolute left-3 top-3 flex items-center gap-2">
                    <span className={`rounded-full border bg-background/90 px-3 py-1 text-xs font-bold backdrop-blur-md ${theme.badgeClass}`}>
                      {theme.label}
                    </span>
                  </div>

                  <div className="absolute right-3 top-3">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider backdrop-blur-md ${
                      isFinished ? 'bg-emerald-500 text-white' : 'bg-background/90 text-foreground'
                    }`}>
                      {campaign.percentageComplete}% Raised
                    </span>
                  </div>
                </div>

                {/* Card Content */}
                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <h3 className="line-clamp-1 font-serif text-xl font-bold text-foreground">
                    {campaign.title}
                  </h3>

                  {campaign.description && (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {campaign.description}
                    </p>
                  )}

                  {/* Payout Phone Number Notice */}
                  {campaign.recipientPhone && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300 border border-amber-500/20">
                      <Wallet size={13} className="shrink-0 text-amber-600 dark:text-amber-400" />
                      <span className="truncate">
                        Payout: <strong>{campaign.recipientPhone}</strong> {campaign.recipientName ? `(${campaign.recipientName})` : ''}
                      </span>
                    </div>
                  )}

                  {/* Financial Progress */}
                  <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="font-mono text-lg font-bold text-primary">
                          {formatCurrency(campaign.totalRaised, 'UGX')}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          of {formatCurrency(campaign.targetAmount, 'UGX')} target
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {campaign.contributorsCount} {campaign.contributorsCount === 1 ? 'supporter' : 'supporters'}
                        </span>
                        {campaign.deadline && (
                          <p className="text-[10px] text-muted-foreground">
                            Due {dateLabel(campaign.deadline, true)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isFinished ? 'bg-emerald-500' : 'bg-primary'
                        }`}
                        style={{ width: `${Math.min(100, campaign.percentageComplete)}%` }}
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-6 flex items-center justify-between gap-2 border-t border-border/60 pt-4">
                    <button
                      onClick={() => handleCopyLink(campaign.slug)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/80 px-3 py-2 text-xs font-bold text-foreground transition-colors hover:bg-secondary"
                      data-testid={`button-copy-link-${campaign.id}`}
                    >
                      {copiedSlug === campaign.slug ? (
                        <>
                          <Check size={14} className="text-emerald-500" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={14} /> Share Link
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => window.open(`/c/${campaign.slug}`, '_blank')}
                        className="rounded-xl border border-border p-2 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-secondary hover:text-primary"
                        title="Open Public Page"
                        data-testid={`button-view-public-${campaign.id}`}
                      >
                        <ExternalLink size={16} />
                      </button>

                      <button
                        onClick={() => setDetailsModal(campaign)}
                        className="rounded-xl border border-border p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                        title="View Contributors Ledger"
                        data-testid={`button-view-contributors-${campaign.id}`}
                      >
                        <Users size={16} />
                      </button>

                      <button
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete "${campaign.title}"?`)) {
                            deleteMutation.mutate(campaign.id);
                          }
                        }}
                        className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        title="Delete Campaign"
                        data-testid={`button-delete-campaign-${campaign.id}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Campaign Modal */}
      {modal && (
        <NewCampaignModal
          accounts={accounts}
          onClose={() => setModal(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['campaigns'] });
            setModal(false);
          }}
        />
      )}

      {/* Contributors Ledger Modal */}
      {detailsModal && (
        <CampaignDetailsModal
          campaign={detailsModal}
          onClose={() => setDetailsModal(null)}
        />
      )}
    </AppShell>
  );
}

function NewCampaignModal({
  accounts,
  onClose,
  onSuccess,
}: {
  accounts: Account[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<Campaign['type']>('kwanjula');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert('Image size exceeds 3MB. Please choose a smaller photo or flyer.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setImageUrl(base64);
      setImagePreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleUrlChange = (val: string) => {
    setImageUrl(val);
    setImagePreview(val.trim() || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Math.round(Number(targetAmount));
    if (!amountNum || amountNum <= 0) {
      alert('Please specify a valid target amount greater than 0.');
      return;
    }

    setPending(true);
    try {
      const token = localStorage.getItem('tereka_auth_token');
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          type,
          targetAmount: amountNum,
          currency: 'UGX',
          deadline: deadline || undefined,
          accountId: accountId || undefined,
          recipientPhone: recipientPhone.trim() || undefined,
          recipientName: recipientName.trim() || undefined,
          imageUrl: imageUrl.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create campaign');
      }

      onSuccess();
    } catch (err: any) {
      alert(err.message || 'Error creating campaign');
    } finally {
      setPending(false);
    }
  };

  const activeTheme = eventTypeThemes[type] || eventTypeThemes.general;

  return (
    <Modal title="Create a Fundraiser / Event" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Event Type */}
        <Field label="Event Type">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className={inputClass}
            data-testid="select-campaign-type"
          >
            <option value="kwanjula">💍 Kwanjula / Introduction Ceremony</option>
            <option value="wedding">💐 Wedding Reception & Meetings</option>
            <option value="mabugo">🕊️ Mabugo / Funeral Support</option>
            <option value="medical">🩺 Medical Emergency Fund</option>
            <option value="graduation">🎓 Graduation / Birthday</option>
            <option value="general">🤝 General Community Project</option>
          </select>
        </Field>

        {/* Title */}
        <Field label="Campaign Title">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              type === 'kwanjula'
                ? 'e.g. Sarah & Emmanuel Introduction Ceremony'
                : type === 'wedding'
                ? 'e.g. Mukisa Wedding Preparations'
                : type === 'mabugo'
                ? 'e.g. Late Mzee Kato Mabugo & Burial Support'
                : 'e.g. Community Well Construction'
            }
            className={inputClass}
            data-testid="input-campaign-title"
          />
        </Field>

        {/* Event Image / Flyer Banner */}
        <div className="space-y-2">
          <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Event Flyer / Banner Photo
          </label>

          {/* Live Preview / Placeholder Banner */}
          <div className="relative h-36 w-full overflow-hidden rounded-2xl border border-border bg-secondary">
            {imagePreview ? (
              <>
                <img src={imagePreview} alt="Flyer Preview" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setImageUrl('');
                    setImagePreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                  title="Remove image"
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <div
                className="flex h-full w-full flex-col items-center justify-center p-4 text-center text-white"
                style={{ background: activeTheme.defaultBanner }}
              >
                <span className="text-3xl">{activeTheme.icon}</span>
                <p className="mt-1 font-serif text-sm font-bold">{activeTheme.label}</p>
                <p className="text-[10px] text-white/80">Upload custom flyer or keep this thematic banner</p>
              </div>
            )}
          </div>

          {/* Upload Button + URL Paste Input */}
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              className="px-3"
              data-testid="button-upload-flyer"
            >
              <Upload size={15} /> Upload Photo
            </Button>
            <input
              type="url"
              value={imageUrl.startsWith('data:') ? '' : imageUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="Or paste image URL (https://...)"
              className={inputClass}
              data-testid="input-campaign-image-url"
            />
          </div>
        </div>

        {/* Target Amount & Deadline */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target Amount (UGX)">
            <input
              required
              type="number"
              min="1"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="e.g. 5000000"
              className={inputClass}
              data-testid="input-campaign-target"
            />
          </Field>

          <Field label="Target Date / Deadline">
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className={inputClass}
              data-testid="input-campaign-deadline"
            />
          </Field>
        </div>

        {/* Mobile Money Payout Phone Number & Name */}
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            Mobile Money Payout Destination
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Phone Number To Receive Funds">
              <input
                required
                type="tel"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="e.g. 0772123456 / 0701234567"
                className={inputClass}
                data-testid="input-campaign-recipient-phone"
              />
            </Field>

            <Field label="Registered Recipient Name">
              <input
                required
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Mukisa Emmanuel"
                className={inputClass}
                data-testid="input-campaign-recipient-name"
              />
            </Field>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Contributors will see this verified phone number and name when sending money via MTN MoMo or Airtel Money.
          </p>
        </div>

        {/* Optional Destination Wallet Link */}
        <Field label="Optional: Link To App Wallet">
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className={inputClass}
            data-testid="select-campaign-account"
          >
            <option value="">Do not link to specific wallet</option>
            {accounts.filter((a) => a.isActive).map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({acc.currency})
              </option>
            ))}
          </select>
        </Field>

        {/* Description / Story */}
        <Field label="Message to Friends & Contributors">
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Share details about the ceremony, budget breakdown, or emergency situation..."
            className={`${inputClass} resize-none`}
            data-testid="input-campaign-description"
          />
        </Field>

        {/* Modal Buttons */}
        <div className="mt-4 flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} data-testid="button-cancel-campaign">
            Cancel
          </Button>
          <Button type="submit" disabled={pending} data-testid="button-submit-campaign">
            {pending ? 'Publishing…' : 'Publish Campaign'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CampaignDetailsModal({
  campaign,
  onClose,
}: {
  campaign: Campaign;
  onClose: () => void;
}) {
  const contributionsQuery = useQuery<{ contributions: Contribution[] }>({
    queryKey: ['campaign', campaign.id],
    queryFn: async () => {
      const token = localStorage.getItem('tereka_auth_token');
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to load contributions');
      return res.json();
    },
  });

  const contributions = contributionsQuery.data?.contributions || [];

  return (
    <Modal title={`Contributors: ${campaign.title}`} onClose={onClose}>
      <div className="space-y-4">
        {/* Top Summary Banner */}
        <div className="flex items-center justify-between rounded-2xl bg-secondary/60 p-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Total Raised</p>
            <p className="mt-1 font-serif text-2xl font-bold text-primary">
              {formatCurrency(campaign.totalRaised, 'UGX')}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Target</p>
            <p className="mt-1 font-mono text-base font-bold text-foreground">
              {formatCurrency(campaign.targetAmount, 'UGX')}
            </p>
          </div>
        </div>

        {/* Public Link reminder */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-xs">
          <span className="truncate text-muted-foreground">
            {window.location.origin}/c/{campaign.slug}
          </span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/c/${campaign.slug}`);
              alert('Public link copied to clipboard!');
            }}
            className="flex items-center gap-1 font-bold text-primary hover:underline"
          >
            <Copy size={13} /> Copy
          </button>
        </div>

        {/* Contributions List */}
        <div className="mt-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Contribution Ledger ({contributions.length})
          </p>

          {contributionsQuery.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : contributions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
              <Users size={28} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold">No contributions recorded yet</p>
              <p className="mt-1 text-xs">Share your public link to start receiving blessings & support.</p>
            </div>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {contributions.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card p-3.5 transition-colors hover:bg-secondary/30"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 font-bold text-primary">
                      {c.isAnonymous ? '?' : c.contributorName.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {c.isAnonymous ? 'Anonymous Well-Wisher' : c.contributorName}
                      </p>
                      {c.message && (
                        <p className="line-clamp-1 text-xs italic text-muted-foreground">"{c.message}"</p>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        {c.paymentMethod.replace('_', ' ').toUpperCase()} · {dateLabel(c.paidAt, true)}
                      </p>
                    </div>
                  </div>
                  <p className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    +{formatCurrency(c.amount, 'UGX')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default Campaigns;
