#!/usr/bin/env node
/**
 * One-time / cron: sync ReadyForRobots robot_companies → StageGate prospects.
 *
 * Usage:
 *   RFR_API_BASE=https://readyforrobots.com node scripts/sync-rfr-prospects.mjs
 *   node scripts/sync-rfr-prospects.mjs --timeout-ms 60000
 */
import "dotenv/config";
import pg from "pg";
import { armWallClock, fetchWithTimeout, parseAgentArgs } from "./lib/agent-cli.mjs";

const RFR_API_BASE = (process.env.RFR_API_BASE || "https://ready-2-robot.fly.dev").replace(/\/$/, "");
const DATABASE_URL = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
const { wallMs } = parseAgentArgs(process.argv.slice(2), {
  defaultLimit: 500,
  maxLimit: 500,
  defaultWallMs: 2 * 60 * 1000,
});

if (!DATABASE_URL) {
  console.error("Set SUPABASE_DATABASE_URL or DATABASE_URL");
  process.exit(1);
}

function normalize(name) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function mapStatus(outreach) {
  const s = (outreach || "not_contacted").toLowerCase();
  if (s === "contacted") return "contacted";
  if (s === "responded") return "responded";
  if (s === "meeting_scheduled") return "scheduled";
  if (s === "partnership") return "converted";
  return "new";
}

async function main() {
  const clearWall = armWallClock(wallMs, "sync-rfr-prospects");
  const res = await fetchWithTimeout(`${RFR_API_BASE}/api/robot-companies/?limit=500&skip=0`, {
    timeoutMs: 30_000,
  });
  if (!res.ok) throw new Error(`RFR fetch failed: ${res.status}`);
  const { companies = [] } = await res.json();
  console.log(`Fetched ${companies.length} robot_companies from RFR (wall ${wallMs}ms)`);

  const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    await client.query(`
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS "rfrRobotCompanyId" integer;
      CREATE UNIQUE INDEX IF NOT EXISTS prospects_rfr_robot_company_id_key ON prospects ("rfrRobotCompanyId");
    `);

    const { rows: local } = await client.query(`SELECT id, company, status, "rfrRobotCompanyId" FROM prospects`);
    const byRfr = new Map(local.filter((r) => r.rfrRobotCompanyId).map((r) => [r.rfrRobotCompanyId, r]));
    const byName = new Map(local.map((r) => [normalize(r.company), r]));

    let linked = 0;
    let created = 0;

    for (const row of companies) {
      if (!row.company_name) continue;
      const norm = normalize(row.company_name);
      const existing = byRfr.get(row.id) || byName.get(norm);

      if (existing) {
        await client.query(
          `UPDATE prospects SET "rfrRobotCompanyId" = $1, "updatedAt" = NOW() WHERE id = $2`,
          [row.id, existing.id],
        );
        linked++;
        continue;
      }

      const shows = [];
      if (row.next_trade_show) shows.push(row.next_trade_show);
      if (Array.isArray(row.trade_shows)) shows.push(...row.trade_shows);

      const ins = await client.query(
        `INSERT INTO prospects (company, "hqCountry", "robotType", website, "contactEmail", shows, status, "vendorType", "outreachAngle", "rfrRobotCompanyId", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,'robot_oem','customer',$8,NOW(),NOW())
         RETURNING id`,
        [
          row.company_name,
          row.country || null,
          row.robot_type || null,
          row.website || null,
          row.contact_email || null,
          JSON.stringify([...new Set(shows)]),
          mapStatus(row.outreach_status),
          row.id,
        ],
      );
      const prospectId = ins.rows[0]?.id;
      if (prospectId) {
        await client.query(
          `INSERT INTO sales_agent_conversations ("prospectId", state, "nextFollowUpAt", "lastActivityAt")
           VALUES ($1, 'discovery', NOW(), NOW())
           ON CONFLICT DO NOTHING`,
          [prospectId],
        );
        created++;
      }
    }

    console.log(`Done: linked=${linked} created=${created} (total RFR=${companies.length})`);
  } finally {
    client.release();
    await pool.end();
    clearWall();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
