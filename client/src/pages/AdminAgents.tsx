import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ─── Agent metadata registry ──────────────────────────────────────────────────
const AGENT_REGISTRY: Record<string, { label: string; description: string; icon: string; category: string }> = {
  "Lead Discovery": {
    label: "Lead Discovery",
    description: "Scans trade show exhibitor lists and identifies robotics companies using AI analysis.",
    icon: "🔍",
    category: "Lead Gen",
  },
  "Lead Email Generator": {
    label: "Lead Email Generator",
    description: "Generates personalized B2B outreach emails for exhibitor leads attending a specific show.",
    icon: "✉️",
    category: "Lead Gen",
  },
  "XBOT Outreach": {
    label: "XBOT Outreach",
    description: "Sends personalized intro emails to XBOT prospects with robot-specific logistics copy.",
    icon: "🤖",
    category: "Outreach",
  },
  "XBOT Bulk Outreach": {
    label: "XBOT Bulk Outreach",
    description: "Batch-sends personalized outreach emails to up to 50 prospects in a single workflow run.",
    icon: "📨",
    category: "Outreach",
  },
  "Logistics Brief": {
    label: "Logistics Brief",
    description: "Generates a comprehensive logistics brief for a robot shipment including customs, timeline, and ground transport.",
    icon: "📦",
    category: "Logistics",
  },
};

// All known agents (shown even if no runs yet)
const ALL_AGENTS = Object.keys(AGENT_REGISTRY);

function formatRelative(date: Date | null | undefined): string {
  if (!date) return "Never";
  const d = date instanceof Date ? date : new Date(date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function StatusBadge({ status }: { status: "running" | "success" | "error" | "idle" }) {
  const styles: Record<string, string> = {
    running: "bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse",
    success: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40",
    error: "bg-red-500/20 text-red-400 border border-red-500/40",
    idle: "bg-zinc-700/40 text-zinc-500 border border-zinc-700",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono uppercase tracking-wider ${styles[status]}`}>
      {status === "running" && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />}
      {status === "success" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
      {status === "error" && <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />}
      {status === "idle" && <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 inline-block" />}
      {status}
    </span>
  );
}

export default function AdminAgents() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const { data: agentStats, refetch: refetchStats } = trpc.admin.getAgentStats.useQuery(undefined, { refetchInterval: 10000 });
  const { data: agentRuns, refetch: refetchRuns } = trpc.admin.getAgentRuns.useQuery({ limit: 50 }, { refetchInterval: 10000 });

  // Build a map from agentName → stats
  const statsMap = new Map((agentStats ?? []).map((s) => [s.agentName, s]));

  const handleRefresh = () => {
    refetchStats();
    refetchRuns();
    toast.success("Agent stats and run history updated.");
  };

  const filteredRuns = selectedAgent
    ? (agentRuns ?? []).filter((r) => r.agentName === selectedAgent)
    : (agentRuns ?? []);

  return (
    <div className="min-h-screen bg-black text-white p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Agents &amp; Workflows</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Monitor all active AI agents, view run history, and track workflow performance.</p>
        </div>
        <button
          onClick={handleRefresh}
          className="px-3 py-1.5 text-xs font-mono border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 rounded transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Agent Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {ALL_AGENTS.map((agentName) => {
          const meta = AGENT_REGISTRY[agentName];
          const stats = statsMap.get(agentName);
          const successRate = stats && stats.totalRuns > 0
            ? Math.round((stats.successRuns / stats.totalRuns) * 100)
            : null;
          const isSelected = selectedAgent === agentName;

          return (
            <button
              key={agentName}
              onClick={() => setSelectedAgent(isSelected ? null : agentName)}
              className={`text-left p-4 rounded-lg border transition-all ${
                isSelected
                  ? "border-emerald-500/60 bg-emerald-950/20"
                  : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-600"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{meta.icon}</span>
                  <div>
                    <div className="font-semibold text-sm text-white">{meta.label}</div>
                    <div className="text-xs text-zinc-500 font-mono">{meta.category}</div>
                  </div>
                </div>
                <StatusBadge status={stats ? (stats.errorRuns > 0 && stats.successRuns === 0 ? "error" : "idle") : "idle"} />
              </div>
              <p className="text-xs text-zinc-500 mb-3 leading-relaxed">{meta.description}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-zinc-800/60 rounded p-1.5">
                  <div className="text-base font-bold font-mono text-white">{stats?.totalRuns ?? 0}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Runs</div>
                </div>
                <div className="bg-zinc-800/60 rounded p-1.5">
                  <div className={`text-base font-bold font-mono ${successRate !== null ? (successRate >= 80 ? "text-emerald-400" : successRate >= 50 ? "text-amber-400" : "text-red-400") : "text-zinc-600"}`}>
                    {successRate !== null ? `${successRate}%` : "—"}
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Success</div>
                </div>
                <div className="bg-zinc-800/60 rounded p-1.5">
                  <div className="text-[11px] font-mono text-zinc-400 leading-tight pt-0.5">
                    {formatRelative(stats?.lastRunAt)}
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Last Run</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Run History Table */}
      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-zinc-200">Run History</h2>
            {selectedAgent && (
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                {selectedAgent}
                <button onClick={() => setSelectedAgent(null)} className="ml-1.5 text-zinc-500 hover:text-zinc-300">×</button>
              </span>
            )}
          </div>
          <span className="text-xs text-zinc-600 font-mono">{filteredRuns.length} runs</span>
        </div>

        {filteredRuns.length === 0 ? (
          <div className="px-4 py-12 text-center text-zinc-600 text-sm">
            No runs recorded yet. Trigger an AI agent to see activity here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/40">
                  <th className="text-left px-4 py-2 text-zinc-500 font-mono uppercase tracking-wider">Agent</th>
                  <th className="text-left px-4 py-2 text-zinc-500 font-mono uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-2 text-zinc-500 font-mono uppercase tracking-wider">Triggered By</th>
                  <th className="text-left px-4 py-2 text-zinc-500 font-mono uppercase tracking-wider">Input</th>
                  <th className="text-left px-4 py-2 text-zinc-500 font-mono uppercase tracking-wider">Output / Error</th>
                  <th className="text-left px-4 py-2 text-zinc-500 font-mono uppercase tracking-wider">Started</th>
                  <th className="text-left px-4 py-2 text-zinc-500 font-mono uppercase tracking-wider">Duration</th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map((run) => {
                  const meta = AGENT_REGISTRY[run.agentName];
                  const durationMs = run.completedAt && run.startedAt
                    ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
                    : null;
                  return (
                    <tr key={run.id} className="border-b border-zinc-800/60 hover:bg-zinc-900/40 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span>{meta?.icon ?? "🔧"}</span>
                          <span className="text-zinc-300 font-medium">{run.agentName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={run.status as "running" | "success" | "error"} />
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500 font-mono">{run.triggeredBy ?? "—"}</td>
                      <td className="px-4 py-2.5 text-zinc-500 max-w-[180px] truncate" title={run.inputSummary ?? ""}>
                        {run.inputSummary ?? "—"}
                      </td>
                      <td className={`px-4 py-2.5 max-w-[200px] truncate font-mono ${run.status === "error" ? "text-red-400" : "text-emerald-400/80"}`}
                        title={run.status === "error" ? (run.errorMessage ?? "") : (run.outputSummary ?? "")}>
                        {run.status === "error" ? (run.errorMessage ?? "Error") : (run.outputSummary ?? "—")}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500 font-mono whitespace-nowrap">
                        {formatRelative(run.startedAt)}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500 font-mono">
                        {durationMs !== null ? `${(durationMs / 1000).toFixed(1)}s` : run.status === "running" ? "…" : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Workflow Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30">
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-mono mb-1">Total Runs</div>
          <div className="text-3xl font-bold font-mono text-white">{(agentRuns ?? []).length}</div>
        </div>
        <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30">
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-mono mb-1">Success Rate</div>
          <div className="text-3xl font-bold font-mono text-emerald-400">
            {(agentRuns ?? []).length > 0
              ? `${Math.round(((agentRuns ?? []).filter((r) => r.status === "success").length / (agentRuns ?? []).length) * 100)}%`
              : "—"}
          </div>
        </div>
        <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30">
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-mono mb-1">Active Agents</div>
          <div className="text-3xl font-bold font-mono text-white">{ALL_AGENTS.length}</div>
        </div>
      </div>
    </div>
  );
}
