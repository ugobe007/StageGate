/**
 * Apollo.io organization lookup — shared by website resolution and contact verify.
 */

export interface ApolloOrgHit {
  id: string;
  name: string;
  website_url?: string | null;
}

export function apolloEnabled(): boolean {
  return Boolean(process.env.APOLLO_API_KEY?.trim());
}

export async function apolloSearchOrg(
  company: string,
  website?: string | null,
): Promise<ApolloOrgHit | null> {
  const key = process.env.APOLLO_API_KEY?.trim();
  if (!key || !company?.trim()) return null;

  try {
    const body: Record<string, unknown> = {
      q_organization_name: company.trim(),
      page: 1,
      per_page: 1,
    };
    if (website?.trim()) body.q_organization_website_url = website.trim();

    const res = await fetch("https://api.apollo.io/v1/mixed_companies/search", {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { organizations?: ApolloOrgHit[] };
    return data.organizations?.[0] ?? null;
  } catch {
    return null;
  }
}

/** Normalize Apollo / manual website strings to https://domain form. */
export function normalizeWebsiteUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (!url.hostname.includes(".")) return null;
    return `https://${url.hostname.replace(/^www\./, "")}`;
  } catch {
    const cleaned = trimmed
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      ?.toLowerCase();
    return cleaned?.includes(".") ? `https://${cleaned}` : null;
  }
}
