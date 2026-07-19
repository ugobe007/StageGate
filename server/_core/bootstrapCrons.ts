/**
 * Ensures project-level heartbeat jobs exist after deploy.
 * Idempotent — skips when task UID already in system_config.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { systemConfig } from "../../drizzle/schema";
import { createHeartbeatJob, type HeartbeatJob } from "./heartbeat";
import { ENV } from "./env";

export const RSS_INTELLIGENCE_JOB_KEY = "rss_intelligence_job_task_uid";
export const SALES_AGENT_DISCOVER_JOB_KEY = "sales_agent_discover_job_task_uid";
export const SALES_AGENT_INGEST_JOB_KEY = "sales_agent_ingest_job_task_uid";
export const CAL_OPERATOR_AM_JOB_KEY = "cal_operator_am_job_task_uid";
export const CAL_OPERATOR_PM_JOB_KEY = "cal_operator_pm_job_task_uid";
export const RELAY_LOOP_AM_JOB_KEY = "relay_loop_am_job_task_uid";
export const RELAY_LOOP_PM_JOB_KEY = "relay_loop_pm_job_task_uid";
export const SALES_AGENT_OUTREACH_AM_JOB_KEY = "sales_agent_outreach_am_job_task_uid";
export const SALES_AGENT_OUTREACH_PM_JOB_KEY = "sales_agent_outreach_pm_job_task_uid";
export const ENRICH_CONTACTS_JOB_KEY = "enrich_contacts_job_task_uid";
export const QUOTE_FOLLOWUP_JOB_KEY = "quote_followup_job_task_uid";
export const NATASHA_OPERATOR_JOB_KEY = "natasha_operator_job_task_uid";

/** Primary relay-loop key (AM run) — used for taskUid lookups. */
export const RELAY_LOOP_JOB_KEY = RELAY_LOOP_AM_JOB_KEY;

const PROJECT_CRONS: Array<{ key: string; job: HeartbeatJob }> = [
  {
    key: SALES_AGENT_DISCOVER_JOB_KEY,
    job: {
      name: "sales-agent-discover-daily",
      cron: "0 0 2 * * *",
      path: "/api/scheduled/sales-agent-discover",
      description: "Daily 02:00 UTC: discover new robot OEM prospects from show feeds",
    },
  },
  {
    key: SALES_AGENT_INGEST_JOB_KEY,
    job: {
      name: "sales-agent-ingest-daily",
      cron: "0 0 3 * * *",
      path: "/api/scheduled/sales-agent-ingest",
      description: "Daily 03:00 UTC: ingest discovered prospects into pipeline",
    },
  },
  {
    key: RSS_INTELLIGENCE_JOB_KEY,
    job: {
      name: "rss-intelligence-daily",
      cron: "0 0 4 * * *",
      path: "/api/scheduled/rss-intelligence",
      description: "Daily 04:00 UTC: poll RSS feeds for robot OEM + show ecosystem signals",
    },
  },
  {
    key: ENRICH_CONTACTS_JOB_KEY,
    job: {
      name: "enrich-contacts-daily",
      cron: "0 0 5 * * *",
      path: "/api/scheduled/enrich-contacts",
      description: "Daily 05:00 UTC: Hunter contact enrichment backfill",
    },
  },
  {
    key: QUOTE_FOLLOWUP_JOB_KEY,
    job: {
      name: "quote-followup-daily",
      cron: "0 0 9 * * *",
      path: "/api/scheduled/quote-followup",
      description: "Daily 09:00 UTC: follow up on bookings quoted 5+ days ago",
    },
  },
  {
    key: NATASHA_OPERATOR_JOB_KEY,
    job: {
      name: "natasha-operator-daily",
      cron: "0 0 11 * * *",
      path: "/api/scheduled/natasha-operator",
      description: "Daily 11:00 UTC: Natasha — signup funnel observe + growth brief",
    },
  },
  {
    key: CAL_OPERATOR_AM_JOB_KEY,
    job: {
      name: "cal-operator-am",
      cron: "0 0 10 * * *",
      path: "/api/scheduled/cal-operator",
      description: "Daily 10:00 UTC: Cal operator — OEM enrich, partner/vendor drafts, quarantine",
    },
  },
  {
    key: RELAY_LOOP_AM_JOB_KEY,
    job: {
      name: "relay-loop-am",
      cron: "0 30 10 * * *",
      path: "/api/scheduled/relay-loop",
      description: "Daily 10:30 UTC: Relay loop — observe, act, auto-send, daily report",
    },
  },
  {
    key: SALES_AGENT_OUTREACH_AM_JOB_KEY,
    job: {
      name: "sales-agent-outreach-am",
      cron: "0 0 14 * * *",
      path: "/api/scheduled/sales-agent-outreach",
      description: "Daily 14:00 UTC: Cal automated outreach batch",
    },
  },
  {
    key: SALES_AGENT_OUTREACH_PM_JOB_KEY,
    job: {
      name: "sales-agent-outreach-pm",
      cron: "0 0 18 * * *",
      path: "/api/scheduled/sales-agent-outreach",
      description: "Daily 18:00 UTC: Cal automated outreach batch",
    },
  },
  {
    key: CAL_OPERATOR_PM_JOB_KEY,
    job: {
      name: "cal-operator-pm",
      cron: "0 0 22 * * *",
      path: "/api/scheduled/cal-operator",
      description: "Daily 22:00 UTC: Cal operator — evening pipeline maintenance",
    },
  },
  {
    key: RELAY_LOOP_PM_JOB_KEY,
    job: {
      name: "relay-loop-pm",
      cron: "0 30 22 * * *",
      path: "/api/scheduled/relay-loop",
      description: "Daily 22:30 UTC: Relay loop — evening observe/act/report",
    },
  },
];

async function ensureCronJob(key: string, job: HeartbeatJob): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const existing = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, key))
    .limit(1);

  if (existing[0]?.value) {
    return existing[0].value;
  }

  const created = await createHeartbeatJob(job, "");
  await db
    .insert(systemConfig)
    .values({
      key,
      value: created.taskUid,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: systemConfig.key,
      set: { value: created.taskUid, updatedAt: new Date() },
    });

  console.log(
    `[bootstrapCrons] Created ${job.name}: ${created.taskUid} (next: ${created.nextExecutionAt ?? "unknown"})`,
  );
  return created.taskUid;
}

export async function getRegisteredCronKeys(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
): Promise<Set<string>> {
  const rows = await db.select().from(systemConfig);
  const cronKeys = new Set(PROJECT_CRONS.map((c) => c.key));
  const registered = new Set<string>();
  for (const row of rows) {
    if (cronKeys.has(row.key) && row.value?.trim()) {
      registered.add(row.key);
    }
  }
  return registered;
}

/** @deprecated Use bootstrapProjectCrons */
export async function ensureRssIntelligenceCron(): Promise<void> {
  await bootstrapProjectCrons();
}

export async function bootstrapProjectCrons(): Promise<void> {
  if (!ENV.isProduction) return;
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    console.warn("[bootstrapCrons] Skipping cron bootstrap — Forge API not configured");
    return;
  }

  const db = await getDb();
  if (!db) {
    console.warn("[bootstrapCrons] Skipping cron bootstrap — DB unavailable");
    return;
  }

  for (const { key, job } of PROJECT_CRONS) {
    try {
      await ensureCronJob(key, job);
    } catch (err) {
      console.error(`[bootstrapCrons] Failed to create ${job.name}:`, err);
    }
  }
}
