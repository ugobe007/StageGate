import { Request, Response } from "express";
import * as db from "./db";
import { notifyOwner } from "./_core/notification";
import { sdk } from "./_core/sdk";

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
