/**
 * Resolve company websites via Hunter Domain Finder (not Apollo).
 * Auto-dismisses headline/junk names that cannot resolve to a domain.
 */

import { and, desc, eq, isNull, notInArray, or, sql } from "drizzle-orm";
import { getDb } from "../db.js";
import { prospects } from "../../drizzle/schema.js";
import { hunterEnabled, websiteFromCompanyName } from "../integrations/hunter.js";
import { prospectHasUsableWebsite } from "../outreachContacts.js";
import { isLikelyJunkCompanyName } from "./discoveryLogicEngine.js";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type ResolveWebsitesBatchResult = {
  attempted: number;
  resolved: number;
  dismissed: number;
  results: Array<{ id: number; company: string; website: string | null; dismissed?: boolean }>;
};

export async function resolveProspectWebsite(company: string): Promise<string | null> {
  if (!hunterEnabled()) return null;
  return websiteFromCompanyName(company);
}

export async function dismissJunkProspectsBatch(
  db: Db,
  limit = 50,
): Promise<{ dismissed: number; ids: number[] }> {
  const cap = Math.min(Math.max(limit, 1), 200);
  const rows = await db
    .select()
    .from(prospects)
    .where(
      and(
        notInArray(prospects.status, ["converted", "not_interested"]),
        or(isNull(prospects.website), sql`trim(${prospects.website}) = ''`),
      ),
    )
    .orderBy(desc(prospects.updatedAt))
    .limit(cap * 4);

  const junk = rows.filter((p) => p.company && isLikelyJunkCompanyName(p.company)).slice(0, cap);
  const ids: number[] = [];

  for (const p of junk) {
    const noteLine = "\n[Cal] Auto-dismissed — junk exhibitor label, no company website.";
    await db
      .update(prospects)
      .set({
        status: "not_interested",
        notes: ((p.notes ?? "") + noteLine).trim(),
        updatedAt: new Date(),
      })
      .where(eq(prospects.id, p.id));
    ids.push(p.id);
  }

  if (ids.length > 0) {
    console.log(`[resolve-website] dismissed ${ids.length} junk prospect(s)`);
  }
  return { dismissed: ids.length, ids };
}

export async function resolveProspectWebsitesBatch(
  db: Db,
  limit = 25,
): Promise<ResolveWebsitesBatchResult> {
  const cap = Math.min(Math.max(limit, 1), 100);
  if (!hunterEnabled()) {
    return { attempted: 0, resolved: 0, dismissed: 0, results: [] };
  }

  const candidates = await db
    .select()
    .from(prospects)
    .where(
      and(
        notInArray(prospects.status, ["converted", "not_interested"]),
        or(isNull(prospects.website), sql`trim(${prospects.website}) = ''`),
      ),
    )
    .orderBy(desc(prospects.updatedAt))
    .limit(cap * 6);

  const toResolve = candidates
    .filter((p) => p.company?.trim() && !prospectHasUsableWebsite(p) && !isLikelyJunkCompanyName(p.company))
    .slice(0, cap);

  let resolved = 0;
  let dismissed = 0;
  const results: ResolveWebsitesBatchResult["results"] = [];

  for (const p of toResolve) {
    try {
      const website = await resolveProspectWebsite(p.company);
      if (website) {
        await db
          .update(prospects)
          .set({ website, updatedAt: new Date() })
          .where(eq(prospects.id, p.id));
        resolved++;
        results.push({ id: p.id, company: p.company, website });
      } else if (isLikelyJunkCompanyName(p.company)) {
        const noteLine = "\n[Cal] No Hunter domain match — likely junk name.";
        await db
          .update(prospects)
          .set({
            status: "not_interested",
            notes: ((p.notes ?? "") + noteLine).trim(),
            updatedAt: new Date(),
          })
          .where(eq(prospects.id, p.id));
        dismissed++;
        results.push({ id: p.id, company: p.company, website: null, dismissed: true });
      } else {
        results.push({ id: p.id, company: p.company, website: null });
      }
    } catch (err) {
      console.error(`[resolve-website] prospect ${p.id} failed: ${String(err)}`);
      results.push({ id: p.id, company: p.company, website: null });
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`[resolve-website] attempted ${toResolve.length}, resolved ${resolved}, dismissed ${dismissed}`);
  return { attempted: toResolve.length, resolved, dismissed, results };
}
