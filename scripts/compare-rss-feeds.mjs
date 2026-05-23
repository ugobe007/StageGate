/**
 * Cross-comparison: StageGate RSS feeds vs Ready For Robots scrape_targets.py
 *
 * Usage: node scripts/compare-rss-feeds.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const stagegateRoot = join(__dirname, "..");
const rfrRoot = join(stagegateRoot, "..", "Ready_For_Robots");

// Dynamic import of compiled TS isn't available — parse StageGate list from source
const sgTargetsSrc = readFileSync(
  join(stagegateRoot, "server/feeds/rssFeedTargets.ts"),
  "utf8",
);
const sgUrls = [...sgTargetsSrc.matchAll(/url:\s*"([^"]+)"/g)].map((m) => m[1]);

const rfrSrc = readFileSync(
  join(rfrRoot, "app/scrapers/scrape_targets.py"),
  "utf8",
);

function extractSection(name) {
  const re = new RegExp(`${name}:\\s*List\\[ScrapeTarget\\]\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*\\n\\n`, "m");
  const m = rfrSrc.match(re);
  if (!m) return [];
  return [...m[1].matchAll(/url="([^"]+)"/g)].map((x) => x[1]);
}

const rfrRss = extractSection("RSS_FEED_TARGETS");
const rfrOem = extractSection("OEM_INTELLIGENCE_TARGETS");
const rfrAll = [...new Set([...rfrRss, ...rfrOem])];

const sgSet = new Set(sgUrls);
const rfrSet = new Set(rfrAll);

const shared = sgUrls.filter((u) => rfrSet.has(u));
const sgOnly = sgUrls.filter((u) => !rfrSet.has(u));
const rfrOnly = rfrAll.filter((u) => !sgSet.has(u));

console.log("═══════════════════════════════════════════════════════════");
console.log("  RSS Feed Cross-Comparison: StageGate ↔ Ready For Robots");
console.log("═══════════════════════════════════════════════════════════\n");
console.log(`StageGate feeds:        ${sgUrls.length}`);
console.log(`RFR RSS + OEM feeds:    ${rfrAll.length} (${rfrRss.length} buyer RSS + ${rfrOem.length} OEM)`);
console.log(`Shared URLs:            ${shared.length}`);
console.log(`StageGate-only:         ${sgOnly.length}`);
console.log(`RFR-only (not in SG):   ${rfrOnly.length}\n`);

console.log("── Shared (both products) ──");
for (const u of shared.sort()) console.log(`  ✓ ${u}`);

console.log("\n── StageGate-only (show ecosystem + SG monitors) ──");
for (const u of sgOnly.sort()) console.log(`  + ${u}`);

console.log("\n── RFR-only (mostly buyer-intent — excluded from StageGate) ──");
for (const u of rfrOnly.sort()) console.log(`  − ${u}`);

console.log("\n── Recommendation ──");
console.log("  StageGate includes all RFR OEM_INTELLIGENCE feeds + logistics subset + show ecosystem.");
console.log("  RFR buyer-only feeds (QSR, senior living, restaurant) intentionally excluded from StageGate.");
console.log("  Consider adding StageGate-only show feeds to RFR OEM_INTELLIGENCE_TARGETS.\n");
