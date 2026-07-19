/**
 * Natasha Operator — marketing observe + growth brief.
 *
 * 1. Observe signup / activation funnel (users, newsletter, demos, quotes)
 * 2. Generate growth brief (social, newsletter, content, UI experiments)
 * 3. Persist run; notify owner on standalone runs
 *
 * Scheduled: POST /api/scheduled/natasha-operator
 * Also invoked from Relay loop.
 */

import type { Request, Response } from "express";
import { count, desc, eq, gte } from "drizzle-orm";
import { getDb } from "../db.js";
import {
  companyProfiles,
  newsletterSubscriptions,
  salesAgentRuns,
} from "../../drizzle/schema.js";
import { sdk } from "../_core/sdk.js";
import { invokeLLM } from "../_core/llm.js";
import { notifyOwner } from "../_core/notification.js";
import { getConversionSnapshot } from "./relayConversion.js";
import { NATASHA_PERSONA, NATASHA_REPORT_TITLE } from "./natashaPlaybook.js";

export type NatashaFunnelSnapshot = {
  usersLast7d: number;
  usersTotal: number;
  newsletterLast7d: number;
  newsletterTotal: number;
  companyProfilesLast7d: number;
  demosLast7d: number;
  demosPending: number;
  quotesLast7d: number;
  quotesPending: number;
};

export type NatashaGrowthBrief = {
  socialPosts: string[];
  newsletterHooks: string[];
  whitepaperTopics: string[];
  uiExperiments: string[];
  signupNudges: string[];
};

export type NatashaOperatorResult = {
  funnel: NatashaFunnelSnapshot;
  brief?: NatashaGrowthBrief;
  errors: string[];
};

async function countSince(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  table: typeof newsletterSubscriptions | typeof companyProfiles,
  since: Date,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(table)
    .where(gte(table.createdAt, since));
  return Number(row?.n ?? 0);
}

export async function observeNatashaFunnel(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
): Promise<NatashaFunnelSnapshot> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const conversion = await getConversionSnapshot(db);

  const [newsletterTotalRow] = await db.select({ n: count() }).from(newsletterSubscriptions);

  return {
    usersLast7d: conversion.usersLast7d,
    usersTotal: conversion.usersTotal,
    newsletterLast7d: await countSince(db, newsletterSubscriptions, since),
    newsletterTotal: Number(newsletterTotalRow?.n ?? 0),
    companyProfilesLast7d: await countSince(db, companyProfiles, since),
    demosLast7d: conversion.demosLast7d,
    demosPending: conversion.demosPending,
    quotesLast7d: conversion.quotesLast7d,
    quotesPending: conversion.quotesPending,
  };
}

async function generateNatashaGrowthBrief(
  funnel: NatashaFunnelSnapshot,
): Promise<NatashaGrowthBrief | undefined> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are Natasha, the marketing AI agent for StageGate and ReadyForRobots.
StageGate: robot trade-show logistics (receive, power-up, calibrate, demo support). North star: demo booked / quote paid.
ReadyForRobots: vendor-neutral automation advisory. North star: signup → first saved lead → paid tier.
You improve signup funnels and conversion — concrete experiments, not generic slogans. Never write Cal outreach emails. Return ONLY valid JSON.`,
        },
        {
          role: "user",
          content: `Funnel (last 7 days):
- New users: ${funnel.usersLast7d} (total ${funnel.usersTotal})
- Newsletter signups: ${funnel.newsletterLast7d} (total ${funnel.newsletterTotal})
- Company profiles created: ${funnel.companyProfilesLast7d}
- Demos: +${funnel.demosLast7d} (${funnel.demosPending} pending)
- Quotes: +${funnel.quotesLast7d} (${funnel.quotesPending} pending)

Suggest:
- 2 LinkedIn/social post snippets (≤280 chars) for StageGate or ReadyForRobots
- 2 newsletter subject+hook lines
- 2 whitepaper/blog topics
- 2 UI / signup-funnel experiments (hypothesis + where on site)
- 2 signup nudges (CTA or onboarding copy tests)

JSON shape: {
  "socialPosts": [],
  "newsletterHooks": [],
  "whitepaperTopics": [],
  "uiExperiments": [],
  "signupNudges": []
}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "natasha_growth_brief",
          strict: true,
          schema: {
            type: "object",
            properties: {
              socialPosts: { type: "array", items: { type: "string" } },
              newsletterHooks: { type: "array", items: { type: "string" } },
              whitepaperTopics: { type: "array", items: { type: "string" } },
              uiExperiments: { type: "array", items: { type: "string" } },
              signupNudges: { type: "array", items: { type: "string" } },
            },
            required: [
              "socialPosts",
              "newsletterHooks",
              "whitepaperTopics",
              "uiExperiments",
              "signupNudges",
            ],
            additionalProperties: false,
          },
        },
      },
    });
    const raw = result.choices?.[0]?.message?.content;
    return JSON.parse(typeof raw === "string" ? raw : "{}") as NatashaGrowthBrief;
  } catch (err) {
    console.warn("[Natasha] growth brief failed:", String(err));
    return undefined;
  }
}

export async function runNatashaCycle(opts?: {
  skipBrief?: boolean;
}): Promise<NatashaOperatorResult> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const errors: string[] = [];
  let funnel: NatashaFunnelSnapshot;
  try {
    funnel = await observeNatashaFunnel(db);
  } catch (err) {
    errors.push(`funnel: ${String(err)}`);
    funnel = {
      usersLast7d: 0,
      usersTotal: 0,
      newsletterLast7d: 0,
      newsletterTotal: 0,
      companyProfilesLast7d: 0,
      demosLast7d: 0,
      demosPending: 0,
      quotesLast7d: 0,
      quotesPending: 0,
    };
  }

  const brief = opts?.skipBrief ? undefined : await generateNatashaGrowthBrief(funnel);

  console.log(
    `[Natasha] users7d=${funnel.usersLast7d} newsletter7d=${funnel.newsletterLast7d} ` +
      `demos7d=${funnel.demosLast7d} quotes7d=${funnel.quotesLast7d} brief=${brief ? "yes" : "no"}`,
  );

  return { funnel, brief, errors };
}

export function formatNatashaReport(result: NatashaOperatorResult): string {
  const f = result.funnel;
  const lines = [
    `${NATASHA_REPORT_TITLE}`,
    "",
    "Funnel (7d)",
    `• Users +${f.usersLast7d} (total ${f.usersTotal})`,
    `• Newsletter +${f.newsletterLast7d} (total ${f.newsletterTotal})`,
    `• Company profiles +${f.companyProfilesLast7d}`,
    `• Demos +${f.demosLast7d} (${f.demosPending} pending) · Quotes +${f.quotesLast7d} (${f.quotesPending} pending)`,
  ];

  const brief = result.brief;
  if (brief) {
    if (brief.socialPosts?.length) {
      lines.push("", "Social", ...brief.socialPosts.map((s) => `• ${s}`));
    }
    if (brief.newsletterHooks?.length) {
      lines.push("", "Newsletter", ...brief.newsletterHooks.map((s) => `• ${s}`));
    }
    if (brief.uiExperiments?.length) {
      lines.push("", "UI experiments", ...brief.uiExperiments.map((s) => `• ${s}`));
    }
    if (brief.signupNudges?.length) {
      lines.push("", "Signup nudges", ...brief.signupNudges.map((s) => `• ${s}`));
    }
    if (brief.whitepaperTopics?.length) {
      lines.push("", "Authority content", ...brief.whitepaperTopics.map((s) => `• ${s}`));
    }
  }

  if (result.errors.length) {
    lines.push("", "Errors", ...result.errors.map((e) => `• ${e}`));
  }

  lines.push("", NATASHA_PERSONA.signature);
  return lines.join("\n");
}

export async function executeNatashaRun(opts?: {
  skipBrief?: boolean;
  notify?: boolean;
}): Promise<NatashaOperatorResult & { runId: number; startedAt: Date; completedAt: Date }> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const startedAt = new Date();
  const [run] = await db
    .insert(salesAgentRuns)
    .values({
      runType: "natasha",
      status: "running",
      startedAt,
      details: { agent: "natasha" },
    })
    .returning();

  try {
    const result = await runNatashaCycle({ skipBrief: opts?.skipBrief });
    const completedAt = new Date();
    await db
      .update(salesAgentRuns)
      .set({
        status: "completed",
        completedAt,
        details: { agent: "natasha", ...result } as unknown as Record<string, unknown>,
      })
      .where(eq(salesAgentRuns.id, run.id));

    if (opts?.notify !== false && result.brief?.socialPosts?.length) {
      await notifyOwner({
        title: NATASHA_REPORT_TITLE,
        content: formatNatashaReport(result),
      }).catch(() => {});
    }

    return { ...result, runId: run.id, startedAt, completedAt };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(salesAgentRuns)
      .set({ status: "failed", errorMessage: msg, completedAt: new Date() })
      .where(eq(salesAgentRuns.id, run.id));
    throw err;
  }
}

export async function natashaOperatorHandler(req: Request, res: Response) {
  let isCron = false;
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron && user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    isCron = user.isCron;
  } catch {
    return res.status(403).json({ error: "Invalid session" });
  }

  try {
    // Cron: Relay unifies the daily digest — skip duplicate notify.
    const result = await executeNatashaRun({ notify: !isCron });
    return res.json({ ok: true, agent: "natasha", ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
}

export async function getLatestNatashaRun() {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(salesAgentRuns)
    .where(eq(salesAgentRuns.runType, "natasha"))
    .orderBy(desc(salesAgentRuns.startedAt))
    .limit(1);
  return row ?? null;
}
