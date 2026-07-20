import { describe, expect, it } from "vitest";
import {
  evaluateAutoSendPolicy,
  parseDraftIntent,
} from "./relayAutoSend.js";

describe("relayAutoSend — parseDraftIntent", () => {
  it("extracts intent from inbound draft agentReasoning", () => {
    expect(
      parseDraftIntent("Intent: POSITIVE_SCHEDULE | State: scheduling | CalendarBooked: true"),
    ).toBe("POSITIVE_SCHEDULE");
    expect(parseDraftIntent(null)).toBeNull();
  });
});

describe("relayAutoSend — evaluateAutoSendPolicy", () => {
  const base = {
    emailConfidence: "high",
    isPartnerDraft: false,
    suppressed: false,
    hasEmail: true,
    draftStatus: "pending" as const,
    introsPaused: false,
  };

  it("blocks new intros when circuit breaker is open", () => {
    const d = evaluateAutoSendPolicy({
      ...base,
      convState: "discovery",
      introsPaused: true,
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("blocked_breaker");
  });

  it("allows approved follow-ups when breaker is open", () => {
    const d = evaluateAutoSendPolicy({
      ...base,
      convState: "followup_1",
      introsPaused: true,
      draftStatus: "approved",
    });
    expect(d.allowed).toBe(true);
    expect(d.reason).toBe("approved_followup");
  });

  it("auto-sends inbound scheduling intents", () => {
    const d = evaluateAutoSendPolicy({
      ...base,
      convState: "scheduling",
      intent: "POSITIVE_SCHEDULE",
    });
    expect(d.allowed).toBe(true);
    expect(d.reason).toBe("inbound_scheduling");
  });

  it("blocks questions for human review", () => {
    const d = evaluateAutoSendPolicy({
      ...base,
      convState: "awaiting_reply",
      intent: "QUESTION",
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("blocked_question");
  });

  it("blocks suppressed addresses", () => {
    const d = evaluateAutoSendPolicy({
      ...base,
      convState: "followup_1",
      suppressed: true,
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("blocked_suppressed");
  });
});

describe("relayPlaybook", () => {
  it("exports Relay persona constants", async () => {
    const mod = await import("./relayPlaybook.js");
    expect(mod.RELAY_PERSONA.name).toBe("Relay");
    expect(mod.RELAY_LOOP_STEPS).toContain("observe");
    expect(mod.RELAY_AUTONOMY_CHARTER.alwaysAutonomous.length).toBeGreaterThan(0);
  });
});

describe("formatRelayDailyReport — AI org labels", () => {
  it("labels Ted health, Max enrich, and Natasha growth", async () => {
    const { formatRelayDailyReport } = await import("./relayOperator.js");
    const report = formatRelayDailyReport({
      stepsCompleted: ["observe", "act", "verify", "learn"],
      health: {
        outreachDisabled: false,
        hunterEnabled: true,
        forgeConfigured: true,
        resendConfigured: true,
        bounceRate: 0.02,
        introsPaused: false,
        cronsRegistered: 10,
        cronsMissing: [],
        failedRunsLast24h: 0,
        staleRunningRuns: 0,
      },
      ted: {
        health: {
          outreachDisabled: false,
          hunterEnabled: true,
          forgeConfigured: true,
          resendConfigured: true,
          bounceRate: 0.02,
          introsPaused: false,
          cronsRegistered: 10,
          cronsMissing: [],
          failedRunsLast24h: 0,
          staleRunningRuns: 0,
        },
        grade: "green",
        recommendations: ["Loop green — watch bounce rate and cron heartbeats; no action required."],
        errors: [],
      },
      calOperator: {
        junkDismissed: 1,
        websitesResolved: 0,
        websitesDismissed: 0,
        emailsEnriched: 3,
        draftsRedrafted: 0,
        draftsGenerated: 2,
        partnerDraftsGenerated: 0,
        partnerOutreachAfter: {
          totalRecipients: 0,
          withEmail: 0,
          needsEmail: 0,
          needsDraft: 0,
          pendingReview: 0,
          approvedToSend: 0,
          sent: 0,
          bySource: { prospect: 0, vendor: 0, logistics_partner: 0 },
        },
        quarantined: 0,
        quarantineRecovered: 1,
        quarantineUnresolved: 0,
        workflowAfter: {
          needsWebsite: 0,
          needsContactFix: 0,
          needsDraft: 1,
          pendingReview: 0,
          readyToSend: 0,
          followUpDue: 0,
          awaitingReply: 0,
          suggestedStep: "draft",
        },
        errors: [],
      },
      natasha: {
        funnel: {
          usersLast7d: 2,
          usersTotal: 40,
          newsletterLast7d: 1,
          newsletterTotal: 12,
          companyProfilesLast7d: 1,
          demosLast7d: 0,
          demosPending: 0,
          quotesLast7d: 0,
          quotesPending: 0,
        },
        brief: {
          socialPosts: ["Robot floors teach patience"],
          newsletterHooks: ["What six-month deployments reveal"],
          whitepaperTopics: ["Workflow before hardware"],
          uiExperiments: ["Test Get Started CTA above the fold on /register"],
          signupNudges: ["Add one-line value prop under signup email field"],
        },
        errors: [],
      },
      autoSend: { attempted: 0, sent: 0, skipped: 0, failed: 0, decisions: [], errors: [] },
      staleDraftsDiscarded: 0,
      suppressionsNormalized: 0,
      cronsBootstrapped: true,
      conversion: {
        usersTotal: 10,
        usersLast7d: 1,
        demosTotal: 0,
        demosPending: 0,
        demosLast7d: 0,
        quotesTotal: 0,
        quotesPending: 0,
        quotesLast7d: 0,
        ordersTotal: 0,
        ordersPaid: 0,
        prospectsTotal: 5,
        prospectsScheduled: 0,
        prospectsConverted: 0,
      },
      missions: [],
      workflowAfter: {
        needsWebsite: 0,
        needsContactFix: 0,
        needsDraft: 1,
        pendingReview: 0,
        readyToSend: 0,
        followUpDue: 0,
        awaitingReply: 0,
        suggestedStep: "draft",
      },
      maxReadyForCal: 4,
      escalations: [],
      learnings: "Max enriched 3 contacts.",
      errors: [],
    });

    expect(report).toMatch(/Health \(Ted\)/);
    expect(report).toMatch(/Max:/);
    expect(report).toMatch(/ready for Cal: 4/);
    expect(report).toMatch(/Natasha:/);
    expect(report).toMatch(/Growth \(Natasha\)/);
    expect(report).toMatch(/UI: Test Get Started/);
  });
});
