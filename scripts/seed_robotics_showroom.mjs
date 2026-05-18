#!/usr/bin/env node
/**
 * seed_robotics_showroom.mjs
 *
 * Adds Robotics Showroom as a partner prospect in StageGate (onstage.bot)
 * and creates a Cal discovery draft email — Cal's voice, no LLM.
 *
 * Usage: node scripts/seed_robotics_showroom.mjs
 */
import pg from "pg";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const { Client } = pg;
const client = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

// ─── 1. Check if prospect already exists ──────────────────────────────────────
const existing = await client.query(
  `SELECT id FROM prospects WHERE website ILIKE '%roboticsshowroom.com%' OR company ILIKE 'Robotics Showroom' LIMIT 1`
);

if (existing.rows.length > 0) {
  console.log(`⚠  Prospect already exists (id: ${existing.rows[0].id}) — skipping insert.`);
  await generateDraft(existing.rows[0].id);
  await client.end();
  process.exit(0);
}

// ─── 2. Insert prospect ────────────────────────────────────────────────────────
const insertResult = await client.query(
  `INSERT INTO prospects
     (company, website, "outreachAngle", "vendorType", status, notes, "attendsLasVegas", "createdAt", "updatedAt")
   VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
   RETURNING id`,
  [
    "Robotics Showroom",
    "https://roboticsshowroom.com",
    "partner",
    "other",
    "new",
    "E-commerce/review marketplace for humanoid robots (specs, pricing, reviews). Natural co-marketing partner — robot OEMs on their platform also exhibit at trade shows. Referral or listing arrangement.",
    "unknown",
  ]
);
const prospectId = insertResult.rows[0].id;
console.log(`✓ Created prospect: Robotics Showroom (id: ${prospectId})`);

// ─── 3. Seed a sales_agent_conversations row so the nightly cron picks it up ──
await client.query(
  `INSERT INTO sales_agent_conversations ("prospectId", state, "nextFollowUpAt", "lastActivityAt", "createdAt", "updatedAt")
   VALUES ($1, 'discovery', NOW(), NOW(), NOW(), NOW())
   ON CONFLICT DO NOTHING`,
  [prospectId]
);
console.log(`✓ Seeded salesAgentConversations row (state: discovery)`);

// ─── 4. Generate Cal's discovery draft (partner voice, no LLM) ───────────────
await generateDraft(prospectId);

await client.end();
console.log("\n✓ Done. Open Cal's Mission Control → Pending Drafts to review.\n");

// ─────────────────────────────────────────────────────────────────────────────
async function generateDraft(prospectId) {
  // Check if a pending draft already exists
  const existingDraft = await client.query(
    `SELECT id FROM draft_emails WHERE "prospectId" = $1 AND status = 'pending' LIMIT 1`,
    [prospectId]
  );
  if (existingDraft.rows.length > 0) {
    console.log(`⚠  Pending draft already exists (id: ${existingDraft.rows[0].id}) — skipping.`);
    return;
  }

  // Cal's partner voice — same tone as buildDiscoveryEmail, adapted for a marketplace partner
  const subject = `Quick note — StageGate × Robotics Showroom`;

  const body = `Hi there,

This is Cal from StageGate. We handle robot logistics and technical operations at trade shows — warehousing, staging, on-site support, and live demos for robot OEMs.

I came across Robotics Showroom and noticed a natural overlap: many of the companies listed on your platform exhibit at CES, MODEX, NAB, and other major trade shows. We're the ground crew for those robots when they're on the road.

Would you be open to a quick call to explore a referral or co-marketing arrangement? I'd love to understand how you work with the brands on your platform and see if there's a fit.

Check out onstage.bot and register — it's free and takes about 2 minutes. Or just reply and I'll send a calendar invite.

Thanks,
Cal
StageGate | onstage.bot`;

  await client.query(
    `INSERT INTO draft_emails ("prospectId", subject, body, "agentReasoning", status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW())`,
    [
      prospectId,
      subject,
      body,
      "Cal partner discovery draft — Robotics Showroom (marketplace/media). No LLM — Cal's fixed template voice.",
    ]
  );
  console.log(`✓ Created Cal draft: "${subject}"`);
}
