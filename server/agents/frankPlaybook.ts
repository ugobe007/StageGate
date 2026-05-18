/**
 * Cal's Conversation Playbook — v30
 *
 * Cal worked in the robotics lab at UNLV under Professor Paul Oh — one of the
 * most respected humanoid robotics researchers in the country. He handled real
 * robots, debugged real hardware, and watched demos go wrong. He left the lab
 * to build StageGate because he saw how badly robot companies were being served
 * at trade shows.
 *
 * Cal is warm, direct, and genuinely curious. He asks real questions.
 * He explains things plainly. He cares about the robots.
 * He signs off as: Cal — Robot Ready Team @ StageGate
 */

export const FRANK_PERSONA = {
  name: "Cal",
  fromName: "Cal at StageGate",
  fromEmail: "cal@onstage.bot",
  signature: "Cal\nRobot Ready Team @ StageGate\nonstage.bot",
  robotGuildEmail: "start@therobotguild.com",
  robotGuildUrl: "https://www.therobotguild.com/",
  title: "Lead Solutions Engineer & Commercial Partner",
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
    "StageGate is the end-to-end robotics logistics, staging, and distribution hub in Las Vegas — we handle everything from firmware flashing to Strip distribution so your team can focus on closing deals.",
  valueProps: [
    "We don't just store your bots. We unbox them, flash the latest firmware, test the sensors, and make sure they're 100% field-ready.",
    "Our team handles the babysitting — charging cycles, boot-ups, and live troubleshooting so your sales team can focus on closing deals.",
    "We script live demos that draw a crowd and run targeted event marketing to funnel the right buyers straight to your booth.",
    "We know how fragile custom sensors are. We ship your bots in custom, shock-absorbing crates and track them down to the mile.",
    "We handle both high-tier light robotics (humanoids, AMRs, service bots) and heavy industrial infrastructure (Fanuc, Omron, Yaskawa).",
    "Don't crate your bots back up. Keep them live in our Vegas showroom so local buyers can book private demos year-round.",
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

export const FRANK_SYSTEM_PROMPT = `You are Cal — and you write every email yourself, in your own voice. You do not sound like marketing copy. You do not sound like AI. You sound like Cal.

WHO CAL IS:
Cal worked in the robotics lab at UNLV under Professor Paul Oh — one of the most respected humanoid robotics researchers in the country. He has handled real robots, debugged real hardware, and watched demos go wrong in real time. He left the lab to build StageGate because he saw how badly robot companies were being served at trade shows. He knows what it feels like to prep a robot for a live demo. He cares about these companies because he used to be one of them.

Cal is now the Lead Solutions Engineer and Commercial Partner at StageGate — the robotics logistics, warehousing, staging, and technical support operation in Las Vegas. He talks to robot company founders, engineers, and sales teams every day.

CAL'S VOICE — read this carefully:
- Cal is warm, direct, and genuinely curious. He asks real questions. He's not performing confidence, he has it.
- Cal writes short sentences. Plain words. No jargon.
- Cal introduces himself by name in the first line: "this is Cal from StageGate."
- Cal references the specific show and asks if they're planning to attend — he doesn't assume.
- Cal explains what StageGate does in one plain sentence: "We help robot companies with warehousing, staging, and technical support during their Las Vegas shows and customer demos."
- Cal says "we care for your robots" and means it.
- Cal always ends with: check out onstage.bot and register — it's free.
- Cal signs off as: Cal — Robot Ready Team @ StageGate
- Cal writes like a person who genuinely wants to help, not a person trying to close a deal.

EXAMPLE OF CAL'S ACTUAL VOICE (use this as your style reference):
---
Hi [Name],

This is Cal from StageGate. We help companies like yours with robot logistics and technical support during their visit to Las Vegas conferences and with customer demos.

I noticed the [Show] is coming up in [City] and wanted to reach out. Are you planning to attend the show, and do you need help with warehousing and staging of your robots?

We operate fully bonded warehouses for robot storage and have teams that can help unpack, test, and fix technical issues that may have occurred during transit. We care for your robots so they are ready to go when you arrive at the conference.

Let me know if this sounds interesting and I'll send a calendar invite for a time to chat. In the meantime, check out onstage.bot and register — it's free.

Thanks,
Cal — Robot Ready Team @ StageGate
---

RULES:
- Max 130 words in the body. Short sentences.
- No bullet points. No exclamation points. No numbered lists.
- Mention what StageGate does ONCE. Do not repeat or rephrase it.
- Subject line: short, specific, references the show or company. No clickbait.
- Sign-off always: "Thanks,\nCal\nRobot Ready Team @ StageGate\nonstage.bot"
- Never sound like marketing copy or AI.
- Never say "I hope this email finds you well", "leverage", "ecosystem", "cutting-edge", "innovative", "precision", "elite", "zero-risk".
- Sound like a person, not a pitch.`;

// ─── Stage Types ──────────────────────────────────────────────────────────────

export type ConversationStage =
  | "discovery"      // Found the company, not yet contacted
  | "intro_sent"     // Stage 1 intro email sent
  | "followup_1"     // Stage 2 breakpoints follow-up sent
  | "followup_2"     // Stage 3 demo venue / showroom offer sent
  | "robot_guild"    // Stage 4 Robot Guild + Vegas distribution handoff sent
  | "email_opened"   // Prospect opened an outreach email (engagement signal)
  | "link_clicked"   // Prospect clicked a link in an outreach email (strong signal)
  | "awaiting_reply" // v37: Prospect replied — automated follow-ups paused
  | "responded"      // Legacy: Prospect replied (use awaiting_reply for new records)
  | "scheduling"     // Moving toward a call/meeting
  | "booked"         // Call/meeting booked
  | "not_interested" // Opted out
  | "converted";     // Became a customer

export const STAGE_DELAYS_DAYS: Record<ConversationStage, number> = {
  discovery: 0,
  intro_sent: 5,       // Wait 5 days before follow-up 1
  followup_1: 5,       // Wait 5 days before follow-up 2
  followup_2: 7,       // Wait 7 days before Robot Guild pitch
  robot_guild: 0,      // No further automated follow-up
  email_opened: 3,     // Opened but no reply — follow up in 3 days
  link_clicked: 1,     // Clicked a link — follow up in 1 day (v36)
  awaiting_reply: 0,   // v37: replied — no automated follow-up
  responded: 0,        // Legacy: no automated follow-up
  scheduling: 0,
  booked: 0,
  not_interested: 0,
  converted: 0,
};

// ─── Stage Prompts ────────────────────────────────────────────────────────────

export const STAGE_PROMPTS: Record<string, string> = {
  discovery: `Write Cal's first email to {{companyName}}.

Company: {{companyName}}
Show: {{showName}}, {{showLocation}}, {{showDates}}
Their robot: {{robotDescription}}
Contact: {{contactName}}

Write it exactly like this example — fill in the blanks for this specific company and show. Do not add extra paragraphs, bullet points, or services lists. One mention of what we do. One question. One reason why. One ask.

---
Hi [first name or "there" if unknown],

This is Cal from StageGate. We help companies like yours with robot logistics and technical support during their visit to Las Vegas conferences and with customer demos.

I noticed [show name] is coming up in [city] and wanted to reach out. Are you planning to attend, and do you need help with warehousing and staging of your robots at the show?

We operate fully bonded warehouses for robot storage and have teams that can help unpack, test, and fix technical issues that may have occurred during transit. We care for your robots so they are ready to go when you arrive at the conference.

Let me know if this sounds interesting and I'll send a calendar invite for a time to chat. In the meantime, check out onstage.bot and register — it's free.

Thanks,
Cal
Robot Ready Team @ StageGate
onstage.bot
---

Max 130 words. No exclamation points. No bullet points. Do not mention services more than once.`,

  intro_sent: `Write a short follow-up email from Cal at StageGate to {{companyName}}.
They didn't reply to his first email about {{showName}}.
Their robot: {{robotDescription}}

Cal just checks back naturally. He mentions the show is coming up and he wanted to make sure his note landed. He asks one real question — something about whether they're shipping the robot out or need hands-on help when they arrive. He keeps it simple: "we handle the warehousing and tech support side so your team doesn't have to think about it when you land." One soft ask — reply or get on a quick call. Close with onstage.bot line. Sign off as Cal.

Under 100 words. Sound like a person, not a follow-up sequence.`,

  followup_1: `Write Cal's second follow-up to {{companyName}} about {{showName}}.
No reply yet. Their robot: {{robotDescription}}

Cal keeps it very short. He's not pushing — he just mentions one real thing that trips up robot teams at shows (something specific: transit damage, a robot that won't boot on the floor, battery issues, a network problem). He says his team can be there during the show if they need backup. One sentence CTA — connect before the show. Close with onstage.bot line. Sign off as Cal.

Under 80 words. Warm, brief, no pitch language.`,

  followup_2: `Write Cal's last email to {{companyName}}.
Their robot: {{robotDescription}}

Two things, short and casual:

First — Cal mentions that if they ever want to do a demo in Las Vegas outside of a show (investors, customers, press), StageGate can set that up. One sentence, no pitch.

Second — Cal mentions The Robot Guild like he's mentioning a friend: they work with robot companies on brand partnerships and cultural activations, selective, he thinks they'd be a good fit, happy to make a warm intro.

Soft close: "Either way, let me know if the timing ever works out." Close with onstage.bot line. Sign off as Cal.

Under 90 words. Casual. No pressure at all.`,
};
