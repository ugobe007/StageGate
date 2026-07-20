import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Play, RefreshCw } from "lucide-react";
import { BRAND, emeraldAlpha } from "@/lib/brand";
import { AI_AGENTS } from "@shared/aiOrg";

// ─── Workflow agent metadata (legacy named workflows) ─────────────────────────
const AGENT_REGISTRY: Record<string, { label: string; description: string; icon: string; category: string }> = {
  "Lead Discovery": {
    label: "Lead Discovery",
    description: "Scans trade show exhibitor lists and identifies robotics companies using AI analysis. Owned by Max (research).",
    icon: "🔍",
    category: "Lead Gen",
  },
  "Lead Email Generator": {
    label: "Lead Email Generator",
    description: "Generates personalized B2B outreach emails for exhibitor leads attending a specific show. Owned by Cal.",
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
  "Natasha Growth": {
    label: "Natasha Growth",
    description: "Marketing agent — observes signup funnel metrics and drafts social, newsletter, UI, and signup experiments.",
    icon: "📈",
    category: "Growth",
  },
  "Ted Health": {
    label: "Ted Health",
    description: "Performance agent — grades cron health, bounce circuit, failed runs, and emits loop recommendations.",
    icon: "⚡",
    category: "Ops",
  },
};

const ALL_AGENTS = Object.keys(AGENT_REGISTRY);

const AI_ORG_ICONS: Record<string, string> = {
  relay: "🎛️",
  cal: "✉️",
  max: "🔬",
  natasha: "📈",
  ted: "⚡",
};

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

const STATUS_STYLES: Record<string, { color: string; dot: string; label?: string }> = {
  running: { color: "#f59e0b", dot: "#f59e0b" },
  success: { color: `${BRAND.emerald}`, dot: `${BRAND.emerald}` },
  error: { color: "#ef4444", dot: "#ef4444" },
  idle: { color: `${BRAND.emerald}`, dot: `${BRAND.emerald}`, label: "ready" },
};

function StatusText({ status }: { status: "running" | "success" | "error" | "idle" }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.idle;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", fontWeight: 500, color: s.color }}>
      <span style={{ width: "0.5rem", height: "0.5rem", borderRadius: "50%", background: s.dot, display: "inline-block", animation: status === "running" ? "pulse 1.5s ease-in-out infinite" : "none" }} />
      {s.label ?? status}
    </span>
  );
}

export default function AdminAgents() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const { data: agentStats, refetch: refetchStats } = trpc.admin.getAgentStats.useQuery(undefined, { refetchInterval: 10000 });
  const { data: agentRuns, refetch: refetchRuns } = trpc.admin.getAgentRuns.useQuery({ limit: 50 }, { refetchInterval: 10000 });
  const { data: aiOrg } = trpc.admin.getAiOrg.useQuery(undefined, { refetchInterval: 60000 });
  const triggerDiscovery = trpc.salesAgent.triggerDiscovery.useMutation({
    onSuccess: (data) => { toast.success(data.message); refetchRuns(); refetchStats(); },
    onError: (e) => toast.error(e.message),
  });
  const generateDrafts = trpc.admin.generateDrafts.useMutation({
    onSuccess: (data) => {
      const generated = data.result?.generated ?? 0;
      toast.success(`Generated ${generated} draft${generated === 1 ? "" : "s"}`);
      refetchRuns();
      refetchStats();
    },
    onError: (e) => toast.error(e.message),
  });
  const runNatasha = trpc.admin.runNatasha.useMutation({
    onSuccess: () => {
      toast.success("Natasha growth brief ready");
      refetchRuns();
      refetchStats();
    },
    onError: (e) => toast.error(e.message),
  });
  const runTed = trpc.admin.runTed.useMutation({
    onSuccess: (data) => {
      toast.success(`Ted grade ${String(data.grade ?? "").toUpperCase() || "ready"}`);
      refetchRuns();
      refetchStats();
    },
    onError: (e) => toast.error(e.message),
  });

  const statsMap = new Map((agentStats ?? []).map((s) => [s.agentName, s]));

  const handleRefresh = () => {
    refetchStats();
    refetchRuns();
    toast.success("Agent stats and run history updated.");
  };

  const activateAgent = (agentName: string) => {
    if (agentName === "Lead Discovery") {
      triggerDiscovery.mutate();
      return;
    }
    if (agentName === "Lead Email Generator") {
      generateDrafts.mutate({});
      return;
    }
    if (agentName === "Natasha Growth") {
      runNatasha.mutate();
      return;
    }
    if (agentName === "Ted Health") {
      runTed.mutate();
      return;
    }
    if (agentName === "XBOT Outreach" || agentName === "XBOT Bulk Outreach") {
      window.location.href = "/admin/prospects";
      return;
    }
    if (agentName === "Logistics Brief") {
      window.location.href = "/xbot";
      return;
    }
  };

  const filteredRuns = selectedAgent
    ? (agentRuns ?? []).filter((r) => r.agentName === selectedAgent)
    : (agentRuns ?? []);

  const totalRuns = (agentRuns ?? []).length;
  const successRuns = (agentRuns ?? []).filter((r) => r.status === "success").length;
  const overallRate = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : null;

  return (
    <div style={{ padding: "2rem", maxWidth: "72rem", margin: "0 auto", color: "#ececec" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#ececec", margin: 0 }}>AI Agents &amp; Workflows</h1>
          <p style={{ fontSize: "0.875rem", color: "#64748b", margin: "0.25rem 0 0" }}>Monitor active AI agents, view run history, and track workflow performance.</p>
        </div>
        <button
          onClick={handleRefresh}
          style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", fontWeight: 500, padding: "0.375rem 0.875rem", border: "1px solid rgba(255,255,255,0.08)", background: "#111111", color: "rgba(255,255,255,0.55)", borderRadius: "0.375rem", cursor: "pointer" }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* AI Organization roster */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <div>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "#ececec", margin: 0 }}>AI Organization</h2>
            <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "0.25rem 0 0" }}>
              Relay orchestrates Cal, Max, Natasha, and Ted across StageGate and ReadyForRobots.
              {typeof aiOrg?.maxReadyForCal === "number" ? (
                <> Max→Cal queue: <span style={{ color: `${BRAND.emerald}` }}>{aiOrg.maxReadyForCal}</span> ready.</>
              ) : null}
            </p>
          </div>
          <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.30)" }}>docs/ai-org.md</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem" }}>
          {AI_AGENTS.map((agent) => (
            <div
              key={agent.id}
              style={{
                padding: "0.875rem",
                borderRadius: "0.5rem",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "#111111",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ fontSize: "1.1rem" }}>{AI_ORG_ICONS[agent.id] ?? "•"}</span>
                  <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#ececec" }}>{agent.name}</span>
                </div>
                <span
                  style={{
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: agent.status === "live" ? `${BRAND.emerald}` : "#f59e0b",
                  }}
                >
                  {agent.status}
                </span>
              </div>
              <div style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.35)", marginBottom: "0.375rem" }}>{agent.title}</div>
              <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0, lineHeight: 1.45 }}>{agent.role}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Summary bar */}
      <div style={{ display: "flex", alignItems: "stretch", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.5rem", overflow: "hidden", background: "#111111", marginBottom: "1.5rem" }}>
        {[
          { label: "Total Runs", value: totalRuns, color: "#ececec" },
          { label: "Success Rate", value: overallRate !== null ? `${overallRate}%` : "—", color: overallRate !== null ? `${BRAND.emerald}` : "rgba(255,255,255,0.30)" },
          { label: "Active Agents", value: ALL_AGENTS.length, color: "#ececec" },
        ].map((s, i, arr) => (
          <div key={s.label} style={{ flex: 1, padding: "0.875rem 1.25rem", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(255,255,255,0.30)", marginBottom: "0.25rem" }}>{s.label}</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Agent Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {ALL_AGENTS.map((agentName) => {
          const meta = AGENT_REGISTRY[agentName];
          const stats = statsMap.get(agentName);
          const successRate = stats && stats.totalRuns > 0
            ? Math.round((stats.successRuns / stats.totalRuns) * 100)
            : null;
          const isSelected = selectedAgent === agentName;
          const isActivating =
            (agentName === "Lead Discovery" && triggerDiscovery.isPending) ||
            (agentName === "Lead Email Generator" && generateDrafts.isPending) ||
            (agentName === "Natasha Growth" && runNatasha.isPending) ||
            (agentName === "Ted Health" && runTed.isPending);

          return (
            <button
              key={agentName}
              onClick={() => setSelectedAgent(isSelected ? null : agentName)}
              style={{
                textAlign: "left",
                padding: "1rem",
                borderRadius: "0.5rem",
                border: `1px solid ${isSelected ? `${BRAND.emerald}` : "rgba(255,255,255,0.08)"}`,
                background: isSelected ? "rgba(62,207,142,0.04)" : "#111111",
                cursor: "pointer",
                transition: "border-color 0.1s, background 0.1s",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "1.25rem" }}>{meta.icon}</span>
                  <div>
                    <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#ececec" }}>{meta.label}</div>
                    <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.30)" }}>{meta.category}</div>
                  </div>
                </div>
                <StatusText status={stats ? (stats.errorRuns > 0 && stats.successRuns === 0 ? "error" : "idle") : "idle"} />
              </div>
              <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "0 0 0.75rem", lineHeight: 1.5 }}>{meta.description}</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  activateAgent(agentName);
                }}
                disabled={isActivating}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.35rem",
                  marginBottom: "0.75rem", padding: "0.35rem 0.65rem",
                  borderRadius: "0.25rem", border: `1px solid ${emeraldAlpha(0.35)}`,
                  background: emeraldAlpha(0.08), color: `${BRAND.emerald}`,
                  fontSize: "0.75rem", fontWeight: 700, cursor: isActivating ? "wait" : "pointer",
                  opacity: isActivating ? 0.7 : 1,
                }}
              >
                {isActivating ? <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={12} />}
                {agentName === "XBOT Outreach" || agentName === "XBOT Bulk Outreach" || agentName === "Logistics Brief" ? "Open Workflow" : "Activate Agent"}
              </button>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                {[
                  { label: "Runs", value: String(stats?.totalRuns ?? 0), color: "#ececec" },
                  { label: "Success", value: successRate !== null ? `${successRate}%` : "—", color: successRate !== null ? (successRate >= 80 ? `${BRAND.emerald}` : successRate >= 50 ? "#f59e0b" : "#ef4444") : "rgba(255,255,255,0.30)" },
                  { label: "Last Run", value: formatRelative(stats?.lastRunAt), color: "#64748b" },
                ].map((stat) => (
                  <div key={stat.label} style={{ background: "#1C1E22", borderRadius: "0.25rem", padding: "0.5rem", textAlign: "center" }}>
                    <div style={{ fontSize: "1rem", fontWeight: 700, color: stat.color }}>{stat.value}</div>
                    <div style={{ fontSize: "0.625rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(255,255,255,0.30)", marginTop: "0.125rem" }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Run History Table */}
      <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.5rem", overflow: "hidden", background: "#111111" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "#1C1E22" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#ececec", margin: 0 }}>Run History</h2>
            {selectedAgent && (
              <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: `${BRAND.emerald}` }}>
                {selectedAgent}
                <button onClick={() => setSelectedAgent(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.30)", marginLeft: "0.375rem", fontSize: "1rem", lineHeight: 1 }}>×</button>
              </span>
            )}
          </div>
          <span style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.30)" }}>{filteredRuns.length} runs</span>
        </div>

        {filteredRuns.length === 0 ? (
          <div style={{ padding: "3rem 1rem", textAlign: "center", color: "rgba(255,255,255,0.30)", fontSize: "0.875rem" }}>
            No runs recorded yet. Trigger an AI agent to see activity here.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "#1C1E22" }}>
                  {["Agent", "Status", "Triggered By", "Input", "Output / Error", "Started", "Duration"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "0.5rem 1rem", fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map((run) => {
                  const meta = AGENT_REGISTRY[run.agentName];
                  const durationMs = run.completedAt && run.startedAt
                    ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
                    : null;
                  return (
                    <tr key={run.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
                      <td style={{ padding: "0.625rem 1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                          <span>{meta?.icon ?? "🔧"}</span>
                          <span style={{ fontWeight: 500, color: "#ececec" }}>{run.agentName}</span>
                        </div>
                      </td>
                      <td style={{ padding: "0.625rem 1rem" }}>
                        <StatusText status={run.status as "running" | "success" | "error"} />
                      </td>
                      <td style={{ padding: "0.625rem 1rem", color: "#64748b" }}>{run.triggeredBy ?? "—"}</td>
                      <td style={{ padding: "0.625rem 1rem", color: "#64748b", maxWidth: "180px" }}>
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={run.inputSummary ?? ""}>{run.inputSummary ?? "—"}</span>
                      </td>
                      <td style={{ padding: "0.625rem 1rem", maxWidth: "200px", color: run.status === "error" ? "#ef4444" : `${BRAND.emerald}` }}>
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={run.status === "error" ? (run.errorMessage ?? "") : (run.outputSummary ?? "")}>
                          {run.status === "error" ? (run.errorMessage ?? "Error") : (run.outputSummary ?? "—")}
                        </span>
                      </td>
                      <td style={{ padding: "0.625rem 1rem", color: "#64748b", whiteSpace: "nowrap" }}>{formatRelative(run.startedAt)}</td>
                      <td style={{ padding: "0.625rem 1rem", color: "#64748b" }}>
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
    </div>
  );
}
