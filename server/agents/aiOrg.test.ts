import { describe, expect, it } from "vitest";
import { AI_AGENTS, getAiAgent } from "../../shared/aiOrg.js";

describe("AI org registry", () => {
  it("includes Relay, Cal, Max, Natasha, Ted", () => {
    expect(AI_AGENTS.map((a) => a.id).sort()).toEqual(
      ["cal", "max", "natasha", "relay", "ted"].sort(),
    );
  });

  it("marks all labeled agents as live", () => {
    expect(getAiAgent("cal").status).toBe("live");
    expect(getAiAgent("max").status).toBe("live");
    expect(getAiAgent("relay").status).toBe("live");
    expect(getAiAgent("natasha").status).toBe("live");
    expect(getAiAgent("ted").status).toBe("live");
  });

  it("assigns Natasha the marketing cron path", () => {
    expect(getAiAgent("natasha").cronPaths).toContain("/api/scheduled/natasha-operator");
  });

  it("assigns Ted the performance cron path", () => {
    expect(getAiAgent("ted").cronPaths).toContain("/api/scheduled/ted-operator");
  });

  it("assigns Max the research cron paths", () => {
    const max = getAiAgent("max");
    expect(max.cronPaths).toContain("/api/scheduled/sales-agent-discover");
    expect(max.cronPaths).toContain("/api/scheduled/enrich-contacts");
    expect(max.cronPaths).toContain("/api/scheduled/nightly-research");
  });

  it("scopes all agents to both products", () => {
    for (const agent of AI_AGENTS) {
      expect(agent.products).toContain("stagegate");
      expect(agent.products).toContain("readyforrobots");
    }
  });
});
