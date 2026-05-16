import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  Calendar, Plus, Edit2, Trash2, Copy, ExternalLink,
  Clock, User, Building2, Phone, Video, Star, ChevronDown, ChevronUp, X, Check
} from "lucide-react";

type EventType = "meeting" | "demo" | "call" | "event" | "follow_up";
type EventStatus = "scheduled" | "confirmed" | "cancelled" | "completed";

interface CalendarEvent {
  id: number;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date;
  type: string;
  status: string;
  prospectId: number | null;
  prospectEmail: string | null;
  prospectName: string | null;
  companyName: string | null;
  notes: string | null;
  shareToken: string | null;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const TYPE_CONFIG: Record<EventType, { label: string; color: string; icon: React.ReactNode }> = {
  meeting: { label: "Meeting", color: "#818cf8", icon: <User size={11} /> },
  demo:    { label: "Demo",    color: "#f59e0b", icon: <Star size={11} /> },
  call:    { label: "Call",    color: "#00ff87", icon: <Phone size={11} /> },
  event:   { label: "Event",   color: "#60a5fa", icon: <Calendar size={11} /> },
  follow_up: { label: "Follow-up", color: "#a78bfa", icon: <Clock size={11} /> },
};

const STATUS_CONFIG: Record<EventStatus, { label: string; color: string }> = {
  scheduled:  { label: "Scheduled",  color: "#60a5fa" },
  confirmed:  { label: "Confirmed",  color: "#00ff87" },
  cancelled:  { label: "Cancelled",  color: "#ef4444" },
  completed:  { label: "Completed",  color: "#64748b" },
};

function formatDateTime(d: Date) {
  return new Date(d).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

function toLocalInputValue(d: Date | string) {
  const dt = new Date(d);
  const offset = dt.getTimezoneOffset() * 60000;
  return new Date(dt.getTime() - offset).toISOString().slice(0, 16);
}

const EMPTY_FORM = {
  title: "",
  description: "",
  startAt: "",
  endAt: "",
  type: "meeting" as EventType,
  status: "scheduled" as EventStatus,
  prospectEmail: "",
  prospectName: "",
  companyName: "",
  notes: "",
};

export default function AdminCalendar() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const { data, isLoading, refetch } = trpc.calendar.list.useQuery(
    { type: typeFilter || undefined },
    { enabled: !!user && user.role === "admin" }
  );

  const createMutation = trpc.calendar.create.useMutation({
    onSuccess: () => { toast.success("Event created"); utils.calendar.list.invalidate(); setShowModal(false); setSaving(false); },
    onError: (e) => { toast.error(e.message); setSaving(false); },
  });

  const updateMutation = trpc.calendar.update.useMutation({
    onSuccess: () => { toast.success("Event updated"); utils.calendar.list.invalidate(); setShowModal(false); setSaving(false); },
    onError: (e) => { toast.error(e.message); setSaving(false); },
  });

  const deleteMutation = trpc.calendar.delete.useMutation({
    onSuccess: () => { toast.success("Event deleted"); utils.calendar.list.invalidate(); setDeletingId(null); },
    onError: (e) => { toast.error(e.message); setDeletingId(null); },
  });

  const events: CalendarEvent[] = (data?.events ?? []) as CalendarEvent[];

  const filtered = useMemo(() => {
    return events.filter(e => {
      if (typeFilter && e.type !== typeFilter) return false;
      if (statusFilter && e.status !== statusFilter) return false;
      return true;
    });
  }, [events, typeFilter, statusFilter]);

  // Group by month
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of filtered) {
      const key = new Date(e.startAt).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "America/Los_Angeles" });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [filtered]);

  const upcomingCount = events.filter(e =>
    new Date(e.startAt) >= new Date() && e.status !== "cancelled" && e.status !== "completed"
  ).length;

  function openCreate() {
    setEditingEvent(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  }

  function openEdit(ev: CalendarEvent) {
    setEditingEvent(ev);
    setForm({
      title: ev.title,
      description: ev.description ?? "",
      startAt: toLocalInputValue(ev.startAt),
      endAt: toLocalInputValue(ev.endAt),
      type: ev.type as EventType,
      status: ev.status as EventStatus,
      prospectEmail: ev.prospectEmail ?? "",
      prospectName: ev.prospectName ?? "",
      companyName: ev.companyName ?? "",
      notes: ev.notes ?? "",
    });
    setShowModal(true);
  }

  function handleSave() {
    if (!form.title.trim() || !form.startAt || !form.endAt) {
      toast.error("Title, start time, and end time are required");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description || undefined,
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      type: form.type,
      status: form.status,
      prospectEmail: form.prospectEmail || undefined,
      prospectName: form.prospectName || undefined,
      companyName: form.companyName || undefined,
      notes: form.notes || undefined,
    };
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function copyShareLink(token: string) {
    const url = `${window.location.origin}/calendar/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token);
      toast.success("Share link copied!");
      setTimeout(() => setCopiedToken(null), 2000);
    });
  }

  if (!user) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0a0a" }}>
        <a href={getLoginUrl()} style={{ color: "#00ff87", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>Sign in to access admin</a>
      </div>
    );
  }
  if (user.role !== "admin") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0a0a" }}>
        <span style={{ color: "#ef4444", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>Admin access required</span>
      </div>
    );
  }

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "#e2e8f0", fontFamily: "var(--font-mono)" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Calendar size={18} color="#00ff87" />
          <span style={{ fontSize: "0.875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#e2e8f0" }}>Calendar</span>
          {upcomingCount > 0 && (
            <span style={{ background: "rgba(0,255,135,0.15)", color: "#00ff87", fontSize: "0.5625rem", fontWeight: 700, padding: "2px 7px", borderRadius: "999px", letterSpacing: "0.08em" }}>
              {upcomingCount} UPCOMING
            </span>
          )}
        </div>
        <button
          onClick={openCreate}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "#00ff87", color: "#0a0a0a", border: "none", borderRadius: "0.375rem", padding: "0.5rem 1rem", fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}
        >
          <Plus size={13} /> New Event
        </button>
      </div>

      {/* Filters */}
      <div style={{ padding: "0.875rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {["", "meeting", "demo", "call", "event", "follow_up"].map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            style={{ padding: "0.25rem 0.75rem", borderRadius: "999px", border: `1px solid ${typeFilter === t ? "#00ff87" : "rgba(255,255,255,0.12)"}`, background: typeFilter === t ? "rgba(0,255,135,0.1)" : "transparent", color: typeFilter === t ? "#00ff87" : "#94a3b8", fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}>
            {t === "" ? "All Types" : TYPE_CONFIG[t as EventType]?.label ?? t}
          </button>
        ))}
        <div style={{ width: "1px", background: "rgba(255,255,255,0.08)", margin: "0 0.25rem" }} />
        {["", "scheduled", "confirmed", "completed", "cancelled"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            style={{ padding: "0.25rem 0.75rem", borderRadius: "999px", border: `1px solid ${statusFilter === s ? STATUS_CONFIG[s as EventStatus]?.color ?? "#00ff87" : "rgba(255,255,255,0.12)"}`, background: statusFilter === s ? "rgba(255,255,255,0.05)" : "transparent", color: statusFilter === s ? (STATUS_CONFIG[s as EventStatus]?.color ?? "#00ff87") : "#94a3b8", fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}>
            {s === "" ? "All Status" : STATUS_CONFIG[s as EventStatus]?.label ?? s}
          </button>
        ))}
      </div>

      {/* Event List */}
      <div style={{ padding: "1.5rem" }}>
        {isLoading ? (
          <div style={{ color: "#64748b", fontSize: "0.75rem", textAlign: "center", padding: "3rem" }}>Loading events…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
            <Calendar size={32} color="#1e293b" style={{ margin: "0 auto 1rem" }} />
            <div style={{ color: "#475569", fontSize: "0.75rem", marginBottom: "1rem" }}>No events yet</div>
            <button onClick={openCreate} style={{ background: "rgba(0,255,135,0.1)", color: "#00ff87", border: "1px solid rgba(0,255,135,0.3)", borderRadius: "0.375rem", padding: "0.5rem 1.25rem", fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}>
              + Create First Event
            </button>
          </div>
        ) : (
          Array.from(grouped.entries()).map(([month, monthEvents]) => (
            <div key={month} style={{ marginBottom: "2rem" }}>
              <div style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#475569", marginBottom: "0.75rem", paddingBottom: "0.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {month}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {monthEvents.map(ev => {
                  const typeCfg = TYPE_CONFIG[ev.type as EventType] ?? TYPE_CONFIG.meeting;
                  const statusCfg = STATUS_CONFIG[ev.status as EventStatus] ?? STATUS_CONFIG.scheduled;
                  const isExpanded = expandedId === ev.id;
                  const isPast = new Date(ev.endAt) < new Date();

                  return (
                    <div key={ev.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.5rem", background: isPast ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.02)", overflow: "hidden", opacity: ev.status === "cancelled" ? 0.5 : 1 }}>
                      {/* Row */}
                      <div
                        onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                        style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "1rem", alignItems: "center", padding: "0.875rem 1rem", cursor: "pointer" }}
                      >
                        {/* Left: title + meta */}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                            <span style={{ background: `${typeCfg.color}22`, color: typeCfg.color, fontSize: "0.5rem", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", letterSpacing: "0.08em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "3px" }}>
                              {typeCfg.icon} {typeCfg.label}
                            </span>
                            <span style={{ background: `${statusCfg.color}22`, color: statusCfg.color, fontSize: "0.5rem", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                              {statusCfg.label}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {ev.title}
                          </div>
                          {ev.companyName && (
                            <div style={{ fontSize: "0.625rem", color: "#64748b", marginTop: "0.125rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                              <Building2 size={10} /> {ev.companyName}
                            </div>
                          )}
                        </div>

                        {/* Date/time */}
                        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ fontSize: "0.625rem", color: "#94a3b8" }}>{formatDate(ev.startAt)}</div>
                          <div style={{ fontSize: "0.5625rem", color: "#64748b" }}>
                            {new Date(ev.startAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Los_Angeles" })}
                            {" – "}
                            {new Date(ev.endAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Los_Angeles" })} PT
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", gap: "0.375rem" }} onClick={e => e.stopPropagation()}>
                          {ev.shareToken && (
                            <button onClick={() => copyShareLink(ev.shareToken!)}
                              title="Copy share link"
                              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.25rem", padding: "0.25rem 0.375rem", cursor: "pointer", color: copiedToken === ev.shareToken ? "#00ff87" : "#64748b", display: "flex", alignItems: "center" }}>
                              {copiedToken === ev.shareToken ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                          )}
                          <button onClick={() => openEdit(ev)}
                            title="Edit"
                            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.25rem", padding: "0.25rem 0.375rem", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center" }}>
                            <Edit2 size={12} />
                          </button>
                          <button onClick={() => { setDeletingId(ev.id); deleteMutation.mutate({ id: ev.id }); }}
                            title="Delete"
                            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.25rem", padding: "0.25rem 0.375rem", cursor: "pointer", color: deletingId === ev.id ? "#ef4444" : "#64748b", display: "flex", alignItems: "center" }}>
                            <Trash2 size={12} />
                          </button>
                        </div>

                        {/* Expand toggle */}
                        <div style={{ color: "#475569" }}>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "1rem", background: "rgba(0,0,0,0.2)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                          <div>
                            {ev.description && (
                              <div style={{ marginBottom: "0.75rem" }}>
                                <div style={{ fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569", marginBottom: "0.25rem" }}>Description</div>
                                <div style={{ fontSize: "0.6875rem", color: "#94a3b8", lineHeight: 1.5 }}>{ev.description}</div>
                              </div>
                            )}
                            {ev.notes && (
                              <div style={{ marginBottom: "0.75rem" }}>
                                <div style={{ fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569", marginBottom: "0.25rem" }}>Internal Notes</div>
                                <div style={{ fontSize: "0.6875rem", color: "#94a3b8", lineHeight: 1.5 }}>{ev.notes}</div>
                              </div>
                            )}
                          </div>
                          <div>
                            {ev.prospectName && (
                              <div style={{ marginBottom: "0.5rem" }}>
                                <div style={{ fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569", marginBottom: "0.25rem" }}>Contact</div>
                                <div style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>{ev.prospectName}</div>
                                {ev.prospectEmail && <div style={{ fontSize: "0.625rem", color: "#60a5fa" }}>{ev.prospectEmail}</div>}
                              </div>
                            )}
                            {ev.shareToken && (
                              <div>
                                <div style={{ fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569", marginBottom: "0.25rem" }}>Share Link</div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <span style={{ fontSize: "0.5625rem", color: "#64748b", fontFamily: "monospace", background: "rgba(255,255,255,0.04)", padding: "3px 6px", borderRadius: "4px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    /calendar/{ev.shareToken.slice(0, 12)}…
                                  </span>
                                  <button onClick={() => copyShareLink(ev.shareToken!)}
                                    style={{ background: "rgba(0,255,135,0.1)", color: "#00ff87", border: "1px solid rgba(0,255,135,0.2)", borderRadius: "4px", padding: "3px 8px", fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                                    <Copy size={10} /> Copy
                                  </button>
                                  <a href={`/calendar/${ev.shareToken}`} target="_blank" rel="noreferrer"
                                    style={{ color: "#60a5fa", display: "flex", alignItems: "center" }}>
                                    <ExternalLink size={12} />
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}>
          <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.75rem", width: "100%", maxWidth: "560px", maxHeight: "90vh", overflow: "auto" }}>
            {/* Modal header */}
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#e2e8f0" }}>
                {editingEvent ? "Edit Event" : "New Event"}
              </span>
              <button onClick={() => setShowModal(false)} style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center" }}>
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Title */}
              <div>
                <label style={{ display: "block", fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "0.375rem" }}>Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Intro Call — Acme Robotics"
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", color: "#e2e8f0", fontSize: "0.75rem", fontFamily: "var(--font-mono)", outline: "none", boxSizing: "border-box" }} />
              </div>

              {/* Type + Status row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "0.375rem" }}>Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as EventType }))}
                    style={{ width: "100%", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", color: "#e2e8f0", fontSize: "0.75rem", fontFamily: "var(--font-mono)", outline: "none" }}>
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "0.375rem" }}>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as EventStatus }))}
                    style={{ width: "100%", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", color: "#e2e8f0", fontSize: "0.75rem", fontFamily: "var(--font-mono)", outline: "none" }}>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Start + End time row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "0.375rem" }}>Start Time *</label>
                  <input type="datetime-local" value={form.startAt} onChange={e => setForm(f => ({ ...f, startAt: e.target.value }))}
                    style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", color: "#e2e8f0", fontSize: "0.75rem", fontFamily: "var(--font-mono)", outline: "none", boxSizing: "border-box", colorScheme: "dark" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "0.375rem" }}>End Time *</label>
                  <input type="datetime-local" value={form.endAt} onChange={e => setForm(f => ({ ...f, endAt: e.target.value }))}
                    style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", color: "#e2e8f0", fontSize: "0.75rem", fontFamily: "var(--font-mono)", outline: "none", boxSizing: "border-box", colorScheme: "dark" }} />
                </div>
              </div>

              {/* Prospect info */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "0.375rem" }}>Contact Name</label>
                  <input value={form.prospectName} onChange={e => setForm(f => ({ ...f, prospectName: e.target.value }))}
                    placeholder="Jane Smith"
                    style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", color: "#e2e8f0", fontSize: "0.75rem", fontFamily: "var(--font-mono)", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "0.375rem" }}>Company</label>
                  <input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                    placeholder="Acme Robotics"
                    style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", color: "#e2e8f0", fontSize: "0.75rem", fontFamily: "var(--font-mono)", outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "0.375rem" }}>Contact Email</label>
                <input value={form.prospectEmail} onChange={e => setForm(f => ({ ...f, prospectEmail: e.target.value }))}
                  placeholder="jane@acme.com"
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", color: "#e2e8f0", fontSize: "0.75rem", fontFamily: "var(--font-mono)", outline: "none", boxSizing: "border-box" }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "0.375rem" }}>Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} placeholder="What is this event about?"
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", color: "#e2e8f0", fontSize: "0.75rem", fontFamily: "var(--font-mono)", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "0.375rem" }}>Internal Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Notes not shared with prospect…"
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", color: "#e2e8f0", fontSize: "0.75rem", fontFamily: "var(--font-mono)", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
              </div>
            </div>

            {/* Modal footer */}
            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button onClick={() => setShowModal(false)}
                style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.375rem", padding: "0.5rem 1rem", color: "#64748b", fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ background: saving ? "rgba(0,255,135,0.4)" : "#00ff87", color: "#0a0a0a", border: "none", borderRadius: "0.375rem", padding: "0.5rem 1.25rem", fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: saving ? "not-allowed" : "pointer" }}>
                {saving ? "Saving…" : editingEvent ? "Save Changes" : "Create Event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
