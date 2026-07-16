#!/usr/bin/env node
/**
 * Batch-resolve prospect websites via Hunter Domain Finder (free API call).
 * Auto-dismisses junk names. Replaces Apollo-based script.
 *
 * Usage: node scripts/resolve-prospect-websites.mjs [limit]
 */
import "dotenv/config";

const limit = Math.min(Number(process.argv[2] || 50), 200);
const hunterKey = process.env.HUNTER_API_KEY;
const connString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!connString) {
  console.error("Set DATABASE_URL or SUPABASE_DATABASE_URL");
  process.exit(1);
}
if (!hunterKey) {
  console.error("Set HUNTER_API_KEY");
  process.exit(1);
}

function normalizeWebsite(raw) {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return `https://${url.hostname.replace(/^www\./, "")}`;
  } catch {
    return null;
  }
}

function isLikelyJunk(name) {
  if (!name || name.length > 85 || name.split(/\s+/).length > 8) return true;
  if (/\b(coolest things|pour coffee|Captivate Crowds|Live drone|NDAA|Humanoid robots)\b/i.test(name)) return true;
  return false;
}

async function hunterDomain(company) {
  const url = new URL("https://api.hunter.io/v2/domain-finder");
  url.searchParams.set("company", company);
  url.searchParams.set("limit", "1");
  url.searchParams.set("api_key", hunterKey);
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) return null;
  const data = await res.json();
  return normalizeWebsite(data?.data?.[0]?.domain);
}

const pg = await import("pg");
const pool = new pg.default.Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } });

const { rows } = await pool.query(`
  SELECT id, company, website, notes, status
  FROM prospects
  WHERE status NOT IN ('converted', 'not_interested')
    AND (website IS NULL OR trim(website) = '')
  ORDER BY "updatedAt" DESC
  LIMIT $1
`, [limit * 3]);

let resolved = 0;
let dismissed = 0;
const targets = rows.filter((r) => r.company && !isLikelyJunk(r.company)).slice(0, limit);

for (const row of rows.filter((r) => r.company && isLikelyJunk(r.company)).slice(0, limit)) {
  await pool.query(
    `UPDATE prospects SET status = 'not_interested', notes = COALESCE(notes, '') || $1, "updatedAt" = NOW() WHERE id = $2`,
    ["\n[Cal] Auto-dismissed junk name.", row.id],
  );
  console.log(`  DISMISS ${row.company}`);
  dismissed++;
}

for (const row of targets) {
  process.stdout.write(`  ${row.company} … `);
  const website = await hunterDomain(row.company);
  if (website) {
    await pool.query(`UPDATE prospects SET website = $1, "updatedAt" = NOW() WHERE id = $2`, [website, row.id]);
    console.log(website);
    resolved++;
  } else {
    console.log("no match");
  }
  await new Promise((r) => setTimeout(r, 150));
}

console.log(`\nDone: resolved ${resolved}, dismissed ${dismissed} junk`);
await pool.end();
