/**
 * AI Organization — server registry + Max → Cal handoff.
 *
 * Metadata: shared/aiOrg.ts · Charters: docs/ai-org.md
 */

import { and, eq, or, sql } from "drizzle-orm";
import { getDb } from "../db.js";
import { draftEmails, prospects, salesAgentConversations } from "../../drizzle/schema.js";
import {
  isSendableEmailConfidence,
  prospectNeedsEmailFix,
  prospectNeedsWebsite,
  selectOutreachEmail,
} from "../outreachContacts.js";
import { ensureSuppressionStore, isSuppressed } from "../outreachGate.js";
import { AI_AGENTS, getAiAgent, type AiAgentId, type AiAgentMeta } from "../../shared/aiOrg.js";
import { MAX_OUTREACH_EMAILS } from "./frankPlaybook.js";

export { AI_AGENTS, getAiAgent, type AiAgentId, type AiAgentMeta };

/** Terminal conversation states — Max should not re-queue these for Cal. */
const TERMINAL_STATES = new Set([
  "replied",
  "meeting_booked",
  "converted",
  "unsubscribed",
  "bounced",
  "skipped",
  "robot_guild",
  "followup_2",
]);

export type MaxReadyProspect = {
  id: number;
  company: string;
  contactEmail: string;
  emailConfidence: string | null;
  contactName: string | null;
};

/**
 * Max → Cal opportunity queue: high-confidence, non-suppressed prospects
 * ready for Cal to draft or send (no active draft, not terminal).
 */
export async function listMaxReadyForCal(opts?: {
  limit?: number;
}): Promise<MaxReadyProspect[]> {
  const db = await getDb();
  if (!db) return [];

  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
  await ensureSuppressionStore(db);

  const [allProspects, convRows, activeDraftRows] = await Promise.all([
    db
      .select({
        id: prospects.id,
        company: prospects.company,
        contactEmail: prospects.contactEmail,
        emailConfidence: prospects.emailConfidence,
        contactName: prospects.contactName,
        website: prospects.website,
        status: prospects.status,
      })
      .from(prospects)
      .where(
        sql`${prospects.status} IS NULL OR ${prospects.status} NOT IN ('not_interested', 'converted')`,
      ),
    db.select().from(salesAgentConversations),
    db
      .select({ prospectId: draftEmails.prospectId })
      .from(draftEmails)
      .where(
        and(
          eq(draftEmails.audience, "prospect"),
          or(eq(draftEmails.status, "pending"), eq(draftEmails.status, "approved")),
        ),
      ),
  ]);

  const activeDraftProspects = new Set(
    activeDraftRows.map((r) => r.prospectId).filter((id): id is number => id != null),
  );
  const convByProspect = new Map(convRows.map((c) => [c.prospectId, c]));

  const ready: MaxReadyProspect[] = [];

  for (const p of allProspects) {
    if (ready.length >= limit) break;
    if (activeDraftProspects.has(p.id)) continue;
    if (prospectNeedsWebsite(p) || prospectNeedsEmailFix(p)) continue;

    const email = selectOutreachEmail(p);
    if (!email) continue;
    if (!isSendableEmailConfidence(p.emailConfidence)) continue;

    const conv = convByProspect.get(p.id);
    if (conv && TERMINAL_STATES.has(conv.state ?? "")) continue;
    if ((conv?.followUpCount ?? 0) >= MAX_OUTREACH_EMAILS) continue;

    if (await isSuppressed(db, email)) continue;

    ready.push({
      id: p.id,
      company: p.company,
      contactEmail: email,
      emailConfidence: p.emailConfidence,
      contactName: p.contactName,
    });
  }

  return ready;
}

/** Count Max's ready queue (for Relay daily report / missions). */
export async function countMaxReadyForCal(): Promise<number> {
  const list = await listMaxReadyForCal({ limit: 200 });
  return list.length;
}
