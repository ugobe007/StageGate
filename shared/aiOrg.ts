/**
 * AI Organization — shared metadata for StageGate & ReadyForRobots.
 * Canonical charters: docs/ai-org.md
 */

export type AiAgentId = "relay" | "cal" | "max" | "natasha" | "ted";

export type AiAgentStatus = "live" | "chartered";

export type AiAgentMeta = {
  id: AiAgentId;
  name: string;
  title: string;
  role: string;
  talksTo: string;
  success: string;
  status: AiAgentStatus;
  products: Array<"stagegate" | "readyforrobots">;
  cronPaths: string[];
  modules: string[];
};

export const AI_AGENTS: readonly AiAgentMeta[] = [
  {
    id: "relay",
    name: "Relay",
    title: "Stage Manager",
    role: "AI loop orchestrator — Observe → Act → Verify → Notify",
    talksTo: "Systems, cron, DB, APIs",
    success: "Loop green; conversion metrics up",
    status: "live",
    products: ["stagegate", "readyforrobots"],
    cronPaths: ["/api/scheduled/relay-loop"],
    modules: ["server/agents/relayOperator.ts", "server/agents/relayPlaybook.ts"],
  },
  {
    id: "cal",
    name: "Cal",
    title: "Engagement",
    role: "Outreach and customer engagement — emails, replies, drafts",
    talksTo: "Prospects and partners (humans)",
    success: "Replies, meetings, product activation",
    status: "live",
    products: ["stagegate", "readyforrobots"],
    cronPaths: [
      "/api/scheduled/cal-operator",
      "/api/scheduled/sales-agent-outreach",
      "/api/scheduled/quote-followup",
    ],
    modules: [
      "server/agents/salesAgent.ts",
      "server/agents/calOperator.ts",
      "server/agents/frankPlaybook.ts",
    ],
  },
  {
    id: "max",
    name: "Max",
    title: "Research",
    role: "Find and enrich opportunities for Cal to explore",
    talksTo: "Apollo, Hunter, RSS, RFR OEMs, scrapers",
    success: "Fresh, sendable pipeline for Cal",
    status: "live",
    products: ["stagegate", "readyforrobots"],
    cronPaths: [
      "/api/scheduled/sales-agent-discover",
      "/api/scheduled/sales-agent-ingest",
      "/api/scheduled/rss-intelligence",
      "/api/scheduled/enrich-contacts",
      "/api/scheduled/nightly-research",
    ],
    modules: [
      "server/research-agent.ts",
      "server/agents/salesAgentDiscovery.ts",
      "server/agents/prospectEnrichment.ts",
      "server/agents/rssIntelligence.ts",
    ],
  },
  {
    id: "natasha",
    name: "Natasha",
    title: "Marketing",
    role: "Signup funnels, UI conversion, growth experiments",
    talksTo: "Product and marketing surfaces",
    success: "Signups and activation rate",
    status: "live",
    products: ["stagegate", "readyforrobots"],
    cronPaths: ["/api/scheduled/natasha-operator"],
    modules: [
      "server/agents/natashaOperator.ts",
      "server/agents/natashaPlaybook.ts",
    ],
  },
  {
    id: "ted",
    name: "Ted",
    title: "Performance",
    role: "Site performance, cron health, error budgets",
    talksTo: "Runtime metrics and deploy signals",
    success: "Faster pages, fewer regressions",
    status: "live",
    products: ["stagegate", "readyforrobots"],
    cronPaths: ["/api/scheduled/ted-operator"],
    modules: [
      "server/agents/tedOperator.ts",
      "server/agents/tedPlaybook.ts",
      "server/agents/relayOperator.ts",
    ],
  },
] as const;

export function getAiAgent(id: AiAgentId): AiAgentMeta {
  const agent = AI_AGENTS.find((a) => a.id === id);
  if (!agent) throw new Error(`Unknown AI agent: ${id}`);
  return agent;
}
