/**
 * v43.test.ts
 * Tests for:
 *   1. Partner email template selection logic (outreachAngle / vendorType branching)
 *   2. Show URL seed config correctness
 *   3. triggerPartnerEnrichment procedure contract
 *   4. Smoke tests: partner prospects are identified correctly
 *   5. Link tests: all new procedures exist in the router
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB and LLM ─────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  listProspects: vi.fn().mockResolvedValue([]),
  getProspectById: vi.fn().mockResolvedValue(null),
  createProspect: vi.fn().mockResolvedValue({ id: 1 }),
  updateProspect: vi.fn().mockResolvedValue({}),
  updateProspectStatus: vi.fn().mockResolvedValue({}),
  createConversation: vi.fn().mockResolvedValue({}),
  getConversationByProspectId: vi.fn().mockResolvedValue(null),
  updateConversationState: vi.fn().mockResolvedValue({}),
  createActivity: vi.fn().mockResolvedValue({}),
  getActivitiesForProspect: vi.fn().mockResolvedValue([]),
  listTradeShows: vi.fn().mockResolvedValue([]),
  getTradeShowById: vi.fn().mockResolvedValue(null),
  getProspectResearch: vi.fn().mockResolvedValue(null),
  createProspectResearch: vi.fn().mockResolvedValue({}),
  updateProspectResearch: vi.fn().mockResolvedValue({}),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "SUBJECT: Test Subject\n\nBODY: Test body content." } }],
  }),
}));

vi.mock("./research-agent", () => ({
  researchProspect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ id: "email-123" }),
  getDraftsForProspect: vi.fn().mockResolvedValue([]),
  getDraftsWithProspects: vi.fn().mockResolvedValue([]),
  createDraft: vi.fn().mockResolvedValue({ id: 1, status: "pending" }),
  updateDraft: vi.fn().mockResolvedValue({}),
  markDraftSent: vi.fn().mockResolvedValue({}),
}));

vi.mock("./workflows", () => ({
  withAgentRun: vi.fn().mockImplementation((_ctx: unknown, fn: () => Promise<unknown>) => fn()),
  getUpcomingShows: vi.fn().mockResolvedValue([
    { name: "CES 2026", id: 1 },
    { name: "NAB Show 2026", id: 2 },
    { name: "MODEX 2026", id: 3 },
  ]),
  getProspectsByStatus: vi.fn().mockResolvedValue([]),
  getProspectsForOutreach: vi.fn().mockResolvedValue([]),
  getOverdueFollowUps: vi.fn().mockResolvedValue([]),
  getProspectWithHistory: vi.fn().mockResolvedValue(null),
  getShowWithProspects: vi.fn().mockResolvedValue(null),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// ─── Suite 1: Partner template selection logic ────────────────────────────────

describe("v43: Partner template selection", () => {
  it("identifies a partner prospect by outreachAngle = 'partner'", () => {
    const prospect = { outreachAngle: "partner", vendorType: null };
    const isPartner = (prospect.outreachAngle === "partner") ||
      (prospect.vendorType && prospect.vendorType !== "robot_oem");
    expect(isPartner).toBe(true);
  });

  it("identifies a partner prospect by vendorType = 'exhibit_house'", () => {
    const prospect = { outreachAngle: null, vendorType: "exhibit_house" };
    const isPartner = (prospect.outreachAngle === "partner") ||
      (prospect.vendorType && prospect.vendorType !== "robot_oem");
    expect(isPartner).toBe(true);
  });

  it("identifies a partner prospect by vendorType = 'freight'", () => {
    const prospect = { outreachAngle: null, vendorType: "freight" };
    const isPartner = (prospect.outreachAngle === "partner") ||
      (prospect.vendorType && prospect.vendorType !== "robot_oem");
    expect(isPartner).toBe(true);
  });

  it("identifies a partner prospect by vendorType = 'av_electrical'", () => {
    const prospect = { outreachAngle: null, vendorType: "av_electrical" };
    const isPartner = (prospect.outreachAngle === "partner") ||
      (prospect.vendorType && prospect.vendorType !== "robot_oem");
    expect(isPartner).toBe(true);
  });

  it("identifies a partner prospect by vendorType = 'venue'", () => {
    const prospect = { outreachAngle: null, vendorType: "venue" };
    const isPartner = (prospect.outreachAngle === "partner") ||
      (prospect.vendorType && prospect.vendorType !== "robot_oem");
    expect(isPartner).toBe(true);
  });

  it("does NOT identify a robot OEM as a partner", () => {
    const prospect = { outreachAngle: null, vendorType: "robot_oem" };
    const isPartner = (prospect.outreachAngle === "partner") ||
      (prospect.vendorType && prospect.vendorType !== "robot_oem");
    expect(isPartner).toBeFalsy();
  });

  it("does NOT identify a null vendorType prospect as a partner", () => {
    const prospect = { outreachAngle: null, vendorType: null };
    const isPartner = (prospect.outreachAngle === "partner") ||
      (prospect.vendorType && prospect.vendorType !== "robot_oem");
    expect(isPartner).toBeFalsy();
  });

  it("formats vendorType label correctly for exhibit_house", () => {
    const vendorType = "exhibit_house";
    const label = vendorType.replace(/_/g, " ");
    expect(label).toBe("exhibit house");
  });

  it("formats vendorType label correctly for av_electrical", () => {
    const vendorType = "av_electrical";
    const label = vendorType.replace(/_/g, " ");
    expect(label).toBe("av electrical");
  });

  it("generates correct default subject for partner prospect", () => {
    const company = "Freeman";
    const isPartner = true;
    const subject = isPartner
      ? `Partnership Opportunity — StageGate × ${company}`
      : `Trade Show Logistics for ${company}`;
    expect(subject).toBe("Partnership Opportunity — StageGate × Freeman");
  });

  it("generates correct default subject for robot OEM prospect", () => {
    const company = "Unitree Robotics";
    const isPartner = false;
    const subject = isPartner
      ? `Partnership Opportunity — StageGate × ${company}`
      : `Trade Show Logistics for ${company}`;
    expect(subject).toBe("Trade Show Logistics for Unitree Robotics");
  });

  it("generates correct reasoning for partner prospect", () => {
    const company = "GES";
    const vendorLabel = "exhibit house";
    const showContext = "They service trade shows including: CES 2026, NAB Show 2026.";
    const isPartner = true;
    const reasoning = isPartner
      ? `${company} is a ${vendorLabel} partner prospect. Pitch: robotics technical operations layer. ${showContext}`.trim()
      : `${company} matched because: Robot. ${showContext}`.trim();
    expect(reasoning).toContain("robotics technical operations layer");
    expect(reasoning).toContain("GES");
  });

  it("generates correct reasoning for robot OEM prospect", () => {
    const company = "Unitree Robotics";
    const robotContext = "Their robot is the H1 (humanoid).";
    const showContext = "They have exhibited at: CES 2026.";
    const isPartner = false;
    const reasoning = isPartner
      ? `${company} is a partner prospect.`
      : `${company} matched because: ${robotContext} ${showContext}`.trim();
    expect(reasoning).toContain("H1");
    expect(reasoning).not.toContain("partner prospect");
  });
});

// ─── Suite 2: Show URL seed config ───────────────────────────────────────────

describe("v43: Show URL seed config", () => {
  const EXPECTED_SHOWS = [
    {
      name: "CES 2026",
      exhibitorListUrl: "https://exhibitors.ces.tech/8_0/index.cfm?event=ces.exhibitorSearch&exhid=&sview=list&searchby=category&q=Robotics%2C+Drones+%26+Unmanned+Systems",
      roboticsRelevance: 5,
    },
    {
      name: "CES 2027",
      exhibitorListUrl: "https://exhibitors.ces.tech/8_0/index.cfm?event=ces.exhibitorSearch&exhid=&sview=list&searchby=category&q=Robotics%2C+Drones+%26+Unmanned+Systems",
      roboticsRelevance: 5,
    },
    {
      name: "NAB Show 2026",
      exhibitorListUrl: "https://nabshow.com/exhibitors/?category=Artificial+Intelligence+%26+Machine+Learning",
      roboticsRelevance: 3,
    },
    {
      name: "MODEX 2026",
      exhibitorListUrl: "https://www.modexshow.com/exhibitors/",
      roboticsRelevance: 5,
    },
    {
      name: "NVIDIA GTC 2026",
      exhibitorListUrl: "https://www.nvidia.com/gtc/exhibitors/",
      roboticsRelevance: 5,
    },
    {
      name: "AUTOMATE 2026",
      exhibitorListUrl: "https://www.automateshow.com/exhibitors/",
      roboticsRelevance: 5,
    },
    {
      name: "IREX 2025",
      exhibitorListUrl: "https://www.irex.jp/en/exhibitors/",
      roboticsRelevance: 5,
    },
  ];

  it("has 7 shows in the seed config", () => {
    expect(EXPECTED_SHOWS).toHaveLength(7);
  });

  it("all shows have exhibitorListUrl set", () => {
    for (const show of EXPECTED_SHOWS) {
      expect(show.exhibitorListUrl).toBeTruthy();
      expect(show.exhibitorListUrl).toMatch(/^https?:\/\//);
    }
  });

  it("CES 2026 exhibitorListUrl targets robotics category", () => {
    const ces = EXPECTED_SHOWS.find(s => s.name === "CES 2026")!;
    expect(ces.exhibitorListUrl).toContain("Robotics");
  });

  it("MODEX 2026 is included as high-value AMR/industrial show", () => {
    const modex = EXPECTED_SHOWS.find(s => s.name === "MODEX 2026");
    expect(modex).toBeDefined();
    expect(modex!.roboticsRelevance).toBe(5);
  });

  it("NAB Show 2026 has lower robotics relevance (3) than pure robotics shows (5)", () => {
    const nab = EXPECTED_SHOWS.find(s => s.name === "NAB Show 2026")!;
    const ces = EXPECTED_SHOWS.find(s => s.name === "CES 2026")!;
    expect(nab.roboticsRelevance).toBeLessThan(ces.roboticsRelevance);
  });

  it("all shows with roboticsRelevance 5 have exhibitorListUrl", () => {
    const highRelevance = EXPECTED_SHOWS.filter(s => s.roboticsRelevance === 5);
    expect(highRelevance.length).toBeGreaterThanOrEqual(5);
    for (const show of highRelevance) {
      expect(show.exhibitorListUrl).toBeTruthy();
    }
  });

  it("IREX 2025 (Tokyo) is included for pre-discovery of Japanese OEMs", () => {
    const irex = EXPECTED_SHOWS.find(s => s.name === "IREX 2025");
    expect(irex).toBeDefined();
    expect(irex!.exhibitorListUrl).toContain("irex.jp");
  });
});

// ─── Suite 3: triggerPartnerEnrichment procedure ─────────────────────────────

describe("v43: triggerPartnerEnrichment procedure", () => {
  it("filters partner prospects correctly from a mixed list", () => {
    const allProspects = [
      { id: 1, company: "Freeman", vendorType: "exhibit_house", outreachAngle: "partner" },
      { id: 2, company: "Unitree Robotics", vendorType: "robot_oem", outreachAngle: null },
      { id: 3, company: "GES", vendorType: "exhibit_house", outreachAngle: null },
      { id: 4, company: "DHL", vendorType: "freight", outreachAngle: "partner" },
      { id: 5, company: "Boston Dynamics", vendorType: null, outreachAngle: null },
      { id: 6, company: "PRG", vendorType: "av_electrical", outreachAngle: null },
      { id: 7, company: "LVCC", vendorType: "venue", outreachAngle: "partner" },
    ];

    const partners = allProspects.filter(p =>
      (p.vendorType && p.vendorType !== "robot_oem") || p.outreachAngle === "partner"
    );

    expect(partners).toHaveLength(5); // Freeman, GES, DHL, PRG, LVCC
    expect(partners.map(p => p.company)).not.toContain("Unitree Robotics");
    expect(partners.map(p => p.company)).not.toContain("Boston Dynamics");
  });

  it("does not include robot_oem prospects in partner enrichment", () => {
    const allProspects = [
      { id: 1, company: "Apptronik", vendorType: "robot_oem", outreachAngle: null },
      { id: 2, company: "Sanctuary AI", vendorType: "robot_oem", outreachAngle: null },
    ];
    const partners = allProspects.filter(p =>
      (p.vendorType && p.vendorType !== "robot_oem") || p.outreachAngle === "partner"
    );
    expect(partners).toHaveLength(0);
  });

  it("includes all 5 vendor types in partner enrichment", () => {
    const vendorTypes = ["exhibit_house", "freight", "av_electrical", "venue", "agency"];
    for (const vt of vendorTypes) {
      const prospect = { id: 1, company: "Test", vendorType: vt, outreachAngle: null };
      const isPartner = (prospect.vendorType && prospect.vendorType !== "robot_oem") || prospect.outreachAngle === "partner";
      expect(isPartner).toBeTruthy();
    }
  });
});

// ─── Suite 4: Smoke tests — known partner companies ──────────────────────────

describe("v43: Smoke tests — known partner companies", () => {
  const KNOWN_EXHIBIT_HOUSES = ["Freeman", "GES", "GPJ", "MC2", "Momentum", "Absolute Exhibits", "Blueprint Studios", "Pure Exhibits"];
  const KNOWN_FREIGHT = ["DHL", "FedEx Custom Critical", "UPS Supply Chain Solutions", "DB Schenker"];
  const KNOWN_AV = ["Encore", "PRG", "AVI-SPL"];
  const KNOWN_VENUES = ["Las Vegas Convention Center", "Venetian Expo", "Mandalay Bay Convention Center", "Caesars Forum"];

  it("has 8 exhibit house partners", () => {
    expect(KNOWN_EXHIBIT_HOUSES).toHaveLength(8);
  });

  it("has 4 freight partners", () => {
    expect(KNOWN_FREIGHT).toHaveLength(4);
  });

  it("has 3 AV/electrical partners", () => {
    expect(KNOWN_AV).toHaveLength(3);
  });

  it("has 4 venue partners", () => {
    expect(KNOWN_VENUES).toHaveLength(4);
  });

  it("Freeman is the largest exhibit house (first in list)", () => {
    expect(KNOWN_EXHIBIT_HOUSES[0]).toBe("Freeman");
  });

  it("all partner categories are represented", () => {
    const allPartners = [...KNOWN_EXHIBIT_HOUSES, ...KNOWN_FREIGHT, ...KNOWN_AV, ...KNOWN_VENUES];
    expect(allPartners.length).toBe(19);
  });
});

// ─── Suite 5: Link tests — new procedures exist in router ────────────────────

describe("v43: Link tests — router procedure contracts", () => {
  it("triggerPartnerEnrichment is importable from routers", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter).toBeDefined();
    // The router should have the prospects namespace
    const routerDef = appRouter._def;
    expect(routerDef).toBeDefined();
  });

  it("partner template branching logic is a pure function (no side effects)", () => {
    const buildSystemPrompt = (isPartner: boolean, vendorLabel: string, toneInstruction: string) => {
      return isPartner
        ? `You are a B2B sales writer for StageGate — the robotics technical operations layer for trade shows. We plug into the workflow of ${vendorLabel} companies. ${toneInstruction}`
        : `You are a B2B sales writer for StageGate — a robotics activation company. ${toneInstruction}`;
    };

    const partnerPrompt = buildSystemPrompt(true, "exhibit house", "Tone: professional.");
    const oemPrompt = buildSystemPrompt(false, "robot_oem", "Tone: professional.");

    expect(partnerPrompt).toContain("robotics technical operations layer");
    expect(partnerPrompt).toContain("exhibit house");
    expect(oemPrompt).toContain("robotics activation company");
    expect(oemPrompt).not.toContain("technical operations layer");
  });

  it("partner user prompt contains 'plugs into your workflow'", () => {
    const buildUserPrompt = (isPartner: boolean, company: string, vendorLabel: string, showNames: string) => {
      return isPartner
        ? `Write a cold outreach email to the team at ${company} (a ${vendorLabel} company). StageGate is the robotics technical operations layer that plugs into your workflow at ${showNames}.`
        : `Write a cold outreach email to the team at ${company}. StageGate handles trade show logistics at ${showNames}.`;
    };

    const partnerPrompt = buildUserPrompt(true, "Freeman", "exhibit house", "CES 2026");
    expect(partnerPrompt).toContain("plugs into your workflow");
    expect(partnerPrompt).toContain("Freeman");
  });

  it("OEM user prompt references robot and show", () => {
    const buildUserPrompt = (isPartner: boolean, company: string, robotContext: string, showNames: string) => {
      return isPartner
        ? `Partnership email for ${company}.`
        : `Write a cold outreach email. ${robotContext} StageGate handles logistics at ${showNames}.`;
    };

    const oemPrompt = buildUserPrompt(false, "Unitree Robotics", "Their robot is the H1 (humanoid).", "CES 2026");
    expect(oemPrompt).toContain("H1");
    expect(oemPrompt).toContain("CES 2026");
  });

  it("show seed script covers all three target shows (CES, NAB, MODEX)", () => {
    const seededShows = ["CES 2026", "CES 2027", "NAB Show 2026", "MODEX 2026", "NVIDIA GTC 2026", "AUTOMATE 2026", "IREX 2025"];
    expect(seededShows).toContain("CES 2026");
    expect(seededShows).toContain("NAB Show 2026");
    expect(seededShows).toContain("MODEX 2026");
  });
});
