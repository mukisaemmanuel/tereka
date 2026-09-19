import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import {
  Calendar,
  CheckCircle2,
  Coins,
  Copy,
  Heart,
  MessageSquare,
  PartyPopper,
  Share2,
  ShieldCheck,
  Smartphone,
  User,
  Users,
} from 'lucide-react';
import { formatCurrency, dateLabel } from '@/lib/finance';

interface PublicCampaignData {
  campaign: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    type: 'kwanjula' | 'wedding' | 'mabugo' | 'medical' | 'graduation' | 'general';
    targetAmount: number;
    currency: string;
    deadline: string | null;
    recipientPhone?: string | null;
    recipientName?: string | null;
    imageUrl: string | null;
    status: 'active' | 'completed' | 'paused';
    totalRaised: number;
    remainingAmount: number;
    contributorsCount: number;
    percentageComplete: number;
    organizerName?: string;
  };
  contributions: Array<{
    id: string;
    contributorName: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    message: string | null;
    isAnonymous: boolean;
    paidAt: string;
  }>;
}

const PRESET_AMOUNTS = [20000, 50000, 100000, 250000, 500000];

const EVENT_TYPE_THEMES: Record<string, { label: string; banner: string; icon: string }> = {
  kwanjula: {
    label: 'Kwanjula / Introduction Ceremony',
    banner: 'linear-gradient(135deg, #78350f 0%, #d97706 50%, #f59e0b 100%)',
    icon: '💍',
  },
  wedding: {
    label: 'Wedding Reception & Celebrations',
    banner: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #10b981 100%)',
    icon: '💐',
  },
  mabugo: {
    label: 'Mabugo / Funeral & Bereavement Support',
    banner: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)',
    icon: '🕊️',
  },
  medical: {
    label: 'Medical Emergency Appeal',
    banner: 'linear-gradient(135deg, #881337 0%, #e11d48 50%, #fb7185 100%)',
    icon: '🩺',
  },
  graduation: {
    label: 'Graduation / Birthday Celebration',
    banner: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 50%, #6366f1 100%)',
    icon: '🎓',
  },
  general: {
    label: 'Community Fundraiser',
    banner: 'linear-gradient(135deg, #13231e 0%, #1f4236 50%, #2e6250 100%)',
    icon: '🤝',
  },
};

export function PublicCampaign({ slug: propSlug }: { slug?: string }) {
  const [, params] = useRoute('/c/:slug');
  const slug = propSlug || params?.slug || '';
  const qc = useQueryClient();

  // Form State
  const [selectedAmount, setSelectedAmount] = useState<number | null>(50000);
  const [customAmount, setCustomAmount] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'mtn_momo' | 'airtel_money'>('mtn_momo');
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [successData, setSuccessData] = useState<{ amount: number; name: string } | null>(null);

  const { data, isLoading, error } = useQuery<PublicCampaignData>({
    queryKey: ['public-campaign', slug],
    queryFn: async () => {
      const token = localStorage.getItem('tereka_auth_token');
      const res = await fetch(`/api/public/campaigns/${slug}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        if (res.status === 404) throw new Error('Campaign not found');
        throw new Error('Failed to load campaign');
      }
      return res.json();
    },
    enabled: !!slug,
  });

  const contributeMutation = useMutation({
    mutationFn: async (payload: {
      amount: number;
      contributorName: string;
      contributorPhone: string;
      paymentMethod: string;
      message?: string;
      isAnonymous: boolean;
    }) => {
      const res = await fetch(`/api/public/campaigns/${slug}/contribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to complete contribution');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['public-campaign', slug] });
      setSuccessData({
        amount: variables.amount,
        name: variables.isAnonymous ? 'Anonymous' : variables.contributorName,
      });
      setName('');
      setPhone('');
      setMessage('');
      setCustomAmount('');
    },
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleCopyPhone = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 3000);
  };

  const handleContribute = (e: React.FormEvent) => {
    e.preventDefault();
    const finalAmount = selectedAmount !== null ? selectedAmount : Math.round(Number(customAmount));

    if (!finalAmount || finalAmount < 500) {
      alert('Please enter a valid amount of at least UGX 500');
      return;
    }

    if (!name.trim() && !isAnonymous) {
      alert('Please enter your name or check "Contribute anonymously"');
      return;
    }

    contributeMutation.mutate({
      amount: finalAmount,
      contributorName: isAnonymous ? 'Anonymous Well-Wisher' : name.trim(),
      contributorPhone: phone.trim(),
      paymentMethod,
      message: message.trim() || undefined,
      isAnonymous,
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary font-bold text-primary-foreground animate-pulse">
            T
          </span>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Loading Campaign...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-xl">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            ✕
          </span>
          <h2 className="mt-4 font-serif text-xl font-bold">Campaign Not Found</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            The requested fundraiser might have ended or the link is incorrect.
          </p>
          <a
            href="/"
            className="mt-6 inline-block rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground transition-transform hover:scale-105"
          >
            Visit Tereka Home
          </a>
        </div>
      </div>
    );
  }

  const { campaign, contributions } = data;
  const theme = EVENT_TYPE_THEMES[campaign.type] || EVENT_TYPE_THEMES.general;
  const isFinished = campaign.percentageComplete >= 100;

  return (
    <div className="min-h-[100dvh] bg-[#f8faf9] text-foreground antialiased dark:bg-[#0c1411]">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary font-serif font-black text-primary-foreground shadow-sm">
              T
            </span>
            <span className="font-serif text-lg font-bold tracking-tight">Tereka</span>
            <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
              UGX
            </span>
          </div>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary"
          >
            {copied ? (
              <>
                <CheckCircle2 size={14} className="text-emerald-500" /> Copied
              </>
            ) : (
              <>
                <Share2 size={14} /> Share Link
              </>
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {/* HERO BANNER SECTION */}
        <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card shadow-lg">
          <div className="relative h-56 w-full sm:h-72">
            {campaign.imageUrl ? (
              <img
                src={campaign.imageUrl}
                alt={campaign.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center p-6 text-white"
                style={{ background: theme.banner }}
              >
                <div className="text-center">
                  <span className="text-5xl drop-shadow-md">{theme.icon}</span>
                  <p className="mt-3 font-serif text-xl font-bold tracking-tight drop-shadow-lg sm:text-2xl">
                    {theme.label}
                  </p>
                </div>
              </div>
            )}

            {/* Badges on Hero */}
            <div className="absolute left-4 top-4">
              <span className="rounded-full bg-background/90 px-3.5 py-1.5 text-xs font-bold text-foreground shadow-md backdrop-blur-md">
                {theme.label}
              </span>
            </div>

            <div className="absolute right-4 top-4">
              <span
                className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wider shadow-md backdrop-blur-md ${
                  isFinished ? 'bg-emerald-500 text-white' : 'bg-background/90 text-foreground'
                }`}
              >
                {campaign.percentageComplete}% Raised
              </span>
            </div>
          </div>

          {/* Campaign Details Header */}
          <div className="p-6 sm:p-8">
            <h1 className="font-serif text-2xl font-black text-foreground sm:text-3xl">
              {campaign.title}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {campaign.organizerName && (
                <span className="flex items-center gap-1 font-medium">
                  <User size={13} className="text-primary" /> Organized by{' '}
                  <strong className="text-foreground">{campaign.organizerName}</strong>
                </span>
              )}
              {campaign.deadline && (
                <span className="flex items-center gap-1">
                  <Calendar size={13} /> Target Date: {dateLabel(campaign.deadline, true)}
                </span>
              )}
            </div>

            {campaign.description && (
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {campaign.description}
              </p>
            )}

            {/* Financial Progress Bar */}
            <div className="mt-6 rounded-2xl bg-secondary/50 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="font-serif text-3xl font-black text-primary sm:text-4xl">
                    {formatCurrency(campaign.totalRaised, 'UGX')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    raised toward {formatCurrency(campaign.targetAmount, 'UGX')} goal
                  </p>
                </div>

                <div className="text-right">
                  <span className="font-mono text-sm font-bold text-foreground">
                    {campaign.contributorsCount} {campaign.contributorsCount === 1 ? 'supporter' : 'supporters'}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(Math.max(0, campaign.remainingAmount), 'UGX')} remaining
                  </p>
                </div>
              </div>

              <div className="mt-3 h-3.5 w-full overflow-hidden rounded-full bg-border/60">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isFinished ? 'bg-emerald-500' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(100, campaign.percentageComplete)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* CONTRIBUTION SECTION & LEDGER */}
        <div className="mt-8 grid gap-8 md:grid-cols-12">
          {/* Contribution Form (7 cols) */}
          <div className="md:col-span-7">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-md sm:p-7">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="font-serif text-xl font-bold">Send Contribution</h2>
                  <p className="text-xs text-muted-foreground">Direct Mobile Money payment in UGX</p>
                </div>
                <ShieldCheck className="text-emerald-500" size={24} />
              </div>

              {/* Verified Payout Recipient Destination */}
              {campaign.recipientPhone && (
                <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    Send Funds Directly To:
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-mono text-base font-black text-amber-950 dark:text-amber-100">
                        {campaign.recipientPhone}
                      </p>
                      {campaign.recipientName && (
                        <p className="text-xs font-semibold text-amber-800/90 dark:text-amber-200">
                          Recipient Name: {campaign.recipientName}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyPhone(campaign.recipientPhone!)}
                      className="flex items-center gap-1 rounded-xl border border-amber-500/30 bg-card px-3 py-1.5 text-xs font-bold text-foreground shadow-sm transition-colors hover:bg-secondary"
                    >
                      {copiedPhone ? (
                        <>
                          <CheckCircle2 size={13} className="text-emerald-500" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy size={13} /> Copy Number
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Success Notification */}
              {successData && (
                <div className="my-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-200">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
                    Webale Nyo! Thank you, {successData.name}!
                  </div>
                  <p className="mt-1 text-xs">
                    Your generous support of {formatCurrency(successData.amount, 'UGX')} has been received and added
                    to the campaign ledger.
                  </p>
                </div>
              )}

              <form onSubmit={handleContribute} className="mt-5 space-y-4">
                {/* Amount Selection */}
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Select Contribution Amount (UGX)
                  </label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {PRESET_AMOUNTS.map((amt) => {
                      const active = selectedAmount === amt;
                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            setSelectedAmount(amt);
                            setCustomAmount('');
                          }}
                          className={`rounded-2xl border p-2.5 font-mono text-xs font-bold transition-all ${
                            active
                              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                              : 'border-border bg-secondary/60 text-foreground hover:bg-secondary'
                          }`}
                        >
                          {amt >= 1000000 ? `${amt / 1000000}M` : `${amt / 1000}k`}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setSelectedAmount(null)}
                      className={`rounded-2xl border p-2.5 font-mono text-xs font-bold transition-all ${
                        selectedAmount === null
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-secondary/60 text-foreground hover:bg-secondary'
                      }`}
                    >
                      Custom
                    </button>
                  </div>

                  {selectedAmount === null && (
                    <div className="mt-2">
                      <input
                        type="number"
                        min="500"
                        placeholder="Enter other amount (UGX)"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        className="w-full rounded-2xl border border-border bg-background px-4 py-3 font-mono text-sm focus:border-primary focus:outline-none"
                        required
                        autoFocus
                      />
                    </div>
                  )}
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Payment Method
                  </label>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('mtn_momo')}
                      className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left transition-all ${
                        paymentMethod === 'mtn_momo'
                          ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200'
                          : 'border-border bg-card hover:bg-secondary/40'
                      }`}
                    >
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-400 font-bold text-black text-xs">
                        MTN
                      </span>
                      <div>
                        <p className="text-xs font-bold">MTN MoMo</p>
                        <p className="text-[10px] text-muted-foreground">*165# prompt</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('airtel_money')}
                      className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left transition-all ${
                        paymentMethod === 'airtel_money'
                          ? 'border-red-500 bg-red-500/10 text-red-900 dark:text-red-200'
                          : 'border-border bg-card hover:bg-secondary/40'
                      }`}
                    >
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-red-500 font-bold text-white text-xs">
                        AIR
                      </span>
                      <div>
                        <p className="text-xs font-bold">Airtel Money</p>
                        <p className="text-[10px] text-muted-foreground">*185# prompt</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Name & Phone */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Your Full Name
                    </label>
                    <input
                      type="text"
                      disabled={isAnonymous}
                      required={!isAnonymous}
                      value={isAnonymous ? 'Anonymous' : name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Mukisa Emmanuel"
                      className="mt-1 w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs focus:border-primary focus:outline-none disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Mobile Money Number
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="077xxxxxxx / 070xxxxxxx"
                      className="mt-1 w-full rounded-2xl border border-border bg-background px-4 py-2.5 font-mono text-xs focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                {/* Anonymous Toggle */}
                <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span>Hide my name on the public supporters wall</span>
                </label>

                {/* Encouraging Message / Blessing */}
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Words of Encouragement / Blessing
                  </label>
                  <textarea
                    rows={2}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="e.g. Congratulations! Wishing you a joyous celebration and blessed marriage!"
                    className="mt-1 w-full resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-xs focus:border-primary focus:outline-none"
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={contributeMutation.isPending}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-md transition-all hover:opacity-90 disabled:opacity-50"
                >
                  <Heart size={16} className="fill-current" />
                  {contributeMutation.isPending
                    ? 'Processing...'
                    : `Contribute ${formatCurrency(
                        selectedAmount !== null ? selectedAmount : Number(customAmount) || 0,
                        'UGX'
                      )}`}
                </button>
              </form>
            </div>
          </div>

          {/* Wall of Blessings & Contributors (5 cols) */}
          <div className="md:col-span-5">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-md">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-serif text-lg font-bold">Recent Supporters</h3>
                <span className="font-mono text-xs font-bold text-primary">
                  {contributions.length} {contributions.length === 1 ? 'gift' : 'gifts'}
                </span>
              </div>

              {contributions.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <PartyPopper size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-semibold">Be the first to contribute</p>
                  <p className="mt-1 text-xs">Your support will appear here immediately.</p>
                </div>
              ) : (
                <div className="mt-4 max-h-[500px] space-y-3 overflow-y-auto pr-1">
                  {contributions.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-2xl border border-border/70 bg-secondary/30 p-3.5 transition-colors hover:bg-secondary/60"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 font-bold text-primary text-xs">
                            {c.isAnonymous ? '?' : c.contributorName.slice(0, 1).toUpperCase()}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-foreground">
                              {c.isAnonymous ? 'Anonymous Well-Wisher' : c.contributorName}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{dateLabel(c.paidAt, true)}</p>
                          </div>
                        </div>

                        <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          +{formatCurrency(c.amount, 'UGX')}
                        </span>
                      </div>

                      {c.message && (
                        <p className="mt-2 text-xs italic text-muted-foreground pl-10 border-l border-border/80">
                          "{c.message}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-border/40 py-8 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Tereka Financial Intelligence. Secure community fundraising for Uganda.</p>
      </footer>
    </div>
  );
}

export default PublicCampaign;
