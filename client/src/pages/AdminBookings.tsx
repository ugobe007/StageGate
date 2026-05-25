import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  ClipboardList, ChevronDown, ChevronUp, ExternalLink,
  Mail, Phone, Globe, Bot, Calendar, Package,
  CheckCircle, XCircle, Clock, Eye, FileText, AlertCircle,
  RefreshCw, StickyNote, Send,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingStatus = "new" | "reviewed" | "quoted" | "confirmed" | "cancelled" | "converted";

const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  new:       { label: "New",       color: "#60a5fa", bg: "rgba(96,165,250,0.10)",  icon: <AlertCircle size={12} /> },
  reviewed:  { label: "Reviewed",  color: "#f59e0b", bg: "rgba(245,158,11,0.10)",  icon: <Eye size={12} /> },
  quoted:    { label: "Quoted",    color: "#a78bfa", bg: "rgba(167,139,250,0.10)", icon: <FileText size={12} /> },
  confirmed: { label: "Confirmed", color: "#34d399", bg: "rgba(52,211,153,0.10)",  icon: <CheckCircle size={12} /> },
  cancelled: { label: "Cancelled", color: "#f87171", bg: "rgba(248,113,113,0.10)", icon: <XCircle size={12} /> },
  converted: { label: "Converted", color: "#f59e0b", bg: "rgba(245,158,11,0.10)",  icon: <Package size={12} /> },
};

const ALL_STATUSES: BookingStatus[] = ["new", "reviewed", "quoted", "confirmed", "cancelled"];

const SERVICE_LABELS: Record<string, string> = {
  receiving:       "Receiving & Intake",
  staging:         "Staging & Setup",
  delivery:        "Delivery to Booth",
  full_activation: "Full Activation",
  storage:         "Storage",
  return:          "Return Logistics",
  customs:         "Customs Support",
  insurance:       "Insurance",
};

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatRelative(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function BookingDetailPanel({
  booking,
  onStatusChange,
  onClose,
  onConverted,
}: {
  booking: {
    id: number;
    company: string;
    contactName: string;
    contactEmail: string;
    contactPhone?: string | null;
    website?: string | null;
    country?: string | null;
    robotName?: string | null;
    robotType?: string | null;
    robotCount?: number | null;
    robotDimensions?: string | null;
    robotWeight?: string | null;
    specialHandling?: string | null;
    showName?: string | null;
    showDate?: string | null;
    boothNumber?: string | null;
    services?: unknown;
    status: string;
    adminNotes?: string | null;
    createdAt?: Date | string | null;
    updatedAt?: Date | string | null;
  };
  onStatusChange: (id: number, status: BookingStatus, notes?: string) => void;
  onClose: () => void;
  onConverted?: (orderId: number) => void;
}) {
  const [notes, setNotes] = useState(booking.adminNotes ?? "");
  const [savingStatus, setSavingStatus] = useState<BookingStatus | null>(null);
  const [, navigate] = useLocation();
  const cfg = STATUS_CONFIG[booking.status as BookingStatus] ?? STATUS_CONFIG.new;
  const services = (booking.services as string[] | null) ?? [];

  const [quoteLoading, setQuoteLoading] = useState(false);

  const generateQuote = trpc.bookings.generateQuoteHtml.useQuery(
    { id: booking.id },
    { enabled: false }
  );

  const handleGenerateQuote = async () => {
    setQuoteLoading(true);
    try {
      const result = await generateQuote.refetch();
      if (result.data?.html) {
        const blob = new Blob([result.data.html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to generate quote");
    } finally {
      setQuoteLoading(false);
    }
  };

  const sendQuote = trpc.bookings.sendQuoteEmail.useMutation({
    onSuccess: (data) => {
      toast.success(`Quote ${data.quoteNumber} sent to ${data.sentTo}`, { duration: 5000 });
      onConverted?.(-1); // trigger parent refresh without navigating
    },
    onError: (e) => toast.error(e.message ?? "Failed to send quote"),
  });

  const convertToOrder = trpc.bookings.convertToOrder.useMutation({
    onSuccess: (data) => {
      toast.success(
        <span>
          Booking converted to{" "}
          <button
            onClick={() => navigate(`/admin/orders/${data.orderId}`)}
            style={{ color: "#f59e0b", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit" }}
          >
            Order #{data.orderId} →
          </button>
        </span>,
        { duration: 6000 }
      );
      onConverted?.(data.orderId);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleStatusChange = async (status: BookingStatus) => {
    setSavingStatus(status);
    await onStatusChange(booking.id, status, notes || undefined);
    setSavingStatus(null);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
      background: "rgba(0,0,0,0.60)",
    }} onClick={onClose}>
      <div
        style={{
          width: "min(520px, 100vw)", height: "100vh", background: 'transparent',
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          overflowY: "auto", display: "flex", flexDirection: "column",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <span style={{ fontWeight: 700, fontSize: "1.125rem", color: "#ececec" }}>{booking.company}</span>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "0.3rem",
                padding: "0.15rem 0.45rem", borderRadius: "0.25rem",
                background: cfg.bg, color: cfg.color,
                fontFamily: "var(--font-mono)", fontSize: "0.45rem", letterSpacing: "0.08em", textTransform: "uppercase",
              }}>
                {cfg.icon} {cfg.label}
              </span>
            </div>
            <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "0.5rem", color: "rgba(255,255,255,0.42)", letterSpacing: "0.06em" }}>
              Booking #{booking.id} · Submitted {formatRelative(booking.createdAt)}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.46)", padding: "0.25rem", lineHeight: 1, fontSize: "1.25rem" }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Contact */}
          <section style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.42)", margin: "0 0 0.75rem" }}>Contact</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#ececec" }}>{booking.contactName}</span>
                {booking.country && <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.45rem", color: "rgba(255,255,255,0.42)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{booking.country}</span>}
              </div>
              <a href={`mailto:${booking.contactEmail}`} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8125rem", color: "rgba(255,255,255,0.65)", textDecoration: "none" }}>
                <Mail size={12} /> {booking.contactEmail}
              </a>
              {booking.contactPhone && (
                <a href={`tel:${booking.contactPhone}`} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8125rem", color: "rgba(255,255,255,0.65)", textDecoration: "none" }}>
                  <Phone size={12} /> {booking.contactPhone}
                </a>
              )}
              {booking.website && (
                <a href={booking.website} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8125rem", color: "rgba(255,255,255,0.65)", textDecoration: "none" }}>
                  <Globe size={12} /> {booking.website}
                </a>
              )}
            </div>
          </section>

          {/* Robot */}
          <section style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.42)", margin: "0 0 0.75rem" }}>Robot Details</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {[
                { label: "Name", value: booking.robotName, icon: <Bot size={11} /> },
                { label: "Type", value: booking.robotType, icon: <Bot size={11} /> },
                { label: "Count", value: booking.robotCount ? `${booking.robotCount} unit${booking.robotCount > 1 ? "s" : ""}` : null, icon: <Package size={11} /> },
                { label: "Dimensions", value: booking.robotDimensions, icon: <Package size={11} /> },
                { label: "Weight", value: booking.robotWeight, icon: <Package size={11} /> },
              ].map(({ label, value, icon }) => value ? (
                <div key={label}>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.45rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.36)", margin: "0 0 0.2rem" }}>{label}</p>
                  <p style={{ display: "flex", alignItems: "center", gap: "0.3rem", margin: 0, fontSize: "0.8125rem", color: "rgba(255,255,255,0.82)" }}>{icon} {value}</p>
                </div>
              ) : null)}
            </div>
            {booking.specialHandling && (
              <div style={{ marginTop: "0.75rem", padding: "0.5rem 0.75rem", borderRadius: "0.375rem", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.20)" }}>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.45rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(245,158,11,0.60)", margin: "0 0 0.2rem" }}>Special Handling</p>
                <p style={{ margin: 0, fontSize: "0.8125rem", color: "rgba(255,255,255,0.75)" }}>{booking.specialHandling}</p>
              </div>
            )}
          </section>

          {/* Show */}
          <section style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.42)", margin: "0 0 0.75rem" }}>Show Info</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {[
                { label: "Show", value: booking.showName, icon: <Calendar size={11} /> },
                { label: "Date", value: booking.showDate, icon: <Clock size={11} /> },
                { label: "Booth", value: booking.boothNumber, icon: <ExternalLink size={11} /> },
              ].map(({ label, value, icon }) => value ? (
                <div key={label}>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.45rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.36)", margin: "0 0 0.2rem" }}>{label}</p>
                  <p style={{ display: "flex", alignItems: "center", gap: "0.3rem", margin: 0, fontSize: "0.8125rem", color: "rgba(255,255,255,0.82)" }}>{icon} {value}</p>
                </div>
              ) : null)}
            </div>
          </section>

          {/* Services */}
          {services.length > 0 && (
            <section style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.42)", margin: "0 0 0.75rem" }}>Requested Services</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {services.map(s => (
                  <span key={s} style={{
                    fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.06em", textTransform: "uppercase",
                    padding: "0.2rem 0.5rem", borderRadius: "0.25rem",
                    border: '1px solid rgba(255,255,255,0.08)', color: "rgba(255,255,255,0.65)",
                  }}>
                    {SERVICE_LABELS[s] ?? s}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Admin Notes */}
          <section style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.42)", margin: "0 0 0.5rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <StickyNote size={10} /> Admin Notes
            </p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              style={{
                width: "100%", background: '#1C1E22', border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: "0.375rem", padding: "0.5rem 0.75rem",
                color: "rgba(255,255,255,0.82)", fontSize: "0.8125rem",
                resize: "vertical", outline: "none",
                fontFamily: "inherit",
              }}
              placeholder="Add internal notes, pricing, follow-up actions…"
            />
          </section>
        </div>

        {/* v23/v24: Generate Quote + Send Quote buttons */}
        <div style={{ padding: "0.75rem 1.5rem", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: "0.5rem" }}>
          {/* Generate Quote — opens printable HTML in new tab */}
          <button
            onClick={handleGenerateQuote}
            disabled={quoteLoading}
            title="Open printable quote in new tab"
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
              padding: "0.5rem 0.75rem", borderRadius: "0.375rem",
              background: "rgba(167,139,250,0.10)", border: "1px solid rgba(167,139,250,0.40)",
              color: "#a78bfa", fontSize: "0.8125rem", fontWeight: 600,
              cursor: quoteLoading ? "not-allowed" : "pointer",
              opacity: quoteLoading ? 0.7 : 1,
            }}
          >
            {quoteLoading ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Generating…</> : <><FileText size={13} /> Preview</>}
          </button>

          {/* Send Quote — emails HTML quote to prospect via Resend */}
          <button
            onClick={() => sendQuote.mutate({ id: booking.id })}
            disabled={sendQuote.isPending}
            title={`Email quote to ${booking.contactEmail}`}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
              padding: "0.5rem 0.75rem", borderRadius: "0.375rem",
              background: booking.status === "quoted"
                ? "rgba(16,185,129,0.10)" : "rgba(16,185,129,0.15)",
              border: `1px solid ${booking.status === "quoted" ? "rgba(16,185,129,0.30)" : "rgba(16,185,129,0.50)"}`,
              color: "#10b981", fontSize: "0.8125rem", fontWeight: 600,
              cursor: sendQuote.isPending ? "not-allowed" : "pointer",
              opacity: sendQuote.isPending ? 0.7 : 1,
            }}
          >
            {sendQuote.isPending
              ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Sending…</>
              : booking.status === "quoted"
                ? <><Send size={13} /> Resend Quote</>
                : <><Send size={13} /> Send Quote</>}
          </button>
        </div>

        {/* Convert to Order — only show if not already converted */}
        {booking.status !== "converted" && (
          <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <button
              onClick={() => convertToOrder.mutate({ id: booking.id })}
              disabled={convertToOrder.isPending}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                padding: "0.6rem 1rem", borderRadius: "0.375rem",
                background: convertToOrder.isPending ? "rgba(245,158,11,0.10)" : "rgba(245,158,11,0.15)",
                border: "1px solid rgba(245,158,11,0.40)",
                color: "#f59e0b", fontSize: "0.8125rem", fontWeight: 600,
                cursor: convertToOrder.isPending ? "not-allowed" : "pointer",
                opacity: convertToOrder.isPending ? 0.7 : 1,
                transition: "opacity 0.15s, background 0.15s",
              }}
            >
              {convertToOrder.isPending
                ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Converting…</>
                : <><Package size={13} /> Convert to Service Order</>}
            </button>
          </div>
        )}

        {/* Status Actions */}
        <div style={{ padding: "1.25rem 1.5rem", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.42)", margin: "0 0 0.5rem" }}>Update Status</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
            {ALL_STATUSES.filter(s => s !== (booking.status as BookingStatus) && s !== "converted").map(status => {
              const c = STATUS_CONFIG[status];
              const isLoading = savingStatus === status;
              return (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  disabled={isLoading}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                    padding: "0.5rem 0.75rem", borderRadius: "0.375rem",
                    background: c.bg, border: `1px solid ${c.color}40`,
                    color: c.color, fontSize: "0.75rem", fontWeight: 600,
                    cursor: isLoading ? "not-allowed" : "pointer",
                    opacity: isLoading ? 0.6 : 1,
                    transition: "opacity 0.15s",
                  }}
                >
                  {isLoading ? <RefreshCw size={11} style={{ animation: "spin 1s linear infinite" }} /> : c.icon}
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminBookings() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: bookings = [], isLoading: bookingsLoading, refetch } = trpc.bookings.list.useQuery(
    { status: statusFilter || undefined },
    { enabled: !!user && user.role === "admin" }
  );

  const updateStatus = trpc.bookings.updateStatus.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Status updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleStatusChange = async (id: number, status: BookingStatus, adminNotes?: string) => {
    await updateStatus.mutateAsync({ id, status: status as "new" | "reviewed" | "quoted" | "confirmed" | "cancelled", adminNotes });
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: "auto", background: "#1C1E22", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 24, height: 24, border: "2px solid rgba(255,255,255,0.10)", borderTopColor: "#00E87A", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    navigate("/");
    return null;
  }

  // Summary counts
  const counts: { [key: string]: number } = {};
  for (const b of bookings) {
    const s = b.status as string;
    counts[s] = (counts[s] ?? 0) + 1;
  }

  const selectedBooking = selectedId != null ? bookings.find(b => b.id === selectedId) ?? null : null;

  return (
    <div style={{ minHeight: "auto", background: "#1C1E22", color: "#ececec" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Page header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "1.5rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <ClipboardList size={18} style={{ color: "rgba(255,255,255,0.55)" }} />
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.46)", margin: "0 0 0.15rem" }}>Admin / Bookings</p>
            <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#ececec", margin: 0 }}>Intake Requests</h1>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: "rgba(255,255,255,0.48)" }}>
            {bookings.length} request{bookings.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => refetch()}
            style={{ background: "none", border: '1px solid rgba(255,255,255,0.08)', borderRadius: "0.375rem", padding: "0.35rem 0.6rem", color: "rgba(255,255,255,0.55)", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem" }}
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {(["new", "reviewed", "quoted", "confirmed", "cancelled", "converted"] as BookingStatus[]).map(s => {
          const cfg = STATUS_CONFIG[s];
          const n = counts[s] ?? 0;
          return (
            <div
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
              style={{
                padding: "1rem 1.5rem", cursor: "pointer",
                borderRight: "1px solid rgba(255,255,255,0.06)",
                background: statusFilter === s ? cfg.bg : "transparent",
                transition: "background 0.15s",
              }}
            >
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: statusFilter === s ? cfg.color : "rgba(255,255,255,0.42)", margin: "0 0 0.3rem" }}>{cfg.label}</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 700, color: statusFilter === s ? cfg.color : "#fff", margin: 0 }}>{n}</p>
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ padding: "1.5rem 2rem" }}>
        {bookingsLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0" }}>
            <div style={{ width: 24, height: 24, border: "2px solid rgba(255,255,255,0.10)", borderTopColor: "#00E87A", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : bookings.length === 0 ? (
          <div style={{ textAlign: "center", padding: "5rem 0" }}>
            <ClipboardList size={32} style={{ color: "rgba(255,255,255,0.24)", marginBottom: "1rem" }} />
            <p style={{ fontSize: "1.125rem", fontWeight: 700, color: "#ececec", margin: "0 0 0.5rem" }}>
              {statusFilter ? `No ${STATUS_CONFIG[statusFilter as BookingStatus]?.label ?? statusFilter} requests` : "No intake requests yet"}
            </p>
            <p style={{ fontSize: "0.9375rem", color: "rgba(255,255,255,0.62)", maxWidth: "28rem", margin: "0 auto", lineHeight: 1.6 }}>
              Intake requests are created when prospects submit the Get Started form. Use this board to review requests, send quotes, and convert confirmed work into service orders.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* Table header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr auto",
              gap: "1rem",
              padding: "0.5rem 0",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              marginBottom: "0.25rem",
            }}>
              {["Company / Contact", "Robot", "Show", "Services", "Status", ""].map(h => (
                <span key={h} style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.42)" }}>{h}</span>
              ))}
            </div>

            {bookings.map(b => {
              const cfg = STATUS_CONFIG[b.status as BookingStatus] ?? STATUS_CONFIG.new;
              const services = (b.services as string[] | null) ?? [];
              return (
                <div
                  key={b.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr auto",
                    gap: "1rem",
                    alignItems: "center",
                    padding: "0.875rem 0",
                    borderBottom: "1px solid #1a1a1a",
                    cursor: "pointer",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  onClick={() => setSelectedId(b.id === selectedId ? null : b.id)}
                >
                  {/* Company */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#ececec" }}>{b.company}</span>
                      {b.country && <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.45rem", color: "rgba(255,255,255,0.42)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{b.country}</span>}
                    </div>
                    <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: "rgba(255,255,255,0.55)" }}>
                      {b.contactName} · {b.contactEmail}
                    </p>
                    <p style={{ margin: "0.1rem 0 0", fontFamily: "var(--font-mono)", fontSize: "0.5rem", color: "rgba(255,255,255,0.36)", letterSpacing: "0.06em" }}>
                      {formatRelative(b.createdAt)}
                    </p>
                  </div>

                  {/* Robot */}
                  <div>
                    {b.robotName ? (
                      <>
                        <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600, color: '#ececec' }}>{b.robotName}</p>
                        {b.robotType && <p style={{ margin: "0.1rem 0 0", fontSize: "0.75rem", color: "rgba(255,255,255,0.48)" }}>{b.robotType}</p>}
                        {b.robotCount && b.robotCount > 1 && <p style={{ margin: "0.1rem 0 0", fontSize: "0.75rem", color: "rgba(255,255,255,0.48)" }}>{b.robotCount} units</p>}
                      </>
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.28)" }}>—</span>
                    )}
                  </div>

                  {/* Show */}
                  <div>
                    {b.showName ? (
                      <>
                        <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600, color: '#ececec' }}>{b.showName}</p>
                        {b.showDate && <p style={{ margin: "0.1rem 0 0", fontSize: "0.75rem", color: "rgba(255,255,255,0.48)" }}>{b.showDate}</p>}
                      </>
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.28)" }}>—</span>
                    )}
                  </div>

                  {/* Services */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                    {services.slice(0, 2).map(s => (
                      <span key={s} style={{
                        fontFamily: "var(--font-mono)", fontSize: "0.45rem", letterSpacing: "0.06em", textTransform: "uppercase",
                        padding: "0.1rem 0.35rem", borderRadius: "0.2rem",
                        border: '1px solid rgba(255,255,255,0.08)', color: "rgba(255,255,255,0.55)",
                      }}>
                        {SERVICE_LABELS[s] ?? s}
                      </span>
                    ))}
                    {services.length > 2 && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.45rem", color: "rgba(255,255,255,0.42)" }}>+{services.length - 2}</span>
                    )}
                    {services.length === 0 && <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.28)" }}>—</span>}
                  </div>

                  {/* Status */}
                  <div>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: "0.3rem",
                      padding: "0.2rem 0.5rem", borderRadius: "0.25rem",
                      background: cfg.bg, color: cfg.color,
                      fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.08em", textTransform: "uppercase",
                    }}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>

                  {/* Expand */}
                  <div style={{ color: "rgba(255,255,255,0.36)" }}>
                    {selectedId === b.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail panel overlay */}
      {selectedBooking && (
        <BookingDetailPanel
          booking={selectedBooking}
          onStatusChange={handleStatusChange}
          onClose={() => setSelectedId(null)}
          onConverted={() => { refetch(); setSelectedId(null); }}
        />
      )}
    </div>
  );
}
