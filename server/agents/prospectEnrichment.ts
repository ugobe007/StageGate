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
import { and, desc, eq, inArray, isNotNull, notInArray, or, sql } from "drizzle-orm";
import { getDb } from "../db.js";
import { prospects, prospectActivities, draftEmails } from "../../drizzle/schema.js";
import {
  consumeLastHunterError,
  domainSearch,
  findBestProspectEmail,
  hunterEnabled,
  HUNTER_MIN_RECOVERY_CONFIDENCE,
  pickBestDomainEmail,
  scoreToConfidence,
} from "../integrations/hunter.js";
import {
  deriveCompanyDomain,
  extractEmailAddress,
  isSendableEmailConfidence,
  prospectHasUsableWebsite,
  prospectNeedsEmailFix,
  selectOutreachEmail,
} from "../outreachContacts.js";
import { isSuppressed, normalizeSuppressionEmails, screenRecipient, ensureSuppressionStore } from "../outreachGate.js";

type ProspectRow = typeof prospects.$inferSelect;
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** True when a prospect lacks a real, person-level email worth sending to. */
export function prospectNeedsEnrichment(
  p: Pick<ProspectRow, "contactEmail" | "emailConfidence" | "website">,
): boolean {
  return prospectNeedsEmailFix(p);
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
  opts: { minDomainConfidence?: number } = {},
): Promise<Awaited<ReturnType<typeof findBestProspectEmail>>> {
  const domain = deriveCompanyDomain(prospect);
  if (!domain) return null;

  const search = await domainSearch(domain);
  if (!search?.emails?.length) return null;

  const filtered = search.emails.filter((e) => {
    const addr = (e.value ?? "").trim().toLowerCase();
    return addr && !exclude.has(addr);
  });
  const best = pickBestDomainEmail(filtered, {
    minConfidence: opts.minDomainConfidence,
  });
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
  opts: { db?: Db; recovery?: boolean } = {}
): Promise<string | null> {
  if (!hunterEnabled()) return null;

  const db = opts.db ?? (await getDb());
  const recoveryMin = opts.recovery ? HUNTER_MIN_RECOVERY_CONFIDENCE : undefined;
  const exclude = new Set<string>();
  const current = extractEmailAddress(prospect.contactEmail) ?? prospect.contactEmail?.trim().toLowerCase();
  if (current) exclude.add(current);

  let contact = await findBestProspectEmail(prospect);

  if (!contact) {
    contact = await findBestProspectEmail(prospect, {
      minDomainConfidence: HUNTER_MIN_RECOVERY_CONFIDENCE,
      minFinderScore: HUNTER_MIN_RECOVERY_CONFIDENCE,
    });
  }

  if (contact && db && (await isSuppressed(db, contact.email))) {
    exclude.add(contact.email.trim().toLowerCase());
    contact = null;
  }

  if (!contact && db) {
    contact = await findReplacementContact(prospect, db, exclude, { minDomainConfidence: recoveryMin });
  } else if (!contact) {
    contact = await findReplacementContact(prospect, null, exclude, { minDomainConfidence: recoveryMin });
  }

  if (!contact && opts.recovery) {
    contact = await findReplacementContact(prospect, db, exclude, {
      minDomainConfidence: HUNTER_MIN_RECOVERY_CONFIDENCE,
    });
  }

  if (contact && contact.email.trim().toLowerCase() === current) {
    exclude.add(contact.email.trim().toLowerCase());
    const alt = await findReplacementContact(prospect, db, exclude, { minDomainConfidence: recoveryMin });
    contact = alt;
  }

  if (!contact && db) {
    await logHunterMiss(db, prospect, "Hunter found no sendable personal email");
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
  noResults: number;
  hunterBlocked: boolean;
  hunterBlockReason?: string;
  message?: string;
  results: Array<{ id: number; company: string; email: string | null; reason?: string }>;
}

export interface QuarantineRecoveryResult {
  normalizedSuppressions: number;
  quarantined: number;
  recovered: number;
  unresolved: number;
}

function enrichBatchMessage(result: EnrichBatchResult): string {
  if (result.hunterBlocked) {
    if (result.hunterBlockReason?.toLowerCase().includes("credit")) {
      return `Hunter API blocked — ${result.hunterBlockReason}. Check Hunter credits.`;
    }
    return `Hunter API error — ${result.hunterBlockReason ?? "try again shortly"}`;
  }
  if (result.enriched > 0) {
    return `Hunter found personal emails for ${result.enriched} of ${result.attempted} leads (${result.noResults} still need manual review).`;
  }
  if (result.attempted === 0) {
    return "No enrichable leads — need a website on file first (Fix contacts → Resolve URLs).";
  }
  const sample = result.results
    .filter((r) => !r.email)
    .slice(0, 3)
    .map((r) => r.company)
    .join(", ");
  const suffix = sample ? ` e.g. ${sample}` : "";
  return (
    `Hunter found no personal emails for ${result.noResults} leads` +
    `${suffix}. Domain may not be in Hunter's index, or only generic inboxes exist — verify company names/websites.`
  );
}

async function logHunterMiss(db: Db, prospect: ProspectRow, reason: string): Promise<void> {
  const domain = deriveCompanyDomain(prospect) ?? "unknown";
  await db.insert(prospectActivities).values({
    prospectId: prospect.id,
    type: "hunter_no_match",
    title: "No personal email found",
    description: `${reason} (domain: ${domain})`,
    metadata: { domain, reason },
  });
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
  let noResults = 0;
  let hunterBlocked = false;
  let hunterBlockReason: string | undefined;
  const results: EnrichBatchResult["results"] = [];
  for (const p of toEnrich) {
    try {
      consumeLastHunterError();
      const email = await enrichProspectContact(p, { db });
      const hunterErr = consumeLastHunterError();
      if (hunterErr && (hunterErr.kind === "credits" || hunterErr.kind === "auth" || hunterErr.kind === "rate_limit")) {
        hunterBlocked = true;
        hunterBlockReason = hunterErr.message;
        results.push({ id: p.id, company: p.company, email: null, reason: hunterErr.kind });
        break;
      }
      if (email) {
        enriched++;
        results.push({ id: p.id, company: p.company, email });
      } else {
        noResults++;
        results.push({
          id: p.id,
          company: p.company,
          email: null,
          reason: deriveCompanyDomain(p) ? "no_personal_email" : "bad_website",
        });
      }
    } catch (err) {
      console.error(`[enrich] prospect ${p.id} failed: ${String(err)}`);
      noResults++;
      results.push({ id: p.id, company: p.company, email: null, reason: "error" });
    }
    await new Promise((r) => setTimeout(r, 120));
  }

  console.log(`[enrich] attempted ${toEnrich.length}, enriched=${enriched}, noResults=${noResults}`);
  return {
    attempted: toEnrich.length,
    enriched,
    noResults,
    hunterBlocked,
    hunterBlockReason,
    results,
    message: enrichBatchMessage({
      attempted: toEnrich.length,
      enriched,
      noResults,
      hunterBlocked,
      hunterBlockReason,
      results,
    }),
  };
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
 * Quarantine bounced addresses, then auto-replace via Hunter (no manual step).
 * Unresolved prospects get pending drafts discarded so Cal stops retrying them.
 */
export async function recoverQuarantinedProspectContacts(
  db: Db,
  opts: { limit?: number } = {},
): Promise<QuarantineRecoveryResult> {
  await ensureSuppressionStore(db);
  const normalizedSuppressions = await normalizeSuppressionEmails(db);
  const cap = Math.min(Math.max(opts.limit ?? 50, 1), 100);

  const rows = await db
    .select()
    .from(prospects)
    .where(
      and(
        notInArray(prospects.status, ["converted", "not_interested"]),
        isNotNull(prospects.contactEmail),
        sql`trim(${prospects.contactEmail}) <> ''`,
      ),
    )
    .orderBy(desc(prospects.updatedAt))
    .limit(cap * 4);

  const suppressedRows = await db.execute(sql`SELECT email FROM outreach_suppressions`);
  const suppressed = new Set(
    (suppressedRows.rows ?? [])
      .map((r) => extractEmailAddress(String((r as { email?: string }).email ?? "")))
      .filter((e): e is string => Boolean(e)),
  );

  const targets = rows.filter((p) => {
    const addr = extractEmailAddress(p.contactEmail);
    return addr && suppressed.has(addr);
  }).slice(0, cap);

  let quarantined = 0;
  let recovered = 0;
  let unresolved = 0;

  for (const prospect of targets) {
    const bounced = extractEmailAddress(prospect.contactEmail);
    if (!bounced) continue;

    quarantined++;
    await db
      .update(prospects)
      .set({
        contactEmail: null,
        emailConfidence: "low",
        updatedAt: new Date(),
      })
      .where(eq(prospects.id, prospect.id));
    prospect.contactEmail = null;
    prospect.emailConfidence = "low";

    const replacement = await enrichProspectContact(prospect, { db, recovery: true });
    if (replacement && isSendableEmailConfidence(prospect.emailConfidence)) {
      recovered++;
      continue;
    }

    unresolved++;
    const noteLine = "\n[Cal] Bounced address removed; Hunter found no replacement — auto-skipped.";
    await db
      .update(prospects)
      .set({
        notes: ((prospect.notes ?? "") + noteLine).trim(),
        updatedAt: new Date(),
      })
      .where(eq(prospects.id, prospect.id));
    await db
      .update(draftEmails)
      .set({ status: "discarded", updatedAt: new Date() })
      .where(
        and(
          eq(draftEmails.prospectId, prospect.id),
          inArray(draftEmails.status, ["pending", "approved"]),
        ),
      );
    await new Promise((r) => setTimeout(r, 120));
  }

  console.log(
    `[quarantine-recover] normalized=${normalizedSuppressions} quarantined=${quarantined} ` +
      `recovered=${recovered} unresolved=${unresolved}`,
  );
  return { normalizedSuppressions, quarantined, recovered, unresolved };
}

/** @deprecated Use recoverQuarantinedProspectContacts — kept for admin API compat. */
export async function quarantineBouncedProspectEmails(db: Db): Promise<{ quarantined: number }> {
  const result = await recoverQuarantinedProspectContacts(db);
  return { quarantined: result.quarantined };
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
