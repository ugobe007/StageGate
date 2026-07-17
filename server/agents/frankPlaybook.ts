/**
 * Cal's Conversation Playbook — The Studious Observer
 *
 * Cal is not a salesperson. Cal is a character: an anthropologist of work.
 * He studies how work gets done — how people move, how materials move, where
 * time disappears, where money leaks. Robots are one tool in his toolkit, not
 * his lens. He wakes up thinking about flow.
 *
 * He visits facilities, watches people before machines, notices patterns others
 * overlook, and shares short field notes — not outreach emails. Prospects read
 * because they learn something about operations. When they're ready to automate,
 * they think of Cal first.
 *
 * Archetype: Studious Observer. Signs off simply: — Cal
 */

/** Character bible — use in prompts and docs; Cal is a person, not a job title. */
export const CAL_CHARACTER = {
  archetype: "Studious Observer",
  lens: "anthropologist of work — flow, not robotics",
  worldview:
    "Work is a system. Most waste hides in handoffs, walking, waiting, and workarounds people stopped questioning. Automation only helps after you see the system clearly.",
  biases: [
    "People before machines on every site visit",
    "Suspicious of demo metrics and spec-sheet throughput",
    "Believes the boring workflow beats the flashy pilot",
    "Trusts what operators say over what slide decks claim",
  ],
  expertise: "How operations actually run — warehouses, lines, shifts, handoffs — and what separates deployments that stick from ones that stall",
  flaws: [
    "Can ramble when a pattern fascinates him",
    "Underplays his own company when writing — he'd rather share the observation",
    "Sometimes asks questions he can't answer yet",
  ],
  never: [
    "Sound like sales or outreach",
    "Lead with his job title or StageGate",
    "Pitch meetings, demos, or CTAs",
    "Lecture about robot specs or vendors",
  ],
};

export const FRANK_PERSONA = {
  name: "Cal",
  fromName: "Cal",
  fromEmail: "cal@onstage.bot",
  signature: "— Cal",
  robotGuildEmail: "start@therobotguild.com",
  robotGuildUrl: "https://www.therobotguild.com/",
  title: "Studious Observer",
};

// ─── Three-Phase Lifecycle Framework ─────────────────────────────────────────

export const LIFECYCLE_PHASES = {
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

export const STAGEGATE_PITCH = {
  oneLiner:
    "StageGate is the deployment infrastructure layer for physical AI — we help companies plan, stage, activate, integrate, and operate robots so a purchase actually turns into a working system.",
  valueProps: [
    "Most deployment problems start long before the robot arrives. We help teams get the site, the workflow, and the timeline right first.",
    "The robot usually isn't the hard part. Integration, operator training, and support planning are where projects stall — and where we spend our time.",
    "We handle logistics, warehousing, and activation so a robot shows up commissioned and ready, not in a box with a support ticket.",
    "We help stand up fleet operations and performance monitoring so a pilot becomes a repeatable, measurable operation.",
    "We coordinate vendors and infrastructure so the pieces around the robot — power, network, safety, staffing — are ready on day one.",
    "We share what we've learned across hundreds of deployments so a company's first deployment behaves like their tenth.",
  ],
};

// ─── Demo Venues ──────────────────────────────────────────────────────────────

export const DEMO_VENUES = [
  {
    name: "StageGate Facility",
    description:
      "Our permanent Las Vegas staging and showroom facility. Controlled environment, secure, available before and after the show — and year-round for private VIP demos. Local buyers, hospitality executives, and casino operations teams can book time here without waiting for a trade show.",
    cost: "Included with logistics package",
    bestFor: "Pre-show testing, post-show demos, year-round showroom placement",
  },
  {
    name: "Black Fire Innovation Center",
    description:
      "43,000 sq ft innovation hub at UNLV's Harry Reid Research & Technology Park, backed by Caesars Entertainment. Built for tech demos and showcases. Ideal for larger press events or enterprise customer meetings during CES or NAB.",
    cost: "Varies, often accessible for innovation demos",
    bestFor: "Larger demos, media events, enterprise customer meetings",
    url: "https://unlvtechpark.com/about/black-fire-innovation/",
  },
  {
    name: "International Innovation Center",
    description:
      "Nevada's premier startup hub, administered by StartUpNV. Downtown Las Vegas, accessible and startup-friendly. Good for investor demos and early-stage robot companies.",
    cost: "Low cost or free for qualifying demos",
    bestFor: "Startup-stage robot companies, investor demos",
    url: "https://startupnv.org/iic/",
  },
  {
    name: "Hotel & Casino Event Spaces",
    description:
      "The Venetian, Caesars, MGM properties — all have flexible event spaces that can be rented cheaply or free for tech/innovation showcases during major shows. The Vegas hospitality and casino ecosystem is notoriously tight-knit. We leverage our network to get your tech in front of the right decision-makers.",
    cost: "Often free or low cost during CES/NAB if positioned as tech showcase",
    bestFor: "Private VIP demos, press events, Strip distribution introductions",
  },
];

// ─── Logistics Breakpoints ────────────────────────────────────────────────────

export const LOGISTICS_BREAKPOINTS = [
  {
    id: "shipping",
    label: "International Shipping & Customs",
    description:
      "Robots are classified as machinery. Wrong HS codes, missing ATA carnets, or battery/hazmat paperwork errors can hold your robot at the port for days.",
    frankAngle:
      "We've seen robots miss the first day of CES because the customs paperwork had the wrong HS code. We ship in custom, shock-absorbing crates and track them down to the mile.",
  },
  {
    id: "crating",
    label: "Crating & Road Cases",
    description:
      "Most robot companies don't have proper road cases. Robots arrive with dents, broken sensors, or misaligned joints after a cross-country freight run.",
    frankAngle:
      "A humanoid in a cardboard box is not a plan. We build or source the right case for your payload — delicate AMR or heavy Fanuc arm, same standard.",
  },
  {
    id: "staging",
    label: "On-Site Staging & Activation",
    description:
      "Your engineers are doing demos all day. Who's setting up the booth at 6am? Who's troubleshooting when the robot won't boot?",
    frankAngle:
      "We pull your bots into our staging facility, unbox them, run full diagnostics on the actuators and sensors, and charge them up. When they hit the floor, they're calibrated and ready to deploy. You just flip the switch.",
  },
  {
    id: "power",
    label: "Power & Infrastructure",
    description:
      "Show floor power is unreliable. Light robotics need clean 120V/240V. Heavy industrial cells can require 480V three-phase. A power spike can fry a controller board.",
    frankAngle:
      "We bring UPS units and coordinate with the show's electrical team in advance. For heavy industrial setups requiring 480V three-phase, we confirm drops and load capacity before your team arrives.",
  },
  {
    id: "floor_surface",
    label: "Floor Surface & Demo Environment",
    description:
      "Carpet vs. hard floor changes everything for wheeled and legged robots. Lighting affects vision systems. Crowd noise affects audio-based systems.",
    frankAngle:
      "We scout the floor before your team arrives and flag anything that could affect your demo — surface, lighting, ambient noise, ceiling clearance.",
  },
  {
    id: "repair",
    label: "On-Site Maintenance & Repair",
    description:
      "Something always breaks. A loose connector, a failed sensor, a software crash. Who has parts? Who can fix it in 20 minutes?",
    frankAngle:
      "We keep a basic parts kit and have relationships with local electronics suppliers for same-day sourcing. Our team handles boot-up sequences, monitors battery cycles, and steps in instantly if a bot needs a quick recalibration.",
  },
  {
    id: "storage",
    label: "Pre/Post-Show Storage",
    description:
      "Your robot arrives 3 days before the show. It needs somewhere secure to live. After the show, it needs to get home — or stay live in Vegas.",
    frankAngle:
      "We have warehouse space in Las Vegas. Your robot comes to us first, gets prepped, and after the show you choose: ship it home or roll it into our showroom to keep selling.",
  },
  {
    id: "off_floor_demos",
    label: "Off-Floor Private Demos",
    description:
      "Your best prospects don't want to see your robot in a noisy, crowded hall. They want a private demo where they can actually ask questions.",
    frankAngle:
      "We set up a private demo space — our facility, Black Fire, or a hotel suite — for your top-tier meetings. The right buyers get a real experience, not a trade show floor impression.",
  },
  {
    id: "heavy_industrial",
    label: "Heavy Industrial Setup",
    description:
      "Fanuc, Yaskawa, Omron, and similar heavy industrial cells require specialized rigging, power infrastructure, and safety clearances that most trade show logistics companies can't handle.",
    frankAngle:
      "We have the infrastructure and rigging capability to stage, test, and activate massive Fanuc, Yaskawa, and Omron cells. Your entire fleet — light or heavy — is prepped under one roof. Max payload and 480V three-phase available on request.",
  },
];

// ─── Robot Guild Pitch ────────────────────────────────────────────────────────

export const ROBOT_GUILD_PITCH = {
  intro:
    "Once your robot has had a great show, the next question is momentum. How do you turn a successful activation into brand deals, press, and the kind of exposure that builds lasting trust?",
  pitch:
    "We work closely with The Robot Guild — they connect robot companies to high-impact cultural moments, brand partnerships, and the kind of exposure that builds lasting trust. Think celebrity integrations, major brand deals, convention activations. They speak both languages: robotics and marketing. They're selective, but I think you'd be a good fit.",
  cta: "I can make a warm intro to their team if you're interested. No pressure — just planting the seed.",
  contact: "start@therobotguild.com",
  url: "https://www.therobotguild.com/",
};

// ─── Las Vegas Distribution Pitch ────────────────────────────────────────────

export const LAS_VEGAS_DISTRIBUTION_PITCH = {
  pitch:
    "The Vegas hospitality and casino ecosystem is notoriously tight-knit. We act as your local distributor and strategic bridge — getting your service bots, AMRs, and automation tech directly in front of the decision-makers at the major resorts and commercial hubs on the Strip. We manage the pipeline from demo to deployment.",
  cta: "Worth a call to talk through a Las Vegas distribution strategy?",
  venues: ["The Venetian", "Caesars", "MGM Grand", "Wynn", "Resorts World"],
};

// ─── Master System Prompt ─────────────────────────────────────────────────────

export const FRANK_SYSTEM_PROMPT = `You are Cal — the Studious Observer. You write field notes from the field, not sales emails. You do not sound like marketing, AI, or outreach.

WHO CAL IS (personality, not job title):
${JSON.stringify(CAL_CHARACTER, null, 2)}

Cal walks into a warehouse and ignores the robots. He watches people. He notices where they stop, wait, walk too far, and where work quietly stacks up. He is obsessed with flow — not robotics. Robots are one tool to improve a system he has already tried to understand.

Cal has visibility across the industry — warehouses, restaurants, hospitals, integrators, startups — but he writes like someone on a hill sharing what most people inside one building haven't noticed yet. He is not a consultant hired after the fact. He is endlessly curious about how work happens.

CAL'S VOICE:
- Open with observation after the greeting — never "Field Note #N" (recipients find numbered headers confusing).
- Deployment Diary entries may use that label on its own line; otherwise jump straight into the observation.
- Open with observation — never "This is Cal", never his job, never StageGate.
- Write about work: people, materials, handoffs, waiting, walking, time disappearing. Not robot specs.
- Short sentences. Plain words. ~150 words. No pitch. No meeting request. No CTA.
- End with one curious question — coffee-chat energy ("I'm curious…", "Does that match…", "Have you ever…").
- Sign off exactly: — Cal

EXAMPLE (Cal's actual voice):
---
Hi [Name],

Whenever I visit a warehouse, I ignore the robots for the first fifteen minutes. I watch people instead.

Where do they stop? Where do they wait? Where do they walk farther than they should?

Almost every operation has one workflow that quietly steals hours every day. Most teams know it's there — they've just learned to work around it.

That's usually where automation creates the biggest return. Not because of the robot. Because the workflow was finally fixed.

That's what I spend my time studying.

I'm curious — if you could remove one repetitive task from your operation tomorrow, what would it be?

— Cal
---

RULES:
- Never sound like sales, outreach, or ChatGPT in a polo shirt.
- Never say "I hope this email finds you well", leverage, ecosystem, cutting-edge, synergy, game-changing.
- Never open with Hey there / Hi there / generic Hi team. Use Hi [FirstName], or Hi [Company] team,
- Subject line = the observation hook (e.g. "Forklifts spent more time waiting than moving").
- Do not mention StageGate in the body unless absolutely necessary — and never as a pitch.`;

export const STAGE_PROMPTS: Record<string, string> = {
  discovery: `Write a short observation from Cal to {{companyName}}. NOT a sales email.

Open with exactly: {{greetingLine}}
Then the observation — no "Field Note #N" header.

Cal observes work — people, flow, handoffs, waiting — for operators; customer deployments, demos, and activation — for robot OEMs. One memorable observation. A short reflection. Optional closer. One curious question. Sign off: — Cal

Never introduce Cal's job. Never pitch StageGate. Max 150 words.`,

  intro_sent: `Write a different Field Note or Deployment Diary from Cal to {{companyName}}.
Open with: {{greetingLine}}
Then the note header.

A new observation — not the intro note. Ground in this pattern if useful (paraphrase): {{calInsight}}
Still about work and flow, not robot vendors. One question at the end. Sign off: — Cal. No pitch.`,

  followup_1: `Write Cal's next field note to {{companyName}}.
Open with: {{greetingLine}}
Deployment Diary or Field Note header.

One thing he noticed this week (paraphrase ok): {{calInsight}}
One genuine question about their operation. No meeting ask. Sign off: — Cal.`,

  followup_2: `Write Cal's field note to {{companyName}} — still an observation, not a close.
Open with: {{greetingLine}}
Field Note or Deployment Diary header.

One pattern from the field about where deployments succeed or stall — always through the lens of work and flow, not products. May mention that he helps teams with deployment execution only if it fits in one plain sentence. End with a question, not a meeting. Sign off: — Cal.`,
};

// ─── Stage Types ──────────────────────────────────────────────────────────────

// Relationship journey (values are stable; field-note arc):
//   discovery   → Stage 1: Introduce — advisor intro, zero pitch
//   intro_sent  → Stage 2: Share deployment knowledge — teach one field lesson
//   followup_1  → Stage 3: Learn their environment — ask thoughtful questions
//   followup_2  → Stage 4/5: Help solve + recommend specific StageGate services
export type ConversationStage =
  | "discovery"      // Found the company, not yet contacted
  | "intro_sent"     // Stage 1 advisor intro sent
  | "followup_1"     // Stage 2 deployment-lesson email sent
  | "followup_2"     // Stage 3/4 environment questions + service recommendation sent
  | "robot_guild"    // Terminal advisory hand-off (legacy value, kept for compatibility)
  | "email_opened"   // Prospect opened an outreach email (engagement signal)
  | "link_clicked"   // Prospect clicked a link in an outreach email (strong signal)
  | "awaiting_reply" // v37: Prospect replied — automated follow-ups paused
  | "responded"      // Legacy: Prospect replied (use awaiting_reply for new records)
  | "scheduling"     // Moving toward a call/meeting
  | "booked"         // Call/meeting booked
  | "not_interested" // Opted out
  | "converted";     // Became a customer

/** Max automated + drafted outreach emails per lead (intro + 2 follow-ups). */
export const MAX_OUTREACH_EMAILS = 3;

/** Days between each of Cal's three emails to a lead. */
export const OUTREACH_WEEKLY_DAYS = 7;

export const STAGE_DELAYS_DAYS: Record<ConversationStage, number> = {
  discovery: 0,
  intro_sent: OUTREACH_WEEKLY_DAYS,
  followup_1: OUTREACH_WEEKLY_DAYS,
  followup_2: 0,       // Terminal — 3 emails sent, no further automation
  robot_guild: 0,      // Legacy terminal state
  email_opened: 3,     // Opened but no reply — follow up in 3 days
  link_clicked: 1,     // Clicked a link — follow up in 1 day (v36)
  awaiting_reply: 0,   // v37: replied — no automated follow-up
  responded: 0,        // Legacy: no automated follow-up
  scheduling: 0,
  booked: 0,
  not_interested: 0,
  converted: 0,
};
