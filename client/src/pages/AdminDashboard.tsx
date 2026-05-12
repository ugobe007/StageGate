import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  Building2, Calendar, Package, Users, TrendingUp, ArrowRight,
  Loader2, AlertCircle, CheckCircle, Clock, Zap, FileText, Play
} from "lucide-react";

export default function AdminDashboard() {
  const { user, isAuthenticated, loading } = useAuth();

  const { data: allOrders } = trpc.orders.allOrders.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const { data: shows } = trpc.shows.list.useQuery();
  const { data: allLeads } = trpc.leads.all.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const { data: allProfiles } = trpc.company.getAllProfiles.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="pt-32 pb-16 container max-w-lg mx-auto text-center">
          <div className="p-12 rounded-2xl border border-primary/30 bg-primary/5">
            <h1 className="text-3xl font-display font-bold mb-4">Admin Access Required</h1>
            <a href={getLoginUrl()}>
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold w-full">Sign In</Button>
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="pt-32 pb-16 container max-w-lg mx-auto text-center">
          <div className="p-12 rounded-2xl border border-destructive/30 bg-destructive/5">
            <AlertCircle size={48} className="text-destructive mx-auto mb-4" />
            <h1 className="text-3xl font-display font-bold mb-4">Access Denied</h1>
            <p className="text-muted-foreground mb-6">You don't have admin privileges.</p>
            <Link href="/dashboard">
              <Button variant="outline" className="border-border">Go to Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const pendingOrders = (allOrders || []).filter(o => o.status === "pending").length;
  const newLeads = (allLeads || []).filter(l => l.outreachStatus === "new").length;
  const emailedLeads = (allLeads || []).filter(l => l.outreachStatus === "emailed").length;
  const respondedLeads = (allLeads || []).filter(l => l.outreachStatus === "responded").length;
  const upcomingShows = (shows || []).filter(s => s.status === "upcoming").length;

  const STATS = [
    { label: "Registered Companies", value: (allProfiles || []).length, icon: Building2, color: "text-primary", href: "/admin/orders" },
    { label: "Upcoming Shows", value: upcomingShows, icon: Calendar, color: "text-blue-400", href: "/admin/shows" },
    { label: "Pending Orders", value: pendingOrders, icon: Package, color: "text-yellow-400", href: "/admin/orders" },
    { label: "New Leads", value: newLeads, icon: Users, color: "text-orange-400", href: "/admin/leads" },
  ];

  const recentOrders = (allOrders || []).slice(0, 5);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
            <div>
              <Badge className="mb-2 bg-primary/10 text-primary border-primary/30">Admin Operations</Badge>
              <h1 className="text-3xl font-display font-bold text-foreground">StageGate Dashboard</h1>
              <p className="text-muted-foreground mt-1">Manage shows, leads, orders, and logistics partners.</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Link href="/admin/shows">
                <Button variant="outline" size="sm" className="border-border gap-1.5">
                  <Calendar size={14} /> Shows
                </Button>
              </Link>
              <Link href="/admin/leads">
                <Button variant="outline" size="sm" className="border-border gap-1.5">
                  <Users size={14} /> Leads
                </Button>
              </Link>
              <Link href="/admin/orders">
                <Button variant="outline" size="sm" className="border-border gap-1.5">
                  <Package size={14} /> Orders
                </Button>
              </Link>
              <Link href="/admin/partners">
                <Button variant="outline" size="sm" className="border-border gap-1.5">
                  <TrendingUp size={14} /> Partners
                </Button>
              </Link>
              <Link href="/admin/quotes">
                <Button variant="outline" size="sm" className="border-border gap-1.5">
                  <FileText size={14} /> Quotes
                </Button>
              </Link>
              <Link href="/admin/demos">
                <Button variant="outline" size="sm" className="border-border gap-1.5">
                  <Play size={14} /> Demos
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {STATS.map((stat) => (
              <Link key={stat.label} href={stat.href}>
                <div className="p-5 rounded-xl border border-border bg-card hover:border-primary/50 transition-all cursor-pointer group">
                  <div className="flex items-center justify-between mb-3">
                    <stat.icon size={18} className={stat.color} />
                    <ArrowRight size={14} className="text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
                  </div>
                  <div className={`text-3xl font-display font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                </div>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Outreach Pipeline */}
            <div className="p-6 rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
                  <Zap size={16} className="text-primary" />
                  Outreach Pipeline
                </h2>
                <Link href="/admin/leads">
                  <Button size="sm" variant="outline" className="border-border text-xs gap-1">
                    View All <ArrowRight size={12} />
                  </Button>
                </Link>
              </div>
              <div className="space-y-3">
                {[
                  { label: "New", count: newLeads, color: "bg-secondary text-muted-foreground border-border", bar: "bg-muted-foreground/30" },
                  { label: "Emailed", count: emailedLeads, color: "bg-blue-500/20 text-blue-400 border-blue-500/30", bar: "bg-blue-500/50" },
                  { label: "Responded", count: respondedLeads, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", bar: "bg-yellow-500/50" },
                  { label: "Registered", count: (allLeads || []).filter(l => l.outreachStatus === "registered").length, color: "bg-primary/20 text-primary border-primary/30", bar: "bg-primary/50" },
                ].map((stage) => {
                  const total = (allLeads || []).length || 1;
                  const pct = Math.round((stage.count / total) * 100);
                  return (
                    <div key={stage.label} className="flex items-center gap-3">
                      <Badge className={`${stage.color} w-24 justify-center text-xs shrink-0`}>{stage.label}</Badge>
                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${stage.bar} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-sm font-semibold text-foreground w-6 text-right">{stage.count}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">Total leads: <strong className="text-foreground">{(allLeads || []).length}</strong></p>
              </div>
            </div>

            {/* Recent Orders */}
            <div className="p-6 rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
                  <Package size={16} className="text-primary" />
                  Recent Orders
                </h2>
                <Link href="/admin/orders">
                  <Button size="sm" variant="outline" className="border-border text-xs gap-1">
                    View All <ArrowRight size={12} />
                  </Button>
                </Link>
              </div>
              {recentOrders.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">No orders yet</div>
              ) : (
                <div className="space-y-3">
                  {recentOrders.map((order) => {
                    const show = (shows || []).find(s => s.id === order.showId);
                    const statusColors: Record<string, string> = {
                      pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
                      confirmed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
                      in_progress: "bg-primary/20 text-primary border-primary/30",
                      completed: "bg-green-500/20 text-green-400 border-green-500/30",
                      cancelled: "bg-destructive/20 text-destructive border-destructive/30",
                    };
                    return (
                      <div key={order.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                        <div>
                          <div className="text-sm font-medium text-foreground">Order #{order.id}</div>
                          <div className="text-xs text-muted-foreground">{show?.name || `Show #${order.showId}`}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {order.totalAmount && (
                            <span className="text-sm font-semibold text-foreground">${parseFloat(order.totalAmount).toLocaleString()}</span>
                          )}
                          <Badge className={`text-xs ${statusColors[order.status] || ""}`}>{order.status}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { href: "/admin/shows", icon: Calendar, label: "Manage Trade Shows", desc: "Add, edit, and track upcoming shows", color: "border-blue-500/30 bg-blue-500/5" },
              { href: "/admin/leads", icon: Users, label: "AI Lead Discovery", desc: "Discover robotics companies from exhibitor lists", color: "border-primary/30 bg-primary/5" },
              { href: "/admin/orders", icon: Package, label: "Fulfill Orders", desc: "Review and update service order statuses", color: "border-yellow-500/30 bg-yellow-500/5" },
              { href: "/admin/partners", icon: TrendingUp, label: "Logistics Partners", desc: "Manage customs, transport, and insurance partners", color: "border-purple-500/30 bg-purple-500/5" },
              { href: "/admin/quotes", icon: FileText, label: "Quote Requests", desc: "Review and respond to inbound quote requests", color: "border-green-500/30 bg-green-500/5" },
              { href: "/admin/demos", icon: Play, label: "Demo Requests", desc: "Track and manage inbound demo requests", color: "border-violet-500/30 bg-violet-500/5" },
            ].map((item) => (
              <Link key={item.href} href={item.href}>
                <div className={`p-5 rounded-xl border ${item.color} hover:opacity-90 transition-all cursor-pointer group`}>
                  <item.icon size={20} className="text-primary mb-3" />
                  <div className="font-semibold text-sm text-foreground mb-1">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
