/**
 * Run Hunter email enrichment batch locally.
 *
 * Usage: npx tsx --env-file=.env scripts/run-hunter-enrich.mjs [limit]
 */

import { getDb } from "../server/db.js";
import { enrichProspectsBatch } from "../server/agents/prospectEnrichment.js";
import { hunterEnabled } from "../server/integrations/hunter.js";

const limit = Math.min(Math.max(Number(process.argv[2]) || 50, 1), 100);

if (!hunterEnabled()) {
  console.error("HUNTER_API_KEY not set");
  process.exit(1);
}

const db = await getDb();
if (!db) {
  console.error("DB unavailable");
  process.exit(1);
}

console.log(`[Hunter] Starting email enrichment (limit ${limit})...`);
const result = await enrichProspectsBatch(db, limit);
console.log(`[Hunter] ${result.message}`);
console.log(
  `[Hunter] enriched=${result.enriched} attempted=${result.attempted} noResults=${result.noResults}`,
);
if (result.hunterBlocked) console.log(`[Hunter] BLOCKED: ${result.hunterBlockReason}`);

for (const h of result.results.filter((r) => r.email).slice(0, 15)) {
  console.log(`  ✓ ${h.company} -> ${h.email}`);
}
for (const m of result.results.filter((r) => !r.email).slice(0, 10)) {
  console.log(`  ✗ ${m.company} (${m.reason ?? "no email"})`);
}
