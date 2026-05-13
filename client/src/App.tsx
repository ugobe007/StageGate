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
import AdminDemoRequests from "@/pages/AdminDemoRequests";
import AdminShows from "./pages/AdminShows";
import AdminLeads from "./pages/AdminLeads";
import AdminOrders from "./pages/AdminOrders";
import AdminPartners from "./pages/AdminPartners";
import ShowsCalendar from "./pages/ShowsCalendar";
import ShowDetail from "./pages/ShowDetail";
import XbotLanding from "./pages/XbotLanding";
import XbotWizard from "./pages/XbotWizard";
import XbotProject from "./pages/XbotProject";
import AdminProspects from "./pages/AdminProspects";
import VideoIntake from "./pages/VideoIntake";
import Schedule from "./pages/Schedule";

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
      <Route path="/shows/:id" component={ShowDetail} />

      {/* XBOT */}
      <Route path="/xbot" component={XbotLanding} />
      <Route path="/xbot/new" component={XbotWizard} />
      <Route path="/xbot/project/:id" component={XbotProject} />

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
      <Route path="/admin/demos" component={AdminDemoRequests} />
      <Route path="/admin/prospects" component={AdminProspects} />

      {/* Video intake */}
      <Route path="/xbot/video" component={VideoIntake} />

      {/* Schedule */}
      <Route path="/schedule" component={Schedule} />

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
