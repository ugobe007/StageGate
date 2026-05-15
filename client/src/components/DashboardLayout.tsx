import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import {
  LayoutDashboard, LogOut, Bot, ClipboardList, Star, Package,
  FileText, Calendar, Telescope, Send, Kanban, Zap, Truck,
  Inbox, Users, Menu, X, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

// ─── Nav items ────────────────────────────────────────────────────────────────

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard",       path: "/admin" },
  { icon: Telescope,       label: "Leads",            path: "/admin/leads" },
  { icon: Star,            label: "Prospects",        path: "/admin/prospects" },
  { icon: Bot,             label: "AI Agents",        path: "/admin/agents" },
  { icon: Kanban,          label: "Pipeline",         path: "/admin/pipeline" },
  { icon: Send,            label: "Outreach",         path: "/admin/outreach" },
  { icon: ClipboardList,   label: "Bookings",         path: "/admin/bookings" },
  { icon: Inbox,           label: "Service Requests", path: "/admin/service-requests" },
  { icon: Calendar,        label: "Shows",            path: "/admin/shows" },
  { icon: Package,         label: "Orders",           path: "/admin/orders" },
  { icon: ClipboardList,   label: "Demo Requests",    path: "/admin/demos" },
  { icon: FileText,        label: "Quotes",           path: "/admin/quotes" },
  { icon: Users,           label: "Partners",         path: "/admin/partners" },
  { icon: Zap,             label: "Sales Agent",      path: "/admin/sales-agent" },
  { icon: Truck,           label: "Vendors",          path: "/admin/vendors" },
  { icon: Calendar,        label: "Scheduling",       path: "/admin/scheduling" },
  { icon: Truck,           label: "Logistics",        path: "/admin/logistics" },
];

const SIDEBAR_WIDTH_KEY = "sb-sidebar-width";
const DEFAULT_WIDTH = 220;
const MIN_WIDTH = 180;
const MAX_WIDTH = 320;
const COLLAPSED_WIDTH = 52;

// ─── Main export ──────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ background: "#f8fafc", fontFamily: "'Inter', 'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}
      >
        <div className="flex flex-col items-center gap-6 p-8 max-w-sm w-full text-center">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(62,207,142,0.12)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#0f172a", marginBottom: "0.25rem" }}>Admin access required</h2>
            <p style={{ fontSize: "0.875rem", color: "#475569" }}>Sign in with your admin account to continue.</p>
          </div>
          <button
            onClick={() => { window.location.href = getLoginUrl(); }}
            style={{
              width: "100%", padding: "0.5rem 1rem", borderRadius: "0.375rem",
              background: "#3ecf8e", border: "1px solid #3ecf8e",
              color: "#0f172a", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer",
            }}
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return <SidebarShell>{children}</SidebarShell>;
}

// ─── Sidebar shell ────────────────────────────────────────────────────────────

function SidebarShell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("sb-sidebar-collapsed") === "true";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => { window.location.href = "/"; } });

  const { data: draftCount } = trpc.admin.getDraftCount.useQuery(undefined, {
    enabled: user?.role === "admin",
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const { data: bookingNewCount } = trpc.bookings.getNewCount.useQuery(undefined, {
    enabled: user?.role === "admin",
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  useEffect(() => {
    localStorage.setItem("sb-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const w = e.clientX - left;
      if (w >= MIN_WIDTH && w <= MAX_WIDTH) {
        setSidebarWidth(w);
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
      }
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const effectiveWidth = collapsed ? COLLAPSED_WIDTH : sidebarWidth;

  useEffect(() => { setMobileOpen(false); }, [location]);

  const sbStyle = {
    bg: "#f8fafc",
    surface: "#ffffff",
    surface2: "#f1f5f9",
    border: "#e2e8f0",
    text: "#0f172a",
    text2: "#475569",
    text3: "#94a3b8",
    green: "#3ecf8e",
    greenDim: "rgba(62,207,142,0.12)",
    amber: "#f59e0b",
    font: "'Inter', 'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
  };

  const sidebarContent = (
    <div
      ref={sidebarRef}
      style={{
        width: isMobile ? 220 : effectiveWidth,
        minWidth: isMobile ? 220 : effectiveWidth,
        transition: isResizing ? "none" : "width 0.15s",
        background: sbStyle.surface,
        borderRight: `1px solid ${sbStyle.border}`,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        fontFamily: sbStyle.font,
        position: "relative",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 0.75rem", height: "48px", borderBottom: `1px solid ${sbStyle.border}`,
        flexShrink: 0,
      }}>
        {!collapsed && (
          <span style={{ fontWeight: 600, fontSize: "0.875rem", color: sbStyle.text, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            StageGate
          </span>
        )}
        <button
          onClick={() => { if (isMobile) setMobileOpen(false); else setCollapsed(c => !c); }}
          style={{
            padding: "0.25rem", borderRadius: "0.25rem", border: "none",
            background: "transparent", color: sbStyle.text3, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginLeft: "auto",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = sbStyle.surface2)}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          {isMobile ? <X size={15} /> : collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "0.5rem 0.5rem", display: "flex", flexDirection: "column", gap: "1px" }}>
        {menuItems.map(item => {
          const isActive = location === item.path;
          const Icon = item.icon;
          const pendingDrafts = item.path === "/admin/outreach" ? (draftCount?.pending ?? 0) : 0;
          const pendingBookings = item.path === "/admin/bookings" ? (bookingNewCount?.count ?? 0) : 0;
          const count = pendingDrafts + pendingBookings;
          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              title={collapsed ? item.label : undefined}
              style={{
                display: "flex", alignItems: "center",
                gap: collapsed ? 0 : "0.5rem",
                padding: collapsed ? "0.375rem 0" : "0.375rem 0.625rem",
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: "0.375rem",
                fontSize: "0.8125rem",
                fontWeight: isActive ? 500 : 400,
                color: isActive ? sbStyle.text : sbStyle.text2,
                background: isActive ? sbStyle.greenDim : "transparent",
                border: "none",
                cursor: "pointer",
                width: "100%",
                textAlign: "left",
                transition: "background 0.1s, color 0.1s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = sbStyle.surface2; e.currentTarget.style.color = sbStyle.text; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = sbStyle.text2; } }}
            >
              <Icon size={15} style={{ flexShrink: 0, color: isActive ? sbStyle.green : "currentColor" }} />
              {!collapsed && (
                <>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
                  {count > 0 && (
                    <span style={{ fontSize: "11px", fontWeight: 500, color: sbStyle.amber, tabularNums: true } as React.CSSProperties}>
                      {count}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${sbStyle.border}`, padding: "0.5rem", flexShrink: 0 }}>
        <button
          onClick={() => logout.mutate()}
          title={collapsed ? "Sign out" : undefined}
          style={{
            display: "flex", alignItems: "center",
            gap: collapsed ? 0 : "0.5rem",
            padding: collapsed ? "0.375rem 0" : "0.375rem 0.625rem",
            justifyContent: collapsed ? "center" : "flex-start",
            borderRadius: "0.375rem",
            fontSize: "0.8125rem",
            fontWeight: 400,
            color: sbStyle.text3,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            width: "100%",
            textAlign: "left",
            transition: "color 0.1s, background 0.1s",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = sbStyle.surface2; }}
          onMouseLeave={e => { e.currentTarget.style.color = sbStyle.text3; e.currentTarget.style.background = "transparent"; }}
        >
          <LogOut size={14} style={{ flexShrink: 0 }} />
          {!collapsed && <span style={{ flex: 1 }}>Sign out</span>}
        </button>
        {!collapsed && (
          <div style={{ padding: "0.5rem 0.625rem 0.25rem" }}>
            <div style={{ fontSize: "11px", color: sbStyle.text3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name}</div>
            <div style={{ fontSize: "10px", color: sbStyle.text3, opacity: 0.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</div>
          </div>
        )}
      </div>

      {/* Resize handle */}
      {!collapsed && !isMobile && (
        <div
          onMouseDown={() => setIsResizing(true)}
          style={{
            position: "absolute", top: 0, right: 0, width: "4px", height: "100%",
            cursor: "col-resize", zIndex: 10,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = sbStyle.green)}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        />
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: sbStyle.bg, fontFamily: sbStyle.font }}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <div style={{ flexShrink: 0, display: "flex", width: effectiveWidth, transition: isResizing ? "none" : "width 0.15s" }}>
          {sidebarContent}
        </div>
      )}

      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} onClick={() => setMobileOpen(false)} />
          <div style={{ position: "relative", zIndex: 10, height: "100%" }}>{sidebarContent}</div>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        {/* Mobile top bar */}
        {isMobile && (
          <div style={{
            display: "flex", alignItems: "center", gap: "0.75rem",
            height: "48px", padding: "0 1rem",
            borderBottom: `1px solid ${sbStyle.border}`,
            background: sbStyle.surface, flexShrink: 0,
          }}>
            <button
              onClick={() => setMobileOpen(true)}
              style={{ padding: "0.25rem", borderRadius: "0.25rem", border: "none", background: "transparent", color: sbStyle.text2, cursor: "pointer" }}
            >
              <Menu size={16} />
            </button>
            <span style={{ fontWeight: 600, fontSize: "0.875rem", color: sbStyle.text }}>StageGate</span>
          </div>
        )}
        <main className="sb-admin" style={{ flex: 1, overflowY: "auto", background: "#f8fafc", color: "#0f172a", fontFamily: "'Inter', 'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
