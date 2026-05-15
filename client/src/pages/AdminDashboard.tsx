import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
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

// ── Supabase light tokens ──────────────────────────────────────────────────
const S = {
  bg:      "#f8fafc",
  surface: "#ffffff",
  s2:      "#f1f5f9",
  border:  "#e2e8f0",
  text:    "#0f172a",
  text2:   "#475569",
  text3:   "#94a3b8",
  green:   "#3ecf8e",
  greenDim:"rgba(62,207,142,0.12)",
  amber:   "#f59e0b",
  font:    "'Inter','Space Grotesk',ui-sans-serif,system-ui,sans-serif",
};

// ── Tiny helpers ───────────────────────────────────────────────────────────
const Card = ({ children, style, onMouseEnter, onMouseLeave }: { children: React.ReactNode; style?: React.CSSProperties; onMouseEnter?: React.MouseEventHandler<HTMLDivElement>; onMouseLeave?: React.MouseEventHandler<HTMLDivElement> }) => (
  <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: "0.5rem", ...style }} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
    {children}
  </div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ fontSize: "0.875rem", fontWeight: 600, color: S.text, margin: 0 }}>{children}</h2>
);

const Btn = ({ children, href, onClick, variant = "default" }: { children: React.ReactNode; href?: string; onClick?: () => void; variant?: "default" | "primary" | "ghost" }) => {
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: "0.375rem",
    padding: "0.375rem 0.75rem", borderRadius: "0.375rem",
    fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
    textDecoration: "none", border: `1px solid ${S.border}`,
    background: variant === "primary" ? S.green : S.surface,
    color: variant === "primary" ? "#0f172a" : S.text,
    transition: "background 0.1s",
    whiteSpace: "nowrap" as const,
  };
  if (href) return <Link href={href}><a style={base}>{children}</a></Link>;
  return <button style={base} onClick={onClick}>{children}</button>;
};

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
    onError: (err) => { setMigrating(false); toast.error('Migration failed', { description: err.message }); },
  });
  const { data: draftCount } = trpc.admin.getDraftCount.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin", refetchInterval: 60_000 });
  const { data: allUsers, refetch: refetchUsers } = trpc.admin.getUsers.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const setUserRole = trpc.admin.setUserRole.useMutation({
    onSuccess: () => { setTogglingRoleId(null); refetchUsers(); },
    onError: () => setTogglingRoleId(null),
  });

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: S.bg }}>
      <Loader2 size={24} style={{ color: S.green, animation: "spin 1s linear infinite" }} />
    </div>
  );

  if (!isAuthenticated) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: S.bg }}>
      <div style={{ textAlign: "center", maxWidth: "20rem" }}>
        <p style={{ color: S.text2, marginBottom: "1rem", fontSize: "0.875rem" }}>Admin access required</p>
        <a href={getLoginUrl()} style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 1rem", borderRadius: "0.375rem", background: S.green, color: "#0f172a", fontWeight: 600, fontSize: "0.875rem", textDecoration: "none" }}>Sign in</a>
      </div>
    </div>
  );

  if (user?.role !== "admin") return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: S.bg }}>
      <div style={{ textAlign: "center", maxWidth: "20rem" }}>
        <AlertCircle size={32} style={{ color: "#ef4444", marginBottom: "0.75rem" }} />
        <p style={{ color: S.text, fontWeight: 600, marginBottom: "0.5rem" }}>Access Denied</p>
        <p style={{ color: S.text2, fontSize: "0.875rem", marginBottom: "1rem" }}>You don't have admin privileges.</p>
        <Link href="/dashboard"><a style={{ color: S.green, fontSize: "0.875rem" }}>Go to Dashboard</a></Link>
      </div>
    </div>
  );

  const pendingOrders = (allOrders || []).filter(o => o.status === "pending").length;
  const newLeads = (allLeads || []).filter(l => l.outreachStatus === "new").length;
  const upcomingShows = (shows || []).filter(s => s.status === "upcoming").length;

  const STATS = [
    { label: "Companies", value: (allProfiles || []).length, icon: Building2, color: S.green, href: "/admin/orders" },
    { label: "Upcoming Shows", value: upcomingShows, icon: Calendar, color: "#3b82f6", href: "/admin/shows" },
    { label: "Pending Orders", value: pendingOrders, icon: Package, color: S.amber, href: "/admin/orders" },
    { label: "New Leads", value: newLeads, icon: Users, color: "#f97316", href: "/admin/leads" },
  ];

  const recentOrders = (allOrders || []).slice(0, 5);

  const statusText: Record<string, string> = {
    pending: S.amber, confirmed: "#3b82f6", in_progress: S.green,
    completed: "#64748b", cancelled: "#ef4444",
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1200px", margin: "0 auto", fontFamily: S.font, color: S.text }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.125rem", fontWeight: 700, color: S.text, margin: "0 0 0.25rem" }}>Dashboard</h1>
        <p style={{ fontSize: "0.8125rem", color: S.text2, margin: 0 }}>Manage shows, leads, orders, and logistics partners.</p>
      </div>

      {/* ── Top stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "1.25rem" }}>
        {STATS.map(s => (
          <Link key={s.label} href={s.href}>
            <a style={{ textDecoration: "none", display: "block" }}>
              <Card style={{ padding: "1rem", cursor: "pointer", transition: "border-color 0.15s" }}
                onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.borderColor = s.color + "60")}
                onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.borderColor = S.border)}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <s.icon size={15} style={{ color: s.color }} />
                  <ArrowRight size={12} style={{ color: S.text3 }} />
                </div>
                <div style={{ fontSize: "1.625rem", fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: "0.75rem", color: S.text2, marginTop: "0.25rem" }}>{s.label}</div>
              </Card>
            </a>
          </Link>
        ))}
      </div>

      {/* ── Pipeline health mini stats ── */}
      {siteStats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "0.625rem", marginBottom: "1.25rem" }}>
          {[
            { label: "Prospects", value: siteStats.prospects.total, sub: `${siteStats.prospects.byStatus?.new ?? 0} new`, color: S.green, href: "/admin/prospects" },
            { label: "Trade Shows", value: siteStats.tradeShows?.upcoming ?? 0, sub: "upcoming", color: "#3b82f6", href: "/admin/shows" },
            { label: "Services", value: siteStats.services?.active ?? 0, sub: "active", color: S.amber, href: "/admin/orders" },
            { label: "Log. Partners", value: siteStats.logisticsPartners?.total ?? 0, sub: "vendors", color: "#f97316", href: "/admin/vendors" },
            { label: "XBOT Projects", value: siteStats.xbotProjects?.total ?? 0, sub: "active", color: "#8b5cf6", href: "/admin/agents" },
            { label: "Agent Runs", value: siteStats.agentRuns?.total ?? 0, sub: "all time", color: S.green, href: "/admin/agents" },
            { label: "Conversations", value: siteStats.conversations?.total ?? 0, sub: `${siteStats.conversations?.awaiting ?? 0} awaiting`, color: "#06b6d4", href: "/admin/sales-agent" },
            { label: "Users", value: siteStats.users.total, sub: `${siteStats.users.admins} admin`, color: S.green, href: "/admin" },
          ].map(s => (
            <Link key={s.label} href={s.href}>
              <a style={{ textDecoration: "none" }}>
                <Card style={{ padding: "0.75rem", cursor: "pointer" }}>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: "0.6875rem", color: S.text, marginTop: "0.25rem", fontWeight: 500 }}>{s.label}</div>
                  <div style={{ fontSize: "0.625rem", color: S.text3 }}>{s.sub}</div>
                </Card>
              </a>
            </Link>
          ))}
        </div>
      )}

      {/* ── Two-column row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>

        {/* Sales pipeline */}
        <Card style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <MessageSquare size={14} style={{ color: S.green }} />
              <SectionTitle>Sales Agent Pipeline</SectionTitle>
            </div>
            <Btn href="/admin/sales-agent">View All <ArrowRight size={11} /></Btn>
          </div>
          {siteStats ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {[
                { label: "Discovery",   count: siteStats.conversations?.byState?.discovery ?? 0,         color: S.text3 },
                { label: "Awaiting",    count: siteStats.conversations?.byState?.awaiting_reply ?? 0,    color: S.amber },
                { label: "In Convo",    count: siteStats.conversations?.byState?.in_conversation ?? 0,   color: "#3b82f6" },
                { label: "Scheduling",  count: siteStats.conversations?.byState?.scheduling_sent ?? 0,   color: "#8b5cf6" },
                { label: "Booked",      count: (siteStats.conversations?.byState?.meeting_booked ?? 0) + (siteStats.conversations?.byState?.converted ?? 0), color: S.green },
              ].map(stage => {
                const total = siteStats.conversations?.total || 1;
                const pct = Math.round((stage.count / total) * 100);
                return (
                  <div key={stage.label} style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                    <span style={{ width: "72px", fontSize: "0.75rem", color: stage.color, fontWeight: 500, flexShrink: 0 }}>{stage.label}</span>
                    <div style={{ flex: 1, height: "4px", background: S.s2, borderRadius: "2px", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: "2px", background: stage.color, width: `${pct}%`, transition: "width 0.3s" }} />
                    </div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: S.text, width: "1.5rem", textAlign: "right" }}>{stage.count}</span>
                  </div>
                );
              })}
              <div style={{ marginTop: "0.5rem", paddingTop: "0.625rem", borderTop: `1px solid ${S.border}` }}>
                <span style={{ fontSize: "0.75rem", color: S.text2 }}>Total in pipeline: <strong style={{ color: S.text }}>{siteStats.conversations?.total ?? 0}</strong></span>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[1,2,3,4,5].map(i => <div key={i} style={{ height: "1.5rem", background: S.s2, borderRadius: "0.25rem" }} />)}
            </div>
          )}
        </Card>

        {/* Recent orders */}
        <Card style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Package size={14} style={{ color: S.green }} />
              <SectionTitle>Recent Orders</SectionTitle>
            </div>
            <Btn href="/admin/orders">View All <ArrowRight size={11} /></Btn>
          </div>
          {recentOrders.length === 0 ? (
            <p style={{ fontSize: "0.8125rem", color: S.text3, textAlign: "center", padding: "2rem 0" }}>No orders yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {recentOrders.map((order) => {
                const show = (shows || []).find(s => s.id === order.showId);
                const sc = statusText[order.status] ?? S.text3;
                return (
                  <div key={order.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0.625rem", borderRadius: "0.375rem", background: S.s2 }}>
                    <div>
                      <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: S.text }}>Order #{order.id}</div>
                      <div style={{ fontSize: "0.75rem", color: S.text2 }}>{show?.name || `Show #${order.showId}`}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      {order.totalAmount && <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: S.text }}>${parseFloat(order.totalAmount).toLocaleString()}</span>}
                      <span style={{ fontSize: "0.75rem", fontWeight: 500, color: sc }}>{order.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ── Outreach card ── */}
      {draftCount !== undefined && (
        <Card style={{ padding: "1.25rem", marginBottom: "1rem", borderColor: `${S.amber}40`, background: "#fffbf0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Send size={16} style={{ color: S.amber, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: S.text }}>
                  Frank's Outreach
                  {draftCount.pending > 0 && (
                    <span style={{ marginLeft: "0.5rem", fontSize: "0.6875rem", fontWeight: 700, color: S.amber }}>{draftCount.pending} pending</span>
                  )}
                </div>
                <div style={{ fontSize: "0.75rem", color: S.text2, marginTop: "0.125rem" }}>
                  {draftCount.pending > 0 ? `${draftCount.pending} draft${draftCount.pending !== 1 ? "s" : ""} pending review`
                    : draftCount.approved > 0 ? `${draftCount.approved} approved and ready to send`
                    : `${draftCount.sent} email${draftCount.sent !== 1 ? "s" : ""} sent`}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
              {[
                { label: "Pending", value: draftCount.pending, color: S.amber },
                { label: "Approved", value: draftCount.approved, color: S.green },
                { label: "Sent", value: draftCount.sent, color: "#3b82f6" },
                ...(siteStats ? [{ label: "In Pipeline", value: siteStats.conversations?.total ?? 0, color: "#8b5cf6" }] : []),
              ].map(d => (
                <div key={d.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.125rem", fontWeight: 700, color: d.color }}>{d.value}</div>
                  <div style={{ fontSize: "0.625rem", color: S.text3 }}>{d.label}</div>
                </div>
              ))}
              <Btn href="/admin/sales-agent" variant="primary">Go to Outreach <ArrowRight size={11} /></Btn>
            </div>
          </div>
        </Card>
      )}

      {/* ── Quick links ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
        {[
          { href: "/admin/shows",    icon: Calendar,    label: "Trade Shows",       desc: "Add, edit, and track upcoming shows" },
          { href: "/admin/leads",    icon: Users,       label: "AI Lead Discovery", desc: "Discover robotics companies" },
          { href: "/admin/orders",   icon: Package,     label: "Fulfill Orders",    desc: "Review and update service orders" },
          { href: "/admin/partners", icon: TrendingUp,  label: "Log. Partners",     desc: "Customs, transport, insurance" },
          { href: "/admin/quotes",   icon: FileText,    label: "Quote Requests",    desc: "Respond to inbound quotes" },
          { href: "/admin/demos",    icon: Play,        label: "Demo Requests",     desc: "Track inbound demo requests" },
          { href: "/admin/prospects",icon: Users,       label: "XBOT Prospects",    desc: "Robotics companies for outreach" },
        ].map(item => (
          <Link key={item.href} href={item.href}>
            <a style={{ textDecoration: "none", display: "block" }}>
              <Card style={{ padding: "1rem", cursor: "pointer", transition: "border-color 0.15s" }}
                onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.borderColor = `${S.green}60`)}
                onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.borderColor = S.border)}
              >
                <item.icon size={16} style={{ color: S.green, marginBottom: "0.5rem" }} />
                <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: S.text, marginBottom: "0.25rem" }}>{item.label}</div>
                <div style={{ fontSize: "0.75rem", color: S.text2, lineHeight: 1.4 }}>{item.desc}</div>
              </Card>
            </a>
          </Link>
        ))}
      </div>

      {/* ── Users table ── */}
      {allUsers && allUsers.length > 0 && (
        <Card style={{ marginBottom: "1rem", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.875rem 1.25rem", borderBottom: `1px solid ${S.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <ShieldCheck size={14} style={{ color: S.green }} />
              <SectionTitle>Registered Users</SectionTitle>
              <span style={{ fontSize: "0.6875rem", color: S.text3, marginLeft: "0.25rem" }}>{allUsers.length}</span>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="sb-table">
              <thead>
                <tr>
                  {["Name", "Email", "Role", "Joined", "Last Sign In", "Actions"].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {allUsers.map((u: { id: number; name: string | null; email: string | null; role: string; createdAt: Date; lastSignedIn: Date }) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>{u.name || <span style={{ color: S.text3, fontStyle: "italic" }}>—</span>}</td>
                    <td style={{ color: S.text2, fontFamily: "monospace", fontSize: "0.75rem" }}>{u.email || "—"}</td>
                    <td>
                      <span className={`sb-status ${u.role === "admin" ? "sb-status-active" : "sb-status-done"}`}>{u.role}</span>
                    </td>
                    <td style={{ color: S.text2, fontSize: "0.75rem" }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td style={{ color: S.text2, fontSize: "0.75rem" }}>{new Date(u.lastSignedIn).toLocaleDateString()}</td>
                    <td>
                      {u.id !== user?.id && (
                        <button
                          disabled={togglingRoleId === u.id}
                          onClick={() => { setTogglingRoleId(u.id); setUserRole.mutate({ userId: u.id, role: u.role === "admin" ? "user" : "admin" }); }}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: "0.25rem",
                            padding: "0.25rem 0.5rem", borderRadius: "0.25rem",
                            fontSize: "0.75rem", fontWeight: 500, cursor: "pointer",
                            border: `1px solid ${u.role === "admin" ? "#ef444440" : `${S.green}40`}`,
                            background: "transparent",
                            color: u.role === "admin" ? "#ef4444" : S.green,
                          }}
                        >
                          {togglingRoleId === u.id ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} />
                            : u.role === "admin" ? <><ShieldOff size={10} /> Demote</> : <><Shield size={10} /> Promote</>}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── DB Health ── */}
      {dbHealth && (
        <Card style={{ overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.875rem 1.25rem", borderBottom: `1px solid ${S.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Database size={14} style={{ color: S.green }} />
              <SectionTitle>Supabase Database</SectionTitle>
              <span className={`sb-status ${dbHealth.connected ? "sb-status-active" : "sb-status-error"}`}>
                {dbHealth.connected ? "Connected" : "Disconnected"}
              </span>
            </div>
            <button
              disabled={migrating}
              onClick={() => runMigration.mutate()}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.375rem",
                padding: "0.375rem 0.75rem", borderRadius: "0.375rem",
                fontSize: "0.75rem", fontWeight: 500, cursor: "pointer",
                border: `1px solid ${S.border}`, background: S.surface, color: S.text,
              }}
            >
              {migrating ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={12} />}
              {migrating ? "Syncing…" : "Re-run Migration"}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "0.5rem", padding: "1rem 1.25rem" }}>
            {Object.entries(dbHealth.tables).map(([table, count]) => (
              <div key={table} style={{ padding: "0.625rem", borderRadius: "0.375rem", background: S.s2, textAlign: "center" }}>
                <div style={{ fontSize: "1.125rem", fontWeight: 700, color: S.text }}>{count as number}</div>
                <div style={{ fontSize: "0.625rem", color: S.text2, marginTop: "0.125rem" }}>{table.replace(/_/g, " ")}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: "0.6875rem", color: S.text3, padding: "0 1.25rem 0.875rem" }}>
            Last checked: {new Date(dbHealth.checkedAt).toLocaleTimeString()} · Auto-refreshes every 30s
          </p>
        </Card>
      )}
    </div>
  );
}
