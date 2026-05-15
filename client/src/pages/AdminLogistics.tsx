import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  Truck, CheckCircle2, Clock, AlertTriangle, AlertCircle,
  Loader2, ChevronDown, ChevronRight, ExternalLink, Zap,
  Package, Calendar, BarChart3, RefreshCw, Warehouse,
} from "lucide-react";

const CHECKPOINT_STATUS_COLORS: Record<string, string> = {
  pending:     "bg-zinc-800 text-zinc-400 border-zinc-700",
  in_progress: "bg-amber-900/60 text-amber-300 border-amber-700/40",
  completed:   "bg-emerald-900/60 text-emerald-300 border-emerald-700/40",
  blocked:     "bg-red-900/60 text-red-300 border-red-700/40",
  escalated:   "bg-red-900/80 text-red-200 border-red-600",
  skipped:     "bg-zinc-800/60 text-zinc-500 border-zinc-700/50",
};

const WORKFLOW_STATUS_COLORS: Record<string, string> = {
  active:    "bg-amber-900/60 text-amber-300 border-amber-700/40",
  completed: "bg-emerald-900/60 text-emerald-300 border-emerald-700/40",
  cancelled: "bg-zinc-800 text-zinc-400 border-zinc-700",
  on_hold:   "bg-blue-900/60 text-blue-300 border-blue-700/40",
};

export default function AdminLogistics() {
  const { user, loading: authLoading } = useAuth();
  const [expandedWorkflow, setExpandedWorkflow] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "overdue">("active");
  const [assigningBay, setAssigningBay] = useState<number | null>(null); // workflowId being updated

  const utils = trpc.useUtils();

  const { data: workflowsData, isLoading, refetch } = trpc.logistics.getAllWorkflows.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Fetch all bays for the dropdown
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
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-zinc-500" />
        </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <AlertCircle size={32} className="text-red-500" />
          <p className="text-zinc-300 font-semibold">Admin access required</p>
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

  // Build a bay map for quick lookup
  const bayMap = new Map(baysData.map(b => [b.id, b]));

  return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold text-zinc-100 flex items-center gap-2">
              <Truck size={20} className="text-amber-400" /> Logistics
            </h1>
            <p className="text-[13px] text-zinc-500 mt-0.5">Active workflows, checkpoint status, and escalations</p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-zinc-200 border border-zinc-700 px-3 py-1.5 rounded transition-colors"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Active Workflows", value: totalActive, icon: <BarChart3 size={16} className="text-amber-400" />, color: "text-zinc-100" },
            { label: "Overdue Checkpoints", value: totalOverdue, icon: <Clock size={16} className="text-amber-400" />, color: totalOverdue > 0 ? "text-amber-300" : "text-zinc-100" },
            { label: "Escalated", value: totalEscalated, icon: <AlertTriangle size={16} className="text-red-400" />, color: totalEscalated > 0 ? "text-red-300" : "text-zinc-100" },
          ].map(stat => (
            <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">{stat.icon}<span className="text-[11px] text-zinc-500">{stat.label}</span></div>
              <p className={`text-[24px] font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(["all", "active", "overdue"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={`text-[12px] px-3 py-1.5 rounded-full border transition-colors capitalize ${
                filterStatus === f
                  ? "bg-amber-500 text-black border-amber-500 font-semibold"
                  : "bg-transparent text-zinc-400 border-zinc-700 hover:text-zinc-200"
              }`}
            >
              {f === "overdue" ? `⏰ Overdue (${totalOverdue})` : f === "active" ? `Active (${totalActive})` : `All (${enriched.length})`}
            </button>
          ))}
        </div>

        {/* Workflow list */}
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={20} className="animate-spin text-zinc-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <Truck size={32} className="text-zinc-700" />
            <p className="text-[13px] text-zinc-500">
              {filterStatus === "overdue" ? "No overdue checkpoints — all workflows on track." : "No logistics workflows yet. Convert a booking to an order and create a workflow from the order detail page."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(w => {
              const isExpanded = expandedWorkflow === w.workflow.id;
              const progress = w.checkpoints.length > 0
                ? Math.round((w.completedCount / w.checkpoints.length) * 100)
                : 0;
              const assignedBay = w.workflow.warehouseBayId ? bayMap.get(w.workflow.warehouseBayId) : null;
              const isAssigning = assigningBay === w.workflow.id;

              return (
                <div key={w.workflow.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  {/* Workflow header */}
                  <button
                    onClick={() => setExpandedWorkflow(isExpanded ? null : w.workflow.id)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-zinc-800/40 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-semibold text-zinc-100">{w.workflow.robotCompany}</span>
                        {w.workflow.robotName && (
                          <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                            <Package size={10} /> {w.workflow.robotName}
                          </span>
                        )}
                        <span className={`text-[10px] border px-1.5 py-0.5 rounded-full font-medium ${WORKFLOW_STATUS_COLORS[w.workflow.status] ?? ""}`}>
                          {w.workflow.status}
                        </span>
                        {w.overdueCount > 0 && (
                          <span className="text-[10px] bg-amber-900/60 text-amber-300 border border-amber-700/40 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <Clock size={9} /> {w.overdueCount} overdue
                          </span>
                        )}
                        {w.escalatedCount > 0 && (
                          <span className="text-[10px] bg-red-900/80 text-red-200 border border-red-600 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <AlertTriangle size={9} /> {w.escalatedCount} escalated
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500 flex-wrap">
                        {w.workflow.showName && <span className="flex items-center gap-1"><Calendar size={10} /> {w.workflow.showName}</span>}
                        <span className="flex items-center gap-1"><CheckCircle2 size={10} /> {w.completedCount}/{w.checkpoints.length} checkpoints</span>
                        {w.workflow.orderId && (
                          <Link href={`/admin/orders/${w.workflow.orderId}`} onClick={e => e.stopPropagation()}>
                            <span className="flex items-center gap-1 hover:text-zinc-300 transition-colors">
                              <ExternalLink size={10} /> Order #{w.workflow.orderId}
                            </span>
                          </Link>
                        )}
                        {/* ── Assigned Bay badge ── */}
                        {assignedBay ? (
                          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${
                            assignedBay.isAvailable
                              ? "bg-emerald-900/40 text-emerald-300 border-emerald-700/40"
                              : "bg-amber-900/40 text-amber-300 border-amber-700/40"
                          }`}>
                            <Warehouse size={9} />
                            {assignedBay.name} · {assignedBay.isAvailable ? "Available" : "Occupied"}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-zinc-600 text-[10px]">
                            <Warehouse size={9} /> No bay assigned
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-24 shrink-0">
                      <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                        <span>Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown size={14} className="text-zinc-500 shrink-0" /> : <ChevronRight size={14} className="text-zinc-500 shrink-0" />}
                  </button>

                  {/* Expanded checkpoints + bay assignment */}
                  {isExpanded && (
                    <div className="border-t border-zinc-800 p-4 space-y-4">
                      {/* ── Bay Assignment Row ── */}
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/40">
                        <Warehouse size={14} className="text-amber-400 shrink-0" />
                        <span className="text-[12px] font-medium text-zinc-300">Assigned Bay</span>
                        <div className="flex-1" />
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
                          className="text-[11px] bg-zinc-900 border border-zinc-700 text-zinc-200 rounded px-2 py-1 focus:outline-none focus:border-amber-500 disabled:opacity-50 cursor-pointer"
                        >
                          <option value="">— None —</option>
                          {baysData.map(bay => (
                            <option key={bay.id} value={bay.id}>
                              {bay.name} ({bay.sqft} sqft){bay.isAvailable ? " ✓" : " ✗ occupied"}
                            </option>
                          ))}
                        </select>
                        {isAssigning && <Loader2 size={12} className="animate-spin text-zinc-500" />}
                      </div>

                      {/* Checkpoints */}
                      <div className="space-y-2">
                        {w.checkpoints.map(cp => {
                          const isOverdue = ["pending", "in_progress"].includes(cp.status) && cp.dueAt && new Date(cp.dueAt) < now;
                          return (
                            <div
                              key={cp.id}
                              className={`flex items-start gap-3 p-3 rounded-lg border ${isOverdue ? "bg-amber-950/20 border-amber-800/30" : "bg-zinc-800/30 border-zinc-700/40"}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[12px] font-medium text-zinc-200">{cp.title}</span>
                                  <span className={`text-[10px] border px-1.5 py-0.5 rounded-full font-medium ${CHECKPOINT_STATUS_COLORS[cp.status] ?? ""}`}>
                                    {cp.status.replace("_", " ")}
                                  </span>
                                  {isOverdue && (
                                    <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                                      <Clock size={9} /> overdue
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-zinc-500">
                                  {cp.dueAt && <span>Due: {new Date(cp.dueAt).toLocaleDateString()}</span>}
                                  {cp.responsibleParty && <span>Responsible: {cp.responsibleParty.replace("_", " ")}</span>}
                                  {cp.trackingNumber && <span>Tracking: {cp.trackingNumber}</span>}
                                </div>
                                {cp.problemDescription && (
                                  <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                                    <AlertTriangle size={10} /> {cp.problemDescription}
                                  </p>
                                )}
                              </div>
                              {cp.status !== "completed" && (
                                <button
                                  onClick={() => updateCheckpoint.mutate({ checkpointId: cp.id, status: "completed" })}
                                  disabled={updateCheckpoint.isPending}
                                  className="shrink-0 flex items-center gap-1 text-[10px] bg-emerald-800/60 hover:bg-emerald-700/60 text-emerald-300 border border-emerald-700/40 px-2 py-1 rounded transition-colors disabled:opacity-50"
                                >
                                  <CheckCircle2 size={10} /> Done
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
