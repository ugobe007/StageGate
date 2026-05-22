import { describe, expect, it } from "vitest";
import { listCalInsightIds, pickCalInsight } from "./calInsights.js";

describe("pickCalInsight", () => {
  it("returns the same insight for the same seed", () => {
    const ctx = { companyName: "Acme Robotics", showName: "CES 2026" };
    expect(pickCalInsight(ctx)).toBe(pickCalInsight(ctx));
  });

  it("prefers CES-specific insight when show matches", () => {
    const insight = pickCalInsight({ companyName: "TestCo", showName: "CES 2026" });
    expect(insight.toLowerCase()).toMatch(/ces|vegas|paradise|staging/);
  });

  it("does not mention Ready For Robots buyer-signal language", () => {
    for (const id of listCalInsightIds()) {
      const insight = pickCalInsight({ companyName: id, showName: "CES", seed: id });
      expect(insight).not.toMatch(/Ready For Robots|buyer signal|lead score|sales channel/i);
    }
  });
});
