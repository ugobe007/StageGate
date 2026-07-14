/**
 * Cal's Field Notes — short observations from the Studious Observer.
 *
 * Cal is not a salesperson. He is an anthropologist of work: obsessed with flow,
 * not robotics. Robots are one tool; people, materials, and time are the story.
 *
 * Every email is a field note or deployment diary entry — no pitch, no CTA,
 * one curious question at the end. Same seed + stage → same note (deterministic).
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

type FieldNoteFormat = "field_note" | "diary";

type CalFieldNote = {
  id: string;
  format: FieldNoteFormat;
  noteNumber: number;
  subject: string;
  /** Narrative body — observation, reflection, lesson. Plain paragraphs. */
  body: string[];
  /** Optional one-line closer before the question (e.g. "That's what I spend my time studying."). */
  closer?: string;
  question: string;
  settingPattern?: RegExp;
};

/** Sparse, memorable note numbers — feels like a long-running series. */
const NOTE_NUMBERS = [7, 14, 22, 31, 38, 44, 52, 61, 73, 89];

const FIELD_NOTES: CalFieldNote[] = [
  {
    id: "watch_people_first",
    format: "field_note",
    noteNumber: 14,
    subject: "I watch people before I look at machines",
    body: [
      "Whenever I visit a warehouse, I ignore the robots for the first fifteen minutes. I watch people instead.",
      "Where do they stop? Where do they wait? Where do they walk farther than they should?",
      "Almost every operation has one workflow that quietly steals hours every day. Most teams know it's there — they've just learned to work around it.",
      "That's usually where automation creates the biggest return. Not because of the robot. Because the workflow was finally fixed.",
    ],
    closer: "That's what I spend my time studying.",
    question:
      "I'm curious — if you could remove one repetitive task from your operation tomorrow, what would it be?",
  },
  {
    id: "forklift_waiting",
    format: "field_note",
    noteNumber: 38,
    subject: "Forklifts spent more time waiting than moving",
    body: [
      "I watched a warehouse this week where forklifts spent more time waiting than moving.",
      "Nobody noticed because everyone was focused on picker productivity.",
      "Turns out the bottleneck wasn't labor. It was aisle congestion.",
    ],
    question: "Interesting. Does that match anything you've seen on your floor?",
  },
  {
    id: "slowest_robot",
    format: "field_note",
    noteNumber: 44,
    subject: "The slowest machine created the most value",
    body: [
      "The fastest robot in the building wasn't creating the most value. The slowest one was.",
      "Why? Because it eliminated the one task nobody wanted to do — the one that had been patched over with overtime for years.",
      "Speed on a spec sheet tells you almost nothing about whether work actually gets easier.",
    ],
    closer: "I notice this more than I notice vendor logos.",
    question: "Is there a task on your floor that everyone avoids but nobody has time to fix?",
  },
  {
    id: "longest_line",
    format: "field_note",
    noteNumber: 22,
    subject: "The longest line usually isn't where management thinks",
    body: [
      "The longest line in a warehouse usually isn't where management thinks it is.",
      "It's often in the handoff — between receiving and put-away, between pick and pack, between returns and disposition.",
      "Work stacks up where two processes meet and neither team owns the gap.",
    ],
    closer: "Every facility has one place where work quietly stacks up.",
    question: "Where does work pile up when you're not looking?",
  },
  {
    id: "crossing_paths",
    format: "diary",
    noteNumber: 31,
    subject: "Two employees crossed paths three hundred times",
    body: [
      "This week I noticed two pickers crossing the same aisle intersection all morning. Same paths. Same timing. No collision — just wasted steps.",
      "Three hundred crossings in a shift adds up to miles nobody planned for.",
      "Layout problems don't show up in a dashboard. They show up in tired feet.",
    ],
    question: "Have you ever mapped where people actually walk versus where the floor plan says they should?",
  },
  {
    id: "inventory_trips",
    format: "field_note",
    noteNumber: 52,
    subject: "Inventory made three unnecessary trips",
    body: [
      "I traced one SKU through a facility last month. It made three trips it didn't need to make — staging, re-staging, then finally to pick.",
      "Nobody designed it that way. It accumulated, one workaround at a time.",
      "Materials move more than people talk about. Every extra touch is a tax on throughput.",
    ],
    closer: "That's the kind of thing I can't unsee once I start watching.",
    question: "If you traced one product line end to end, would the path surprise you?",
  },
  {
    id: "two_fifteen_stop",
    format: "diary",
    noteNumber: 61,
    subject: "Everyone stopped walking at 2:15",
    body: [
      "Today I noticed everyone on one shift stop moving at 2:15 PM. Not a break — a bottleneck upstream.",
      "A conveyor jam three zones away had frozen the whole flow. The floor looked busy. Nothing was moving.",
      "Flow is fragile. One stuck handoff looks like a labor problem from a distance.",
    ],
    question: "What time of day does your operation feel busiest but accomplish the least?",
  },
  {
    id: "industry_pattern",
    format: "field_note",
    noteNumber: 73,
    subject: "Something I'm seeing across operations this year",
    body: [
      "Across warehouses, restaurants, and light manufacturing this year, the same pattern keeps appearing.",
      "Teams buy automation to fix a labor gap — then discover the gap was actually a process gap wearing a labor costume.",
      "The companies getting value aren't the ones with the newest hardware. They're the ones who fixed the workflow first and let the tool fit.",
    ],
    closer: "I write these down because the pattern is easy to miss from inside one building.",
    question: "Does that land — or does your operation feel different?",
  },
  {
    id: "flow_not_robots",
    format: "field_note",
    noteNumber: 7,
    subject: "Cal walks in and ignores the robots",
    body: [
      "Whenever I visit an operation, I watch people before I look at machines.",
      "Why are those two employees crossing paths all day? Why is inventory taking the long way? Why does everyone pause at the same hour?",
      "I'm obsessed with flow. Not robotics. Flow.",
      "Robots are simply one way to improve a system — after you understand where the system leaks.",
    ],
    question: "What's one place in your operation where time disappears without anyone naming it?",
  },
  {
    id: "task_nobody_wants",
    format: "diary",
    noteNumber: 89,
    subject: "One mistake I keep seeing",
    body: [
      "One mistake I keep seeing: automating the task that looks impressive instead of the task that hurts.",
      "The painful jobs — re-labeling, re-staging, walking empty aisles — rarely get discussed in vendor meetings. They're where the hours actually go.",
      "Fix that workflow and almost any reasonable tool starts to pay for itself.",
    ],
    closer: "That's what I mean when I say I study work, not robots.",
    question: "What's the unglamorous task that costs you the most hours?",
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

function formatHeader(note: CalFieldNote, seedKey: string, stage: CalChapterStage): string {
  if (note.format === "diary") return "Deployment Diary";
  const offset = STAGE_OFFSET[stage];
  const num = NOTE_NUMBERS[(hashSeed(seedKey) + note.noteNumber + offset) % NOTE_NUMBERS.length]!;
  return `Field Note #${num}`;
}

/** Pick the field note for this prospect and outreach stage. */
export function pickCalChapter(ctx: CalChapterContext, stage: CalChapterStage): CalFieldNote {
  const seedKey = String(ctx.seed ?? ctx.companyName ?? "stagegate");
  const offset = STAGE_OFFSET[stage];
  const idx = (hashSeed(seedKey) + offset) % FIELD_NOTES.length;
  return FIELD_NOTES[idx]!;
}

export function listCalChapterIds(): string[] {
  return FIELD_NOTES.map((n) => n.id);
}

type ProspectLike = {
  company: string;
  contactName?: string | null;
  contactEmail?: string | null;
  robotType?: string | null;
};

/** Build a Field Note email — anthropologist of work, not a sales touch. */
export function buildCalChapterEmail(
  prospect: ProspectLike,
  stage: CalChapterStage,
): { subject: string; body: string; chapterId: string } {
  const seedKey = prospect.company;
  const note = pickCalChapter(
    {
      companyName: prospect.company,
      contactName: prospect.contactName,
      contactEmail: prospect.contactEmail,
      robotType: prospect.robotType,
      seed: seedKey,
    },
    stage,
  );

  const resolved = resolveGreetingName({
    contactName: prospect.contactName,
    contactEmail: prospect.contactEmail,
    company: prospect.company,
  });
  const salutation = greetingLine(resolved.greetingName, prospect.company);
  const header = formatHeader(note, seedKey, stage);

  const parts: string[] = [header, ...note.body];
  if (note.closer) parts.push(note.closer);
  parts.push(note.question);
  parts.push(FRANK_PERSONA.signature);

  const body = normalizeCalEmailGreeting(parts.join("\n\n"), salutation);

  return {
    subject: note.subject,
    body,
    chapterId: note.id,
  };
}
