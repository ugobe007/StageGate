/**
 * Resolve real company websites via Apollo before Hunter / Cal can find emails.
 * Junk exhibitor names without a domain never enter the "needs email" queue.
 */

import { and, desc, eq, isNull, notInArray, or, sql } from "drizzle-orm";
import { getDb } from "../db.js";
import { prospects } from "../../drizzle/schema.js";
import { apolloSearchOrg, normalizeWebsiteUrl } from "../integrations/apolloOrg.js";
import { prospectHasUsableWebsite } from "../outreachContacts.js";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type ResolveWebsitesBatchResult = {
  attempted: number;
  resolved: number;
  results: Array<{ id: number; company: string; website: string | null }>;
};

export async function resolveProspectWebsite(
  company: string,
): Promise<string | null> {
  const org = await apolloSearchOrg(company);
  return normalizeWebsiteUrl(org?.website_url ?? null);
}

export async function resolveProspectWebsitesBatch(
  db: Db,
  limit = 25,
): Promise<ResolveWebsitesBatchResult> {
  const cap = Math.min(Math.max(limit, 1), 100);

  const candidates = await db
    .select()
    .from(prospects)
    .where(
      and(
        notInArray(prospects.status, ["converted", "not_interested"]),
        or(
          isNull(prospects.website),
          sql`trim(${prospects.website}) = ''`,
        ),
      ),
    )
    .orderBy(desc(prospects.updatedAt))
    .limit(cap * 6);

  const toResolve = candidates
    .filter((p) => p.company?.trim() && !prospectHasUsableWebsite(p))
    .slice(0, cap);

  let resolved = 0;
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
      }
      results.push({ id: p.id, company: p.company, website });
    } catch (err) {
      console.error(`[resolve-website] prospect ${p.id} failed: ${String(err)}`);
      results.push({ id: p.id, company: p.company, website: null });
    }
    await new Promise((r) => setTimeout(r, 320));
  }

  console.log(`[resolve-website] attempted ${toResolve.length}, resolved ${resolved}`);
  return { attempted: toResolve.length, resolved, results };
}
