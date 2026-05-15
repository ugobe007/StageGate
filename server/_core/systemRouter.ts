import { z } from "zod";
import { parse as parseCookie } from "cookie";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import {
  createHeartbeatJob,
  updateHeartbeatJob,
  listHeartbeatJobs,
} from "./heartbeat";
import { COOKIE_NAME } from "../../shared/const";
import { getDb } from "../db";
import { systemConfig } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Key used to store the quote follow-up job task UID in system_config
const QUOTE_FOLLOWUP_JOB_KEY = "quote_followup_job_task_uid";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  // ── v25: Quote Follow-Up Heartbeat Job Management ─────────────────────────

  /**
   * Create the daily quote follow-up heartbeat job (runs at 09:00 UTC).
   * Persists the returned taskUid to system_config for future pause/resume.
   * Idempotent: if a job already exists, returns its existing taskUid.
   */
  createQuoteFollowUpJob: adminProcedure
    .mutation(async ({ ctx }) => {
      const dbConn = await getDb();
      if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Check if a job already exists
      const existing = await dbConn
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.key, QUOTE_FOLLOWUP_JOB_KEY))
        .limit(1);

      if (existing[0]) {
        return {
          created: false,
          taskUid: existing[0].value,
          message: "Job already exists. Use getQuoteFollowUpJobStatus to check its state.",
        };
      }

      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      if (!sessionToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "No session token" });

      const job = await createHeartbeatJob(
        {
          name: "quote-followup-daily",
          cron: "0 0 9 * * *", // 09:00 UTC daily
          path: "/api/scheduled/quote-followup",
          description: "Daily 09:00 UTC: send follow-up emails to bookings quoted 5+ days ago with no response",
        },
        sessionToken
      );

      // Persist taskUid to system_config
      await dbConn
        .insert(systemConfig)
        .values({
          key: QUOTE_FOLLOWUP_JOB_KEY,
          value: job.taskUid,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemConfig.key,
          set: { value: job.taskUid, updatedAt: new Date() },
        });

      return {
        created: true,
        taskUid: job.taskUid,
        nextExecutionAt: job.nextExecutionAt,
        message: "Quote follow-up job created. Runs daily at 09:00 UTC.",
      };
    }),

  /**
   * Get the current status of the quote follow-up heartbeat job.
   * Returns job info (enabled, nextRun, lastRun) from the Forge SDK.
   */
  getQuoteFollowUpJobStatus: adminProcedure
    .query(async ({ ctx }) => {
      const dbConn = await getDb();
      if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const row = await dbConn
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.key, QUOTE_FOLLOWUP_JOB_KEY))
        .limit(1);

      if (!row[0]) {
        return { exists: false, taskUid: null, job: null };
      }

      const taskUid = row[0].value;
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      if (!sessionToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "No session token" });

      try {
        const { jobs } = await listHeartbeatJobs(sessionToken);
        const job = jobs.find(j => j.taskUid === taskUid) ?? null;
        return { exists: true, taskUid, job };
      } catch {
        // If listing fails (e.g. job deleted externally), return minimal info
        return { exists: true, taskUid, job: null };
      }
    }),

  /**
   * Pause the quote follow-up heartbeat job.
   */
  pauseQuoteFollowUpJob: adminProcedure
    .mutation(async ({ ctx }) => {
      const dbConn = await getDb();
      if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const row = await dbConn
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.key, QUOTE_FOLLOWUP_JOB_KEY))
        .limit(1);

      if (!row[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Quote follow-up job not found. Create it first." });

      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      if (!sessionToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "No session token" });

      await updateHeartbeatJob(row[0].value, { enable: false }, sessionToken);
      return { paused: true, taskUid: row[0].value };
    }),

  /**
   * Resume the quote follow-up heartbeat job.
   */
  resumeQuoteFollowUpJob: adminProcedure
    .mutation(async ({ ctx }) => {
      const dbConn = await getDb();
      if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const row = await dbConn
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.key, QUOTE_FOLLOWUP_JOB_KEY))
        .limit(1);

      if (!row[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Quote follow-up job not found. Create it first." });

      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      if (!sessionToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "No session token" });

      await updateHeartbeatJob(row[0].value, { enable: true }, sessionToken);
      return { resumed: true, taskUid: row[0].value };
    }),
});
