/**
 * Ensures project-level heartbeat jobs exist after deploy.
 * Idempotent — skips when task UID already in system_config.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { systemConfig } from "../../drizzle/schema";
import { createHeartbeatJob } from "./heartbeat";
import { ENV } from "./env";

export const RSS_INTELLIGENCE_JOB_KEY = "rss_intelligence_job_task_uid";

const RSS_CRON = "0 0 4 * * *"; // 04:00 UTC daily — after discovery (02:00) + ingest (03:00)

export async function ensureRssIntelligenceCron(): Promise<void> {
  if (!ENV.isProduction) return;
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    console.warn("[bootstrapCrons] Skipping RSS cron — Forge API not configured");
    return;
  }

  const db = await getDb();
  if (!db) {
    console.warn("[bootstrapCrons] Skipping RSS cron — DB unavailable");
    return;
  }

  const existing = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, RSS_INTELLIGENCE_JOB_KEY))
    .limit(1);

  if (existing[0]?.value) {
    console.log(`[bootstrapCrons] RSS intelligence cron already registered (${existing[0].value})`);
    return;
  }

  try {
    const job = await createHeartbeatJob(
      {
        name: "rss-intelligence-daily",
        cron: RSS_CRON,
        path: "/api/scheduled/rss-intelligence",
        description:
          "Daily 04:00 UTC: poll RSS feeds for robot OEM + show ecosystem signals, ingest prospects",
      },
      "", // project owner identity
    );

    await db
      .insert(systemConfig)
      .values({
        key: RSS_INTELLIGENCE_JOB_KEY,
        value: job.taskUid,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: { value: job.taskUid, updatedAt: new Date() },
      });

    console.log(
      `[bootstrapCrons] RSS intelligence cron created: ${job.taskUid} (next: ${job.nextExecutionAt ?? "unknown"})`,
    );
  } catch (err) {
    console.error("[bootstrapCrons] Failed to create RSS intelligence cron:", err);
  }
}

export async function bootstrapProjectCrons(): Promise<void> {
  await ensureRssIntelligenceCron();
}
