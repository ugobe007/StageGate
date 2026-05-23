import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useState } from "react";
import { toast } from "sonner";
import {
  Building2, Calendar, Package, Users, TrendingUp, ArrowRight,
  Loader2, AlertCircle, Zap, FileText, Play,
  ShieldCheck, Database, RefreshCw, Send, MessageSquare,
  Shield, ShieldOff,
} from "lucide-react";
import DailyBriefPanel from "@/components/DailyBriefPanel";

// ── Dark palette tokens ────────────────────────────────────────────────────
const D = {
  bg:         "#080808",
  surface:    "#111111",
  s2:         "#1a1a1a",
  border:     "rgba(255,255,255,0.08)",
  text:       "#ececec",
  text2:      "rgba(255,255,255,0.55)",
  text3:      "rgba(255,255,255,0.28)",
  emerald:    "#00ff87",
  emeraldDim: "rgba(0,255,135,0.10)",
  amber:      "#f59e0b",
  blue:       "#60a5fa",
  red:        "#ef4444",
  font:       "'Space Grotesk','Inter',ui-sans-serif,system-ui,sans-serif",
};

const Card = ({ children, style, onMouseEnter, onMouseLeave }: {
  children: React.ReactNode; style?: React.CSSProperties;
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
}) => (
  <div
    style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: "0.375rem", ...style }}
    onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
  >
    {children}
  </div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ fontSize: "0.875rem", fontWeight: 600, color: D.text, margin: 0 }}>{children}</h2>
);

const Btn = ({ children, href, onClick, variant = "default" }: {
  children: React.ReactNode; href?: string; onClick?: () => void; variant?: "default" | "primary" | "ghost";
}) => {
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: "0.375rem",
    padding: "0.3rem 0.65rem", borderRadius: "0.25rem",
    fontSize: "0.75rem", fontWeight: 500, cursor: "pointer",
    textDecoration: "none",
    border: variant === "primary" ? "none" : `1px solid ${D.border}`,
    background: variant === "primary" ? D.emerald : "transparent",
    color: variant === "primary" ? "#080808" : D.text2,
    transition: "background 0.1s, color 0.1s",
    whiteSpace: "nowrap" as const,
  };
  if (href) return <Link href={href}><a style={base}>{children}</a></Link>;
  return <button style={base} onClick={onClick}>{children}</button>;
};

export default function AdminDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [togglingRoleId, setTogglingRoleId] = useState<number | null>(null);

  const { data: allOrders } = trpc.orders.allOrders.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const { data: shows } = trpc.shows.list.useQuery();
  const { data: allLeads } = trpc.leads.all.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const { data: allProfiles } = trpc.company.getAllProfiles.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const { data: siteStats } = trpc.admin.getSiteStats.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const { data: dbHealth, refetch: refetchDbHealth } = trpc.admin.dbHealth.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin", refetchInterval: 30000 });
  const { data: draftCount } = trpc.admin.getDraftCount.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin", refetchInterval: 60_000 });
  const { data: allUsers, refetch: refetchUsers } = trpc.admin.getUsers.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const setUserRole = trpc.admin.setUserRole.useMutation({
    onSuccess: () => { setTogglingRoleId(null); refetchUsers(); },
    onError: () => setTogglingRoleId(null),
  });

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: D.bg }}>
      <Loader2 size={24} style={{ color: D.emerald, animation: "spin 1s linear infinite" }} />
    </div>
  );

  if (!isAuthenticated) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: D.bg }}>
      <div style={{ textAlign: "center", maxWidth: "20rem" }}>
        <p style={{ color: D.text2, marginBottom: "1rem", fontSize: "0.875rem" }}>Admin access required</p>
        <a href={getLoginUrl()} style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 1rem", borderRadius: "0.25rem", background: D.emerald, color: "#080808", fontWeight: 700, fontSize: "0.875rem", textDecoration: "none" }}>Sign in</a>
      </div>
    </div>
  );

  if (user?.role !== "admin") return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: D.bg }}>
      <div style={{ textAlign: "center", maxWidth: "20rem" }}>
        <AlertCircle size={32} style={{ color: D.red, marginBottom: "0.75rem" }} />
        <p style={{ color: D.text, fontWeight: 600, marginBottom: "0.5rem" }}>Access Denied</p>
        <p style={{ color: D.text2, fontSize: "0.875rem", marginBottom: "1rem" }}>You don't have admin privileges.</p>
        <Link href="/dashboard"><a style={{ color: D.emerald, fontSize: "0.875rem" }}>Go to Dashboard</a></Link>
      </div>
    </div>
  );

  const pendingOrders = (allOrders || []).filter(o => o.status === "pending").length;
  const newLeads = (allLeads || []).filter(l => l.outreachStatus === "new").length;
  const upcomingShows = (shows || []).filter(s => s.status === "upcoming").length;

  const STATS = [
    { label: "Companies",      value: (allProfiles || []).length, icon: Building2, color: D.emerald, href: "/admin/orders" },
    { label: "Upcoming Shows", value: upcomingShows,              icon: Calendar,  color: D.blue,    href: "/admin/shows" },
    { label: "Pending Orders", value: pendingOrders,              icon: Package,   color: D.amber,   href: "/admin/orders" },
    { label: "New Leads",      value: newLeads,                   icon: Users,     color: "#f97316", href: "/admin/leads" },
  ];

  const recentOrders = (allOrders || []).slice(0, 5);

  const statusColor: Record<string, string> = {
    pending: D.amber, confirmed: D.blue, in_progress: D.emerald,
    completed: D.text3, cancelled: D.red,
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1200px", margin: "0 auto", fontFamily: D.font, color: D.text }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: "1.5rem", borderBottom: `1px solid ${D.border}`, paddingBottom: "1rem" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: D.text3, margin: "0 0 0.25rem" }}>STAGEGATE / ADMIN</p>
        <h1 style={{ fontSize: "1.125rem", fontWeight: 700, color: D.text, margin: "0 0 0.25rem", letterSpacing: "-0.02em" }}>Dashboard</h1>
        <p style={{ fontSize: "0.8125rem", color: D.text2, margin: 0 }}>Manage shows, leads, orders, and logistics partners.</p>
      </div>

      <DailyBriefPanel enabled={isAuthenticated && user?.role === "admin"} />

      {/* ── Top stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "1.25rem" }}>
        {STATS.map(s => (
          <Link key={s.label} href={s.href}>
            <a style={{ textDecoration: "none", display: "block" }}>
              <Card
                style={{ padding: "1rem", cursor: "pointer", transition: "border-color 0.15s" }}
                onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.borderColor = s.color + "40")}
                onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.borderColor = D.border)}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <s.icon size={15} style={{ color: s.color }} />
                  <ArrowRight size={12} style={{ color: D.text3 }} />
                </div>
                <div style={{ fontSize: "1.625rem", fontWeight: 700, color: s.color, lineHeight: 1, fontFamily: "var(--font-mono)" }}>{s.value}</div>
                <div style={{ fontSize: "0.75rem", color: D.text2, marginTop: "0.25rem" }}>{s.label}</div>
              </Card>
            </a>
          </Link>
        ))}
      </div>

      {/* ── Pipeline health mini stats ── */}
      {siteStats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "0.625rem", marginBottom: "1.25rem" }}>
          {[
            { label: "Prospects",    value: siteStats.prospects.total,            sub: `${siteStats.prospects.byStatus?.new ?? 0} new`,    color: D.emerald, href: "/admin/prospects" },
            { label: "Trade Shows",  value: siteStats.tradeShows?.upcoming ?? 0,  sub: "upcoming",                                          color: D.blue,    href: "/admin/shows" },
            { label: "Services",     value: siteStats.services?.active ?? 0,      sub: "active",                                            color: D.amber,   href: "/admin/orders" },
            { label: "Log. Partners",value: siteStats.logisticsPartners?.total ?? 0, sub: "vendors",                                        color: "#f97316", href: "/admin/vendors" },
            { label: "New Requests",  value: siteStats.serviceRequests?.newCount ?? 0, sub: `${siteStats.serviceRequests?.total ?? 0} total`,   color: D.amber,   href: "/admin/service-requests" },
            { label: "XBOT Projects",value: siteStats.xbotProjects?.total ?? 0,   sub: "active",                                            color: "#a78bfa", href: "/admin/agents" },
            { label: "Agent Runs",   value: siteStats.agentRuns?.total ?? 0,      sub: "all time",                                          color: D.emerald, href: "/admin/agents" },
            { label: "Conversations",value: siteStats.conversations?.total ?? 0,  sub: `${siteStats.conversations?.awaiting ?? 0} awaiting`,color: "#22d3ee", href: "/admin/sales-agent" },
            { label: "Users",        value: siteStats.users.total,                sub: `${siteStats.users.admins} admin`,                   color: D.emerald, href: "/admin" },
          ].map(s => (
            <Link key={s.label} href={s.href}>
              <a style={{ textDecoration: "none" }}>
                <Card style={{ padding: "0.75rem", cursor: "pointer" }}>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color: s.color, lineHeight: 1, fontFamily: "var(--font-mono)" }}>{s.value}</div>
                  <div style={{ fontSize: "0.6875rem", color: D.text, marginTop: "0.25rem", fontWeight: 500 }}>{s.label}</div>
                  <div style={{ fontSize: "0.625rem", color: D.text3 }}>{s.sub}</div>
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
              <MessageSquare size={14} style={{ color: D.emerald }} />
              <SectionTitle>Cal Pipeline</SectionTitle>
            </div>
            <Btn href="/admin/sales-agent">View All <ArrowRight size={11} /></Btn>
          </div>
          {siteStats ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {[
                { label: "Discovery",  count: siteStats.conversations?.byState?.discovery ?? 0,         color: D.text3 },
                { label: "Awaiting",   count: siteStats.conversations?.byState?.awaiting_reply ?? 0,    color: D.amber },
                { label: "Scheduling", count: siteStats.conversations?.byState?.scheduling_sent ?? 0,   color: "#a78bfa" },
                { label: "Booked",     count: (siteStats.conversations?.byState?.meeting_booked ?? 0) + (siteStats.conversations?.byState?.converted ?? 0), color: D.emerald },
              ].map(stage => {
                const total = siteStats.conversations?.total || 1;
                const pct = Math.round((stage.count / total) * 100);
                return (
                  <div key={stage.label} style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                    <span style={{ width: "72px", fontSize: "0.75rem", color: stage.color, fontWeight: 500, flexShrink: 0 }}>{stage.label}</span>
                    <div style={{ flex: 1, height: "3px", background: D.s2, borderRadius: "2px", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: "2px", background: stage.color, width: `${pct}%`, transition: "width 0.3s" }} />
                    </div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: D.text, width: "1.5rem", textAlign: "right", fontFamily: "var(--font-mono)" }}>{stage.count}</span>
                  </div>
                );
              })}
              <div style={{ marginTop: "0.5rem", paddingTop: "0.625rem", borderTop: `1px solid ${D.border}` }}>
                <span style={{ fontSize: "0.75rem", color: D.text2 }}>Total in pipeline: <strong style={{ color: D.emerald }}>{siteStats.conversations?.total ?? 0}</strong></span>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[1,2,3,4,5].map(i => <div key={i} style={{ height: "1.5rem", background: D.s2, borderRadius: "0.25rem" }} />)}
            </div>
          )}
        </Card>

        {/* Recent orders */}
        <Card style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Package size={14} style={{ color: D.emerald }} />
              <SectionTitle>Recent Orders</SectionTitle>
            </div>
            <Btn href="/admin/orders">View All <ArrowRight size={11} /></Btn>
          </div>
          {recentOrders.length === 0 ? (
            <p style={{ fontSize: "0.8125rem", color: D.text3, textAlign: "center", padding: "2rem 0" }}>No orders yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {recentOrders.map((order) => {
                const show = (shows || []).find(s => s.id === order.showId);
                const sc = statusColor[order.status] ?? D.text3;
                return (
                  <div key={order.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0.625rem", borderRadius: "0.25rem", background: D.s2 }}>
                    <div>
                      <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: D.text }}>Order #{order.id}</div>
                      <div style={{ fontSize: "0.75rem", color: D.text2 }}>{show?.name || `Show #${order.showId}`}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      {order.totalAmount && <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: D.text, fontFamily: "var(--font-mono)" }}>${parseFloat(order.totalAmount).toLocaleString()}</span>}
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
        <Card style={{ padding: "1.25rem", marginBottom: "1rem", borderColor: `rgba(245,158,11,0.25)` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Send size={16} style={{ color: D.amber, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: D.text }}>
                  Cal's Outreach
                  {draftCount.pending > 0 && (
                    <span style={{ marginLeft: "0.5rem", fontSize: "0.6875rem", fontWeight: 700, color: D.amber }}>{draftCount.pending} pending</span>
                  )}
                </div>
                <div style={{ fontSize: "0.75rem", color: D.text2, marginTop: "0.125rem" }}>
                  {draftCount.pending > 0 ? `${draftCount.pending} draft${draftCount.pending !== 1 ? "s" : ""} pending review`
                    : draftCount.approved > 0 ? `${draftCount.approved} approved and ready to send`
                    : `${draftCount.sent} email${draftCount.sent !== 1 ? "s" : ""} sent`}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
              {[
                { label: "Pending",    value: draftCount.pending,  color: D.amber },
                { label: "Approved",   value: draftCount.approved, color: D.emerald },
                { label: "Sent",       value: draftCount.sent,     color: D.blue },
                ...(siteStats ? [{ label: "In Pipeline", value: siteStats.conversations?.total ?? 0, color: "#a78bfa" }] : []),
              ].map(d => (
                <div key={d.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.125rem", fontWeight: 700, color: d.color, fontFamily: "var(--font-mono)" }}>{d.value}</div>
                  <div style={{ fontSize: "0.625rem", color: D.text3 }}>{d.label}</div>
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
          { href: "/admin/shows",     icon: Calendar,   label: "Trade Shows",       desc: "Add, edit, and track upcoming shows" },
          { href: "/admin/leads",     icon: Users,      label: "AI Lead Discovery", desc: "Discover robotics companies" },
          { href: "/admin/orders",    icon: Package,    label: "Fulfill Orders",    desc: "Review and update service orders" },
          { href: "/admin/partners",  icon: TrendingUp, label: "Log. Partners",     desc: "Customs, transport, insurance" },
          { href: "/admin/quotes",    icon: FileText,   label: "Quote Requests",    desc: "Respond to inbound quotes" },
          { href: "/admin/demos",     icon: Play,       label: "Demo Requests",     desc: "Track inbound demo requests" },
          { href: "/admin/prospects", icon: Zap,        label: "XBOT Prospects",    desc: "Robotics companies for outreach" },
        ].map(item => (
          <Link key={item.href} href={item.href}>
            <a style={{ textDecoration: "none", display: "block" }}>
              <Card
                style={{ padding: "1rem", cursor: "pointer", transition: "border-color 0.15s" }}
                onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.borderColor = `rgba(0,255,135,0.25)`)}
                onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.borderColor = D.border)}
              >
                <item.icon size={16} style={{ color: D.emerald, marginBottom: "0.5rem" }} />
                <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: D.text, marginBottom: "0.25rem" }}>{item.label}</div>
                <div style={{ fontSize: "0.75rem", color: D.text2, lineHeight: 1.4 }}>{item.desc}</div>
              </Card>
            </a>
          </Link>
        ))}
      </div>

      {/* ── Users table ── */}
      {allUsers && allUsers.length > 0 && (
        <Card style={{ marginBottom: "1rem", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.875rem 1.25rem", borderBottom: `1px solid ${D.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <ShieldCheck size={14} style={{ color: D.emerald }} />
              <SectionTitle>Registered Users</SectionTitle>
              <span style={{ fontSize: "0.6875rem", color: D.text3, marginLeft: "0.25rem" }}>{allUsers.length}</span>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr>
                  {["Name", "Email", "Role", "Joined", "Last Sign In", "Actions"].map(h => (
                    <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: D.text3, borderBottom: `1px solid ${D.border}`, background: D.surface, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allUsers.map((u: { id: number; name: string | null; email: string | null; role: string; createdAt: Date; lastSignedIn: Date }) => (
                  <tr key={u.id} onMouseEnter={e => (e.currentTarget.style.background = D.s2)} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "0.625rem 0.75rem", borderBottom: `1px solid ${D.border}`, fontWeight: 500, color: D.text }}>{u.name || <span style={{ color: D.text3, fontStyle: "italic" }}>—</span>}</td>
                    <td style={{ padding: "0.625rem 0.75rem", borderBottom: `1px solid ${D.border}`, color: D.text2, fontFamily: "monospace", fontSize: "0.75rem" }}>{u.email || "—"}</td>
                    <td style={{ padding: "0.625rem 0.75rem", borderBottom: `1px solid ${D.border}` }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 500, color: u.role === "admin" ? D.emerald : D.text2 }}>{u.role}</span>
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", borderBottom: `1px solid ${D.border}`, color: D.text2, fontSize: "0.75rem" }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: "0.625rem 0.75rem", borderBottom: `1px solid ${D.border}`, color: D.text2, fontSize: "0.75rem" }}>{new Date(u.lastSignedIn).toLocaleDateString()}</td>
                    <td style={{ padding: "0.625rem 0.75rem", borderBottom: `1px solid ${D.border}` }}>
                      {u.id !== user?.id && (
                        <button
                          disabled={togglingRoleId === u.id}
                          onClick={() => { setTogglingRoleId(u.id); setUserRole.mutate({ userId: u.id, role: u.role === "admin" ? "user" : "admin" }); }}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: "0.25rem",
                            padding: "0.25rem 0.5rem", borderRadius: "0.25rem",
                            fontSize: "0.75rem", fontWeight: 500, cursor: "pointer",
                            border: `1px solid ${u.role === "admin" ? "rgba(239,68,68,0.30)" : "rgba(0,255,135,0.25)"}`,
                            background: "transparent",
                            color: u.role === "admin" ? D.red : D.emerald,
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.875rem 1.25rem", borderBottom: `1px solid ${D.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Database size={14} style={{ color: D.emerald }} />
              <SectionTitle>Database Health</SectionTitle>
              <span style={{ fontSize: "0.75rem", fontWeight: 500, color: dbHealth.connected ? D.emerald : D.red, marginLeft: "0.25rem" }}>
                {dbHealth.connected ? "● Connected" : "● Disconnected"}
              </span>
            </div>
            <button
              onClick={() => refetchDbHealth()}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.375rem",
                padding: "0.3rem 0.65rem", borderRadius: "0.25rem",
                fontSize: "0.75rem", fontWeight: 500, cursor: "pointer",
                border: `1px solid ${D.border}`, background: "transparent", color: D.text2,
              }}
            >
              <RefreshCw size={12} />
              Refresh
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "0.5rem", padding: "1rem 1.25rem" }}>
            {Object.entries(dbHealth.tables).map(([table, count]) => (
              <div key={table} style={{ padding: "0.625rem", borderRadius: "0.25rem", background: D.s2, textAlign: "center" }}>
                <div style={{ fontSize: "1.125rem", fontWeight: 700, color: D.text, fontFamily: "var(--font-mono)" }}>{count as number}</div>
                <div style={{ fontSize: "0.625rem", color: D.text2, marginTop: "0.125rem" }}>{table.replace(/_/g, " ")}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: "0.6875rem", color: D.text3, padding: "0 1.25rem 0.875rem" }}>
            Last checked: {new Date(dbHealth.checkedAt).toLocaleTimeString()} · Auto-refreshes every 30s
          </p>
        </Card>
      )}
    </div>
  );
}
