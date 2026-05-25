import React from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Calendar, Clock, Building2, User, ArrowLeft } from "lucide-react";

function formatDateTime(d: Date) {
  return new Date(d).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

const TYPE_LABELS: Record<string, string> = {
  meeting: "Meeting",
  demo: "Demo",
  call: "Call",
  event: "Event",
  follow_up: "Follow-up",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "#60a5fa",
  confirmed: "#00E87A",
  cancelled: "#ef4444",
  completed: "#64748b",
};

export default function CalendarEventPage() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";

  const { data, isLoading, error } = trpc.calendar.getByToken.useQuery(
    { token },
    { enabled: !!token }
  );

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)" }}>
        <div style={{ color: "#475569", fontSize: "0.75rem" }}>Loading event…</div>
      </div>
    );
  }

  if (error || !data?.event) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", flexDirection: "column", gap: "1rem" }}>
        <Calendar size={40} color="#1e293b" />
        <div style={{ color: "#475569", fontSize: "0.75rem" }}>Event not found or no longer available.</div>
        <Link href="/" style={{ color: "#00E87A", fontSize: "0.625rem", letterSpacing: "0.08em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <ArrowLeft size={12} /> Back to StageGate
        </Link>
      </div>
    );
  }

  const ev = data.event;
  const statusColor = STATUS_COLORS[ev.status] ?? "#64748b";

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
      <div style={{ width: "100%", maxWidth: "520px" }}>
        {/* Logo / back link */}
        <div style={{ marginBottom: "2rem" }}>
          <Link href="/" style={{ color: "#475569", fontSize: "0.5625rem", letterSpacing: "0.1em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "0.375rem", textDecoration: "none" }}>
            <ArrowLeft size={11} /> StageGate
          </Link>
        </div>

        {/* Card */}
        <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "1rem", overflow: "hidden" }}>
          {/* Header stripe */}
          <div style={{ background: "linear-gradient(135deg, rgba(0,232,122,0.08), rgba(96,165,250,0.05))", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ background: `${statusColor}22`, color: statusColor, fontSize: "0.5rem", fontWeight: 700, padding: "3px 8px", borderRadius: "4px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {ev.status}
              </span>
              <span style={{ background: "rgba(255,255,255,0.06)", color: "#94a3b8", fontSize: "0.5rem", fontWeight: 700, padding: "3px 8px", borderRadius: "4px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {TYPE_LABELS[ev.type] ?? ev.type}
              </span>
            </div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#e2e8f0", margin: 0, lineHeight: 1.3 }}>
              {ev.title}
            </h1>
          </div>

          {/* Details */}
          <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Date/time */}
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
              <Calendar size={16} color="#00E87A" style={{ marginTop: "2px", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569", marginBottom: "0.25rem" }}>Date & Time</div>
                <div style={{ fontSize: "0.8125rem", color: "#e2e8f0" }}>{formatDateTime(ev.startAt)}</div>
                <div style={{ fontSize: "0.6875rem", color: "#64748b", marginTop: "0.125rem" }}>
                  until {new Date(ev.endAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Los_Angeles" })} PT
                </div>
              </div>
            </div>

            {/* Company */}
            {ev.companyName && (
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <Building2 size={16} color="#60a5fa" style={{ marginTop: "2px", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569", marginBottom: "0.25rem" }}>Company</div>
                  <div style={{ fontSize: "0.8125rem", color: "#e2e8f0" }}>{ev.companyName}</div>
                </div>
              </div>
            )}

            {/* Contact */}
            {ev.prospectName && (
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <User size={16} color="#818cf8" style={{ marginTop: "2px", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569", marginBottom: "0.25rem" }}>Contact</div>
                  <div style={{ fontSize: "0.8125rem", color: "#e2e8f0" }}>{ev.prospectName}</div>
                </div>
              </div>
            )}

            {/* Description */}
            {ev.description && (
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "0.5rem", padding: "1rem", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569", marginBottom: "0.5rem" }}>About This Meeting</div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", lineHeight: 1.6 }}>{ev.description}</div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: "0.5rem", color: "#334155", letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "center" }}>
              Powered by StageGate · onstage.bot
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
