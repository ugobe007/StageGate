import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Navbar from "@/components/Navbar";
import { ExternalLink, Mail, RefreshCw, ChevronDown, Check, X, Clock, Phone, AlertCircle } from "lucide-react";

type ProspectStatus = "new" | "contacted" | "responded" | "scheduled" | "converted" | "not_interested";

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

export default function AdminProspects() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());
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

  const { data, isLoading, refetch } = trpc.prospects.list.useQuery(
    { status: statusFilter || undefined },
    { enabled: !!user && user.role === "admin" }
  );

  const sendEmail = trpc.prospects.sendIntroEmail.useMutation({
    onSuccess: (_, vars) => {
      setSentIds(prev => { const next = new Set(Array.from(prev)); next.add(vars.prospectId); return next; });
      setSendingId(null);
      refetch();
    },
    onError: () => setSendingId(null),
  });

  const updateProspect = trpc.prospects.update.useMutation({
    onSuccess: () => refetch(),
  });

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

  const prospects = data?.prospects ?? [];

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
                {prospects.length} prospects
              </span>
              <button onClick={() => refetch()} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.40)", padding: "0.25rem" }}>
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Status filter tabs */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "2rem" }}>
          {["", "new", "contacted", "responded", "scheduled", "converted", "not_interested"].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.625rem",
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                padding: "0.3rem 0.75rem",
                border: `1px solid ${statusFilter === s ? "rgba(255,255,255,0.40)" : "rgba(255,255,255,0.10)"}`,
                background: statusFilter === s ? "rgba(255,255,255,0.06)" : "transparent",
                color: statusFilter === s ? "#fff" : "rgba(255,255,255,0.40)",
                cursor: "pointer",
                borderRadius: "0.125rem",
                transition: "all 0.15s",
              }}
            >
              {s === "" ? "All" : STATUS_CONFIG[s as ProspectStatus]?.label ?? s}
            </button>
          ))}
        </div>

        {/* Table */}
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "4rem 0", color: "rgba(255,255,255,0.30)", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
            Loading prospects...
          </div>
        ) : prospects.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 0", color: "rgba(255,255,255,0.30)", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
            No prospects found. Import the research database to get started.
          </div>
        ) : (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            {prospects.map((p, i) => {
              const cfg = STATUS_CONFIG[p.status as ProspectStatus] ?? STATUS_CONFIG.new;
              const isExpanded = expandedId === p.id;
              const shows = (p.shows as string[] | null) ?? [];

              return (
                <div key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {/* Main row */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1.5fr 1fr 1fr auto",
                      gap: "1.5rem",
                      alignItems: "center",
                      padding: "1rem 0",
                      cursor: "pointer",
                    }}
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  >
                    {/* Company + robot */}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", color: "rgba(255,255,255,0.20)", minWidth: "1.5rem" }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#fff" }}>{p.company}</span>
                        {p.website && (
                          <a href={p.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                            style={{ color: "rgba(255,255,255,0.25)", lineHeight: 1 }}>
                            <ExternalLink size={11} />
                          </a>
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
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: cfg.color, fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {cfg.icon}
                      {cfg.label}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          if (sentIds.has(p.id) || p.status === "contacted") return;
                          setSendingId(p.id);
                          sendEmail.mutate({ prospectId: p.id });
                        }}
                        disabled={sendingId === p.id || sentIds.has(p.id) || p.status === "contacted"}
                        style={{
                          display: "flex", alignItems: "center", gap: "0.3rem",
                          fontFamily: "var(--font-mono)", fontSize: "0.5625rem", letterSpacing: "0.08em", textTransform: "uppercase",
                          padding: "0.3rem 0.65rem",
                          border: `1px solid ${sentIds.has(p.id) || p.status === "contacted" ? "rgba(0,255,135,0.30)" : "rgba(245,158,11,0.40)"}`,
                          color: sentIds.has(p.id) || p.status === "contacted" ? "#00ff87" : "#f59e0b",
                          background: "transparent", cursor: sendingId === p.id ? "wait" : "pointer",
                          borderRadius: "0.125rem", opacity: sendingId === p.id ? 0.6 : 1,
                          transition: "all 0.15s",
                        }}
                      >
                        {sendingId === p.id ? (
                          <RefreshCw size={10} style={{ animation: "spin 1s linear infinite" }} />
                        ) : sentIds.has(p.id) || p.status === "contacted" ? (
                          <><Check size={10} /> Sent</>
                        ) : (
                          <><Mail size={10} /> Send Email</>
                        )}
                      </button>
                      <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.25)", transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{ padding: "0 0 1.5rem 2rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", margin: 0 }}>Contact Info</p>
                          <button
                            onClick={() => {
                              if (editingContactId === p.id) {
                                // Save
                                const fields = editContact[p.id] ?? {};
                                if (Object.keys(fields).length > 0) {
                                  const { emailConfidence, ...rest } = fields;
                                  updateProspect.mutate({
                                    id: p.id,
                                    ...rest,
                                    ...(emailConfidence ? { emailConfidence: emailConfidence as "verified" | "high" | "medium" | "low" } : {}),
                                  });
                                }
                                setEditingContactId(null);
                              } else {
                                setEditingContactId(p.id);
                                setEditContact(prev => ({
                                  ...prev,
                                  [p.id]: {
                                    contactName: p.contactName ?? "",
                                    contactTitle: p.contactTitle ?? "",
                                    contactEmail: p.contactEmail ?? "",
                                    contactLinkedIn: ((p as Record<string, unknown>).contactLinkedIn as string) ?? "",
                                    emailConfidence: (((p as Record<string, unknown>).emailConfidence as string) ?? "low") as "verified" | "high" | "medium" | "low",
                                  }
                                }));
                              }
                            }}
                            style={{
                              fontFamily: "var(--font-mono)", fontSize: "0.5625rem", letterSpacing: "0.08em",
                              textTransform: "uppercase", padding: "0.2rem 0.5rem",
                              border: `1px solid ${editingContactId === p.id ? "rgba(0,255,135,0.40)" : "rgba(255,255,255,0.12)"}`,
                              color: editingContactId === p.id ? "#00ff87" : "rgba(255,255,255,0.40)",
                              background: "transparent", cursor: "pointer", borderRadius: "0.125rem",
                            }}
                          >
                            {editingContactId === p.id ? (<><Check size={9} style={{ display: "inline", marginRight: 3 }} /><span>Save</span></>) : <span>Edit</span>}
                          </button>
                        </div>

                        {editingContactId === p.id ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            {([
                              { key: "contactName", label: "Name", placeholder: "Full name" },
                              { key: "contactTitle", label: "Title", placeholder: "VP of Operations" },
                              { key: "contactEmail", label: "Email", placeholder: "name@company.com" },
                              { key: "contactLinkedIn", label: "LinkedIn", placeholder: "https://linkedin.com/in/..." },
                            ] as { key: keyof typeof editContact[number]; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
                              <div key={key} style={{ display: "grid", gridTemplateColumns: "70px 1fr", alignItems: "center", gap: "0.5rem" }}>
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", color: "rgba(255,255,255,0.30)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
                                <input
                                  type="text"
                                  value={editContact[p.id]?.[key] ?? ""}
                                  onChange={e => setEditContact(prev => ({ ...prev, [p.id]: { ...prev[p.id], [key]: e.target.value } }))}
                                  placeholder={placeholder}
                                  style={{
                                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)",
                                    borderRadius: "0.125rem", color: "rgba(255,255,255,0.80)", fontSize: "0.8125rem",
                                    padding: "0.3rem 0.5rem", fontFamily: "var(--font-mono)", width: "100%",
                                  }}
                                />
                              </div>
                            ))}
                            <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", alignItems: "center", gap: "0.5rem" }}>
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", color: "rgba(255,255,255,0.30)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Confidence</span>
                              <select
                                value={editContact[p.id]?.emailConfidence ?? "low"}
                                onChange={e => setEditContact(prev => ({ ...prev, [p.id]: { ...prev[p.id], emailConfidence: e.target.value } }))}
                                style={{
                                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)",
                                  borderRadius: "0.125rem", color: "rgba(255,255,255,0.80)", fontSize: "0.8125rem",
                                  padding: "0.3rem 0.5rem", fontFamily: "var(--font-mono)",
                                }}
                              >
                                <option value="verified">Verified</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                              </select>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                            {p.contactName && (
                              <span style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.80)" }}>
                                {p.contactName}
                                {p.contactTitle && <span style={{ color: "rgba(255,255,255,0.35)", marginLeft: "0.5rem" }}>· {p.contactTitle}</span>}
                              </span>
                            )}
                            {p.contactEmail && (
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <a href={`mailto:${p.contactEmail}`} style={{ fontSize: "0.8125rem", color: "#f59e0b", fontFamily: "var(--font-mono)" }}>{p.contactEmail}</a>
                                {!!String((p as Record<string, unknown>).emailConfidence ?? "") && (
                                  <span style={{
                                    fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.08em", textTransform: "uppercase",
                                    padding: "0.1rem 0.35rem", borderRadius: "0.125rem",
                                    border: `1px solid ${{ verified: "rgba(0,255,135,0.40)", high: "rgba(0,255,135,0.25)", medium: "rgba(245,158,11,0.35)", low: "rgba(255,255,255,0.12)" }[String((p as Record<string, unknown>).emailConfidence ?? "")] ?? "rgba(255,255,255,0.12)"}`,
                                    color: { verified: "#00ff87", high: "rgba(0,255,135,0.70)", medium: "#f59e0b", low: "rgba(255,255,255,0.30)" }[String((p as Record<string, unknown>).emailConfidence ?? "")] ?? "rgba(255,255,255,0.30)",
                                  }}>
                                    {String((p as Record<string, unknown>).emailConfidence ?? "")}
                                  </span>
                                )}
                              </div>
                            )}
                            {!!(p as Record<string, unknown>).contactLinkedIn && (
                              <a href={String((p as Record<string, unknown>).contactLinkedIn)} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                <ExternalLink size={10} /><span>LinkedIn</span>
                              </a>
                            )}
                            {!p.contactName && !p.contactEmail && (
                              <span style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.20)" }}>No contact info — click Edit to add</span>
                            )}
                          </div>
                        )}

                        {p.videoMessageUrl && (
                          <div style={{ marginTop: "1rem" }}>
                            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(0,255,135,0.60)", marginBottom: "0.5rem" }}>Video Message Received</p>
                            <a href={p.videoMessageUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.8125rem", color: "#00ff87", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                              <ExternalLink size={12} /> View Video
                            </a>
                          </div>
                        )}
                      </div>
                      <div>
                        <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "0.75rem" }}>Notes</p>
                        <textarea
                          value={editNotes[p.id] ?? p.notes ?? ""}
                          onChange={e => setEditNotes(prev => ({ ...prev, [p.id]: e.target.value }))}
                          onBlur={() => {
                            if (editNotes[p.id] !== undefined && editNotes[p.id] !== p.notes) {
                              updateProspect.mutate({ id: p.id, notes: editNotes[p.id] });
                            }
                          }}
                          placeholder="Add notes..."
                          style={{
                            width: "100%", minHeight: "80px", background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.125rem",
                            color: "rgba(255,255,255,0.75)", fontSize: "0.8125rem", padding: "0.5rem 0.75rem",
                            fontFamily: "var(--font-sans)", resize: "vertical", lineHeight: 1.6,
                          }}
                        />
                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                          {(["new", "contacted", "responded", "scheduled", "converted", "not_interested"] as ProspectStatus[]).map(s => (
                            <button
                              key={s}
                              onClick={() => updateProspect.mutate({ id: p.id, status: s })}
                              style={{
                                fontFamily: "var(--font-mono)", fontSize: "0.5625rem", letterSpacing: "0.08em", textTransform: "uppercase",
                                padding: "0.25rem 0.55rem",
                                border: `1px solid ${p.status === s ? STATUS_CONFIG[s].color : "rgba(255,255,255,0.10)"}`,
                                color: p.status === s ? STATUS_CONFIG[s].color : "rgba(255,255,255,0.30)",
                                background: "transparent", cursor: "pointer", borderRadius: "0.125rem",
                              }}
                            >
                              {STATUS_CONFIG[s].label}
                            </button>
                          ))}
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
    </div>
  );
}
