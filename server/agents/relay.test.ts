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
