/**
 * Relay Operator — autonomous loop orchestrator for StageGate.
 *
 * Daily loop: Observe → Orient → Decide → Act → Verify → Learn → Notify
 *
 * Scheduled: POST /api/scheduled/relay-loop (cron, 2× daily)
 */

import type { Request, Response } from "express";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../db.js";
import { salesAgentRuns, systemConfig } from "../../drizzle/schema.js";
import { sdk } from "../_core/sdk.js";
import { notifyOwner } from "../_core/notification.js";
import { runCalOperatorCycle } from "./calOperator.js";
import { getCalWorkflowSummary } from "./salesAgent.js";
import { getPartnerOutreachSummary } from "../services/partnerOutreach.js";
import {
  computeBounceStats,
  normalizeSuppressionEmails,
  outreachDisabled,
} from "../outreachGate.js";
import { hunterEnabled } from "../integrations/hunter.js";
import { executeRelayAutoSend, discardStaleDrafts } from "./relayAutoSend.js";
import {
  getConversionSnapshot,
  prioritizeMissions,
  type ConversionSnapshot,
  type RelayMission,
} from "./relayConversion.js";
import {
  RELAY_REPORT_TITLE,
  RELAY_PERSONA,
  type RelayLoopStep,
} from "./relayPlaybook.js";
import {
  bootstrapProjectCrons,
  getRegisteredCronKeys,
} from "../_core/bootstrapCrons.js";

export type RelayHealthObservation = {
  outreachDisabled: boolean;
  hunterEnabled: boolean;
  forgeConfigured: boolean;
  resendConfigured: boolean;
  bounceRate: number;
  introsPaused: boolean;
  cronsRegistered: number;
  cronsMissing: string[];
};

export type RelayOperatorResult = {
  stepsCompleted: RelayLoopStep[];
  health: RelayHealthObservation;
  calOperator: Awaited<ReturnType<typeof runCalOperatorCycle>>;
  autoSend: Awaited<ReturnType<typeof executeRelayAutoSend>>;
  staleDraftsDiscarded: number;
  suppressionsNormalized: number;
  cronsBootstrapped: boolean;
  conversion: ConversionSnapshot;
  missions: RelayMission[];
  workflowAfter: Awaited<ReturnType<typeof getCalWorkflowSummary>>;
  escalations: string[];
  learnings: string;
  errors: string[];
};

async function observeHealth(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<RelayHealthObservation> {
  const bounce = await computeBounceStats(db);
  const registered = await getRegisteredCronKeys(db);
  const expectedKeys = [
    "sales_agent_discover_job_task_uid",
    "sales_agent_ingest_job_task_uid",
    "rss_intelligence_job_task_uid",
    "cal_operator_am_job_task_uid",
    "cal_operator_pm_job_task_uid",
    "relay_loop_am_job_task_uid",
    "relay_loop_pm_job_task_uid",
    "sales_agent_outreach_am_job_task_uid",
    "sales_agent_outreach_pm_job_task_uid",
    "enrich_contacts_job_task_uid",
    "quote_followup_job_task_uid",
  ];
  const missing = expectedKeys.filter((k) => !registered.has(k));

  return {
    outreachDisabled: outreachDisabled(),
    hunterEnabled: hunterEnabled(),
    forgeConfigured: Boolean(process.env.BUILT_IN_FORGE_API_URL && process.env.BUILT_IN_FORGE_API_KEY),
    resendConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
    bounceRate: bounce.rate,
    introsPaused: bounce.paused,
    cronsRegistered: registered.size,
    cronsMissing: missing,
  };
}

type RelayOperatorCore = Omit<RelayOperatorResult, "learnings" | "escalations">;

function buildLearnings(result: RelayOperatorCore): string {
  const parts: string[] = [];
  parts.push(
    `Cal cleaned ${result.calOperator.junkDismissed} junk, enriched ${result.calOperator.emailsEnriched} emails, generated ${result.calOperator.draftsGenerated} OEM drafts and ${result.calOperator.partnerDraftsGenerated} partner drafts.`,
  );
  if (result.autoSend.sent > 0) {
    parts.push(`Auto-sent ${result.autoSend.sent} safe draft(s).`);
  }
  if (result.staleDraftsDiscarded > 0) {
    parts.push(`Discarded ${result.staleDraftsDiscarded} stale draft(s).`);
  }
  if (result.health.introsPaused) {
    parts.push("Circuit breaker still open — new intros held.");
  } else if (result.autoSend.skipped > 0) {
    parts.push(`${result.autoSend.skipped} draft(s) skipped by policy (review queue).`);
  }
  if (result.missions[0]) {
    parts.push(`Top mission: ${result.missions[0].title}.`);
  }
  return parts.join(" ");
}

function buildEscalations(result: RelayOperatorCore): string[] {
  const items: string[] = [];
  if (result.health.introsPaused && result.health.bounceRate >= 0.1) {
    items.push(
      `Deliverability: bounce rate ${(result.health.bounceRate * 100).toFixed(1)}% — circuit breaker open.`,
    );
  }
  if (!result.health.resendConfigured) {
    items.push("Infrastructure: RESEND_API_KEY not configured — email cannot send.");
  }
  if (!result.health.forgeConfigured) {
    items.push("Infrastructure: Forge API not configured — cron bootstrap and owner notifications limited.");
  }
  if (result.conversion.quotesPending + result.conversion.demosPending > 5) {
    items.push(
      `${result.conversion.demosPending} demo(s) + ${result.conversion.quotesPending} quote(s) pending human response.`,
    );
  }
  if (result.calOperator.errors.length > 0) {
    items.push(`Cal operator errors: ${result.calOperator.errors.slice(0, 2).join("; ")}`);
  }
  if (result.autoSend.errors.length > 0) {
    items.push(`Auto-send failures: ${result.autoSend.errors.slice(0, 2).join("; ")}`);
  }
  return items;
}

function healthStatus(result: RelayOperatorResult): "green" | "yellow" | "red" {
  if (result.escalations.some((e) => e.includes("RESEND_API_KEY") || e.includes("bounce rate"))) {
    return result.health.introsPaused ? "yellow" : "red";
  }
  if (result.escalations.length > 0 || result.health.cronsMissing.length > 0) return "yellow";
  return "green";
}

export function formatRelayDailyReport(result: RelayOperatorResult): string {
  const status = healthStatus(result);
  const statusLabel = status.toUpperCase();
  const w = result.workflowAfter;

  const lines = [
    `${RELAY_REPORT_TITLE} — ${statusLabel}`,
    "",
    "Health",
    `• Outreach disabled: ${result.health.outreachDisabled ? "YES" : "no"}`,
    `• Circuit breaker: ${result.health.introsPaused ? "OPEN" : "closed"} (${(result.health.bounceRate * 100).toFixed(1)}% bounce)`,
    `• Crons registered: ${result.health.cronsRegistered} (${result.health.cronsMissing.length} missing)`,
    "",
    "Actions taken",
    `• Cal operator: ${result.calOperator.emailsEnriched} enriched, ${result.calOperator.draftsGenerated} OEM drafts, ${result.calOperator.partnerDraftsGenerated} partner drafts, ${result.calOperator.quarantineRecovered} quarantine recovered`,
    `• Auto-send: ${result.autoSend.sent} sent / ${result.autoSend.skipped} skipped / ${result.autoSend.failed} failed`,
    `• Stale drafts discarded: ${result.staleDraftsDiscarded}`,
    `• Suppressions normalized: ${result.suppressionsNormalized}`,
    "",
    "Pipeline (OEM)",
    `• Needs contact fix: ${w.needsContactFix} · Needs draft: ${w.needsDraft} · Pending review: ${w.pendingReview}`,
    `• Awaiting reply: ${w.awaitingReply} · Follow-ups due: ${w.followUpDue}`,
    "",
    "Pipeline (partners)",
    `• Pending review: ${result.calOperator.partnerOutreachAfter.pendingReview} · Needs draft: ${result.calOperator.partnerOutreachAfter.needsDraft} · With email: ${result.calOperator.partnerOutreachAfter.withEmail}`,
    "",
    "Conversion (7d)",
    `• Users +${result.conversion.usersLast7d} · Demos +${result.conversion.demosLast7d} · Quotes +${result.conversion.quotesLast7d}`,
    `• Scheduled prospects: ${result.conversion.prospectsScheduled} · Converted: ${result.conversion.prospectsConverted}`,
    "",
    "Top missions",
    ...result.missions.map((m, i) => `${i + 1}. [${m.priority}] ${m.title} — ${m.detail}`),
  ];

  if (result.escalations.length > 0) {
    lines.push("", "Escalations (human attention)", ...result.escalations.map((e) => `• ${e}`));
  }

  lines.push("", "Learnings", result.learnings, "", RELAY_PERSONA.signature);
  return lines.join("\n");
}

export async function runRelayLoop(opts?: {
  skipNotify?: boolean;
  skipCalOperator?: boolean;
}): Promise<RelayOperatorResult> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const stepsCompleted: RelayLoopStep[] = [];
  const errors: string[] = [];

  // OBSERVE
  stepsCompleted.push("observe");
  const health = await observeHealth(db);
  const workflowBefore = await getCalWorkflowSummary();
  const partnerOutreachBefore = await getPartnerOutreachSummary();
  const conversion = await getConversionSnapshot(db);

  // ORIENT + DECIDE
  stepsCompleted.push("orient", "decide");
  const missions = prioritizeMissions({
    conversion,
    workflow: workflowBefore,
    partnerOutreach: partnerOutreachBefore,
    introsPaused: health.introsPaused,
    hunterEnabled: health.hunterEnabled,
    cronsMissing: health.cronsMissing,
    pendingDemos: conversion.demosPending,
    pendingQuotes: conversion.quotesPending,
  });

  // ACT
  stepsCompleted.push("act");
  let cronsBootstrapped = false;
  try {
    await bootstrapProjectCrons();
    cronsBootstrapped = true;
  } catch (err) {
    errors.push(`cron bootstrap: ${String(err)}`);
  }

  let calOperator: Awaited<ReturnType<typeof runCalOperatorCycle>>;
  if (opts?.skipCalOperator) {
    calOperator = {
      junkDismissed: 0,
      websitesResolved: 0,
      websitesDismissed: 0,
      emailsEnriched: 0,
      draftsRedrafted: 0,
      draftsGenerated: 0,
      partnerDraftsGenerated: 0,
      partnerEnrichmentStarted: 0,
      partnerOutreachAfter: partnerOutreachBefore,
      quarantined: 0,
      quarantineRecovered: 0,
      quarantineUnresolved: 0,
      workflowAfter: workflowBefore,
      errors: [],
    };
  } else {
    try {
      calOperator = await runCalOperatorCycle({ skipGrowthBrief: true });
    } catch (err) {
      errors.push(`cal operator: ${String(err)}`);
      calOperator = {
        junkDismissed: 0,
        websitesResolved: 0,
        websitesDismissed: 0,
        emailsEnriched: 0,
        draftsRedrafted: 0,
        draftsGenerated: 0,
        partnerDraftsGenerated: 0,
        partnerEnrichmentStarted: 0,
        partnerOutreachAfter: partnerOutreachBefore,
        quarantined: 0,
        quarantineRecovered: 0,
        quarantineUnresolved: 0,
        workflowAfter: workflowBefore,
        errors: [String(err)],
      };
    }
  }

  let suppressionsNormalized = 0;
  try {
    suppressionsNormalized = await normalizeSuppressionEmails(db);
  } catch (err) {
    errors.push(`suppressions: ${String(err)}`);
  }

  let staleDraftsDiscarded = 0;
  try {
    const stale = await discardStaleDrafts(db);
    staleDraftsDiscarded = stale.discarded;
  } catch (err) {
    errors.push(`stale drafts: ${String(err)}`);
  }

  let autoSend: Awaited<ReturnType<typeof executeRelayAutoSend>>;
  try {
    autoSend = await executeRelayAutoSend(db);
  } catch (err) {
    errors.push(`auto-send: ${String(err)}`);
    autoSend = { attempted: 0, sent: 0, skipped: 0, failed: 0, decisions: [], errors: [String(err)] };
  }

  // VERIFY
  stepsCompleted.push("verify");
  const workflowAfter = await getCalWorkflowSummary();

  const partial: RelayOperatorCore = {
    stepsCompleted,
    health,
    calOperator,
    autoSend,
    staleDraftsDiscarded,
    suppressionsNormalized,
    cronsBootstrapped,
    conversion,
    missions,
    workflowAfter,
    errors: [...errors, ...calOperator.errors, ...autoSend.errors],
  };

  const escalations = buildEscalations(partial);
  const learnings = buildLearnings(partial);

  // LEARN + NOTIFY
  stepsCompleted.push("learn");

  const result: RelayOperatorResult = {
    ...partial,
    escalations,
    learnings,
  };

  if (!opts?.skipNotify) {
    stepsCompleted.push("notify");
    const report = formatRelayDailyReport(result);
    await notifyOwner({
      title: `${RELAY_REPORT_TITLE} — ${healthStatus(result).toUpperCase()}`,
      content: report,
    }).catch(() => {});
  }

  console.log(
    `[Relay] status=${healthStatus(result)} sent=${autoSend.sent} missions=${missions.length} escalations=${escalations.length}`,
  );

  return result;
}

export async function executeRelayRun(opts?: {
  skipNotify?: boolean;
  skipCalOperator?: boolean;
}): Promise<RelayOperatorResult & { runId: number; startedAt: Date; completedAt: Date }> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const startedAt = new Date();
  const [run] = await db
    .insert(salesAgentRuns)
    .values({ runType: "relay", status: "running", startedAt })
    .returning();

  try {
    const result = await runRelayLoop(opts);
    const completedAt = new Date();
    await db
      .update(salesAgentRuns)
      .set({
        status: "completed",
        completedAt,
        emailsSent: result.autoSend.sent,
        details: result as unknown as Record<string, unknown>,
      })
      .where(eq(salesAgentRuns.id, run.id));

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

export async function relayLoopHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron && user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
  } catch {
    return res.status(403).json({ error: "Invalid session" });
  }

  const db = await getDb();
  if (!db) return res.status(503).json({ error: "db unavailable" });

  try {
    const result = await executeRelayRun({ skipNotify: false });
    return res.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
}

export async function getLatestRelayRun() {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(salesAgentRuns)
    .where(eq(salesAgentRuns.runType, "relay"))
    .orderBy(desc(salesAgentRuns.startedAt))
    .limit(1);
  return row ?? null;
}