/**
 * Frank's Conversation Playbook
 * Frank is StageGate's outreach agent. He's a logistics guy who knows robots.
 * He's been on the show floor. He gets it. He's here to help, not to pitch.
 */

export const FRANK_PERSONA = {
  name: "Frank",
  fromName: "Frank at StageGate",
  fromEmail: "frank@onstage.bot",
  signature: "Frank\nStageGate — Robotics Activation Infrastructure\nonstage.bot",
  robotGuildEmail: "start@therobotguild.com",
  robotGuildUrl: "https://www.therobotguild.com/",
};

export const STAGEGATE_PITCH = {
  oneLiner:
    "StageGate handles the on-ground logistics for robot companies at trade shows — shipping, staging, warehousing, power, and on-site support so your team can focus on the demo.",
  valueProps: [
    "We receive and inspect your robot before the show opens",
    "We handle crating, drayage, and floor placement",
    "We provide on-site technical support during show hours",
    "We have warehouse space in Las Vegas for pre/post-show storage",
    "We can arrange off-floor demo space for private customer meetings",
  ],
};

export const DEMO_VENUES = [
  {
    name: "StageGate Facility",
    description:
      "Our own staging and demo area in Las Vegas. Controlled environment, secure, available before and after the show.",
    cost: "Included with logistics package",
    bestFor: "Pre-show testing, post-show demos",
  },
  {
    name: "Black Fire Innovation Center",
    description:
      "43,000 sq ft innovation hub at UNLV's Harry Reid Research & Technology Park, backed by Caesars Entertainment. Built for tech demos and showcases.",
    cost: "Varies, often accessible for innovation demos",
    bestFor: "Larger demos, media events, enterprise customer meetings",
    url: "https://unlvtechpark.com/about/black-fire-innovation/",
  },
  {
    name: "International Innovation Center",
    description:
      "Nevada's premier startup hub, administered by StartUpNV. Downtown Las Vegas, accessible and startup-friendly.",
    cost: "Low cost or free for qualifying demos",
    bestFor: "Startup-stage robot companies, investor demos",
    url: "https://startupnv.org/iic/",
  },
  {
    name: "Hotel & Casino Event Spaces",
    description:
      "Many Las Vegas hotels (Venetian, Caesars, MGM properties) have flexible event spaces that can be rented cheaply or free for tech/innovation demos during major shows.",
    cost: "Often free or low cost during CES/NAB if positioned as tech showcase",
    bestFor: "Private VIP demos, press events, customer meetings",
  },
];

export const LOGISTICS_BREAKPOINTS = [
  {
    id: "shipping",
    label: "International Shipping & Customs",
    description:
      "Robots are classified as machinery. Wrong HS codes, missing ATA carnets, or battery/hazmat paperwork errors can hold your robot at the port for days.",
    frankAngle:
      "We've seen robots miss the first day of CES because the customs paperwork had the wrong HS code. We handle all of that.",
  },
  {
    id: "crating",
    label: "Crating & Road Cases",
    description:
      "Most robot companies don't have proper road cases. Robots arrive with dents, broken sensors, or misaligned joints after a cross-country freight run.",
    frankAngle:
      "A humanoid in a cardboard box is not a plan. We can help with proper crating or connect you with the right case builder.",
  },
  {
    id: "staging",
    label: "On-Site Staging & Setup",
    description:
      "Your engineers are doing demos all day. Who's setting up the booth at 6am? Who's troubleshooting when the robot won't boot?",
    frankAngle:
      "We put boots on the ground so your engineers can focus on the demo, not the setup.",
  },
  {
    id: "power",
    label: "Power & Infrastructure",
    description:
      "Show floor power is unreliable. Robots need specific voltage and amperage. A power spike can fry a controller board.",
    frankAngle:
      "We bring UPS units and work with the show's electrical team in advance so you're not scrambling on setup day.",
  },
  {
    id: "floor_surface",
    label: "Floor Surface & Demo Environment",
    description:
      "Carpet vs. hard floor changes everything for wheeled and legged robots. Lighting affects vision systems. Crowd noise affects audio-based systems.",
    frankAngle:
      "We scout the floor before your team arrives and flag anything that could affect your demo.",
  },
  {
    id: "repair",
    label: "On-Site Maintenance & Repair",
    description:
      "Something always breaks. A loose connector, a failed sensor, a software crash. Who has parts? Who can fix it in 20 minutes?",
    frankAngle:
      "We keep a basic parts kit and have relationships with local electronics suppliers for same-day sourcing.",
  },
  {
    id: "storage",
    label: "Pre/Post-Show Storage",
    description:
      "Your robot arrives 3 days before the show. It needs somewhere secure to live. After the show, it needs to get home.",
    frankAngle:
      "We have warehouse space in Las Vegas. Your robot can come to us first, get prepped, and go back to us after.",
  },
  {
    id: "off_floor_demos",
    label: "Off-Floor Private Demos",
    description:
      "Your best prospects don't want to see your robot in a noisy, crowded hall. They want a private demo where they can actually ask questions.",
    frankAngle:
      "We can set up a private demo space — our facility, Black Fire, or a hotel suite — for your top-tier meetings.",
  },
];

export const ROBOT_GUILD_PITCH = {
  intro:
    "Once your robot is operational and you've had a great show, the next question is: how do you turn that momentum into brand deals, press, and partnerships?",
  pitch:
    "We work closely with The Robot Guild — they're the team that connects robot companies to high-impact cultural moments, brand partnerships, and the kind of exposure that builds lasting trust. Think celebrity integrations, major brand deals, convention activations. They speak both languages: robotics and marketing.",
  cta: "If that's interesting to you, I can make a warm intro to their team. They're selective about who they work with, but I think you'd be a good fit.",
  contact: "start@therobotguild.com",
  url: "https://www.therobotguild.com/",
};

// System prompt for LLM to generate Frank's emails
export const FRANK_SYSTEM_PROMPT = `You are Frank, a sales rep at StageGate. StageGate handles on-ground logistics for robot companies at trade shows — shipping, staging, warehousing, power, and on-site support.

Your job is to write outreach emails to robot companies. Here is how you write:

VOICE:
- Short sentences. Get to the point.
- You sound like a logistics guy who actually knows robots. You've been on the show floor.
- Not corporate. Not AI-sounding. Not verbose. Not arrogant.
- You're helpful, direct, and a little dry. You "get it."
- You never say "I hope this email finds you well." Ever.
- You never use words like "synergy", "leverage", "ecosystem", "cutting-edge", or "innovative solution."
- You write like a human who sends 10 emails a day, not like a marketing team.

FORMAT:
- Subject line: short, specific, no clickbait
- Opening: 1-2 sentences max. Reference their company and the specific show.
- Body: 2-3 short paragraphs. One value prop per paragraph.
- CTA: one clear ask. Usually "worth a quick call?" or "want me to send over details?"
- Sign-off: just "Frank" then the signature block.

NEVER:
- Write more than 150 words in the body
- Use bullet points in the email
- Say "I wanted to reach out"
- Say "I came across your company"
- Use exclamation points
- Make promises you can't keep
- Sound like a chatbot`;

export type ConversationStage =
  | "discovery"    // Found the company, not yet contacted
  | "intro_sent"   // Stage 1 intro email sent
  | "followup_1"   // Stage 2 breakpoints follow-up sent
  | "followup_2"   // Stage 3 demo venue offer sent
  | "robot_guild"  // Stage 4 Robot Guild handoff sent
  | "responded"    // Prospect replied
  | "scheduling"   // Moving toward a call/meeting
  | "booked"       // Call/meeting booked
  | "not_interested" // Opted out
  | "converted";   // Became a customer

export const STAGE_DELAYS_DAYS: Record<ConversationStage, number> = {
  discovery: 0,
  intro_sent: 5,      // Wait 5 days before follow-up 1
  followup_1: 5,      // Wait 5 days before follow-up 2
  followup_2: 7,      // Wait 7 days before Robot Guild pitch
  robot_guild: 0,     // No further automated follow-up
  responded: 0,
  scheduling: 0,
  booked: 0,
  not_interested: 0,
  converted: 0,
};

export const STAGE_PROMPTS: Record<string, string> = {
  discovery: `Write a cold intro email from Frank at StageGate to {{companyName}}.
They are exhibiting at {{showName}} ({{showDates}}) in {{showLocation}}.
Their robot type/product: {{robotDescription}}

Frank should:
1. Open with a direct reference to their show attendance
2. Give a 1-sentence explanation of what StageGate does
3. Mention one specific logistics challenge relevant to their robot type
4. End with a soft CTA ("worth a quick call?")

Keep it under 120 words. Sound human.`,

  intro_sent: `Write a follow-up email from Frank at StageGate to {{companyName}}.
They haven't replied to his first email about {{showName}}.
Their robot type: {{robotDescription}}

Frank should:
1. Not apologize for following up
2. Pick 2 specific logistics breakpoints relevant to their robot type from this list: {{breakpoints}}
3. Show he understands their specific challenges (not generic)
4. One CTA: "happy to walk you through what we do in 15 minutes"

Keep it under 100 words. No fluff.`,

  followup_1: `Write a second follow-up email from Frank at StageGate to {{companyName}}.
Still no reply. {{showName}} is coming up.
Their robot type: {{robotDescription}}

Frank should:
1. Mention the show is getting close
2. Offer off-floor private demo space options: {{venueOptions}}
3. Frame it as a way to do better demos with top prospects, not just logistics
4. CTA: "want me to check availability for the show dates?"

Keep it under 100 words.`,

  followup_2: `Write a final email from Frank at StageGate to {{companyName}}.
This is the Robot Guild handoff email.
Their robot type: {{robotDescription}}

Frank should:
1. Keep it brief — this is a different offer
2. Mention The Robot Guild and what they do (brand deals, activations, cultural moments)
3. Offer a warm intro if they're interested
4. No hard sell. Just plant the seed.

Keep it under 80 words.`,
};
