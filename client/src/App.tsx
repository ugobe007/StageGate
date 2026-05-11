import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Services from "./pages/Services";
import StageHandPage from "./pages/StageHandPage";
import StageProPage from "./pages/StageProPage";
import Register from "./pages/Register";
import ClientDashboard from "./pages/ClientDashboard";
import ServiceOrder from "./pages/ServiceOrder";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminQuotes from "@/pages/AdminQuotes";
import AdminShows from "./pages/AdminShows";
import AdminLeads from "./pages/AdminLeads";
import AdminOrders from "./pages/AdminOrders";
import AdminPartners from "./pages/AdminPartners";
import ShowsCalendar from "./pages/ShowsCalendar";

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Home} />
      <Route path="/services" component={Services} />
      <Route path="/stagehand" component={StageHandPage} />
      <Route path="/stagepro" component={StageProPage} />
      <Route path="/register" component={Register} />
      <Route path="/shows" component={ShowsCalendar} />

      {/* Client */}
      <Route path="/dashboard" component={ClientDashboard} />
      <Route path="/order" component={ServiceOrder} />

      {/* Admin */}
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/shows" component={AdminShows} />
      <Route path="/admin/leads" component={AdminLeads} />
      <Route path="/admin/orders" component={AdminOrders} />
      <Route path="/admin/partners" component={AdminPartners} />
      <Route path="/admin/quotes" component={AdminQuotes} />

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
