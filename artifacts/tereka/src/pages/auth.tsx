import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, Check, Coins, LockKeyhole, Mail, ShieldCheck, Sparkles, User, AlertCircle, Loader2 } from 'lucide-react';
import { Button, Field, inputClass } from '@/components/layout';
import { useAuth } from '@/lib/auth-context';

function AuthShell({ eyebrow, title, copy, children }: { eyebrow: string; title: string; copy: string; children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <div className="grid min-h-[100dvh] lg:grid-cols-[.86fr_1.14fr]">
        <section className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
          <Link href="/" className="flex items-center gap-3" data-testid="link-auth-logo">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-sidebar-primary font-extrabold text-sidebar-primary-foreground">T</span>
            <span className="font-serif text-2xl">tereka<span className="text-sidebar-primary">.</span></span>
          </Link>
          <div className="relative z-10 max-w-md">
            <p className="mb-5 font-mono text-[10px] uppercase tracking-[.25em] text-sidebar-primary">A calmer way to be with money</p>
            <p className="font-serif text-5xl leading-[1.1]">Clarity for the life you're building.</p>
            <p className="mt-6 max-w-sm text-sm leading-7 text-sidebar-foreground/65">Tereka turns the everyday movement of your money into a view you can actually use — tailored for East African mobile money and bank accounts.</p>
            <div className="mt-10 flex items-center gap-3 text-xs text-sidebar-foreground/60">
              <ShieldCheck size={16} className="text-sidebar-primary" /> Real double-entry security · User isolated spaces
            </div>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-sidebar-foreground/35">Your financial space, in focus.</p>
          <div className="pointer-events-none absolute -right-24 top-1/3 h-72 w-72 rounded-full border-[40px] border-sidebar-primary/10" />
        </section>
        <section className="flex items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-[430px]">
            <Link href="/" className="mb-12 inline-flex items-center gap-2 lg:hidden" data-testid="link-auth-mobile-logo">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary font-extrabold text-primary-foreground">T</span>
              <span className="font-serif text-xl">tereka<span className="text-primary">.</span></span>
            </Link>
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[.22em] text-primary">{eyebrow}</p>
            <h1 className="font-serif text-4xl leading-tight sm:text-5xl">{title}</h1>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{copy}</p>
            <div className="mt-9">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

export function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      setLocation('/');
    } catch (err: any) {
      setError(err.message || 'Unable to sign in. Please verify your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await login('mukisa@example.com', 'password123');
      setLocation('/');
    } catch (err: any) {
      setError(err.message || 'Failed to sign into demo account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Good to see you."
      copy="Your financial picture is waiting. Pick up where you left off."
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Field label="Email address">
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-3.5 text-muted-foreground" />
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={`${inputClass} pl-10`}
              data-testid="input-login-email"
            />
          </div>
        </Field>

        <Field label="Password">
          <div className="relative">
            <LockKeyhole size={16} className="absolute left-3 top-3.5 text-muted-foreground" />
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className={`${inputClass} pl-10`}
              data-testid="input-login-password"
            />
          </div>
        </Field>

        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-xs font-bold text-primary hover:underline" data-testid="link-forgot-password">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" disabled={loading} className="w-full py-3.5" data-testid="button-login">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <>Open my space <ArrowRight size={16} /></>}
        </Button>

        <div className="relative my-4 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <span className="relative bg-background px-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">or</span>
        </div>

        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-secondary px-4 py-3 text-sm font-bold text-foreground transition-colors hover:bg-secondary/80"
          data-testid="button-demo-login"
        >
          <Sparkles size={16} className="text-primary" />
          Explore Demo Space (Emmanuel Mukisa)
        </button>

        <p className="pt-3 text-center text-sm text-muted-foreground">
          New to Tereka?{' '}
          <Link href="/signup" className="font-bold text-primary hover:underline" data-testid="link-signup">
            Create an account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function Signup() {
  const [, setLocation] = useLocation();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(name, email, password, 'UGX');
      setLocation('/');
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Start with clarity"
      title="Build your money picture."
      copy="A few details now, then a clearer view of what your money is doing every day."
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Field label="Your full name">
          <div className="relative">
            <User size={16} className="absolute left-3 top-3.5 text-muted-foreground" />
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Amina Nanyonga"
              className={`${inputClass} pl-10`}
              data-testid="input-signup-name"
            />
          </div>
        </Field>

        <Field label="Email address">
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-3.5 text-muted-foreground" />
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={`${inputClass} pl-10`}
              data-testid="input-signup-email"
            />
          </div>
        </Field>

        <Field label="Create a password">
          <div className="relative">
            <LockKeyhole size={16} className="absolute left-3 top-3.5 text-muted-foreground" />
            <input
              required
              minLength={6}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className={`${inputClass} pl-10`}
              data-testid="input-signup-password"
            />
          </div>
        </Field>

        <div className="rounded-xl bg-secondary/70 p-3 text-xs leading-5 text-muted-foreground">
          <Check size={14} className="mr-1 inline text-primary" /> Your data stays isolated and private in Ugandan Shillings (UGX).
        </div>

        <Button type="submit" disabled={loading} className="w-full py-3.5" data-testid="button-signup">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <>Create my space <ArrowRight size={16} /></>}
        </Button>

        <p className="pt-3 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-bold text-primary hover:underline" data-testid="link-login">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Back to a clearer picture."
      copy="Enter the email linked to your Tereka space and we'll send a reset link."
    >
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
        {sent ? (
          <div className="rounded-2xl border border-primary/20 bg-secondary p-5">
            <div className="mb-3 grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
              <Check size={18} />
            </div>
            <h2 className="font-serif text-xl">Check your inbox</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              If an account exists for <strong className="text-foreground">{email}</strong>, a reset link is on its way.
            </p>
          </div>
        ) : (
          <>
            <Field label="Email address">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
                data-testid="input-reset-email"
              />
            </Field>
            <Button type="submit" className="w-full py-3.5" data-testid="button-send-reset">
              Send reset link <ArrowRight size={16} />
            </Button>
          </>
        )}
        <p className="pt-3 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-bold text-primary hover:underline" data-testid="link-back-login">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}