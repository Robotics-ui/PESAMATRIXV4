import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import DashboardPage from "@/pages/dashboard";
import PaymentPage from "@/pages/payment";
import MasterAccountsPage from "@/pages/master-accounts";
import SlaveAccountsPage from "@/pages/slave-accounts";
import StrategiesPage from "@/pages/strategies";
import BindingsPage from "@/pages/bindings";
import TradeLogsPage from "@/pages/trade-logs";
import AdminPage from "@/pages/admin/index";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function GuestRoute({ component: Component }: { component: React.ComponentType }) {
  const { token, isLoading } = useAuth();
  if (isLoading) return null;
  if (token) return <Redirect to="/dashboard" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/dashboard" />} />
      <Route path="/login" component={() => <GuestRoute component={LoginPage} />} />
      <Route path="/register" component={() => <GuestRoute component={RegisterPage} />} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/payment" component={PaymentPage} />
      <Route path="/master-accounts" component={MasterAccountsPage} />
      <Route path="/slave-accounts" component={SlaveAccountsPage} />
      <Route path="/strategies" component={StrategiesPage} />
      <Route path="/bindings" component={BindingsPage} />
      <Route path="/trade-logs" component={TradeLogsPage} />
      <Route path="/admin" component={AdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
