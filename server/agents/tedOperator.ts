/**
 * Ted Operator — performance / loop health.
 *
 * 1. Observe crons, bounce circuit, API keys, recent failed runs
 * 2. Grade loop health (green / yellow / red)
 * 3. Emit actionable recommendations
 * 4. Persist run; notify on standalone red/yellow runs
 *
 * Scheduled: POST /api/scheduled/ted-operator
 * Also invoked from Relay loop (owns health observation).
 */

import type { Request, Response } from "express";
import { and, count, desc, eq, gte, lt } from "drizzle-orm";
import { getDb } from "../db.js";
import { salesAgentRuns } from "../../drizzle/schema.js";
import { sdk } from "../_core/sdk.js";
import { notifyOwner } from "../_core/notification.js";
import {
  computeBounceStats,
  outreachDisabled,
} from "../outreachGate.js";
import { hunterEnabled } from "../integrations/hunter.js";
import { getRegisteredCronKeys } from "../_core/bootstrapCrons.js";
import { TED_PERSONA, TED_REPORT_TITLE } from "./tedPlaybook.js";

export const TED_EXPECTED_CRON_KEYS = [
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
  "natasha_operator_job_task_uid",
  "ted_operator_job_task_uid",
] as const;

export type TedHealthObservation = {
  outreachDisabled: boolean;
  hunterEnabled: boolean;
  forgeConfigured: boolean;
  resendConfigured: boolean;
  bounceRate: number;
  introsPaused: boolean;
  cronsRegistered: number;
  cronsMissing: string[];
  failedRunsLast24h: number;
  staleRunningRuns: number;
};

export type TedOperatorResult = {
  health: TedHealthObservation;
  grade: "green" | "yellow" | "red";
  recommendations: string[];
  errors: string[];
};

export async function observeTedHealth(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
): Promise<TedHealthObservation> {
  const bounce = await computeBounceStats(db);
  const registered = await getRegisteredCronKeys(db);
  const missing = TED_EXPECTED_CRON_KEYS.filter((k) => !registered.has(k));

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const staleBefore = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const [failedRow] = await db
    .select({ n: count() })
    .from(salesAgentRuns)
    .where(
      and(
        eq(salesAgentRuns.status, "failed"),
        gte(salesAgentRuns.startedAt, since),
      ),
    );

  const [staleRow] = await db
    .select({ n: count() })
    .from(salesAgentRuns)
    .where(
      and(
        eq(salesAgentRuns.status, "running"),
        lt(salesAgentRuns.startedAt, staleBefore),
      ),
    );

  return {
    outreachDisabled: outreachDisabled(),
    hunterEnabled: hunterEnabled(),
    forgeConfigured: Boolean(
      process.env.BUILT_IN_FORGE_API_URL && process.env.BUILT_IN_FORGE_API_KEY,
    ),
    resendConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
    bounceRate: bounce.rate,
    introsPaused: bounce.paused,
    cronsRegistered: registered.size,
    cronsMissing: missing,
    failedRunsLast24h: Number(failedRow?.n ?? 0),
    staleRunningRuns: Number(staleRow?.n ?? 0),
  };
}

export function gradeTedHealth(health: TedHealthObservation): "green" | "yellow" | "red" {
  if (!health.resendConfigured) return "red";
  if (health.introsPaused && health.bounceRate >= 0.1) return "yellow";
  if (health.cronsMissing.length > 3) return "red";
  if (health.cronsMissing.length > 0 || health.failedRunsLast24h >= 3) return "yellow";
  if (health.staleRunningRuns > 0) return "yellow";
  if (!health.forgeConfigured) return "yellow";
  return "green";
}

export function buildTedRecommendations(health: TedHealthObservation): string[] {
  const tips: string[] = [];
  if (!health.resendConfigured) {
    tips.push("Set RESEND_API_KEY on Railway — outbound email is down.");
  }
  if (health.introsPaused) {
    tips.push(
      `Circuit breaker open at ${(health.bounceRate * 100).toFixed(1)}% bounce — hold new intros; clean suppressions / Hunter floors.`,
    );
  }
  if (health.cronsMissing.length > 0) {
    tips.push(
      `Register missing crons (${health.cronsMissing.slice(0, 4).join(", ")}${health.cronsMissing.length > 4 ? "…" : ""}) via Relay bootstrap or Forge.`,
    );
  }
  if (!health.hunterEnabled) {
    tips.push("HUNTER_API_KEY missing — Max enrichment and Cal contact recovery are limited.");
  }
  if (!health.forgeConfigured) {
    tips.push("Forge API credentials missing — cron bootstrap and owner notify are limited.");
  }
  if (health.failedRunsLast24h >= 3) {
    tips.push(
      `${health.failedRunsLast24h} failed agent runs in 24h — check Admin → Agents run history.`,
    );
  }
  if (health.staleRunningRuns > 0) {
    tips.push(
      `${health.staleRunningRuns} run(s) stuck in "running" >2h — mark failed or investigate workers.`,
    );
  }
  if (health.outreachDisabled) {
    tips.push("OUTREACH_DISABLED is on — clear only when deliverability is green.");
  }
  if (tips.length === 0) {
    tips.push("Loop green — watch bounce rate and cron heartbeats; no action required.");
  }
  return tips.slice(0, 6);
}

export async function runTedCycle(): Promise<TedOperatorResult> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const errors: string[] = [];
  let health: TedHealthObservation;
  try {
    health = await observeTedHealth(db);
  } catch (err) {
    errors.push(`health: ${String(err)}`);
    health = {
      outreachDisabled: outreachDisabled(),
      hunterEnabled: hunterEnabled(),
      forgeConfigured: Boolean(
        process.env.BUILT_IN_FORGE_API_URL && process.env.BUILT_IN_FORGE_API_KEY,
      ),
      resendConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
      bounceRate: 0,
      introsPaused: false,
      cronsRegistered: 0,
      cronsMissing: [...TED_EXPECTED_CRON_KEYS],
      failedRunsLast24h: 0,
      staleRunningRuns: 0,
    };
  }

  const grade = gradeTedHealth(health);
  const recommendations = buildTedRecommendations(health);

  console.log(
    `[Ted] grade=${grade} bounce=${(health.bounceRate * 100).toFixed(1)}% ` +
      `crons=${health.cronsRegistered} missing=${health.cronsMissing.length} ` +
      `failed24h=${health.failedRunsLast24h}`,
  );

  return { health, grade, recommendations, errors };
}

export function formatTedReport(result: TedOperatorResult): string {
  const h = result.health;
  const lines = [
    `${TED_REPORT_TITLE} — ${result.grade.toUpperCase()}`,
    "",
    "Loop health",
    `• Outreach disabled: ${h.outreachDisabled ? "YES" : "no"}`,
    `• Circuit breaker: ${h.introsPaused ? "OPEN" : "closed"} (${(h.bounceRate * 100).toFixed(1)}% bounce)`,
    `• Crons registered: ${h.cronsRegistered} (${h.cronsMissing.length} missing)`,
    `• Failed runs (24h): ${h.failedRunsLast24h} · Stale running: ${h.staleRunningRuns}`,
    `• Hunter: ${h.hunterEnabled ? "on" : "OFF"} · Resend: ${h.resendConfigured ? "on" : "OFF"} · Forge: ${h.forgeConfigured ? "on" : "OFF"}`,
    "",
    "Recommendations",
    ...result.recommendations.map((r) => `• ${r}`),
  ];
  if (result.errors.length) {
    lines.push("", "Errors", ...result.errors.map((e) => `• ${e}`));
  }
  lines.push("", TED_PERSONA.signature);
  return lines.join("\n");
}

export async function executeTedRun(opts?: {
  notify?: boolean;
}): Promise<TedOperatorResult & { runId: number; startedAt: Date; completedAt: Date }> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const startedAt = new Date();
  const [run] = await db
    .insert(salesAgentRuns)
    .values({
      runType: "ted",
      status: "running",
      startedAt,
      details: { agent: "ted" },
    })
    .returning();

  try {
    const result = await runTedCycle();
    const completedAt = new Date();
    await db
      .update(salesAgentRuns)
      .set({
        status: "completed",
        completedAt,
        details: { agent: "ted", ...result } as unknown as Record<string, unknown>,
      })
      .where(eq(salesAgentRuns.id, run.id));

    const shouldNotify =
      opts?.notify !== false && (result.grade === "red" || result.grade === "yellow");
    if (shouldNotify) {
      await notifyOwner({
        title: TED_REPORT_TITLE,
        content: formatTedReport(result),
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

export async function tedOperatorHandler(req: Request, res: Response) {
  let isCron = false;
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron && user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    isCron = Boolean(user.isCron);
  } catch {
    return res.status(403).json({ error: "Invalid session" });
  }

  try {
    const result = await executeTedRun({ notify: !isCron });
    return res.json({ ok: true, agent: "ted", ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
}

export async function getLatestTedRun() {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(salesAgentRuns)
    .where(eq(salesAgentRuns.runType, "ted"))
    .orderBy(desc(salesAgentRuns.startedAt))
    .limit(1);
  return row ?? null;
}
