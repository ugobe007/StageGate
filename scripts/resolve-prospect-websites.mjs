#!/usr/bin/env node
/**
 * Batch-resolve prospect websites via Apollo (URL script).
 * Skips junk exhibitor names Apollo cannot match.
 *
 * Usage: node scripts/resolve-prospect-websites.mjs [limit]
 */
import "dotenv/config";
import pg from "pg";

const limit = Math.min(Number(process.argv[2] || 50), 200);
const connString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
const apolloKey = process.env.APOLLO_API_KEY;

if (!connString) {
  console.error("Set DATABASE_URL or SUPABASE_DATABASE_URL");
  process.exit(1);
}
if (!apolloKey) {
  console.error("Set APOLLO_API_KEY");
  process.exit(1);
}

function normalizeWebsite(raw) {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    if (!url.hostname.includes(".")) return null;
    return `https://${url.hostname.replace(/^www\./, "")}`;
  } catch {
    return null;
  }
}

async function apolloOrg(company) {
  const res = await fetch("https://api.apollo.io/v1/mixed_companies/search", {
    method: "POST",
    headers: { "x-api-key": apolloKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q_organization_name: company, page: 1, per_page: 1 }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.organizations?.[0] ?? null;
}

const pool = new pg.Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } });

async function main() {
  const { rows } = await pool.query(`
    SELECT id, company, website
    FROM prospects
    WHERE status NOT IN ('converted', 'not_interested')
      AND (website IS NULL OR trim(website) = '')
    ORDER BY "updatedAt" DESC
    LIMIT $1
  `, [limit * 3]);

  const targets = rows.slice(0, limit);
  let resolved = 0;

  for (const row of targets) {
    process.stdout.write(`  ${row.company} … `);
    const org = await apolloOrg(row.company);
    const website = normalizeWebsite(org?.website_url);
    if (website) {
      await pool.query(`UPDATE prospects SET website = $1, "updatedAt" = NOW() WHERE id = $2`, [website, row.id]);
      console.log(website);
      resolved++;
    } else {
      console.log("no match");
    }
    await new Promise((r) => setTimeout(r, 320));
  }

  console.log(`\nDone: resolved ${resolved} / ${targets.length} attempted`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
