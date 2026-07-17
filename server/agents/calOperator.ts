/**
 * Cal Operator — autonomous pipeline maintenance.
 *
 * Runs without human supervision:
 *   1. Dismiss junk exhibitor names (headlines, booth labels)
 *   2. Resolve websites via Hunter Domain Finder
 *   3. Enrich person-level emails via Hunter
 *   4. Redraft / create Cal email drafts
 *   5. Quarantine bounced addresses
 *   6. Produce a growth brief (social, newsletter, whitepaper ideas)
 *
 * Scheduled: POST /api/scheduled/cal-operator (cron, 2× daily)
 */

import type { Request, Response } from "express";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../db.js";
import { salesAgentRuns } from "../../drizzle/schema.js";
import { sdk } from "../_core/sdk.js";
import { invokeLLM } from "../_core/llm.js";
import { notifyOwner } from "../_core/notification.js";
import { hunterEnabled } from "../integrations/hunter.js";
import {
  dismissJunkProspectsBatch,
  resolveProspectWebsitesBatch,
} from "./prospectWebsiteResolution.js";
import { enrichProspectsBatch, recoverQuarantinedProspectContacts } from "./prospectEnrichment.js";
import { refreshCalDraftsCore, getCalWorkflowSummary } from "./salesAgent.js";
import { computeBounceStats } from "../outreachGate.js";

const BATCH = Number(process.env.CAL_OPERATOR_BATCH_SIZE) || 25;

export type CalOperatorResult = {
  junkDismissed: number;
  websitesResolved: number;
  websitesDismissed: number;
  emailsEnriched: number;
  draftsRedrafted: number;
  draftsGenerated: number;
  quarantined: number;
  quarantineRecovered: number;
  quarantineUnresolved: number;
  growthBrief?: {
    socialPosts: string[];
    newsletterHooks: string[];
    whitepaperTopics: string[];
    pipelineNotes: string[];
  };
  workflowAfter: Awaited<ReturnType<typeof getCalWorkflowSummary>>;
  errors: string[];
};

async function generateCalGrowthBrief(
  workflow: Awaited<ReturnType<typeof getCalWorkflowSummary>>,
  bounceRate: number,
): Promise<CalOperatorResult["growthBrief"]> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are Cal, StageGate's curious outreach lead. StageGate handles robot logistics for trade shows in Las Vegas (receive, power-up, calibrate, demo support, ship home). Think like a human marketer who never stops improving — suggest concrete growth ideas, not generic advice. Return ONLY valid JSON.`,
        },
        {
          role: "user",
          content: `Pipeline snapshot:
- ${workflow.needsWebsite} prospects still need a website (junk cleanup)
- ${workflow.needsContactFix} need email enrichment
- ${workflow.needsDraft} ready for new drafts
- ${workflow.pendingReview} drafts awaiting review
- Bounce rate (7d): ${(bounceRate * 100).toFixed(1)}%

Suggest 2 LinkedIn/social post snippets (≤280 chars each), 2 newsletter subject+hook lines, 2 whitepaper/blog topics that position StageGate as the authority on robot show logistics, and 2 pipeline improvement notes Cal should act on next run.

JSON shape: { "socialPosts": [], "newsletterHooks": [], "whitepaperTopics": [], "pipelineNotes": [] }`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "cal_growth_brief",
          strict: true,
          schema: {
            type: "object",
            properties: {
              socialPosts: { type: "array", items: { type: "string" } },
              newsletterHooks: { type: "array", items: { type: "string" } },
              whitepaperTopics: { type: "array", items: { type: "string" } },
              pipelineNotes: { type: "array", items: { type: "string" } },
            },
            required: ["socialPosts", "newsletterHooks", "whitepaperTopics", "pipelineNotes"],
            additionalProperties: false,
          },
        },
      },
    });
    const raw = result.choices?.[0]?.message?.content;
    return JSON.parse(typeof raw === "string" ? raw : "{}") as CalOperatorResult["growthBrief"];
  } catch (err) {
    console.warn("[Cal operator] growth brief failed:", String(err));
    return undefined;
  }
}

export async function runCalOperatorCycle(opts?: {
  skipGrowthBrief?: boolean;
  /** Manual UI runs skip LLM redraft/generate — use Redraft emails button instead. */
  skipDraftRefresh?: boolean;
}): Promise<CalOperatorResult> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const errors: string[] = [];

  const junk = await dismissJunkProspectsBatch(db, BATCH * 2);

  let websitesResolved = 0;
  let websitesDismissed = 0;
  if (hunterEnabled()) {
    const urls = await resolveProspectWebsitesBatch(db, BATCH);
    websitesResolved = urls.resolved;
    websitesDismissed = urls.dismissed;
  } else {
    errors.push("HUNTER_API_KEY not set — skipped URL + email enrichment");
  }

  let emailsEnriched = 0;
  if (hunterEnabled()) {
    try {
      const enrich = await enrichProspectsBatch(db, BATCH);
      emailsEnriched = enrich.enriched;
    } catch (err) {
      errors.push(`enrich: ${String(err)}`);
    }
  }

  let draftsRedrafted = 0;
  let draftsGenerated = 0;
  if (opts?.skipDraftRefresh) {
    // Manual UI runs — user triggers Redraft emails separately.
  } else {
    try {
      const drafts = await refreshCalDraftsCore();
      draftsRedrafted = drafts.redrafted;
      draftsGenerated = drafts.generated;
      if (drafts.errors.length) errors.push(...drafts.errors.slice(0, 3));
    } catch (err) {
      errors.push(`drafts: ${String(err)}`);
    }
  }

  let quarantined = 0;
  let quarantineRecovered = 0;
  let quarantineUnresolved = 0;
  try {
    const q = await recoverQuarantinedProspectContacts(db, { limit: BATCH });
    quarantined = q.quarantined;
    quarantineRecovered = q.recovered;
    quarantineUnresolved = q.unresolved;
  } catch (err) {
    errors.push(`quarantine: ${String(err)}`);
  }

  const workflowAfter = await getCalWorkflowSummary();
  const bounce = await computeBounceStats(db);
  const growthBrief = opts?.skipGrowthBrief
    ? undefined
    : await generateCalGrowthBrief(workflowAfter, bounce.rate);

  console.log(
    `[Cal operator] junk=${junk.dismissed} urls=${websitesResolved} dismissed=${websitesDismissed} ` +
      `emails=${emailsEnriched} redraft=${draftsRedrafted} newDrafts=${draftsGenerated} ` +
      `quarantine=${quarantined} recovered=${quarantineRecovered} unresolved=${quarantineUnresolved}`,
  );

  return {
    junkDismissed: junk.dismissed,
    websitesResolved,
    websitesDismissed,
    emailsEnriched,
    draftsRedrafted,
    draftsGenerated,
    quarantined,
    quarantineRecovered,
    quarantineUnresolved,
    growthBrief,
    workflowAfter,
    errors,
  };
}

/** Persisted operator run — shared by cron handler and admin tRPC button. */
export async function executeCalOperatorRun(opts?: {
  skipGrowthBrief?: boolean;
  skipDraftRefresh?: boolean;
  notify?: boolean;
}): Promise<CalOperatorResult & { runId: number; startedAt: Date; completedAt: Date }> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const startedAt = new Date();
  const [run] = await db
    .insert(salesAgentRuns)
    .values({ runType: "operator", status: "running", startedAt })
    .returning();

  try {
    const result = await runCalOperatorCycle({
      skipGrowthBrief: opts?.skipGrowthBrief ?? false,
      skipDraftRefresh: opts?.skipDraftRefresh ?? false,
    });

    const completedAt = new Date();
    await db
      .update(salesAgentRuns)
      .set({
        status: "completed",
        completedAt,
        details: result as unknown as Record<string, unknown>,
      })
      .where(eq(salesAgentRuns.id, run.id));

    const brief = result.growthBrief;
    if (opts?.notify !== false && brief?.socialPosts?.length) {
      await notifyOwner({
        title: "Cal operator run — pipeline + growth ideas",
        content: [
          `Cleaned ${result.junkDismissed} junk · resolved ${result.websitesResolved} URLs · enriched ${result.emailsEnriched} emails · ${result.draftsGenerated} new drafts.`,
          "",
          "Social:",
          ...brief.socialPosts.map((s) => `• ${s}`),
          "",
          "Newsletter:",
          ...brief.newsletterHooks.map((s) => `• ${s}`),
          "",
          "Authority content:",
          ...brief.whitepaperTopics.map((s) => `• ${s}`),
        ].join("\n"),
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

export async function calOperatorHandler(req: Request, res: Response) {
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

  const db = await getDb();
  if (!db) return res.status(503).json({ error: "db unavailable" });

  try {
    // Cron runs: Relay loop (30 min later) sends the unified daily report.
    const result = await executeCalOperatorRun({ notify: !isCron });
    return res.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
}

/** Latest operator run for admin dashboard. */
export async function getLatestCalOperatorRun() {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(salesAgentRuns)
    .where(eq(salesAgentRuns.runType, "operator"))
    .orderBy(desc(salesAgentRuns.startedAt))
    .limit(1);
  return row ?? null;
}
