/**
 * server/workflows.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Smart DB workflow helpers used by tRPC procedures, AI agents, and XBOT.
 * All functions operate against Supabase Postgres via getDb().
 *
 * Conventions:
 *  - Lookup helpers return typed rows or null/[]
 *  - Workflow helpers encapsulate multi-step operations and return a result summary
 *  - All helpers are safe to call from any agent or procedure
 */

import { eq, desc, and, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  prospects,
  tradeShows,
  services,
  logisticsPartners,
  xbotProjects,
  xbotLogisticsBriefs,
  agentRuns,
  outreachCampaigns,
  users,
  Prospect,
  InsertProspect,
} from "../drizzle/schema";

// ─── Database Health ──────────────────────────────────────────────────────────

export interface DbHealthResult {
  connected: boolean;
  backend: "supabase" | "unknown";
  tables: Record<string, number>;
  checkedAt: Date;
}

export async function getDbHealth(): Promise<DbHealthResult> {
  const db = await getDb();
  const backend = process.env.SUPABASE_DATABASE_URL ? "supabase" : "unknown";
  if (!db) {
    return { connected: false, backend, tables: {}, checkedAt: new Date() };
  }
  try {
    const tableNames = [
      "prospects", "trade_shows", "services", "logistics_partners",
      "xbot_projects", "agent_runs", "outreach_campaigns", "users",
    ] as const;
    const counts: Record<string, number> = {};
    for (const t of tableNames) {
      const res = await db.execute(sql`SELECT COUNT(*) as cnt FROM ${sql.identifier(t)}`);
      const rows = res as unknown as Array<{ cnt: string | number }>;
      counts[t] = Number(rows[0]?.cnt ?? 0);
    }
    return { connected: true, backend, tables: counts, checkedAt: new Date() };
  } catch (err) {
    return { connected: false, backend, tables: {}, checkedAt: new Date() };
  }
}

// ─── Prospect Lookups ─────────────────────────────────────────────────────────

export async function getProspectsByStatus(status: string): Promise<Prospect[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(prospects)
    .where(eq(prospects.status, status as Prospect["status"]))
    .orderBy(desc(prospects.updatedAt));
}

export async function getProspectsByShow(showName: string): Promise<Prospect[]> {
  const db = await getDb();
  if (!db) return [];
  // shows is a jsonb array of show name strings — use Postgres @> operator
  const rows = await db.execute(
    sql`SELECT * FROM prospects WHERE shows @> ${JSON.stringify([showName])}::jsonb ORDER BY "createdAt" DESC`
  );
  return rows as unknown as Prospect[];
}

export async function getProspectsForOutreach(): Promise<Prospect[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(prospects)
    .where(
      and(
        inArray(prospects.status, ["new", "contacted"]),
        isNotNull(prospects.contactEmail)
      )
    )
    .orderBy(desc(prospects.createdAt));
}

export async function getOverdueFollowUps(): Promise<Prospect[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(prospects)
    .where(
      and(
        isNotNull(prospects.followUpDate),
        lte(prospects.followUpDate, new Date()),
        inArray(prospects.status, ["new", "contacted", "responded", "scheduled"])
      )
    )
    .orderBy(prospects.followUpDate);
}

export async function getProspectWithHistory(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [prospect] = await db.select().from(prospects).where(eq(prospects.id, id));
  if (!prospect) return null;
  const campaigns = await db
    .select()
    .from(outreachCampaigns)
    .where(eq(outreachCampaigns.prospectId, id))
    .orderBy(desc(outreachCampaigns.createdAt));
  return { prospect, campaigns };
}

// ─── Trade Show Lookups ───────────────────────────────────────────────────────

export async function getUpcomingShows(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(tradeShows)
    .where(
      and(
        eq(tradeShows.status, "upcoming"),
        sql`"startDate" > NOW()`
      )
    )
    .orderBy(tradeShows.startDate)
    .limit(limit);
}

export async function getShowWithProspects(showId: number) {
  const db = await getDb();
  if (!db) return null;
  const [show] = await db.select().from(tradeShows).where(eq(tradeShows.id, showId));
  if (!show) return null;
  // Prospects that list this show
  const showProspects = await db.execute(
    sql`SELECT * FROM prospects WHERE shows @> ${JSON.stringify([show.name])}::jsonb ORDER BY status`
  );
  return { show, prospects: showProspects as unknown as Prospect[] };
}

// ─── XBOT Workflow Helpers ────────────────────────────────────────────────────

export async function getXbotProjectWithBrief(projectId: number) {
  const db = await getDb();
  if (!db) return null;
  const [project] = await db.select().from(xbotProjects).where(eq(xbotProjects.id, projectId));
  if (!project) return null;
  const [brief] = await db
    .select()
    .from(xbotLogisticsBriefs)
    .where(eq(xbotLogisticsBriefs.projectId, projectId));
  return { project, brief: brief ?? null };
}

export async function getActiveXbotProjects() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(xbotProjects)
    .where(inArray(xbotProjects.status, ["draft", "brief_generated", "submitted", "in_review"]))
    .orderBy(desc(xbotProjects.updatedAt));
}

// ─── Service Lookup ───────────────────────────────────────────────────────────

export async function getServiceCatalog() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(services)
    .where(eq(services.isActive, true))
    .orderBy(services.sortOrder, services.category);
}

export async function getLogisticsPartnersByType(serviceType?: string) {
  const db = await getDb();
  if (!db) return [];
  if (serviceType) {
    return db
      .select()
      .from(logisticsPartners)
      .where(
        and(
          eq(logisticsPartners.isActive, true),
          eq(logisticsPartners.serviceType, serviceType)
        )
      )
      .orderBy(logisticsPartners.name);
  }
  return db
    .select()
    .from(logisticsPartners)
    .where(eq(logisticsPartners.isActive, true))
    .orderBy(logisticsPartners.serviceType, logisticsPartners.name);
}

// ─── Agent Run Workflow ───────────────────────────────────────────────────────

export interface AgentRunContext {
  agentName: string;
  triggeredBy?: string;
  inputSummary?: string;
}

/**
 * Wraps an async agent task with automatic run logging to Supabase.
 * Usage:
 *   const result = await withAgentRun({ agentName: "XBOT Outreach" }, async (runId) => {
 *     // do work, runId is available for progress updates
 *     return { sent: 5 };
 *   });
 */
export async function withAgentRun<T>(
  ctx: AgentRunContext,
  fn: (runId: number) => Promise<T>
): Promise<{ runId: number; result: T; durationMs: number }> {
  const db = await getDb();
  const startedAt = Date.now();
  let runId = 0;

  if (db) {
    const [inserted] = await db
      .insert(agentRuns)
      .values({
        agentName: ctx.agentName,
        triggeredBy: ctx.triggeredBy ?? "system",
        inputSummary: ctx.inputSummary,
        status: "running",
        startedAt: new Date(),
      })
      .returning({ id: agentRuns.id });
    runId = inserted?.id ?? 0;
  }

  try {
    const result = await fn(runId);
    const durationMs = Date.now() - startedAt;
    if (db && runId) {
      await db
        .update(agentRuns)
        .set({
          status: "success",
          completedAt: new Date(),
          durationMs,
          outputSummary: typeof result === "object"
            ? JSON.stringify(result).slice(0, 500)
            : String(result).slice(0, 500),
        })
        .where(eq(agentRuns.id, runId));
    }
    return { runId, result, durationMs };
  } catch (err: unknown) {
    const durationMs = Date.now() - startedAt;
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (db && runId) {
      await db
        .update(agentRuns)
        .set({
          status: "error",
          completedAt: new Date(),
          durationMs,
          errorMessage: errorMessage.slice(0, 1000),
        })
        .where(eq(agentRuns.id, runId));
    }
    throw err;
  }
}

// ─── Pipeline Stats ───────────────────────────────────────────────────────────

export async function getPipelineStats() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.execute(sql`
    SELECT status, COUNT(*) as count
    FROM prospects
    GROUP BY status
    ORDER BY status
  `);
  const byStatus: Record<string, number> = {};
  for (const r of rows as unknown as Array<{ status: string; count: string }>) {
    byStatus[r.status] = Number(r.count);
  }
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  return { total, byStatus };
}

export async function getRecentAgentActivity(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(agentRuns)
    .orderBy(desc(agentRuns.startedAt))
    .limit(limit);
}

// ─── User Lookup ──────────────────────────────────────────────────────────────

export async function getAdminUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.role, "admin"));
}
