import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { getGetProfileQueryKey, useGetProfile, useUpdateProfile } from '@workspace/api-client-react';
import { Bot, CircleHelp, Gauge, Goal, LayoutGrid, LogOut, Menu, Moon, PiggyBank, ReceiptText, Settings, Sparkles, Sun, WalletCards, X } from 'lucide-react';
import { initials } from '@/lib/finance';
import { applyTheme } from '@/lib/theme';

const nav = [
  { href: '/', label: 'Overview', icon: Gauge },
  { href: '/transactions', label: 'Transactions', icon: ReceiptText },
  { href: '/accounts', label: 'Accounts', icon: WalletCards },
  { href: '/budgets', label: 'Budgets', icon: LayoutGrid },
  { href: '/goals', label: 'Goals', icon: Goal },
  { href: '/assistant', label: 'Tereka AI', icon: Sparkles },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const queryClient = useQueryClient();
  const profileQuery = useGetProfile();
  const updateProfile = useUpdateProfile();
  const profile = profileQuery.data;
  const name = profile?.fullName || 'Your money, your way';
  const isDark = profile?.theme === 'dark' || (profile?.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const theme = profile?.theme || 'light';
    applyTheme(theme);
    if (theme !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system');
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [profile?.theme]);
  const toggleTheme = () => {
    const nextTheme = isDark ? 'light' : 'dark';
    applyTheme(nextTheme);
    if (profile) {
      updateProfile.mutate(
        { data: { theme: nextTheme } },
        { onSuccess: (data) => queryClient.setQueryData(getGetProfileQueryKey(), data) },
      );
    }
  };

  const currentLabel = useMemo(() => nav.find((item) => item.href === location)?.label || 'Tereka', [location]);
  return (
    <div className="app-noise min-h-[100dvh] bg-background text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-sidebar px-5 py-6 text-sidebar-foreground transition-transform duration-300 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-10 flex items-center justify-between px-2">
          <Link href="/" className="flex items-center gap-3" data-testid="link-logo">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-sidebar-primary text-lg font-extrabold text-sidebar-primary-foreground">T</span>
            <span className="font-serif text-2xl tracking-tight">tereka<span className="text-sidebar-primary">.</span></span>
          </Link>
          <button className="rounded-lg p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent lg:hidden" onClick={() => setMobileOpen(false)} data-testid="button-close-menu"><X size={18} /></button>
        </div>
        <p className="mb-3 px-3 font-mono text-[10px] uppercase tracking-[.2em] text-sidebar-foreground/45">Your financial space</p>
        <nav className="space-y-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            return <Link key={href} href={href} onClick={() => setMobileOpen(false)} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${active ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}>
              <Icon size={18} strokeWidth={active ? 2.4 : 1.8} /><span>{label}</span>{label === 'Tereka AI' && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />}
            </Link>;
          })}
        </nav>
        <div className="mt-auto space-y-5">
          <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sidebar-primary"><CircleHelp size={15} /><span className="font-mono text-[10px] uppercase tracking-widest">Money note</span></div>
            <p className="text-xs leading-relaxed text-sidebar-foreground/65">Small, clear decisions add up. Keep going at your own pace.</p>
          </div>
          <div className="flex items-center gap-3 border-t border-sidebar-border pt-4">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-sidebar-primary font-bold text-sidebar-primary-foreground">{initials(name)}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{name}</p><p className="truncate text-xs text-sidebar-foreground/45">{profile?.email || 'Personal account'}</p></div>
            <Link href="/settings" className="text-sidebar-foreground/50 hover:text-sidebar-foreground" data-testid="link-settings-sidebar"><Settings size={16} /></Link>
          </div>
        </div>
      </aside>
      {mobileOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-sidebar/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} data-testid="button-overlay-menu" />}
      <main className="min-h-[100dvh] lg:pl-[260px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-border/70 bg-background/90 px-5 backdrop-blur-md sm:px-8 lg:px-12">
          <div className="flex items-center gap-3"><button className="rounded-xl border border-border p-2.5 lg:hidden" onClick={() => setMobileOpen(true)} data-testid="button-open-menu"><Menu size={19} /></button><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">Tereka / {currentLabel}</p><p className="mt-0.5 text-sm font-semibold text-foreground/75">{location === '/' ? 'Your money, in a clearer light.' : `A closer look at your ${currentLabel.toLowerCase()}.`}</p></div></div>
           <div className="flex items-center gap-2"><Link href="/assistant" className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground/75 hover:border-primary/40 hover:bg-secondary sm:flex" data-testid="link-header-assistant"><Bot size={15} className="text-primary" /> Ask Tereka</Link><button className="rounded-xl p-2 text-muted-foreground hover:bg-secondary" title={isDark ? 'Switch to light mode' : 'Switch to dark mode'} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggleTheme} disabled={updateProfile.isPending} data-testid="button-toggle-theme">{isDark ? <Sun size={17} /> : <Moon size={17} />}</button><button className="rounded-xl p-2 text-muted-foreground hover:bg-secondary" title="Sign out (demo)" onClick={() => setLocation('/login')} data-testid="button-sign-out"><LogOut size={17} /></button></div>
        </header>
        <div className="page-in px-5 py-7 sm:px-8 sm:py-10 lg:px-12">{children}</div>
      </main>
    </div>
  );
}

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[.22em] text-primary">{eyebrow}</p><h1 className="font-serif text-4xl tracking-tight text-foreground sm:text-5xl">{title}</h1>{description && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}</div>{action}</div>;
}

export function Button({ children, variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  const variants = { primary: 'bg-primary text-primary-foreground hover:opacity-90 shadow-sm', secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70', ghost: 'text-muted-foreground hover:bg-secondary hover:text-foreground', danger: 'bg-destructive/10 text-destructive hover:bg-destructive/15' };
  return <button className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${variants[variant]} ${className}`} {...props}>{children}</button>;
}

export function Card({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <section className={`rounded-2xl border border-card-border bg-card shadow-[0_14px_40px_hsl(165_25%_15%/0.035)] ${className}`} {...props}>{children}</section>;
}

export function Skeleton({ className = '' }: { className?: string }) { return <div className={`shimmer rounded-lg ${className}`} />; }

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-12 text-center"><div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary"><PiggyBank size={21} /></div><h3 className="font-serif text-xl">{title}</h3><p className="mt-2 max-w-sm text-sm text-muted-foreground">{body}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 backdrop-blur-sm sm:items-center sm:p-5"><div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-card p-6 shadow-2xl sm:rounded-3xl"><div className="mb-6 flex items-center justify-between"><h2 className="font-serif text-2xl">{title}</h2><button onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-secondary" data-testid="button-close-modal"><X size={18} /></button></div>{children}</div></div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-2"><span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>{children}</label>;
}

export const inputClass = 'w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10';