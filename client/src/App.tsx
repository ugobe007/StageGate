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
import GetStarted from "./pages/GetStarted";
import ClientDashboard from "./pages/ClientDashboard";
import ServiceOrder from "./pages/ServiceOrder";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminQuotes from "@/pages/AdminQuotes";
import AdminDemoRequests from "@/pages/AdminDemoRequests";
import AdminShows from "./pages/AdminShows";
import AdminLeads from "./pages/AdminLeads";
import AdminAgents from "./pages/AdminAgents";
import AdminOrders from "./pages/AdminOrders";
import AdminOrderDetail from "./pages/AdminOrderDetail";
import AdminPartners from "./pages/AdminPartners";
import ShowsCalendar from "./pages/ShowsCalendar";
import ShowDetail from "./pages/ShowDetail";
import XbotLanding from "./pages/XbotLanding";
import XbotWizard from "./pages/XbotWizard";
import XbotProject from "./pages/XbotProject";
import AdminProspects from "./pages/AdminProspects";
import AdminOutreach from "./pages/AdminOutreach";
import AdminPipeline from "./pages/AdminPipeline";
import AdminCompose from "./pages/AdminCompose";
import AdminBookings from "./pages/AdminBookings";
import AdminSalesAgent from "./pages/AdminSalesAgent";
import AdminScheduling from "./pages/AdminScheduling";
import AdminVendors from "./pages/AdminVendors";
import AdminLogistics from "./pages/AdminLogistics";
import VideoIntake from "./pages/VideoIntake";
import Schedule from "./pages/Schedule";
import TourBooking from "./pages/TourBooking";
import DbStatusBanner from "@/components/DbStatusBanner";
import About from "./pages/About";

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Home} />
      <Route path="/services" component={Services} />
      <Route path="/stagehand" component={StageHandPage} />
      <Route path="/stagepro" component={StageProPage} />
      <Route path="/register" component={Register} />
      <Route path="/get-started" component={GetStarted} />
      <Route path="/about" component={About} />
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
      <Route path="/admin/orders/:id" component={AdminOrderDetail} />
      <Route path="/admin/orders" component={AdminOrders} />
      <Route path="/admin/partners" component={AdminPartners} />
      <Route path="/admin/quotes" component={AdminQuotes} />
      <Route path="/admin/demos" component={AdminDemoRequests} />
      <Route path="/admin/prospects" component={AdminProspects} />
      <Route path="/admin/agents" component={AdminAgents} />
      <Route path="/admin/outreach" component={AdminOutreach} />
      <Route path="/admin/pipeline" component={AdminPipeline} />
      <Route path="/admin/compose" component={AdminCompose} />
      <Route path="/admin/bookings" component={AdminBookings} />
      <Route path="/admin/sales-agent" component={AdminSalesAgent} />
      <Route path="/admin/scheduling" component={AdminScheduling} />
      <Route path="/admin/vendors" component={AdminVendors} />
      <Route path="/admin/logistics" component={AdminLogistics} />

      {/* Video intake */}
      <Route path="/xbot/video" component={VideoIntake} />

      {/* Schedule */}
      <Route path="/schedule" component={Schedule} />
      <Route path="/tour" component={TourBooking} />

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
          <DbStatusBanner />
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
