import { useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2, Circle, Clock, AlertTriangle, Loader2, AlertCircle,
  Package, Truck, DollarSign, Warehouse, Radio,
  Calendar, ChevronDown, ChevronRight,
} from "lucide-react";

const PHASE_INFO: Record<number, { label: string; icon: React.ReactNode; description: string }> = {
  1: { label: "Origin Country",       icon: <Package size={16} />,   description: "Robot is being prepared for export" },
  2: { label: "International Freight", icon: <Truck size={16} />,    description: "In transit — international shipment" },
  3: { label: "U.S. Customs",          icon: <AlertCircle size={16} />, description: "Clearing U.S. customs & import review" },
  4: { label: "Airport Recovery",      icon: <Truck size={16} />,    description: "StageGate is retrieving your robot" },
  5: { label: "Warehouse",             icon: <Warehouse size={16} />, description: "Secure storage & charging at StageGate" },
  6: { label: "Staging & Activation",  icon: <Radio size={16} />,    description: "Full activation, calibration & demo prep" },
  7: { label: "Show Delivery",         icon: <Truck size={16} />,    description: "Delivering robot to convention floor" },
  8: { label: "Live Show Support",     icon: <CheckCircle2 size={16} />, description: "StageGate team on-site" },
  9: { label: "Packdown & Return",     icon: <Package size={16} />,  description: "Packing, storage, or return shipping" },
};

const STATUS_COLORS: Record<string, string> = {
  pending:     "rgba(255,255,255,0.25)",
  in_progress: "#f59e0b",
  completed:   "#00ff87",
  blocked:     "#ef4444",
  escalated:   "#ef4444",
};

const CP_TYPE_TO_PHASE: Record<string, number> = {
  shipping_out: 2, customs: 3, airport_arrival: 4, receiving: 4,
  warehouse_in: 5, staging: 6, activation_test: 6, booth_delivery: 7,
  show_floor_checkin: 8, show_end: 8, return_pickup: 9, warehouse_return: 9, completed: 9,
};

function fmt$(v: string | null | undefined) {
  const n = parseFloat(v ?? "0");
  return isNaN(n) ? "—" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function RobotTracker() {
  const [, params] = useRoute("/track/:token");
  const token = params?.token ?? "";
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);
  const [acceptName, setAcceptName] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading, error } = (trpc.logistics as any).getPublicTracker.useQuery(
    { token },
    { enabled: !!token, retry: false }
  ) as { data?: { workflow: { id: number; robotCompany: string | null; robotName: string | null; robotModel: string | null; showName: string | null; showStartDate: string | null; showEndDate: string | null; targetArrivalDate: string | null; status: string; totalEstimatedCostUsd: string | null; costEstimateAcceptedAt: string | null }; checkpoints: Array<{ id: number; type: string; phaseNumber: number | null; title: string; status: string; dueAt: string | null; completedAt: string | null; responsibleParty: string | null; customerVisibleNote: string | null }>; costs: Array<{ id: number; phaseNumber: number; description: string; estimatedAmountUsd: string | null }>; latestTracking: Array<{ id: number; carrier: string; trackingNumber: string; statusSummary: string | null; location: string | null; polledAt: string | null; createdAt: string }> }; isLoading: boolean; error: unknown };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const acceptEstimate = (trpc.logistics as any).acceptCostEstimatePublic.useMutation({
    onSuccess: (res: { success: boolean; alreadyAccepted: boolean }) => {
      setAccepted(true);
      setAccepting(false);
      if (res.alreadyAccepted) alert("This estimate was already accepted.");
    },
    onError: () => setAccepting(false),
  });

  if (!token) {
    return (
      <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.40)", fontSize: "1rem" }}>No tracking token provided.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={28} style={{ color: "#f59e0b", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: "100vh", background: "#080808", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
        <AlertCircle size={40} style={{ color: "#ef4444" }} />
        <p style={{ color: "#ececec", fontSize: "1.125rem", fontWeight: 600 }}>Tracking link not found</p>
        <p style={{ color: "rgba(255,255,255,0.40)", fontSize: "0.875rem" }}>This link may have expired or the token is invalid.</p>
      </div>
    );
  }

  const { workflow, checkpoints, costs, latestTracking } = data;

  // Determine current phase from checkpoints
  const inProgressCp = checkpoints.find(cp => cp.status === "in_progress");
  const currentPhase = inProgressCp?.phaseNumber ?? CP_TYPE_TO_PHASE[inProgressCp?.type ?? ""] ?? 1;

  // Build phase-to-checkpoints map
  const cpByPhase = checkpoints.reduce<Record<number, typeof checkpoints>>((acc, cp) => {
    const ph = cp.phaseNumber ?? CP_TYPE_TO_PHASE[cp.type] ?? 1;
    (acc[ph] ??= []).push(cp);
    return acc;
  }, {});

  // Determine phase status
  function phaseStatus(phaseNum: number): "completed" | "in_progress" | "pending" {
    const cps = cpByPhase[phaseNum] ?? [];
    if (cps.length === 0) return phaseNum < currentPhase ? "completed" : "pending";
    if (cps.every(c => c.status === "completed")) return "completed";
    if (cps.some(c => c.status === "in_progress" || c.status === "blocked")) return "in_progress";
    return "pending";
  }

  const costByPhase = costs.reduce<Record<number, typeof costs>>((acc, c) => {
    (acc[c.phaseNumber] ??= []).push(c);
    return acc;
  }, {});

  const totalEstimated = costs.reduce((s, c) => s + parseFloat(c.estimatedAmountUsd ?? "0"), 0);
  const hasCosts = costs.length > 0;
  const estimateAccepted = !!workflow.costEstimateAcceptedAt || accepted;

  const phases = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#ececec", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Top nav strip */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <svg width="22" height="22" viewBox="0 0 80 90" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 88 L4 6 L76 6 L76 88" stroke="#00ff87" strokeWidth="7" strokeLinejoin="miter" fill="none"/>
          <path d="M19 88 L19 22 L64 22 L64 88" stroke="#00ff87" strokeWidth="5" strokeLinejoin="miter" fill="none"/>
          <path d="M34 52 L42 62 L56 46" stroke="#00ff87" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
        <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#ececec" }}>StageGate</span>
        <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.30)", marginLeft: "auto" }}>Robot Deployment Tracker</span>
      </div>

      <div style={{ maxWidth: "48rem", margin: "0 auto", padding: "2rem 1.5rem" }}>
        {/* Deployment header */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.30)", margin: "0 0 0.375rem" }}>DEPLOYMENT TRACKING</p>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem", color: "#ececec" }}>
            {workflow.robotCompany ?? "Your Robot"}
            {workflow.robotName && <span style={{ color: "#f59e0b" }}> — {workflow.robotName}</span>}
          </h1>
          {workflow.showName && (
            <p style={{ fontSize: "0.9375rem", color: "rgba(255,255,255,0.55)", margin: "0 0 0.25rem", display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <Calendar size={14} style={{ color: "#64748b" }} /> {workflow.showName}
              {workflow.showStartDate && ` · ${new Date(workflow.showStartDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
            </p>
          )}
          <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.75rem", padding: "0.25rem 0.75rem", borderRadius: "9999px", border: `1px solid ${STATUS_COLORS[workflow.status ?? "active"]}`, color: STATUS_COLORS[workflow.status ?? "active"] }}>
              {workflow.status}
            </span>
            {workflow.robotModel && <span style={{ fontSize: "0.75rem", padding: "0.25rem 0.75rem", borderRadius: "9999px", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.55)" }}>{workflow.robotModel}</span>}
          </div>
        </div>

        {/* Progress bar */}
        {(() => {
          const completedCount = checkpoints.filter(c => c.status === "completed").length;
          const total = checkpoints.length;
          const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
          return (
            <div style={{ marginBottom: "2rem", background: "#111111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.625rem", padding: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#ececec" }}>Overall Progress</span>
                <span style={{ fontSize: "0.875rem", fontWeight: 700, color: pct === 100 ? "#00ff87" : "#f59e0b" }}>{pct}%</span>
              </div>
              <div style={{ height: "0.5rem", background: "#1a1a1a", borderRadius: "9999px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "#00ff87" : "#f59e0b", borderRadius: "9999px", transition: "width 0.5s" }} />
              </div>
              <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.30)", marginTop: "0.5rem" }}>{completedCount} of {total} checkpoints complete</p>
            </div>
          );
        })()}

        {/* Latest carrier status */}
        {latestTracking.length > 0 && (
          <div style={{ marginBottom: "2rem", background: "#111111", border: "1px solid rgba(59,130,246,0.3)", borderRadius: "0.625rem", padding: "1rem" }}>
            <p style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#3b82f6", marginBottom: "0.5rem" }}>Latest Carrier Update</p>
            <p style={{ fontSize: "0.9375rem", color: "#ececec", margin: "0 0 0.25rem" }}>{latestTracking[0].statusSummary}</p>
            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.30)", display: "flex", gap: "0.75rem" }}>
              <span>{latestTracking[0].carrier?.toUpperCase()}</span>
              <span>{latestTracking[0].trackingNumber}</span>
              {latestTracking[0].location && <span>{latestTracking[0].location}</span>}
              <span>{new Date(latestTracking[0].polledAt ?? latestTracking[0].createdAt).toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* 9-Phase Journey */}
        <div style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "#ececec", marginBottom: "1rem" }}>Robot Journey</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {phases.map(phaseNum => {
              const info = PHASE_INFO[phaseNum];
              const st = phaseStatus(phaseNum);
              const isExpanded = expandedPhase === phaseNum;
              const cps = cpByPhase[phaseNum] ?? [];
              const phaseCosts = costByPhase[phaseNum] ?? [];
              const phaseTotal = phaseCosts.reduce((s, c) => s + parseFloat(c.estimatedAmountUsd ?? "0"), 0);

              return (
                <div key={phaseNum} style={{ border: `1px solid ${isExpanded ? "rgba(245,158,11,0.4)" : st === "in_progress" ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.06)"}`, borderRadius: "0.5rem", background: st === "in_progress" ? "rgba(245,158,11,0.04)" : "#111111", overflow: "hidden" }}>
                  <button
                    onClick={() => setExpandedPhase(isExpanded ? null : phaseNum)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.875rem", padding: "0.875rem 1rem", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
                  >
                    {/* Status icon */}
                    <div style={{ flexShrink: 0, width: "1.5rem", height: "1.5rem", borderRadius: "9999px", display: "flex", alignItems: "center", justifyContent: "center", background: st === "completed" ? "rgba(0,255,135,0.15)" : st === "in_progress" ? "rgba(245,158,11,0.15)" : "#1a1a1a", border: `1px solid ${st === "completed" ? "rgba(0,255,135,0.4)" : st === "in_progress" ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.1)"}` }}>
                      {st === "completed" ? <CheckCircle2 size={13} style={{ color: "#00ff87" }} /> : st === "in_progress" ? <Clock size={13} style={{ color: "#f59e0b" }} /> : <Circle size={13} style={{ color: "rgba(255,255,255,0.20)" }} />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.30)", flexShrink: 0 }}>Phase {phaseNum}</span>
                        <span style={{ fontSize: "0.9375rem", fontWeight: st === "in_progress" ? 600 : 500, color: st === "pending" ? "rgba(255,255,255,0.40)" : "#ececec" }}>{info.label}</span>
                        {st === "in_progress" && <span style={{ fontSize: "0.6875rem", padding: "0.125rem 0.5rem", borderRadius: "9999px", background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>In Progress</span>}
                        {st === "completed" && <span style={{ fontSize: "0.6875rem", color: "#00ff87" }}>✓</span>}
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.30)", margin: "0.125rem 0 0" }}>{info.description}</p>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
                      {phaseTotal > 0 && <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.40)" }}>{fmt$(phaseTotal.toFixed(2))}</span>}
                      {isExpanded ? <ChevronDown size={13} style={{ color: "rgba(255,255,255,0.30)" }} /> : <ChevronRight size={13} style={{ color: "rgba(255,255,255,0.30)" }} />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "0.875rem 1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {/* Checkpoints */}
                      {cps.length > 0 && (
                        <div>
                          <p style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", margin: "0 0 0.5rem" }}>Checkpoints</p>
                          {cps.map(cp => (
                            <div key={cp.id} style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.5rem 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              {cp.status === "completed" ? <CheckCircle2 size={13} style={{ color: "#00ff87", flexShrink: 0 }} /> : cp.status === "in_progress" ? <Clock size={13} style={{ color: "#f59e0b", flexShrink: 0 }} /> : <Circle size={13} style={{ color: "rgba(255,255,255,0.20)", flexShrink: 0 }} />}
                              <div style={{ flex: 1 }}>
                                <span style={{ fontSize: "0.875rem", color: cp.status === "pending" ? "rgba(255,255,255,0.40)" : "#ececec" }}>{cp.title}</span>
                                {cp.dueAt && <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.25)", marginLeft: "0.5rem" }}>Due {new Date(cp.dueAt).toLocaleDateString()}</span>}
                                {cp.completedAt && <span style={{ fontSize: "0.75rem", color: "#00ff87", marginLeft: "0.5rem" }}>✓ {new Date(cp.completedAt).toLocaleDateString()}</span>}
                              </div>
                              {cp.customerVisibleNote && (
                                <span style={{ fontSize: "0.75rem", color: "#3b82f6", maxWidth: "14rem", textAlign: "right" }}>{cp.customerVisibleNote}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Phase cost breakdown */}
                      {phaseCosts.length > 0 && (
                        <div>
                          <p style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", margin: "0 0 0.5rem" }}>Cost Breakdown</p>
                          {phaseCosts.map(c => (
                            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              <span style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.70)" }}>{c.description}</span>
                              <span style={{ fontSize: "0.875rem", color: "#ececec", fontVariantNumeric: "tabular-nums" }}>{fmt$(c.estimatedAmountUsd)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Cost estimate acceptance */}
        {hasCosts && (
          <div style={{ marginBottom: "2rem", background: "#111111", border: `1px solid ${estimateAccepted ? "rgba(0,255,135,0.3)" : "rgba(255,255,255,0.10)"}`, borderRadius: "0.625rem", padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div>
                <p style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", marginBottom: "0.25rem" }}>Cost Estimate</p>
                <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "#ececec", margin: 0 }}>{fmt$(totalEstimated.toFixed(2))}</p>
                <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.30)", marginTop: "0.25rem" }}>Estimated total — {costs.length} line items across {Object.keys(costByPhase).length} phases</p>
              </div>
              <DollarSign size={28} style={{ color: "#64748b" }} />
            </div>

            {estimateAccepted ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#00ff87", fontSize: "0.875rem", fontWeight: 500 }}>
                <CheckCircle2 size={16} /> Estimate accepted — StageGate team will be in touch.
              </div>
            ) : (
              <div>
                <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.55)", marginBottom: "0.75rem" }}>Review and accept this estimate to proceed. Our team will contact you to confirm payment terms.</p>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <input
                    placeholder="Your name"
                    value={acceptName}
                    onChange={e => setAcceptName(e.target.value)}
                    style={{ flex: 1, minWidth: "12rem", fontSize: "0.875rem", background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.15)", color: "#ececec", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", outline: "none" }}
                  />
                  <button
                    onClick={() => { if (!acceptName.trim()) { alert("Please enter your name to accept."); return; } setAccepting(true); acceptEstimate.mutate({ token, acceptedBy: acceptName.trim() }); }}
                    disabled={accepting || !acceptName.trim()}
                    style={{ fontSize: "0.875rem", fontWeight: 600, padding: "0.5rem 1.25rem", background: "#00ff87", color: "#080808", border: "none", borderRadius: "0.375rem", cursor: "pointer" }}
                  >
                    {accepting ? "Saving…" : "Accept Estimate"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1.5rem", textAlign: "center" }}>
          <p style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.25)" }}>
            Questions? Email <a href="mailto:hello@onstage.bot" style={{ color: "#00ff87", textDecoration: "none" }}>hello@onstage.bot</a>
          </p>
          <p style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.15)", marginTop: "0.25rem" }}>
            StageGate — Robot Deployment Infrastructure · Las Vegas, NV
          </p>
        </div>
      </div>
    </div>
  );
}
