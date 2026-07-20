import { describe, expect, it } from "vitest";
import { TED_PERSONA, TED_REPORT_TITLE } from "./tedPlaybook.js";
import {
  buildTedRecommendations,
  formatTedReport,
  gradeTedHealth,
  type TedHealthObservation,
  type TedOperatorResult,
} from "./tedOperator.js";

const healthy: TedHealthObservation = {
  outreachDisabled: false,
  hunterEnabled: true,
  forgeConfigured: true,
  resendConfigured: true,
  bounceRate: 0.02,
  introsPaused: false,
  cronsRegistered: 13,
  cronsMissing: [],
  failedRunsLast24h: 0,
  staleRunningRuns: 0,
};

describe("Ted playbook", () => {
  it("names Ted as Performance", () => {
    expect(TED_PERSONA.name).toBe("Ted");
    expect(TED_PERSONA.role).toBe("Performance");
    expect(TED_REPORT_TITLE).toMatch(/Ted/);
  });
});

describe("Ted health grading", () => {
  it("grades green when loop is healthy", () => {
    expect(gradeTedHealth(healthy)).toBe("green");
  });

  it("grades red when Resend is missing", () => {
    expect(gradeTedHealth({ ...healthy, resendConfigured: false })).toBe("red");
  });

  it("grades yellow when circuit breaker is open", () => {
    expect(
      gradeTedHealth({ ...healthy, introsPaused: true, bounceRate: 0.15 }),
    ).toBe("yellow");
  });

  it("recommends fixing missing crons", () => {
    const tips = buildTedRecommendations({
      ...healthy,
      cronsMissing: ["ted_operator_job_task_uid"],
    });
    expect(tips.some((t) => /missing cron/i.test(t))).toBe(true);
  });
});

describe("formatTedReport", () => {
  it("includes grade and recommendations", () => {
    const result: TedOperatorResult = {
      health: healthy,
      grade: "green",
      recommendations: ["Loop green — watch bounce rate and cron heartbeats; no action required."],
      errors: [],
    };
    const report = formatTedReport(result);
    expect(report).toMatch(/GREEN/);
    expect(report).toMatch(/Recommendations/);
    expect(report).toMatch(/— Ted/);
  });
});
