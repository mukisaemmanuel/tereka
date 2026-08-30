import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Accounts, Budgets, Dashboard, Goals, Settings, Transactions, Assistant } from '@/pages/finance';
import { ForgotPassword, Login, Signup } from '@/pages/auth';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/transactions" component={Transactions} />
          <Route path="/accounts" component={Accounts} />
          <Route path="/budgets" component={Budgets} />
          <Route path="/goals" component={Goals} />
          <Route path="/assistant" component={Assistant} />
          <Route path="/settings" component={Settings} />
          <Route path="/login" component={Login} />
          <Route path="/signup" component={Signup} />
          <Route path="/forgot-password" component={ForgotPassword} />
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
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
