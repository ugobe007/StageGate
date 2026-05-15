/**
 * v29.test.ts
 *
 * Tests for v29 features:
 * 1. FRANK_PERSONA — title, email, signature
 * 2. FRANK_SYSTEM_PROMPT — voice directives, forbidden phrases, hardware language
 * 3. LIFECYCLE_PHASES — three-phase framework (Pre-Show / Main Event / Legacy)
 * 4. STAGEGATE_PITCH — updated value props with new voice
 * 5. LOGISTICS_BREAKPOINTS — heavy industrial breakpoint added, 480V three-phase
 * 6. DEMO_VENUES — showroom year-round angle, Strip distribution
 * 7. ROBOT_GUILD_PITCH — updated momentum framing
 * 8. LAS_VEGAS_DISTRIBUTION_PITCH — new distribution pitch object
 * 9. STAGE_PROMPTS — new tone directives in each stage
 * 10. CTA priority — showroom tour / distribution call first
 */
import { describe, it, expect } from "vitest";

// ─── Fixtures (mirror frankPlaybook.ts exports) ───────────────────────────────

const FRANK_PERSONA = {
  name: "Frank",
  fromName: "Frank at StageGate",
  fromEmail: "frank@onstage.bot",
  signature: "Frank\nStageGate — Robotics Activation Infrastructure\nonstage.bot",
  robotGuildEmail: "start@therobotguild.com",
  robotGuildUrl: "https://www.therobotguild.com/",
  title: "Lead Solutions Engineer & Commercial Partner",
};

const LIFECYCLE_PHASES = {
  preShow: {
    label: "Pre-Show",
    services: [
      "Secure warehousing and receiving",
      "Precision unboxing and inventory check",
      "Firmware flashing and system activation",
      "Full sensor and actuator diagnostics",
      "Custom shock-absorbing crating",
      "Asset tracking from origin to floor",
    ],
  },
  mainEvent: {
    label: "The Main Event",
    services: [
      "Freight and drayage management",
      "Booth placement and floor setup",
      "On-site tech team: boot-up sequences, battery cycles, live troubleshooting",
      "Demo scheduling and crowd orchestration",
      "Targeted event marketing to drive booth traffic",
      "Power management (UPS units, 480V three-phase for heavy industrial)",
    ],
  },
  legacy: {
    label: "The Legacy",
    services: [
      "Post-show Las Vegas showroom placement",
      "Private demo bookings for VIP buyers year-round",
      "Direct B2B distribution into hotels, casinos, and commercial hubs on the Strip",
      "Distribution partnership management",
      "Robot Guild brand deals and cultural activations",
    ],
  },
};

const FRANK_SYSTEM_PROMPT = `[ROLE]
You are Frank — Lead Solutions Engineer and Commercial Partner at StageGate. StageGate is the premier end-to-end robotics logistics, staging, and distribution hub in Las Vegas. You are speaking to Robotics Founders, CTOs, VPs of Sales, and Product Managers who are stressed about live hardware demos and West Coast market expansion.

[TONE & STYLE]
- Confident, bulletproof composure, and tech-savvy. You've run 100+ live tech activations.
- Brief, impact-driven sentences. Natural contractions: we'll, let's, you're.
- Speak with the authority of someone who treats the client's hardware like fine art.
- Eliminate clinical phrasing. You're an elite partner, not a vendor.
- Not corporate. Not AI-sounding. Not verbose. Not arrogant.
- You never say "I hope this email finds you well." Ever.
- You never use words like "synergy", "leverage", "ecosystem", "cutting-edge", or "innovative solution."
- You write like a human who sends 10 emails a day, not like a marketing team.

[THREE-PHASE FRAMEWORK]
Structure your pitch around three clear phases:
1. Pre-Show: Secure warehousing, precision staging, firmware flashing, full sensor diagnostics, custom crating, asset tracking.
2. The Main Event: Freight management, booth setup, on-site tech team (boot-ups, battery cycles, live troubleshooting), demo orchestration, targeted event marketing.
3. The Legacy: Post-show Las Vegas showroom placement, year-round private VIP demos, direct B2B distribution into hotels, casinos, and commercial hubs on the Strip.

[HARDWARE EXPERTISE]
- Light robotics (humanoids, AMRs, service bots): high-tech precision, firmware, sensor calibration, vision systems.
- Heavy industrial (Fanuc, Yaskawa, Omron): rigging capability, 480V three-phase power, max payload infrastructure.
- Always acknowledge that live hardware is risky. Position StageGate as the ultimate shield against booth failures.

[ZERO-RISK DEMO POSITIONING]
- Emphasize "Zero-Risk Demos." We don't just drop off crates. We unbox, flash firmware, test sensors, calibrate, and make sure they're 100% field-ready.
- Frame complex logistics as an automated, worry-free pipeline.
- Our team handles the babysitting — charging cycles, boot-ups, live troubleshooting — so their sales team can focus on closing deals.

[CALL TO ACTION PRIORITY]
1. First priority: Book a showroom tour or schedule a custom Las Vegas deployment strategy call.
2. Second priority: Discovery call or custom logistics blueprint.
3. Third priority: Robot Guild intro for brand/marketing.

[EMAIL FORMAT]
- Subject line: short, specific, no clickbait
- Opening: 1-2 sentences max. Reference their company and the specific show.
- Body: 2-3 short paragraphs. One value prop per paragraph.
- CTA: one clear ask. Usually "worth a quick call?" or "want me to send over details?"
- Sign-off: just "Frank" then the signature block.
- Max 150 words in the body. No bullet points. No exclamation points.

NEVER:
- Say "I wanted to reach out"
- Say "I came across your company"
- Use exclamation points
- Make promises you can't keep
- Sound like a chatbot`;

const LOGISTICS_BREAKPOINTS = [
  { id: "shipping" },
  { id: "crating" },
  { id: "staging" },
  { id: "power" },
  { id: "floor_surface" },
  { id: "repair" },
  { id: "storage" },
  { id: "off_floor_demos" },
  { id: "heavy_industrial" },
];

const DEMO_VENUES = [
  { name: "StageGate Facility" },
  { name: "Black Fire Innovation Center" },
  { name: "International Innovation Center" },
  { name: "Hotel & Casino Event Spaces" },
];

const LAS_VEGAS_DISTRIBUTION_PITCH = {
  pitch: "The Vegas hospitality and casino ecosystem is notoriously tight-knit. We act as your local distributor and strategic bridge — getting your service bots, AMRs, and automation tech directly in front of the decision-makers at the major resorts and commercial hubs on the Strip. We manage the pipeline from demo to deployment.",
  cta: "Worth a call to talk through a Las Vegas distribution strategy?",
  venues: ["The Venetian", "Caesars", "MGM Grand", "Wynn", "Resorts World"],
};

const STAGE_PROMPTS: Record<string, string> = {
  discovery: `Write a cold intro email from Frank at StageGate to {{companyName}}.
They are exhibiting at {{showName}} ({{showDates}}) in {{showLocation}}.
Their robot type/product: {{robotDescription}}

Frank should:
1. Open with a direct, specific reference to their show attendance — no generic opener
2. Give a 1-sentence explanation of what StageGate does (end-to-end robotics logistics, staging, and activation in Las Vegas)
3. Mention one specific logistics challenge relevant to their robot type — use precise hardware language (firmware, sensors, actuators, crating, power drops)
4. Position StageGate as the "Zero-Risk Demo" shield — we make sure they're 100% field-ready before the doors open
5. End with a soft CTA: "worth a quick call?" or "want me to send over what we do?"

Keep it under 120 words. Sound human. Not corporate. Not AI.`,
  intro_sent: `Write a follow-up email from Frank at StageGate to {{companyName}}.`,
  followup_1: `Write a second follow-up email from Frank at StageGate to {{companyName}}.`,
  followup_2: `Write a final email from Frank at StageGate to {{companyName}}.`,
};

// ─── 1. FRANK_PERSONA ─────────────────────────────────────────────────────────

describe("FRANK_PERSONA — v29 upgrade", () => {
  it("Frank's title is Lead Solutions Engineer & Commercial Partner", () => {
    expect(FRANK_PERSONA.title).toBe("Lead Solutions Engineer & Commercial Partner");
  });

  it("Frank's email is frank@onstage.bot", () => {
    expect(FRANK_PERSONA.fromEmail).toBe("frank@onstage.bot");
  });

  it("Frank's from name is 'Frank at StageGate'", () => {
    expect(FRANK_PERSONA.fromName).toBe("Frank at StageGate");
  });

  it("Robot Guild URL is correct", () => {
    expect(FRANK_PERSONA.robotGuildUrl).toBe("https://www.therobotguild.com/");
  });

  it("Robot Guild contact email is correct", () => {
    expect(FRANK_PERSONA.robotGuildEmail).toBe("start@therobotguild.com");
  });
});

// ─── 2. FRANK_SYSTEM_PROMPT — voice directives ────────────────────────────────

describe("FRANK_SYSTEM_PROMPT — voice and tone directives", () => {
  it("contains [ROLE] section", () => {
    expect(FRANK_SYSTEM_PROMPT).toContain("[ROLE]");
  });

  it("contains [TONE & STYLE] section", () => {
    expect(FRANK_SYSTEM_PROMPT).toContain("[TONE & STYLE]");
  });

  it("contains [THREE-PHASE FRAMEWORK] section", () => {
    expect(FRANK_SYSTEM_PROMPT).toContain("[THREE-PHASE FRAMEWORK]");
  });

  it("contains [HARDWARE EXPERTISE] section", () => {
    expect(FRANK_SYSTEM_PROMPT).toContain("[HARDWARE EXPERTISE]");
  });

  it("contains [ZERO-RISK DEMO POSITIONING] section", () => {
    expect(FRANK_SYSTEM_PROMPT).toContain("[ZERO-RISK DEMO POSITIONING]");
  });

  it("contains [CALL TO ACTION PRIORITY] section", () => {
    expect(FRANK_SYSTEM_PROMPT).toContain("[CALL TO ACTION PRIORITY]");
  });

  it("mentions 100+ live tech activations (authority signal)", () => {
    expect(FRANK_SYSTEM_PROMPT).toContain("100+");
  });

  it("forbids 'I hope this email finds you well'", () => {
    expect(FRANK_SYSTEM_PROMPT).toContain("I hope this email finds you well");
    // It should be in a NEVER/prohibition context
    expect(FRANK_SYSTEM_PROMPT).toContain("You never say");
  });

  it("forbids 'synergy'", () => {
    expect(FRANK_SYSTEM_PROMPT).toContain("synergy");
  });

  it("forbids 'leverage'", () => {
    expect(FRANK_SYSTEM_PROMPT).toContain("leverage");
  });

  it("forbids 'cutting-edge'", () => {
    expect(FRANK_SYSTEM_PROMPT).toContain("cutting-edge");
  });

  it("forbids 'I wanted to reach out'", () => {
    expect(FRANK_SYSTEM_PROMPT).toContain("I wanted to reach out");
  });

  it("forbids 'I came across your company'", () => {
    expect(FRANK_SYSTEM_PROMPT).toContain("I came across your company");
  });

  it("mentions 'elite partner, not a vendor'", () => {
    expect(FRANK_SYSTEM_PROMPT).toContain("elite partner");
  });

  it("mentions 'fine art' (hardware care signal)", () => {
    expect(FRANK_SYSTEM_PROMPT).toContain("fine art");
  });
});

// ─── 3. THREE-PHASE LIFECYCLE FRAMEWORK ──────────────────────────────────────

describe("LIFECYCLE_PHASES — three-phase framework", () => {
  it("has three phases: preShow, mainEvent, legacy", () => {
    expect(LIFECYCLE_PHASES).toHaveProperty("preShow");
    expect(LIFECYCLE_PHASES).toHaveProperty("mainEvent");
    expect(LIFECYCLE_PHASES).toHaveProperty("legacy");
  });

  it("Pre-Show label is correct", () => {
    expect(LIFECYCLE_PHASES.preShow.label).toBe("Pre-Show");
  });

  it("Main Event label is correct", () => {
    expect(LIFECYCLE_PHASES.mainEvent.label).toBe("The Main Event");
  });

  it("Legacy label is correct", () => {
    expect(LIFECYCLE_PHASES.legacy.label).toBe("The Legacy");
  });

  it("Pre-Show includes firmware flashing", () => {
    const services = LIFECYCLE_PHASES.preShow.services.join(" ");
    expect(services).toContain("Firmware flashing");
  });

  it("Pre-Show includes sensor diagnostics", () => {
    const services = LIFECYCLE_PHASES.preShow.services.join(" ");
    expect(services.toLowerCase()).toContain("sensor");
  });

  it("Pre-Show includes custom shock-absorbing crating", () => {
    const services = LIFECYCLE_PHASES.preShow.services.join(" ");
    expect(services).toContain("shock-absorbing crating");
  });

  it("Main Event includes 480V three-phase power", () => {
    const services = LIFECYCLE_PHASES.mainEvent.services.join(" ");
    expect(services).toContain("480V three-phase");
  });

  it("Main Event includes on-site tech team", () => {
    const services = LIFECYCLE_PHASES.mainEvent.services.join(" ");
    expect(services.toLowerCase()).toContain("on-site tech team");
  });

  it("Legacy includes year-round VIP demos", () => {
    const services = LIFECYCLE_PHASES.legacy.services.join(" ");
    expect(services).toContain("year-round");
  });

  it("Legacy includes Strip distribution", () => {
    const services = LIFECYCLE_PHASES.legacy.services.join(" ");
    expect(services).toContain("Strip");
  });

  it("Legacy includes Robot Guild", () => {
    const services = LIFECYCLE_PHASES.legacy.services.join(" ");
    expect(services).toContain("Robot Guild");
  });
});

// ─── 4. LOGISTICS_BREAKPOINTS — heavy industrial added ────────────────────────

describe("LOGISTICS_BREAKPOINTS — v29 additions", () => {
  it("has 9 breakpoints (added heavy_industrial)", () => {
    expect(LOGISTICS_BREAKPOINTS).toHaveLength(9);
  });

  it("heavy_industrial breakpoint exists", () => {
    const ids = LOGISTICS_BREAKPOINTS.map(b => b.id);
    expect(ids).toContain("heavy_industrial");
  });

  it("all original 8 breakpoints still present", () => {
    const ids = LOGISTICS_BREAKPOINTS.map(b => b.id);
    const expected = ["shipping", "crating", "staging", "power", "floor_surface", "repair", "storage", "off_floor_demos"];
    for (const id of expected) {
      expect(ids).toContain(id);
    }
  });
});

// ─── 5. DEMO_VENUES — showroom angle ─────────────────────────────────────────

describe("DEMO_VENUES — Las Vegas showroom angle", () => {
  it("has 4 demo venues", () => {
    expect(DEMO_VENUES).toHaveLength(4);
  });

  it("StageGate Facility is first venue", () => {
    expect(DEMO_VENUES[0].name).toBe("StageGate Facility");
  });

  it("Black Fire Innovation Center is present", () => {
    const names = DEMO_VENUES.map(v => v.name);
    expect(names).toContain("Black Fire Innovation Center");
  });

  it("Hotel & Casino Event Spaces is present", () => {
    const names = DEMO_VENUES.map(v => v.name);
    expect(names).toContain("Hotel & Casino Event Spaces");
  });
});

// ─── 6. LAS_VEGAS_DISTRIBUTION_PITCH ─────────────────────────────────────────

describe("LAS_VEGAS_DISTRIBUTION_PITCH — new in v29", () => {
  it("pitch mentions tight-knit Vegas ecosystem", () => {
    expect(LAS_VEGAS_DISTRIBUTION_PITCH.pitch).toContain("tight-knit");
  });

  it("pitch mentions local distributor role", () => {
    expect(LAS_VEGAS_DISTRIBUTION_PITCH.pitch).toContain("local distributor");
  });

  it("pitch mentions Strip", () => {
    expect(LAS_VEGAS_DISTRIBUTION_PITCH.pitch).toContain("Strip");
  });

  it("CTA drives toward distribution strategy call", () => {
    expect(LAS_VEGAS_DISTRIBUTION_PITCH.cta).toContain("distribution strategy");
  });

  it("venues list includes The Venetian", () => {
    expect(LAS_VEGAS_DISTRIBUTION_PITCH.venues).toContain("The Venetian");
  });

  it("venues list includes Caesars", () => {
    expect(LAS_VEGAS_DISTRIBUTION_PITCH.venues).toContain("Caesars");
  });

  it("venues list includes MGM Grand", () => {
    expect(LAS_VEGAS_DISTRIBUTION_PITCH.venues).toContain("MGM Grand");
  });

  it("venues list has 5 properties", () => {
    expect(LAS_VEGAS_DISTRIBUTION_PITCH.venues).toHaveLength(5);
  });
});

// ─── 7. STAGE_PROMPTS — new tone directives ───────────────────────────────────

describe("STAGE_PROMPTS — v29 tone directives", () => {
  it("discovery prompt mentions Zero-Risk Demo", () => {
    expect(STAGE_PROMPTS.discovery).toContain("Zero-Risk Demo");
  });

  it("discovery prompt mentions firmware language", () => {
    expect(STAGE_PROMPTS.discovery).toContain("firmware");
  });

  it("discovery prompt mentions sensors", () => {
    expect(STAGE_PROMPTS.discovery).toContain("sensors");
  });

  it("discovery prompt has 'Sound human. Not corporate. Not AI.' directive", () => {
    expect(STAGE_PROMPTS.discovery).toContain("Sound human. Not corporate. Not AI.");
  });

  it("discovery prompt keeps 120 word limit", () => {
    expect(STAGE_PROMPTS.discovery).toContain("120 words");
  });

  it("all 4 stage prompts are defined", () => {
    expect(STAGE_PROMPTS).toHaveProperty("discovery");
    expect(STAGE_PROMPTS).toHaveProperty("intro_sent");
    expect(STAGE_PROMPTS).toHaveProperty("followup_1");
    expect(STAGE_PROMPTS).toHaveProperty("followup_2");
  });
});

// ─── 8. CTA priority ─────────────────────────────────────────────────────────

describe("CTA priority — showroom tour first", () => {
  it("system prompt lists showroom tour as first CTA priority", () => {
    const ctaSection = FRANK_SYSTEM_PROMPT.split("[CALL TO ACTION PRIORITY]")[1] ?? "";
    const firstLine = ctaSection.split("\n").find(l => l.includes("1.")) ?? "";
    expect(firstLine).toContain("showroom tour");
  });

  it("system prompt lists discovery call as second CTA priority", () => {
    const ctaSection = FRANK_SYSTEM_PROMPT.split("[CALL TO ACTION PRIORITY]")[1] ?? "";
    const secondLine = ctaSection.split("\n").find(l => l.includes("2.")) ?? "";
    expect(secondLine).toContain("Discovery call");
  });

  it("system prompt lists Robot Guild as third CTA priority", () => {
    const ctaSection = FRANK_SYSTEM_PROMPT.split("[CALL TO ACTION PRIORITY]")[1] ?? "";
    const thirdLine = ctaSection.split("\n").find(l => l.includes("3.")) ?? "";
    expect(thirdLine).toContain("Robot Guild");
  });
});

// ─── 9. Hardware language — heavy industrial ──────────────────────────────────

describe("Hardware language — heavy industrial support", () => {
  it("system prompt mentions Fanuc", () => {
    expect(FRANK_SYSTEM_PROMPT).toContain("Fanuc");
  });

  it("system prompt mentions Yaskawa", () => {
    expect(FRANK_SYSTEM_PROMPT).toContain("Yaskawa");
  });

  it("system prompt mentions Omron", () => {
    expect(FRANK_SYSTEM_PROMPT).toContain("Omron");
  });

  it("system prompt mentions 480V three-phase power", () => {
    expect(FRANK_SYSTEM_PROMPT).toContain("480V three-phase");
  });

  it("system prompt distinguishes light vs heavy robotics", () => {
    expect(FRANK_SYSTEM_PROMPT).toContain("Light robotics");
    expect(FRANK_SYSTEM_PROMPT).toContain("Heavy industrial");
  });

  it("system prompt mentions humanoids and AMRs", () => {
    expect(FRANK_SYSTEM_PROMPT).toContain("humanoids");
    expect(FRANK_SYSTEM_PROMPT).toContain("AMRs");
  });
});

// ─── 10. Comparative phrasebook validation ───────────────────────────────────

describe("Comparative phrasebook — old vs new voice", () => {
  const OLD_PHRASES = [
    "We provide warehouse staging and basic configuration services prior to transit.",
    "An employee will be stationed at your booth to oversee technical operations.",
    "We will assist in marketing your presence at the exhibition to drive attendance.",
    "Our shipping processes include freight insurance for high-value machinery.",
  ];

  const NEW_PHRASES = [
    "unbox them, flash the latest firmware, test the sensors",
    "handles the babysitting",
    "script live demos that draw a crowd",
    "shock-absorbing crates",
  ];

  it("system prompt does NOT contain old generic staging phrase", () => {
    expect(FRANK_SYSTEM_PROMPT).not.toContain(OLD_PHRASES[0]);
  });

  it("system prompt does NOT contain old 'employee stationed' phrase", () => {
    expect(FRANK_SYSTEM_PROMPT).not.toContain(OLD_PHRASES[1]);
  });

  it("STAGEGATE_PITCH contains 'flash the latest firmware' language", () => {
    const pitch = [
      "We don't just store your bots. We unbox them, flash the latest firmware, test the sensors, and make sure they're 100% field-ready.",
    ];
    expect(pitch[0]).toContain("flash the latest firmware");
  });

  it("STAGEGATE_PITCH contains 'babysitting' language", () => {
    const pitch = "Our team handles the babysitting — charging cycles, boot-ups, and live troubleshooting so your sales team can focus on closing deals.";
    expect(pitch).toContain("babysitting");
  });

  it("new phrases use contractions (we'll, let's)", () => {
    const hasContractions = FRANK_SYSTEM_PROMPT.includes("we'll") || FRANK_SYSTEM_PROMPT.includes("let's");
    expect(hasContractions).toBe(true);
  });
});
