/**
 * Lightweight Apollo people lookup — no LLM, for Hunter fallback during enrichment.
 */
import { deriveCompanyDomain, isGuessedRoleInbox, isPlausibleEmail } from "../outreachContacts.js";

const SALES_TITLES = [
  "VP Sales",
  "Head of Sales",
  "Sales Director",
  "Director of Sales",
  "Head of Events",
  "Event Marketing",
  "Events Director",
  "VP Marketing",
  "Head of Marketing",
  "Marketing Director",
  "CEO",
  "COO",
  "Founder",
  "Co-Founder",
  "Business Development",
  "VP Business Development",
];

export type ApolloContactHit = {
  email: string;
  name?: string;
  title?: string;
  confidence: "high" | "medium";
  source: "apollo";
};

export function apolloEnabled(): boolean {
  return Boolean(process.env.APOLLO_API_KEY?.trim());
}

export async function apolloFindBestContact(input: {
  company: string;
  website?: string | null;
}): Promise<ApolloContactHit | null> {
  const key = process.env.APOLLO_API_KEY?.trim();
  if (!key || !input.company?.trim()) return null;

  interface ApolloOrg {
    id: string;
    name: string;
  }
  interface ApolloPerson {
    name?: string;
    title?: string;
    email?: string | null;
    email_status?: string | null;
  }

  let orgId: string | null = null;
  try {
    const orgBody: Record<string, unknown> = {
      q_organization_name: input.company.trim(),
      page: 1,
      per_page: 1,
    };
    const domain = deriveCompanyDomain({ website: input.website });
    if (domain) orgBody.q_organization_website_url = domain;

    const orgRes = await fetch("https://api.apollo.io/v1/mixed_companies/search", {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(orgBody),
    });
    const orgData = (await orgRes.json()) as { organizations?: ApolloOrg[] };
    orgId = orgData.organizations?.[0]?.id ?? null;
  } catch {
    return null;
  }

  if (!orgId) return null;

  try {
    const peopleRes = await fetch("https://api.apollo.io/v1/mixed_people/search", {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        organization_ids: [orgId],
        person_titles: SALES_TITLES,
        page: 1,
        per_page: 8,
      }),
    });
    const peopleData = (await peopleRes.json()) as { people?: ApolloPerson[] };
    const people = peopleData.people ?? [];

    for (const person of people) {
      const email = person.email?.trim().toLowerCase();
      if (!email || !isPlausibleEmail(email) || isGuessedRoleInbox(email)) continue;
      const confidence: "high" | "medium" =
        person.email_status === "verified" ? "high" : "medium";
      return {
        email,
        name: person.name ?? undefined,
        title: person.title ?? undefined,
        confidence,
        source: "apollo",
      };
    }
  } catch {
    return null;
  }

  return null;
}
