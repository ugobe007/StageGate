import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useState } from "react";
import { toast } from "sonner";
import {
  Building2, Calendar, Package, Users, TrendingUp, ArrowRight,
  Loader2, AlertCircle, Zap, FileText, Play,
  ShieldCheck, BarChart3, UserCheck, Shield, ShieldOff,
  Database, RefreshCw, CheckCircle2, XCircle, Send, MessageSquare
} from "lucide-react";

export default function AdminDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [togglingRoleId, setTogglingRoleId] = useState<number | null>(null);
  const [migrating, setMigrating] = useState(false);

  const { data: allOrders } = trpc.orders.allOrders.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const { data: shows } = trpc.shows.list.useQuery();
  const { data: allLeads } = trpc.leads.all.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const { data: allProfiles } = trpc.company.getAllProfiles.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const { data: siteStats } = trpc.admin.getSiteStats.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const { data: dbHealth, refetch: refetchDbHealth } = trpc.admin.dbHealth.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin", refetchInterval: 30000 });
  const runMigration = trpc.admin.runMigration.useMutation({
    onMutate: () => setMigrating(true),
    onSuccess: (data) => {
      setMigrating(false);
      refetchDbHealth();
      const rows = Object.entries(data.result.migrated).map(([k, v]) => `${k}: ${v}`).join(', ');
      toast.success('Migration complete', { description: rows });
    },
    onError: (err) => {
      setMigrating(false);
      toast.error('Migration failed', { description: err.message });
    },
  });
  const { data: draftCount } = trpc.admin.getDraftCount.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin", refetchInterval: 60_000 });
  const { data: allUsers, refetch: refetchUsers } = trpc.admin.getUsers.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const setUserRole = trpc.admin.setUserRole.useMutation({
    onSuccess: () => { setTogglingRoleId(null); refetchUsers(); },
    onError: () => setTogglingRoleId(null),
  });

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
              <Link href="/admin/prospects">
                <Button variant="outline" size="sm" className="border-border gap-1.5">
                  <Users size={14} /> Prospects
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

          {/* Pipeline Health Row */}
          {siteStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
              {[
                { label: "Prospects", value: siteStats.prospects.total, sub: `${siteStats.prospects.byStatus?.new ?? 0} new`, icon: Users, color: "text-emerald-400", href: "/admin/prospects" },
                { label: "Trade Shows", value: siteStats.tradeShows?.upcoming ?? siteStats.tradeShows?.total ?? 0, sub: "upcoming", icon: Calendar, color: "text-blue-400", href: "/admin/shows" },
                { label: "Services", value: siteStats.services?.active ?? siteStats.services?.total ?? 0, sub: "active", icon: Package, color: "text-yellow-400", href: "/admin/orders" },
                { label: "Logistics Partners", value: siteStats.logisticsPartners?.total ?? 0, sub: "vendors", icon: TrendingUp, color: "text-orange-400", href: "/admin/vendors" },
                { label: "XBOT Projects", value: siteStats.xbotProjects?.total ?? 0, sub: "active", icon: BarChart3, color: "text-violet-400", href: "/admin/xbot" },
                { label: "Agent Runs", value: siteStats.agentRuns?.total ?? 0, sub: "all time", icon: Zap, color: "text-primary", href: "/admin/agents" },
                { label: "Conversations", value: siteStats.conversations?.total ?? 0, sub: `${siteStats.conversations?.awaiting ?? 0} awaiting`, icon: MessageSquare, color: "text-cyan-400", href: "/admin/sales-agent" },
                { label: "Users", value: siteStats.users.total, sub: `${siteStats.users.admins} admin`, icon: UserCheck, color: "text-primary", href: "/admin" },
              ].map(s => (
                <Link key={s.label} href={s.href}>
                  <div className="p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-all cursor-pointer">
                    <s.icon size={15} className={`${s.color} mb-2`} />
                    <div className={`text-2xl font-display font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 leading-tight">{s.label}</div>
                    <div className="text-xs text-muted-foreground/60 mt-0.5">{s.sub}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Agent Pipeline */}
            <div className="p-6 rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
                  <MessageSquare size={16} className="text-primary" />
                  Sales Agent Pipeline
                </h2>
                <Link href="/admin/sales-agent">
                  <Button size="sm" variant="outline" className="border-border text-xs gap-1">
                    View All <ArrowRight size={12} />
                  </Button>
                </Link>
              </div>
              {siteStats ? (
                <div className="space-y-3">
                  {[
                    { label: "Discovery", count: siteStats.conversations?.byState?.discovery ?? 0, color: "bg-secondary text-muted-foreground border-border", bar: "bg-muted-foreground/30" },
                    { label: "Awaiting", count: siteStats.conversations?.byState?.awaiting_reply ?? 0, color: "bg-amber-500/20 text-amber-400 border-amber-500/30", bar: "bg-amber-500/50" },
                    { label: "In Convo", count: siteStats.conversations?.byState?.in_conversation ?? 0, color: "bg-blue-500/20 text-blue-400 border-blue-500/30", bar: "bg-blue-500/50" },
                    { label: "Scheduling", count: siteStats.conversations?.byState?.scheduling_sent ?? 0, color: "bg-violet-500/20 text-violet-400 border-violet-500/30", bar: "bg-violet-500/50" },
                    { label: "Booked", count: (siteStats.conversations?.byState?.meeting_booked ?? 0) + (siteStats.conversations?.byState?.converted ?? 0), color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", bar: "bg-emerald-500/50" },
                  ].map((stage) => {
                    const total = siteStats.conversations?.total || 1;
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
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground">Total prospects in pipeline: <strong className="text-foreground">{siteStats.conversations?.total ?? 0}</strong></p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-secondary rounded animate-pulse" />)}
                </div>
              )}
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

          {/* Users Table */}
          {allUsers && allUsers.length > 0 && (
            <div className="mt-6 p-6 rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck size={16} className="text-primary" />
                  Registered Users
                  <Badge className="ml-1 bg-primary/10 text-primary border-primary/30 text-xs">{allUsers.length}</Badge>
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Name", "Email", "Role", "Joined", "Last Sign In", "Actions"].map(h => (
                        <th key={h} className="text-left pb-3 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map((u: { id: number; name: string | null; email: string | null; role: string; createdAt: Date; lastSignedIn: Date }) => (
                      <tr key={u.id} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                        <td className="py-3 pr-4 font-medium text-foreground">{u.name || <span className="text-muted-foreground italic">—</span>}</td>
                        <td className="py-3 pr-4 text-muted-foreground font-mono text-xs">{u.email || "—"}</td>
                        <td className="py-3 pr-4">
                          <Badge className={u.role === "admin" ? "bg-primary/20 text-primary border-primary/30 text-xs" : "bg-secondary text-muted-foreground border-border text-xs"}>
                            {u.role}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td className="py-3 pr-4 text-muted-foreground text-xs">{new Date(u.lastSignedIn).toLocaleDateString()}</td>
                        <td className="py-3">
                          {u.id !== user?.id && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={togglingRoleId === u.id}
                              onClick={() => {
                                setTogglingRoleId(u.id);
                                setUserRole.mutate({ userId: u.id, role: u.role === "admin" ? "user" : "admin" });
                              }}
                              className={`text-xs gap-1 border-border h-7 px-2 ${
                                u.role === "admin"
                                  ? "text-destructive hover:text-destructive hover:border-destructive/50"
                                  : "text-primary hover:text-primary hover:border-primary/50"
                              }`}
                            >
                              {togglingRoleId === u.id ? (
                                <Loader2 size={10} className="animate-spin" />
                              ) : u.role === "admin" ? (
                                <><ShieldOff size={10} /> Demote</>
                              ) : (
                                <><Shield size={10} /> Promote</>
                              )}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* DB Health + Migration */}
          {dbHealth && (
            <div className="mt-6 p-6 rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
                  <Database size={16} className="text-primary" />
                  Supabase Database
                  <Badge className={dbHealth.connected ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs" : "bg-destructive/20 text-destructive border-destructive/30 text-xs"}>
                    {dbHealth.connected ? (
                      <><CheckCircle2 size={10} className="mr-1" />Connected</>
                    ) : (
                      <><XCircle size={10} className="mr-1" />Disconnected</>
                    )}
                  </Badge>
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={migrating}
                  onClick={() => runMigration.mutate()}
                  className="border-border text-xs gap-1.5"
                >
                  {migrating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  {migrating ? 'Syncing…' : 'Re-run Migration'}
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
                {Object.entries(dbHealth.tables).map(([table, count]) => (
                  <div key={table} className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-center">
                    <div className="text-xl font-display font-bold text-foreground">{count}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate" title={table}>{table.replace(/_/g, ' ')}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">Last checked: {new Date(dbHealth.checkedAt).toLocaleTimeString()} · Auto-refreshes every 30s</p>
            </div>
          )}

          {/* Frank's Outreach Card */}
          {draftCount !== undefined && (
            <div className="mt-6 p-5 rounded-xl border border-amber-500/30 bg-amber-500/5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <Send size={20} className="text-amber-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                      Frank's Outreach
                      {draftCount.pending > 0 && (
                        <Badge className="bg-amber-500 text-black text-[10px] px-1.5 py-0 h-4 font-bold">{draftCount.pending} pending</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {draftCount.pending > 0
                        ? `${draftCount.pending} draft${draftCount.pending !== 1 ? 's' : ''} pending review`
                        : draftCount.approved > 0
                        ? `${draftCount.approved} draft${draftCount.approved !== 1 ? 's' : ''} approved and ready to send`
                        : `${draftCount.sent} email${draftCount.sent !== 1 ? 's' : ''} sent`}
                    </div>
                    {draftCount.lastSentAt && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Last sent: {new Date(draftCount.lastSentAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 flex-wrap">
                  <div className="flex gap-4 text-center">
                    <div>
                      <div className="text-xl font-bold text-amber-400">{draftCount.pending}</div>
                      <div className="text-[10px] text-muted-foreground">Pending</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-emerald-400">{draftCount.approved}</div>
                      <div className="text-[10px] text-muted-foreground">Approved</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-blue-400">{draftCount.sent}</div>
                      <div className="text-[10px] text-muted-foreground">Sent</div>
                    </div>
                    {siteStats && (
                      <div>
                        <div className="text-xl font-bold text-violet-400">{siteStats.conversations?.total ?? 0}</div>
                        <div className="text-[10px] text-muted-foreground">In Pipeline</div>
                      </div>
                    )}
                  </div>
                  <Link href="/admin/sales-agent">
                    <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-black font-semibold gap-1.5">
                      Go to Outreach <ArrowRight size={12} />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Quick Links */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { href: "/admin/shows", icon: Calendar, label: "Manage Trade Shows", desc: "Add, edit, and track upcoming shows", color: "border-blue-500/30 bg-blue-500/5" },
              { href: "/admin/leads", icon: Users, label: "AI Lead Discovery", desc: "Discover robotics companies from exhibitor lists", color: "border-primary/30 bg-primary/5" },
              { href: "/admin/orders", icon: Package, label: "Fulfill Orders", desc: "Review and update service order statuses", color: "border-yellow-500/30 bg-yellow-500/5" },
              { href: "/admin/partners", icon: TrendingUp, label: "Logistics Partners", desc: "Manage customs, transport, and insurance partners", color: "border-purple-500/30 bg-purple-500/5" },
              { href: "/admin/quotes", icon: FileText, label: "Quote Requests", desc: "Review and respond to inbound quote requests", color: "border-green-500/30 bg-green-500/5" },
              { href: "/admin/demos", icon: Play, label: "Demo Requests", desc: "Track and manage inbound demo requests", color: "border-violet-500/30 bg-violet-500/5" },
              { href: "/admin/prospects", icon: Users, label: "XBOT Prospects", desc: "Robotics companies for outreach — send AI-personalized emails", color: "border-emerald-500/30 bg-emerald-500/5" },
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
