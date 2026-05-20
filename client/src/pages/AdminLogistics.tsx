import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  Truck, CheckCircle2, Clock, AlertTriangle, AlertCircle,
  Loader2, ChevronDown, ChevronRight, ExternalLink,
  Package, Calendar, BarChart3, RefreshCw, Warehouse,
  DollarSign, Link2, Cpu, Radio, Copy, Check,
} from "lucide-react";

const CHECKPOINT_STATUS_COLORS: Record<string, string> = {
  pending:     "rgba(255,255,255,0.30)",
  in_progress: "#f59e0b",
  completed:   "#00ff87",
  blocked:     "#ef4444",
  escalated:   "#ef4444",
  skipped:     "rgba(255,255,255,0.30)",
};

const WORKFLOW_STATUS_COLORS: Record<string, string> = {
  active:    "#f59e0b",
  completed: "#00ff87",
  cancelled: "rgba(255,255,255,0.30)",
  on_hold:   "#3b82f6",
};

const PHASE_LABELS: Record<number, string> = {
  1: "Origin Country", 2: "International Freight", 3: "U.S. Customs",
  4: "Airport Recovery", 5: "Warehouse", 6: "Staging & Activation",
  7: "Show Delivery", 8: "Live Support", 9: "Packdown & Storage",
};

const PANEL_TABS = ["Checkpoints", "Costs", "Robot Specs", "Carrier Tracking"] as const;
type PanelTab = typeof PANEL_TABS[number];

function fmt$(v: string | null | undefined) {
  const n = parseFloat(v ?? "0");
  return isNaN(n) ? "—" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function AdminLogistics() {
  const { user, loading: authLoading } = useAuth();
  const [expandedWorkflow, setExpandedWorkflow] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Record<number, PanelTab>>({});
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "overdue">("active");
  const [assigningBay, setAssigningBay] = useState<number | null>(null);
  const [copiedToken, setCopiedToken] = useState<number | null>(null);
  const [trackingInput, setTrackingInput] = useState<Record<number, { carrier: string; number: string }>>({});

  const utils = trpc.useUtils();
  const { data: workflowsData, isLoading, refetch } = trpc.logistics.getAllWorkflows.useQuery(undefined, {
    refetchInterval: 60_000, staleTime: 30_000,
  });
  const { data: baysData = [] } = trpc.warehouse.listBays.useQuery(undefined, { staleTime: 60_000 });

  const updateCheckpoint = trpc.logistics.updateCheckpoint.useMutation({
    onSuccess: () => { refetch(); toast.success("Checkpoint updated"); },
    onError: (e) => toast.error(e.message),
  });
  const assignBay = trpc.logistics.assignBay.useMutation({
    onSuccess: () => { refetch(); utils.warehouse.listBays.invalidate(); setAssigningBay(null); toast.success("Bay assigned"); },
    onError: (e) => { toast.error(e.message); setAssigningBay(null); },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generateCostEstimate = (trpc.logistics as any).generateCostEstimate.useMutation({
    onSuccess: (d: { lineItems: number; total: string }) => { refetch(); toast.success(`Cost estimate generated — ${d.lineItems} line items, total ${fmt$(d.total)}`); },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generateToken = (trpc.logistics as any).generateTrackingToken.useMutation({
    onSuccess: () => { refetch(); toast.success("Tracking link generated"); },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addTracking = (trpc.logistics as any).addTrackingNumber.useMutation({
    onSuccess: () => { refetch(); toast.success("Tracking number saved"); },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pollTracking = (trpc.logistics as any).pollCarrierTracking.useMutation({
    onSuccess: (d: { statusSummary: string }) => toast.success(`Carrier status: ${d.statusSummary}`),
    onError: (e: { message: string }) => toast.error(e.message),
  });

  // Per-workflow cost and tracking data (loaded lazily when expanded)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const costsQuery = (trpc.logistics as any).getCosts.useQuery(
    { workflowId: expandedWorkflow! },
    { enabled: !!expandedWorkflow && (activeTab[expandedWorkflow ?? 0] === "Costs" || false) }
  ) as { isLoading: boolean; data?: Array<{ id: number; phaseNumber: number; phaseName: string; description: string; estimatedAmountUsd: string | null; actualAmountUsd: string | null; vendorName: string | null; paidAt: string | null }> };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trackingQuery = (trpc.logistics as any).getTrackingHistory.useQuery(
    { workflowId: expandedWorkflow! },
    { enabled: !!expandedWorkflow && (activeTab[expandedWorkflow ?? 0] === "Carrier Tracking" || false) }
  ) as { isLoading: boolean; data?: Array<{ id: number; carrier: string; trackingNumber: string; statusSummary: string | null; location: string | null; eventCode: string | null; polledAt: string | null; createdAt: string }> };

  if (authLoading) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "16rem" }}><Loader2 size={24} style={{ color: "rgba(255,255,255,0.30)", animation: "spin 1s linear infinite" }} /></div>;
  }
  if (!user || user.role !== "admin") {
    return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "16rem", gap: "0.75rem" }}><AlertCircle size={28} style={{ color: "#ef4444" }} /><p style={{ color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>Admin access required</p></div>;
  }

  const now = new Date();
  const workflows = workflowsData ?? [];
  const enriched = workflows.map(w => {
    const overdueCount = w.checkpoints.filter(cp => ["pending", "in_progress"].includes(cp.status) && cp.dueAt && new Date(cp.dueAt) < now).length;
    const completedCount = w.checkpoints.filter(c => c.status === "completed").length;
    const escalatedCount = w.checkpoints.filter(c => c.status === "escalated").length;
    return { ...w, overdueCount, completedCount, escalatedCount };
  });
  const filtered = enriched.filter(w => {
    if (filterStatus === "active") return w.workflow.status === "active";
    if (filterStatus === "overdue") return w.overdueCount > 0;
    return true;
  });
  const totalActive = enriched.filter(w => w.workflow.status === "active").length;
  const totalOverdue = enriched.filter(w => w.overdueCount > 0).length;
  const totalEscalated = enriched.reduce((sum, w) => sum + w.escalatedCount, 0);
  const bayMap = new Map(baysData.map(b => [b.id, b]));

  return (
    <div style={{ maxWidth: "64rem", margin: "0 auto", padding: "2rem", color: "#ececec" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "2rem" }}>
        <div>
          <p style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.30)", margin: "0 0 0.25rem" }}>STAGEGATE / LOGISTICS</p>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#ececec", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Truck size={18} style={{ color: "#f59e0b" }} /> Robot Deployment Tracker
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#64748b", margin: "0.25rem 0 0" }}>Workflows · Costs · Checkpoints · Carrier Tracking</p>
        </div>
        <button onClick={() => refetch()} style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", color: "#64748b", background: "#fff", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.375rem", padding: "0.375rem 0.75rem", cursor: "pointer" }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Active Workflows", value: totalActive, icon: <BarChart3 size={15} style={{ color: "#f59e0b" }} />, color: "#ececec" },
          { label: "Overdue", value: totalOverdue, icon: <Clock size={15} style={{ color: "#f59e0b" }} />, color: totalOverdue > 0 ? "#f59e0b" : "#ececec" },
          { label: "Escalated", value: totalEscalated, icon: <AlertTriangle size={15} style={{ color: "#ef4444" }} />, color: totalEscalated > 0 ? "#ef4444" : "#ececec" },
          { label: "Total Deployments", value: enriched.length, icon: <Truck size={15} style={{ color: "#64748b" }} />, color: "#ececec" },
        ].map(stat => (
          <div key={stat.label} style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.5rem", padding: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>{stat.icon}<span style={{ fontSize: "0.75rem", color: "#64748b" }}>{stat.label}</span></div>
            <p style={{ fontSize: "1.5rem", fontWeight: 700, color: stat.color, margin: 0 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: "1.5rem" }}>
        {(["all", "active", "overdue"] as const).map(f => (
          <button key={f} onClick={() => setFilterStatus(f)} style={{ padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 500, background: "none", border: "none", borderBottom: `2px solid ${filterStatus === f ? "#f59e0b" : "transparent"}`, color: filterStatus === f ? "#ececec" : "#64748b", cursor: "pointer", marginBottom: "-1px" }}>
            {f === "overdue" ? `Overdue (${totalOverdue})` : f === "active" ? `Active (${totalActive})` : `All (${enriched.length})`}
          </button>
        ))}
      </div>

      {/* Workflow list */}
      {isLoading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "10rem" }}><Loader2 size={20} style={{ color: "rgba(255,255,255,0.30)", animation: "spin 1s linear infinite" }} /></div>
      ) : filtered.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "10rem", gap: "0.75rem" }}>
          <Truck size={28} style={{ color: "#cbd5e1" }} />
          <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.30)" }}>{filterStatus === "overdue" ? "No overdue checkpoints — all workflows on track." : "No logistics workflows yet."}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {filtered.map(w => {
            const isExpanded = expandedWorkflow === w.workflow.id;
            const currentTab: PanelTab = activeTab[w.workflow.id] ?? "Checkpoints";
            const progress = w.checkpoints.length > 0 ? Math.round((w.completedCount / w.checkpoints.length) * 100) : 0;
            const assignedBay = w.workflow.warehouseBayId ? bayMap.get(w.workflow.warehouseBayId) : null;
            const wf = w.workflow as typeof w.workflow & {
              trackingToken?: string; totalEstimatedCostUsd?: string; totalActualCostUsd?: string;
              robotModel?: string; originCountry?: string; declaredValueUsd?: string;
              robotWeightKg?: string; batteryType?: string; customerEmail?: string;
              costEstimateAcceptedAt?: string | Date | null;
            };
            const trackingUrl = wf.trackingToken ? `${window.location.origin}/track/${wf.trackingToken}` : null;

            return (
              <div key={w.workflow.id} style={{ border: `1px solid ${isExpanded ? "#f59e0b" : "rgba(255,255,255,0.08)"}`, borderRadius: "0.5rem", background: "#111111", overflow: "hidden" }}>
                {/* Workflow header row */}
                <button onClick={() => setExpandedWorkflow(isExpanded ? null : w.workflow.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: "1rem", padding: "0.875rem 1rem", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "#ececec" }}>{w.workflow.robotCompany}</span>
                      {w.workflow.robotName && <span style={{ fontSize: "0.8125rem", color: "#64748b", display: "flex", alignItems: "center", gap: "0.25rem" }}><Package size={11} /> {w.workflow.robotName}</span>}
                      <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: WORKFLOW_STATUS_COLORS[w.workflow.status] ?? "rgba(255,255,255,0.30)" }}>{w.workflow.status}</span>
                      {w.overdueCount > 0 && <span style={{ fontSize: "0.75rem", color: "#f59e0b" }}><Clock size={10} /> {w.overdueCount} overdue</span>}
                      {wf.totalEstimatedCostUsd && <span style={{ fontSize: "0.75rem", color: "#00ff87" }}>{fmt$(wf.totalEstimatedCostUsd)} est.</span>}
                      {wf.costEstimateAcceptedAt && <span style={{ fontSize: "0.75rem", color: "#00ff87" }}>✓ Accepted</span>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.25rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.30)", flexWrap: "wrap" }}>
                      {w.workflow.showName && <span><Calendar size={10} /> {w.workflow.showName}</span>}
                      <span><CheckCircle2 size={10} /> {w.completedCount}/{w.checkpoints.length}</span>
                      {wf.originCountry && <span>Origin: {wf.originCountry}</span>}
                      {wf.robotWeightKg && <span>{wf.robotWeightKg} kg</span>}
                      {assignedBay && <span><Warehouse size={10} /> {assignedBay.name}</span>}
                      {trackingUrl && <span style={{ color: "#3b82f6" }}><Link2 size={10} /> Tracking link active</span>}
                    </div>
                  </div>
                  <div style={{ width: "5rem", flexShrink: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6875rem", color: "rgba(255,255,255,0.30)", marginBottom: "0.25rem" }}><span>Progress</span><span>{progress}%</span></div>
                    <div style={{ height: "0.375rem", background: "#1a1a1a", borderRadius: "9999px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${progress}%`, background: progress === 100 ? "#00ff87" : "#f59e0b", borderRadius: "9999px" }} />
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.30)", flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: "rgba(255,255,255,0.30)", flexShrink: 0 }} />}
                </button>

                {/* Expanded panel */}
                {isExpanded && (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    {/* Action bar */}
                    <div style={{ display: "flex", gap: "0.5rem", padding: "0.75rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.08)", flexWrap: "wrap" }}>
                      <button
                        onClick={() => generateCostEstimate.mutate({ workflowId: w.workflow.id })}
                        disabled={generateCostEstimate.isPending}
                        style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", padding: "0.375rem 0.75rem", border: "1px solid rgba(0,255,135,0.35)", background: "transparent", color: "#00ff87", borderRadius: "0.375rem", cursor: "pointer" }}
                      >
                        <DollarSign size={12} /> Generate Cost Estimate
                      </button>
                      <button
                        onClick={() => { generateToken.mutate({ workflowId: w.workflow.id }); }}
                        disabled={generateToken.isPending}
                        style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", padding: "0.375rem 0.75rem", border: "1px solid rgba(59,130,246,0.4)", background: "transparent", color: "#3b82f6", borderRadius: "0.375rem", cursor: "pointer" }}
                      >
                        <Link2 size={12} /> {wf.trackingToken ? "Regenerate Tracking Link" : "Generate Tracking Link"}
                      </button>
                      {trackingUrl && (
                        <button
                          onClick={() => { navigator.clipboard.writeText(trackingUrl); setCopiedToken(w.workflow.id); setTimeout(() => setCopiedToken(null), 2000); }}
                          style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", padding: "0.375rem 0.75rem", border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: copiedToken === w.workflow.id ? "#00ff87" : "rgba(255,255,255,0.55)", borderRadius: "0.375rem", cursor: "pointer" }}
                        >
                          {copiedToken === w.workflow.id ? <Check size={12} /> : <Copy size={12} />} Copy Link
                        </button>
                      )}
                      {w.workflow.orderId && (
                        <Link href={`/admin/orders/${w.workflow.orderId}`}>
                          <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", padding: "0.375rem 0.75rem", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b", borderRadius: "0.375rem", cursor: "pointer" }}>
                            <ExternalLink size={12} /> Order #{w.workflow.orderId}
                          </span>
                        </Link>
                      )}
                    </div>

                    {/* Tab bar */}
                    <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "0 1rem" }}>
                      {PANEL_TABS.map(tab => (
                        <button key={tab} onClick={() => setActiveTab(prev => ({ ...prev, [w.workflow.id]: tab }))}
                          style={{ padding: "0.5rem 0.875rem", fontSize: "0.8125rem", fontWeight: 500, background: "none", border: "none", borderBottom: `2px solid ${currentTab === tab ? "#f59e0b" : "transparent"}`, color: currentTab === tab ? "#ececec" : "#64748b", cursor: "pointer", marginBottom: "-1px" }}>
                          {tab}
                        </button>
                      ))}
                    </div>

                    <div style={{ padding: "1rem" }}>
                      {/* ── Checkpoints tab ──────────────────────────────── */}
                      {currentTab === "Checkpoints" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          {/* Bay assignment */}
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem", borderRadius: "0.375rem", background: "#080808", border: "1px solid rgba(255,255,255,0.08)", marginBottom: "0.5rem" }}>
                            <Warehouse size={14} style={{ color: "#f59e0b", flexShrink: 0 }} />
                            <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "rgba(255,255,255,0.55)" }}>Warehouse Bay</span>
                            <div style={{ flex: 1 }} />
                            <select value={w.workflow.warehouseBayId ?? ""} disabled={assignBay.isPending} onChange={e => { setAssigningBay(w.workflow.id); assignBay.mutate({ workflowId: w.workflow.id, warehouseBayId: e.target.value === "" ? null : Number(e.target.value) }); }} style={{ fontSize: "0.8125rem", background: "#111111", border: "1px solid rgba(255,255,255,0.08)", color: "#ececec", borderRadius: "0.25rem", padding: "0.25rem 0.5rem", cursor: "pointer", outline: "none" }}>
                              <option value="">— None —</option>
                              {baysData.map(bay => <option key={bay.id} value={bay.id}>{bay.name} ({bay.sqft} sqft){bay.isAvailable ? " ✓" : " ✗ occupied"}</option>)}
                            </select>
                            {assigningBay === w.workflow.id && <Loader2 size={12} style={{ color: "rgba(255,255,255,0.30)", animation: "spin 1s linear infinite" }} />}
                          </div>
                          {w.checkpoints.map(cp => {
                            const isOverdue = ["pending", "in_progress"].includes(cp.status) && cp.dueAt && new Date(cp.dueAt) < now;
                            return (
                              <div key={cp.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.75rem", borderRadius: "0.375rem", background: isOverdue ? "rgba(245,158,11,0.04)" : "#080808", border: `1px solid ${isOverdue ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.08)"}` }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                    {(cp as typeof cp & { phaseNumber?: number }).phaseNumber && <span style={{ fontSize: "0.6875rem", color: "#64748b", background: "#1a1a1a", padding: "0 0.375rem", borderRadius: "0.25rem" }}>Phase {(cp as typeof cp & { phaseNumber?: number }).phaseNumber}</span>}
                                    <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "#ececec" }}>{cp.title}</span>
                                    <span style={{ fontSize: "0.75rem", fontWeight: 500, color: CHECKPOINT_STATUS_COLORS[cp.status] ?? "rgba(255,255,255,0.30)" }}>{cp.status.replace("_", " ")}</span>
                                    {isOverdue && <span style={{ fontSize: "0.75rem", color: "#f59e0b" }}><Clock size={10} /> overdue</span>}
                                  </div>
                                  <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.30)", flexWrap: "wrap" }}>
                                    {cp.dueAt && <span>Due: {new Date(cp.dueAt).toLocaleDateString()}</span>}
                                    {cp.completedAt && <span>Done: {new Date(cp.completedAt).toLocaleDateString()}</span>}
                                    {cp.responsibleParty && <span>Owner: {cp.responsibleParty.replace("_", " ")}</span>}
                                    {cp.trackingNumber && <span>Tracking: {cp.trackingNumber} ({cp.carrierName})</span>}
                                  </div>
                                  {cp.problemDescription && <p style={{ fontSize: "0.8125rem", color: "#ef4444", marginTop: "0.25rem" }}><AlertTriangle size={11} /> {cp.problemDescription}</p>}
                                  {(cp as typeof cp & { customerVisibleNote?: string }).customerVisibleNote && <p style={{ fontSize: "0.8125rem", color: "#3b82f6", marginTop: "0.25rem" }}>Customer note: {(cp as typeof cp & { customerVisibleNote?: string }).customerVisibleNote}</p>}
                                </div>
                                {cp.status !== "completed" && (
                                  <button onClick={() => updateCheckpoint.mutate({ checkpointId: cp.id, status: "completed" })} disabled={updateCheckpoint.isPending} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 500, padding: "0.25rem 0.625rem", border: "1px solid rgba(62,207,142,0.4)", background: "#fff", color: "#00ff87", borderRadius: "0.25rem", cursor: "pointer" }}>
                                    <CheckCircle2 size={11} /> Done
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* ── Costs tab ────────────────────────────────────── */}
                      {currentTab === "Costs" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                          {costsQuery.isLoading ? (
                            <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}><Loader2 size={18} style={{ animation: "spin 1s linear infinite", color: "rgba(255,255,255,0.30)" }} /></div>
                          ) : (costsQuery.data ?? []).length === 0 ? (
                            <div style={{ textAlign: "center", padding: "2rem", color: "rgba(255,255,255,0.30)" }}>
                              <DollarSign size={24} style={{ margin: "0 auto 0.5rem" }} />
                              <p style={{ fontSize: "0.875rem" }}>No cost estimate yet. Click "Generate Cost Estimate" above.</p>
                            </div>
                          ) : (
                            <>
                              {/* Summary row */}
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                                {[
                                  { label: "Total Estimated", value: fmt$(wf.totalEstimatedCostUsd), color: "#ececec" },
                                  { label: "Total Actual", value: fmt$(wf.totalActualCostUsd), color: "#f59e0b" },
                                  { label: "Estimate Status", value: wf.costEstimateAcceptedAt ? "Accepted ✓" : "Pending acceptance", color: wf.costEstimateAcceptedAt ? "#00ff87" : "#64748b" },
                                ].map(s => (
                                  <div key={s.label} style={{ background: "#080808", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.375rem", padding: "0.75rem" }}>
                                    <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0 0 0.25rem" }}>{s.label}</p>
                                    <p style={{ fontSize: "1.125rem", fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
                                  </div>
                                ))}
                              </div>
                              {/* Cost table by phase */}
                              {Object.entries(
                                (costsQuery.data ?? []).reduce<Record<number, typeof costsQuery.data>>((acc, row) => {
                                  (acc[row.phaseNumber] ??= []).push(row);
                                  return acc;
                                }, {})
                              ).map(([phaseNum, rows]) => (
                                <div key={phaseNum}>
                                  <p style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", margin: "0 0 0.5rem" }}>
                                    Phase {phaseNum} — {PHASE_LABELS[Number(phaseNum)] ?? ""}
                                  </p>
                                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                                    <thead>
                                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                                        {["Description", "Vendor", "Estimated", "Actual", "Status"].map(h => (
                                          <th key={h} style={{ textAlign: "left", padding: "0.375rem 0.5rem", color: "#64748b", fontWeight: 500 }}>{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {rows!.map(row => (
                                        <tr key={row.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                          <td style={{ padding: "0.5rem", color: "#ececec" }}>{row.description}</td>
                                          <td style={{ padding: "0.5rem", color: "rgba(255,255,255,0.55)" }}>{row.vendorName ?? "—"}</td>
                                          <td style={{ padding: "0.5rem", color: "#ececec", fontVariantNumeric: "tabular-nums" }}>{fmt$(row.estimatedAmountUsd)}</td>
                                          <td style={{ padding: "0.5rem", color: row.actualAmountUsd ? "#f59e0b" : "rgba(255,255,255,0.30)", fontVariantNumeric: "tabular-nums" }}>{row.actualAmountUsd ? fmt$(row.actualAmountUsd) : "—"}</td>
                                          <td style={{ padding: "0.5rem", color: row.paidAt ? "#00ff87" : "rgba(255,255,255,0.30)" }}>{row.paidAt ? "Paid" : row.actualAmountUsd ? "Invoiced" : "Estimated"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      )}

                      {/* ── Robot Specs tab ──────────────────────────────── */}
                      {currentTab === "Robot Specs" && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                          {[
                            { label: "Robot Model", value: wf.robotModel, icon: <Cpu size={13} /> },
                            { label: "Origin Country", value: wf.originCountry, icon: <Truck size={13} /> },
                            { label: "Declared Value", value: fmt$(wf.declaredValueUsd), icon: <DollarSign size={13} /> },
                            { label: "Weight (kg)", value: wf.robotWeightKg, icon: <Package size={13} /> },
                            { label: "Battery Type", value: wf.batteryType, icon: <Radio size={13} /> },
                            { label: "Customer Email", value: (wf as { customerEmail?: string }).customerEmail, icon: <Link2 size={13} /> },
                          ].map(field => (
                            <div key={field.label} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0.75rem" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>
                                {field.icon} {field.label}
                              </div>
                              <p style={{ fontSize: "0.9375rem", color: "#ececec", margin: 0 }}>{field.value ?? <span style={{ color: "rgba(255,255,255,0.30)" }}>Not set</span>}</p>
                            </div>
                          ))}
                          {/* Compliance flags */}
                          <div style={{ gridColumn: "1 / -1" }}>
                            <p style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.5rem" }}>Compliance Flags</p>
                            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                              {[
                                { label: "ATA Carnet", value: (wf as { ataCarnetRequired?: boolean }).ataCarnetRequired },
                                { label: "FCC Docs", value: (wf as { requiresFccDocs?: boolean }).requiresFccDocs },
                                { label: "FDA Docs", value: (wf as { requiresFdaDocs?: boolean }).requiresFdaDocs },
                                { label: "Wireless Radio", value: (wf as { hasWirelessRadio?: boolean }).hasWirelessRadio },
                                { label: "Cameras", value: (wf as { hasCameras?: boolean }).hasCameras },
                              ].map(flag => (
                                <span key={flag.label} style={{ fontSize: "0.75rem", padding: "0.25rem 0.625rem", borderRadius: "9999px", border: `1px solid ${flag.value ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)"}`, color: flag.value ? "#f59e0b" : "rgba(255,255,255,0.30)" }}>
                                  {flag.label}: {flag.value ? "Yes" : "No"}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── Carrier Tracking tab ─────────────────────────── */}
                      {currentTab === "Carrier Tracking" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                          {/* Add tracking number */}
                          <div style={{ background: "#080808", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.375rem", padding: "0.875rem" }}>
                            <p style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", marginBottom: "0.75rem" }}>Add Tracking Number</p>
                            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                              <select
                                value={trackingInput[w.workflow.id]?.carrier ?? "dhl"}
                                onChange={e => setTrackingInput(prev => ({ ...prev, [w.workflow.id]: { ...prev[w.workflow.id], carrier: e.target.value } }))}
                                style={{ fontSize: "0.8125rem", background: "#111111", border: "1px solid rgba(255,255,255,0.15)", color: "#ececec", borderRadius: "0.25rem", padding: "0.375rem 0.5rem", outline: "none" }}
                              >
                                {["dhl", "fedex", "ups", "manual", "other"].map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                              </select>
                              <input
                                placeholder="Enter tracking number"
                                value={trackingInput[w.workflow.id]?.number ?? ""}
                                onChange={e => setTrackingInput(prev => ({ ...prev, [w.workflow.id]: { ...prev[w.workflow.id], number: e.target.value } }))}
                                style={{ flex: 1, minWidth: "12rem", fontSize: "0.8125rem", background: "#111111", border: "1px solid rgba(255,255,255,0.15)", color: "#ececec", borderRadius: "0.25rem", padding: "0.375rem 0.625rem", outline: "none" }}
                              />
                              <button
                                onClick={() => { const t = trackingInput[w.workflow.id]; if (!t?.number) { toast.error("Enter a tracking number"); return; } addTracking.mutate({ workflowId: w.workflow.id, carrier: (t.carrier ?? "manual") as "dhl" | "fedex" | "ups" | "manual" | "other", trackingNumber: t.number }); }}
                                disabled={addTracking.isPending}
                                style={{ fontSize: "0.8125rem", padding: "0.375rem 0.875rem", border: "1px solid rgba(0,255,135,0.35)", background: "transparent", color: "#00ff87", borderRadius: "0.375rem", cursor: "pointer" }}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => { const t = trackingInput[w.workflow.id]; if (!t?.number) { toast.error("Enter a tracking number first"); return; } pollTracking.mutate({ workflowId: w.workflow.id, carrier: t.carrier ?? "manual", trackingNumber: t.number }); }}
                                disabled={pollTracking.isPending}
                                style={{ fontSize: "0.8125rem", padding: "0.375rem 0.875rem", border: "1px solid rgba(59,130,246,0.4)", background: "transparent", color: "#3b82f6", borderRadius: "0.375rem", cursor: "pointer" }}
                              >
                                {pollTracking.isPending ? "Polling…" : "Poll Status"}
                              </button>
                            </div>
                            <p style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.30)", marginTop: "0.5rem" }}>DHL & FedEx live polling requires SHIPPING_DHL_API_KEY / SHIPPING_FEDEX_API_KEY in env. UPS coming soon.</p>
                          </div>

                          {/* Tracking history */}
                          {trackingQuery.isLoading ? (
                            <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}><Loader2 size={18} style={{ animation: "spin 1s linear infinite", color: "rgba(255,255,255,0.30)" }} /></div>
                          ) : (trackingQuery.data ?? []).length === 0 ? (
                            <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.30)", textAlign: "center", padding: "1.5rem 0" }}>No tracking events yet.</p>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                              {(trackingQuery.data ?? []).map(ev => (
                                <div key={ev.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.625rem", borderRadius: "0.375rem", background: "#080808", border: "1px solid rgba(255,255,255,0.06)" }}>
                                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", flexShrink: 0, minWidth: "3rem" }}>{ev.carrier.toUpperCase()}</span>
                                  <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: "0.875rem", color: "#ececec", margin: 0 }}>{ev.statusSummary}</p>
                                    <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.30)", marginTop: "0.125rem" }}>
                                      {ev.location && <span>{ev.location}</span>}
                                      <span>{ev.trackingNumber}</span>
                                      <span>{new Date(ev.polledAt ?? ev.createdAt).toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
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
