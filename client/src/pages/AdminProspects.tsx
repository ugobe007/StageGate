import { useState, useRef } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Navbar from "@/components/Navbar";
import ProspectCRMCard from "@/components/ProspectCRMCard";
import { ExternalLink, Mail, RefreshCw, ChevronDown, Check, X, Clock, Phone, AlertCircle, Square, CheckSquare, Zap, ArrowUpDown, ArrowUp, ArrowDown, Download, Upload, Calendar, ArrowRight } from "lucide-react";

type ProspectStatus = "new" | "contacted" | "responded" | "scheduled" | "converted" | "not_interested";

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const STATUS_CONFIG: Record<ProspectStatus, { label: string; color: string; icon: React.ReactNode }> = {
  new:            { label: "New",           color: "rgba(255,255,255,0.35)", icon: <AlertCircle size={11} /> },
  contacted:      { label: "Contacted",     color: "#f59e0b",                icon: <Mail size={11} /> },
  responded:      { label: "Responded",     color: "#00ff87",                icon: <Check size={11} /> },
  scheduled:      { label: "Scheduled",     color: "#60a5fa",                icon: <Phone size={11} /> },
  converted:      { label: "Converted",     color: "#a78bfa",                icon: <Check size={11} /> },
  not_interested: { label: "Not Interested",color: "rgba(255,255,255,0.20)", icon: <X size={11} /> },
};

const ROBOT_TYPE_LABELS: Record<string, string> = {
  humanoid: "Humanoid",
  industrial_arm: "Industrial Arm",
  mobile: "Mobile / AMR",
  service: "Service",
  delivery: "Delivery",
  inspection: "Inspection",
  other: "Other",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  verified: "#00ff87",
  high: "rgba(0,255,135,0.70)",
  medium: "#f59e0b",
  low: "rgba(255,255,255,0.30)",
};

const CONFIDENCE_BORDERS: Record<string, string> = {
  verified: "rgba(0,255,135,0.40)",
  high: "rgba(0,255,135,0.25)",
  medium: "rgba(245,158,11,0.35)",
  low: "rgba(255,255,255,0.12)",
};

export default function AdminProspects() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [hideContacted, setHideContacted] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());
  const [failedIds, setFailedIds] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState<Record<number, string>>({});
  const [editContact, setEditContact] = useState<Record<number, {
    contactName?: string;
    contactTitle?: string;
    contactEmail?: string;
    contactLinkedIn?: string;
    emailConfidence?: string;
  }>>({});
  const [editingContactId, setEditingContactId] = useState<number | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const DESTRUCTIVE_STATUSES: ProspectStatus[] = ["not_interested", "converted"];
  const [bulkStatusTarget, setBulkStatusTargetRaw] = useState<ProspectStatus>(() => {
    try {
      const saved = localStorage.getItem("sg_bulk_status_target") as ProspectStatus | null;
      return saved && STATUS_CONFIG[saved] ? saved : "contacted";
    } catch { return "contacted"; }
  });
  const setBulkStatusTarget = (s: ProspectStatus) => {
    setBulkStatusTargetRaw(s);
    try { localStorage.setItem("sg_bulk_status_target", s); } catch {}
    setPendingConfirm(false);
  };
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(false);

  const bulkUpdateStatusMutation = trpc.prospects.bulkUpdateStatus.useMutation({
    onSuccess: (data) => {
      const label = STATUS_CONFIG[bulkStatusTarget]?.label ?? bulkStatusTarget;
      toast.success(`${data.updated} prospect${data.updated !== 1 ? 's' : ''} moved to ${label}`);
      setSelectedIds(new Set());
      refetch();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setBulkUpdating(false),
  });

  const handleBulkUpdateStatus = () => {
    if (selectedIds.size === 0 || bulkUpdating) return;
    if (DESTRUCTIVE_STATUSES.includes(bulkStatusTarget) && !pendingConfirm) {
      setPendingConfirm(true);
      return;
    }
    setPendingConfirm(false);
    setBulkUpdating(true);
    bulkUpdateStatusMutation.mutate({ ids: Array.from(selectedIds), status: bulkStatusTarget });
  };
  const [bulkProgress, setBulkProgress] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [bulkResults, setBulkResults] = useState<{ id: number; success: boolean; company: string; error?: string }[]>([]);

  // Fetch all prospects (no status filter) for count badges
  const { data: allData } = trpc.prospects.list.useQuery(
    {},
    { enabled: !!user && user.role === "admin" }
  );
  const statusCounts = (allData?.prospects ?? []).reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});
  const { data, isLoading, refetch } = trpc.prospects.listWithEngagement.useQuery(
    { status: statusFilter || undefined },
    { enabled: !!user && user.role === "admin" }
  );

  // Fetch shows for urgency calculation
  const { data: showsData } = trpc.shows.list.useQuery(undefined, { enabled: !!user && user.role === "admin" });
  const showDateMap = (showsData ?? []).reduce<Record<string, Date>>((acc, s) => {
    if (s.startDate) acc[s.name.toLowerCase()] = new Date(s.startDate);
    return acc;
  }, {});

  // Get urgency for a prospect: days until their soonest upcoming show
  function getUrgency(shows: string[]): { days: number; label: string; color: string } | null {
    const now = Date.now();
    let minDays: number | null = null;
    for (const show of shows) {
      const date = showDateMap[show.toLowerCase()];
      if (!date) continue;
      const days = Math.ceil((date.getTime() - now) / 86_400_000);
      if (days >= 0 && (minDays === null || days < minDays)) minDays = days;
    }
    if (minDays === null) return null;
    if (minDays <= 30) return { days: minDays, label: `${minDays}d`, color: "#ef4444" };
    if (minDays <= 60) return { days: minDays, label: `${minDays}d`, color: "#f59e0b" };
    if (minDays <= 90) return { days: minDays, label: `${minDays}d`, color: "#60a5fa" };
    return { days: minDays, label: `${minDays}d`, color: "rgba(255,255,255,0.30)" };
  }

  const sendEmail = trpc.prospects.sendIntroEmail.useMutation({
    onSuccess: (_, vars) => {
      setSentIds(prev => { const next = new Set(Array.from(prev)); next.add(vars.prospectId); return next; });
      setSendingId(null);
      refetch();
    },
    onError: () => setSendingId(null),
  });

  const bulkSend = trpc.prospects.bulkSendEmails.useMutation({
    onSuccess: (result) => {
      setBulkSending(false);
      setBulkProgress({ sent: result.sent, failed: result.failed, total: result.results.length });
      setBulkResults(result.results);
      // Mark sent rows green, failed rows red
      const newSent = new Set(Array.from(sentIds));
      const newFailed = new Set(Array.from(failedIds));
      result.results.forEach(r => {
        if (r.success) newSent.add(r.id);
        else newFailed.add(r.id);
      });
      setSentIds(newSent);
      setFailedIds(newFailed);
      setSelectedIds(new Set());
      refetch();
    },
    onError: () => {
      setBulkSending(false);
      setBulkProgress(null);
    },
  });

  const updateProspect = trpc.prospects.update.useMutation({
    onSuccess: () => refetch(),
  });

  // View mode: table, kanban, or byshow
  const [viewMode, setViewMode] = useState<"table" | "kanban" | "byshow">("table");
  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Sort state
  type SortKey = "company" | "status" | "followUpDate" | "engagementScore" | "";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<SortKey>("");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };
  // Follow-up date editing state
  const [editingFollowUpId, setEditingFollowUpId] = useState<number | null>(null);
  // CSV import state
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<{ company: string; contactName?: string; contactEmail?: string; shows?: string; notes?: string }[] | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const bulkImport = trpc.prospects.bulkImport.useMutation({
    onSuccess: () => { setCsvPreview(null); setCsvImporting(false); refetch(); },
    onError: () => setCsvImporting(false),
  });
  const handleCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return;
      const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim().toLowerCase());
      const colIdx = (names: string[]) => names.map(n => headers.findIndex(h => h.includes(n))).find(i => i >= 0) ?? -1;
      const companyIdx = colIdx(["company", "organization", "org"]);
      const nameIdx = colIdx(["contact", "name", "person"]);
      const emailIdx = colIdx(["email"]);
      const showsIdx = colIdx(["show", "event"]);
      const notesIdx = colIdx(["note", "comment"]);
      const parsed = lines.slice(1).map(line => {
        const cols = line.split(",").map(c => c.replace(/^"|"$/g, "").trim());
        return {
          company: companyIdx >= 0 ? cols[companyIdx] : "",
          contactName: nameIdx >= 0 ? cols[nameIdx] : undefined,
          contactEmail: emailIdx >= 0 ? cols[emailIdx] : undefined,
          shows: showsIdx >= 0 ? cols[showsIdx] : undefined,
          notes: notesIdx >= 0 ? cols[notesIdx] : undefined,
        };
      }).filter(r => r.company);
      setCsvPreview(parsed);
    };
    reader.readAsText(file);
  };
  const confirmCsvImport = () => {
    if (!csvPreview || csvImporting) return;
    setCsvImporting(true);
    bulkImport.mutate({
      prospects: csvPreview.map(r => ({
        company: r.company,
        contactName: r.contactName,
        contactEmail: r.contactEmail,
        shows: r.shows ? [r.shows] : [],
        notes: r.notes,
      }))
    });
  };

  // Reply notes inline state: prospectId → note text (undefined = not showing, string = showing)
  const [replyNotes, setReplyNotes] = useState<Record<number, string>>({});
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const markReplied = trpc.prospects.markReplied.useMutation({
    onMutate: (vars) => {
      setReplyingId(vars.id);
    },
    onSuccess: (_, vars) => {
      setReplyingId(null);
      // After marking replied, show the inline notes prompt
      setReplyNotes(prev => ({ ...prev, [vars.id]: "" }));
      refetch();
    },
    onError: () => setReplyingId(null),
  });

  const saveReplyNote = (prospectId: number) => {
    const note = replyNotes[prospectId];
    if (note && note.trim()) {
      updateProspect.mutate({ id: prospectId, notes: note.trim() });
    }
    setReplyNotes(prev => { const next = { ...prev }; delete next[prospectId]; return next; });
  };

  const dismissReplyNote = (prospectId: number) => {
    setReplyNotes(prev => { const next = { ...prev }; delete next[prospectId]; return next; });
  };

  // CSV export helper
  const exportCSV = () => {
    const headers = ["Company", "Contact Name", "Title", "Email", "Email Confidence", "Status", "Replied At", "Shows", "Notes", "Website"];
    const rows = sortedProspects.map(p => [
      p.company,
      p.contactName ?? "",
      p.contactTitle ?? "",
      p.contactEmail ?? "",
      String((p as Record<string, unknown>).emailConfidence ?? ""),
      p.status,
      (p as Record<string, unknown>).repliedAt ? new Date(String((p as Record<string, unknown>).repliedAt)).toISOString() : "",
      ((p.shows as string[] | null) ?? []).join(" | "),
      (p.notes ?? "").replace(/\n/g, " "),
      p.website ?? "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const label = statusFilter ? statusFilter : "all";
    a.download = `prospects-${label}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: "#080808" }}>
        <Navbar />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: "1.5rem" }}>
          <p style={{ color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-mono)", fontSize: "0.875rem" }}>Admin access required</p>
          <a href={getLoginUrl()} className="btn-primary">Sign In</a>
        </div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div style={{ minHeight: "100vh", background: "#080808" }}>
        <Navbar />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
          <p style={{ color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-mono)", fontSize: "0.875rem" }}>Forbidden — admin only</p>
        </div>
      </div>
    );
  }

  const prospects = (data?.prospects ?? []).filter(p => {
    if (hideContacted && statusFilter === "" && p.status === "contacted") return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchCompany = p.company.toLowerCase().includes(q);
      const matchContact = (p.contactName ?? "").toLowerCase().includes(q);
      const matchEmail = (p.contactEmail ?? "").toLowerCase().includes(q);
      if (!matchCompany && !matchContact && !matchEmail) return false;
    }
    return true;
  });

  const STATUS_ORDER: Record<string, number> = { new: 0, contacted: 1, responded: 2, scheduled: 3, converted: 4, not_interested: 5 };
  const sortedProspects = sortKey === "" ? prospects : [...prospects].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "company") cmp = a.company.localeCompare(b.company);
    else if (sortKey === "status") cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    else if (sortKey === "followUpDate") {
      const aDate = (a as Record<string, unknown>).followUpDate ? new Date(String((a as Record<string, unknown>).followUpDate)).getTime() : Infinity;
      const bDate = (b as Record<string, unknown>).followUpDate ? new Date(String((b as Record<string, unknown>).followUpDate)).getTime() : Infinity;
      cmp = aDate - bDate;
    } else if (sortKey === "engagementScore") {
      const aScore = Number((a as Record<string, unknown>).engagementScore ?? 0);
      const bScore = Number((b as Record<string, unknown>).engagementScore ?? 0);
      cmp = aScore - bScore;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  // Helpers for selection
  const allVisibleIds = prospects.map(p => p.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.has(id));
  const someSelected = allVisibleIds.some(id => selectedIds.has(id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allVisibleIds));
    }
  };

  const toggleRow = (id: number) => {
    const next = new Set(Array.from(selectedIds));
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectVerifiedOnly = () => {
    const verifiedIds = prospects
      .filter(p => {
        const conf = String((p as Record<string, unknown>).emailConfidence ?? "");
        return (conf === "verified" || conf === "high") && !!p.contactEmail && p.status !== "contacted";
      })
      .map(p => p.id);
    setSelectedIds(new Set(verifiedIds));
  };

  const handleBulkSend = () => {
    if (selectedIds.size === 0 || bulkSending) return;
    setBulkSending(true);
    setBulkProgress({ sent: 0, failed: 0, total: selectedIds.size });
    setBulkResults([]);
    bulkSend.mutate({ prospectIds: Array.from(selectedIds) });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#080808" }}>
      <Navbar />
      <div className="container" style={{ paddingTop: "6rem", paddingBottom: "6rem" }}>
        {/* Header */}
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "2rem", marginBottom: "2rem" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.30)", marginBottom: "0.5rem" }}>
            XBOT / OUTREACH
          </p>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <h1 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.04em", color: "#fff", margin: 0 }}>
              Prospect Database
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "#00ff87" }}>
                {prospects.length}{hideContacted && statusFilter === "" ? ` of ${(allData?.prospects ?? []).length}` : ""} prospects{hideContacted && statusFilter === "" ? " (contacted hidden)" : ""}
              </span>
              <button
                onClick={exportCSV}
                title="Download CSV"
                style={{
                  display: "flex", alignItems: "center", gap: "0.3rem",
                  fontFamily: "var(--font-mono)", fontSize: "0.5625rem", letterSpacing: "0.08em", textTransform: "uppercase",
                  padding: "0.3rem 0.65rem",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "rgba(255,255,255,0.50)",
                  background: "transparent", cursor: "pointer", borderRadius: "0.125rem",
                  transition: "all 0.15s",
                }}
              >
                <Download size={11} /> CSV
              </button>
              {/* Hidden file input for CSV import */}
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); e.target.value = ""; }}
              />
              <button
                onClick={() => csvInputRef.current?.click()}
                title="Import prospects from CSV"
                style={{
                  display: "flex", alignItems: "center", gap: "0.3rem",
                  fontFamily: "var(--font-mono)", fontSize: "0.5625rem", letterSpacing: "0.08em", textTransform: "uppercase",
                  padding: "0.3rem 0.65rem",
                  border: "1px solid rgba(245,158,11,0.30)",
                  color: "rgba(245,158,11,0.70)",
                  background: "transparent", cursor: "pointer", borderRadius: "0.125rem",
                  transition: "all 0.15s",
                }}
              >
                <Upload size={11} /> Import
              </button>
              {/* View toggle */}
              <div style={{ display: "flex", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.125rem", overflow: "hidden" }}>
                <button
                  onClick={() => setViewMode("table")}
                  title="Table view"
                  style={{ padding: "0.3rem 0.55rem", background: viewMode === "table" ? "rgba(255,255,255,0.10)" : "transparent", border: "none", cursor: "pointer", color: viewMode === "table" ? "#fff" : "rgba(255,255,255,0.35)", borderRight: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                </button>
                <button
                  onClick={() => setViewMode("kanban")}
                  title="Kanban view"
                  style={{ padding: "0.3rem 0.55rem", background: viewMode === "kanban" ? "rgba(255,255,255,0.10)" : "transparent", border: "none", cursor: "pointer", color: viewMode === "kanban" ? "#fff" : "rgba(255,255,255,0.35)", borderRight: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="15" rx="1"/></svg>
                </button>
                <button
                  onClick={() => setViewMode("byshow")}
                  title="By Show view"
                  style={{ padding: "0.3rem 0.55rem", background: viewMode === "byshow" ? "rgba(255,255,255,0.10)" : "transparent", border: "none", cursor: "pointer", color: viewMode === "byshow" ? "#00ff87" : "rgba(255,255,255,0.35)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>
                </button>
              </div>
              <button onClick={() => refetch()} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.40)", padding: "0.25rem" }}>
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Outreach Stats Summary Bar */}
        {(() => {
          const all = allData?.prospects ?? [];
          const total = all.length;
          const contacted = all.filter(p => p.status === "contacted" || p.status === "responded" || p.status === "scheduled" || p.status === "converted").length;
          const responded = all.filter(p => p.status === "responded" || p.status === "scheduled" || p.status === "converted").length;
          const converted = all.filter(p => p.status === "converted").length;
          const responseRate = contacted > 0 ? Math.round((responded / contacted) * 100) : 0;
          const conversionRate = responded > 0 ? Math.round((converted / responded) * 100) : 0;
          const stats = [
            { label: "Total", value: total, color: "rgba(255,255,255,0.55)" },
            { label: "Contacted", value: contacted, color: "#f59e0b" },
            { label: "Responded", value: responded, color: "#00ff87" },
            { label: "Converted", value: converted, color: "#818cf8" },
            { label: "Response Rate", value: `${responseRate}%`, color: responded > 0 ? "#00ff87" : "rgba(255,255,255,0.30)" },
            { label: "Conv. Rate", value: `${conversionRate}%`, color: converted > 0 ? "#818cf8" : "rgba(255,255,255,0.30)" },
          ];
          return (
            <div style={{
              display: "flex",
              alignItems: "stretch",
              gap: 0,
              marginBottom: "1.75rem",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "0.25rem",
              overflow: "hidden",
            }}>
              {stats.map((s, i) => (
                <div key={s.label} style={{
                  flex: 1,
                  padding: "0.75rem 1rem",
                  borderRight: i < stats.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.45rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>
                    {s.label}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "1.125rem", fontWeight: 700, color: s.color, letterSpacing: "-0.02em", lineHeight: 1 }}>
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Search input */}
        <div style={{ marginBottom: "1.25rem", position: "relative", maxWidth: "28rem" }}>
          <input
            type="text"
            placeholder="Search company, contact, or email…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Escape") setSearchQuery(""); }}
            style={{
              width: "100%",
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${searchQuery ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.10)"}`,
              color: "#fff",
              padding: "0.55rem 2.25rem 0.55rem 0.85rem",
              borderRadius: "0.25rem",
              outline: "none",
              transition: "border-color 0.15s",
              boxSizing: "border-box" as const,
            }}
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute", right: "0.6rem", top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: "rgba(255,255,255,0.40)", padding: 0, lineHeight: 1,
              }}
            >
              <X size={13} />
            </button>
          ) : (
            <span style={{ position: "absolute", right: "0.7rem", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.20)", pointerEvents: "none", lineHeight: 1 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </span>
          )}
        </div>

        {/* Status filter tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "2rem" }}>
          {["", "new", "contacted", "responded", "scheduled", "converted", "not_interested"].map(s => {
            const count = s === "" ? (allData?.prospects ?? []).length : (statusCounts[s] ?? 0);
            const isActive = statusFilter === s;
            const accentColor = s === "contacted" ? "#f59e0b" : s === "responded" ? "#00ff87" : s === "scheduled" ? "#818cf8" : "rgba(255,255,255,0.40)";
            return (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setSelectedIds(new Set()); if (s !== "") setHideContacted(false); }}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.625rem",
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  padding: "0.3rem 0.75rem",
                  border: `1px solid ${isActive ? (s === "" ? "rgba(255,255,255,0.40)" : accentColor) : "rgba(255,255,255,0.10)"}`,
                  background: isActive ? (s === "" ? "rgba(255,255,255,0.06)" : `${accentColor}18`) : "transparent",
                  color: isActive ? (s === "" ? "#fff" : accentColor) : "rgba(255,255,255,0.40)",
                  cursor: "pointer",
                  borderRadius: "0.125rem",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                {s === "" ? "All" : STATUS_CONFIG[s as ProspectStatus]?.label ?? s}
                {count > 0 && (
                  <span style={{
                    fontSize: "0.5rem",
                    padding: "0.05rem 0.3rem",
                    borderRadius: "0.75rem",
                    background: isActive ? (s === "" ? "rgba(255,255,255,0.12)" : `${accentColor}30`) : "rgba(255,255,255,0.06)",
                    color: isActive ? (s === "" ? "rgba(255,255,255,0.80)" : accentColor) : "rgba(255,255,255,0.30)",
                    fontVariantNumeric: "tabular-nums",
                  }}>{count}</span>
                )}
              </button>
            );
          })}
          {/* Hide Contacted quick-toggle — only visible when All filter is active */}
          {statusFilter === "" && (
            <button
              onClick={() => { setHideContacted(h => !h); setSelectedIds(new Set()); }}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.625rem",
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                padding: "0.3rem 0.75rem",
                border: `1px solid ${hideContacted ? "rgba(239,68,68,0.50)" : "rgba(255,255,255,0.10)"}`,
                background: hideContacted ? "rgba(239,68,68,0.10)" : "transparent",
                color: hideContacted ? "#f87171" : "rgba(255,255,255,0.40)",
                cursor: "pointer",
                borderRadius: "0.125rem",
                transition: "all 0.15s",
                marginLeft: "0.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              {hideContacted ? "● Hiding Contacted" : "Hide Contacted"}
            </button>
          )}
        </div>

        {/* Bulk action toolbar — appears when rows are selected */}
        {someSelected && (
          <div style={{
            position: "sticky",
            top: "4rem",
            zIndex: 40,
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
            padding: "0.75rem 1.25rem",
            background: "rgba(8,8,8,0.95)",
            border: "1px solid rgba(245,158,11,0.30)",
            borderRadius: "0.25rem",
            marginBottom: "1.5rem",
            backdropFilter: "blur(8px)",
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.10em", textTransform: "uppercase", color: "#f59e0b" }}>
              {selectedIds.size} selected
            </span>

            <button
              onClick={selectVerifiedOnly}
              style={{
                display: "flex", alignItems: "center", gap: "0.3rem",
                fontFamily: "var(--font-mono)", fontSize: "0.5625rem", letterSpacing: "0.08em", textTransform: "uppercase",
                padding: "0.3rem 0.65rem",
                border: "1px solid rgba(0,255,135,0.30)",
                color: "#00ff87",
                background: "transparent", cursor: "pointer", borderRadius: "0.125rem",
              }}
            >
              <Check size={10} /> Select Verified Only
            </button>

            <button
              onClick={() => setSelectedIds(new Set())}
              style={{
                display: "flex", alignItems: "center", gap: "0.3rem",
                fontFamily: "var(--font-mono)", fontSize: "0.5625rem", letterSpacing: "0.08em", textTransform: "uppercase",
                padding: "0.3rem 0.65rem",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.40)",
                background: "transparent", cursor: "pointer", borderRadius: "0.125rem",
              }}
            >
              <X size={10} /> Clear
            </button>

            {/* Bulk move-to-status: two-part control — status picker + confirm */}
            <div style={{ position: "relative", display: "flex", alignItems: "stretch", gap: 0 }}>
              {/* Status picker button */}
              <button
                onClick={() => setBulkStatusOpen(o => !o)}
                disabled={bulkUpdating}
                style={{
                  display: "flex", alignItems: "center", gap: "0.35rem",
                  fontFamily: "var(--font-mono)", fontSize: "0.5625rem", fontWeight: 700,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  padding: "0.35rem 0.65rem",
                  background: "rgba(99,102,241,0.10)",
                  color: STATUS_CONFIG[bulkStatusTarget].color,
                  border: "1px solid rgba(99,102,241,0.35)",
                  borderRight: "none",
                  cursor: bulkUpdating ? "not-allowed" : "pointer",
                  borderRadius: "0.125rem 0 0 0.125rem",
                  transition: "all 0.15s",
                  minWidth: "7rem",
                }}
              >
                {STATUS_CONFIG[bulkStatusTarget].icon}
                {STATUS_CONFIG[bulkStatusTarget].label}
                <ChevronDown size={9} style={{ marginLeft: "auto", opacity: 0.6 }} />
              </button>

              {/* Confirm button — or inline confirmation guard for destructive statuses */}
              {pendingConfirm ? (
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem",
                  padding: "0.35rem 0.65rem",
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.35)",
                  borderRadius: "0 0.125rem 0.125rem 0",
                }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", color: "rgba(239,68,68,0.85)",
                    letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    Move {selectedIds.size} to {STATUS_CONFIG[bulkStatusTarget].label}?
                  </span>
                  <button
                    onClick={handleBulkUpdateStatus}
                    style={{ display: "flex", alignItems: "center", gap: "0.25rem",
                      fontFamily: "var(--font-mono)", fontSize: "0.5rem", fontWeight: 700,
                      letterSpacing: "0.08em", textTransform: "uppercase",
                      padding: "0.2rem 0.5rem",
                      background: "rgba(239,68,68,0.15)", color: "#f87171",
                      border: "1px solid rgba(239,68,68,0.40)",
                      cursor: "pointer", borderRadius: "0.125rem",
                    }}
                  >
                    <Check size={9} /> Confirm
                  </button>
                  <button
                    onClick={() => setPendingConfirm(false)}
                    style={{ display: "flex", alignItems: "center", gap: "0.25rem",
                      fontFamily: "var(--font-mono)", fontSize: "0.5rem", fontWeight: 700,
                      letterSpacing: "0.08em", textTransform: "uppercase",
                      padding: "0.2rem 0.5rem",
                      background: "transparent", color: "rgba(255,255,255,0.35)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      cursor: "pointer", borderRadius: "0.125rem",
                    }}
                  >
                    <X size={9} /> Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleBulkUpdateStatus}
                  disabled={bulkUpdating || selectedIds.size === 0}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.4rem",
                    fontFamily: "var(--font-mono)", fontSize: "0.5625rem", fontWeight: 700,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    padding: "0.35rem 0.75rem",
                    background: bulkUpdating ? "rgba(99,102,241,0.20)" : "rgba(99,102,241,0.18)",
                    color: bulkUpdating ? "rgba(129,140,248,0.50)" : "#818cf8",
                    border: "1px solid rgba(99,102,241,0.35)",
                    cursor: bulkUpdating ? "wait" : "pointer",
                    borderRadius: "0 0.125rem 0.125rem 0",
                    transition: "all 0.15s",
                  }}
                >
                  {bulkUpdating ? (
                    <><RefreshCw size={10} style={{ animation: "spin 1s linear infinite" }} /> Updating...</>
                  ) : (
                    <><ArrowRight size={10} /> Move {selectedIds.size}</>
                  )}
                </button>
              )}

              {/* Status dropdown */}
              {bulkStatusOpen && (
                <div
                  style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0,
                    background: "#0d0d0d", border: "1px solid rgba(99,102,241,0.35)",
                    borderRadius: "0.25rem", zIndex: 100, minWidth: "10rem",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                    overflow: "hidden",
                  }}
                >
                  {(Object.entries(STATUS_CONFIG) as [ProspectStatus, typeof STATUS_CONFIG[ProspectStatus]][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => { setBulkStatusTarget(key); setBulkStatusOpen(false); }}
                      style={{
                        display: "flex", alignItems: "center", gap: "0.5rem",
                        width: "100%", padding: "0.45rem 0.75rem",
                        fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
                        letterSpacing: "0.08em", textTransform: "uppercase",
                        color: cfg.color,
                        background: bulkStatusTarget === key ? "rgba(255,255,255,0.06)" : "transparent",
                        border: "none", cursor: "pointer", textAlign: "left",
                        borderLeft: bulkStatusTarget === key ? `2px solid ${cfg.color}` : "2px solid transparent",
                        transition: "background 0.1s",
                      }}
                    >
                      {cfg.icon} {cfg.label}
                      {bulkStatusTarget === key && <Check size={9} style={{ marginLeft: "auto" }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ flex: 1 }} />

            {/* Bulk progress indicator */}
            {bulkProgress && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: bulkProgress.failed > 0 ? "#f59e0b" : "#00ff87" }}>
                {bulkSending ? (
                  <><RefreshCw size={10} style={{ display: "inline", marginRight: 4, animation: "spin 1s linear infinite" }} />Sending...</>
                ) : (
                  <>{bulkProgress.sent} sent · {bulkProgress.failed} failed</>
                )}
              </span>
            )}

            <button
              onClick={handleBulkSend}
              disabled={bulkSending || selectedIds.size === 0}
              style={{
                display: "flex", alignItems: "center", gap: "0.4rem",
                fontFamily: "var(--font-mono)", fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase",
                padding: "0.45rem 1.1rem",
                background: bulkSending ? "rgba(245,158,11,0.30)" : "#f59e0b",
                color: bulkSending ? "#f59e0b" : "#000",
                border: "none",
                cursor: bulkSending ? "wait" : "pointer",
                borderRadius: "0.125rem",
                transition: "all 0.15s",
                opacity: bulkSending ? 0.7 : 1,
              }}
            >
              {bulkSending ? (
                <><RefreshCw size={11} style={{ animation: "spin 1s linear infinite" }} /> Sending {selectedIds.size}...</>
              ) : (
                <><Zap size={11} /> Send Email to {selectedIds.size} Contact{selectedIds.size !== 1 ? "s" : ""}</>
              )}
            </button>
          </div>
        )}

        {/* Bulk result summary */}
        {!bulkSending && bulkResults.length > 0 && (
          <div style={{
            padding: "1rem 1.25rem",
            border: "1px solid rgba(0,255,135,0.15)",
            borderRadius: "0.25rem",
            marginBottom: "1.5rem",
            background: "rgba(0,255,135,0.03)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#00ff87", margin: 0 }}>
                Bulk Send Complete — {bulkResults.filter(r => r.success).length} sent · {bulkResults.filter(r => !r.success).length} failed
              </p>
              <button onClick={() => setBulkResults([])} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.30)", padding: 0 }}>
                <X size={12} />
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
              {bulkResults.map(r => (
                <span key={r.id} style={{
                  fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.06em",
                  padding: "0.15rem 0.4rem", borderRadius: "0.125rem",
                  border: `1px solid ${r.success ? "rgba(0,255,135,0.25)" : "rgba(239,68,68,0.30)"}`,
                  color: r.success ? "#00ff87" : "#f87171",
                }}
                title={r.error}>
                  {r.success ? "✓" : "✗"} {r.company}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Kanban View */}
        {!isLoading && viewMode === "kanban" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem", paddingBottom: "2rem" }}>
            {(["new", "contacted", "responded", "scheduled", "converted", "not_interested"] as ProspectStatus[]).map(col => {
              const colProspects = sortedProspects.filter(p => p.status === col);
              const cfg = STATUS_CONFIG[col];
              return (
                <div key={col} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {/* Column header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0.75rem", borderBottom: `2px solid ${cfg.color}`, marginBottom: "0.25rem" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: cfg.color, display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      {cfg.icon} {cfg.label}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: "rgba(255,255,255,0.30)" }}>{colProspects.length}</span>
                  </div>
                  {/* Cards */}
                  {colProspects.length === 0 ? (
                    <div style={{ padding: "1rem 0.75rem", border: "1px dashed rgba(255,255,255,0.06)", borderRadius: "0.25rem", textAlign: "center" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", color: "rgba(255,255,255,0.20)" }}>empty</span>
                    </div>
                  ) : colProspects.map(p => {
                    const followUp = (p as Record<string, unknown>).followUpDate ? new Date(String((p as Record<string, unknown>).followUpDate)) : null;
                    const isOverdue = followUp && followUp < new Date() && col !== "responded" && col !== "converted";
                    return (
                      <div key={p.id} style={{
                        padding: "0.75rem",
                        background: "rgba(255,255,255,0.025)",
                        border: `1px solid ${isOverdue ? "rgba(245,158,11,0.35)" : "rgba(255,255,255,0.07)"}`,
                        borderRadius: "0.25rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.35rem",
                        cursor: "pointer",
                        transition: "border-color 0.15s",
                      }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{p.company}</span>
                        {p.contactName && <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", color: "rgba(255,255,255,0.45)" }}>{p.contactName}</span>}
                        {p.contactEmail && <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", color: "#f59e0b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.contactEmail}</span>}
                        {followUp && (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.45rem", color: isOverdue ? "#f59e0b" : "rgba(255,255,255,0.30)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            <Calendar size={8} /> {followUp.toLocaleDateString("en-US", { month: "short", day: "numeric" })}{isOverdue ? " ⚠" : ""}
                          </span>
                        )}
                        {/* Quick status change buttons */}
                        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                          {col !== "contacted" && col !== "converted" && col !== "not_interested" && (
                            <button
                              onClick={() => updateProspect.mutate({ id: p.id, status: "contacted" })}
                              style={{ fontFamily: "var(--font-mono)", fontSize: "0.4rem", letterSpacing: "0.06em", textTransform: "uppercase", padding: "0.15rem 0.4rem", border: "1px solid rgba(245,158,11,0.30)", color: "#f59e0b", background: "transparent", cursor: "pointer", borderRadius: "0.125rem" }}
                            >→ Contacted</button>
                          )}
                          {col !== "responded" && col !== "converted" && col !== "not_interested" && (
                            <button
                              onClick={() => markReplied.mutate({ id: p.id })}
                              style={{ fontFamily: "var(--font-mono)", fontSize: "0.4rem", letterSpacing: "0.06em", textTransform: "uppercase", padding: "0.15rem 0.4rem", border: "1px solid rgba(0,255,135,0.30)", color: "#00ff87", background: "transparent", cursor: "pointer", borderRadius: "0.125rem" }}
                            >✓ Replied</button>
                          )}
                          {col === "responded" && (
                            <button
                              onClick={() => updateProspect.mutate({ id: p.id, status: "converted" })}
                              style={{ fontFamily: "var(--font-mono)", fontSize: "0.4rem", letterSpacing: "0.06em", textTransform: "uppercase", padding: "0.15rem 0.4rem", border: "1px solid rgba(167,139,250,0.40)", color: "#a78bfa", background: "transparent", cursor: "pointer", borderRadius: "0.125rem" }}
                            >★ Convert</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* By Show View */}
        {!isLoading && viewMode === "byshow" && (() => {
          // Group prospects by show name
          const showGroups: Record<string, typeof sortedProspects> = {};
          sortedProspects.forEach(p => {
            const shows: string[] = Array.isArray(p.shows) ? (p.shows as string[]) : [];
            if (shows.length === 0) {
              showGroups["No Show Assigned"] = showGroups["No Show Assigned"] ?? [];
              showGroups["No Show Assigned"].push(p);
            } else {
              shows.forEach(show => {
                showGroups[show] = showGroups[show] ?? [];
                showGroups[show].push(p);
              });
            }
          });
          const sortedShows = Object.entries(showGroups).sort(([a], [b]) => {
            if (a === "No Show Assigned") return 1;
            if (b === "No Show Assigned") return -1;
            return a.localeCompare(b);
          });
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem", paddingBottom: "3rem" }}>
              {sortedShows.map(([showName, showProspects]) => {
                const contacted = showProspects.filter(p => p.status !== "new" && p.status !== "not_interested").length;
                const converted = showProspects.filter(p => p.status === "converted").length;
                const uncontacted = showProspects.filter(p => p.status === "new").length;
                const showIds = showProspects.map(p => p.id);
                const allShowSelected = showIds.length > 0 && showIds.every(id => selectedIds.has(id));
                return (
                  <div key={showName}>
                    {/* Show group header */}
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "0.75rem 1rem",
                      background: "rgba(0,255,135,0.04)",
                      border: "1px solid rgba(0,255,135,0.15)",
                      borderRadius: "0.25rem 0.25rem 0 0",
                      borderBottom: "none",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <button
                          onClick={() => {
                            const next = new Set(Array.from(selectedIds));
                            if (allShowSelected) showIds.forEach(id => next.delete(id));
                            else showIds.forEach(id => next.add(id));
                            setSelectedIds(next);
                          }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: allShowSelected ? "#f59e0b" : "rgba(255,255,255,0.25)", padding: 0, display: "flex", alignItems: "center" }}
                        >
                          {allShowSelected ? <CheckSquare size={13} /> : <Square size={13} />}
                        </button>
                        <div>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 700, color: "#00ff87", letterSpacing: "-0.01em" }}>
                            {showName}
                          </span>
                          <div style={{ display: "flex", gap: "1rem", marginTop: "0.2rem" }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", color: "rgba(255,255,255,0.40)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                              {showProspects.length} companies
                            </span>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", color: "#f59e0b", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                              {contacted} contacted
                            </span>
                            {uncontacted > 0 && (
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", color: "rgba(255,255,255,0.30)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                                {uncontacted} new
                              </span>
                            )}
                            {converted > 0 && (
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", color: "#a78bfa", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                                {converted} converted
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Group-level bulk send button */}
                      {uncontacted > 0 && (
                        <button
                          onClick={() => {
                            const newIds = showProspects.filter(p => p.status === "new" && p.contactEmail).map(p => p.id);
                            if (newIds.length === 0) { toast.info("No new prospects with emails in this show"); return; }
                            setSelectedIds(new Set(newIds));
                            toast.info(`${newIds.length} new prospects selected — click Send in the toolbar`);
                          }}
                          style={{
                            display: "flex", alignItems: "center", gap: "0.35rem",
                            fontFamily: "var(--font-mono)", fontSize: "0.5625rem", fontWeight: 700,
                            letterSpacing: "0.08em", textTransform: "uppercase",
                            padding: "0.35rem 0.75rem",
                            background: "rgba(0,255,135,0.10)",
                            color: "#00ff87",
                            border: "1px solid rgba(0,255,135,0.30)",
                            cursor: "pointer", borderRadius: "0.125rem",
                          }}
                        >
                          <Zap size={10} /> Select {uncontacted} New
                        </button>
                      )}
                    </div>
                    {/* Prospect rows for this show */}
                    <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0 0 0.25rem 0.25rem", overflow: "hidden" }}>
                      {showProspects.map((p, idx) => {
                        const statusCfg = STATUS_CONFIG[p.status as ProspectStatus] ?? STATUS_CONFIG.new;
                        const conf = String((p as Record<string, unknown>).emailConfidence ?? "");
                        const confColor = CONFIDENCE_COLORS[conf] ?? "rgba(255,255,255,0.25)";
                        return (
                          <div key={p.id} style={{
                            display: "grid",
                            gridTemplateColumns: "1.5rem 2fr 1.5fr 1fr 1fr auto",
                            gap: "1rem",
                            alignItems: "center",
                            padding: "0.65rem 1rem",
                            borderBottom: idx < showProspects.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                            background: selectedIds.has(p.id) ? "rgba(245,158,11,0.04)" : "transparent",
                            transition: "background 0.1s",
                          }}>
                            {/* Checkbox */}
                            <button
                              onClick={() => toggleRow(p.id)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: selectedIds.has(p.id) ? "#f59e0b" : "rgba(255,255,255,0.20)", padding: 0, display: "flex", alignItems: "center" }}
                            >
                              {selectedIds.has(p.id) ? <CheckSquare size={12} /> : <Square size={12} />}
                            </button>
                            {/* Company + contact */}
                            <div>
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 700, color: "#fff" }}>{p.company}</span>
                              {p.contactName && (
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", color: "rgba(255,255,255,0.50)", marginTop: "0.1rem" }}>
                                  {p.contactName}{p.contactTitle ? ` · ${p.contactTitle}` : ""}
                                </div>
                              )}
                            </div>
                            {/* Email */}
                            <div>
                              {p.contactEmail ? (
                                <a href={`mailto:${p.contactEmail}`} style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", color: confColor, textDecoration: "none" }}>
                                  {p.contactEmail}
                                </a>
                              ) : (
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", color: "rgba(255,255,255,0.20)" }}>no email</span>
                              )}
                            </div>
                            {/* Robot */}
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", color: "rgba(255,255,255,0.55)" }}>
                              {(p as Record<string, unknown>).robotName ? String((p as Record<string, unknown>).robotName) : "—"}
                            </div>
                            {/* Status */}
                            <div>
                              <span style={{
                                fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.08em", textTransform: "uppercase",
                                padding: "0.15rem 0.45rem", borderRadius: "0.125rem",
                                border: `1px solid ${statusCfg.color}40`,
                                color: statusCfg.color,
                                background: `${statusCfg.color}10`,
                              }}>
                                {statusCfg.label}
                              </span>
                            </div>
                            {/* Quick actions */}
                            <div style={{ display: "flex", gap: "0.35rem" }}>
                              {p.status === "new" && p.contactEmail && (
                                <button
                                  onClick={() => { setSendingId(p.id); sendEmail.mutate({ prospectId: p.id }); }}
                                  disabled={sendingId === p.id || sentIds.has(p.id)}
                                  style={{
                                    fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.06em", textTransform: "uppercase",
                                    padding: "0.2rem 0.55rem",
                                    border: sentIds.has(p.id) ? "1px solid rgba(0,255,135,0.40)" : "1px solid rgba(245,158,11,0.40)",
                                    color: sentIds.has(p.id) ? "#00ff87" : "#f59e0b",
                                    background: "transparent", cursor: sendingId === p.id ? "wait" : "pointer", borderRadius: "0.125rem",
                                  }}
                                >
                                  {sentIds.has(p.id) ? "✓ Sent" : sendingId === p.id ? "..." : "Send"}
                                </button>
                              )}
                              {p.status !== "new" && p.status !== "converted" && p.status !== "not_interested" && (
                                <button
                                  onClick={() => markReplied.mutate({ id: p.id })}
                                  style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.06em", textTransform: "uppercase", padding: "0.2rem 0.55rem", border: "1px solid rgba(0,255,135,0.30)", color: "#00ff87", background: "transparent", cursor: "pointer", borderRadius: "0.125rem" }}
                                >
                                  ✓ Replied
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Table */}
        {viewMode === "kanban" || viewMode === "byshow" ? null : isLoading ? (
          <div style={{ textAlign: "center", padding: "4rem 0", color: "rgba(255,255,255,0.30)", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
            Loading prospects...
          </div>
        ) : prospects.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 0", color: "rgba(255,255,255,0.30)", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
            No prospects found.
          </div>
        ) : (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            {/* Table header row with Select All */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1.5rem 2fr 1.5fr 1fr 1fr 1fr 3.5rem auto",
              gap: "1.5rem",
              alignItems: "center",
              padding: "0.5rem 0",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              marginBottom: "0.25rem",
            }}>
              <button
                onClick={toggleAll}
                style={{ background: "none", border: "none", cursor: "pointer", color: allSelected ? "#f59e0b" : "rgba(255,255,255,0.25)", padding: 0, display: "flex", alignItems: "center" }}
                title={allSelected ? "Deselect all" : "Select all"}
              >
                {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
              </button>
              <button onClick={() => toggleSort("company")} style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.12em", textTransform: "uppercase", color: sortKey === "company" ? "rgba(255,255,255,0.60)" : "rgba(255,255,255,0.20)", padding: 0 }}>
                Company / Robot
                {sortKey === "company" ? (sortDir === "asc" ? <ArrowUp size={9} /> : <ArrowDown size={9} />) : <ArrowUpDown size={9} style={{ opacity: 0.4 }} />}
              </button>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.20)" }}>Shows</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.20)" }}>LV</span>
              <button onClick={() => toggleSort("status")} style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.12em", textTransform: "uppercase", color: sortKey === "status" ? "rgba(255,255,255,0.60)" : "rgba(255,255,255,0.20)", padding: 0 }}>
                Status
                {sortKey === "status" ? (sortDir === "asc" ? <ArrowUp size={9} /> : <ArrowDown size={9} />) : <ArrowUpDown size={9} style={{ opacity: 0.4 }} />}
              </button>
              <button onClick={() => toggleSort("followUpDate")} style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.12em", textTransform: "uppercase", color: sortKey === "followUpDate" ? "rgba(255,255,255,0.60)" : "rgba(255,255,255,0.20)", padding: 0 }}>
                Follow-up
                {sortKey === "followUpDate" ? (sortDir === "asc" ? <ArrowUp size={9} /> : <ArrowDown size={9} />) : <ArrowUpDown size={9} style={{ opacity: 0.4 }} />}
              </button>
              <button onClick={() => toggleSort("engagementScore")} style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.12em", textTransform: "uppercase", color: sortKey === "engagementScore" ? "rgba(245,158,11,0.80)" : "rgba(255,255,255,0.20)", padding: 0 }}>
                Score
                {sortKey === "engagementScore" ? (sortDir === "asc" ? <ArrowUp size={9} /> : <ArrowDown size={9} />) : <ArrowUpDown size={9} style={{ opacity: 0.4 }} />}
              </button>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.20)" }}>Action</span>
            </div>

            {sortedProspects.map((p, i) => {
              const cfg = STATUS_CONFIG[p.status as ProspectStatus] ?? STATUS_CONFIG.new;
              const isExpanded = expandedId === p.id;
              const shows = (p.shows as string[] | null) ?? [];
              const isSelected = selectedIds.has(p.id);
              const isSent = sentIds.has(p.id);
              const isFailed = failedIds.has(p.id);
              const conf = String((p as Record<string, unknown>).emailConfidence ?? "");
              const urgency = getUrgency(shows);

              return (
                <div
                  key={p.id}
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    background: isSent && bulkResults.some(r => r.id === p.id && r.success)
                      ? "rgba(0,255,135,0.03)"
                      : isFailed && bulkResults.some(r => r.id === p.id && !r.success)
                      ? "rgba(239,68,68,0.03)"
                      : isSelected
                      ? "rgba(245,158,11,0.03)"
                      : "transparent",
                    transition: "background 0.2s",
                  }}
                >
                  {/* Main row */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.5rem 2fr 1.5fr 1fr 1fr 1fr 3.5rem auto",
                      gap: "1.5rem",
                      alignItems: "center",
                      padding: "1rem 0",
                      cursor: "pointer",
                    }}
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  >
                    {/* Checkbox */}
                    <div onClick={e => { e.stopPropagation(); toggleRow(p.id); }} style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
                      {isSelected
                        ? <CheckSquare size={14} style={{ color: "#f59e0b" }} />
                        : <Square size={14} style={{ color: "rgba(255,255,255,0.20)" }} />
                      }
                    </div>

                    {/* Company + robot */}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", color: "rgba(255,255,255,0.20)", minWidth: "1.5rem" }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#fff" }}>{p.company}</span>
                        {urgency && (
                          <span style={{
                            fontFamily: "var(--font-mono)", fontSize: "0.45rem", letterSpacing: "0.08em", textTransform: "uppercase",
                            padding: "0.1rem 0.35rem", borderRadius: "0.125rem",
                            border: `1px solid ${urgency.color}40`,
                            color: urgency.color,
                            fontWeight: 700,
                          }} title={`${urgency.days} days until next show`}>
                            {urgency.label}
                          </span>
                        )}
                        {p.website && (
                          <a href={p.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                            style={{ color: "rgba(255,255,255,0.25)", lineHeight: 1 }}>
                            <ExternalLink size={11} />
                          </a>
                        )}
                        {p.contactEmail && conf && (
                          <span style={{
                            fontFamily: "var(--font-mono)", fontSize: "0.45rem", letterSpacing: "0.08em", textTransform: "uppercase",
                            padding: "0.1rem 0.3rem", borderRadius: "0.125rem",
                            border: `1px solid ${CONFIDENCE_BORDERS[conf] ?? "rgba(255,255,255,0.12)"}`,
                            color: CONFIDENCE_COLORS[conf] ?? "rgba(255,255,255,0.30)",
                          }}>
                            {conf}
                          </span>
                        )}
                      </div>
                      {p.robotName && (
                        <p style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.50)", margin: "0.2rem 0 0 2rem" }}>
                          {p.robotName}
                          {p.robotType && <span style={{ color: "rgba(255,255,255,0.25)", marginLeft: "0.5rem" }}>· {ROBOT_TYPE_LABELS[p.robotType] ?? p.robotType}</span>}
                        </p>
                      )}
                    </div>

                    {/* Shows */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                      {shows.slice(0, 3).map(s => (
                        <span key={s} className="badge-stroke" style={{ fontSize: "0.5625rem" }}>{s}</span>
                      ))}
                      {shows.length > 3 && <span className="badge-stroke" style={{ fontSize: "0.5625rem" }}>+{shows.length - 3}</span>}
                    </div>

                    {/* LV status */}
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: p.attendsLasVegas === "yes" ? "#00ff87" : "rgba(255,255,255,0.25)" }}>
                      {p.attendsLasVegas === "yes" ? "LV ✓" : p.attendsLasVegas === "no" ? "LV ✗" : "LV ?"}
                    </div>

                    {/* Status */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: cfg.color, fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        {cfg.icon}
                        {cfg.label}
                      </div>
                      {p.status === "responded" && (p as Record<string, unknown>).repliedAt != null && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", color: "rgba(0,255,135,0.45)", letterSpacing: "0.04em" }}>
                          {formatRelativeTime(new Date(String((p as Record<string, unknown>).repliedAt)))}
                        </span>
                      )}
                    </div>

                    {/* Follow-up date */}
                    <div onClick={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      {editingFollowUpId === p.id ? (
                        <input
                          autoFocus
                          type="date"
                          defaultValue={(p as Record<string, unknown>).followUpDate ? new Date(String((p as Record<string, unknown>).followUpDate)).toISOString().slice(0,10) : ""}
                          onBlur={e => {
                            updateProspect.mutate({ id: p.id, followUpDate: e.target.value || null });
                            setEditingFollowUpId(null);
                          }}
                          onKeyDown={e => { if (e.key === "Escape") setEditingFollowUpId(null); }}
                          style={{
                            fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
                            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.20)",
                            color: "#fff", padding: "0.25rem 0.4rem", borderRadius: "0.125rem",
                            outline: "none", width: "8rem",
                          }}
                        />
                      ) : (p as Record<string, unknown>).followUpDate ? (
                        <button
                          onClick={() => setEditingFollowUpId(p.id)}
                          title="Edit follow-up date"
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
                        >
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", color: new Date(String((p as Record<string, unknown>).followUpDate)) < new Date() ? "#f87171" : "#f59e0b", letterSpacing: "0.04em" }}>
                            <Calendar size={9} style={{ display: "inline", marginRight: "0.25rem", verticalAlign: "middle" }} />
                            {new Date(String((p as Record<string, unknown>).followUpDate)).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setEditingFollowUpId(p.id)}
                          title="Set follow-up date"
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: "0.2rem" }}
                        >
                          <Calendar size={9} style={{ color: "rgba(255,255,255,0.15)" }} />
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.45rem", color: "rgba(255,255,255,0.15)", letterSpacing: "0.06em" }}>Set</span>
                        </button>
                      )}
                    </div>

                    {/* Engagement score */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      {(() => {
                        const score = Number((p as Record<string, unknown>).engagementScore ?? 0);
                        const opens = Number((p as Record<string, unknown>).opens ?? 0);
                        const clicks = Number((p as Record<string, unknown>).clicks ?? 0);
                        if (score === 0) return <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", color: "rgba(255,255,255,0.15)" }}>—</span>;
                        return (
                          <span title={`${opens} open${opens !== 1 ? 's' : ''}, ${clicks} click${clicks !== 1 ? 's' : ''}`} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            <span style={{ fontSize: "0.625rem" }}>🔥</span>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", fontWeight: 700, color: score >= 5 ? "#f59e0b" : score >= 2 ? "#fbbf24" : "rgba(251,191,36,0.60)" }}>{score}</span>
                          </span>
                        );
                      })()}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          if (isSent || p.status === "contacted") return;
                          setSendingId(p.id);
                          sendEmail.mutate({ prospectId: p.id });
                        }}
                        disabled={sendingId === p.id || isSent || p.status === "contacted"}
                        style={{
                          display: "flex", alignItems: "center", gap: "0.3rem",
                          fontFamily: "var(--font-mono)", fontSize: "0.5625rem", letterSpacing: "0.08em", textTransform: "uppercase",
                          padding: "0.3rem 0.65rem",
                          border: `1px solid ${isSent || p.status === "contacted" ? "rgba(0,255,135,0.30)" : isFailed ? "rgba(239,68,68,0.40)" : "rgba(245,158,11,0.40)"}`,
                          color: isSent || p.status === "contacted" ? "#00ff87" : isFailed ? "#f87171" : "#f59e0b",
                          background: "transparent", cursor: sendingId === p.id ? "wait" : "pointer",
                          borderRadius: "0.125rem", opacity: sendingId === p.id ? 0.6 : 1,
                          transition: "all 0.15s",
                        }}
                      >
                        {sendingId === p.id ? (
                          <RefreshCw size={10} style={{ animation: "spin 1s linear infinite" }} />
                        ) : isSent || p.status === "contacted" ? (
                          <><Check size={10} /> Sent</>
                        ) : isFailed ? (
                          <><X size={10} /> Failed</>
                        ) : (
                          <><Mail size={10} /> Send</>
                        )}
                      </button>
                      {/* Mark as Replied — only shown when status is new or contacted */}
                      {(p.status === "new" || p.status === "contacted") && (
                        <button
                          onClick={() => markReplied.mutate({ id: p.id })}
                          disabled={replyingId === p.id}
                          title="Mark as Replied"
                          style={{
                            display: "flex", alignItems: "center", gap: "0.3rem",
                            fontFamily: "var(--font-mono)", fontSize: "0.5625rem", letterSpacing: "0.08em", textTransform: "uppercase",
                            padding: "0.3rem 0.65rem",
                            border: "1px solid rgba(0,255,135,0.35)",
                            color: "#00ff87",
                            background: "transparent",
                            cursor: replyingId === p.id ? "wait" : "pointer",
                            borderRadius: "0.125rem",
                            opacity: replyingId === p.id ? 0.5 : 1,
                            transition: "all 0.15s",
                          }}
                        >
                          {replyingId === p.id
                            ? <RefreshCw size={10} style={{ animation: "spin 1s linear infinite" }} />
                            : <><Check size={10} /> Replied</>
                          }
                        </button>
                      )}
                      {/* Inline reply notes prompt — appears after Mark as Replied */}
                      {replyNotes[p.id] !== undefined && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }} onClick={e => e.stopPropagation()}>
                          <input
                            autoFocus
                            type="text"
                            placeholder="Add reply note… (Enter to save)"
                            value={replyNotes[p.id]}
                            onChange={e => setReplyNotes(prev => ({ ...prev, [p.id]: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === "Enter") { e.preventDefault(); saveReplyNote(p.id); }
                              if (e.key === "Escape") dismissReplyNote(p.id);
                            }}
                            style={{
                              fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
                              background: "rgba(0,255,135,0.06)", border: "1px solid rgba(0,255,135,0.30)",
                              color: "#fff", padding: "0.3rem 0.5rem", borderRadius: "0.125rem",
                              outline: "none", width: "14rem",
                            }}
                          />
                          <button onClick={() => saveReplyNote(p.id)} title="Save note" style={{ background: "none", border: "none", cursor: "pointer", color: "#00ff87", padding: "0.2rem", lineHeight: 1 }}>
                            <Check size={11} />
                          </button>
                          <button onClick={() => dismissReplyNote(p.id)} title="Dismiss" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.30)", padding: "0.2rem", lineHeight: 1 }}>
                            <X size={11} />
                          </button>
                        </div>
                      )}
                      <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.25)", transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <ProspectCRMCard
                      prospect={p}
                      onStatusChange={(id, status) => {
                        // Optimistically update local state by invalidating
                        void utils.prospects.list.invalidate();
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CSV Import Preview Modal */}
      {csvPreview && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.80)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
        }} onClick={() => setCsvPreview(null)}>
          <div style={{
            background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.5rem",
            padding: "2rem", maxWidth: "48rem", width: "100%", maxHeight: "80vh", overflow: "auto",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <div>
                <h2 style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>Import Preview</h2>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: "rgba(255,255,255,0.40)", margin: "0.25rem 0 0" }}>
                  {csvPreview.length} prospect{csvPreview.length !== 1 ? "s" : ""} detected
                </p>
              </div>
              <button onClick={() => setCsvPreview(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.40)" }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginBottom: "1rem" }}>
              {csvPreview.slice(0, 10).map((r, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "2fr 1.5fr 2fr", gap: "1rem",
                  padding: "0.6rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)",
                  fontFamily: "var(--font-mono)", fontSize: "0.625rem",
                }}>
                  <span style={{ color: "#fff", fontWeight: 600 }}>{r.company}</span>
                  <span style={{ color: "rgba(255,255,255,0.50)" }}>{r.contactName ?? "—"}</span>
                  <span style={{ color: "#f59e0b" }}>{r.contactEmail ?? "—"}</span>
                </div>
              ))}
              {csvPreview.length > 10 && (
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", color: "rgba(255,255,255,0.30)", padding: "0.5rem 0", margin: 0 }}>
                  + {csvPreview.length - 10} more…
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setCsvPreview(null)}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.08em", textTransform: "uppercase",
                  padding: "0.5rem 1.25rem", border: "1px solid rgba(255,255,255,0.15)",
                  color: "rgba(255,255,255,0.50)", background: "transparent", cursor: "pointer", borderRadius: "0.25rem",
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmCsvImport}
                disabled={csvImporting}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.08em", textTransform: "uppercase",
                  padding: "0.5rem 1.25rem", border: "1px solid rgba(245,158,11,0.50)",
                  color: "#f59e0b", background: "rgba(245,158,11,0.08)", cursor: csvImporting ? "wait" : "pointer",
                  borderRadius: "0.25rem", opacity: csvImporting ? 0.6 : 1,
                }}
              >
                {csvImporting ? "Importing…" : `Import ${csvPreview.length} Prospects`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
