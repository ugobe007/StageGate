import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  Play, ArrowLeft, Bot, Calendar, Building2,
  ChevronDown, ChevronUp, CheckCircle2,
  Clock, Phone, Mail, MessageSquare, XCircle, Loader2,
  ArrowUpDown, X,
} from "lucide-react";

const STATUS_CONFIG = {
  new:       { label: "New",        color: "oklch(0.55 0.18 145)",  bg: "oklch(0.55 0.18 145 / 0.10)"  },
  contacted: { label: "Contacted",  color: "oklch(0.65 0.18 60)",   bg: "oklch(0.65 0.18 60 / 0.10)"   },
  scheduled: { label: "Scheduled",  color: "oklch(0.55 0.18 240)",  bg: "oklch(0.55 0.18 240 / 0.10)"  },
  completed: { label: "Completed",  color: "oklch(0.72 0.21 145)",  bg: "oklch(0.72 0.21 145 / 0.10)"  },
  closed:    { label: "Closed",     color: "oklch(0.45 0.008 240)", bg: "oklch(0.45 0.008 240 / 0.10)" },
} as const;

type DemoStatus = keyof typeof STATUS_CONFIG;

type SortKey = "newest" | "oldest" | "company_asc" | "company_desc" | "robot_asc";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest",       label: "Newest First"    },
  { key: "oldest",       label: "Oldest First"    },
  { key: "company_asc",  label: "Company A → Z"   },
  { key: "company_desc", label: "Company Z → A"   },
  { key: "robot_asc",    label: "Robot Type A → Z" },
];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as DemoStatus] ?? STATUS_CONFIG.new;
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-mono font-semibold"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40` }}
    >
      {cfg.label}
    </span>
  );
}

export default function AdminDemoRequests() {
  const { user } = useAuth();
  const [expandedId, setExpandedId]     = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortKey, setSortKey]           = useState<SortKey>("newest");
  const [sortOpen, setSortOpen]         = useState(false);

  const { data: demos, isLoading, refetch } = trpc.demos.list.useQuery();

  const updateStatus = trpc.demos.updateStatus.useMutation({
    onSuccess: () => { refetch(); toast.success("Status updated"); },
    onError:   (e) => toast.error(e.message),
  });

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(0.08 0.006 240)" }}>
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  const counts = (demos || []).reduce((acc, d) => {
    acc[d.status ?? "new"] = (acc[d.status ?? "new"] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Filter then sort
  const processed = useMemo(() => {
    const base = (demos || []).filter(
      (d) => statusFilter === "all" || d.status === statusFilter
    );
    return [...base].sort((a, b) => {
      switch (sortKey) {
        case "newest":
          return (new Date(b.createdAt ?? 0).getTime()) - (new Date(a.createdAt ?? 0).getTime());
        case "oldest":
          return (new Date(a.createdAt ?? 0).getTime()) - (new Date(b.createdAt ?? 0).getTime());
        case "company_asc":
          return (a.company ?? "").localeCompare(b.company ?? "");
        case "company_desc":
          return (b.company ?? "").localeCompare(a.company ?? "");
        case "robot_asc":
          return (a.robotType ?? "").localeCompare(b.robotType ?? "");
        default:
          return 0;
      }
    });
  }, [demos, statusFilter, sortKey]);

  const hasActiveFilters = statusFilter !== "all";
  const currentSortLabel = SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? "Sort";

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.08 0.006 240)", color: "oklch(0.97 0.002 240)" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-b" style={{ borderColor: "oklch(0.16 0.010 240)", background: "oklch(0.10 0.006 240)" }}>
        <div className="container py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <button
                className="p-2 rounded-lg transition-colors"
                style={{ color: "oklch(0.55 0.008 240)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.88 0.008 240)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.55 0.008 240)")}
              >
                <ArrowLeft size={18} />
              </button>
            </Link>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.55 0.18 280 / 0.15)" }}>
              <Play size={15} style={{ color: "oklch(0.72 0.21 280)" }} />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg">Demo Requests</h1>
              <p className="text-xs" style={{ color: "oklch(0.50 0.008 240)" }}>
                {demos?.length || 0} total · {counts["new"] || 0} new
              </p>
            </div>
          </div>

          {(counts["new"] || 0) > 0 && (
            <span
              className="px-3 py-1 rounded-full text-xs font-semibold animate-pulse"
              style={{ background: "oklch(0.55 0.18 145 / 0.15)", color: "oklch(0.72 0.21 145)", border: "1px solid oklch(0.55 0.18 145 / 0.30)" }}
            >
              {counts["new"]} new
            </span>
          )}
        </div>
      </div>

      <div className="container py-6 space-y-5">

        {/* ── Filter + Sort bar ───────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">

          {/* Status filter pills */}
          <div className="flex flex-wrap gap-2 flex-1">
            {[
              { key: "all", label: "All", count: demos?.length || 0 },
              ...Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({
                key,
                label: cfg.label,
                count: counts[key] || 0,
              })),
            ].map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className="px-3 py-1.5 rounded-lg text-sm border transition-all flex items-center gap-1.5"
                style={{
                  borderColor: statusFilter === key ? "oklch(0.72 0.21 280)" : "oklch(0.20 0.008 240)",
                  background:  statusFilter === key ? "oklch(0.72 0.21 280 / 0.10)" : "transparent",
                  color:       statusFilter === key ? "oklch(0.72 0.21 280)" : "oklch(0.55 0.008 240)",
                }}
              >
                {label}
                <span className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: "oklch(0.15 0.006 240)", color: "oklch(0.60 0.008 240)" }}>
                  {count}
                </span>
              </button>
            ))}

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={() => setStatusFilter("all")}
                className="px-3 py-1.5 rounded-lg text-sm border transition-all flex items-center gap-1.5"
                style={{ borderColor: "oklch(0.28 0.008 240)", color: "oklch(0.55 0.008 240)" }}
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setSortOpen((v) => !v)}
              className="px-3 py-1.5 rounded-lg text-sm border transition-all flex items-center gap-2"
              style={{
                borderColor: sortOpen ? "oklch(0.72 0.21 280)" : "oklch(0.20 0.008 240)",
                background:  sortOpen ? "oklch(0.72 0.21 280 / 0.08)" : "transparent",
                color: "oklch(0.65 0.008 240)",
              }}
            >
              <ArrowUpDown size={13} />
              {currentSortLabel}
              <ChevronDown size={13} style={{ transform: sortOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
            </button>

            {sortOpen && (
              <div
                className="absolute right-0 top-full mt-1 rounded-xl border overflow-hidden z-20 min-w-[180px]"
                style={{ background: "oklch(0.12 0.008 240)", borderColor: "oklch(0.20 0.010 240)" }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => { setSortKey(opt.key); setSortOpen(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between"
                    style={{
                      background: sortKey === opt.key ? "oklch(0.72 0.21 280 / 0.10)" : "transparent",
                      color:      sortKey === opt.key ? "oklch(0.72 0.21 280)" : "oklch(0.65 0.008 240)",
                    }}
                    onMouseEnter={(e) => { if (sortKey !== opt.key) e.currentTarget.style.background = "oklch(0.16 0.006 240)"; }}
                    onMouseLeave={(e) => { if (sortKey !== opt.key) e.currentTarget.style.background = "transparent"; }}
                  >
                    {opt.label}
                    {sortKey === opt.key && <CheckCircle2 size={13} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Result count ────────────────────────────────────────────────── */}
        {!isLoading && demos && (
          <p className="text-xs font-mono" style={{ color: "oklch(0.45 0.008 240)" }}>
            Showing {processed.length} of {demos.length} request{demos.length !== 1 ? "s" : ""}
            {hasActiveFilters && (
              <> · filtered by <span style={{ color: "oklch(0.72 0.21 280)" }}>{STATUS_CONFIG[statusFilter as DemoStatus]?.label}</span></>
            )}
            {" · "}sorted by <span style={{ color: "oklch(0.60 0.008 240)" }}>{currentSortLabel.toLowerCase()}</span>
          </p>
        )}

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 size={20} className="animate-spin" style={{ color: "oklch(0.72 0.21 280)" }} />
            <span style={{ color: "oklch(0.55 0.008 240)" }}>Loading demo requests…</span>
          </div>
        )}

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {!isLoading && processed.length === 0 && (
          <div
            className="rounded-xl border py-16 text-center"
            style={{ borderColor: "oklch(0.16 0.010 240)", background: "oklch(0.10 0.006 240)" }}
          >
            <Play size={32} className="mx-auto mb-3" style={{ color: "oklch(0.30 0.008 240)" }} />
            <p className="font-semibold" style={{ color: "oklch(0.65 0.008 240)" }}>
              {statusFilter === "all"
                ? "No demo requests yet"
                : `No ${STATUS_CONFIG[statusFilter as DemoStatus]?.label.toLowerCase()} requests`}
            </p>
            <p className="text-sm mt-1" style={{ color: "oklch(0.45 0.008 240)" }}>
              {hasActiveFilters
                ? "Try clearing the status filter to see all requests."
                : "Demo requests submitted via the website will appear here."}
            </p>
            {hasActiveFilters && (
              <button
                onClick={() => setStatusFilter("all")}
                className="mt-4 px-4 py-2 rounded-lg text-sm border transition-all"
                style={{ borderColor: "oklch(0.22 0.008 240)", color: "oklch(0.60 0.008 240)" }}
              >
                Clear filter
              </button>
            )}
          </div>
        )}

        {/* ── Request list ────────────────────────────────────────────────── */}
        {!isLoading && processed.length > 0 && (
          <div className="space-y-3">
            {processed.map((d) => {
              const isExpanded = expandedId === d.id;
              const createdDate = d.createdAt
                ? new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "—";

              return (
                <div
                  key={d.id}
                  className="rounded-xl border overflow-hidden transition-all"
                  style={{
                    borderColor: isExpanded ? "oklch(0.72 0.21 280 / 0.40)" : "oklch(0.16 0.010 240)",
                    background: "oklch(0.10 0.006 240)",
                  }}
                >
                  {/* ── Row summary ─────────────────────────────────────────── */}
                  <button
                    className="w-full px-5 py-4 flex items-center gap-4 text-left transition-colors"
                    style={{ background: "transparent" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(0.12 0.006 240)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => setExpandedId(isExpanded ? null : d.id)}
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "oklch(0.55 0.18 280 / 0.12)" }}>
                      <Bot size={16} style={{ color: "oklch(0.72 0.21 280)" }} />
                    </div>

                    {/* Name + company */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{d.name}</p>
                      <p className="text-xs truncate" style={{ color: "oklch(0.55 0.008 240)" }}>{d.company}</p>
                    </div>

                    {/* Robot type */}
                    <div className="hidden md:block flex-1 min-w-0">
                      <p className="text-xs truncate" style={{ color: "oklch(0.65 0.008 240)" }}>{d.robotType}</p>
                    </div>

                    {/* Show */}
                    <div className="hidden lg:block flex-1 min-w-0">
                      <p className="text-xs truncate" style={{ color: "oklch(0.55 0.008 240)" }}>{d.preferredShowName || "Any show"}</p>
                    </div>

                    {/* Date */}
                    <div className="hidden sm:block text-right flex-shrink-0">
                      <p className="text-xs font-mono" style={{ color: "oklch(0.45 0.008 240)" }}>{createdDate}</p>
                    </div>

                    {/* Status badge */}
                    <div className="flex-shrink-0">
                      <StatusBadge status={d.status ?? "new"} />
                    </div>

                    {/* Expand chevron */}
                    <div className="flex-shrink-0" style={{ color: "oklch(0.40 0.008 240)" }}>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>

                  {/* ── Expanded detail ───────────────────────────────────── */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t space-y-5" style={{ borderColor: "oklch(0.14 0.008 240)" }}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
                        {/* Contact info */}
                        <div className="space-y-3">
                          <p className="text-xs font-mono tracking-wide uppercase" style={{ color: "oklch(0.45 0.008 240)" }}>Contact</p>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Mail size={13} style={{ color: "oklch(0.50 0.008 240)" }} />
                              <a href={`mailto:${d.email}`} className="hover:underline" style={{ color: "oklch(0.72 0.21 280)" }}>{d.email}</a>
                            </div>
                            <div className="flex items-center gap-2">
                              <Building2 size={13} style={{ color: "oklch(0.50 0.008 240)" }} />
                              <span style={{ color: "oklch(0.75 0.008 240)" }}>{d.company}</span>
                            </div>
                          </div>
                        </div>

                        {/* Robot + show */}
                        <div className="space-y-3">
                          <p className="text-xs font-mono tracking-wide uppercase" style={{ color: "oklch(0.45 0.008 240)" }}>Robot Details</p>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Bot size={13} style={{ color: "oklch(0.50 0.008 240)" }} />
                              <span style={{ color: "oklch(0.75 0.008 240)" }}>{d.robotType}</span>
                            </div>
                            {d.preferredShowName && (
                              <div className="flex items-center gap-2">
                                <Calendar size={13} style={{ color: "oklch(0.50 0.008 240)" }} />
                                <span style={{ color: "oklch(0.75 0.008 240)" }}>{d.preferredShowName}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Optional message */}
                      {d.message && (
                        <div className="space-y-2">
                          <p className="text-xs font-mono tracking-wide uppercase" style={{ color: "oklch(0.45 0.008 240)" }}>Message</p>
                          <div
                            className="rounded-lg px-4 py-3 text-sm leading-relaxed"
                            style={{ background: "oklch(0.12 0.006 240)", border: "1px solid oklch(0.18 0.008 240)", color: "oklch(0.70 0.008 240)" }}
                          >
                            <MessageSquare size={13} className="inline mr-2 mb-0.5" style={{ color: "oklch(0.45 0.008 240)" }} />
                            {d.message}
                          </div>
                        </div>
                      )}

                      {/* Status actions */}
                      <div className="pt-3 border-t space-y-3" style={{ borderColor: "oklch(0.14 0.008 240)" }}>
                        <p className="text-xs font-mono tracking-wide uppercase" style={{ color: "oklch(0.45 0.008 240)" }}>Update Status</p>
                        <div className="flex flex-wrap gap-2">
                          {(["new", "contacted", "scheduled", "completed", "closed"] as DemoStatus[]).map((s) => {
                            const cfg = STATUS_CONFIG[s];
                            const isCurrent = (d.status ?? "new") === s;
                            return (
                              <button
                                key={s}
                                disabled={isCurrent || updateStatus.isPending}
                                onClick={() => updateStatus.mutate({ id: d.id, status: s })}
                                className="px-3 py-1.5 rounded-lg text-xs border transition-all disabled:opacity-40 flex items-center gap-1.5"
                                style={{
                                  borderColor: isCurrent ? cfg.color : "oklch(0.22 0.008 240)",
                                  background:  isCurrent ? cfg.bg : "transparent",
                                  color:       isCurrent ? cfg.color : "oklch(0.55 0.008 240)",
                                  cursor:      isCurrent ? "default" : "pointer",
                                }}
                              >
                                {s === "new"       && <Clock       size={11} />}
                                {s === "contacted" && <Phone       size={11} />}
                                {s === "scheduled" && <Calendar    size={11} />}
                                {s === "completed" && <CheckCircle2 size={11} />}
                                {s === "closed"    && <XCircle     size={11} />}
                                {cfg.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Close sort dropdown on outside click */}
      {sortOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
      )}
    </div>
  );
}
