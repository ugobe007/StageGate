import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import {
  LayoutDashboard, LogOut, Bot, ClipboardList, Star, Package,
  FileText, Calendar, Telescope, Send, Kanban, Zap, Truck,
  Inbox, Users, Menu, X, ChevronLeft, ChevronRight, Mail,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import StageGateLogo from "./StageGateLogo";
import { BRAND, emeraldAlpha } from "@/lib/brand";

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
  { icon: Calendar,        label: "Calendar",          path: "/admin/calendar" },
  { icon: Calendar,        label: "Shows",            path: "/admin/shows" },
  { icon: Package,         label: "Orders",           path: "/admin/orders" },
  { icon: ClipboardList,   label: "Demo Requests",    path: "/admin/demos" },
  { icon: FileText,        label: "Quotes",           path: "/admin/quotes" },
  { icon: Users,           label: "Partners",         path: "/admin/partners" },
  { icon: Mail,            label: "Partner Email",    path: "/admin/partner-outreach" },
  { icon: Zap,             label: "Cal",              path: "/admin/sales-agent" },
  { icon: Truck,           label: "Vendors",          path: "/admin/vendors" },
  { icon: Calendar,        label: "Scheduling",       path: "/admin/scheduling" },
  { icon: Truck,           label: "Logistics",        path: "/admin/logistics" },
];

const SIDEBAR_WIDTH_KEY = "sg-sidebar-width";
const DEFAULT_WIDTH = 220;
const MIN_WIDTH = 180;
const MAX_WIDTH = 320;
const COLLAPSED_WIDTH = 52;

// ─── Dark palette tokens ──────────────────────────────────────────────────────
const D = {
  bg:         BRAND.nearBlack,
  surface:    "#111111",   // card surface
  surface2:   "#1a1a1a",   // hover / raised
  border:     "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  text:       "#ececec",   // primary text
  text2:      "rgba(255,255,255,0.55)", // secondary
  text3:      "rgba(255,255,255,0.30)", // muted
  emerald:    BRAND.emerald,
  emeraldDim: emeraldAlpha(0.10),
  amber:      "#f59e0b",
  font:       "'Space Grotesk', 'Inter', ui-sans-serif, system-ui, sans-serif",
};

// ─── Main export ──────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: D.bg, fontFamily: D.font }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem", padding: "2rem", maxWidth: "20rem", width: "100%", textAlign: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center", background: D.emeraldDim, border: `1px solid ${emeraldAlpha(0.20)}` }}>
            <StageGateLogo size={24} variant="icon" theme="dark" />
          </div>
          <div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: D.text, marginBottom: "0.25rem" }}>Admin access required</h2>
            <p style={{ fontSize: "0.875rem", color: D.text2 }}>Sign in with your admin account to continue.</p>
          </div>
          <button
            onClick={() => { window.location.href = getLoginUrl(); }}
            style={{
              width: "100%", padding: "0.5rem 1rem", borderRadius: "0.25rem",
              background: D.emerald, border: "none",
              color: BRAND.nearBlack, fontWeight: 700, fontSize: "0.875rem", cursor: "pointer",
              letterSpacing: "0.04em",
            }}
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: D.bg, fontFamily: D.font }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", padding: "2rem", maxWidth: "22rem", width: "100%", textAlign: "center" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: D.text }}>Admin access required</h2>
          <p style={{ fontSize: "0.875rem", color: D.text2 }}>Your account is signed in, but it is not an administrator account.</p>
          <button
            onClick={() => { window.location.href = "/"; }}
            style={{
              width: "100%", padding: "0.5rem 1rem", borderRadius: "0.25rem",
              background: D.surface2, border: `1px solid ${D.border}`,
              color: D.text, fontWeight: 700, fontSize: "0.875rem", cursor: "pointer",
            }}
          >
            Return Home
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
    return localStorage.getItem("sg-sidebar-collapsed") === "true";
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
  const { data: serviceRequestNewCount } = trpc.admin.getNewServiceRequestCount.useQuery(undefined, {
    enabled: user?.role === "admin",
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const { data: calendarUpcomingCount } = trpc.calendar.upcomingCount.useQuery(undefined, {
    enabled: user?.role === "admin",
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  useEffect(() => {
    localStorage.setItem("sg-sidebar-collapsed", String(collapsed));
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

  const sidebarContent = (
    <div
      ref={sidebarRef}
      style={{
        width: isMobile ? 220 : effectiveWidth,
        minWidth: isMobile ? 220 : effectiveWidth,
        transition: isResizing ? "none" : "width 0.15s",
        background: D.surface,
        borderRight: `1px solid ${D.border}`,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        fontFamily: D.font,
        position: "relative",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 0.75rem", height: "48px", borderBottom: `1px solid ${D.border}`,
        flexShrink: 0,
      }}>
        {!collapsed ? (
          <StageGateLogo size={88} variant="lockup" theme="dark" style={{ flexShrink: 0 }} />
        ) : (
          <StageGateLogo size={28} variant="icon" theme="dark" style={{ margin: "0 auto" }} />
        )}
        <button
          onClick={() => { if (isMobile) setMobileOpen(false); else setCollapsed(c => !c); }}
          style={{
            padding: "0.25rem", borderRadius: "0.25rem", border: "none",
            background: "transparent", color: D.text3, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginLeft: "auto",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = D.text)}
          onMouseLeave={e => (e.currentTarget.style.color = D.text3)}
        >
          {isMobile ? <X size={15} /> : collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "0.5rem", display: "flex", flexDirection: "column", gap: "1px" }}>
        {menuItems.map(item => {
          const isActive = location === item.path;
          const Icon = item.icon;
          const pendingDrafts = item.path === "/admin/outreach" ? (draftCount?.pending ?? 0) : 0;
          const pendingBookings = item.path === "/admin/bookings" ? (bookingNewCount?.count ?? 0) : 0;
          const pendingServiceRequests = item.path === "/admin/service-requests" ? (serviceRequestNewCount?.count ?? 0) : 0;
          const upcomingCalendar = item.path === "/admin/calendar" ? (calendarUpcomingCount?.count ?? 0) : 0;
          const count = pendingDrafts + pendingBookings + pendingServiceRequests + upcomingCalendar;
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
                borderRadius: "0.25rem",
                fontSize: "0.8125rem",
                fontWeight: isActive ? 600 : 400,
                color: isActive ? D.emerald : D.text2,
                background: isActive ? D.emeraldDim : "transparent",
                border: isActive ? `1px solid rgba(0,232,122,0.15)` : "1px solid transparent",
                cursor: "pointer",
                width: "100%",
                textAlign: "left",
                transition: "background 0.1s, color 0.1s, border-color 0.1s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = D.surface2; e.currentTarget.style.color = D.text; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = D.text2; } }}
            >
              <Icon size={15} style={{ flexShrink: 0, color: isActive ? D.emerald : "currentColor" }} />
              {!collapsed && (
                <>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
                  {count > 0 && (
                    <span style={{ fontSize: "11px", fontWeight: 600, color: D.amber }}>
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
      <div style={{ borderTop: `1px solid ${D.border}`, padding: "0.5rem", flexShrink: 0 }}>
        <button
          onClick={() => logout.mutate()}
          title={collapsed ? "Sign out" : undefined}
          style={{
            display: "flex", alignItems: "center",
            gap: collapsed ? 0 : "0.5rem",
            padding: collapsed ? "0.375rem 0" : "0.375rem 0.625rem",
            justifyContent: collapsed ? "center" : "flex-start",
            borderRadius: "0.25rem",
            fontSize: "0.8125rem",
            fontWeight: 400,
            color: D.text3,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            width: "100%",
            textAlign: "left",
            transition: "color 0.1s, background 0.1s",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = D.text3; e.currentTarget.style.background = "transparent"; }}
        >
          <LogOut size={14} style={{ flexShrink: 0 }} />
          {!collapsed && <span style={{ flex: 1 }}>Sign out</span>}
        </button>
        {!collapsed && (
          <div style={{ padding: "0.5rem 0.625rem 0.25rem" }}>
            <div style={{ fontSize: "11px", color: D.text3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name}</div>
            <div style={{ fontSize: "10px", color: D.text3, opacity: 0.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</div>
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
          onMouseEnter={e => (e.currentTarget.style.background = D.emerald)}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        />
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: D.bg, fontFamily: D.font }}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <div style={{ flexShrink: 0, display: "flex", width: effectiveWidth, transition: isResizing ? "none" : "width 0.15s" }}>
          {sidebarContent}
        </div>
      )}

      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} onClick={() => setMobileOpen(false)} />
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
            borderBottom: `1px solid ${D.border}`,
            background: D.surface, flexShrink: 0,
          }}>
            <button
              onClick={() => setMobileOpen(true)}
              style={{ padding: "0.25rem", borderRadius: "0.25rem", border: "none", background: "transparent", color: D.text2, cursor: "pointer" }}
            >
              <Menu size={16} />
            </button>
            <span style={{ fontWeight: 700, fontSize: "0.875rem", color: D.emerald, letterSpacing: "0.04em", textTransform: "uppercase" }}>StageGate</span>
          </div>
        )}
        <main style={{ flex: 1, overflowY: "auto", background: D.bg, color: D.text, fontFamily: D.font }}>
          {children}
        </main>
      </div>
    </div>
  );
}
