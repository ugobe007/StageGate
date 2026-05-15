/**
 * scripts/run-modex-ai-reenrich.mjs
 * Re-runs AI research for MODEX prospects that have generic fallback overview text.
 * Uses the full researchProspect() function from research-agent.ts via a compiled call.
 *
 * Usage: node scripts/run-modex-ai-reenrich.mjs
 */

import pg from "pg";
const { Client } = pg;

const connString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
const FORGE_URL  = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_KEY  = process.env.BUILT_IN_FORGE_API_KEY;

if (!FORGE_URL || !FORGE_KEY) { console.error("No LLM credentials"); process.exit(1); }

async function aiResearch(company, robotName, robotType, shows, website) {
  const showList = (shows ?? []).length ? shows.join(", ") : "MODEX 2026";
  const robotDesc = [robotName, robotType].filter(Boolean).join(" — ") || "automation system";

  const res = await fetch(`${FORGE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${FORGE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a robotics industry analyst. Research companies for StageGate — a trade show logistics company specializing in robot activation at Las Vegas trade shows. Output ONLY valid JSON, no markdown.`,
        },
        {
          role: "user",
          content: `Research this MODEX 2026 exhibitor for StageGate outreach:

Company: ${company}
Robot/Product: ${robotDesc}
Shows: ${showList}
Website: ${website ?? "unknown"}

Return a JSON object with exactly these fields:
{
  "companyOverview": "2-3 sentences: what they make, market position, why they exhibit at MODEX",
  "robotSpecs": {
    "name": "robot product name",
    "type": "AMR | industrial_arm | cobot | conveyor | humanoid | exoskeleton | other",
    "sensors": ["key sensors or vision systems"],
    "useCases": ["primary warehouse/logistics use cases"]
  },
  "competitiveContext": "1-2 sentences comparing to 2-3 key competitors in same category",
  "useCases": ["3-5 specific trade show or commercial use cases"],
  "whyStageGate": "1-2 sentences: why this company needs StageGate — robot size, origin country, complexity, international shipping",
  "showIntel": "1-2 sentences: what they typically do at MODEX — demo focus, booth size, typical logistics challenges"
}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const data = await res.json();
  let raw = data.choices?.[0]?.message?.content ?? "{}";
  // Strip markdown code fences if present
  if (typeof raw === "string") {
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  }
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

async function main() {
  const client = new Client({ connectionString: connString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Get MODEX prospects with generic fallback overview
  const result = await client.query(`
    SELECT p.id, p.company, p."robotName", p."robotType", p.website, p.shows
    FROM prospects p
    JOIN prospect_research pr ON pr."prospectId" = p.id
    WHERE p.notes LIKE '%MODEX%'
      AND (
        pr."companyOverview" LIKE '%is a robotics/automation company exhibiting at MODEX%'
        OR pr."companyOverview" IS NULL
        OR pr."companyOverview" = ''
      )
    ORDER BY p.company
  `);

  const toEnrich = result.rows;
  console.log(`MODEX prospects needing AI re-enrichment: ${toEnrich.length}\n`);

  let done = 0;
  let errors = 0;

  for (let i = 0; i < toEnrich.length; i++) {
    const p = toEnrich[i];
    const shows = Array.isArray(p.shows) ? p.shows : (typeof p.shows === "string" ? JSON.parse(p.shows) : ["MODEX 2026"]);

    process.stdout.write(`[${i + 1}/${toEnrich.length}] ${p.company}... `);

    try {
      if (i > 0) await new Promise(r => setTimeout(r, 400));

      const ai = await aiResearch(p.company, p.robotName, p.robotType, shows, p.website);

      await client.query(`
        UPDATE prospect_research SET
          "companyOverview" = $1,
          "robotSpecs" = $2,
          "competitiveContext" = $3,
          "useCases" = $4,
          "whyStageGate" = $5,
          "showIntel" = $6,
          "updatedAt" = NOW()
        WHERE "prospectId" = $7
      `, [
        ai.companyOverview,
        JSON.stringify(ai.robotSpecs ?? {}),
        ai.competitiveContext ?? "",
        JSON.stringify(ai.useCases ?? []),
        ai.whyStageGate ?? "",
        ai.showIntel ?? "",
        p.id,
      ]);

      console.log(`✓ "${(ai.companyOverview ?? "").slice(0, 70)}"`);
      done++;
    } catch (e) {
      console.log(`✗ ${e.message}`);
      errors++;
    }
  }

  await client.end();

  console.log(`\n${"─".repeat(60)}`);
  console.log(`AI Re-enrichment Complete`);
  console.log(`  Done:   ${done}`);
  console.log(`  Errors: ${errors}`);
}

main().catch(e => {
  console.error("Re-enrichment failed:", e.message);
  process.exit(1);
});
