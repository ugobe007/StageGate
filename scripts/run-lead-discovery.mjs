/**
 * Run Lead Discovery scrapers locally with direct DB ingest (no HTTP callback).
 *
 * Usage: npx tsx --env-file=.env scripts/run-lead-discovery.mjs
 */

import { eq } from "drizzle-orm";
import { salesAgentDiscoveryCore } from "../server/agents/salesAgentDiscovery.js";
import { getDb } from "../server/db.js";
import {
  prospects,
  tradeShows,
  salesAgentConversations,
  salesAgentRuns,
} from "../drizzle/schema.js";
import { prospectHasUsableWebsite } from "../server/outreachContacts.js";

async function directIngest(body) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const { newProspects = [], newShows = [], runId } = body;
  let prospectsCreated = 0;
  let showsCreated = 0;

  for (const show of newShows) {
    if (!show.name) continue;
    const existing = await db
      .select({ id: tradeShows.id })
      .from(tradeShows)
      .where(eq(tradeShows.name, show.name))
      .limit(1);
    if (existing.length > 0) continue;

    await db.insert(tradeShows).values({
      name: show.name,
      location: show.location ?? null,
      venue: show.venue ?? null,
      city: show.city ?? null,
      website: show.website ?? null,
      description: show.description ?? null,
      roboticsRelevance: show.roboticsRelevance ?? 3,
      status: "upcoming",
    });
    showsCreated++;
  }

  for (const p of newProspects) {
    if (!p.company) continue;
    if (!prospectHasUsableWebsite({ website: p.website ?? null })) continue;

    const existing = await db
      .select({ id: prospects.id })
      .from(prospects)
      .where(eq(prospects.company, p.company))
      .limit(1);
    if (existing.length > 0) continue;

    const [inserted] = await db
      .insert(prospects)
      .values({
        company: p.company,
        contactName: p.contactName ?? null,
        contactEmail: p.contactEmail ?? null,
        contactTitle: p.contactTitle ?? null,
        website: p.website ?? null,
        robotName: p.robotName ?? null,
        robotType: p.robotType ?? null,
        robotCategory: p.robotCategory ?? "light",
        shows: p.shows ?? [],
        notes: p.notes ?? null,
        emailConfidence: p.emailConfidence ?? "low",
        status: "new",
        vendorType: p.vendorType ?? "robot_oem",
        outreachAngle: p.outreachAngle ?? "customer",
      })
      .returning({ id: prospects.id });

    if (inserted?.id) {
      await db.insert(salesAgentConversations).values({
        prospectId: inserted.id,
        state: "discovery",
        nextFollowUpAt: new Date(),
        lastActivityAt: new Date(),
      });
      prospectsCreated++;
    }
  }

  if (runId) {
    await db
      .update(salesAgentRuns)
      .set({
        prospectsFound: newProspects.length,
        prospectsCreated,
        showsFound: newShows.length,
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(salesAgentRuns.id, runId));
  }

  return { prospectsCreated, showsCreated };
}

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url.includes("/api/scheduled/sales-agent-ingest")) {
    const body = JSON.parse(init?.body ?? "{}");
    const result = await directIngest(body);
    console.log(
      `[Lead Discovery] Ingested ${result.prospectsCreated} prospect(s), ${result.showsCreated} show(s)`,
    );
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return originalFetch(input, init);
};

console.log("[Lead Discovery] Starting scrapers across trade show exhibitor lists…");
const started = Date.now();
await salesAgentDiscoveryCore();
console.log(`[Lead Discovery] Complete in ${Math.round((Date.now() - started) / 1000)}s.`);
