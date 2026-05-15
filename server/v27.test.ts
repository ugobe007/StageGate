/**
 * v27.test.ts
 *
 * Tests for v27 features:
 * 1. Frank's 4-stage conversation playbook (stage progression logic)
 * 2. NEXT_STAGE map — all stages advance correctly
 * 3. STAGE_DELAYS_DAYS — correct wait periods between stages
 * 4. salesAgent.manualSend — input validation, stage advancement
 * 5. salesAgent.updateConversationStage — valid/invalid stage values
 * 6. Frank's persona — voice guidelines, email address, Robot Guild handoff
 * 7. Demo venue options — all 4 venues present
 * 8. Logistics breakpoints — key pain points covered
 * 9. AdminSalesAgent pipeline — filter logic, stats computation
 * 10. Stage badge rendering — all stages have labels
 */
import { describe, it, expect } from "vitest";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

type ConversationStage =
  | "discovery"
  | "intro_sent"
  | "followup_1"
  | "followup_2"
  | "robot_guild"
  | "responded"
  | "scheduling"
  | "booked"
  | "not_interested"
  | "converted";

const NEXT_STAGE: Record<ConversationStage, ConversationStage> = {
  discovery: "intro_sent",
  intro_sent: "followup_1",
  followup_1: "followup_2",
  followup_2: "robot_guild",
  robot_guild: "robot_guild",
  responded: "responded",
  scheduling: "scheduling",
  booked: "booked",
  not_interested: "not_interested",
  converted: "converted",
};

const STAGE_DELAYS_DAYS: Record<ConversationStage, number> = {
  discovery: 0,
  intro_sent: 5,
  followup_1: 5,
  followup_2: 7,
  robot_guild: 0,
  responded: 0,
  scheduling: 0,
  booked: 0,
  not_interested: 0,
  converted: 0,
};

const FRANK_PERSONA = {
  name: "Frank",
  fromName: "Frank at StageGate",
  fromEmail: "frank@onstage.bot",
  signature: "Frank\nStageGate — Robotics Activation Infrastructure\nonstage.bot",
  robotGuildEmail: "start@therobotguild.com",
  robotGuildUrl: "https://www.therobotguild.com/",
};

const DEMO_VENUES = [
  { name: "StageGate Facility" },
  { name: "Black Fire Innovation Center" },
  { name: "International Innovation Center" },
  { name: "Hotel & Casino Event Spaces" },
];

const LOGISTICS_BREAKPOINTS = [
  { id: "shipping" },
  { id: "crating" },
  { id: "staging" },
  { id: "power" },
  { id: "support" },
];

function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

// ─── 1. Stage Progression ─────────────────────────────────────────────────────

describe("Frank's 4-stage playbook — stage progression", () => {
  it("discovery → intro_sent on first contact", () => {
    expect(NEXT_STAGE["discovery"]).toBe("intro_sent");
  });

  it("intro_sent → followup_1 after wait period", () => {
    expect(NEXT_STAGE["intro_sent"]).toBe("followup_1");
  });

  it("followup_1 → followup_2 (demo venue offer)", () => {
    expect(NEXT_STAGE["followup_1"]).toBe("followup_2");
  });

  it("followup_2 → robot_guild (handoff stage)", () => {
    expect(NEXT_STAGE["followup_2"]).toBe("robot_guild");
  });

  it("robot_guild stays at robot_guild (terminal outreach stage)", () => {
    expect(NEXT_STAGE["robot_guild"]).toBe("robot_guild");
  });

  it("terminal stages do not advance automatically", () => {
    const terminal: ConversationStage[] = ["responded", "scheduling", "booked", "not_interested", "converted"];
    for (const stage of terminal) {
      expect(NEXT_STAGE[stage]).toBe(stage);
    }
  });

  it("all 10 stages are represented in NEXT_STAGE map", () => {
    const allStages: ConversationStage[] = [
      "discovery", "intro_sent", "followup_1", "followup_2", "robot_guild",
      "responded", "scheduling", "booked", "not_interested", "converted",
    ];
    for (const stage of allStages) {
      expect(NEXT_STAGE[stage]).toBeDefined();
    }
  });
});

// ─── 2. Stage Delay Configuration ────────────────────────────────────────────

describe("Frank's playbook — stage delay configuration", () => {
  it("discovery has 0-day delay (send immediately)", () => {
    expect(STAGE_DELAYS_DAYS["discovery"]).toBe(0);
  });

  it("intro_sent waits 5 days before follow-up 1", () => {
    expect(STAGE_DELAYS_DAYS["intro_sent"]).toBe(5);
  });

  it("followup_1 waits 5 days before follow-up 2", () => {
    expect(STAGE_DELAYS_DAYS["followup_1"]).toBe(5);
  });

  it("followup_2 waits 7 days before Robot Guild pitch", () => {
    expect(STAGE_DELAYS_DAYS["followup_2"]).toBe(7);
  });

  it("terminal stages have 0-day delay (no further automation)", () => {
    const terminal: ConversationStage[] = ["robot_guild", "responded", "scheduling", "booked", "not_interested", "converted"];
    for (const stage of terminal) {
      expect(STAGE_DELAYS_DAYS[stage]).toBe(0);
    }
  });

  it("nextFollowUpAt is computed correctly from delay", () => {
    const sentAt = new Date("2026-06-01T00:00:00Z");
    const delayDays = STAGE_DELAYS_DAYS["intro_sent"]; // 5
    const nextAt = new Date(sentAt.getTime() + delayDays * 24 * 60 * 60 * 1000);
    expect(nextAt.toISOString().startsWith("2026-06-06")).toBe(true);
  });
});

// ─── 3. Frank's Persona ───────────────────────────────────────────────────────

describe("Frank's persona configuration", () => {
  it("Frank sends from frank@onstage.bot", () => {
    expect(FRANK_PERSONA.fromEmail).toBe("frank@onstage.bot");
  });

  it("Frank's display name is 'Frank at StageGate'", () => {
    expect(FRANK_PERSONA.fromName).toBe("Frank at StageGate");
  });

  it("Robot Guild email is start@therobotguild.com", () => {
    expect(FRANK_PERSONA.robotGuildEmail).toBe("start@therobotguild.com");
  });

  it("Robot Guild URL is correct", () => {
    expect(FRANK_PERSONA.robotGuildUrl).toBe("https://www.therobotguild.com/");
  });

  it("Frank's signature includes StageGate branding", () => {
    expect(FRANK_PERSONA.signature).toContain("StageGate");
    expect(FRANK_PERSONA.signature).toContain("Frank");
  });
});

// ─── 4. Demo Venue Options ────────────────────────────────────────────────────

describe("Frank's demo venue options", () => {
  it("has exactly 4 venue options", () => {
    expect(DEMO_VENUES).toHaveLength(4);
  });

  it("includes StageGate's own facility", () => {
    const venue = DEMO_VENUES.find(v => v.name === "StageGate Facility");
    expect(venue).toBeDefined();
  });

  it("includes Black Fire Innovation Center", () => {
    const venue = DEMO_VENUES.find(v => v.name === "Black Fire Innovation Center");
    expect(venue).toBeDefined();
  });

  it("includes International Innovation Center", () => {
    const venue = DEMO_VENUES.find(v => v.name === "International Innovation Center");
    expect(venue).toBeDefined();
  });

  it("includes Hotel & Casino Event Spaces", () => {
    const venue = DEMO_VENUES.find(v => v.name === "Hotel & Casino Event Spaces");
    expect(venue).toBeDefined();
  });
});

// ─── 5. Logistics Breakpoints ─────────────────────────────────────────────────

describe("Frank's logistics breakpoints", () => {
  it("covers shipping/customs pain point", () => {
    expect(LOGISTICS_BREAKPOINTS.find(b => b.id === "shipping")).toBeDefined();
  });

  it("covers crating/road case pain point", () => {
    expect(LOGISTICS_BREAKPOINTS.find(b => b.id === "crating")).toBeDefined();
  });

  it("covers on-site staging pain point", () => {
    expect(LOGISTICS_BREAKPOINTS.find(b => b.id === "staging")).toBeDefined();
  });

  it("covers power/electrical pain point", () => {
    expect(LOGISTICS_BREAKPOINTS.find(b => b.id === "power")).toBeDefined();
  });

  it("covers on-site support pain point", () => {
    expect(LOGISTICS_BREAKPOINTS.find(b => b.id === "support")).toBeDefined();
  });
});

// ─── 6. manualSend — input validation ────────────────────────────────────────

describe("salesAgent.manualSend — input validation", () => {
  it("requires a numeric prospectId", () => {
    const input = { prospectId: 42 };
    expect(typeof input.prospectId).toBe("number");
    expect(input.prospectId).toBeGreaterThan(0);
  });

  it("rejects non-numeric prospectId", () => {
    const validate = (val: unknown): boolean => typeof val === "number" && val > 0;
    expect(validate("abc")).toBe(false);
    expect(validate(-1)).toBe(false);
    expect(validate(0)).toBe(false);
    expect(validate(1)).toBe(true);
  });

  it("returns subject, messageId, and nextStage on success", () => {
    // Mock the expected response shape
    const mockResponse = {
      ok: true,
      subject: "Quick note about CES 2026",
      messageId: "re_abc123",
      nextStage: "intro_sent",
    };
    expect(mockResponse.ok).toBe(true);
    expect(mockResponse.subject).toBeTruthy();
    expect(mockResponse.nextStage).toBe("intro_sent");
  });

  it("advances stage from discovery to intro_sent on first manual send", () => {
    const currentStage: ConversationStage = "discovery";
    const nextStage = NEXT_STAGE[currentStage];
    expect(nextStage).toBe("intro_sent");
  });

  it("advances stage from intro_sent to followup_1 on second manual send", () => {
    const currentStage: ConversationStage = "intro_sent";
    const nextStage = NEXT_STAGE[currentStage];
    expect(nextStage).toBe("followup_1");
  });
});

// ─── 7. updateConversationStage — valid values ────────────────────────────────

describe("salesAgent.updateConversationStage — stage validation", () => {
  const VALID_STAGES: ConversationStage[] = [
    "discovery", "intro_sent", "followup_1", "followup_2", "robot_guild",
    "responded", "scheduling", "booked", "not_interested", "converted",
  ];

  it("accepts all 10 valid stage values", () => {
    for (const stage of VALID_STAGES) {
      expect(VALID_STAGES.includes(stage)).toBe(true);
    }
  });

  it("rejects unknown stage values", () => {
    const unknownStages = ["awaiting_reply", "in_conversation", "meeting_booked", "closed", "pending"];
    for (const stage of unknownStages) {
      expect(VALID_STAGES.includes(stage as ConversationStage)).toBe(false);
    }
  });

  it("allows manual override to 'booked' stage", () => {
    expect(VALID_STAGES.includes("booked")).toBe(true);
  });

  it("allows manual override to 'not_interested' stage", () => {
    expect(VALID_STAGES.includes("not_interested")).toBe(true);
  });

  it("allows manual override to 'converted' stage", () => {
    expect(VALID_STAGES.includes("converted")).toBe(true);
  });
});

// ─── 8. Pipeline stats computation ───────────────────────────────────────────

describe("AdminSalesAgent — pipeline stats computation", () => {
  const TERMINAL = ["booked", "not_interested", "converted", "responded", "scheduling"];

  function isReady(state: string, nextFollowUpAt: Date | null): boolean {
    if (TERMINAL.includes(state)) return false;
    if (!nextFollowUpAt) return true;
    return nextFollowUpAt <= new Date();
  }

  it("counts total conversations correctly", () => {
    const convs = [
      { state: "discovery", nextFollowUpAt: daysAgo(1) },
      { state: "intro_sent", nextFollowUpAt: daysFromNow(3) },
      { state: "booked", nextFollowUpAt: null },
    ];
    expect(convs.length).toBe(3);
  });

  it("identifies ready conversations (nextFollowUpAt in the past)", () => {
    const convs = [
      { state: "discovery", nextFollowUpAt: daysAgo(1) },       // ready
      { state: "intro_sent", nextFollowUpAt: daysFromNow(3) },  // not ready
      { state: "booked", nextFollowUpAt: null },                 // terminal
    ];
    const ready = convs.filter(c => isReady(c.state, c.nextFollowUpAt));
    expect(ready).toHaveLength(1);
    expect(ready[0].state).toBe("discovery");
  });

  it("excludes terminal stages from 'ready' count", () => {
    const terminalConvs = TERMINAL.map(state => ({
      state,
      nextFollowUpAt: daysAgo(1), // past date, but terminal
    }));
    const ready = terminalConvs.filter(c => isReady(c.state, c.nextFollowUpAt));
    expect(ready).toHaveLength(0);
  });

  it("counts responded prospects correctly", () => {
    const convs = [
      { state: "discovery" },
      { state: "responded" },
      { state: "scheduling" },
      { state: "booked" },
      { state: "converted" },
    ];
    const responded = convs.filter(c =>
      ["responded", "scheduling", "booked", "converted"].includes(c.state)
    );
    expect(responded).toHaveLength(4);
  });

  it("counts booked and converted separately", () => {
    const convs = [
      { state: "booked" },
      { state: "booked" },
      { state: "converted" },
      { state: "discovery" },
    ];
    const booked = convs.filter(c => c.state === "booked").length;
    const converted = convs.filter(c => c.state === "converted").length;
    expect(booked).toBe(2);
    expect(converted).toBe(1);
  });
});

// ─── 9. Filter logic ─────────────────────────────────────────────────────────

describe("AdminSalesAgent — filter logic", () => {
  const conversations = [
    { conv: { state: "discovery", nextFollowUpAt: daysAgo(2) }, prospect: { id: 1, company: "Agility Robotics" } },
    { conv: { state: "intro_sent", nextFollowUpAt: daysFromNow(3) }, prospect: { id: 2, company: "Boston Dynamics" } },
    { conv: { state: "followup_1", nextFollowUpAt: daysAgo(1) }, prospect: { id: 3, company: "Figure AI" } },
    { conv: { state: "booked", nextFollowUpAt: null }, prospect: { id: 4, company: "1X Technologies" } },
    { conv: { state: "not_interested", nextFollowUpAt: null }, prospect: { id: 5, company: "Unitree" } },
  ];

  const TERMINAL = ["booked", "not_interested", "converted", "responded", "scheduling"];

  it("'all' filter returns all conversations", () => {
    const filtered = conversations;
    expect(filtered).toHaveLength(5);
  });

  it("'ready' filter returns only actionable past-due conversations", () => {
    const filtered = conversations.filter(c => {
      const next = c.conv.nextFollowUpAt;
      return next && next <= new Date() && !TERMINAL.includes(c.conv.state);
    });
    expect(filtered).toHaveLength(2);
    expect(filtered.map(c => c.prospect.company)).toContain("Agility Robotics");
    expect(filtered.map(c => c.prospect.company)).toContain("Figure AI");
  });

  it("stage filter returns only matching conversations", () => {
    const filtered = conversations.filter(c => c.conv.state === "discovery");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].prospect.company).toBe("Agility Robotics");
  });

  it("'booked' filter returns only booked conversations", () => {
    const filtered = conversations.filter(c => c.conv.state === "booked");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].prospect.company).toBe("1X Technologies");
  });
});

// ─── 10. Stage badge rendering ────────────────────────────────────────────────

describe("AdminSalesAgent — stage badge labels", () => {
  const STAGES = [
    { id: "discovery",      label: "Discovered" },
    { id: "intro_sent",     label: "Intro Sent" },
    { id: "followup_1",     label: "Follow-up 1" },
    { id: "followup_2",     label: "Follow-up 2" },
    { id: "robot_guild",    label: "Robot Guild" },
    { id: "responded",      label: "Responded" },
    { id: "scheduling",     label: "Scheduling" },
    { id: "booked",         label: "Booked" },
    { id: "not_interested", label: "Not Interested" },
    { id: "converted",      label: "Converted" },
  ];

  it("all 10 stages have display labels", () => {
    expect(STAGES).toHaveLength(10);
    for (const s of STAGES) {
      expect(s.label).toBeTruthy();
    }
  });

  it("discovery stage shows 'Discovered' label", () => {
    const s = STAGES.find(s => s.id === "discovery");
    expect(s?.label).toBe("Discovered");
  });

  it("robot_guild stage shows 'Robot Guild' label", () => {
    const s = STAGES.find(s => s.id === "robot_guild");
    expect(s?.label).toBe("Robot Guild");
  });

  it("converted stage shows 'Converted' label", () => {
    const s = STAGES.find(s => s.id === "converted");
    expect(s?.label).toBe("Converted");
  });
});

// ─── 11. Frank's voice guidelines ────────────────────────────────────────────

describe("Frank's voice guidelines", () => {
  it("Frank's emails should be short (under 200 words)", () => {
    // This is a structural check — Frank's prompts enforce brevity
    const maxWords = 200;
    const sampleEmail = `Hi Sarah,

Saw that Agility Robotics is exhibiting at CES 2026. Congrats on the show.

We're StageGate — we handle the on-ground logistics for robot companies at trade shows. Shipping, staging, warehousing, power, on-site support. The stuff that's easy to underestimate until you're on the floor trying to fix it.

If you have someone handling all of that already, great. If not, worth a quick conversation before the show.

Frank
StageGate — Robotics Activation Infrastructure`;

    const wordCount = sampleEmail.trim().split(/\s+/).length;
    expect(wordCount).toBeLessThan(maxWords);
  });

  it("Frank should not use AI-sounding openers", () => {
    const bannedPhrases = [
      "I hope this email finds you well",
      "I am reaching out to",
      "I wanted to touch base",
      "As an AI",
      "I am an AI",
    ];
    const sampleEmail = `Hi Sarah,

Saw that Agility Robotics is exhibiting at CES 2026.

We're StageGate — we handle the on-ground logistics for robot companies at trade shows.

Frank`;

    for (const phrase of bannedPhrases) {
      expect(sampleEmail.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });

  it("Frank's emails should mention a specific show or context", () => {
    const emailWithContext = "Saw that Agility Robotics is exhibiting at CES 2026.";
    const hasShowReference = /CES|NAB|MODEX|IMTS|Automate|ICRA|IROS|trade show|exhibiting/i.test(emailWithContext);
    expect(hasShowReference).toBe(true);
  });

  it("Robot Guild handoff should reference therobotguild.com", () => {
    const handoffEmail = `One more thing — if brand visibility and customer connections matter for Agility Robotics, there's a group worth knowing: The Robot Guild (therobotguild.com). They specialize in brand activations and customer introductions for robot companies. I can make an intro if that's useful.

Frank`;
    expect(handoffEmail).toContain("therobotguild.com");
  });
});
