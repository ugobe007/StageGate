/**
 * Cal Operator — autonomous pipeline maintenance.
 *
 * Runs without human supervision:
 *   1. Dismiss junk exhibitor names (headlines, booth labels)
 *   2. Resolve websites via Hunter Domain Finder (Max)
 *   3. Enrich person-level emails via Hunter (Max)
 *   4. Redraft / create Cal email drafts
 *   5. Quarantine bounced addresses
 *
 * Growth briefs / signup experiments are owned by Natasha
 * (server/agents/natashaOperator.ts).
 *
 * Scheduled: POST /api/scheduled/cal-operator (cron, 2× daily)
 * AI org: docs/ai-org.md
 */

import type { Request, Response } from "express";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../db.js";
import { salesAgentRuns } from "../../drizzle/schema.js";
import { sdk } from "../_core/sdk.js";
import { notifyOwner } from "../_core/notification.js";
import { hunterEnabled } from "../integrations/hunter.js";
import {
  dismissJunkProspectsBatch,
  resolveProspectWebsitesBatch,
} from "./prospectWebsiteResolution.js";
import { enrichProspectsBatch, recoverQuarantinedProspectContacts } from "./prospectEnrichment.js";
import { refreshCalDraftsCore, getCalWorkflowSummary } from "./salesAgent.js";
import {
  getPartnerOutreachSummary,
  refreshPartnerOutreachDraftsCore,
} from "../services/partnerOutreach.js";

const BATCH = Number(process.env.CAL_OPERATOR_BATCH_SIZE) || 25;

export type CalOperatorResult = {
  junkDismissed: number;
  websitesResolved: number;
  websitesDismissed: number;
  emailsEnriched: number;
  draftsRedrafted: number;
  draftsGenerated: number;
  partnerDraftsGenerated: number;
  partnerOutreachAfter: Awaited<ReturnType<typeof getPartnerOutreachSummary>>;
  quarantined: number;
  quarantineRecovered: number;
  quarantineUnresolved: number;
  workflowAfter: Awaited<ReturnType<typeof getCalWorkflowSummary>>;
  errors: string[];
};

export async function runCalOperatorCycle(opts?: {
  /** Manual UI runs skip LLM redraft/generate — use Redraft emails button instead. */
  skipDraftRefresh?: boolean;
  /** @deprecated Growth briefs moved to Natasha — ignored. */
  skipGrowthBrief?: boolean;
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
  let partnerDraftsGenerated = 0;
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

    try {
      const partner = await refreshPartnerOutreachDraftsCore({ limit: BATCH });
      partnerDraftsGenerated = partner.drafted;
      if (partner.errors.length) errors.push(...partner.errors.slice(0, 2));
    } catch (err) {
      errors.push(`partner drafts: ${String(err)}`);
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
  const partnerOutreachAfter = await getPartnerOutreachSummary();

  let maxReadyForCal = 0;
  try {
    const { countMaxReadyForCal } = await import("./aiOrg.js");
    maxReadyForCal = await countMaxReadyForCal();
  } catch {
    /* non-fatal */
  }

  console.log(
    `[Cal operator] junk=${junk.dismissed} urls=${websitesResolved} dismissed=${websitesDismissed} ` +
      `emails=${emailsEnriched} (Max) redraft=${draftsRedrafted} newDrafts=${draftsGenerated} ` +
      `partnerDrafts=${partnerDraftsGenerated} ` +
      `quarantine=${quarantined} recovered=${quarantineRecovered} unresolved=${quarantineUnresolved} ` +
      `maxReadyForCal=${maxReadyForCal}`,
  );

  return {
    junkDismissed: junk.dismissed,
    websitesResolved,
    websitesDismissed,
    emailsEnriched,
    draftsRedrafted,
    draftsGenerated,
    partnerDraftsGenerated,
    partnerOutreachAfter,
    quarantined,
    quarantineRecovered,
    quarantineUnresolved,
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

    if (opts?.notify !== false) {
      await notifyOwner({
        title: "Cal operator run — pipeline",
        content: [
          `Cal: cleaned ${result.junkDismissed} junk · Max enriched ${result.emailsEnriched} emails · ${result.draftsGenerated} OEM drafts · ${result.partnerDraftsGenerated} partner drafts.`,
          `Quarantine recovered: ${result.quarantineRecovered}.`,
          "",
          "Growth ideas: see Natasha (marketing agent).",
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
