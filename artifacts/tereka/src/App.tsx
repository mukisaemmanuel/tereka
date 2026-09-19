import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Accounts, Budgets, Dashboard, Settings, Transactions, Assistant } from '@/pages/finance';
import { Goals } from '@/pages/goals';
import { Debts } from '@/pages/debts';
import { Campaigns } from '@/pages/campaigns';
import { Vaults } from '@/pages/vaults';
import { PublicCampaign } from '@/pages/public-campaign';
import { ForgotPassword, Login, Signup } from '@/pages/auth';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { BudgetAlertProvider } from '@/lib/budget-alerts';
import {
  Redirect,
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary font-extrabold text-primary-foreground shadow-lg animate-pulse">
            T
          </span>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Opening your financial space...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function PublicAuthRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary font-extrabold text-primary-foreground animate-pulse">
          T
        </span>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/">
          <ProtectedRoute component={Dashboard} />
        </Route>
        <Route path="/transactions">
          <ProtectedRoute component={Transactions} />
        </Route>
        <Route path="/accounts">
          <ProtectedRoute component={Accounts} />
        </Route>
        <Route path="/budgets">
          <ProtectedRoute component={Budgets} />
        </Route>
        <Route path="/debts">
          <ProtectedRoute component={Debts} />
        </Route>
        <Route path="/vaults">
          <ProtectedRoute component={Vaults} />
        </Route>
        <Route path="/campaigns">
          <ProtectedRoute component={Campaigns} />
        </Route>
        <Route path="/goals">
          <ProtectedRoute component={Goals} />
        </Route>
        <Route path="/assistant">
          <ProtectedRoute component={Assistant} />
        </Route>
        <Route path="/settings">
          <ProtectedRoute component={Settings} />
        </Route>

        <Route path="/c/:slug">
          {({ slug }) => <PublicCampaign slug={slug} />}
        </Route>

        <Route path="/login">
          <PublicAuthRoute component={Login} />
        </Route>
        <Route path="/signup">
          <PublicAuthRoute component={Signup} />
        </Route>
        <Route path="/forgot-password">
          <PublicAuthRoute component={ForgotPassword} />
        </Route>

        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BudgetAlertProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </BudgetAlertProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
