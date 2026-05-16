import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  Truck, CheckCircle2, Clock, AlertTriangle, AlertCircle,
  Loader2, ChevronDown, ChevronRight, ExternalLink,
  Package, Calendar, BarChart3, RefreshCw, Warehouse,
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

export default function AdminLogistics() {
  const { user, loading: authLoading } = useAuth();
  const [expandedWorkflow, setExpandedWorkflow] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "overdue">("active");
  const [assigningBay, setAssigningBay] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const { data: workflowsData, isLoading, refetch } = trpc.logistics.getAllWorkflows.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: baysData = [] } = trpc.warehouse.listBays.useQuery(undefined, {
    staleTime: 60_000,
  });

  const updateCheckpoint = trpc.logistics.updateCheckpoint.useMutation({
    onSuccess: () => { refetch(); toast.success("Checkpoint updated"); },
    onError: (e) => toast.error(e.message),
  });

  const assignBay = trpc.logistics.assignBay.useMutation({
    onSuccess: () => {
      refetch();
      utils.warehouse.listBays.invalidate();
      setAssigningBay(null);
      toast.success("Bay assignment updated");
    },
    onError: (e) => { toast.error(e.message); setAssigningBay(null); },
  });

  if (authLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "16rem" }}>
        <Loader2 size={24} style={{ color: "rgba(255,255,255,0.30)", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "16rem", gap: "0.75rem" }}>
        <AlertCircle size={28} style={{ color: "#ef4444" }} />
        <p style={{ color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>Admin access required</p>
      </div>
    );
  }

  const now = new Date();
  const workflows = workflowsData ?? [];

  const enriched = workflows.map(w => {
    const overdueCount = w.checkpoints.filter(cp =>
      ["pending", "in_progress"].includes(cp.status) && cp.dueAt && new Date(cp.dueAt) < now
    ).length;
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
    <div style={{ maxWidth: "56rem", margin: "0 auto", padding: "2rem", color: "#ececec" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "2rem" }}>
        <div>
          <p style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.30)", margin: "0 0 0.25rem" }}>STAGEGATE / LOGISTICS</p>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#ececec", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Truck size={18} style={{ color: "#f59e0b" }} /> Logistics
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#64748b", margin: "0.25rem 0 0" }}>Active workflows, checkpoint status, and escalations</p>
        </div>
        <button
          onClick={() => refetch()}
          style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", color: "#64748b", background: "#fff", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.375rem", padding: "0.375rem 0.75rem", cursor: "pointer" }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Active Workflows", value: totalActive, icon: <BarChart3 size={15} style={{ color: "#f59e0b" }} />, color: "#ececec" },
          { label: "Overdue Checkpoints", value: totalOverdue, icon: <Clock size={15} style={{ color: "#f59e0b" }} />, color: totalOverdue > 0 ? "#f59e0b" : "#ececec" },
          { label: "Escalated", value: totalEscalated, icon: <AlertTriangle size={15} style={{ color: "#ef4444" }} />, color: totalEscalated > 0 ? "#ef4444" : "#ececec" },
        ].map(stat => (
          <div key={stat.label} style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.5rem", padding: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
              {stat.icon}
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{stat.label}</span>
            </div>
            <p style={{ fontSize: "1.5rem", fontWeight: 700, color: stat.color, margin: 0 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: "1.5rem" }}>
        {(["all", "active", "overdue"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            style={{
              padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 500,
              background: "none", border: "none",
              borderBottom: `2px solid ${filterStatus === f ? "#f59e0b" : "transparent"}`,
              color: filterStatus === f ? "#ececec" : "#64748b",
              cursor: "pointer", marginBottom: "-1px",
            }}
          >
            {f === "overdue" ? `⏰ Overdue (${totalOverdue})` : f === "active" ? `Active (${totalActive})` : `All (${enriched.length})`}
          </button>
        ))}
      </div>

      {/* Workflow list */}
      {isLoading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "10rem" }}>
          <Loader2 size={20} style={{ color: "rgba(255,255,255,0.30)", animation: "spin 1s linear infinite" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "10rem", gap: "0.75rem" }}>
          <Truck size={28} style={{ color: "#cbd5e1" }} />
          <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.30)", textAlign: "center" }}>
            {filterStatus === "overdue" ? "No overdue checkpoints — all workflows on track." : "No logistics workflows yet."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {filtered.map(w => {
            const isExpanded = expandedWorkflow === w.workflow.id;
            const progress = w.checkpoints.length > 0
              ? Math.round((w.completedCount / w.checkpoints.length) * 100)
              : 0;
            const assignedBay = w.workflow.warehouseBayId ? bayMap.get(w.workflow.warehouseBayId) : null;
            const isAssigning = assigningBay === w.workflow.id;
            const wStatusColor = WORKFLOW_STATUS_COLORS[w.workflow.status] ?? "rgba(255,255,255,0.30)";

            return (
              <div key={w.workflow.id} style={{ border: `1px solid ${isExpanded ? "#f59e0b" : "rgba(255,255,255,0.08)"}`, borderRadius: "0.5rem", background: "#111111", overflow: "hidden", transition: "border-color 0.1s" }}>
                {/* Workflow header */}
                <button
                  onClick={() => setExpandedWorkflow(isExpanded ? null : w.workflow.id)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: "1rem", padding: "0.875rem 1rem", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "#ececec" }}>{w.workflow.robotCompany}</span>
                      {w.workflow.robotName && (
                        <span style={{ fontSize: "0.8125rem", color: "#64748b", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <Package size={11} /> {w.workflow.robotName}
                        </span>
                      )}
                      <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: wStatusColor }}>{w.workflow.status}</span>
                      {w.overdueCount > 0 && (
                        <span style={{ fontSize: "0.75rem", color: "#f59e0b", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <Clock size={10} /> {w.overdueCount} overdue
                        </span>
                      )}
                      {w.escalatedCount > 0 && (
                        <span style={{ fontSize: "0.75rem", color: "#ef4444", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <AlertTriangle size={10} /> {w.escalatedCount} escalated
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.25rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.30)", flexWrap: "wrap" }}>
                      {w.workflow.showName && <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Calendar size={10} /> {w.workflow.showName}</span>}
                      <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><CheckCircle2 size={10} /> {w.completedCount}/{w.checkpoints.length} checkpoints</span>
                      {w.workflow.orderId && (
                        <Link href={`/admin/orders/${w.workflow.orderId}`} onClick={e => e.stopPropagation()}>
                          <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "#00ff87", cursor: "pointer" }}>
                            <ExternalLink size={10} /> Order #{w.workflow.orderId}
                          </span>
                        </Link>
                      )}
                      {assignedBay ? (
                        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: assignedBay.isAvailable ? "#00ff87" : "#f59e0b" }}>
                          <Warehouse size={10} /> {assignedBay.name} · {assignedBay.isAvailable ? "Available" : "Occupied"}
                        </span>
                      ) : (
                        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "#cbd5e1" }}>
                          <Warehouse size={10} /> No bay assigned
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ width: "6rem", flexShrink: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6875rem", color: "rgba(255,255,255,0.30)", marginBottom: "0.25rem" }}>
                      <span>Progress</span><span>{progress}%</span>
                    </div>
                    <div style={{ height: "0.375rem", background: "#1a1a1a", borderRadius: "9999px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${progress}%`, background: "#f59e0b", borderRadius: "9999px", transition: "width 0.3s" }} />
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.30)", flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: "rgba(255,255,255,0.30)", flexShrink: 0 }} />}
                </button>

                {/* Expanded checkpoints + bay assignment */}
                {isExpanded && (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {/* Bay Assignment */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem", borderRadius: "0.375rem", background: "#080808", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <Warehouse size={14} style={{ color: "#f59e0b", flexShrink: 0 }} />
                      <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "rgba(255,255,255,0.55)" }}>Assigned Bay</span>
                      <div style={{ flex: 1 }} />
                      <select
                        value={w.workflow.warehouseBayId ?? ""}
                        disabled={isAssigning || assignBay.isPending}
                        onChange={e => {
                          const val = e.target.value;
                          setAssigningBay(w.workflow.id);
                          assignBay.mutate({
                            workflowId: w.workflow.id,
                            warehouseBayId: val === "" ? null : Number(val),
                          });
                        }}
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: "0.8125rem", background: "#111111", border: "1px solid rgba(255,255,255,0.08)", color: "#ececec", borderRadius: "0.25rem", padding: "0.25rem 0.5rem", cursor: "pointer", outline: "none" }}
                      >
                        <option value="">— None —</option>
                        {baysData.map(bay => (
                          <option key={bay.id} value={bay.id}>
                            {bay.name} ({bay.sqft} sqft){bay.isAvailable ? " ✓" : " ✗ occupied"}
                          </option>
                        ))}
                      </select>
                      {isAssigning && <Loader2 size={12} style={{ color: "rgba(255,255,255,0.30)", animation: "spin 1s linear infinite" }} />}
                    </div>

                    {/* Checkpoints */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {w.checkpoints.map(cp => {
                        const isOverdue = ["pending", "in_progress"].includes(cp.status) && cp.dueAt && new Date(cp.dueAt) < now;
                        const cpColor = CHECKPOINT_STATUS_COLORS[cp.status] ?? "rgba(255,255,255,0.30)";
                        return (
                          <div
                            key={cp.id}
                            style={{
                              display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.75rem",
                              borderRadius: "0.375rem",
                              background: isOverdue ? "rgba(245,158,11,0.04)" : "#080808",
                              border: `1px solid ${isOverdue ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.08)"}`,
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "#ececec" }}>{cp.title}</span>
                                <span style={{ fontSize: "0.75rem", fontWeight: 500, color: cpColor }}>{cp.status.replace("_", " ")}</span>
                                {isOverdue && (
                                  <span style={{ fontSize: "0.75rem", color: "#f59e0b", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                    <Clock size={10} /> overdue
                                  </span>
                                )}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.25rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.30)" }}>
                                {cp.dueAt && <span>Due: {new Date(cp.dueAt).toLocaleDateString()}</span>}
                                {cp.responsibleParty && <span>Responsible: {cp.responsibleParty.replace("_", " ")}</span>}
                                {cp.trackingNumber && <span>Tracking: {cp.trackingNumber}</span>}
                              </div>
                              {cp.problemDescription && (
                                <p style={{ fontSize: "0.8125rem", color: "#ef4444", marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                  <AlertTriangle size={11} /> {cp.problemDescription}
                                </p>
                              )}
                            </div>
                            {cp.status !== "completed" && (
                              <button
                                onClick={() => updateCheckpoint.mutate({ checkpointId: cp.id, status: "completed" })}
                                disabled={updateCheckpoint.isPending}
                                style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 500, padding: "0.25rem 0.625rem", border: "1px solid rgba(62,207,142,0.4)", background: "#fff", color: "#00ff87", borderRadius: "0.25rem", cursor: "pointer" }}
                              >
                                <CheckCircle2 size={11} /> Done
                              </button>
                            )}
                          </div>
                        );
                      })}
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
