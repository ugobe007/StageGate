import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Clock, CheckCircle2, XCircle, Loader2, AlertTriangle,
  ChevronDown, ChevronUp, Search, Bot, Calendar, Zap, Paperclip, RefreshCw
} from "lucide-react";

// ── Supabase light tokens ────────────────────────────────────────────────────
const S = {
  bg:      "#080808",
  surface: "#111111",
  surface2:"#1a1a1a",
  border:  "rgba(255,255,255,0.08)",
  text:    "#ececec",
  text2:   "rgba(255,255,255,0.55)",
  text3:   "rgba(255,255,255,0.30)",
  green:   "#00ff87",
  greenDim:"rgba(62,207,142,0.12)",
  amber:   "#f59e0b",
  blue:    "#3b82f6",
  red:     "#ef4444",
  purple:  "#8b5cf6",
  cyan:    "#06b6d4",
  font:    "'Inter','Space Grotesk',ui-sans-serif,system-ui,sans-serif",
};

// Inline status text — dot + label, no pill
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  new:         { label: "New",         color: S.blue,   icon: Clock },
  reviewing:   { label: "Reviewing",   color: S.amber,  icon: Loader2 },
  quoted:      { label: "Quoted",      color: S.purple, icon: Zap },
  approved:    { label: "Approved",    color: S.green,  icon: CheckCircle2 },
  in_progress: { label: "In Progress", color: S.cyan,   icon: Loader2 },
  completed:   { label: "Completed",   color: S.green,  icon: CheckCircle2 },
  cancelled:   { label: "Cancelled",   color: S.red,    icon: XCircle },
};

const URGENCY_COLOR: Record<string, string> = {
  low:    S.text3,
  normal: S.text3,
  high:   S.amber,
  urgent: S.red,
};

type ServiceRequest = {
  id: number;
  requestType: string;
  status: string;
  urgency: string | null;
  showName: string | null;
  showDate: string | null;
  robotName: string | null;
  details: string | null;
  quotedPrice: string | null;
  adminNotes: string | null;
  attachmentUrl: string | null;
  attachmentKey: string | null;
  attachmentName: string | null;
  createdAt: Date;
  userId: number;
};

// Inline status dot + text
function StatusText({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.new;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "0.8125rem", fontWeight: 500, color: cfg.color, whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, flexShrink: 0, display: "inline-block" }} />
      {cfg.label}
    </span>
  );
}

export default function AdminServiceRequests() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editQuote, setEditQuote] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const utils = trpc.useUtils();
  const { data: requests, isLoading, refetch } = trpc.company.getAllServiceRequests.useQuery();

  const updateStatus = trpc.company.updateServiceRequestStatus.useMutation({
    onSuccess: () => {
      utils.company.getAllServiceRequests.invalidate();
      setEditingId(null);
    },
  });

  const filtered = (requests ?? []).filter((r: ServiceRequest) => {
    const matchSearch = !search ||
      r.requestType.toLowerCase().includes(search.toLowerCase()) ||
      (r.showName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (r.robotName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = (requests ?? []).reduce((acc: Record<string, number>, r: ServiceRequest) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{ padding: "1.75rem 2rem", maxWidth: "64rem", margin: "0 auto", fontFamily: S.font, color: S.text }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600, color: S.text, margin: 0, letterSpacing: "-0.01em" }}>
            Service Requests
          </h1>
          <p style={{ fontSize: "0.8125rem", color: S.text2, margin: "0.25rem 0 0" }}>
            Incoming requests from robot companies — review, quote, and update status.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          style={{ padding: "0.375rem", border: `1px solid ${S.border}`, borderRadius: "0.375rem", background: S.surface, color: S.text3, cursor: "pointer", display: "flex", alignItems: "center" }}
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Status filter tabs — inline text, no pills */}
      <div style={{ display: "flex", alignItems: "center", gap: "0", borderBottom: `1px solid ${S.border}`, marginBottom: "1.25rem", overflowX: "auto" }}>
        {["all", "new", "reviewing", "quoted", "approved", "in_progress", "completed", "cancelled"].map(s => {
          const cfg = STATUS_CONFIG[s];
          const count = s === "all" ? (requests?.length ?? 0) : (counts[s] ?? 0);
          const isActive = statusFilter === s;
          const activeColor = s === "all" ? S.text : (cfg?.color ?? S.text2);
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: "0.5rem 0.875rem",
                fontSize: "0.8125rem",
                fontWeight: isActive ? 500 : 400,
                color: isActive ? activeColor : S.text2,
                background: "transparent",
                border: "none",
                borderBottom: isActive ? `2px solid ${activeColor}` : "2px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color 0.1s, border-color 0.1s",
                marginBottom: "-1px",
              }}
            >
              {cfg?.label ?? "All"}
              {count > 0 && (
                <span style={{ marginLeft: "0.375rem", fontSize: "0.6875rem", color: isActive ? activeColor : S.text3, fontVariantNumeric: "tabular-nums" }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: "1.25rem", maxWidth: "28rem" }}>
        <Search size={13} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: S.text3, pointerEvents: "none" }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by service type, show, or robot…"
          style={{
            width: "100%", paddingLeft: "2.25rem", paddingRight: "0.75rem", paddingTop: "0.4375rem", paddingBottom: "0.4375rem",
            border: `1px solid ${S.border}`, borderRadius: "0.375rem",
            background: S.surface, color: S.text, fontSize: "0.8125rem",
            outline: "none", boxSizing: "border-box" as const,
          }}
          onFocus={e => { e.currentTarget.style.borderColor = S.green; e.currentTarget.style.boxShadow = `0 0 0 2px ${S.greenDim}`; }}
          onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.boxShadow = "none"; }}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4rem 0", color: S.text3 }}>
          <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 0", color: S.text3 }}>
          <AlertTriangle size={28} style={{ margin: "0 auto 0.75rem", opacity: 0.4 }} />
          <p style={{ fontSize: "0.875rem" }}>No service requests match your filters.</p>
        </div>
      ) : (
        <div style={{ border: `1px solid ${S.border}`, borderRadius: "0.5rem", overflow: "hidden", background: S.surface }}>
          {/* Table header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
            gap: "1rem",
            padding: "0.5rem 1rem",
            background: S.bg,
            borderBottom: `1px solid ${S.border}`,
          }}>
            {["Request", "Show / Robot", "Urgency", "Status", ""].map((h, i) => (
              <span key={i} style={{ fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", color: S.text3 }}>{h}</span>
            ))}
          </div>

          {filtered.map((req: ServiceRequest, idx: number) => {
            const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.new;
            const isExpanded = expandedId === req.id;
            const isEditing = editingId === req.id;
            const urgencyColor = URGENCY_COLOR[req.urgency ?? "normal"] ?? S.text3;

            return (
              <div key={req.id} style={{ borderBottom: idx < filtered.length - 1 ? `1px solid ${S.border}` : "none" }}>
                {/* Row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
                    gap: "1rem",
                    padding: "0.75rem 1rem",
                    alignItems: "center",
                    cursor: "pointer",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = S.surface2; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                >
                  {/* Request type + meta */}
                  <div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 500, color: S.text }}>{req.requestType}</div>
                    <div style={{ fontSize: "0.75rem", color: S.text3, marginTop: "0.125rem" }}>
                      #{req.id} · {new Date(req.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Show / Robot */}
                  <div style={{ fontSize: "0.8125rem", color: S.text2 }}>
                    {req.showName && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <Calendar size={11} style={{ color: S.text3, flexShrink: 0 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{req.showName}</span>
                      </div>
                    )}
                    {req.robotName && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "0.125rem" }}>
                        <Bot size={11} style={{ color: S.text3, flexShrink: 0 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{req.robotName}</span>
                      </div>
                    )}
                    {!req.showName && !req.robotName && <span style={{ color: S.text3 }}>—</span>}
                  </div>

                  {/* Urgency — inline text */}
                  <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: urgencyColor, textTransform: "capitalize" }}>
                    {req.urgency && req.urgency !== "normal" ? req.urgency : <span style={{ color: S.text3 }}>—</span>}
                  </div>

                  {/* Status — inline dot + text */}
                  <StatusText status={req.status} />

                  {/* Expand toggle */}
                  <div style={{ color: S.text3, display: "flex", alignItems: "center" }}>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ padding: "1rem 1.25rem 1.25rem", borderTop: `1px solid ${S.border}`, background: S.bg }}>
                    {/* Detail grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1rem" }}>
                      {req.showDate && (
                        <div>
                          <div style={{ fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", color: S.text3, marginBottom: "0.25rem" }}>Show Date</div>
                          <div style={{ fontSize: "0.875rem", color: S.text }}>{req.showDate}</div>
                        </div>
                      )}
                      {req.urgency && (
                        <div>
                          <div style={{ fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", color: S.text3, marginBottom: "0.25rem" }}>Urgency</div>
                          <div style={{ fontSize: "0.875rem", color: urgencyColor, textTransform: "capitalize", fontWeight: 500 }}>{req.urgency}</div>
                        </div>
                      )}
                      {req.quotedPrice && (
                        <div>
                          <div style={{ fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", color: S.text3, marginBottom: "0.25rem" }}>Quoted Price</div>
                          <div style={{ fontSize: "0.875rem", color: S.green, fontWeight: 600 }}>{req.quotedPrice}</div>
                        </div>
                      )}
                    </div>

                    {/* Details text */}
                    {req.details && (
                      <div style={{ padding: "0.75rem 1rem", background: S.surface, border: `1px solid ${S.border}`, borderRadius: "0.375rem", fontSize: "0.875rem", color: S.text2, marginBottom: "1rem", lineHeight: 1.6 }}>
                        {req.details}
                      </div>
                    )}

                    {/* Attachment */}
                    {req.attachmentUrl && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", fontSize: "0.8125rem" }}>
                        <Paperclip size={13} style={{ color: S.text3, flexShrink: 0 }} />
                        <span style={{ color: S.text3 }}>Attachment:</span>
                        <a
                          href={req.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: S.green, textDecoration: "underline", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "20rem" }}
                        >
                          {req.attachmentName ?? "Download file"}
                        </a>
                      </div>
                    )}

                    {/* Admin notes */}
                    {req.adminNotes && !isEditing && (
                      <div style={{ padding: "0.75rem 1rem", background: S.greenDim, border: `1px solid rgba(62,207,142,0.25)`, borderRadius: "0.375rem", marginBottom: "1rem" }}>
                        <div style={{ fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", color: S.green, marginBottom: "0.25rem" }}>Admin Note</div>
                        <div style={{ fontSize: "0.875rem", color: S.text }}>{req.adminNotes}</div>
                      </div>
                    )}

                    {/* Edit form */}
                    {isEditing ? (
                      <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: "1rem" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                          <div>
                            <label style={{ fontSize: "0.75rem", fontWeight: 500, color: S.text2, display: "block", marginBottom: "0.375rem" }}>Status</label>
                            <select
                              value={editStatus}
                              onChange={e => setEditStatus(e.target.value)}
                              style={{ width: "100%", padding: "0.4375rem 0.75rem", border: `1px solid ${S.border}`, borderRadius: "0.375rem", background: S.surface, color: S.text, fontSize: "0.8125rem", outline: "none" }}
                            >
                              {Object.entries(STATUS_CONFIG).map(([v, c]) => (
                                <option key={v} value={v}>{c.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: "0.75rem", fontWeight: 500, color: S.text2, display: "block", marginBottom: "0.375rem" }}>Quoted Price</label>
                            <input
                              value={editQuote}
                              onChange={e => setEditQuote(e.target.value)}
                              placeholder="e.g. $2,500"
                              style={{ width: "100%", padding: "0.4375rem 0.75rem", border: `1px solid ${S.border}`, borderRadius: "0.375rem", background: S.surface, color: S.text, fontSize: "0.8125rem", outline: "none", boxSizing: "border-box" as const }}
                              onFocus={e => { e.currentTarget.style.borderColor = S.green; }}
                              onBlur={e => { e.currentTarget.style.borderColor = S.border; }}
                            />
                          </div>
                        </div>
                        <div style={{ marginBottom: "0.75rem" }}>
                          <label style={{ fontSize: "0.75rem", fontWeight: 500, color: S.text2, display: "block", marginBottom: "0.375rem" }}>Admin Notes</label>
                          <textarea
                            value={editNotes}
                            onChange={e => setEditNotes(e.target.value)}
                            rows={3}
                            placeholder="Notes visible to the client…"
                            style={{ width: "100%", padding: "0.4375rem 0.75rem", border: `1px solid ${S.border}`, borderRadius: "0.375rem", background: S.surface, color: S.text, fontSize: "0.8125rem", outline: "none", resize: "vertical", boxSizing: "border-box" as const }}
                            onFocus={e => { e.currentTarget.style.borderColor = S.green; }}
                            onBlur={e => { e.currentTarget.style.borderColor = S.border; }}
                          />
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            onClick={() => setEditingId(null)}
                            style={{ padding: "0.375rem 0.875rem", border: `1px solid ${S.border}`, borderRadius: "0.375rem", background: S.surface, color: S.text2, fontSize: "0.8125rem", cursor: "pointer" }}
                          >
                            Cancel
                          </button>
                          <button
                            disabled={updateStatus.isPending}
                            onClick={() => updateStatus.mutate({
                              id: req.id,
                              status: editStatus as ServiceRequest["status"],
                              quotedPrice: editQuote || undefined,
                              adminNotes: editNotes || undefined,
                            })}
                            style={{ padding: "0.375rem 0.875rem", border: `1px solid ${S.green}`, borderRadius: "0.375rem", background: S.green, color: "#ececec", fontSize: "0.8125rem", fontWeight: 600, cursor: updateStatus.isPending ? "wait" : "pointer", display: "flex", alignItems: "center", gap: "0.375rem", opacity: updateStatus.isPending ? 0.7 : 1 }}
                          >
                            {updateStatus.isPending && <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />}
                            Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(req.id);
                          setEditStatus(req.status);
                          setEditQuote(req.quotedPrice ?? "");
                          setEditNotes(req.adminNotes ?? "");
                        }}
                        style={{ padding: "0.375rem 0.875rem", border: `1px solid ${S.border}`, borderRadius: "0.375rem", background: S.surface, color: S.text2, fontSize: "0.8125rem", cursor: "pointer", transition: "background 0.1s, color 0.1s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = S.surface2; e.currentTarget.style.color = S.text; }}
                        onMouseLeave={e => { e.currentTarget.style.background = S.surface; e.currentTarget.style.color = S.text2; }}
                      >
                        Update Status / Add Quote
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
