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
import { and, desc, eq, isNotNull, notInArray, or, sql } from "drizzle-orm";
import { getDb } from "../db.js";
import { prospects, prospectActivities } from "../../drizzle/schema.js";
import {
  domainSearch,
  findBestProspectEmail,
  hunterEnabled,
  pickBestDomainEmail,
  scoreToConfidence,
} from "../integrations/hunter.js";
import { deriveCompanyDomain, isDeprecatedRoleInbox } from "../outreachContacts.js";
import { isSendableEmailConfidence, selectOutreachEmail } from "../outreachContacts.js";
import { isSuppressed, screenRecipient, ensureSuppressionStore } from "../outreachGate.js";

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

/** Pick prospects for a Hunter batch — must match prospectNeedsEnrichment (incl. generic inboxes). */
export function selectProspectsForEnrichment(
  rows: ProspectRow[],
  limit: number,
): ProspectRow[] {
  const cap = Math.min(Math.max(limit, 1), 100);
  return rows
    .filter((p) => !["converted", "not_interested"].includes(p.status ?? ""))
    .filter((p) => Boolean(deriveCompanyDomain(p)))
    .filter(prospectNeedsEnrichment)
    .sort((a, b) => {
      const pri = (p: ProspectRow) => {
        if (!p.contactEmail?.trim()) return 0;
        if ((p.emailConfidence ?? "").toLowerCase() === "low") return 1;
        return 2;
      };
      return pri(a) - pri(b);
    })
    .slice(0, cap);
}

async function findReplacementContact(
  prospect: ProspectRow,
  db: Db | null,
  exclude: Set<string>,
): Promise<Awaited<ReturnType<typeof findBestProspectEmail>>> {
  const domain = deriveCompanyDomain(prospect);
  if (!domain) return null;

  const search = await domainSearch(domain);
  if (!search?.emails?.length) return null;

  const filtered = search.emails.filter((e) => {
    const addr = (e.value ?? "").trim().toLowerCase();
    return addr && !exclude.has(addr);
  });
  const best = pickBestDomainEmail(filtered);
  if (!best) return null;

  if (db && (await isSuppressed(db, best.value))) return null;

  return {
    email: best.value,
    firstName: best.first_name ?? undefined,
    lastName: best.last_name ?? undefined,
    position: best.position ?? undefined,
    confidence: scoreToConfidence(best.confidence ?? 0),
    score: best.confidence ?? 0,
    verificationStatus: best.verification?.status ?? undefined,
    source: "domain_search",
  };
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

  const db = opts.db ?? (await getDb());
  const exclude = new Set<string>();
  const current = prospect.contactEmail?.trim().toLowerCase();
  if (current) exclude.add(current);

  let contact = await findBestProspectEmail(prospect);

  if (contact && db && (await isSuppressed(db, contact.email))) {
    exclude.add(contact.email.trim().toLowerCase());
    contact = null;
  }

  if (!contact && db) {
    contact = await findReplacementContact(prospect, db, exclude);
  } else if (!contact) {
    contact = await findReplacementContact(prospect, null, exclude);
  }

  if (contact && contact.email.trim().toLowerCase() === current) {
    exclude.add(contact.email.trim().toLowerCase());
    const alt = await findReplacementContact(prospect, db, exclude);
    contact = alt;
  }

  if (!contact) return null;
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
    .where(
      and(
        notInArray(prospects.status, ["converted", "not_interested"]),
        isNotNull(prospects.website),
        sql`trim(${prospects.website}) <> ''`,
      ),
    )
    .orderBy(desc(prospects.updatedAt))
    .limit(cap * 12);

  const toEnrich = selectProspectsForEnrichment(candidates, cap);

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
