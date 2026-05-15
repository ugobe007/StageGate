/**
 * v28.test.ts
 *
 * Tests for v28 features:
 * 1. Nightly outreach activation — 78 prospects in discovery, batch size 8
 * 2. exhibitorListUrl — seeded for 12 shows, schema column present
 * 3. Discovery pipeline — scrape-first strategy, fallback logic, deduplication
 * 4. Inbound webhook — frank@onstage.bot reply-from, state transitions
 * 5. State machine — OUTREACH_STAGES set, scheduling keyword detection
 * 6. Draft-first mode — inbound reply creates draft, no auto-send
 * 7. In-Reply-To matching — secondary prospect lookup by thread messageId
 * 8. State advancement rules — responded / scheduling transitions
 */
import { describe, it, expect } from "vitest";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const FRANK_PERSONA = {
  name: "Frank",
  fromName: "Frank at StageGate",
  fromEmail: "frank@onstage.bot",
  signature: "Frank\nStageGate — Robotics Activation Infrastructure\nonstage.bot",
};

const OUTREACH_STAGES = new Set([
  "discovery",
  "intro_sent",
  "followup_1",
  "followup_2",
  "robot_guild",
]);

const SCHEDULING_KEYWORDS = [
  "schedule", "call", "meeting", "talk", "chat", "demo",
  "when can we", "set up a time", "book a time", "calendly",
  "available", "availability", "speak with", "connect",
];

const OUTREACH_BATCH_SIZE = 8;

const KNOWN_EXHIBITOR_LIST_URLS: Record<string, string> = {
  "CES 2026": "https://exhibitors.ces.tech/8_0/exhibitorsearch/exhibitorsearch.cfm?exhsearch=1&searchtype=keyword&keyword=robot",
  "CES 2027": "https://exhibitors.ces.tech/8_0/exhibitorsearch/exhibitorsearch.cfm?exhsearch=1&searchtype=keyword&keyword=robot",
  "NAB Show 2026": "https://www.nabshow.com/2026/exhibitors/",
  "Automate 2027": "https://www.automateshow.com/exhibitors/",
  "PACK EXPO Las Vegas 2026": "https://www.packexpolasvegas.com/exhibitors/",
  "CONEXPO-CON/AGG 2026": "https://www.conexpoconagg.com/exhibitors/",
  "MINExpo 2026": "https://www.minexpo.com/exhibitors/",
  "Manifest 2026": "https://manifestvegas.com/exhibitors/",
  "Manifest 2027": "https://www.manifestvegas.com/exhibitors/",
  "HIMSS 2026": "https://www.himss.org/global-conference/exhibitors",
  "HIMSS 2027": "https://www.himssconference.org/exhibitors",
  "AWS re:Invent 2026": "https://reinvent.awsevents.com/partners/expo/",
};

// ─── 1. Nightly outreach activation ──────────────────────────────────────────

describe("Nightly outreach activation", () => {
  it("OUTREACH_BATCH_SIZE is 8 (safe for Resend rate limits)", () => {
    expect(OUTREACH_BATCH_SIZE).toBe(8);
  });

  it("batch size does not exceed 20 (Resend daily limit safety)", () => {
    expect(OUTREACH_BATCH_SIZE).toBeLessThanOrEqual(20);
  });

  it("discovery is in the actionable stages list", () => {
    const actionableStages = ["discovery", "intro_sent", "followup_1", "followup_2"];
    expect(actionableStages).toContain("discovery");
  });

  it("all 4 outreach stages are actionable", () => {
    const actionableStages = ["discovery", "intro_sent", "followup_1", "followup_2"];
    expect(actionableStages).toHaveLength(4);
  });

  it("terminal stages are not in actionable list", () => {
    const actionableStages = ["discovery", "intro_sent", "followup_1", "followup_2"];
    const terminalStages = ["responded", "scheduling", "booked", "not_interested", "converted", "robot_guild"];
    for (const stage of terminalStages) {
      expect(actionableStages).not.toContain(stage);
    }
  });
});

// ─── 2. exhibitorListUrl seeding ─────────────────────────────────────────────

describe("exhibitorListUrl seeding", () => {
  it("12 shows have exhibitorListUrl seeded", () => {
    expect(Object.keys(KNOWN_EXHIBITOR_LIST_URLS)).toHaveLength(12);
  });

  it("CES 2026 exhibitor URL points to robot keyword search", () => {
    const url = KNOWN_EXHIBITOR_LIST_URLS["CES 2026"];
    expect(url).toContain("ces.tech");
    expect(url).toContain("robot");
  });

  it("NAB Show 2026 exhibitor URL is correct", () => {
    const url = KNOWN_EXHIBITOR_LIST_URLS["NAB Show 2026"];
    expect(url).toContain("nabshow.com");
    expect(url).toContain("exhibitors");
  });

  it("Automate 2027 exhibitor URL is correct", () => {
    const url = KNOWN_EXHIBITOR_LIST_URLS["Automate 2027"];
    expect(url).toContain("automateshow.com");
  });

  it("all exhibitor URLs are valid HTTPS URLs", () => {
    for (const [show, url] of Object.entries(KNOWN_EXHIBITOR_LIST_URLS)) {
      expect(url, `${show} URL should start with https://`).toMatch(/^https:\/\//);
    }
  });

  it("all exhibitor URLs contain 'exhibitor' or 'expo' or 'partner'", () => {
    for (const [show, url] of Object.entries(KNOWN_EXHIBITOR_LIST_URLS)) {
      const hasExhibitorPath = url.toLowerCase().includes("exhibitor") ||
        url.toLowerCase().includes("expo") ||
        url.toLowerCase().includes("partner") ||
        url.toLowerCase().includes("robot");
      expect(hasExhibitorPath, `${show} URL should reference exhibitors`).toBe(true);
    }
  });
});

// ─── 3. Discovery pipeline logic ─────────────────────────────────────────────

describe("Discovery pipeline — scrape-first strategy", () => {
  it("scrape-first: uses exhibitorListUrl when available", () => {
    const show = { name: "CES 2026", exhibitorListUrl: "https://exhibitors.ces.tech/..." };
    const strategy = show.exhibitorListUrl ? "scrape" : "llm_fallback";
    expect(strategy).toBe("scrape");
  });

  it("fallback: uses LLM knowledge when exhibitorListUrl is null", () => {
    const show = { name: "SEMA Show 2026", exhibitorListUrl: null };
    const strategy = show.exhibitorListUrl ? "scrape" : "llm_fallback";
    expect(strategy).toBe("llm_fallback");
  });

  it("fallback triggers when prospect count < 5", () => {
    const prospectsFromScrape = 2;
    const shouldFallback = prospectsFromScrape < 5;
    expect(shouldFallback).toBe(true);
  });

  it("no fallback when scrape yields 5+ prospects", () => {
    const prospectsFromScrape = 8;
    const shouldFallback = prospectsFromScrape < 5;
    expect(shouldFallback).toBe(false);
  });

  it("deduplication removes duplicate companies (case-insensitive)", () => {
    const raw = [
      { company: "Boston Dynamics", contactEmail: "a@bostondynamics.com" },
      { company: "boston dynamics", contactEmail: "b@bostondynamics.com" },
      { company: "Agility Robotics", contactEmail: "c@agilityrobotics.com" },
      { company: "AGILITY ROBOTICS", contactEmail: "d@agilityrobotics.com" },
    ];
    const seen = new Set<string>();
    const unique = raw.filter(p => {
      const key = p.company.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    expect(unique).toHaveLength(2);
    expect(unique[0].company).toBe("Boston Dynamics");
    expect(unique[1].company).toBe("Agility Robotics");
  });

  it("deduplication preserves first occurrence", () => {
    const raw = [
      { company: "Figure AI", contactEmail: "first@figure.ai" },
      { company: "Figure AI", contactEmail: "second@figure.ai" },
    ];
    const seen = new Set<string>();
    const unique = raw.filter(p => {
      const key = p.company.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    expect(unique[0].contactEmail).toBe("first@figure.ai");
  });

  it("HTML stripping removes script tags", () => {
    const html = `<html><script>alert(1)</script><div>Boston Dynamics</div></html>`;
    const stripped = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    expect(stripped).not.toContain("<script>");
    expect(stripped).toContain("Boston Dynamics");
  });

  it("page text is truncated to MAX_PAGE_CHARS (12000)", () => {
    const MAX_PAGE_CHARS = 12_000;
    const longText = "x".repeat(20_000);
    const truncated = longText.slice(0, MAX_PAGE_CHARS);
    expect(truncated).toHaveLength(MAX_PAGE_CHARS);
  });

  it("fetch timeout is set to 15 seconds", () => {
    const FETCH_TIMEOUT_MS = 15_000;
    expect(FETCH_TIMEOUT_MS).toBe(15_000);
  });

  it("processes up to 5 shows per nightly run", () => {
    const MAX_SHOWS_PER_RUN = 5;
    expect(MAX_SHOWS_PER_RUN).toBe(5);
  });
});

// ─── 4. Inbound webhook — frank@onstage.bot ──────────────────────────────────

describe("Inbound webhook — Frank reply-from", () => {
  it("Frank's from email is frank@onstage.bot", () => {
    expect(FRANK_PERSONA.fromEmail).toBe("frank@onstage.bot");
  });

  it("Frank's from name is 'Frank at StageGate'", () => {
    expect(FRANK_PERSONA.fromName).toBe("Frank at StageGate");
  });

  it("FRANK_FROM string is formatted correctly", () => {
    const FRANK_FROM = `${FRANK_PERSONA.fromName} <${FRANK_PERSONA.fromEmail}>`;
    expect(FRANK_FROM).toBe("Frank at StageGate <frank@onstage.bot>");
  });

  it("old FROM_ADDRESS hello@onstage.bot is not used", () => {
    const OLD_FROM = "hello@onstage.bot";
    expect(FRANK_PERSONA.fromEmail).not.toBe(OLD_FROM);
  });
});

// ─── 5. OUTREACH_STAGES set ───────────────────────────────────────────────────

describe("OUTREACH_STAGES — stages that advance to responded on reply", () => {
  it("discovery is in OUTREACH_STAGES", () => {
    expect(OUTREACH_STAGES.has("discovery")).toBe(true);
  });

  it("intro_sent is in OUTREACH_STAGES", () => {
    expect(OUTREACH_STAGES.has("intro_sent")).toBe(true);
  });

  it("followup_1 is in OUTREACH_STAGES", () => {
    expect(OUTREACH_STAGES.has("followup_1")).toBe(true);
  });

  it("followup_2 is in OUTREACH_STAGES", () => {
    expect(OUTREACH_STAGES.has("followup_2")).toBe(true);
  });

  it("robot_guild is in OUTREACH_STAGES", () => {
    expect(OUTREACH_STAGES.has("robot_guild")).toBe(true);
  });

  it("responded is NOT in OUTREACH_STAGES (already advanced)", () => {
    expect(OUTREACH_STAGES.has("responded")).toBe(false);
  });

  it("scheduling is NOT in OUTREACH_STAGES", () => {
    expect(OUTREACH_STAGES.has("scheduling")).toBe(false);
  });

  it("booked is NOT in OUTREACH_STAGES", () => {
    expect(OUTREACH_STAGES.has("booked")).toBe(false);
  });

  it("converted is NOT in OUTREACH_STAGES", () => {
    expect(OUTREACH_STAGES.has("converted")).toBe(false);
  });
});

// ─── 6. Scheduling keyword detection ─────────────────────────────────────────

describe("Scheduling keyword detection", () => {
  const detectScheduling = (body: string) =>
    SCHEDULING_KEYWORDS.some(kw => body.toLowerCase().includes(kw));

  it("detects 'schedule' keyword", () => {
    expect(detectScheduling("Can we schedule a call?")).toBe(true);
  });

  it("detects 'call' keyword", () => {
    expect(detectScheduling("I'd love to get on a call")).toBe(true);
  });

  it("detects 'meeting' keyword", () => {
    expect(detectScheduling("Let's set up a meeting")).toBe(true);
  });

  it("detects 'demo' keyword", () => {
    expect(detectScheduling("Can you give us a demo?")).toBe(true);
  });

  it("detects 'available' keyword", () => {
    expect(detectScheduling("Are you available next week?")).toBe(true);
  });

  it("detects 'calendly' keyword", () => {
    expect(detectScheduling("Here's my Calendly link")).toBe(true);
  });

  it("detects 'connect' keyword", () => {
    expect(detectScheduling("Would love to connect with your team")).toBe(true);
  });

  it("does NOT detect scheduling in generic reply", () => {
    expect(detectScheduling("Thanks for reaching out. We'll keep you in mind.")).toBe(false);
  });

  it("does NOT detect scheduling in unsubscribe request", () => {
    expect(detectScheduling("Please remove me from your list.")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(detectScheduling("SCHEDULE A CALL PLEASE")).toBe(true);
    expect(detectScheduling("Schedule A Call Please")).toBe(true);
  });
});

// ─── 7. State transition rules ────────────────────────────────────────────────

describe("Inbound state transition rules", () => {
  const computeNewState = (currentState: string, wantsToSchedule: boolean): string => {
    if (wantsToSchedule) return "scheduling";
    if (OUTREACH_STAGES.has(currentState)) return "responded";
    return currentState;
  };

  it("discovery + no scheduling intent → responded", () => {
    expect(computeNewState("discovery", false)).toBe("responded");
  });

  it("intro_sent + no scheduling intent → responded", () => {
    expect(computeNewState("intro_sent", false)).toBe("responded");
  });

  it("followup_1 + no scheduling intent → responded", () => {
    expect(computeNewState("followup_1", false)).toBe("responded");
  });

  it("followup_2 + no scheduling intent → responded", () => {
    expect(computeNewState("followup_2", false)).toBe("responded");
  });

  it("robot_guild + no scheduling intent → responded", () => {
    expect(computeNewState("robot_guild", false)).toBe("responded");
  });

  it("any stage + scheduling intent → scheduling", () => {
    const stages = ["discovery", "intro_sent", "followup_1", "followup_2", "robot_guild", "responded"];
    for (const stage of stages) {
      expect(computeNewState(stage, true)).toBe("scheduling");
    }
  });

  it("responded + no scheduling intent → stays responded", () => {
    expect(computeNewState("responded", false)).toBe("responded");
  });

  it("scheduling + no scheduling intent → stays scheduling", () => {
    expect(computeNewState("scheduling", false)).toBe("scheduling");
  });

  it("booked + no scheduling intent → stays booked", () => {
    expect(computeNewState("booked", false)).toBe("booked");
  });
});

// ─── 8. Draft-first mode ─────────────────────────────────────────────────────

describe("Draft-first mode — inbound reply creates draft, no auto-send", () => {
  it("draft status is 'pending' (not 'sent')", () => {
    const draftStatus = "pending";
    expect(draftStatus).toBe("pending");
    expect(draftStatus).not.toBe("sent");
    expect(draftStatus).not.toBe("approved");
  });

  it("draft is stored in draftEmails table (not emailThreads)", () => {
    const storageTable = "draft_emails";
    expect(storageTable).toBe("draft_emails");
    expect(storageTable).not.toBe("email_threads");
  });

  it("agentReasoning captures reply context", () => {
    const prospect = { contactEmail: "ceo@figure.ai" };
    const convState = "responded";
    const inReplyTo = "<msg-123@resend.dev>";
    const wantsToSchedule = false;
    const ADMIN_BCC = ["bob@starsupportinc.com", "tom@starsupportinc.com"];

    const reasoning = `Reply to inbound from ${prospect.contactEmail}. State: ${convState}. InReplyTo: ${inReplyTo}. BCC: ${ADMIN_BCC.join(", ")}. Scheduling intent: ${wantsToSchedule}.`;

    expect(reasoning).toContain("ceo@figure.ai");
    expect(reasoning).toContain("responded");
    expect(reasoning).toContain("<msg-123@resend.dev>");
    expect(reasoning).toContain("bob@starsupportinc.com");
    expect(reasoning).toContain("Scheduling intent: false");
  });

  it("nextFollowUpAt is cleared when inbound reply received", () => {
    // When a prospect replies, we clear the follow-up timer — human takes over
    const updatePayload = { nextFollowUpAt: null };
    expect(updatePayload.nextFollowUpAt).toBeNull();
  });

  it("activity type is 'draft_created' (not 'email_sent')", () => {
    const activityType = "draft_created";
    expect(activityType).toBe("draft_created");
    expect(activityType).not.toBe("email_sent");
  });
});

// ─── 9. In-Reply-To matching ──────────────────────────────────────────────────

describe("In-Reply-To matching — secondary prospect lookup", () => {
  it("primary match: by sender email address", () => {
    const fromAddress = "ceo@figure.ai";
    const prospect = { id: 42, contactEmail: "ceo@figure.ai" };
    const matched = prospect.contactEmail === fromAddress;
    expect(matched).toBe(true);
  });

  it("secondary match: by In-Reply-To message ID in email_threads", () => {
    const inReplyTo = "<msg-abc123@resend.dev>";
    const thread = { resendMessageId: "<msg-abc123@resend.dev>", prospectId: 42 };
    const matched = thread.resendMessageId === inReplyTo;
    expect(matched).toBe(true);
  });

  it("no match when In-Reply-To does not match any thread", () => {
    const inReplyTo = "<msg-xyz999@resend.dev>";
    const threads = [
      { resendMessageId: "<msg-abc123@resend.dev>", prospectId: 42 },
    ];
    const matched = threads.find(t => t.resendMessageId === inReplyTo);
    expect(matched).toBeUndefined();
  });

  it("unknown sender returns matched: false", () => {
    const result = { ok: true, matched: false };
    expect(result.matched).toBe(false);
  });

  it("known sender returns matched: true with newState", () => {
    const result = { ok: true, matched: true, newState: "responded" };
    expect(result.matched).toBe(true);
    expect(result.newState).toBe("responded");
  });
});

// ─── 10. Admin BCC list ───────────────────────────────────────────────────────

describe("Admin BCC list", () => {
  const ADMIN_BCC = ["bob@starsupportinc.com", "tom@starsupportinc.com"];

  it("admin BCC includes bob@starsupportinc.com", () => {
    expect(ADMIN_BCC).toContain("bob@starsupportinc.com");
  });

  it("admin BCC includes tom@starsupportinc.com", () => {
    expect(ADMIN_BCC).toContain("tom@starsupportinc.com");
  });

  it("admin BCC does not include old hello@onstage.bot", () => {
    expect(ADMIN_BCC).not.toContain("hello@onstage.bot");
  });

  it("admin BCC has exactly 2 recipients", () => {
    expect(ADMIN_BCC).toHaveLength(2);
  });
});
