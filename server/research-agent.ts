/**
 * Max — Research agent (AI org).
 *
 * Researches a prospect company using AI + Apollo.io and stores results in
 * prospect_research. Feeds Cal's opportunity queue via listMaxReadyForCal().
 *
 * See docs/ai-org.md · shared/aiOrg.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { prospects, prospectResearch } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";

// ─── DB helper ────────────────────────────────────────────────────────────────

function getDb() {
  const connString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } });
  return drizzle(pool);
}

// ─── Apollo.io helpers ────────────────────────────────────────────────────────

interface ApolloOrg {
  id: string;
  name: string;
  website_url: string;
}

interface ApolloPerson {
  id: string;
  name: string;
  title: string;
  email: string | null;
  email_status: string | null;
  linkedin_url: string | null;
  departments: string[];
}

async function apolloSearchOrg(company: string, website?: string | null): Promise<ApolloOrg | null> {
  const key = process.env.APOLLO_API_KEY;
  if (!key) return null;

  try {
    const body: Record<string, unknown> = { q_organization_name: company, page: 1, per_page: 1 };
    if (website) body.q_organization_website_url = website;

    const res = await fetch("https://api.apollo.io/v1/mixed_companies/search", {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json() as { organizations?: ApolloOrg[] };
    return data.organizations?.[0] ?? null;
  } catch {
    return null;
  }
}

async function apolloSearchPeople(orgId: string, orgName: string): Promise<ApolloPerson[]> {
  const key = process.env.APOLLO_API_KEY;
  if (!key) return [];

  try {
    const res = await fetch("https://api.apollo.io/v1/mixed_people/search", {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        organization_ids: [orgId],
        person_titles: [
          "VP Sales", "Head of Sales", "Sales Director",
          "Head of Events", "Event Marketing", "Events Director",
          "VP Marketing", "Head of Marketing", "Marketing Director",
          "CEO", "COO", "Founder", "Co-Founder", "Business Development",
        ],
        page: 1,
        per_page: 5,
      }),
    });
    const data = await res.json() as { people?: ApolloPerson[] };
    return data.people ?? [];
  } catch {
    return [];
  }
}

// ─── AI research ──────────────────────────────────────────────────────────────

interface ResearchResult {
  companyOverview: string;
  robotSpecs: {
    name?: string; type?: string; height?: string; weight?: string;
    payload?: string; battery?: string; speed?: string;
    sensors?: string[]; useCases?: string[]; price?: string; availability?: string;
  };
  competitiveContext: string;
  useCases: string[];
  whyStageGate: string;
  showIntel: string;
}

async function aiResearchCompany(
  company: string,
  robotName: string | null,
  robotType: string | null,
  shows: string[],
  website: string | null,
): Promise<ResearchResult> {
  const showList = shows.length ? shows.join(", ") : "trade shows in Las Vegas";
  const robotDesc = [robotName, robotType].filter(Boolean).join(" — ") || "robot";

  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a robotics industry analyst and B2B sales intelligence expert. Research companies and their robots to help StageGate — a trade show logistics company — understand prospects. StageGate provides: robot receiving at US ports, customs clearance, warehousing, staging/testing, delivery to booth, on-site support, and return shipping. Output ONLY valid JSON matching the schema provided.`,
      },
      {
        role: "user",
        content: `Research this prospect for StageGate outreach:

Company: ${company}
Robot: ${robotDesc}
Shows attending: ${showList}
Website: ${website ?? "unknown"}

Return a JSON object with exactly these fields:
{
  "companyOverview": "2-3 sentence description of what the company does, their market position, and why they exhibit at trade shows",
  "robotSpecs": {
    "name": "robot product name",
    "type": "humanoid | AMR | service | industrial | quadruped | other",
    "height": "height if known",
    "weight": "weight if known",
    "payload": "payload capacity if known",
    "battery": "battery life if known",
    "speed": "max speed if known",
    "sensors": ["list of key sensors"],
    "useCases": ["list of primary use cases"],
    "price": "price range if known or 'not disclosed'",
    "availability": "commercial availability status"
  },
  "competitiveContext": "1-2 sentences comparing this robot to 2-3 key competitors in the same category (humanoid/AMR/service etc)",
  "useCases": ["3-5 specific use cases for this robot at trade shows or in commercial deployment"],
  "whyStageGate": "1-2 sentences explaining specifically why this company needs StageGate services — reference their robot's size/complexity/origin country",
  "showIntel": "1-2 sentences about what this company typically does at ${showList} — demo focus, booth size, typical logistics challenges"
}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "prospect_research",
        strict: true,
        schema: {
          type: "object",
          properties: {
            companyOverview: { type: "string" },
            robotSpecs: {
              type: "object",
              properties: {
                name: { type: "string" }, type: { type: "string" },
                height: { type: "string" }, weight: { type: "string" },
                payload: { type: "string" }, battery: { type: "string" },
                speed: { type: "string" },
                sensors: { type: "array", items: { type: "string" } },
                useCases: { type: "array", items: { type: "string" } },
                price: { type: "string" }, availability: { type: "string" },
              },
              required: ["name", "type", "sensors", "useCases"],
              additionalProperties: false,
            },
            competitiveContext: { type: "string" },
            useCases: { type: "array", items: { type: "string" } },
            whyStageGate: { type: "string" },
            showIntel: { type: "string" },
          },
          required: ["companyOverview", "robotSpecs", "competitiveContext", "useCases", "whyStageGate", "showIntel"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = result.choices?.[0]?.message?.content ?? "{}";
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return parsed as ResearchResult;
}

// ─── Main research function ───────────────────────────────────────────────────

export async function researchProspect(prospectId: number): Promise<void> {
  const db = getDb();

  // Load prospect
  const [prospect] = await db.select().from(prospects).where(eq(prospects.id, prospectId));
  if (!prospect) throw new Error(`Prospect ${prospectId} not found`);

  // Mark as running
  await db
    .insert(prospectResearch)
    .values({ prospectId, researchStatus: "running" })
    .onConflictDoUpdate({
      target: prospectResearch.prospectId,
      set: { researchStatus: "running", researchError: null, updatedAt: new Date() },
    });

  try {
    const shows = (prospect.shows as string[] | null) ?? [];

    // Run AI research and Apollo lookup in parallel
    const [aiResult, apolloOrg] = await Promise.all([
      aiResearchCompany(prospect.company, prospect.robotName, prospect.robotType, shows, prospect.website),
      apolloSearchOrg(prospect.company, prospect.website),
    ]);

    // Get decision makers from Apollo
    let decisionMakers: Array<{
      name: string; title: string; email?: string;
      emailConfidence?: string; linkedIn?: string; department?: string;
    }> = [];

    if (apolloOrg) {
      const people = await apolloSearchPeople(apolloOrg.id, prospect.company);
      decisionMakers = people.map(p => ({
        name: p.name,
        title: p.title ?? "",
        email: p.email ?? undefined,
        emailConfidence: p.email_status ?? undefined,
        linkedIn: p.linkedin_url ?? undefined,
        department: p.departments?.[0] ?? undefined,
      }));
    }

    // If Apollo found no one, use existing prospect contact as fallback
    if (decisionMakers.length === 0 && prospect.contactName) {
      decisionMakers = [{
        name: prospect.contactName,
        title: prospect.contactTitle ?? "",
        email: prospect.contactEmail ?? undefined,
        emailConfidence: prospect.emailConfidence ?? "low",
        linkedIn: prospect.contactLinkedIn ?? undefined,
      }];
    }

    // Every prospect should have its own company-domain outreach candidates.
    // Preferred order replaces unreliable partnerships/info/support/hello guesses.
    const existingEmails = new Set(
      decisionMakers
        .map(person => person.email?.toLowerCase())
        .filter((email): email is string => Boolean(email))
    );
    // roleBasedOutreachEmails is intentionally empty — never invent role inboxes.

    // Save results
    await db
      .insert(prospectResearch)
      .values({
        prospectId,
        companyOverview: aiResult.companyOverview,
        robotSpecs: aiResult.robotSpecs,
        competitiveContext: aiResult.competitiveContext,
        useCases: aiResult.useCases,
        whyStageGate: aiResult.whyStageGate,
        showIntel: aiResult.showIntel,
        decisionMakers,
        apolloOrgId: apolloOrg?.id ?? null,
        researchStatus: "done",
        researchedAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: prospectResearch.prospectId,
        set: {
          companyOverview: aiResult.companyOverview,
          robotSpecs: aiResult.robotSpecs,
          competitiveContext: aiResult.competitiveContext,
          useCases: aiResult.useCases,
          whyStageGate: aiResult.whyStageGate,
          showIntel: aiResult.showIntel,
          decisionMakers,
          apolloOrgId: apolloOrg?.id ?? null,
          researchStatus: "done",
          researchedAt: new Date(),
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(prospectResearch)
      .set({ researchStatus: "failed", researchError: msg, updatedAt: new Date() })
      .where(eq(prospectResearch.prospectId, prospectId));
    throw err;
  }
}

// ─── Batch job: research all pending prospects ────────────────────────────────

export async function researchAllPendingProspects(): Promise<{ processed: number; failed: number }> {
  const db = getDb();

  // Get all prospects that haven't been researched yet
  const allProspects = await db.select({ id: prospects.id }).from(prospects);
  const researched = await db.select({ prospectId: prospectResearch.prospectId }).from(prospectResearch)
    .where(eq(prospectResearch.researchStatus, "done"));

  const researchedIds = new Set(researched.map(r => r.prospectId));
  const pending = allProspects.filter(p => !researchedIds.has(p.id));

  let processed = 0;
  let failed = 0;

  for (const p of pending) {
    try {
      await researchProspect(p.id);
      processed++;
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch {
      failed++;
    }
  }

  console.log(
    `[Max research] processed=${processed} failed=${failed}`,
  );

  return { processed, failed };
}
