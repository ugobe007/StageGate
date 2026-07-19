/**
 * scripts/run-generate-drafts.mjs
 * Generates email drafts for prospects that don't already have a pending draft.
 *
 * Usage:
 *   node scripts/run-generate-drafts.mjs --limit 10
 *   AGENT_WALL_MS=300000 node scripts/run-generate-drafts.mjs --limit 25
 */

import pg from "pg";
import { armWallClock, fetchWithTimeout, parseAgentArgs } from "./lib/agent-cli.mjs";

const { Client } = pg;
const { limit, wallMs } = parseAgentArgs(process.argv.slice(2), {
  defaultLimit: 25,
  maxLimit: 100,
  defaultWallMs: 10 * 60 * 1000,
});

const connString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
if (!connString) { console.error("No DB connection string"); process.exit(1); }

const FORGE_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY;
if (!FORGE_URL || !FORGE_KEY) { console.error("No LLM API credentials"); process.exit(1); }

async function generateDraft(prospect, shows) {
  const isPartner = (prospect.outreachAngle === "partner") ||
    (prospect.vendorType && prospect.vendorType !== "robot_oem");

  const vendorLabel = prospect.vendorType
    ? prospect.vendorType.replace(/_/g, " ")
    : "trade show partner";

  const showNames = shows.length > 0 ? shows.join(", ") : "major Las Vegas trade shows";

  const robotContext = prospect.robotName
    ? `Their robot is the ${prospect.robotName}${prospect.robotType ? ` (${prospect.robotType})` : ""}.`
    : prospect.robotType
    ? `They make ${prospect.robotType} robots.`
    : "";

  const systemPrompt = isPartner
    ? `You are a B2B sales writer for StageGate — the robotics technical operations layer for trade shows. We are a specialist subcontractor that plugs into the workflow of ${vendorLabel} companies to handle all robot-specific logistics: power, safety, transport, staging, and live activation. Write concise, direct cold outreach emails. No fluff. No buzzwords. Professional but warm.`
    : `You are a B2B sales writer for StageGate — a robotics activation company based in Las Vegas. We handle everything a robot company needs at a trade show: warehousing, transport, staging, power, safety compliance, and live demos. Write concise, direct cold outreach emails. No fluff. Professional but warm.`;

  const userPrompt = isPartner
    ? `Write a cold outreach email to the team at ${prospect.company} (a ${vendorLabel} company).

StageGate is the robotics technical operations layer that plugs into your workflow at ${showNames}. When your clients bring robots to a show, we handle the specialist work you are not set up for: robot-specific power, safety compliance, transport rigging, and live activation.

${prospect.notes ? `Company context: ${prospect.notes.slice(0, 300)}` : ""}

Write a subject line and email body. Format:
SUBJECT: [subject line]

[email body — 3-4 short paragraphs, under 200 words total]`
    : `Write a cold outreach email to the team at ${prospect.company}.

${robotContext} StageGate handles all trade show logistics for robot companies at ${showNames}: warehousing, transport, staging, power, safety compliance, and live demo support.

${prospect.notes ? `Company context: ${prospect.notes.slice(0, 300)}` : ""}

Write a subject line and email body. Format:
SUBJECT: [subject line]

[email body — 3-4 short paragraphs, under 200 words total]`;

  const res = await fetchWithTimeout(`${FORGE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${FORGE_KEY}`, "Content-Type": "application/json" },
    timeoutMs: 30_000,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) throw new Error(`LLM API ${res.status}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "";

  const subjectMatch = raw.match(/^SUBJECT:\s*(.+)$/im);
  const subject = subjectMatch ? subjectMatch[1].trim() : `Introduction — StageGate × ${prospect.company}`;
  const body = raw.replace(/^SUBJECT:.*$/im, "").trim();

  return { subject, body, isPartner };
}

async function main() {
  const clearWall = armWallClock(wallMs, "run-generate-drafts");
  const client = new Client({ connectionString: connString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const prospectsResult = await client.query(`
    SELECT id, company, "contactName", "contactEmail", "robotName", "robotType",
           "vendorType", "outreachAngle", notes, website, shows
    FROM prospects
    ORDER BY company
  `);

  const draftsResult = await client.query(`
    SELECT DISTINCT "prospectId" FROM draft_emails WHERE status = 'pending'
  `);
  const existingDraftProspectIds = new Set(draftsResult.rows.map(r => r.prospectId));

  const allProspects = prospectsResult.rows;
  const toProcess = allProspects
    .filter(p => !existingDraftProspectIds.has(p.id))
    .slice(0, limit);

  console.log(`Total prospects: ${allProspects.length}`);
  console.log(`Already have drafts: ${existingDraftProspectIds.size}`);
  console.log(`Generating drafts for: ${toProcess.length} (limit ${limit}, wall ${wallMs}ms)\n`);

  let generated = 0;
  let partnerDrafts = 0;
  let oemDrafts = 0;
  let errors = 0;

  for (const prospect of toProcess) {
    const shows = (prospect.shows ?? []).filter(Boolean);
    const tag = prospect.vendorType ?? (prospect.outreachAngle === "partner" ? "partner" : "robot_oem");

    process.stdout.write(`[${generated + errors + 1}/${toProcess.length}] ${prospect.company} (${tag})... `);

    try {
      await new Promise(r => setTimeout(r, 300));

      const { subject, body, isPartner } = await generateDraft(prospect, shows);

      await client.query(`
        INSERT INTO draft_emails ("prospectId", subject, body, status, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, 'pending', NOW(), NOW())
      `, [prospect.id, subject, body]);

      console.log(`✓ ${isPartner ? "[PARTNER]" : "[OEM]"} "${subject.slice(0, 60)}"`);
      generated++;
      if (isPartner) partnerDrafts++; else oemDrafts++;
    } catch (e) {
      console.log(`✗ Error: ${e.message}`);
      errors++;
    }
  }

  await client.end();
  clearWall();

  console.log(`\n${"─".repeat(60)}`);
  console.log(`Draft Generation Complete`);
  console.log(`  Total generated:  ${generated}`);
  console.log(`  Partner drafts:   ${partnerDrafts}`);
  console.log(`  OEM drafts:       ${oemDrafts}`);
  console.log(`  Errors:           ${errors}`);
  console.log(`  Already existed:  ${existingDraftProspectIds.size}`);
}

main().catch(e => {
  console.error("Draft generation failed:", e.message);
  process.exit(1);
});
