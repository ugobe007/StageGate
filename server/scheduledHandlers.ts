import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import * as db from "./db";
import { notifyOwner } from "./_core/notification";
import { sdk } from "./_core/sdk";
import { researchAllPendingProspects } from "./research-agent";
import { getDb } from "./db";
import { salesAgentRuns } from "../drizzle/schema";

export async function nightlyResearchHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    const database = await getDb();
    let runId: number | undefined;
    if (database) {
      const [run] = await database
        .insert(salesAgentRuns)
        .values({
          runType: "max_research",
          status: "running",
          details: { agent: "max" },
        })
        .returning({ id: salesAgentRuns.id });
      runId = run?.id;
    }

    const { processed, failed } = await researchAllPendingProspects();

    if (database && runId) {
      await database
        .update(salesAgentRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          prospectsFound: processed,
          details: { agent: "max", processed, failed },
        })
        .where(eq(salesAgentRuns.id, runId));
    }

    if (processed > 0) {
      await notifyOwner({
        title: `Max (research) — ${processed} prospect${processed === 1 ? "" : "s"} researched`,
        content: `Max researched ${processed} new prospect${processed === 1 ? "" : "s"}${failed > 0 ? ` (${failed} failed)` : ""}. Decision makers and competitive context are ready for Cal. Review: https://onstage.bot/admin/pipeline`,
      });
    }

    return res.json({ ok: true, agent: "max", processed, failed });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message, context: { url: req.url }, timestamp: new Date().toISOString() });
  }
}

export async function followupDigestHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only" });
    }

    const overdue = await db.getProspectsWithOverdueFollowUp();

    if (overdue.length === 0) {
      return res.json({ ok: true, message: "No overdue follow-ups today." });
    }

    const lines = overdue.map((p) => {
      const followUpStr = p.followUpDate
        ? new Date(p.followUpDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "unknown date";
      return `• ${p.company} (${p.contactName ?? "no contact"}) — follow-up was ${followUpStr} — status: ${p.status}`;
    });

    await notifyOwner({
      title: `📋 StageGate Follow-up Digest — ${overdue.length} prospect${overdue.length === 1 ? "" : "s"} need attention`,
      content: `The following prospects have overdue follow-up dates and have not yet responded or converted:\n\n${lines.join("\n")}\n\nVisit https://onstage.bot/admin/prospects to take action.`,
    });

    return res.json({ ok: true, count: overdue.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({
      error: message,
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}
