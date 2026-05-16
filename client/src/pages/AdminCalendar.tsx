import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  Calendar, Plus, Edit2, Trash2, Copy, ExternalLink,
  Clock, User, Building2, Phone, Video, Star, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, X, Check, CheckCircle, RefreshCw, XCircle
} from "lucide-react";

type EventType = "meeting" | "demo" | "call" | "event" | "follow_up";
type EventStatus = "scheduled" | "confirmed" | "cancelled" | "completed";
type CalendarView = "day" | "week" | "month";

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

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_HOURS = Array.from({ length: 13 }, (_, i) => i + 7);

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function startOfWeek(date: Date) {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function sameDay(a: Date | string, b: Date | string) {
  return startOfDay(new Date(a)).getTime() === startOfDay(new Date(b)).getTime();
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function calendarMonthDays(date: Date) {
  const firstGridDay = startOfWeek(startOfMonth(date));
  return Array.from({ length: 42 }, (_, i) => addDays(firstGridDay, i));
}

function eventTimeRange(event: CalendarEvent) {
  const start = new Date(event.startAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Los_Angeles" });
  const end = new Date(event.endAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Los_Angeles" });
  return `${start} - ${end}`;
}

function calendarTitle(view: CalendarView, date: Date) {
  if (view === "month") {
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  if (view === "week") {
    const start = startOfWeek(date);
    const end = addDays(start, 6);
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

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
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [reschedulingEvent, setReschedulingEvent] = useState<CalendarEvent | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({ startAt: "", endAt: "", notes: "" });
  const [cancellingEvent, setCancellingEvent] = useState<CalendarEvent | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [view, setView] = useState<CalendarView>("month");
  const [cursorDate, setCursorDate] = useState(() => new Date());

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

  const confirmMutation = trpc.calendar.confirm.useMutation({
    onSuccess: () => { toast.success("Event confirmed"); utils.calendar.list.invalidate(); utils.calendar.upcomingCount.invalidate(); setConfirmingId(null); },
    onError: (e) => { toast.error(e.message); setConfirmingId(null); },
  });

  const rescheduleMutation = trpc.calendar.reschedule.useMutation({
    onSuccess: () => { toast.success("Event rescheduled — emails sent"); utils.calendar.list.invalidate(); utils.calendar.upcomingCount.invalidate(); setReschedulingEvent(null); },
    onError: (e) => { toast.error(e.message); },
  });

  const cancelMutation = trpc.calendar.cancel.useMutation({
    onSuccess: () => { toast.success("Event cancelled — emails sent"); utils.calendar.list.invalidate(); utils.calendar.upcomingCount.invalidate(); setCancellingEvent(null); setCancelReason(""); },
    onError: (e) => { toast.error(e.message); setCancellingEvent(null); },
  });

  const events: CalendarEvent[] = (data?.events ?? []) as CalendarEvent[];

  const filtered = useMemo(() => {
    return events.filter(e => {
      if (typeFilter && e.type !== typeFilter) return false;
      if (statusFilter && e.status !== statusFilter) return false;
      return true;
    });
  }, [events, typeFilter, statusFilter]);

  const upcomingCount = events.filter(e =>
    new Date(e.startAt) >= new Date() && e.status !== "cancelled" && e.status !== "completed"
  ).length;

  const monthDays = useMemo(() => calendarMonthDays(cursorDate), [cursorDate]);
  const weekDays = useMemo(() => {
    const start = startOfWeek(cursorDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursorDate]);
  const agendaEvents = useMemo(() => {
    return [...filtered].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [filtered]);

  function eventsForDay(day: Date) {
    return agendaEvents.filter(e => sameDay(e.startAt, day));
  }

  function moveCalendar(direction: -1 | 1) {
    if (view === "month") setCursorDate(d => addMonths(d, direction));
    if (view === "week") setCursorDate(d => addDays(d, direction * 7));
    if (view === "day") setCursorDate(d => addDays(d, direction));
  }

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

  function renderEventChip(ev: CalendarEvent, compact = false) {
    const typeCfg = TYPE_CONFIG[ev.type as EventType] ?? TYPE_CONFIG.meeting;
    const statusCfg = STATUS_CONFIG[ev.status as EventStatus] ?? STATUS_CONFIG.scheduled;
    return (
      <button
        key={ev.id}
        onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
        title={`${ev.title} · ${eventTimeRange(ev)}`}
        style={{
          width: "100%",
          textAlign: "left",
          border: `1px solid ${typeCfg.color}55`,
          borderLeft: `3px solid ${typeCfg.color}`,
          borderRadius: "0.375rem",
          background: ev.status === "cancelled" ? "rgba(239,68,68,0.05)" : `${typeCfg.color}12`,
          color: ev.status === "cancelled" ? "#64748b" : "#e2e8f0",
          padding: compact ? "0.25rem 0.375rem" : "0.45rem 0.55rem",
          cursor: "pointer",
          opacity: ev.status === "cancelled" ? 0.55 : 1,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", minWidth: 0 }}>
          <span style={{ color: typeCfg.color, flexShrink: 0 }}>{typeCfg.icon}</span>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: compact ? "0.5625rem" : "0.625rem", fontWeight: 800 }}>
            {ev.title}
          </span>
        </div>
        {!compact && (
          <div style={{ marginTop: "0.2rem", fontSize: "0.525rem", color: statusCfg.color }}>
            {eventTimeRange(ev)} · {statusCfg.label}
          </div>
        )}
      </button>
    );
  }

  function renderExpandedEventDetail(ev: CalendarEvent) {
    const typeCfg = TYPE_CONFIG[ev.type as EventType] ?? TYPE_CONFIG.meeting;
    const statusCfg = STATUS_CONFIG[ev.status as EventStatus] ?? STATUS_CONFIG.scheduled;
    const isExpanded = expandedId === ev.id;
    if (!isExpanded) return null;

    return (
      <div style={{ marginTop: "0.75rem", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.625rem", background: "rgba(255,255,255,0.025)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", padding: "1rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
              <span style={{ background: `${typeCfg.color}22`, color: typeCfg.color, fontSize: "0.5rem", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", letterSpacing: "0.08em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "3px" }}>
                {typeCfg.icon} {typeCfg.label}
              </span>
              <span style={{ background: `${statusCfg.color}22`, color: statusCfg.color, fontSize: "0.5rem", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {statusCfg.label}
              </span>
            </div>
            <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</div>
            <div style={{ fontSize: "0.625rem", color: "#94a3b8", marginTop: "0.3rem" }}>
              {formatDateTime(ev.startAt)} - {new Date(ev.endAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Los_Angeles" })} PT
            </div>
            {ev.companyName && <div style={{ fontSize: "0.625rem", color: "#64748b", marginTop: "0.3rem", display: "flex", alignItems: "center", gap: "0.25rem" }}><Building2 size={10} /> {ev.companyName}</div>}
          </div>
          <div style={{ display: "flex", gap: "0.375rem", alignItems: "flex-start", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {ev.shareToken && (
              <button onClick={() => copyShareLink(ev.shareToken!)} title="Copy share link" style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.25rem", padding: "0.25rem 0.375rem", cursor: "pointer", color: copiedToken === ev.shareToken ? "#00ff87" : "#64748b", display: "flex", alignItems: "center" }}>
                {copiedToken === ev.shareToken ? <Check size={12} /> : <Copy size={12} />}
              </button>
            )}
            {ev.status === "scheduled" && (
              <button onClick={() => { setConfirmingId(ev.id); confirmMutation.mutate({ id: ev.id }); }} title="Mark Confirmed" style={{ background: "transparent", border: "1px solid rgba(0,255,135,0.3)", borderRadius: "0.25rem", padding: "0.25rem 0.375rem", cursor: "pointer", color: confirmingId === ev.id ? "#00ff87" : "#4ade80", display: "flex", alignItems: "center", gap: "0.2rem", fontSize: "0.5625rem" }}>
                <CheckCircle size={11} /> Confirm
              </button>
            )}
            {(ev.status === "scheduled" || ev.status === "confirmed") && (
              <button onClick={() => {
                setReschedulingEvent(ev);
                const s = new Date(ev.startAt);
                const e2 = new Date(ev.endAt);
                const toLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                setRescheduleForm({ startAt: toLocal(s), endAt: toLocal(e2), notes: ev.notes ?? "" });
              }} title="Reschedule" style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.25rem", padding: "0.25rem 0.375rem", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center", gap: "0.2rem", fontSize: "0.5625rem" }}>
                <RefreshCw size={11} /> Reschedule
              </button>
            )}
            {(ev.status === "scheduled" || ev.status === "confirmed") && (
              <button onClick={() => { setCancellingEvent(ev); setCancelReason(""); }} title="Cancel Event" style={{ background: "transparent", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "0.25rem", padding: "0.25rem 0.375rem", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center", gap: "0.2rem", fontSize: "0.5625rem" }}>
                <XCircle size={11} /> Cancel
              </button>
            )}
            <button onClick={() => openEdit(ev)} title="Edit" style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.25rem", padding: "0.25rem 0.375rem", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center" }}>
              <Edit2 size={12} />
            </button>
            <button onClick={() => { setDeletingId(ev.id); deleteMutation.mutate({ id: ev.id }); }} title="Delete" style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.25rem", padding: "0.25rem 0.375rem", cursor: "pointer", color: deletingId === ev.id ? "#ef4444" : "#64748b", display: "flex", alignItems: "center" }}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        <div style={{ padding: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            {ev.description && <div style={{ marginBottom: "0.75rem" }}><div style={{ fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569", marginBottom: "0.25rem" }}>Description</div><div style={{ fontSize: "0.6875rem", color: "#94a3b8", lineHeight: 1.5 }}>{ev.description}</div></div>}
            {ev.notes && <div style={{ marginBottom: "0.75rem" }}><div style={{ fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569", marginBottom: "0.25rem" }}>Internal Notes</div><div style={{ fontSize: "0.6875rem", color: "#94a3b8", lineHeight: 1.5 }}>{ev.notes}</div></div>}
          </div>
          <div>
            {ev.prospectName && <div style={{ marginBottom: "0.5rem" }}><div style={{ fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569", marginBottom: "0.25rem" }}>Contact</div><div style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>{ev.prospectName}</div>{ev.prospectEmail && <div style={{ fontSize: "0.625rem", color: "#60a5fa" }}>{ev.prospectEmail}</div>}</div>}
            {ev.shareToken && <div><div style={{ fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569", marginBottom: "0.25rem" }}>Share Link</div><div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><span style={{ fontSize: "0.5625rem", color: "#64748b", fontFamily: "monospace", background: "rgba(255,255,255,0.04)", padding: "3px 6px", borderRadius: "4px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>/calendar/{ev.shareToken.slice(0, 12)}...</span><button onClick={() => copyShareLink(ev.shareToken!)} style={{ background: "rgba(0,255,135,0.1)", color: "#00ff87", border: "1px solid rgba(0,255,135,0.2)", borderRadius: "4px", padding: "3px 8px", fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}><Copy size={10} /> Copy</button><a href={`/calendar/${ev.shareToken}`} target="_blank" rel="noreferrer" style={{ color: "#60a5fa", display: "flex", alignItems: "center" }}><ExternalLink size={12} /></a></div></div>}
          </div>
        </div>
      </div>
    );
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
      <div style={{ padding: "0.875rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
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

      {/* Calendar controls */}
      <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button onClick={() => moveCalendar(-1)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.375rem", color: "#94a3b8", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ChevronLeft size={15} /></button>
          <button onClick={() => setCursorDate(new Date())} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.375rem", color: "#e2e8f0", height: 32, padding: "0 0.75rem", fontSize: "0.625rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}>Today</button>
          <button onClick={() => moveCalendar(1)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.375rem", color: "#94a3b8", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ChevronRight size={15} /></button>
          <div style={{ marginLeft: "0.5rem", fontSize: "0.875rem", color: "#e2e8f0", fontWeight: 800 }}>{calendarTitle(view, cursorDate)}</div>
        </div>
        <div style={{ display: "flex", gap: "0.375rem", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.5rem", padding: "0.25rem", background: "rgba(255,255,255,0.025)" }}>
          {(["day", "week", "month"] as CalendarView[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ border: "none", borderRadius: "0.35rem", background: view === v ? "rgba(0,255,135,0.15)" : "transparent", color: view === v ? "#00ff87" : "#94a3b8", padding: "0.35rem 0.75rem", fontSize: "0.5625rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar grid */}
      <div style={{ padding: "1.5rem" }}>
        {isLoading ? (
          <div style={{ color: "#64748b", fontSize: "0.75rem", textAlign: "center", padding: "3rem" }}>Loading events…</div>
        ) : (
          <>
            {view === "month" && (
              <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.75rem", overflow: "hidden", background: "rgba(255,255,255,0.015)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {DAY_LABELS.map(day => <div key={day} style={{ padding: "0.65rem", color: "#64748b", fontSize: "0.5625rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", textAlign: "center" }}>{day}</div>)}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
                  {monthDays.map(day => {
                    const dayEvents = eventsForDay(day);
                    const activeMonth = isSameMonth(day, cursorDate);
                    const today = sameDay(day, new Date());
                    return (
                      <div key={day.toISOString()} style={{ minHeight: 132, padding: "0.6rem", borderRight: day.getDay() === 6 ? "none" : "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", background: today ? "rgba(0,255,135,0.045)" : "transparent", opacity: activeMonth ? 1 : 0.35 }}>
                        <button onClick={() => { setCursorDate(day); setView("day"); }} style={{ background: today ? "#00ff87" : "transparent", color: today ? "#0a0a0a" : "#94a3b8", border: "none", borderRadius: "999px", width: 24, height: 24, fontSize: "0.625rem", fontWeight: 800, cursor: "pointer", marginBottom: "0.4rem" }}>{day.getDate()}</button>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          {dayEvents.slice(0, 3).map(ev => renderEventChip(ev, true))}
                          {dayEvents.length > 3 && <button onClick={() => { setCursorDate(day); setView("day"); }} style={{ background: "transparent", border: "none", color: "#64748b", fontSize: "0.55rem", textAlign: "left", cursor: "pointer" }}>+{dayEvents.length - 3} more</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {view === "week" && (
              <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.75rem", overflow: "hidden", background: "rgba(255,255,255,0.015)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <div />
                  {weekDays.map(day => <div key={day.toISOString()} style={{ padding: "0.65rem", textAlign: "center", borderLeft: "1px solid rgba(255,255,255,0.06)" }}><div style={{ color: "#64748b", fontSize: "0.55rem", fontWeight: 800, textTransform: "uppercase" }}>{DAY_LABELS[day.getDay()]}</div><button onClick={() => { setCursorDate(day); setView("day"); }} style={{ marginTop: "0.25rem", background: sameDay(day, new Date()) ? "#00ff87" : "transparent", color: sameDay(day, new Date()) ? "#0a0a0a" : "#e2e8f0", border: "none", borderRadius: "999px", width: 26, height: 26, fontWeight: 800, cursor: "pointer" }}>{day.getDate()}</button></div>)}
                </div>
                {DAY_HOURS.map(hour => (
                  <div key={hour} style={{ display: "grid", gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))", minHeight: 86, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ padding: "0.5rem", color: "#475569", fontSize: "0.55rem", textAlign: "right" }}>{hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? "PM" : "AM"}</div>
                    {weekDays.map(day => {
                      const hourEvents = eventsForDay(day).filter(ev => new Date(ev.startAt).getHours() === hour);
                      return <div key={`${day.toISOString()}-${hour}`} style={{ borderLeft: "1px solid rgba(255,255,255,0.05)", padding: "0.35rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>{hourEvents.map(ev => renderEventChip(ev, true))}</div>;
                    })}
                  </div>
                ))}
              </div>
            )}

            {view === "day" && (
              <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.75rem", overflow: "hidden", background: "rgba(255,255,255,0.015)" }}>
                {DAY_HOURS.map(hour => {
                  const hourEvents = eventsForDay(cursorDate).filter(ev => new Date(ev.startAt).getHours() === hour);
                  return (
                    <div key={hour} style={{ display: "grid", gridTemplateColumns: "72px 1fr", minHeight: 92, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ padding: "0.75rem", color: "#475569", fontSize: "0.5625rem", textAlign: "right" }}>{hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? "PM" : "AM"}</div>
                      <div style={{ borderLeft: "1px solid rgba(255,255,255,0.05)", padding: "0.5rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        {hourEvents.length > 0 ? hourEvents.map(ev => renderEventChip(ev)) : <button onClick={openCreate} style={{ height: "100%", minHeight: 44, background: "transparent", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: "0.5rem", color: "#334155", fontSize: "0.625rem", cursor: "pointer" }}>Add event</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {filtered.length === 0 && (
              <div style={{ marginTop: "1rem", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: "0.75rem", padding: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", background: "rgba(255,255,255,0.015)" }}>
                <div>
                  <div style={{ color: "#94a3b8", fontSize: "0.75rem", fontWeight: 800 }}>No events match this view yet.</div>
                  <div style={{ color: "#475569", fontSize: "0.625rem", marginTop: "0.25rem" }}>The calendar grid stays visible so you can plan before the first booking lands.</div>
                </div>
                <button onClick={openCreate} style={{ background: "rgba(0,255,135,0.1)", color: "#00ff87", border: "1px solid rgba(0,255,135,0.3)", borderRadius: "0.375rem", padding: "0.5rem 1.25rem", fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap" }}>
                  + Create Event
                </button>
              </div>
            )}

            {expandedId && agendaEvents.map(ev => renderExpandedEventDetail(ev))}
          </>
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

      {/* Reschedule Modal */}
      {reschedulingEvent && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}
          onClick={() => setReschedulingEvent(null)}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.75rem", width: "100%", maxWidth: "420px", margin: "1rem" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8", marginBottom: "0.25rem" }}>Reschedule Meeting</div>
                <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#e2e8f0" }}>{reschedulingEvent.title}</div>
              </div>
              <button onClick={() => setReschedulingEvent(null)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b", padding: "0.25rem" }}><X size={16} /></button>
            </div>
            <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "0.375rem" }}>New Start Time</label>
                <input type="datetime-local" value={rescheduleForm.startAt}
                  onChange={e => setRescheduleForm(f => ({ ...f, startAt: e.target.value }))}
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", color: "#e2e8f0", fontSize: "0.75rem", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "0.375rem" }}>New End Time</label>
                <input type="datetime-local" value={rescheduleForm.endAt}
                  onChange={e => setRescheduleForm(f => ({ ...f, endAt: e.target.value }))}
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", color: "#e2e8f0", fontSize: "0.75rem", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "0.375rem" }}>Notes (optional)</label>
                <textarea value={rescheduleForm.notes} onChange={e => setRescheduleForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Reason for reschedule or updated agenda…"
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", color: "#e2e8f0", fontSize: "0.75rem", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
              </div>
              <p style={{ fontSize: "0.625rem", color: "#64748b", margin: 0 }}>Confirmation emails will be sent to the prospect, Tommy, and the owner with the updated time.</p>
            </div>
            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button onClick={() => setReschedulingEvent(null)}
                style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.375rem", padding: "0.5rem 1rem", color: "#64748b", fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}>
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!rescheduleForm.startAt || !rescheduleForm.endAt) { toast.error("Please set both start and end times"); return; }
                  rescheduleMutation.mutate({
                    id: reschedulingEvent.id,
                    startAt: new Date(rescheduleForm.startAt).toISOString(),
                    endAt: new Date(rescheduleForm.endAt).toISOString(),
                    notes: rescheduleForm.notes || undefined,
                  });
                }}
                disabled={rescheduleMutation.isPending}
                style={{ background: rescheduleMutation.isPending ? "rgba(0,255,135,0.4)" : "#00ff87", color: "#0a0a0a", border: "none", borderRadius: "0.375rem", padding: "0.5rem 1.25rem", fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: rescheduleMutation.isPending ? "not-allowed" : "pointer" }}>
                {rescheduleMutation.isPending ? "Sending…" : "Reschedule & Notify"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirm Modal */}
      {cancellingEvent && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
          onClick={() => setCancellingEvent(null)}>
          <div style={{ background: "#0f1117", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "0.75rem", padding: "1.5rem", maxWidth: "420px", width: "100%" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <XCircle size={16} color="#ef4444" />
              <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#ef4444" }}>Cancel Event</span>
            </div>
            <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "1rem" }}>
              Cancel <strong style={{ color: "#e2e8f0" }}>{cancellingEvent.title}</strong>? Cancellation emails will be sent to
              {cancellingEvent.prospectEmail ? ` ${cancellingEvent.prospectName ?? cancellingEvent.prospectEmail},` : ""} Tommy, and the owner.
            </p>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "0.375rem" }}>Reason (optional)</label>
              <input
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="e.g. Scheduling conflict, prospect unavailable…"
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", color: "#e2e8f0", fontSize: "0.6875rem", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button onClick={() => setCancellingEvent(null)}
                style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.375rem", padding: "0.5rem 1rem", color: "#64748b", fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}>
                Keep Event
              </button>
              <button
                onClick={() => cancelMutation.mutate({ id: cancellingEvent.id, reason: cancelReason || undefined })}
                disabled={cancelMutation.isPending}
                style={{ background: cancelMutation.isPending ? "rgba(239,68,68,0.4)" : "#ef4444", color: "#fff", border: "none", borderRadius: "0.375rem", padding: "0.5rem 1.25rem", fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: cancelMutation.isPending ? "not-allowed" : "pointer" }}>
                {cancelMutation.isPending ? "Cancelling…" : "Cancel Event & Notify"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
