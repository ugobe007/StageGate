/**
 * Cal's rotating outreach chapters — each email is a self-contained lesson.
 *
 * Structure (every email):
 *   1. Observation — insight opens immediately, no self-intro
 *   2. Opinion — what most companies get wrong
 *   3. Lesson — one memorable takeaway the reader keeps even if they never reply
 *   4. Question — invite conversation, not a meeting
 *
 * StageGate positioning appears once, quietly — live deployment intelligence,
 * not a pitch. Same seed + stage → same chapter (deterministic for drafts).
 */

import { FRANK_PERSONA } from "./frankPlaybook.js";
import {
  greetingLine,
  normalizeCalEmailGreeting,
  resolveGreetingName,
} from "../services/partnerEmail.js";

export type CalChapterStage = "discovery" | "intro_sent" | "followup_1";

export type CalChapterContext = {
  companyName: string;
  contactName?: string | null;
  contactEmail?: string | null;
  robotType?: string | null;
  seed?: string | number | null;
};

type CalChapter = {
  id: string;
  subject: string;
  observation: string;
  opinion: string;
  lesson: string;
  intel: string;
  question: string;
  robotPattern?: RegExp;
};

const CAL_CHAPTERS: CalChapter[] = [
  {
    id: "workflow_before_robot",
    subject: "The robot usually isn't what determines success",
    observation:
      "One thing I've learned from watching warehouse robot deployments is that the robot usually isn't what determines success.",
    opinion:
      "The companies that see the best results don't start by comparing vendors. They start by identifying the workflow that's creating the biggest operational drag.",
    lesson:
      "Receiving. Replenishment. Returns. Internal pallet movement. Once that decision is right, choosing the robot becomes much easier.",
    intel:
      "At StageGate, we don't sell robots — we spend our time studying which deployments are still creating value months after installation, not just the ones that look impressive in a demo.",
    question:
      "I'm curious whether automation is already part of your roadmap at {{company}}, or if it's something your team is still evaluating.",
  },
  {
    id: "pilots_fail",
    subject: "Why most warehouse pilots fail",
    observation:
      "Most warehouse pilots I've watched fail for the same reason — and it's rarely the hardware.",
    opinion:
      "Teams spend weeks stress-testing the robot and almost no time defining what success looks like in their actual operation.",
    lesson:
      "The pilots that work set clear metrics first: labor hours saved, throughput, error rates. They run in conditions that match a real shift, not a cleaned-up demo lane.",
    intel:
      "Lately I'm seeing more operators pause vendor selection until they can answer one question: what would we measure at 90 days to know this worked?",
    question:
      "How is {{company}} thinking about proving ROI before scaling?",
  },
  {
    id: "first_workflow",
    subject: "The first workflow I'd automate in almost every warehouse",
    observation:
      "Here's something I notice in almost every warehouse automation conversation: everyone wants the flashy use case first.",
    opinion:
      "Most companies get this backward. The best first automation target is usually boring — repetitive, measurable, and already costing labor hours every week.",
    lesson:
      "Internal transport, case picking to pack-out, or returns sortation often beat 'full autonomy' as a starting point. Win one workflow, then expand.",
    intel:
      "StageGate tracks deployments across the industry — the ones that scale almost always start narrow and prove labor impact before adding complexity.",
    question:
      "If you had to pick one workflow at {{company}} where labor hours hurt most, where would you start?",
  },
  {
    id: "integration_over_speed",
    subject: "Integration matters more than robot speed",
    observation:
      "One pattern I see constantly: a robot arrives on site faster than the systems around it are ready to use it.",
    opinion:
      "Throughput on a spec sheet rarely matches throughput on the floor when WMS, safety zones, and exception handling aren't mapped first.",
    lesson:
      "The longest pole is usually integration — handoffs, data flows, and who owns exceptions when the robot stops mid-shift. Scoping that before hardware ships saves months.",
    intel:
      "We're watching a wave of deployments where integration planning, not robot selection, separated the projects that stuck from the ones that stalled.",
    question:
      "At {{company}}, is integration already scoped — or still an open question?",
  },
  {
    id: "fifty_deployments",
    subject: "What surprised me after watching hundreds of deployments",
    observation:
      "After hundreds of robot deployments, the surprise isn't which vendor wins — it's how often the same preventable mistakes repeat.",
    opinion:
      "Most delays aren't technical. They're sequencing problems: training, commissioning, and go-live compressed into the same week.",
    lesson:
      "Teams that sequence realistically — site ready, then integrate, then train, then run — hit production dates more often than teams that hero-launch.",
    intel:
      "StageGate exists for everything after the purchase: activation, integration, training, and support so a robot becomes an operation, not a science project.",
    question:
      "What's the part of deployment at {{company}} that worries your team most — timing, integration, or operations?",
  },
  {
    id: "humanoid_misconception",
    subject: "The biggest misconception about humanoid robots",
    observation:
      "Humanoids get the headlines — but in the field, the misconception I hear most is that they'll slot into any workflow a person does today.",
    opinion:
      "Most companies underestimate the operating discipline: calibration, safety zones, predictable maintenance windows, and clear task boundaries.",
    lesson:
      "Humanoids can excel at specific, repeatable tasks — not open-ended 'be helpful' roles. The deployments that work define the task first, then match the form factor.",
    intel:
      "Right now we're seeing more operators ask 'which task, which shift, which metric' before asking 'which humanoid.' That shift alone prevents a lot of pilot waste.",
    question:
      "Is {{company}} evaluating humanoids for a specific workflow — or still exploring where they'd fit?",
    robotPattern: /\b(humanoid|biped|figure|optimus|digit|apollo)\b/i,
  },
  {
    id: "labor_math",
    subject: "The labor math most automation projects skip",
    observation:
      "Here's something I've noticed: operations leaders feel automation pressure from labor cost — but the business case often skips the baseline.",
    opinion:
      "Without measuring labor hours, error rates, and throughput before the robot arrives, ROI becomes a story instead of a number six months later.",
    lesson:
      "A one-week baseline on the target workflow — same shift, same volume — makes the pilot answerable. It's a small investment that prevents expensive ambiguity.",
    intel:
      "StageGate helps teams capture that baseline and track post-deployment performance so automation decisions stay grounded in operations, not demos.",
    question:
      "Does {{company}} already have baseline metrics on the workflows you're considering — or is that still being defined?",
  },
  {
    id: "operator_question",
    subject: "The question that predicts deployment success",
    observation:
      "One question predicts deployment success better than almost any robot spec.",
    opinion:
      "Most companies focus on payload, speed, and price. The teams that succeed ask: who operates this on a Tuesday afternoon when something goes wrong?",
    lesson:
      "If the answer is 'the vendor' or 'we're not sure yet,' the deployment isn't ready — regardless of how good the hardware looks in a video.",
    intel:
      "We're seeing more mature operators build training and escalation paths before go-live, not after the first line-down event.",
    question:
      "How is {{company}} thinking about ownership once automation is live — internal ops, vendor support, or a mix?",
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

const STAGE_OFFSET: Record<CalChapterStage, number> = {
  discovery: 0,
  intro_sent: 1,
  followup_1: 2,
};

function fillCompany(text: string, company: string): string {
  return text.replace(/\{\{company\}\}/g, company);
}

/** Pick the chapter for this prospect and outreach stage (never the same chapter twice in sequence). */
export function pickCalChapter(ctx: CalChapterContext, stage: CalChapterStage): CalChapter {
  const seedKey = String(ctx.seed ?? ctx.companyName ?? "stagegate");
  const robotType = (ctx.robotType ?? "").trim();

  let pool = CAL_CHAPTERS;
  const robotMatches = robotType
    ? pool.filter((c) => c.robotPattern?.test(robotType))
    : [];
  if (robotMatches.length > 0) pool = robotMatches;

  const offset = STAGE_OFFSET[stage];
  const idx = (hashSeed(seedKey) + offset) % pool.length;
  return pool[idx]!;
}

export function listCalChapterIds(): string[] {
  return CAL_CHAPTERS.map((c) => c.id);
}

type ProspectLike = {
  company: string;
  contactName?: string | null;
  contactEmail?: string | null;
  robotType?: string | null;
};

/** Build a full Cal email from a chapter — insight-first, ~150 words, conversation invite. */
export function buildCalChapterEmail(
  prospect: ProspectLike,
  stage: CalChapterStage,
): { subject: string; body: string; chapterId: string } {
  const chapter = pickCalChapter(
    {
      companyName: prospect.company,
      contactName: prospect.contactName,
      contactEmail: prospect.contactEmail,
      robotType: prospect.robotType,
      seed: prospect.company,
    },
    stage,
  );

  const resolved = resolveGreetingName({
    contactName: prospect.contactName,
    contactEmail: prospect.contactEmail,
    company: prospect.company,
  });
  const salutation = greetingLine(resolved.greetingName, prospect.company);

  const paragraphs = [
    fillCompany(chapter.observation, prospect.company),
    fillCompany(chapter.opinion, prospect.company),
    fillCompany(chapter.lesson, prospect.company),
    fillCompany(chapter.intel, prospect.company),
    fillCompany(chapter.question, prospect.company),
    FRANK_PERSONA.signature,
  ];

  const body = normalizeCalEmailGreeting(paragraphs.join("\n\n"), salutation);

  return {
    subject: fillCompany(chapter.subject, prospect.company),
    body,
    chapterId: chapter.id,
  };
}
