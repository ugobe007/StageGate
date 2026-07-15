/**
 * Rotating deployment lessons for Cal's StageGate outreach.
 *
 * Audience: robot OEMs at trade shows plus event/tradeshow companies that use
 * robots (exhibit houses, show producers, entertainment/event firms). Voice is
 * show logistics and pre-floor readiness — not Ready For Robots buyer matching.
 *
 * Persona: Cal the Physical AI Deployment Advisor. Each insight is a practical
 * field lesson about deploying, integrating, operating, and scaling robots —
 * the kind of thing that makes a reader feel they learned something useful.
 * Never a pitch, never show-floor sales language.
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
    id: "deploy_gap",
    text:
      "The pattern I see most: companies spend months choosing a robot and only days planning the deployment. The robot is rarely the hard part — the site, the integration, and who operates it every day are where timelines slip.",
    tags: ["deployment", "generic"],
  },
  {
    id: "pilot_failure",
    text:
      "Most pilots don't fail because the robot can't do the task. They fail because success was never defined, or because the pilot ran in conditions that don't match real operations. A pilot with clear metrics and a production-like environment tells you something; a demo doesn't.",
    tags: ["pilot", "roi", "generic"],
  },
  {
    id: "site_readiness",
    text:
      "Site readiness is the quiet killer — floor flatness, network coverage, power, safety clearances, charging locations. Teams discover these on install day instead of on paper, and a one-week job becomes a month.",
    tags: ["site", "infrastructure", "generic"],
  },
  {
    id: "who_operates",
    text:
      "The question that predicts success better than almost any spec: who operates this robot on a Tuesday afternoon when something goes wrong? If the answer is 'the vendor' or 'we're not sure yet,' the deployment isn't ready regardless of how good the hardware is.",
    tags: ["operations", "training", "generic"],
  },
  {
    id: "integration_reality",
    text:
      "The robot almost never lives alone. It has to talk to a WMS, an MES, a fleet manager, or a safety system. Integration is usually the longest pole in the tent, and it's worth scoping before the hardware ships, not after.",
    tags: ["integration", "generic"],
  },
  {
    id: "operator_training",
    text:
      "Operator training is treated as a day-one checkbox and then forgotten. But turnover is real, and a deployment that only three trained people can run is fragile. The teams that scale build training into the operation, not the launch.",
    tags: ["training", "change_management", "generic"],
  },
  {
    id: "support_plan",
    text:
      "Before go-live it's worth asking: when the robot stops at 2am, who gets the call, what's the response time, and where do spare parts come from? A support plan on paper is cheaper than an unplanned line-down.",
    tags: ["support", "operations", "generic"],
  },
  {
    id: "fleet_step",
    text:
      "Going from one robot to a fleet is a different problem than going from zero to one. Scheduling, charging, traffic, monitoring, and exception handling all change. A first deployment designed with fleet in mind saves a painful re-architecture later.",
    tags: ["fleet", "scale", "generic"],
  },
  {
    id: "roi_measurement",
    text:
      "A lot of deployments can't prove their ROI six months in — not because the value isn't there, but because no one captured the baseline before the robot arrived. Measuring the 'before' is a five-minute decision that's impossible to make later.",
    tags: ["roi", "generic"],
  },
  {
    id: "change_management",
    text:
      "The technical rollout is often smoother than the human one. If the people who work alongside the robot weren't part of planning, adoption stalls. The best deployments treat the floor team as stakeholders, not spectators.",
    tags: ["change_management", "generic"],
  },
  {
    id: "timeline_sequence",
    text:
      "Deployment timelines slip most often because steps that should be sequential get compressed into parallel — integration, training, and commissioning all landing in the same week. Sequencing the work realistically usually beats a heroic launch.",
    tags: ["timeline", "generic"],
  },
  {
    id: "vendor_coordination",
    text:
      "A single deployment can involve the robot vendor, an integrator, a freight forwarder, a facilities team, and IT — none of whom own the outcome. Someone has to coordinate across them, and when no one does, the gaps between vendors are where projects fail.",
    tags: ["vendor", "coordination", "generic"],
  },
  {
    id: "logistics_first_impression",
    text:
      "A robot's first day on site is set by how it arrived. Poor crating, no receiving plan, or a unit that sat on a dock in the cold means commissioning starts with repairs. Getting logistics and activation right removes a whole class of day-one problems.",
    tags: ["logistics", "activation", "generic"],
  },
  {
    id: "humanoid_ops",
    text:
      "Humanoids get the headlines, but in the field they demand the most operational discipline — calibration, safety zones, and predictable maintenance windows. If you're deploying bipeds, planning the operating routine matters as much as the capability.",
    tags: ["humanoid"],
    robotPattern: /\b(humanoid|biped|figure|optimus|digit)\b/i,
  },
  {
    id: "amr_environment",
    text:
      "AMR and mobile deployments live or die on the environment: network handoffs, floor markings, dynamic obstacles, and charging placement. The map you build in week one quietly determines throughput for the life of the deployment.",
    tags: ["amr", "mobile"],
    robotPattern: /\b(amr|agv|mobile|autonomous)\b/i,
  },
  {
    id: "expansion_readiness",
    text:
      "When a deployment goes well, the next question is expansion — and that's exactly when infrastructure decisions made for one site start to bite. Designing the first deployment as a template, not a one-off, is what makes the second one fast.",
    tags: ["scale", "expansion", "generic"],
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
