/**
 * Rotating industry insights for Cal's StageGate outreach.
 *
 * Persona: Cal the logistics / show-floor engineer — transit, staging, repair,
 * Vegas warehouse, off-floor demos. NOT Ready For Robots buyer-signal language.
 */

export type CalInsightContext = {
  showName?: string | null;
  robotType?: string | null;
  companyName?: string | null;
  /** Stable key for deterministic selection (defaults to companyName). */
  seed?: string | number | null;
  allowHumor?: boolean;
};

type CalInsight = {
  id: string;
  text: string;
  tags: string[];
  showPattern?: RegExp;
  robotPattern?: RegExp;
  humor?: boolean;
};

const CAL_INSIGHTS: CalInsight[] = [
  {
    id: "transit_jostle",
    text:
      "Robots get jostled in transit more than anyone admits — sometimes breaking a leg (jk), more often a loose connector or a sensor that worked in the lab and won't boot on the floor. We see it constantly. Our engineers and robot techs expect it and fix it before you hit the hall.",
    tags: ["transit", "repair", "generic"],
    humor: true,
  },
  {
    id: "showroom_not_crate",
    text:
      "Most robots go straight back into boxes and crates when the booth closes. Seems like a waste. After the show we can keep yours in a showroom environment so prospects can actually experience it — not just remember a crowded-floor demo from Tuesday.",
    tags: ["showroom", "storage", "generic"],
  },
  {
    id: "six_am_setup",
    text:
      "Your engineers are running demos all day. Someone still has to be at the booth at 6am when the robot won't pair to Wi‑Fi. That's the part we take — staging, boot-up, and the quiet panic before the doors open.",
    tags: ["staging", "generic"],
  },
  {
    id: "cardboard_box",
    text:
      "A humanoid in a cardboard box is not a shipping plan. Cross-country freight on a delicate AMR or a heavy arm without a real road case is how dents and misaligned joints happen. We source or build the right case before it leaves your dock.",
    tags: ["transit", "crating", "humor"],
    humor: true,
  },
  {
    id: "carpet_vs_concrete",
    text:
      "Show carpet vs. hard floor changes everything for wheeled and legged robots. Lighting hits vision systems. Crowd noise hits anything audio-based. We scout the floor before your team lands and flag what could break the demo.",
    tags: ["floor", "generic"],
  },
  {
    id: "power_spike",
    text:
      "Show-floor power is unreliable. A spike can fry a controller board. We bring UPS where it matters and coordinate drops with the show's electrical team — including 480V three-phase when you're staging something industrial.",
    tags: ["power", "generic"],
  },
  {
    id: "customs_hold",
    text:
      "International shipping is where shows go sideways — wrong HS codes, missing ATA carnets, battery paperwork. We've seen robots miss day one of CES because customs had the wrong classification. We track crates down to the mile.",
    tags: ["transit", "international"],
  },
  {
    id: "private_demo",
    text:
      "Your best prospects don't want a noisy-hall impression. They want twenty quiet minutes with the robot actually working. We set up off-floor spaces — our facility, Black Fire, or a hotel suite — for the meetings that actually close.",
    tags: ["demo", "generic"],
  },
  {
    id: "parts_kit",
    text:
      "Something always breaks on the floor — loose connector, failed sensor, software crash. The question is who has parts and who can fix it in twenty minutes. We keep a basic kit and know where to source locally same-day.",
    tags: ["repair", "generic"],
  },
  {
    id: "vegas_warehouse",
    text:
      "Your robot often arrives days before you do. It needs somewhere secure, climate-stable, and not a hotel loading dock. We run bonded warehouse space in Las Vegas — unpack, charge, diagnose, then roll to the hall when you're ready.",
    tags: ["storage", "vegas", "generic"],
  },
  {
    id: "ces_chaos",
    text:
      "CES is the week when half the robotics industry is in Vegas and the other half is stuck in traffic on Paradise Road. The companies that win are the ones whose robots are already staged and tested before their team lands.",
    tags: ["ces", "vegas"],
    showPattern: /\bces\b/i,
    humor: true,
  },
  {
    id: "nab_broadcast",
    text:
      "NAB draws broadcast and live-production folks who've never touched a robot — but they're buying automation for studios and venues now. If you're demoing there, timing and a clean first boot matter more than specs on a slide.",
    tags: ["nab", "vegas"],
    showPattern: /\bnab\b/i,
  },
  {
    id: "automate_promat",
    text:
      "Automate and ProMat buyers walk the floor with a checklist: throughput, integration, ROI. They're not impressed by a robot that worked in the video but stutters on real pallet racking. Pre-show calibration is the whole game.",
    tags: ["automate", "promat", "warehouse"],
    showPattern: /\b(automate|promat|mhi)\b/i,
  },
  {
    id: "imts_industrial",
    text:
      "IMTS is where heavy industrial cells meet buyers who will ask about rigging, safety clearances, and 480V before they ask about cycle time. Staging a Fanuc or Yaskawa cell is a different job than rolling in an AMR.",
    tags: ["imts", "industrial"],
    showPattern: /\bimts\b/i,
  },
  {
    id: "humanoid_hype",
    text:
      "Humanoids get the headlines. They also get the most foot traffic and the least patience when the demo hiccups. If you're bringing bipeds to a show, budget time for recalibration — the crowd won't wait while you reboot.",
    tags: ["humanoid"],
    robotPattern: /\b(humanoid|biped|figure|optimus|digit)\b/i,
    humor: true,
  },
  {
    id: "amr_battery",
    text:
      "AMR teams underestimate battery cycles on a show floor — back-to-back demos, constant replanning, Wi‑Fi handoffs. We monitor charge windows so your unit isn't dead during the meeting that actually matters.",
    tags: ["amr", "mobile"],
    robotPattern: /\b(amr|agv|mobile|autonomous)\b/i,
  },
  {
    id: "post_show_momentum",
    text:
      "The show ends Friday. Momentum dies Monday if the robot goes back in a crate. We can keep it live in Vegas for investor demos, press, or Strip hospitality intros while your team flies home.",
    tags: ["showroom", "vegas", "generic"],
  },
  {
    id: "first_vegas_show",
    text:
      "First time exhibiting in Vegas? The venue rules, union labor windows, and freight deadlines are their own sport. We've done this enough times that your team can focus on the demo, not the dock paperwork.",
    tags: ["vegas", "generic"],
    humor: true,
  },
];

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function normalizeShow(showName?: string | null): string {
  return (showName ?? "").trim();
}

function matchesShow(insight: CalInsight, showName: string): boolean {
  if (!insight.showPattern || !showName) return false;
  return insight.showPattern.test(showName);
}

function matchesRobot(insight: CalInsight, robotType?: string | null): boolean {
  if (!insight.robotPattern || !robotType) return false;
  return insight.robotPattern.test(robotType);
}

/**
 * Pick one Cal insight paragraph for outreach. Same seed → same insight.
 */
export function pickCalInsight(ctx: CalInsightContext): string {
  const showName = normalizeShow(ctx.showName);
  const robotType = (ctx.robotType ?? "").trim();
  const seedKey = String(ctx.seed ?? ctx.companyName ?? showName ?? "stagegate");
  const allowHumor = ctx.allowHumor !== false;

  let pool = CAL_INSIGHTS.filter((i) => allowHumor || !i.humor);

  const showMatches = showName
    ? pool.filter((i) => matchesShow(i, showName))
    : [];
  const robotMatches = robotType
    ? pool.filter((i) => matchesRobot(i, robotType))
    : [];

  // Prefer show-specific, then robot-specific, then general pool
  if (showMatches.length > 0) {
    pool = showMatches;
  } else if (robotMatches.length > 0) {
    pool = robotMatches;
  } else {
    pool = pool.filter((i) => !i.showPattern && !i.robotPattern);
    if (pool.length === 0) pool = CAL_INSIGHTS;
  }

  const idx = hashSeed(seedKey) % pool.length;
  return pool[idx]!.text;
}

/** All insight ids (for tests). */
export function listCalInsightIds(): string[] {
  return CAL_INSIGHTS.map((i) => i.id);
}
