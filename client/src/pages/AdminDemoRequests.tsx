import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  Play, ArrowLeft, Bot, Calendar, Building2,
  ChevronDown, ChevronUp, CheckCircle2,
  Clock, Phone, Mail, MessageSquare, XCircle, Loader2,
  ArrowUpDown, X, Search,
} from "lucide-react";

const STATUS_CONFIG = {
  new:       { label: "New",       color: "#3ecf8e" },
  contacted: { label: "Contacted", color: "#f59e0b" },
  scheduled: { label: "Scheduled", color: "#3b82f6" },
  completed: { label: "Completed", color: "#3ecf8e" },
  closed:    { label: "Closed",    color: "#94a3b8" },
} as const;

type DemoStatus = keyof typeof STATUS_CONFIG;

type SortKey = "newest" | "oldest" | "company_asc" | "company_desc" | "robot_asc";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest",       label: "Newest First"     },
  { key: "oldest",       label: "Oldest First"     },
  { key: "company_asc",  label: "Company A → Z"    },
  { key: "company_desc", label: "Company Z → A"    },
  { key: "robot_asc",    label: "Robot Type A → Z" },
];

export default function AdminDemoRequests() {
  const { user } = useAuth();
  const [expandedId, setExpandedId]     = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortKey, setSortKey]           = useState<SortKey>("newest");
  const [sortOpen, setSortOpen]         = useState(false);
  const [searchQuery, setSearchQuery]   = useState("");

  const { data: demos, isLoading, refetch } = trpc.demos.list.useQuery();

  const updateStatus = trpc.demos.updateStatus.useMutation({
    onSuccess: () => { refetch(); toast.success("Status updated"); },
    onError:   (e) => toast.error(e.message),
  });

  if (!user || user.role !== "admin") {
    return (
      <div style={{ minHeight: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#64748b" }}>Admin access required.</p>
      </div>
    );
  }

  const counts = (demos || []).reduce((acc, d) => {
    acc[d.status ?? "new"] = (acc[d.status ?? "new"] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const processed = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = (demos || []).filter((d) => {
      const matchesStatus = statusFilter === "all" || d.status === statusFilter;
      const matchesSearch =
        !q ||
        (d.name ?? "").toLowerCase().includes(q) ||
        (d.company ?? "").toLowerCase().includes(q) ||
        (d.robotType ?? "").toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
    return [...base].sort((a, b) => {
      switch (sortKey) {
        case "newest":      return (new Date(b.createdAt ?? 0).getTime()) - (new Date(a.createdAt ?? 0).getTime());
        case "oldest":      return (new Date(a.createdAt ?? 0).getTime()) - (new Date(b.createdAt ?? 0).getTime());
        case "company_asc": return (a.company ?? "").localeCompare(b.company ?? "");
        case "company_desc":return (b.company ?? "").localeCompare(a.company ?? "");
        case "robot_asc":   return (a.robotType ?? "").localeCompare(b.robotType ?? "");
        default:            return 0;
      }
    });
  }, [demos, statusFilter, sortKey, searchQuery]);

  const hasActiveFilters = statusFilter !== "all" || searchQuery.trim() !== "";
  const currentSortLabel = SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? "Sort";

  return (
    <div style={{ padding: "2rem", maxWidth: "56rem", margin: "0 auto", color: "#0f172a" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link href="/admin">
            <button style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: "0.25rem 0" }}>
              <ArrowLeft size={14} /> Admin
            </button>
          </Link>
          <div style={{ width: "2rem", height: "2rem", borderRadius: "0.375rem", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(62,207,142,0.1)" }}>
            <Play size={14} style={{ color: "#3ecf8e" }} />
          </div>
          <div>
            <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>Demo Requests</h1>
            <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "0.125rem 0 0" }}>
              {demos?.length || 0} total · {counts["new"] || 0} new
            </p>
          </div>
        </div>
        {(counts["new"] || 0) > 0 && (
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#3ecf8e" }}>
            {counts["new"]} new
          </span>
        )}
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: "1rem" }}>
        <Search size={14} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, company, or robot type…"
          style={{
            width: "100%", paddingLeft: "2.25rem", paddingRight: "2.25rem", paddingTop: "0.5rem", paddingBottom: "0.5rem",
            fontSize: "0.875rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem",
            background: "#ffffff", color: "#0f172a", outline: "none", boxSizing: "border-box",
          }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center" }}>
            <X size={13} />
          </button>
        )}
      </div>

      {/* Filter + Sort bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", flex: 1 }}>
          {[
            { key: "all", label: "All", count: demos?.length || 0 },
            ...Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({ key, label: cfg.label, count: counts[key] || 0 })),
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              style={{
                padding: "0.3125rem 0.75rem",
                fontSize: "0.8125rem", fontWeight: 500,
                border: `1px solid ${statusFilter === key ? "#3ecf8e" : "#e2e8f0"}`,
                background: statusFilter === key ? "rgba(62,207,142,0.08)" : "#ffffff",
                color: statusFilter === key ? "#3ecf8e" : "#64748b",
                borderRadius: "0.25rem", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "0.375rem",
              }}
            >
              {label}
              <span style={{ fontSize: "0.75rem", background: "#f1f5f9", color: "#64748b", padding: "0.0625rem 0.3125rem", borderRadius: "0.1875rem" }}>{count}</span>
            </button>
          ))}
          {hasActiveFilters && (
            <button
              onClick={() => { setStatusFilter("all"); setSearchQuery(""); }}
              style={{ padding: "0.3125rem 0.75rem", fontSize: "0.8125rem", border: "1px solid #e2e8f0", background: "#fff", color: "#94a3b8", borderRadius: "0.25rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem" }}
            >
              <X size={11} /> Clear
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setSortOpen((v) => !v)}
            style={{ padding: "0.3125rem 0.75rem", fontSize: "0.8125rem", border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", borderRadius: "0.25rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.375rem" }}
          >
            <ArrowUpDown size={12} />
            {currentSortLabel}
            <ChevronDown size={12} style={{ transform: sortOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
          </button>
          {sortOpen && (
            <div style={{ position: "absolute", right: 0, top: "calc(100% + 0.25rem)", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "0.375rem", overflow: "hidden", zIndex: 20, minWidth: "11rem", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => { setSortKey(opt.key); setSortOpen(false); }}
                  style={{ width: "100%", padding: "0.5rem 0.875rem", textAlign: "left", fontSize: "0.8125rem", background: sortKey === opt.key ? "rgba(62,207,142,0.06)" : "transparent", color: sortKey === opt.key ? "#3ecf8e" : "#475569", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  {opt.label}
                  {sortKey === opt.key && <CheckCircle2 size={12} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Result count */}
      {!isLoading && demos && (
        <p style={{ fontSize: "0.8125rem", color: "#94a3b8", marginBottom: "1rem" }}>
          Showing {processed.length} of {demos.length} request{demos.length !== 1 ? "s" : ""}
          {statusFilter !== "all" && <> · status: <span style={{ color: "#3ecf8e" }}>{STATUS_CONFIG[statusFilter as DemoStatus]?.label}</span></>}
          {searchQuery.trim() && <> · search: <span style={{ color: "#3ecf8e" }}>"{searchQuery.trim()}"</span></>}
          {" · "}sorted by {currentSortLabel.toLowerCase()}
        </p>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4rem 0", gap: "0.75rem" }}>
          <Loader2 size={20} style={{ color: "#3ecf8e", animation: "spin 1s linear infinite" }} />
          <span style={{ color: "#64748b" }}>Loading demo requests…</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && processed.length === 0 && (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "4rem 1rem", textAlign: "center", background: "#ffffff" }}>
          <Play size={28} style={{ color: "#cbd5e1", margin: "0 auto 0.75rem" }} />
          <p style={{ fontWeight: 600, color: "#475569" }}>
            {searchQuery.trim() ? `No results for "${searchQuery.trim()}"` : statusFilter === "all" ? "No demo requests yet" : `No ${STATUS_CONFIG[statusFilter as DemoStatus]?.label.toLowerCase()} requests`}
          </p>
          <p style={{ fontSize: "0.875rem", color: "#94a3b8", marginTop: "0.25rem" }}>
            {hasActiveFilters ? "Try adjusting your search or clearing the filters." : "Demo requests submitted via the website will appear here."}
          </p>
          {hasActiveFilters && (
            <button onClick={() => { setStatusFilter("all"); setSearchQuery(""); }} style={{ marginTop: "1rem", padding: "0.5rem 1rem", fontSize: "0.875rem", border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", borderRadius: "0.375rem", cursor: "pointer" }}>
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Request list */}
      {!isLoading && processed.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {processed.map((d) => {
            const isExpanded = expandedId === d.id;
            const cfg = STATUS_CONFIG[d.status as DemoStatus] ?? STATUS_CONFIG.new;
            const createdDate = d.createdAt
              ? new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "—";

            return (
              <div
                key={d.id}
                style={{ border: `1px solid ${isExpanded ? "#3ecf8e" : "#e2e8f0"}`, borderRadius: "0.5rem", background: "#ffffff", overflow: "hidden", transition: "border-color 0.1s" }}
              >
                {/* Row summary */}
                <button
                  style={{ width: "100%", padding: "0.875rem 1rem", display: "flex", alignItems: "center", gap: "0.875rem", textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}
                  onClick={() => setExpandedId(isExpanded ? null : d.id)}
                >
                  <div style={{ width: "2rem", height: "2rem", borderRadius: "0.375rem", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(62,207,142,0.1)", flexShrink: 0 }}>
                    <Bot size={14} style={{ color: "#3ecf8e" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: "0.9375rem", color: "#0f172a", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</p>
                    <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "0.125rem 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.company}</p>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: "none" }} className="md:block">
                    <p style={{ fontSize: "0.8125rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.robotType}</p>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{createdDate}</p>
                  </div>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: cfg.color, flexShrink: 0 }}>{cfg.label}</span>
                  <div style={{ flexShrink: 0, color: "#94a3b8" }}>
                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ padding: "1rem", borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      {/* Contact */}
                      <div>
                        <p style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8", marginBottom: "0.5rem" }}>Contact</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", fontSize: "0.875rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                            <Mail size={13} style={{ color: "#94a3b8" }} />
                            <a href={`mailto:${d.email}`} style={{ color: "#3ecf8e", textDecoration: "none" }}>{d.email}</a>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                            <Building2 size={13} style={{ color: "#94a3b8" }} />
                            <span style={{ color: "#475569" }}>{d.company}</span>
                          </div>
                        </div>
                      </div>
                      {/* Robot */}
                      <div>
                        <p style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8", marginBottom: "0.5rem" }}>Robot Details</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", fontSize: "0.875rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                            <Bot size={13} style={{ color: "#94a3b8" }} />
                            <span style={{ color: "#475569" }}>{d.robotType}</span>
                          </div>
                          {d.preferredShowName && (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                              <Calendar size={13} style={{ color: "#94a3b8" }} />
                              <span style={{ color: "#475569" }}>{d.preferredShowName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Message */}
                    {d.message && (
                      <div>
                        <p style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8", marginBottom: "0.5rem" }}>Message</p>
                        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.375rem", padding: "0.75rem", fontSize: "0.875rem", color: "#475569", lineHeight: 1.6 }}>
                          <MessageSquare size={13} style={{ display: "inline", marginRight: "0.375rem", color: "#94a3b8", verticalAlign: "middle" }} />
                          {d.message}
                        </div>
                      </div>
                    )}

                    {/* Status actions */}
                    <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "0.875rem" }}>
                      <p style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8", marginBottom: "0.5rem" }}>Update Status</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                        {(["new", "contacted", "scheduled", "completed", "closed"] as DemoStatus[]).map((s) => {
                          const scfg = STATUS_CONFIG[s];
                          const isCurrent = (d.status ?? "new") === s;
                          return (
                            <button
                              key={s}
                              disabled={isCurrent || updateStatus.isPending}
                              onClick={() => updateStatus.mutate({ id: d.id, status: s })}
                              style={{
                                padding: "0.3125rem 0.75rem", fontSize: "0.8125rem", fontWeight: 500,
                                border: `1px solid ${isCurrent ? scfg.color : "#e2e8f0"}`,
                                background: isCurrent ? `${scfg.color}15` : "#ffffff",
                                color: isCurrent ? scfg.color : "#64748b",
                                borderRadius: "0.25rem", cursor: isCurrent ? "default" : "pointer",
                                display: "flex", alignItems: "center", gap: "0.375rem",
                                opacity: isCurrent || updateStatus.isPending ? (isCurrent ? 1 : 0.5) : 1,
                              }}
                            >
                              {s === "new"       && <Clock        size={11} />}
                              {s === "contacted" && <Phone        size={11} />}
                              {s === "scheduled" && <Calendar     size={11} />}
                              {s === "completed" && <CheckCircle2 size={11} />}
                              {s === "closed"    && <XCircle      size={11} />}
                              {scfg.label}
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

      {/* Close sort dropdown on outside click */}
      {sortOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={() => setSortOpen(false)} />
      )}
    </div>
  );
}
