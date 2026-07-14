/**
 * Prospect contact enrichment via Hunter.io.
 *
 * StageGate's discovery agent guesses role inboxes (marketing@domain) that
 * rarely reach a human — the main reason automated outreach produced zero
 * replies. This module backfills real, verified decision-maker emails from
 * Hunter and persists them onto the prospect. Fail-open: when Hunter is
 * disabled or finds nothing, prospects are left untouched.
 */

import type { Request, Response } from "express";
import { eq, or, isNull, inArray, sql } from "drizzle-orm";
import { getDb } from "../db.js";
import { prospects, prospectActivities } from "../../drizzle/schema.js";
import { findBestProspectEmail, hunterEnabled } from "../integrations/hunter.js";
import { isDeprecatedRoleInbox } from "../outreachContacts.js";
import { isSendableEmailConfidence, selectOutreachEmail } from "../outreachContacts.js";
import { screenRecipient, ensureSuppressionStore } from "../outreachGate.js";

/** Generic mailbox local-parts that are guesses, not real people. */
const GENERIC_LOCAL_PARTS = new Set([
  "marketing", "sales", "info", "support", "hello", "contact",
  "partnerships", "events", "team", "admin", "office",
]);

type ProspectRow = typeof prospects.$inferSelect;
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** True when a prospect lacks a real, person-level email worth sending to. */
export function prospectNeedsEnrichment(
  p: Pick<ProspectRow, "contactEmail" | "emailConfidence">
): boolean {
  const email = p.contactEmail?.trim();
  if (!email || !email.includes("@")) return true;
  if (isDeprecatedRoleInbox(email)) return true;
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (GENERIC_LOCAL_PARTS.has(local)) return true;
  const conf = (p.emailConfidence ?? "").toLowerCase();
  return conf === "" || conf === "low";
}

/**
 * Enrich a single prospect's contact email via Hunter and persist it.
 * Returns the found email, or null if nothing usable was found. Mutates the
 * passed-in row so downstream callers in the same request see the new email.
 */
export async function enrichProspectContact(
  prospect: ProspectRow,
  opts: { db?: Db } = {}
): Promise<string | null> {
  if (!hunterEnabled()) return null;

  const contact = await findBestProspectEmail(prospect);
  if (!contact) return null;

  const db = opts.db ?? (await getDb());
  if (!db) return contact.email;

  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  const update: Partial<ProspectRow> = {
    contactEmail: contact.email,
    emailConfidence: contact.confidence,
    updatedAt: new Date(),
  };
  if (fullName && !prospect.contactName) update.contactName = fullName;
  if (contact.position && !prospect.contactTitle) update.contactTitle = contact.position;

  await db.update(prospects).set(update).where(eq(prospects.id, prospect.id));
  await db.insert(prospectActivities).values({
    prospectId: prospect.id,
    type: "contact_enriched",
    title: `Hunter: found ${contact.email}`,
    description:
      `Source ${contact.source}, confidence ${contact.confidence} (score ${contact.score})` +
      (contact.verificationStatus ? `, verification ${contact.verificationStatus}` : ""),
    metadata: {
      email: contact.email,
      source: contact.source,
      score: contact.score,
      confidence: contact.confidence,
      verificationStatus: contact.verificationStatus,
    },
  });

  prospect.contactEmail = contact.email;
  prospect.emailConfidence = contact.confidence;
  if (update.contactName) prospect.contactName = update.contactName;
  if (update.contactTitle) prospect.contactTitle = update.contactTitle;
  return contact.email;
}

export interface EnrichBatchResult {
  attempted: number;
  enriched: number;
  results: Array<{ id: number; company: string; email: string | null }>;
}

/**
 * Core batch backfill: find real emails for prospects that only have guessed or
 * missing contacts. Shared by the scheduled endpoint and the admin tRPC action.
 */
export async function enrichProspectsBatch(db: Db, limit = 25): Promise<EnrichBatchResult> {
  const cap = Math.min(Math.max(limit, 1), 100);

  const candidates = await db
    .select()
    .from(prospects)
    .where(or(isNull(prospects.contactEmail), inArray(prospects.emailConfidence, ["low", ""])))
    .limit(cap * 4);

  const toEnrich = candidates
    .filter((p) => !["converted", "not_interested"].includes(p.status ?? ""))
    .filter(prospectNeedsEnrichment)
    .slice(0, cap);

  let enriched = 0;
  const results: EnrichBatchResult["results"] = [];
  for (const p of toEnrich) {
    try {
      const email = await enrichProspectContact(p, { db });
      if (email) enriched++;
      results.push({ id: p.id, company: p.company, email });
    } catch (err) {
      console.error(`[enrich] prospect ${p.id} failed: ${String(err)}`);
      results.push({ id: p.id, company: p.company, email: null });
    }
    // Gentle pacing, well under Hunter's 15 req/s limit.
    await new Promise((r) => setTimeout(r, 120));
  }

  console.log(`[enrich] attempted ${toEnrich.length}, enriched ${enriched}`);
  return { attempted: toEnrich.length, enriched, results };
}

type PrepareResult =
  | { ok: true; email: string }
  | { ok: false; reason: string };

/**
 * Resolve a send-ready recipient: Hunter enrich if needed, then confidence +
 * send-gate checks. Shared by the nightly cron and admin draft sends.
 */
export async function prepareProspectOutreachRecipient(
  prospect: ProspectRow,
  db: Db | null,
): Promise<PrepareResult> {
  if ((!selectOutreachEmail(prospect) || prospectNeedsEnrichment(prospect)) && hunterEnabled()) {
    await enrichProspectContact(prospect, { db: db ?? undefined });
  }

  const email = selectOutreachEmail(prospect);
  if (!email) return { ok: false, reason: "no_verified_email" };
  if (!isSendableEmailConfidence(prospect.emailConfidence)) {
    return { ok: false, reason: "low_confidence" };
  }

  const screen = await screenRecipient(db, email);
  if (!screen.ok) return { ok: false, reason: screen.reason ?? "gate_rejected" };

  return { ok: true, email };
}

/**
 * Mark prospects whose on-file email has bounced/complained so enrichment re-runs.
 */
export async function quarantineBouncedProspectEmails(db: Db): Promise<{ quarantined: number }> {
  await ensureSuppressionStore(db);
  const rows = await db.execute(sql`
    SELECT p.id, p."contactEmail", p.company
    FROM prospects p
    INNER JOIN outreach_suppressions s ON lower(s.email) = lower(p."contactEmail")
    WHERE p."contactEmail" IS NOT NULL AND p."contactEmail" <> ''
  `);
  let quarantined = 0;
  for (const row of rows.rows ?? []) {
    const id = Number((row as { id?: number }).id);
    if (!id) continue;
    await db
      .update(prospects)
      .set({ emailConfidence: "low", updatedAt: new Date() })
      .where(eq(prospects.id, id));
    quarantined++;
  }
  return { quarantined };
}

/**
 * Batch backfill endpoint.
 * POST /api/scheduled/enrich-contacts  body: { limit?: number }
 */
export async function enrichContactsHandler(req: Request, res: Response) {
  const db = await getDb();
  if (!db) return res.status(503).json({ error: "db unavailable" });
  if (!hunterEnabled()) {
    return res.json({ ok: false, reason: "HUNTER_API_KEY not set", attempted: 0, enriched: 0 });
  }
  const result = await enrichProspectsBatch(db, Number(req.body?.limit) || 25);
  return res.json({ ok: true, ...result });
}
