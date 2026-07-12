import { describe, expect, it } from "vitest";
import { listCalInsightIds, pickCalInsight } from "./calInsights.js";

describe("pickCalInsight", () => {
  it("returns the same insight for the same seed", () => {
    const ctx = { companyName: "Acme Robotics", showName: "CES 2026" };
    expect(pickCalInsight(ctx)).toBe(pickCalInsight(ctx));
  });

  it("prefers robot-type-specific insight when robotType matches", () => {
    const insight = pickCalInsight({ companyName: "TestCo", robotType: "humanoid" });
    expect(insight.toLowerCase()).toMatch(/humanoid|calibration|safety|maintenance/);
  });

  it("returns a deployment-focused lesson, not sales language", () => {
    for (const id of listCalInsightIds()) {
      const insight = pickCalInsight({ companyName: id, seed: id });
      expect(insight).not.toMatch(/Ready For Robots|buyer signal|lead score|sales channel|book a demo|special offer/i);
    }
  });
});
