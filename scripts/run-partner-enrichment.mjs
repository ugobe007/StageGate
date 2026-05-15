/**
 * scripts/run-partner-enrichment.mjs
 * Triggers Apollo + AI research enrichment for all ecosystem partner prospects
 * (vendorType != robot_oem or outreachAngle = partner)
 *
 * Usage: node scripts/run-partner-enrichment.mjs
 */

import pg from "pg";
const { Client } = pg;

const connString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
if (!connString) {
  console.error("No database connection string found");
  process.exit(1);
}

// ─── Apollo.io helpers ────────────────────────────────────────────────────────

async function apolloSearchOrg(company, website) {
  const key = process.env.APOLLO_API_KEY;
  if (!key) { console.log(`  [Apollo] No API key — skipping org search for ${company}`); return null; }

  try {
    const body = { q_organization_name: company, page: 1, per_page: 1 };
    if (website) body.q_organization_website_url = website;

    const res = await fetch("https://api.apollo.io/v1/mixed_companies/search", {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data.organizations?.[0] ?? null;
  } catch (e) {
    console.log(`  [Apollo] Org search failed for ${company}: ${e.message}`);
    return null;
  }
}

async function apolloSearchPeople(orgId, orgName, partnerTitles) {
  const key = process.env.APOLLO_API_KEY;
  if (!key) return [];

  try {
    const res = await fetch("https://api.apollo.io/v1/mixed_people/search", {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        organization_ids: [orgId],
        person_titles: partnerTitles,
        page: 1,
        per_page: 5,
      }),
    });
    const data = await res.json();
    return data.people ?? [];
  } catch (e) {
    console.log(`  [Apollo] People search failed for ${orgName}: ${e.message}`);
    return [];
  }
}

// ─── LLM helper ──────────────────────────────────────────────────────────────

async function aiResearchPartner(company, vendorType, website) {
  const apiUrl = process.env.BUILT_IN_FORGE_API_URL;
  const apiKey = process.env.BUILT_IN_FORGE_API_KEY;
  if (!apiUrl || !apiKey) {
    console.log(`  [LLM] No API credentials — skipping AI research for ${company}`);
    return null;
  }

  const vendorLabel = (vendorType ?? "trade show vendor").replace(/_/g, " ");

  try {
    const res = await fetch(`${apiUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a B2B sales intelligence expert for StageGate — the robotics technical operations layer for trade shows. Research ${vendorLabel} companies to help StageGate introduce itself as a specialist subcontractor for robot-specific logistics. Output ONLY valid JSON.`,
          },
          {
            role: "user",
            content: `Research this partner company for StageGate outreach:

Company: ${company}
Type: ${vendorLabel}
Website: ${website ?? "unknown"}

Return a JSON object with exactly these fields:
{
  "companyOverview": "2-3 sentence description of what the company does and their role in the trade show ecosystem",
  "whyStageGate": "1-2 sentences explaining why StageGate (robotics technical operations layer) is a natural partner for this company — reference the robot-specific complexity they are not equipped to handle",
  "keyContacts": "comma-separated list of relevant job titles to target (e.g., Director of Technology, VP Operations, Show Services Manager)",
  "showPresence": "1 sentence about which major trade shows this company services",
  "partnershipAngle": "1 sentence describing the ideal partnership pitch for this specific company type"
}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      console.log(`  [LLM] API error ${res.status} for ${company}`);
      return null;
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (e) {
    console.log(`  [LLM] Research failed for ${company}: ${e.message}`);
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const client = new Client({ connectionString: connString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Fetch all partner prospects
  const result = await client.query(`
    SELECT id, company, website, "contactName", "contactEmail", "vendorType", "outreachAngle"
    FROM prospects
    WHERE ("vendorType" IS NOT NULL AND "vendorType" != 'robot_oem')
       OR "outreachAngle" = 'partner'
    ORDER BY company
  `);

  const partners = result.rows;
  console.log(`Found ${partners.length} ecosystem partner prospects to enrich\n`);

  // Title targets by vendor type
  const TITLE_TARGETS = {
    exhibit_house: ["Director of Technology", "VP Operations", "Show Services Manager", "Director of Client Services", "Account Executive", "VP Technology"],
    freight: ["Director of Trade Show Logistics", "VP Operations", "Account Manager", "Director of Special Services", "Trade Show Coordinator"],
    av_electrical: ["Director of Technology", "VP Operations", "Account Executive", "Director of Event Technology", "Technical Director"],
    venue: ["Director of Operations", "VP Convention Services", "Director of Technology", "Convention Services Manager", "Director of Exhibitor Services"],
    agency: ["VP Technology", "Director of Operations", "Account Director", "Director of Production", "Chief Technology Officer"],
  };

  let enriched = 0;
  let contactsFound = 0;
  let skipped = 0;

  for (const partner of partners) {
    console.log(`\n[${enriched + skipped + 1}/${partners.length}] ${partner.company} (${partner.vendorType ?? "partner"})`);

    // Stagger requests to avoid rate limits
    await new Promise(r => setTimeout(r, 500));

    // 1. Apollo org search
    const org = await apolloSearchOrg(partner.company, partner.website);
    if (org) {
      console.log(`  ✓ Apollo org found: ${org.name} (${org.website_url ?? "no website"})`);
    } else {
      console.log(`  ✗ Apollo org not found`);
    }

    // 2. Apollo people search — use partner-specific titles
    let bestContact = null;
    if (org?.id) {
      const titles = TITLE_TARGETS[partner.vendorType] ?? TITLE_TARGETS.exhibit_house;
      const people = await apolloSearchPeople(org.id, partner.company, titles);

      if (people.length > 0) {
        // Pick the best contact: prefer someone with an email
        bestContact = people.find(p => p.email) ?? people[0];
        console.log(`  ✓ Contact found: ${bestContact.name} — ${bestContact.title} (${bestContact.email ?? "no email"})`);
        contactsFound++;
      } else {
        console.log(`  ✗ No contacts found in Apollo`);
      }
    }

    // 3. AI research
    const research = await aiResearchPartner(partner.company, partner.vendorType, partner.website);
    if (research) {
      console.log(`  ✓ AI research complete: ${research.partnershipAngle?.slice(0, 80) ?? ""}...`);
    }

    // 4. Update prospect record with contact info if found
    if (bestContact || research) {
      const updates = [];
      const values = [];
      let idx = 1;

      if (bestContact?.name && !partner.contactName) {
        updates.push(`"contactName" = $${idx++}`);
        values.push(bestContact.name);
      }
      if (bestContact?.email && !partner.contactEmail) {
        updates.push(`"contactEmail" = $${idx++}`);
        values.push(bestContact.email);
      }
      if (bestContact?.title) {
        updates.push(`"contactTitle" = $${idx++}`);
        values.push(bestContact.title);
      }
      if (bestContact?.linkedin_url) {
        updates.push(`"contactLinkedIn" = $${idx++}`);
        values.push(bestContact.linkedin_url);
      }
      if (bestContact?.email_status) {
        const confidence = bestContact.email_status === "verified" ? "verified"
          : bestContact.email_status === "likely" ? "high"
          : bestContact.email_status === "guessed" ? "medium" : "low";
        updates.push(`"emailConfidence" = $${idx++}`);
        values.push(confidence);
      }

      // Store AI research in notes if we have it and no existing notes
      if (research?.whyStageGate && !partner.notes) {
        const noteText = [
          research.companyOverview,
          `Partnership angle: ${research.partnershipAngle}`,
          `Why StageGate: ${research.whyStageGate}`,
          `Key contacts to target: ${research.keyContacts}`,
          `Show presence: ${research.showPresence}`,
        ].filter(Boolean).join("\n\n");
        updates.push(`notes = $${idx++}`);
        values.push(noteText);
      }

      if (updates.length > 0) {
        values.push(partner.id);
        await client.query(
          `UPDATE prospects SET ${updates.join(", ")} WHERE id = $${idx}`,
          values
        );
        console.log(`  ✓ Updated ${updates.length} fields in DB`);
        enriched++;
      } else {
        console.log(`  → No new data to update`);
        skipped++;
      }
    } else {
      skipped++;
    }
  }

  await client.end();

  console.log(`\n${"─".repeat(60)}`);
  console.log(`Partner Enrichment Complete`);
  console.log(`  Total partners:   ${partners.length}`);
  console.log(`  Enriched:         ${enriched}`);
  console.log(`  Contacts found:   ${contactsFound}`);
  console.log(`  Skipped (no data): ${skipped}`);
}

main().catch(e => {
  console.error("Enrichment failed:", e.message);
  process.exit(1);
});
