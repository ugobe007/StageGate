import React, { useState, useEffect, useRef } from "react";
import { useSearch, useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import ProspectCRMCard from "@/components/ProspectCRMCard";
import { ExternalLink, Mail, RefreshCw, ChevronDown, Check, X, Clock, Phone, AlertCircle, Square, CheckSquare, Zap, ArrowUpDown, ArrowUp, ArrowDown, Download, Upload, Calendar, ArrowRight, Send } from "lucide-react";

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
  new:            { label: "New",           color: "#3b82f6",  icon: <AlertCircle size={11} /> },
  contacted:      { label: "Contacted",     color: "#f59e0b",  icon: <Mail size={11} /> },
  responded:      { label: "Responded",     color: "#00ff87",  icon: <Check size={11} /> },
  scheduled:      { label: "Scheduled",     color: "#8b5cf6",  icon: <Phone size={11} /> },
  converted:      { label: "Converted",     color: "#00ff87",  icon: <Check size={11} /> },
  not_interested: { label: "Not Interested",color: "rgba(255,255,255,0.30)",  icon: <X size={11} /> },
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
  high: "rgba(62,207,142,0.80)",
  medium: "#f59e0b",
  low: "rgba(255,255,255,0.30)",
};

const CONFIDENCE_BORDERS: Record<string, string> = {
  verified: "rgba(62,207,142,0.35)",
  high: "rgba(62,207,142,0.20)",
  medium: "rgba(245,158,11,0.30)",
  low: "rgba(255,255,255,0.08)",
};

export default function AdminProspects() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();

  // ?highlight=email — deep-link from AdminServiceRequests
  const search = useSearch();
  const highlightEmail = new URLSearchParams(search).get("highlight") ?? "";
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const [statusFilter, setStatusFilter] = useState<string>("new");
  const [hideContacted, setHideContacted] = useState(false);
  const [hotFilter, setHotFilter] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());
  const [failedIds, setFailedIds] = useState<Set<number>>(new Set());
  const [selectedProspectId, setSelectedProspectId] = useState<number | null>(null);
  const [generatingDrafts, setGeneratingDrafts] = useState(false);

  const generateDraftsMutation = trpc.admin.generateDrafts.useMutation({
    onSuccess: (res) => {
      const r = res.result as { generated?: number; skipped?: number; conversationsSeeded?: number; errors?: string[] } | undefined;
      const generated = r?.generated ?? 0;
      const seeded = r?.conversationsSeeded ?? 0;
      let msg = `Cal drafted ${generated} email${generated !== 1 ? "s" : ""}`;
      if (seeded > 0) msg += ` · queued ${seeded} new prospect${seeded !== 1 ? "s" : ""} for follow-ups`;
      toast.success(msg);
      void utils.prospects.list.invalidate();
      setGeneratingDrafts(false);
    },
    onError: (e) => { toast.error(e.message); setGeneratingDrafts(false); },
  });
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

  const [enrichingPartners, setEnrichingPartners] = useState(false);
  const triggerPartnerEnrichment = trpc.prospects.triggerPartnerEnrichment.useMutation({
    onSuccess: (data) => {
      const result = (data as Record<string, unknown>)?.result as Record<string, unknown> | undefined;
      const started = result?.started ?? 0;
      toast.success(`Partner enrichment started for ${started} prospects`);
      setEnrichingPartners(false);
    },
    onError: (err) => { toast.error(err.message); setEnrichingPartners(false); },
  });

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

  const { data: draftCount } = trpc.admin.getDraftCount.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
    refetchInterval: 30_000,
  });

  // Scroll to and highlight the row matching ?highlight=email
  useEffect(() => {
    if (!highlightEmail || !data?.prospects) return;
    const match = data.prospects.find(
      p => (p.contactEmail ?? "").toLowerCase() === highlightEmail.toLowerCase()
    );
    if (!match) return;
    setHighlightedId(match.id);
    // Give the DOM a tick to render
    requestAnimationFrame(() => {
      const el = rowRefs.current.get(match.id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    // Remove the highlight ring after 3 s
    const timer = setTimeout(() => setHighlightedId(null), 3000);
    return () => clearTimeout(timer);
  }, [highlightEmail, data?.prospects]);

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

  // Draft review modal state
  const [draftReviewId, setDraftReviewId] = useState<number | null>(null);
  const [draftReviewSubject, setDraftReviewSubject] = useState("");
  const [draftReviewBody, setDraftReviewBody] = useState("");
  const [draftReviewDraftId, setDraftReviewDraftId] = useState<number | null>(null);
  const [draftReviewEditing, setDraftReviewEditing] = useState(false);
  const [draftGeneratingId, setDraftGeneratingId] = useState<number | null>(null);

  const { data: reviewDrafts } = trpc.admin.getDraftsForProspect.useQuery(
    { prospectId: draftReviewId! },
    { enabled: draftReviewId !== null }
  );

  const openDraftReview = (prospectId: number) => {
    setDraftReviewId(prospectId);
    setDraftReviewEditing(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!reviewDrafts || reviewDrafts.length === 0) {
      setDraftReviewSubject("");
      setDraftReviewBody("");
      setDraftReviewDraftId(null);
      return;
    }
    const draft = (reviewDrafts as Array<{status: string; subject: string; body: string; id: number}>).find(d => d.status === "approved") ??
                  (reviewDrafts as Array<{status: string; subject: string; body: string; id: number}>).find(d => d.status === "pending") ??
                  (reviewDrafts as Array<{status: string; subject: string; body: string; id: number}>)[0];
    setDraftReviewSubject(draft.subject ?? "");
    setDraftReviewBody(draft.body ?? "");
    setDraftReviewDraftId(draft.id);
  }, [reviewDrafts]);

  const generateDraftMutation = trpc.prospects.regenerateDraft.useMutation({
    onSuccess: (data, vars) => {
      setDraftGeneratingId(null);
      createDraftMutation.mutate({ prospectId: vars.id, subject: data.subject ?? "StageGate — Let's Talk Robots", body: data.draft });
    },
    onError: () => setDraftGeneratingId(null),
  });

  const createDraftMutation = trpc.admin.createDraft.useMutation({
    onSuccess: () => {
      if (draftReviewId) void utils.admin.getDraftsForProspect.invalidate({ prospectId: draftReviewId });
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const approveDraftMutation = trpc.admin.approveDraft.useMutation({
    onSuccess: () => { if (draftReviewId) void utils.admin.getDraftsForProspect.invalidate({ prospectId: draftReviewId }); },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const editDraftMutation = trpc.admin.editDraft.useMutation({
    onSuccess: () => {
      setDraftReviewEditing(false);
      if (draftReviewId) void utils.admin.getDraftsForProspect.invalidate({ prospectId: draftReviewId });
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const discardDraftMutation = trpc.admin.discardDraft.useMutation({
    onSuccess: () => {
      if (draftReviewId) void utils.admin.getDraftsForProspect.invalidate({ prospectId: draftReviewId });
      toast.success("Draft discarded");
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const sendDraftMutation = trpc.admin.sendDraft.useMutation({
    onSuccess: (data: { sentTo: string }) => {
      toast.success(`Email sent to ${data.sentTo}`);
      setDraftReviewId(null);
      refetch();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  // Reply notes inline state: prospectId → note text (undefined = not showing, string = showing)
  const [replyNotes, setReplyNotes] = useState<Record<number, string>>({});
  const [replyingId, setReplyingId] = useState<number | null>(null);

  // Schedule meeting modal state
  const [schedulingProspect, setSchedulingProspect] = useState<{ id: number; company: string; contactName?: string | null; contactEmail?: string | null } | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ proposedTime: "", durationMinutes: 30, notes: "" });

  const markReplied = trpc.prospects.markReplied.useMutation({
    onMutate: (vars) => {
      setReplyingId(vars.id);
    },
    onSuccess: (_, vars) => {
      setReplyingId(null);
      setSchedulingProspect(null);
      // After marking replied, show the inline notes prompt
      setReplyNotes(prev => ({ ...prev, [vars.id]: "" }));
      refetch();
    },
    onError: () => setReplyingId(null),
  });

  function openScheduleModal(p: { id: number; company: string; contactName?: string | null; contactEmail?: string | null }) {
    setSchedulingProspect(p);
    // Default to tomorrow 10am PT
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const offset = tomorrow.getTimezoneOffset() * 60000;
    setScheduleForm({ proposedTime: new Date(tomorrow.getTime() - offset).toISOString().slice(0, 16), durationMinutes: 30, notes: "" });
  }

  function confirmScheduleMeeting() {
    if (!schedulingProspect || !scheduleForm.proposedTime) return;
    markReplied.mutate({
      id: schedulingProspect.id,
      scheduleMeeting: true,
      proposedTime: new Date(scheduleForm.proposedTime).toISOString(),
      meetingDurationMinutes: scheduleForm.durationMinutes,
      meetingNotes: scheduleForm.notes || undefined,
    });
    toast.success(`Meeting scheduled for ${schedulingProspect.company}! Emails sent to Tommy & owner.`);
  }

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
      <div style={{ background: "#080808" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: "1.5rem" }}>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.875rem" }}>Admin access required</p>
          <a href={getLoginUrl()} style={{ padding: "0.5rem 1rem", background: "#00ff87", color: "#ececec", fontWeight: 600, borderRadius: "0.375rem", textDecoration: "none", fontSize: "0.875rem" }}>Sign In</a>
        </div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div style={{ background: "#080808" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.875rem" }}>Forbidden — admin only</p>
        </div>
      </div>
    );
  }

  // Hot count: prospects with engagementScore >= 3 across all statuses
  const hotCount = (data?.prospects ?? []).filter(p => Number((p as Record<string, unknown>).engagementScore ?? 0) >= 3).length;

  // Vendor type filter config
  const VENDOR_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
    robot_oem:    { label: "Robot OEM",     color: "#00ff87" },
    exhibit_house:{ label: "Exhibit House", color: "#60a5fa" },
    freight:      { label: "Freight",       color: "#f59e0b" },
    av_electrical:{ label: "AV / Elec",    color: "#a78bfa" },
    venue:        { label: "Venue",         color: "#fb923c" },
    agency:       { label: "Agency",        color: "#f472b6" },
    other:        { label: "Other",         color: "rgba(255,255,255,0.40)" },
  };

  const prospects = (data?.prospects ?? []).filter(p => {
    if (hotFilter && Number((p as Record<string, unknown>).engagementScore ?? 0) < 3) return false;
    if (hideContacted && statusFilter === "" && !hotFilter && p.status === "contacted") return false;
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

  // The prospect whose CRM card is showing in the right panel
  const selectedProspect = selectedProspectId !== null
    ? (prospects.find(p => p.id === selectedProspectId) ?? null)
    : null;

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
    <div style={{ background: "#080808", color: "#ececec", fontFamily: "'Inter','Space Grotesk',ui-sans-serif,system-ui,sans-serif" }}>
      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
        {/* Header */}
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "1.25rem", marginBottom: "1.5rem" }}>
          <p style={{ fontSize: "0.6875rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.30)", marginBottom: "0.375rem", fontWeight: 500 }}>
            OUTREACH
          </p>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <h1 style={{ fontSize: "1.125rem", fontWeight: 700, letterSpacing: "-0.01em", color: "#ececec", margin: 0 }}>
              Prospect Database
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.55)" }}>
                {prospects.length}{hideContacted && statusFilter === "" ? ` of ${(allData?.prospects ?? []).length}` : ""} prospects{hideContacted && statusFilter === "" ? " (contacted hidden)" : ""}
              </span>
              <button
                onClick={() => { setEnrichingPartners(true); triggerPartnerEnrichment.mutate(); }}
                disabled={enrichingPartners}
                title="Refresh partner contact data from Apollo"
                style={{
                  display: "flex", alignItems: "center", gap: "0.3rem",
                  fontSize: "0.8125rem", fontWeight: 500,
                  padding: "0.375rem 0.75rem",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: enrichingPartners ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.55)",
                  background: "#111111", cursor: enrichingPartners ? "not-allowed" : "pointer", borderRadius: "0.375rem",
                }}
              >
                <RefreshCw size={12} style={{ animation: enrichingPartners ? "spin 1s linear infinite" : "none" }} />
                {enrichingPartners ? "Enriching…" : "Enrich"}
              </button>
              <button
                onClick={exportCSV}
                title="Download CSV"
                style={{
                  display: "flex", alignItems: "center", gap: "0.3rem",
                  fontSize: "0.8125rem", fontWeight: 500,
                  padding: "0.375rem 0.75rem",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.55)",
                  background: "#111111", cursor: "pointer", borderRadius: "0.375rem",
                  transition: "all 0.1s",
                }}
              >
                <Download size={12} /> CSV
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
                  fontSize: "0.8125rem", fontWeight: 500,
                  padding: "0.375rem 0.75rem",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.55)",
                  background: "#111111", cursor: "pointer", borderRadius: "0.375rem",
                  transition: "all 0.1s",
                }}
              >
                <Upload size={12} /> Import
              </button>
              {/* View toggle */}
              <div style={{ display: "flex", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.375rem", overflow: "hidden" }}>
                <button
                  onClick={() => setViewMode("table")}
                  title="Table view"
                  style={{ padding: "0.375rem 0.5rem", background: viewMode === "table" ? "#1a1a1a" : "#111111", border: "none", cursor: "pointer", color: viewMode === "table" ? "#ececec" : "rgba(255,255,255,0.30)", borderRight: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                </button>
                <button
                  onClick={() => setViewMode("kanban")}
                  title="Kanban view"
                  style={{ padding: "0.375rem 0.5rem", background: viewMode === "kanban" ? "#1a1a1a" : "#111111", border: "none", cursor: "pointer", color: viewMode === "kanban" ? "#ececec" : "rgba(255,255,255,0.30)", borderRight: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="15" rx="1"/></svg>
                </button>
                <button
                  onClick={() => setViewMode("byshow")}
                  title="By Show view"
                  style={{ padding: "0.375rem 0.5rem", background: viewMode === "byshow" ? "#1a1a1a" : "#111111", border: "none", cursor: "pointer", color: viewMode === "byshow" ? "#00ff87" : "rgba(255,255,255,0.30)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>
                </button>
              </div>
              <button onClick={() => refetch()} style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "rgba(255,255,255,0.30)", padding: "0.375rem", borderRadius: "0.375rem", display: "flex", alignItems: "center" }}>
                <RefreshCw size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Outreach workflow — primary focus when you land here */}
        {(() => {
          const pendingDrafts = draftCount?.pending ?? 0;
          const approvedDrafts = draftCount?.approved ?? 0;
          const sentDrafts = draftCount?.sent ?? 0;
          const newCount = statusCounts["new"] ?? 0;
          const contactedCount = statusCounts["contacted"] ?? 0;
          const respondedCount = (statusCounts["responded"] ?? 0) + (statusCounts["scheduled"] ?? 0) + (statusCounts["converted"] ?? 0);

          const focusLine = pendingDrafts > 0
            ? `${pendingDrafts} draft${pendingDrafts !== 1 ? "s" : ""} waiting for your review`
            : approvedDrafts > 0
            ? `${approvedDrafts} approved — ready to send from Outreach`
            : newCount > 0
            ? `${newCount} new companies — Cal can draft a first note for each`
            : "Caught up — watch for replies";

          return (
            <div style={{
              marginBottom: "1.5rem",
              border: `1px solid ${pendingDrafts > 0 ? "rgba(251,191,36,0.35)" : "rgba(0,255,135,0.20)"}`,
              borderRadius: "0.5rem",
              background: pendingDrafts > 0 ? "rgba(251,191,36,0.04)" : "rgba(0,255,135,0.03)",
              padding: "1rem 1.25rem",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                <div style={{ flex: 1, minWidth: "16rem" }}>
                  <p style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: pendingDrafts > 0 ? "#fbbf24" : "#00ff87", margin: "0 0 0.35rem" }}>
                    Cal
                  </p>
                  <p style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#ececec", margin: 0, lineHeight: 1.4 }}>
                    {focusLine}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.40)", margin: "0.4rem 0 0" }}>
                    Draft with Cal · you review · you send
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    onClick={() => {
                      setGeneratingDrafts(true);
                      generateDraftsMutation.mutate({});
                    }}
                    disabled={generatingDrafts}
                    title="Have Cal draft intro emails for new prospects"
                    style={{
                      display: "flex", alignItems: "center", gap: "0.4rem",
                      fontSize: "0.8125rem", fontWeight: 600,
                      padding: "0.5rem 1rem",
                      border: "1px solid rgba(251,191,36,0.35)",
                      color: generatingDrafts ? "rgba(251,191,36,0.40)" : "#fbbf24",
                      background: generatingDrafts ? "rgba(251,191,36,0.04)" : "rgba(251,191,36,0.08)",
                      cursor: generatingDrafts ? "wait" : "pointer",
                      borderRadius: "0.375rem",
                      opacity: generatingDrafts ? 0.7 : 1,
                    }}
                  >
                    {generatingDrafts
                      ? <><RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> Drafting…</>
                      : <><Zap size={12} /> Draft with Cal</>
                    }
                  </button>
                  <button
                    onClick={() => setLocation("/admin/outreach")}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.4rem",
                      fontSize: "0.8125rem", fontWeight: 600,
                      padding: "0.5rem 1rem",
                      border: pendingDrafts > 0 ? "none" : "1px solid rgba(255,255,255,0.15)",
                      color: pendingDrafts > 0 ? "#080808" : "rgba(255,255,255,0.70)",
                      background: pendingDrafts > 0 ? "#fbbf24" : "transparent",
                      cursor: "pointer",
                      borderRadius: "0.375rem",
                    }}
                  >
                    <Mail size={13} />
                    Review drafts
                    {pendingDrafts > 0 && (
                      <span style={{ fontSize: "0.6875rem", fontWeight: 700, background: "rgba(8,8,8,0.20)", padding: "0.1rem 0.4rem", borderRadius: "9999px" }}>
                        {pendingDrafts}
                      </span>
                    )}
                  </button>
                </div>
              </div>
              <div style={{
                display: "flex", flexWrap: "wrap", gap: "1.25rem",
                marginTop: "0.875rem", paddingTop: "0.875rem",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                fontSize: "0.75rem", color: "rgba(255,255,255,0.45)",
              }}>
                <span><strong style={{ color: "#3b82f6" }}>{newCount}</strong> new</span>
                <span><strong style={{ color: "#f59e0b" }}>{contactedCount}</strong> contacted</span>
                <span><strong style={{ color: "#00ff87" }}>{respondedCount}</strong> replied</span>
                <span><strong style={{ color: "#fbbf24" }}>{pendingDrafts}</strong> drafts pending</span>
                <span><strong style={{ color: "#60a5fa" }}>{sentDrafts}</strong> sent</span>
              </div>
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
              fontSize: "0.8125rem",
              background: "#111111",
              border: `1px solid ${searchQuery ? "#00ff87" : "rgba(255,255,255,0.08)"}`,
              color: "#ececec",
              padding: "0.4375rem 2.25rem 0.4375rem 0.75rem",
              borderRadius: "0.375rem",
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
                color: "rgba(255,255,255,0.30)", padding: 0, lineHeight: 1,
              }}
            >
              <X size={13} />
            </button>
          ) : (
            <span style={{ position: "absolute", right: "0.7rem", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.30)", pointerEvents: "none", lineHeight: 1 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </span>
          )}
        </div>

        {/* Status filter tabs — Supabase underline style */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: "1.25rem", overflowX: "auto" }}>
          {["", "new", "contacted", "responded", "scheduled", "converted", "not_interested"].map(s => {
            const count = s === "" ? (allData?.prospects ?? []).length : (statusCounts[s] ?? 0);
            const isActive = statusFilter === s;
            const cfg = STATUS_CONFIG[s as ProspectStatus];
            const accentColor = s === "" ? "#ececec" : (cfg?.color ?? "rgba(255,255,255,0.55)");
            return (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setSelectedIds(new Set()); if (s !== "") setHideContacted(false); }}
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: isActive ? 500 : 400,
                  padding: "0.5rem 0.875rem",
                  border: "none",
                  borderBottom: isActive ? `2px solid ${accentColor}` : "2px solid transparent",
                  background: "transparent",
                  color: isActive ? accentColor : "rgba(255,255,255,0.55)",
                  cursor: "pointer",
                  whiteSpace: "nowrap" as const,
                  transition: "color 0.1s, border-color 0.1s",
                  marginBottom: "-1px",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                }}
              >
                {s === "" ? "All" : STATUS_CONFIG[s as ProspectStatus]?.label ?? s}
                {count > 0 && (
                  <span style={{ fontSize: "0.6875rem", color: isActive ? accentColor : "rgba(255,255,255,0.30)", fontVariantNumeric: "tabular-nums" }}>{count}</span>
                )}
              </button>
            );
          })}
          {/* Hot filter — inline tab style */}
          <button
            onClick={() => { setHotFilter(h => !h); setSelectedIds(new Set()); if (!hotFilter) setHideContacted(false); }}
            style={{
              fontSize: "0.8125rem",
              fontWeight: hotFilter ? 500 : 400,
              padding: "0.5rem 0.875rem",
              border: "none",
              borderBottom: hotFilter ? "2px solid #f59e0b" : "2px solid transparent",
              background: "transparent",
              color: hotFilter ? "#f59e0b" : "rgba(255,255,255,0.55)",
              cursor: "pointer",
              whiteSpace: "nowrap" as const,
              transition: "color 0.1s, border-color 0.1s",
              marginBottom: "-1px",
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
            }}
            title="Show only prospects with email engagement score ≥ 3"
          >
            🔥 Hot
            {hotCount > 0 && (
              <span style={{ fontSize: "0.6875rem", color: hotFilter ? "#f59e0b" : "rgba(255,255,255,0.30)", fontVariantNumeric: "tabular-nums" }}>{hotCount}</span>
            )}
          </button>

          {/* Hide Contacted quick-toggle */}
          {statusFilter === "" && !hotFilter && (
            <button
              onClick={() => { setHideContacted(h => !h); setSelectedIds(new Set()); }}
              style={{
                fontSize: "0.75rem",
                fontWeight: 500,
                padding: "0.25rem 0.625rem",
                border: `1px solid ${hideContacted ? "rgba(239,68,68,0.40)" : "rgba(255,255,255,0.08)"}`,
                background: hideContacted ? "rgba(239,68,68,0.06)" : "#111111",
                color: hideContacted ? "#ef4444" : "rgba(255,255,255,0.55)",
                cursor: "pointer",
                borderRadius: "0.25rem",
                transition: "all 0.1s",
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
            top: "0.5rem",
            zIndex: 40,
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
            padding: "0.625rem 1rem",
            background: "#111111",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "0.5rem",
            marginBottom: "1rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#ececec" }}>
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
                fontSize: "0.8125rem", fontWeight: 500,
                padding: "0.25rem 0.625rem",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.55)",
                background: "#111111", cursor: "pointer", borderRadius: "0.25rem",
              }}
            >
              <X size={12} /> Clear
            </button>

            {/* Bulk move-to-status: two-part control — status picker + confirm */}
            <div style={{ position: "relative", display: "flex", alignItems: "stretch", gap: 0 }}>
              {/* Status picker button */}
              <button
                onClick={() => setBulkStatusOpen(o => !o)}
                disabled={bulkUpdating}
                style={{
                  display: "flex", alignItems: "center", gap: "0.35rem",
                  fontSize: "0.8125rem", fontWeight: 500,
                  padding: "0.375rem 0.75rem",
                  background: "#1a1a1a",
                  color: STATUS_CONFIG[bulkStatusTarget].color,
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRight: "none",
                  cursor: bulkUpdating ? "not-allowed" : "pointer",
                  borderRadius: "0.375rem 0 0 0.375rem",
                  transition: "all 0.1s",
                  minWidth: "7rem",
                }}
              >
                {STATUS_CONFIG[bulkStatusTarget].icon}
                {STATUS_CONFIG[bulkStatusTarget].label}
                <ChevronDown size={12} style={{ marginLeft: "auto", opacity: 0.6 }} />
              </button>

              {/* Confirm button — or inline confirmation guard for destructive statuses */}
              {pendingConfirm ? (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.375rem 0.75rem",
                  background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.30)",
                  borderRadius: "0 0.375rem 0.375rem 0",
                }}>
                  <span style={{ fontSize: "0.8125rem", color: "#ef4444", whiteSpace: "nowrap" }}>
                    Move {selectedIds.size} to {STATUS_CONFIG[bulkStatusTarget].label}?
                  </span>
                  <button
                    onClick={handleBulkUpdateStatus}
                    style={{ display: "flex", alignItems: "center", gap: "0.25rem",
                      fontSize: "0.8125rem", fontWeight: 600,
                      padding: "0.25rem 0.625rem",
                      background: "#ef4444", color: "#111111",
                      border: "none",
                      cursor: "pointer", borderRadius: "0.25rem",
                    }}
                  >
                    <Check size={12} /> Confirm
                  </button>
                  <button
                    onClick={() => setPendingConfirm(false)}
                    style={{ display: "flex", alignItems: "center", gap: "0.25rem",
                      fontSize: "0.8125rem",
                      padding: "0.25rem 0.5rem",
                      background: "transparent", color: "rgba(255,255,255,0.55)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      cursor: "pointer", borderRadius: "0.25rem",
                    }}
                  >
                    <X size={12} /> Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleBulkUpdateStatus}
                  disabled={bulkUpdating || selectedIds.size === 0}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.4rem",
                    fontSize: "0.8125rem", fontWeight: 600,
                    padding: "0.375rem 0.75rem",
                    background: bulkUpdating ? "#1a1a1a" : "#8b5cf6",
                    color: bulkUpdating ? "rgba(255,255,255,0.30)" : "#111111",
                    border: "1px solid transparent",
                    cursor: bulkUpdating ? "wait" : "pointer",
                    borderRadius: "0 0.375rem 0.375rem 0",
                    transition: "all 0.1s",
                  }}
                >
                  {bulkUpdating ? (
                    <><RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> Updating...</>
                  ) : (
                    <><ArrowRight size={12} /> Move {selectedIds.size}</>
                  )}
                </button>
              )}

              {/* Status dropdown */}
              {bulkStatusOpen && (
                <div
                  style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0,
                    background: "#111111", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "0.375rem", zIndex: 100, minWidth: "10rem",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                    overflow: "hidden",
                  }}
                >
                  {(Object.entries(STATUS_CONFIG) as [ProspectStatus, typeof STATUS_CONFIG[ProspectStatus]][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => { setBulkStatusTarget(key); setBulkStatusOpen(false); }}
                      style={{
                        display: "flex", alignItems: "center", gap: "0.5rem",
                        width: "100%", padding: "0.5rem 0.75rem",
                        fontSize: "0.8125rem", fontWeight: 500,
                        color: cfg.color,
                        background: bulkStatusTarget === key ? "#1a1a1a" : "transparent",
                        border: "none", cursor: "pointer", textAlign: "left",
                        borderLeft: bulkStatusTarget === key ? `2px solid ${cfg.color}` : "2px solid transparent",
                        transition: "background 0.1s",
                      }}
                    >
                      {cfg.icon} {cfg.label}
                      {bulkStatusTarget === key && <Check size={12} style={{ marginLeft: "auto" }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ flex: 1 }} />

            {/* Bulk progress indicator */}
            {bulkProgress && (
              <span style={{ fontSize: "0.8125rem", color: bulkProgress.failed > 0 ? "#f59e0b" : "#00ff87" }}>
                {bulkSending ? (
                  <><RefreshCw size={12} style={{ display: "inline", marginRight: 4, animation: "spin 1s linear infinite" }} />Sending...</>
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
                fontSize: "0.8125rem", fontWeight: 600,
                padding: "0.375rem 1rem",
                background: bulkSending ? "rgba(62,207,142,0.15)" : "#00ff87",
                color: bulkSending ? "#00ff87" : "#ececec",
                border: "none",
                cursor: bulkSending ? "wait" : "pointer",
                borderRadius: "0.375rem",
                transition: "all 0.1s",
                opacity: bulkSending ? 0.7 : 1,
                marginLeft: "auto",
              }}
            >
              {bulkSending ? (
                <><RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> Sending {selectedIds.size}...</>
              ) : (
                <><Zap size={12} /> Send Email to {selectedIds.size} Contact{selectedIds.size !== 1 ? "s" : ""}</>
              )}
            </button>
          </div>
        )}

        {/* Bulk result summary */}
        {!bulkSending && bulkResults.length > 0 && (
          <div style={{
            padding: "0.875rem 1rem",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "0.5rem",
            marginBottom: "1rem",
            background: "#111111",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#ececec", margin: 0 }}>
                Bulk Send Complete — <span style={{ color: "#00ff87" }}>{bulkResults.filter(r => r.success).length} sent</span> · <span style={{ color: "#ef4444" }}>{bulkResults.filter(r => !r.success).length} failed</span>
              </p>
              <button onClick={() => setBulkResults([])} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.30)", padding: 0 }}>
                <X size={13} />
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
              {bulkResults.map(r => (
                <span key={r.id} style={{
                  fontSize: "0.75rem",
                  padding: "0.2rem 0.5rem", borderRadius: "0.25rem",
                  border: `1px solid ${r.success ? "rgba(62,207,142,0.30)" : "rgba(239,68,68,0.30)"}`,
                  color: r.success ? "#00ff87" : "#ef4444",
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
                          {col === "contacted" && (
                            <button
                              onClick={() => openScheduleModal(p)}
                              style={{ fontFamily: "var(--font-mono)", fontSize: "0.4rem", letterSpacing: "0.06em", textTransform: "uppercase", padding: "0.15rem 0.4rem", border: "1px solid rgba(129,140,248,0.40)", color: "#818cf8", background: "transparent", cursor: "pointer", borderRadius: "0.125rem" }}
                            >📅 Schedule</button>
                          )}
                          {col === "responded" && (
                            <>
                              <button
                                onClick={() => openScheduleModal(p)}
                                style={{ fontFamily: "var(--font-mono)", fontSize: "0.4rem", letterSpacing: "0.06em", textTransform: "uppercase", padding: "0.15rem 0.4rem", border: "1px solid rgba(129,140,248,0.40)", color: "#818cf8", background: "transparent", cursor: "pointer", borderRadius: "0.125rem" }}
                              >📅 Schedule</button>
                              <button
                                onClick={() => updateProspect.mutate({ id: p.id, status: "converted" })}
                                style={{ fontFamily: "var(--font-mono)", fontSize: "0.4rem", letterSpacing: "0.06em", textTransform: "uppercase", padding: "0.15rem 0.4rem", border: "1px solid rgba(167,139,250,0.40)", color: "#a78bfa", background: "transparent", cursor: "pointer", borderRadius: "0.125rem" }}
                              >★ Convert</button>
                            </>
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
                    <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: "0 0 0.25rem 0.25rem", overflow: "hidden" }}>
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
                              {(p.status === "contacted" || p.status === "responded") && (
                                <button
                                  onClick={() => openScheduleModal(p)}
                                  style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.06em", textTransform: "uppercase", padding: "0.2rem 0.55rem", border: "1px solid rgba(129,140,248,0.40)", color: "#818cf8", background: "transparent", cursor: "pointer", borderRadius: "0.125rem" }}
                                >
                                  📅 Schedule
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
          <div style={{ textAlign: "center", padding: "4rem 0", color: "rgba(255,255,255,0.30)", fontSize: "0.875rem" }}>
            Loading prospects...
          </div>
        ) : prospects.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 0", color: "rgba(255,255,255,0.30)", fontSize: "0.875rem" }}>
            No prospects found.
          </div>
        ) : (
          <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.5rem", overflow: "hidden", background: "#111111" }}>
            {/* Table header row with Select All */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1.5rem 2fr 1.5fr 1fr 1fr 1fr 3.5rem auto",
              gap: "1.5rem",
              alignItems: "center",
              padding: "0.625rem 1rem",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              background: "#080808",
            }}>
              <button
                onClick={toggleAll}
                style={{ background: "none", border: "none", cursor: "pointer", color: allSelected ? "#00ff87" : "rgba(255,255,255,0.30)", padding: 0, display: "flex", alignItems: "center" }}
                title={allSelected ? "Deselect all" : "Select all"}
              >
                {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
              </button>
              <button onClick={() => toggleSort("company")} style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: "none", border: "none", cursor: "pointer", fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: sortKey === "company" ? "#ececec" : "#64748b", padding: 0 }}>
                Company / Robot
                {sortKey === "company" ? (sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} style={{ opacity: 0.4 }} />}
              </button>
              <span style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#64748b" }}>Shows</span>
              <span style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#64748b" }}>LV</span>
              <button onClick={() => toggleSort("status")} style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: "none", border: "none", cursor: "pointer", fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: sortKey === "status" ? "#ececec" : "#64748b", padding: 0 }}>
                Status
                {sortKey === "status" ? (sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} style={{ opacity: 0.4 }} />}
              </button>
              <button onClick={() => toggleSort("followUpDate")} style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: "none", border: "none", cursor: "pointer", fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: sortKey === "followUpDate" ? "#ececec" : "#64748b", padding: 0 }}>
                Follow-up
                {sortKey === "followUpDate" ? (sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} style={{ opacity: 0.4 }} />}
              </button>
              <button onClick={() => toggleSort("engagementScore")} style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: "none", border: "none", cursor: "pointer", fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: sortKey === "engagementScore" ? "#f59e0b" : "#64748b", padding: 0 }}>
                Score
                {sortKey === "engagementScore" ? (sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} style={{ opacity: 0.4 }} />}
              </button>
              <span style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#64748b" }}>Action</span>
            </div>

            {sortedProspects.map((p, i) => {
              const cfg = STATUS_CONFIG[p.status as ProspectStatus] ?? STATUS_CONFIG.new;
              const isPanelSelected = selectedProspectId === p.id;
              const shows = (p.shows as string[] | null) ?? [];
              const isSelected = selectedIds.has(p.id);
              const isSent = sentIds.has(p.id);
              const isFailed = failedIds.has(p.id);
              const conf = String((p as Record<string, unknown>).emailConfidence ?? "");
              const urgency = getUrgency(shows);
              const isHighlighted = highlightedId === p.id;

              return (
                <div
                  key={p.id}
                  ref={el => {
                    if (el) rowRefs.current.set(p.id, el);
                    else rowRefs.current.delete(p.id);
                  }}
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    background: isSent && bulkResults.some(r => r.id === p.id && r.success)
                      ? "rgba(62,207,142,0.04)"
                      : isFailed && bulkResults.some(r => r.id === p.id && !r.success)
                      ? "rgba(239,68,68,0.04)"
                      : isPanelSelected
                      ? "rgba(0,255,135,0.07)"
                      : isSelected
                      ? "rgba(62,207,142,0.05)"
                      : isHighlighted
                      ? "rgba(0,255,135,0.06)"
                      : "transparent",
                    outline: isPanelSelected ? "2px solid rgba(0,255,135,0.30)" : isHighlighted ? "2px solid rgba(0,255,135,0.55)" : "none",
                    outlineOffset: "-2px",
                    borderRadius: (isPanelSelected || isHighlighted) ? "0.25rem" : undefined,
                    transition: "background 0.15s, outline 0.15s",
                  }}
                >
                  {/* Main row */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.5rem 2fr 1.5fr 1fr 1fr 1fr 3.5rem auto",
                      gap: "1.5rem",
                      alignItems: "center",
                      padding: "0.75rem 1rem",
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedProspectId(isPanelSelected ? null : p.id)}
                  >
                    {/* Checkbox */}
                    <div onClick={e => { e.stopPropagation(); toggleRow(p.id); }} style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
                      {isSelected
                        ? <CheckSquare size={14} style={{ color: "#00ff87" }} />
                        : <Square size={14} style={{ color: "#cbd5e1" }} />
                      }
                    </div>

                    {/* Company + robot */}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.30)", minWidth: "1.5rem" }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "#ececec" }}>{p.company}</span>
                        {Boolean((p as { hasClientProfile?: boolean }).hasClientProfile) && (
                          <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#00ff87" }} title="Company has signed up as a StageGate client">✓ Client</span>
                        )}
                        {urgency && (
                          <span style={{
                            fontSize: "0.6875rem", fontWeight: 600,
                            color: urgency.color,
                          }} title={`${urgency.days} days until next show`}>
                            {urgency.label}
                          </span>
                        )}
                        {p.website && (
                          <a href={p.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                            style={{ color: "rgba(255,255,255,0.30)", lineHeight: 1 }}>
                            <ExternalLink size={11} />
                          </a>
                        )}
                        {p.contactEmail && conf && (
                          <span style={{
                            fontSize: "0.6875rem", fontWeight: 500,
                            color: CONFIDENCE_COLORS[conf] ?? "rgba(255,255,255,0.30)",
                          }}>
                            {conf}
                          </span>
                        )}
                      </div>
                      {p.robotName && (
                        <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "0.15rem 0 0 2rem" }}>
                          {p.robotName}
                          {p.robotType && <span style={{ color: "rgba(255,255,255,0.30)", marginLeft: "0.5rem" }}>· {ROBOT_TYPE_LABELS[p.robotType] ?? p.robotType}</span>}
                        </p>
                      )}
                      {/* Vendor type for ecosystem partners */}
                      {(() => {
                        const vt = String((p as Record<string, unknown>).vendorType ?? "robot_oem");
                        if (vt === "robot_oem") return null;
                        const vtCfg = VENDOR_TYPE_CONFIG[vt];
                        if (!vtCfg) return null;
                        return (
                          <span style={{
                            display: "inline-flex", alignItems: "center",
                            fontSize: "0.6875rem", fontWeight: 500,
                            color: vtCfg.color,
                            marginTop: "0.15rem",
                          }}>
                            ◆ {vtCfg.label} Partner
                          </span>
                        );
                      })()}
                    </div>

                    {/* Shows */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                      {shows.slice(0, 3).map(s => (
                        <span key={s} className="badge-stroke" style={{ fontSize: "0.5625rem" }}>{s}</span>
                      ))}
                      {shows.length > 3 && <span className="badge-stroke" style={{ fontSize: "0.5625rem" }}>+{shows.length - 3}</span>}
                    </div>

                    {/* LV status */}
                    <div style={{ fontSize: "0.8125rem", color: p.attendsLasVegas === "yes" ? "#00ff87" : "rgba(255,255,255,0.30)" }}>
                      {p.attendsLasVegas === "yes" ? "LV ✓" : p.attendsLasVegas === "no" ? "LV ✗" : "LV ?"}
                    </div>

                    {/* Status */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: cfg.color, fontSize: "0.8125rem", fontWeight: 500 }}>
                        {cfg.icon}
                        {cfg.label}
                      </div>
                      {p.status === "responded" && (p as Record<string, unknown>).repliedAt != null && (
                        <span style={{ fontSize: "0.75rem", color: "#00ff87" }}>
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
                            background: '#1a1a1a', border: "1px solid rgba(255,255,255,0.20)",
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
                          <span style={{ fontSize: "0.8125rem", color: new Date(String((p as Record<string, unknown>).followUpDate)) < new Date() ? "#ef4444" : "#f59e0b", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            <Calendar size={12} />
                            {new Date(String((p as Record<string, unknown>).followUpDate)).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setEditingFollowUpId(p.id)}
                          title="Set follow-up date"
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: "0.2rem" }}
                        >
                          <Calendar size={12} style={{ color: "#cbd5e1" }} />
                          <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.30)" }}>Set</span>
                        </button>
                      )}
                    </div>

                    {/* Engagement score */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      {(() => {
                        const score = Number((p as Record<string, unknown>).engagementScore ?? 0);
                        const opens = Number((p as Record<string, unknown>).opens ?? 0);
                        const clicks = Number((p as Record<string, unknown>).clicks ?? 0);
                        if (score === 0) return <span style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.30)" }}>—</span>;
                        return (
                          <span title={`${opens} open${opens !== 1 ? 's' : ''}, ${clicks} click${clicks !== 1 ? 's' : ''}`} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            <span style={{ fontSize: "0.75rem" }}>🔥</span>
                            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: score >= 5 ? "#f59e0b" : score >= 2 ? "#fbbf24" : "rgba(255,255,255,0.30)" }}>{score}</span>
                          </span>
                        );
                      })()}
                    </div>

                    {/* Actions — Draft Email workflow */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }} onClick={e => e.stopPropagation()}>
                      {/* Status-aware outreach action button */}
                      {p.status === "contacted" || isSent ? (
                        <button
                          onClick={() => setLocation("/admin/outreach")}
                          title="View in Outreach queue"
                          style={{
                            display: "flex", alignItems: "center", gap: "0.3rem",
                            fontSize: "0.8125rem", fontWeight: 500,
                            padding: "0.25rem 0.625rem",
                            border: "1px solid rgba(0,255,135,0.25)",
                            color: "#00ff87",
                            background: "transparent", cursor: "pointer",
                            borderRadius: "0.25rem",
                          }}
                        >
                          <Check size={12} /> Sent · Outreach
                        </button>
                      ) : p.status === "responded" ? (
                        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8125rem", color: "#00ff87" }}>
                          <Check size={12} /> Replied
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setDraftGeneratingId(p.id);
                            openDraftReview(p.id);
                          }}
                          style={{
                            display: "flex", alignItems: "center", gap: "0.3rem",
                            fontSize: "0.8125rem", fontWeight: 500,
                            padding: "0.25rem 0.625rem",
                            border: "1px solid rgba(255,255,255,0.12)",
                            color: "rgba(255,255,255,0.70)",
                            background: "#111111", cursor: "pointer",
                            borderRadius: "0.25rem",
                            transition: "all 0.1s",
                          }}
                        >
                          <Mail size={12} /> Draft Email
                        </button>
                      )}
                      {/* Schedule Meeting */}
                      {(p.status === "contacted" || p.status === "responded") && (
                        <button
                          onClick={() => openScheduleModal(p)}
                          title="Schedule Meeting"
                          style={{
                            display: "flex", alignItems: "center", gap: "0.3rem",
                            fontSize: "0.8125rem", fontWeight: 500,
                            padding: "0.25rem 0.625rem",
                            border: "1px solid rgba(129,140,248,0.40)",
                            color: "#818cf8",
                            background: "#111111", cursor: "pointer",
                            borderRadius: "0.25rem",
                            transition: "all 0.1s",
                          }}
                        >
                          <Calendar size={12} /> Schedule
                        </button>
                      )}
                      {/* Mark as Replied */}
                      {(p.status === "new" || p.status === "contacted") && (
                        <button
                          onClick={() => markReplied.mutate({ id: p.id })}
                          disabled={replyingId === p.id}
                          title="Mark as Replied"
                          style={{
                            display: "flex", alignItems: "center", gap: "0.3rem",
                            fontSize: "0.8125rem", fontWeight: 500,
                            padding: "0.25rem 0.625rem",
                            border: "1px solid rgba(62,207,142,0.40)",
                            color: "#00ff87",
                            background: "#111111",
                            cursor: replyingId === p.id ? "wait" : "pointer",
                            borderRadius: "0.25rem",
                            opacity: replyingId === p.id ? 0.5 : 1,
                            transition: "all 0.1s",
                          }}
                        >
                          {replyingId === p.id
                            ? <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} />
                            : <><Check size={12} /> Replied</>
                          }
                        </button>
                      )}
                      {/* Inline reply notes prompt */}
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
                              fontSize: "0.8125rem",
                              background: "#080808", border: "1px solid rgba(255,255,255,0.08)",
                              color: "#ececec", padding: "0.3rem 0.5rem", borderRadius: "0.25rem",
                              outline: "none", width: "14rem",
                            }}
                          />
                          <button onClick={() => saveReplyNote(p.id)} title="Save note" style={{ background: "none", border: "none", cursor: "pointer", color: "#00ff87", padding: "0.2rem", lineHeight: 1 }}>
                            <Check size={13} />
                          </button>
                          <button onClick={() => dismissReplyNote(p.id)} title="Dismiss" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.30)", padding: "0.2rem", lineHeight: 1 }}>
                            <X size={13} />
                          </button>
                        </div>
                      )}
                      <ArrowRight size={14} style={{ color: isPanelSelected ? "#00ff87" : "rgba(255,255,255,0.20)", transition: "color 0.15s" }} />
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── CRM Side Panel ────────────────────────────────────────────────────── */}
      {selectedProspect && (
        <div style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "480px",
          background: "#0a0a0a",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.55)",
          zIndex: 45,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Panel header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0.75rem 1rem",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            background: "#111",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#00ff87" }}>CRM</span>
              <span style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.30)" }}>·</span>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#ececec" }}>{selectedProspect.company}</span>
            </div>
            <button
              onClick={() => setSelectedProspectId(null)}
              title="Close panel"
              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.30)", display: "flex", alignItems: "center", padding: "0.25rem", borderRadius: "0.25rem" }}
            >
              <X size={15} />
            </button>
          </div>
          {/* Scrollable CRM card */}
          <div style={{ flex: 1, overflow: "auto" }}>
            <ProspectCRMCard
              prospect={selectedProspect}
              onStatusChange={() => { void utils.prospects.list.invalidate(); }}
            />
          </div>
        </div>
      )}

      {/* CSV Import Preview Modal */}
      {csvPreview && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.80)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
        }} onClick={() => setCsvPreview(null)}>
          <div style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: "0.5rem",
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
                  padding: "0.5rem 1.25rem", border: '1px solid rgba(255,255,255,0.08)',
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

      {/* Draft Review Modal */}
      {draftReviewId !== null && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
          onClick={() => setDraftReviewId(null)}
        >
          <div
            style={{ background: "#111", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "0.5rem", padding: "2rem", maxWidth: "44rem", width: "100%", maxHeight: "85vh", overflow: "auto" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <div>
                <h2 style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", color: "#ececec", margin: 0, letterSpacing: "-0.02em" }}>Draft Email Review</h2>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: "rgba(255,255,255,0.35)", margin: "0.25rem 0 0" }}>
                  {sortedProspects.find(p => p.id === draftReviewId)?.company ?? ""} — {sortedProspects.find(p => p.id === draftReviewId)?.contactEmail ?? "no email"}
                </p>
              </div>
              <button onClick={() => setDraftReviewId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.40)" }}>
                <X size={16} />
              </button>
            </div>

            {/* Draft content or empty state */}
            {!draftReviewDraftId && !draftReviewSubject ? (
              <div style={{ textAlign: "center", padding: "2rem 0" }}>
                <p style={{ color: "rgba(255,255,255,0.40)", fontSize: "0.875rem", marginBottom: "1.25rem" }}>No draft yet. Generate one with AI or write your own.</p>
                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                  <button
                    onClick={() => {
                      const prospect = sortedProspects.find(p => p.id === draftReviewId);
                      if (!prospect) return;
                      setDraftGeneratingId(draftReviewId);
                      generateDraftMutation.mutate({ id: draftReviewId! });
                    }}
                    disabled={generateDraftMutation.isPending}
                    style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8125rem", fontWeight: 600, padding: "0.5rem 1.25rem", border: "1px solid rgba(0,255,135,0.40)", color: "#00ff87", background: "rgba(0,255,135,0.06)", cursor: generateDraftMutation.isPending ? "wait" : "pointer", borderRadius: "0.25rem" }}
                  >
                    {generateDraftMutation.isPending ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={13} />}
                    {generateDraftMutation.isPending ? "Generating…" : "Generate with AI"}
                  </button>
                  <button
                    onClick={() => {
                      setDraftReviewSubject("StageGate — Let's Talk Robots");
                      setDraftReviewBody("");
                      setDraftReviewEditing(true);
                    }}
                    style={{ fontSize: "0.8125rem", fontWeight: 500, padding: "0.5rem 1.25rem", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.60)", background: "transparent", cursor: "pointer", borderRadius: "0.25rem" }}
                  >
                    Write Manually
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Draft status badge */}
                {draftReviewDraftId && (() => {
                  const draft = (reviewDrafts as Array<{id: number; status: string}> | undefined)?.find(d => d.id === draftReviewDraftId);
                  const status = draft?.status ?? "pending";
                  const statusColor = status === "approved" ? "#00ff87" : status === "sent" ? "#60a5fa" : "#f59e0b";
                  return (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: statusColor, marginBottom: "1rem" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: statusColor, display: "inline-block" }} />
                      {status}
                    </div>
                  );
                })()}

                {/* Subject */}
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", fontSize: "0.6875rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: "0.375rem" }}>Subject</label>
                  {draftReviewEditing ? (
                    <input
                      value={draftReviewSubject}
                      onChange={e => setDraftReviewSubject(e.target.value)}
                      style={{ width: "100%", background: "#080808", border: "1px solid rgba(255,255,255,0.12)", color: "#ececec", padding: "0.5rem 0.75rem", borderRadius: "0.25rem", fontSize: "0.875rem", outline: "none" }}
                    />
                  ) : (
                    <p style={{ fontSize: "0.875rem", color: "#ececec", margin: 0, padding: "0.5rem 0" }}>{draftReviewSubject}</p>
                  )}
                </div>

                {/* Body */}
                <div style={{ marginBottom: "1.5rem" }}>
                  <label style={{ display: "block", fontSize: "0.6875rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: "0.375rem" }}>Body</label>
                  {draftReviewEditing ? (
                    <textarea
                      value={draftReviewBody}
                      onChange={e => setDraftReviewBody(e.target.value)}
                      rows={10}
                      style={{ width: "100%", background: "#080808", border: "1px solid rgba(255,255,255,0.12)", color: "#ececec", padding: "0.5rem 0.75rem", borderRadius: "0.25rem", fontSize: "0.8125rem", outline: "none", resize: "vertical", lineHeight: 1.6 }}
                    />
                  ) : (
                    <pre style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.75)", margin: 0, padding: "0.75rem", background: "#080808", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "0.25rem", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{draftReviewBody}</pre>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap" }}>
                  {draftReviewEditing ? (
                    <>
                      <button
                        onClick={() => {
                          if (draftReviewDraftId) {
                            editDraftMutation.mutate({ draftId: draftReviewDraftId, subject: draftReviewSubject, body: draftReviewBody });
                          } else {
                            createDraftMutation.mutate({ prospectId: draftReviewId!, subject: draftReviewSubject, body: draftReviewBody });
                            setDraftReviewEditing(false);
                          }
                        }}
                        style={{ fontSize: "0.8125rem", fontWeight: 600, padding: "0.5rem 1.25rem", border: "1px solid rgba(0,255,135,0.40)", color: "#00ff87", background: "rgba(0,255,135,0.06)", cursor: "pointer", borderRadius: "0.25rem" }}
                      >
                        Save Draft
                      </button>
                      <button
                        onClick={() => setDraftReviewEditing(false)}
                        style={{ fontSize: "0.8125rem", fontWeight: 500, padding: "0.5rem 1.25rem", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.50)", background: "transparent", cursor: "pointer", borderRadius: "0.25rem" }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      {draftReviewDraftId && (() => {
                        const draft = (reviewDrafts as Array<{id: number; status: string}> | undefined)?.find(d => d.id === draftReviewDraftId);
                        const isApproved = draft?.status === "approved";
                        return (
                          <>
                            {!isApproved && (
                              <button
                                onClick={() => approveDraftMutation.mutate({ draftId: draftReviewDraftId })}
                                disabled={approveDraftMutation.isPending}
                                style={{ fontSize: "0.8125rem", fontWeight: 600, padding: "0.5rem 1.25rem", border: "1px solid rgba(0,255,135,0.40)", color: "#00ff87", background: "rgba(0,255,135,0.06)", cursor: "pointer", borderRadius: "0.25rem" }}
                              >
                                Approve
                              </button>
                            )}
                            {isApproved && (
                              <button
                                onClick={() => sendDraftMutation.mutate({ draftId: draftReviewDraftId })}
                                disabled={sendDraftMutation.isPending}
                                style={{ fontSize: "0.8125rem", fontWeight: 700, padding: "0.5rem 1.5rem", border: "none", color: "#080808", background: "#00ff87", cursor: sendDraftMutation.isPending ? "wait" : "pointer", borderRadius: "0.25rem" }}
                              >
                                {sendDraftMutation.isPending ? "Sending…" : "Send Email"}
                              </button>
                            )}
                          </>
                        );
                      })()}
                      <button
                        onClick={() => setDraftReviewEditing(true)}
                        style={{ fontSize: "0.8125rem", fontWeight: 500, padding: "0.5rem 1rem", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.55)", background: "transparent", cursor: "pointer", borderRadius: "0.25rem" }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => generateDraftMutation.mutate({ id: draftReviewId! })}
                        disabled={generateDraftMutation.isPending}
                        style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8125rem", fontWeight: 500, padding: "0.5rem 1rem", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.55)", background: "transparent", cursor: "pointer", borderRadius: "0.25rem" }}
                      >
                        <Zap size={12} /> Regenerate
                      </button>
                      {draftReviewDraftId && (
                        <button
                          onClick={() => discardDraftMutation.mutate({ draftId: draftReviewDraftId })}
                          style={{ fontSize: "0.8125rem", fontWeight: 500, padding: "0.5rem 1rem", border: "1px solid rgba(239,68,68,0.30)", color: "#ef4444", background: "transparent", cursor: "pointer", borderRadius: "0.25rem", marginLeft: "auto" }}
                        >
                          Discard
                        </button>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Schedule Meeting Modal */}
      {schedulingProspect && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.80)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "1rem" }}>
          <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.75rem", width: "100%", maxWidth: "460px", fontFamily: "var(--font-mono)" }}>
            {/* Header */}
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#818cf8" }}>Schedule Meeting</div>
                <div style={{ fontSize: "0.625rem", color: "#64748b", marginTop: "0.25rem" }}>{schedulingProspect.company}{schedulingProspect.contactName ? ` — ${schedulingProspect.contactName}` : ""}</div>
              </div>
              <button onClick={() => setSchedulingProspect(null)} style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer" }}>
                <X size={16} />
              </button>
            </div>
            {/* Body */}
            <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "0.375rem" }}>Proposed Date & Time *</label>
                <input type="datetime-local" value={scheduleForm.proposedTime}
                  onChange={e => setScheduleForm(f => ({ ...f, proposedTime: e.target.value }))}
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", color: "#e2e8f0", fontSize: "0.75rem", fontFamily: "var(--font-mono)", outline: "none", boxSizing: "border-box", colorScheme: "dark" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "0.375rem" }}>Duration (minutes)</label>
                <select value={scheduleForm.durationMinutes}
                  onChange={e => setScheduleForm(f => ({ ...f, durationMinutes: Number(e.target.value) }))}
                  style={{ width: "100%", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", color: "#e2e8f0", fontSize: "0.75rem", fontFamily: "var(--font-mono)", outline: "none" }}>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "0.375rem" }}>Notes (optional)</label>
                <textarea value={scheduleForm.notes}
                  onChange={e => setScheduleForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Agenda, context, or prep notes…"
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", color: "#e2e8f0", fontSize: "0.75rem", fontFamily: "var(--font-mono)", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
              </div>
              <div style={{ background: "rgba(129,140,248,0.06)", border: "1px solid rgba(129,140,248,0.15)", borderRadius: "0.375rem", padding: "0.75rem", fontSize: "0.5625rem", color: "#94a3b8", lineHeight: 1.5 }}>
                This will: mark the prospect as <strong style={{ color: "#818cf8" }}>Scheduled</strong>, create a calendar event, and send notification emails to <strong style={{ color: "#e2e8f0" }}>Tommy</strong> (tom@starsupportinc.com) and the <strong style={{ color: "#e2e8f0" }}>owner</strong>.
              </div>
            </div>
            {/* Footer */}
            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button onClick={() => setSchedulingProspect(null)}
                style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.375rem", padding: "0.5rem 1rem", color: "#64748b", fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", fontFamily: "var(--font-mono)" }}>
                Cancel
              </button>
              <button onClick={confirmScheduleMeeting} disabled={!scheduleForm.proposedTime}
                style={{ background: scheduleForm.proposedTime ? "#818cf8" : "rgba(129,140,248,0.3)", color: "#fff", border: "none", borderRadius: "0.375rem", padding: "0.5rem 1.25rem", fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: scheduleForm.proposedTime ? "pointer" : "not-allowed", fontFamily: "var(--font-mono)" }}>
                Confirm & Send Emails
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
