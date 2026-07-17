/**
 * Cal's Field Notes — short observations from the Studious Observer.
 *
 * Cal is not a salesperson. He shares what he notices in the field — no pitch,
 * no meeting ask. One plain question at the end invites a reply.
 *
 * Two audiences:
 * - **Operators** — warehouses, lines, shifts (flow, handoffs, walking, waiting)
 * - **Robot OEMs** — manufacturers like Fanuc (customer deployments, demos, activation)
 *
 * Same seed + stage → same note (deterministic). No "Field Note #N" headers in the
 * body — the subject line is the hook; numbered headers confused recipients.
 */

import { FRANK_PERSONA } from "./frankPlaybook.js";
import {
  greetingLine,
  normalizeCalEmailGreeting,
  resolveGreetingName,
} from "../services/partnerEmail.js";

export type CalChapterStage = "discovery" | "intro_sent" | "followup_1";

export type CalChapterAudience = "operator" | "robot_oem";

export type CalChapterContext = {
  companyName: string;
  contactName?: string | null;
  contactEmail?: string | null;
  robotType?: string | null;
  robotCategory?: string | null;
  vendorType?: string | null;
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

const OPERATOR_FIELD_NOTES: CalFieldNote[] = [
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
    question:
      "I'm curious — what's the one repetitive job on your floor that everyone works around instead of fixing?",
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

/** Notes for robot manufacturers / OEMs — customer deployments, not warehouse floors. */
const OEM_FIELD_NOTES: CalFieldNote[] = [
  {
    id: "booth_vs_plant",
    format: "field_note",
    noteNumber: 15,
    subject: "The booth demo isn't the hard part",
    body: [
      "I've watched the same robot run flawlessly on a show floor and struggle in a customer's plant a few weeks later.",
      "The gap is rarely the hardware. It's activation — power, network, safety sign-off, and someone who owns day-one troubleshooting.",
      "Most OEM teams feel this in support tickets long before anyone names it out loud.",
    ],
    closer: "That's the part of deployment I watch most closely.",
    question:
      "When a customer deployment stalls, is it usually before power-on or in the first week on their floor?",
  },
  {
    id: "heavy_cell_show",
    format: "field_note",
    noteNumber: 28,
    subject: "Heavy cells show up underpowered more often than you'd think",
    body: [
      "At trade shows, the most expensive delay I see isn't freight — it's discovering the venue power plan doesn't match what the cell actually needs.",
      "Rigging, 480V drops, and safety clearances get treated as logistics details until demo day.",
      "By then the sales team is standing in an aisle waiting for an electrician.",
    ],
    closer: "I've seen this on cells that ran fine in the factory.",
    question: "How often does power or rigging — not software — kill your show-floor timeline?",
  },
  {
    id: "integrator_blame",
    format: "field_note",
    noteNumber: 36,
    subject: "Integrators get blamed for problems that started in shipping",
    body: [
      "A robot that arrives uncommissioned, under-charged, or with a firmware mismatch looks like an integration failure on site.",
      "The integrator gets the call. The root cause was three handoffs earlier.",
      "OEMs that control staging and activation before handoff see fewer 'robot doesn't work' escalations.",
    ],
    question: "Where do your escalations actually start — transit, commissioning, or first production shift?",
  },
  {
    id: "pilot_to_repeat",
    format: "field_note",
    noteNumber: 47,
    subject: "The pilot that never becomes a second site",
    body: [
      "The pattern I see at OEMs: first deployment gets white-glove support. Site two gets whatever's left in the calendar.",
      "Customers don't churn on specs. They churn when the second install feels harder than the first.",
      "Repeatable activation — same checklist, same power story, same training — is what turns a logo into a fleet.",
    ],
    closer: "That's less about the robot and more about the playbook around it.",
    question: "Do your repeat deployments run as smoothly as your flagship installs?",
  },
  {
    id: "demo_program_gap",
    format: "diary",
    noteNumber: 58,
    subject: "Two demos, two completely different activation stories",
    body: [
      "This month I compared two OEM demo programs side by side. Same robot category. One had cells arriving tested and powered; one had integrators rebuilding on the show floor.",
      "Buyers couldn't tell the difference in the booth. They felt it six months later in uptime.",
    ],
    question: "Is your demo program designed for the booth — or for what happens after the customer signs?",
  },
  {
    id: "customer_workflow_first",
    format: "field_note",
    noteNumber: 71,
    subject: "Customers buy robots to fix workflows they haven't mapped",
    body: [
      "OEM sales teams know their spec sheets cold. The stall happens when the customer's workflow wasn't ready for automation — wrong shift, wrong handoff, wrong success metric.",
      "The deals that stick are the ones where someone asked about the task before the payload.",
    ],
    closer: "I hear this from integrators more than from end users.",
    question: "How do you tell early whether a prospect has a workflow problem or a hardware gap?",
  },
];

const OEM_COMPANY_PATTERNS =
  /\b(fanuc|yaskawa|kuka|abb robotics|universal robots|omron|epson robot|denso robot|staubli|kawasaki robot|mitsubishi robot|apptronik|agility robotics|boston dynamics|unitree|figure ai|1x technologies|sanctuary ai|ghost robotics)\b/i;

const OEM_ROBOT_TYPES = new Set([
  "industrial_arm",
  "cobot",
  "humanoid",
  "quadruped",
  "mobile_manipulator",
  "wheeled_amr",
  "service_robot",
  "surgical_robot",
  "exoskeleton",
  "drone",
  "other",
]);

/** Robot OEM / manufacturer — not exhibit houses, freight, or end-user operators. */
export function isRobotOemProspect(prospect: {
  company: string;
  robotType?: string | null;
  vendorType?: string | null;
}): boolean {
  if (prospect.vendorType === "robot_oem") return true;
  if (prospect.vendorType && prospect.vendorType !== "robot_oem") return false;
  if (OEM_COMPANY_PATTERNS.test(prospect.company)) return true;
  const rt = (prospect.robotType ?? "").toLowerCase();
  return OEM_ROBOT_TYPES.has(rt);
}

export function calChapterAudience(prospect: {
  company: string;
  robotType?: string | null;
  vendorType?: string | null;
}): CalChapterAudience {
  return isRobotOemProspect(prospect) ? "robot_oem" : "operator";
}

function fieldNotesForAudience(audience: CalChapterAudience): CalFieldNote[] {
  return audience === "robot_oem" ? OEM_FIELD_NOTES : OPERATOR_FIELD_NOTES;
}

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

/** Optional opener — diary entries only; no numbered "Field Note #N" labels. */
function formatOpener(note: CalFieldNote): string | null {
  if (note.format === "diary") return "Deployment Diary";
  return null;
}

/** Pick the field note for this prospect and outreach stage. */
export function pickCalChapter(ctx: CalChapterContext, stage: CalChapterStage): CalFieldNote {
  const seedKey = String(ctx.seed ?? ctx.companyName ?? "stagegate");
  const offset = STAGE_OFFSET[stage];
  const audience = calChapterAudience(ctx);
  const library = fieldNotesForAudience(audience);
  const idx = (hashSeed(seedKey) + offset) % library.length;
  return library[idx]!;
}

export function listCalChapterIds(): string[] {
  return [...OPERATOR_FIELD_NOTES, ...OEM_FIELD_NOTES].map((n) => n.id);
}

type ProspectLike = {
  company: string;
  contactName?: string | null;
  contactEmail?: string | null;
  robotType?: string | null;
  robotCategory?: string | null;
  vendorType?: string | null;
};

/** Build a field-note email — observation + one question, not a sales touch. */
export function buildCalChapterEmail(
  prospect: ProspectLike,
  stage: CalChapterStage,
): { subject: string; body: string; chapterId: string; audience: CalChapterAudience } {
  const seedKey = prospect.company;
  const ctx: CalChapterContext = {
    companyName: prospect.company,
    contactName: prospect.contactName,
    contactEmail: prospect.contactEmail,
    robotType: prospect.robotType,
    robotCategory: prospect.robotCategory,
    vendorType: prospect.vendorType,
    seed: seedKey,
  };
  const note = pickCalChapter(ctx, stage);
  const audience = calChapterAudience(ctx);

  const resolved = resolveGreetingName({
    contactName: prospect.contactName,
    contactEmail: prospect.contactEmail,
    company: prospect.company,
  });
  const salutation = greetingLine(resolved.greetingName, prospect.company);
  const opener = formatOpener(note);

  const parts: string[] = [];
  if (opener) parts.push(opener);
  parts.push(...note.body);
  if (note.closer) parts.push(note.closer);
  parts.push(note.question);
  parts.push(FRANK_PERSONA.signature);

  const body = normalizeCalEmailGreeting(parts.join("\n\n"), salutation);

  return {
    subject: note.subject,
    body,
    chapterId: note.id,
    audience,
  };
}
