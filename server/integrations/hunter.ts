/**
 * Hunter.io integration — real, verified outreach contacts.
 *
 * Replaces StageGate's guessed role inboxes (marketing@domain) with real
 * decision-maker emails found and verified via Hunter's v2 API. Everything here
 * is fail-open: if HUNTER_API_KEY is unset or the API errors/rate-limits, the
 * functions return null and callers fall back to existing behavior.
 *
 * Docs: https://hunter.io/api-documentation/v2
 * Credits: domain-search 1/req (1–10 emails), email-finder 1/req, verifier 0.5/req.
 * Rate limits: domain-search & email-finder 15 req/s; verifier 10 req/s.
 */

import { deriveCompanyDomain } from "../outreachContacts.js";

const HUNTER_BASE = "https://api.hunter.io/v2";
const REQUEST_TIMEOUT_MS = 10_000;

export type EmailConfidence = "high" | "medium" | "low";

export interface HunterContact {
  email: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  confidence: EmailConfidence;
  /** 0–100 Hunter confidence/score. */
  score: number;
  verificationStatus?: string;
  source: "email_finder" | "domain_search";
}

interface HunterEmail {
  value: string;
  type: "personal" | "generic";
  confidence: number;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  seniority?: string | null;
  department?: string | null;
  verification?: { status?: string | null } | null;
}

export function hunterApiKey(): string | null {
  return process.env.HUNTER_API_KEY?.trim() || null;
}

export function hunterEnabled(): boolean {
  return Boolean(hunterApiKey());
}

function scoreToConfidence(score: number): EmailConfidence {
  if (score >= 90) return "high";
  if (score >= 70) return "medium";
  return "low";
}

/** Verification statuses that mean "do not send here." */
const UNSENDABLE = new Set(["invalid", "disposable"]);

async function hunterGet<T>(
  path: string,
  params: Record<string, string>
): Promise<T | null> {
  const key = hunterApiKey();
  if (!key) return null;

  const url = new URL(`${HUNTER_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  url.searchParams.set("api_key", key);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.status === 429) {
      console.warn("[hunter] rate limited (429)");
      return null;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[hunter] ${path} failed ${res.status}: ${body.slice(0, 200)}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[hunter] ${path} error: ${String(err)}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function domainSearch(
  domain: string
): Promise<{ pattern?: string; organization?: string; emails: HunterEmail[] } | null> {
  const json = await hunterGet<{
    data?: { pattern?: string; organization?: string; emails?: HunterEmail[] };
  }>("/domain-search", { domain, limit: "20" });
  if (!json?.data) return null;
  return {
    pattern: json.data.pattern ?? undefined,
    organization: json.data.organization ?? undefined,
    emails: json.data.emails ?? [],
  };
}

export async function emailFinder(
  domain: string,
  firstName: string,
  lastName: string
): Promise<{ email: string; score: number; status?: string } | null> {
  const json = await hunterGet<{
    data?: {
      email?: string | null;
      score?: number | null;
      verification?: { status?: string | null } | null;
    };
  }>("/email-finder", { domain, first_name: firstName, last_name: lastName });
  const email = json?.data?.email;
  if (!email) return null;
  return {
    email,
    score: json?.data?.score ?? 0,
    status: json?.data?.verification?.status ?? undefined,
  };
}

export async function verifyEmail(
  email: string
): Promise<{ status: string; score: number } | null> {
  const json = await hunterGet<{
    data?: { status?: string | null; score?: number | null };
  }>("/email-verifier", { email });
  if (!json?.data?.status) return null;
  return { status: json.data.status, score: json.data.score ?? 0 };
}

/** Departments most relevant to StageGate deployment-advisor outreach, best-first. */
const DEPARTMENT_RANK: Record<string, number> = {
  executive: 6,
  management: 5,
  sales: 4,
  marketing: 3,
  communication: 2,
  operations: 1,
};

/**
 * From a domain-search result, choose the best decision-maker email:
 * prefer personal (named) emails over generic role inboxes, then rank by
 * relevant department, then by Hunter confidence. Drops undeliverable addresses.
 */
export function pickBestDomainEmail(emails: HunterEmail[]): HunterEmail | null {
  const usable = emails.filter(
    (e) => e.value && !UNSENDABLE.has((e.verification?.status ?? "").toLowerCase())
  );
  if (usable.length === 0) return null;

  const personal = usable.filter((e) => e.type === "personal");
  const pool = personal.length > 0 ? personal : usable;

  return (
    [...pool].sort((a, b) => {
      const deptA = DEPARTMENT_RANK[(a.department ?? "").toLowerCase()] ?? 0;
      const deptB = DEPARTMENT_RANK[(b.department ?? "").toLowerCase()] ?? 0;
      if (deptA !== deptB) return deptB - deptA;
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    })[0] ?? null
  );
}

type ProspectLike = {
  company?: string | null;
  website?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
};

function splitName(name?: string | null): { first?: string; last?: string } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { first: parts[0] };
  return { first: parts[0], last: parts[parts.length - 1] };
}

/**
 * Find the best real outreach contact for a prospect.
 * Strategy: if we know the contact's name, use Email Finder (returns a verified,
 * person-level email). Otherwise fall back to Domain Search and pick the best
 * decision-maker. Returns null when Hunter is disabled or finds nothing usable.
 */
export async function findBestProspectEmail(
  prospect: ProspectLike
): Promise<HunterContact | null> {
  if (!hunterEnabled()) return null;
  const domain = deriveCompanyDomain(prospect);
  if (!domain) return null;

  const { first, last } = splitName(prospect.contactName);
  if (first && last) {
    const found = await emailFinder(domain, first, last);
    if (found && !UNSENDABLE.has((found.status ?? "").toLowerCase())) {
      return {
        email: found.email,
        firstName: first,
        lastName: last,
        confidence: scoreToConfidence(found.score),
        score: found.score,
        verificationStatus: found.status,
        source: "email_finder",
      };
    }
  }

  const search = await domainSearch(domain);
  const best = search ? pickBestDomainEmail(search.emails) : null;
  if (!best) return null;
  return {
    email: best.value,
    firstName: best.first_name ?? undefined,
    lastName: best.last_name ?? undefined,
    position: best.position ?? undefined,
    confidence: scoreToConfidence(best.confidence ?? 0),
    score: best.confidence ?? 0,
    verificationStatus: best.verification?.status ?? undefined,
    source: "domain_search",
  };
}
