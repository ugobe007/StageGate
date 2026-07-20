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
import { salesAgentRuns } from "../../drizzle/schema.js";
import { sdk } from "../_core/sdk.js";
import { notifyOwner } from "../_core/notification.js";
import { runCalOperatorCycle } from "./calOperator.js";
import { getCalWorkflowSummary } from "./salesAgent.js";
import { getPartnerOutreachSummary } from "../services/partnerOutreach.js";
import {
  normalizeSuppressionEmails,
} from "../outreachGate.js";
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
import { bootstrapProjectCrons } from "../_core/bootstrapCrons.js";
import { countMaxReadyForCal } from "./aiOrg.js";
import { runNatashaCycle, type NatashaOperatorResult } from "./natashaOperator.js";
import {
  runTedCycle,
  type TedOperatorResult,
} from "./tedOperator.js";

export type RelayHealthObservation = TedOperatorResult["health"];

export type RelayOperatorResult = {
  stepsCompleted: RelayLoopStep[];
  health: RelayHealthObservation;
  ted: TedOperatorResult;
  calOperator: Awaited<ReturnType<typeof runCalOperatorCycle>>;
  natasha: NatashaOperatorResult;
  autoSend: Awaited<ReturnType<typeof executeRelayAutoSend>>;
  staleDraftsDiscarded: number;
  suppressionsNormalized: number;
  cronsBootstrapped: boolean;
  conversion: ConversionSnapshot;
  missions: RelayMission[];
  workflowAfter: Awaited<ReturnType<typeof getCalWorkflowSummary>>;
  maxReadyForCal: number;
  escalations: string[];
  learnings: string;
  errors: string[];
};

type RelayOperatorCore = Omit<RelayOperatorResult, "learnings" | "escalations">;

function buildLearnings(result: RelayOperatorCore): string {
  const parts: string[] = [];
  parts.push(
    `Max enriched ${result.calOperator.emailsEnriched} contacts; Cal generated ${result.calOperator.draftsGenerated} OEM drafts and ${result.calOperator.partnerDraftsGenerated} partner drafts (junk cleaned: ${result.calOperator.junkDismissed}).`,
  );
  if (result.maxReadyForCal > 0) {
    parts.push(`Max→Cal queue: ${result.maxReadyForCal} ready.`);
  }
  if (result.natasha.brief?.uiExperiments?.length) {
    parts.push(`Natasha proposed ${result.natasha.brief.uiExperiments.length} UI experiment(s).`);
  } else if (result.natasha.funnel.usersLast7d + result.natasha.funnel.newsletterLast7d > 0) {
    parts.push(
      `Natasha funnel: +${result.natasha.funnel.usersLast7d} users, +${result.natasha.funnel.newsletterLast7d} newsletter.`,
    );
  }
  if (result.ted.grade !== "green") {
    parts.push(`Ted grade ${result.ted.grade}: ${result.ted.recommendations[0] ?? "needs attention"}.`);
  }
  if (result.autoSend.sent > 0) {
    parts.push(`Cal auto-sent ${result.autoSend.sent} safe draft(s).`);
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
  if (result.natasha.errors.length > 0) {
    items.push(`Natasha errors: ${result.natasha.errors.slice(0, 2).join("; ")}`);
  }
  if (result.ted.errors.length > 0) {
    items.push(`Ted errors: ${result.ted.errors.slice(0, 2).join("; ")}`);
  }
  if (result.ted.grade === "red") {
    items.push(`Ted grade RED: ${result.ted.recommendations[0] ?? "loop unhealthy"}`);
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
  const brief = result.natasha.brief;
  const funnel = result.natasha.funnel;

  const lines = [
    `${RELAY_REPORT_TITLE} — ${statusLabel}`,
    "",
    "Health (Ted)",
    `• Grade: ${result.ted.grade.toUpperCase()}`,
    `• Outreach disabled: ${result.health.outreachDisabled ? "YES" : "no"}`,
    `• Circuit breaker: ${result.health.introsPaused ? "OPEN" : "closed"} (${(result.health.bounceRate * 100).toFixed(1)}% bounce)`,
    `• Crons registered: ${result.health.cronsRegistered} (${result.health.cronsMissing.length} missing)`,
    `• Failed runs (24h): ${result.health.failedRunsLast24h} · Stale running: ${result.health.staleRunningRuns}`,
    ...result.ted.recommendations.slice(0, 3).map((r) => `• Rec: ${r}`),
    "",
    "Actions taken",
    `• Max: ${result.calOperator.emailsEnriched} enriched, ${result.calOperator.quarantineRecovered} quarantine recovered · ready for Cal: ${result.maxReadyForCal}`,
    `• Cal: ${result.calOperator.draftsGenerated} OEM drafts, ${result.calOperator.partnerDraftsGenerated} partner drafts, junk cleaned ${result.calOperator.junkDismissed}`,
    `• Natasha: users +${funnel.usersLast7d}, newsletter +${funnel.newsletterLast7d}, profiles +${funnel.companyProfilesLast7d}`,
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

  if (brief?.socialPosts?.length || brief?.uiExperiments?.length) {
    lines.push("", "Growth (Natasha)");
    if (brief.socialPosts?.length) {
      lines.push(...brief.socialPosts.slice(0, 2).map((s) => `• Social: ${s}`));
    }
    if (brief.newsletterHooks?.length) {
      lines.push(...brief.newsletterHooks.slice(0, 1).map((s) => `• Newsletter: ${s}`));
    }
    if (brief.uiExperiments?.length) {
      lines.push(...brief.uiExperiments.slice(0, 2).map((s) => `• UI: ${s}`));
    }
    if (brief.signupNudges?.length) {
      lines.push(...brief.signupNudges.slice(0, 1).map((s) => `• Signup: ${s}`));
    }
  }

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

  // OBSERVE — Ted owns loop health
  stepsCompleted.push("observe");
  let ted: TedOperatorResult;
  try {
    ted = await runTedCycle();
  } catch (err) {
    errors.push(`ted: ${String(err)}`);
    ted = {
      health: {
        outreachDisabled: false,
        hunterEnabled: false,
        forgeConfigured: false,
        resendConfigured: false,
        bounceRate: 0,
        introsPaused: false,
        cronsRegistered: 0,
        cronsMissing: [],
        failedRunsLast24h: 0,
        staleRunningRuns: 0,
      },
      grade: "red",
      recommendations: [`Ted cycle failed: ${String(err)}`],
      errors: [String(err)],
    };
  }
  const health = ted.health;
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
      partnerOutreachAfter: partnerOutreachBefore,
      quarantined: 0,
      quarantineRecovered: 0,
      quarantineUnresolved: 0,
      workflowAfter: workflowBefore,
      errors: [],
    };
  } else {
    try {
      calOperator = await runCalOperatorCycle();
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
        partnerOutreachAfter: partnerOutreachBefore,
        quarantined: 0,
        quarantineRecovered: 0,
        quarantineUnresolved: 0,
        workflowAfter: workflowBefore,
        errors: [String(err)],
      };
    }
  }

  // Natasha — growth observe + brief (priority 6; still runs so funnel is always visible)
  let natasha: NatashaOperatorResult;
  try {
    const skipBrief =
      health.introsPaused ||
      !health.resendConfigured ||
      health.cronsMissing.length > 3;
    natasha = await runNatashaCycle({ skipBrief });
  } catch (err) {
    errors.push(`natasha: ${String(err)}`);
    natasha = {
      funnel: {
        usersLast7d: conversion.usersLast7d,
        usersTotal: conversion.usersTotal,
        newsletterLast7d: 0,
        newsletterTotal: 0,
        companyProfilesLast7d: 0,
        demosLast7d: conversion.demosLast7d,
        demosPending: conversion.demosPending,
        quotesLast7d: conversion.quotesLast7d,
        quotesPending: conversion.quotesPending,
      },
      errors: [String(err)],
    };
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
  let maxReadyForCal = 0;
  try {
    maxReadyForCal = await countMaxReadyForCal();
  } catch (err) {
    errors.push(`max ready queue: ${String(err)}`);
  }

  const partial: RelayOperatorCore = {
    stepsCompleted,
    health,
    ted,
    calOperator,
    natasha,
    autoSend,
    staleDraftsDiscarded,
    suppressionsNormalized,
    cronsBootstrapped,
    conversion,
    missions,
    workflowAfter,
    maxReadyForCal,
    errors: [...errors, ...calOperator.errors, ...natasha.errors, ...ted.errors, ...autoSend.errors],
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