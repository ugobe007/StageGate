import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Services from "./pages/Services";
import StageHandPage from "./pages/StageHandPage";
import StageProPage from "./pages/StageProPage";
import Register from "./pages/Register";
import GetStarted from "./pages/GetStarted";
import ClientDashboard from "./pages/ClientDashboard";
import ServiceOrder from "./pages/ServiceOrder";
import OrderDetail from "./pages/OrderDetail";
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
import AdminPartnerOutreach from "./pages/AdminPartnerOutreach";
import AdminLogistics from "./pages/AdminLogistics";
import VideoIntake from "./pages/VideoIntake";
import Schedule from "./pages/Schedule";
import TourBooking from "./pages/TourBooking";
import DbStatusBanner from "@/components/DbStatusBanner";
import About from "./pages/About";
import Onboarding from "./pages/Onboarding";
import AuthRedirect from "./pages/AuthRedirect";
import AdminServiceRequests from "./pages/AdminServiceRequests";
import AdminCalendar from "./pages/AdminCalendar";
import CalendarEventPage from "./pages/CalendarEventPage";
import Newsletter from "./pages/Newsletter";
import RobotTracker from "./pages/RobotTracker";
import LogoPreview from "./pages/LogoPreview";

/** Wraps admin pages in the shared DashboardLayout sidebar shell */
function AdminShell({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

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
      <Route path="/logo-preview" component={LogoPreview} />
      <Route path="/newsletter" component={Newsletter} />
      <Route path="/shows" component={ShowsCalendar} />
      <Route path="/shows/:id" component={ShowDetail} />

      {/* XBOT */}
      <Route path="/xbot" component={XbotLanding} />
      <Route path="/xbot/new" component={XbotWizard} />
      <Route path="/xbot/project/:id" component={XbotProject} />

      {/* Auth routing */}
      <Route path="/auth-redirect" component={AuthRedirect} />

      {/* Client */}
      <Route path="/dashboard" component={ClientDashboard} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/order" component={ServiceOrder} />
      <Route path="/orders/:id" component={OrderDetail} />

      {/* Admin — all wrapped in DashboardLayout sidebar */}
      <Route path="/admin">{() => <AdminShell><AdminDashboard /></AdminShell>}</Route>
      <Route path="/admin/shows">{() => <AdminShell><AdminShows /></AdminShell>}</Route>
      <Route path="/admin/leads">{() => <AdminShell><AdminLeads /></AdminShell>}</Route>
      <Route path="/admin/orders/:id">{() => <AdminShell><AdminOrderDetail /></AdminShell>}</Route>
      <Route path="/admin/orders">{() => <AdminShell><AdminOrders /></AdminShell>}</Route>
      <Route path="/admin/partners">{() => <AdminShell><AdminPartners /></AdminShell>}</Route>
      <Route path="/admin/partner-outreach">{() => <AdminShell><AdminPartnerOutreach /></AdminShell>}</Route>
      <Route path="/admin/quotes">{() => <AdminShell><AdminQuotes /></AdminShell>}</Route>
      <Route path="/admin/demos">{() => <AdminShell><AdminDemoRequests /></AdminShell>}</Route>
      <Route path="/admin/prospects">{() => <AdminShell><AdminProspects /></AdminShell>}</Route>
      <Route path="/admin/agents">{() => <AdminShell><AdminAgents /></AdminShell>}</Route>
      <Route path="/admin/outreach">{() => <AdminShell><AdminOutreach /></AdminShell>}</Route>
      <Route path="/admin/pipeline">{() => <AdminShell><AdminPipeline /></AdminShell>}</Route>
      <Route path="/admin/compose">{() => <AdminShell><AdminCompose /></AdminShell>}</Route>
      <Route path="/admin/bookings">{() => <AdminShell><AdminBookings /></AdminShell>}</Route>
      <Route path="/admin/sales-agent">{() => <AdminShell><AdminSalesAgent /></AdminShell>}</Route>
      <Route path="/admin/scheduling">{() => <AdminShell><AdminScheduling /></AdminShell>}</Route>
      <Route path="/admin/vendors">{() => <AdminShell><AdminVendors /></AdminShell>}</Route>
      <Route path="/admin/logistics">{() => <AdminShell><AdminLogistics /></AdminShell>}</Route>
      <Route path="/admin/service-requests">{() => <AdminShell><AdminServiceRequests /></AdminShell>}</Route>
      <Route path="/admin/calendar">{() => <AdminShell><AdminCalendar /></AdminShell>}</Route>

      {/* Public calendar share link */}
      <Route path="/calendar/:token" component={CalendarEventPage} />
      <Route path="/track/:token" component={RobotTracker} />

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
