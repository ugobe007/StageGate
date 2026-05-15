/**
 * scripts/run-modex-apollo-enrichment.mjs
 *
 * Runs Apollo people search + AI research against all MODEX 2026 prospects
 * that haven't been enriched yet. Targets robotics-specific decision makers:
 *   - Director of Robotics / Automation
 *   - VP Operations / VP Engineering
 *   - Head of Automation / Head of Logistics
 *   - CTO / COO / CEO (for smaller companies)
 *   - Business Development / Partnerships
 *
 * Results are stored in prospect_research and contactName/contactEmail/contactTitle
 * are back-populated on the prospects table.
 *
 * Usage: node scripts/run-modex-apollo-enrichment.mjs
 */

import pg from "pg";
const { Client } = pg;

const connString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
if (!connString) { console.error("No DB connection string"); process.exit(1); }

const APOLLO_KEY = process.env.APOLLO_API_KEY;
const FORGE_URL  = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_KEY  = process.env.BUILT_IN_FORGE_API_KEY;

if (!APOLLO_KEY) {
  console.warn("[WARN] APOLLO_API_KEY not set — will run AI research only, no people search");
}

// ─── Apollo helpers ───────────────────────────────────────────────────────────

async function apolloFindOrg(company, website) {
  if (!APOLLO_KEY) return null;
  try {
    const body = { q_organization_name: company, page: 1, per_page: 1 };
    if (website) body.q_organization_website_url = website;

    const res = await fetch("https://api.apollo.io/v1/mixed_companies/search", {
      method: "POST",
      headers: { "x-api-key": APOLLO_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.organizations?.[0] ?? null;
  } catch {
    return null;
  }
}

async function apolloFindPeople(orgId) {
  if (!APOLLO_KEY || !orgId) return [];
  try {
    const res = await fetch("https://api.apollo.io/v1/mixed_people/search", {
      method: "POST",
      headers: { "x-api-key": APOLLO_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        organization_ids: [orgId],
        // Robotics-specific title targeting — ordered by priority
        person_titles: [
          "Director of Robotics",
          "VP Robotics",
          "Head of Robotics",
          "Director of Automation",
          "VP Automation",
          "Head of Automation",
          "Director of Operations",
          "VP Operations",
          "VP Engineering",
          "Head of Operations",
          "Head of Logistics",
          "Director of Business Development",
          "VP Business Development",
          "Head of Partnerships",
          "CTO",
          "COO",
          "CEO",
          "Founder",
          "Co-Founder",
          "Chief Executive Officer",
          "Chief Technology Officer",
          "Chief Operating Officer",
        ],
        page: 1,
        per_page: 5,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.people ?? [];
  } catch {
    return [];
  }
}

// ─── AI research ──────────────────────────────────────────────────────────────

async function aiResearch(company, robotName, robotType, shows, website) {
  if (!FORGE_URL || !FORGE_KEY) return null;

  const showList = (shows ?? []).length ? shows.join(", ") : "MODEX 2026";
  const robotDesc = [robotName, robotType].filter(Boolean).join(" — ") || "automation system";

  try {
    const res = await fetch(`${FORGE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${FORGE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a robotics industry analyst. Research companies for StageGate — a trade show logistics company specializing in robot activation. Output ONLY valid JSON, no markdown.`,
          },
          {
            role: "user",
            content: `Research this MODEX 2026 exhibitor for StageGate outreach:

Company: ${company}
Robot/Product: ${robotDesc}
Shows: ${showList}
Website: ${website ?? "unknown"}

Return JSON with these exact fields:
{
  "companyOverview": "2-3 sentences: what they make, market position, why they exhibit at MODEX",
  "robotSpecs": {
    "name": "${robotName ?? "product name"}",
    "type": "${robotType ?? "automation"}",
    "sensors": ["key sensors or vision systems"],
    "useCases": ["primary warehouse/logistics use cases"]
  },
  "competitiveContext": "1-2 sentences comparing to 2-3 key competitors",
  "useCases": ["3-5 specific trade show or commercial use cases"],
  "whyStageGate": "Why this company needs StageGate — robot size, origin country, complexity",
  "showIntel": "What they typically do at ${showList} — demo focus, booth size, logistics challenges"
}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

// ─── Priority ranking for contacts ───────────────────────────────────────────

function rankContact(title) {
  const t = (title ?? "").toLowerCase();
  if (t.includes("robotics") || t.includes("automation")) return 0;
  if (t.includes("operations") || t.includes("logistics")) return 1;
  if (t.includes("business development") || t.includes("partnerships")) return 2;
  if (t.includes("cto") || t.includes("chief technology")) return 3;
  if (t.includes("coo") || t.includes("chief operating")) return 4;
  if (t.includes("ceo") || t.includes("chief executive") || t.includes("founder")) return 5;
  if (t.includes("engineering") || t.includes("product")) return 6;
  return 7;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const client = new Client({ connectionString: connString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Get all MODEX prospects that haven't been AI-researched yet
  const result = await client.query(`
    SELECT p.id, p.company, p."robotName", p."robotType", p."robotCategory",
           p.website, p.shows, p."contactName", p."contactEmail", p."contactTitle"
    FROM prospects p
    LEFT JOIN prospect_research pr ON pr."prospectId" = p.id
    WHERE p.notes LIKE '%MODEX%'
      AND (pr.id IS NULL OR pr."researchStatus" != 'done')
    ORDER BY p.company
  `);

  const prospects = result.rows;
  console.log(`MODEX prospects without contacts: ${prospects.length}\n`);

  if (prospects.length === 0) {
    console.log("All MODEX prospects already have contacts. Nothing to do.");
    await client.end();
    return;
  }

  let enriched = 0;
  let apolloHits = 0;
  let aiOnly = 0;
  let errors = 0;

  for (let i = 0; i < prospects.length; i++) {
    const p = prospects[i];
    const shows = Array.isArray(p.shows) ? p.shows : (typeof p.shows === "string" ? JSON.parse(p.shows) : []);

    process.stdout.write(`[${i + 1}/${prospects.length}] ${p.company}... `);

    try {
      // Stagger requests
      if (i > 0) await new Promise(r => setTimeout(r, 600));

      // Step 1: Find org in Apollo
      const org = await apolloFindOrg(p.company, p.website);

      // Step 2: Find people if org found
      let people = [];
      if (org?.id) {
        people = await apolloFindPeople(org.id);
        if (people.length > 0) await new Promise(r => setTimeout(r, 300));
      }

      // Step 3: AI research
      const aiResult = await aiResearch(p.company, p.robotName, p.robotType, shows, p.website);

      // Step 4: Pick best contact
      let bestContact = null;
      if (people.length > 0) {
        // Sort by title priority
        const sorted = [...people].sort((a, b) => rankContact(a.title) - rankContact(b.title));
        bestContact = sorted[0];
        apolloHits++;
      }

      // Step 5: Build decision makers list
      const decisionMakers = people.map(person => ({
        name: person.name,
        title: person.title ?? "",
        email: person.email ?? undefined,
        emailConfidence: person.email_status ?? undefined,
        linkedIn: person.linkedin_url ?? undefined,
        department: person.departments?.[0] ?? undefined,
      }));

      // Step 6: Save to prospect_research
      const researchData = {
        companyOverview: aiResult?.companyOverview ?? `${p.company} is a robotics/automation company exhibiting at MODEX 2026.`,
        robotSpecs: aiResult?.robotSpecs ?? { name: p.robotName ?? "unknown", type: p.robotType ?? "other", sensors: [], useCases: [] },
        competitiveContext: aiResult?.competitiveContext ?? "",
        useCases: aiResult?.useCases ?? [],
        whyStageGate: aiResult?.whyStageGate ?? "",
        showIntel: aiResult?.showIntel ?? "",
        decisionMakers,
        apolloOrgId: org?.id ?? null,
      };

      await client.query(`
        INSERT INTO prospect_research (
          "prospectId", "companyOverview", "robotSpecs", "competitiveContext",
          "useCases", "whyStageGate", "showIntel", "decisionMakers",
          "apolloOrgId", "researchStatus", "researchedAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'done', NOW(), NOW())
        ON CONFLICT ("prospectId") DO UPDATE SET
          "companyOverview" = EXCLUDED."companyOverview",
          "robotSpecs" = EXCLUDED."robotSpecs",
          "competitiveContext" = EXCLUDED."competitiveContext",
          "useCases" = EXCLUDED."useCases",
          "whyStageGate" = EXCLUDED."whyStageGate",
          "showIntel" = EXCLUDED."showIntel",
          "decisionMakers" = EXCLUDED."decisionMakers",
          "apolloOrgId" = EXCLUDED."apolloOrgId",
          "researchStatus" = 'done',
          "researchedAt" = NOW(),
          "updatedAt" = NOW()
      `, [
        p.id,
        researchData.companyOverview,
        JSON.stringify(researchData.robotSpecs),
        researchData.competitiveContext,
        JSON.stringify(researchData.useCases),
        researchData.whyStageGate,
        researchData.showIntel,
        JSON.stringify(researchData.decisionMakers),
        researchData.apolloOrgId,
      ]);

      // Step 7: Back-populate contact on prospect if Apollo found someone
      if (bestContact) {
        await client.query(`
          UPDATE prospects SET
            "contactName" = $1,
            "contactTitle" = $2,
            "contactEmail" = $3,
            "contactLinkedIn" = $4,
            "emailConfidence" = $5,
            "updatedAt" = NOW()
          WHERE id = $6
        `, [
          bestContact.name,
          bestContact.title ?? null,
          bestContact.email ?? null,
          bestContact.linkedin_url ?? null,
          bestContact.email_status ?? "low",
          p.id,
        ]);
        console.log(`✓ Apollo: ${bestContact.name} (${bestContact.title ?? "no title"})${bestContact.email ? " ✉" : ""}`);
      } else {
        // AI-only: infer likely contact title from company type
        const inferredTitle = p.robotType?.includes("arm") || p.robotType?.includes("cobot")
          ? "Director of Automation"
          : p.robotType?.includes("amr") || p.robotType?.includes("wheeled")
          ? "VP Operations"
          : "Director of Robotics";

        await client.query(`
          UPDATE prospects SET
            "contactTitle" = $1,
            "updatedAt" = NOW()
          WHERE id = $2 AND ("contactTitle" IS NULL OR "contactTitle" = '')
        `, [inferredTitle, p.id]);

        console.log(`✓ AI only (no Apollo hit) — inferred title: ${inferredTitle}`);
        aiOnly++;
      }

      enriched++;
    } catch (e) {
      console.log(`✗ Error: ${e.message}`);
      errors++;
    }
  }

  await client.end();

  console.log(`\n${"─".repeat(60)}`);
  console.log(`MODEX Apollo Enrichment Complete`);
  console.log(`  Total processed:  ${enriched}`);
  console.log(`  Apollo contacts:  ${apolloHits}`);
  console.log(`  AI-only:          ${aiOnly}`);
  console.log(`  Errors:           ${errors}`);
  console.log(`  Apollo API key:   ${APOLLO_KEY ? "present" : "MISSING"}`);
}

main().catch(e => {
  console.error("Enrichment failed:", e.message);
  process.exit(1);
});
