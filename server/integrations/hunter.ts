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

/** Minimum Hunter scores for accepting an address as a send target (env-tunable). */
function clampScore(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, 0), 100);
}

/** Tunable floors — 80 matches typical Hunter domain-search scores while still
 * rejecting weak hits. Invalid/disposable addresses remain blocked separately.
 * Raise via env if bounce rate climbs again. */
export const HUNTER_MIN_FINDER_SCORE = clampScore(process.env.HUNTER_MIN_FINDER_SCORE, 80);
export const HUNTER_MIN_DOMAIN_CONFIDENCE = clampScore(process.env.HUNTER_MIN_DOMAIN_CONFIDENCE, 80);
/** Slightly lower bar when replacing a bounced/quarantined address (still personal-only). */
export const HUNTER_MIN_RECOVERY_CONFIDENCE = clampScore(process.env.HUNTER_MIN_RECOVERY_CONFIDENCE, 75);

export type HunterErrorKind = "disabled" | "rate_limit" | "auth" | "credits" | "api" | "timeout";

export interface HunterError {
  kind: HunterErrorKind;
  message: string;
  status?: number;
}

let _lastHunterError: HunterError | null = null;

export function consumeLastHunterError(): HunterError | null {
  const err = _lastHunterError;
  _lastHunterError = null;
  return err;
}

function classifyHunterFailure(status: number, body: string): HunterError {
  let parsed: { errors?: Array<{ id?: string; code?: number; details?: string }> } | null = null;
  try {
    parsed = JSON.parse(body) as { errors?: Array<{ id?: string; code?: number; details?: string }> };
  } catch {
    parsed = null;
  }
  const first = parsed?.errors?.[0];
  const details = (first?.details ?? body).toLowerCase();
  const id = (first?.id ?? "").toLowerCase();

  if (status === 429) return { kind: "rate_limit", message: "Hunter rate limit (429)", status };
  if (status === 401 || id.includes("authentication")) {
    return { kind: "auth", message: first?.details ?? "Hunter authentication failed", status };
  }
  if (
    status === 402 ||
    id.includes("credit") ||
    id.includes("payment") ||
    details.includes("credit") ||
    details.includes("quota")
  ) {
    return { kind: "credits", message: first?.details ?? "Hunter credits exhausted", status };
  }
  return {
    kind: "api",
    message: first?.details ?? (body.slice(0, 200) || `HTTP ${status}`),
    status,
  };
}

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

export function scoreToConfidence(score: number): EmailConfidence {
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
  if (!key) {
    _lastHunterError = { kind: "disabled", message: "HUNTER_API_KEY not set" };
    return null;
  }

  const url = new URL(`${HUNTER_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  url.searchParams.set("api_key", key);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const err = classifyHunterFailure(res.status, body);
      _lastHunterError = err;
      console.warn(`[hunter] ${path} failed ${res.status}: ${err.message}`);
      return null;
    }
    _lastHunterError = null;
    return (await res.json()) as T;
  } catch (err) {
    const message = String(err);
    _lastHunterError = message.includes("abort")
      ? { kind: "timeout", message: "Hunter request timed out" }
      : { kind: "api", message };
    console.warn(`[hunter] ${path} error: ${message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function domainSearch(
  domain: string,
  opts: { company?: string } = {},
): Promise<{ pattern?: string; organization?: string; emails: HunterEmail[] } | null> {
  const params: Record<string, string> = { limit: "20" };
  if (domain) params.domain = domain;
  if (opts.company) params.company = opts.company;
  const json = await hunterGet<{
    data?: { pattern?: string; organization?: string; emails?: HunterEmail[] };
  }>("/domain-search", params);
  if (!json?.data) return null;
  return {
    pattern: json.data.pattern ?? undefined,
    organization: json.data.organization ?? undefined,
    emails: json.data.emails ?? [],
  };
}

export interface DomainFinderHit {
  domain: string;
  companyName?: string;
  emailCount?: number;
}

/** Resolve a company name → domain via Hunter Domain Finder (free, no search credits). */
export async function domainFinder(
  company: string,
  opts: { limit?: number; perfectMatch?: boolean } = {},
): Promise<DomainFinderHit | null> {
  const trimmed = company?.trim();
  if (!trimmed || trimmed.length < 3) return null;

  const json = await hunterGet<{
    data?: Array<{ domain?: string; company_name?: string; email_count?: number }>;
  }>("/domain-finder", {
    company: trimmed,
    limit: String(Math.min(Math.max(opts.limit ?? 3, 1), 10)),
    ...(opts.perfectMatch ? { perfect_match: "true" } : {}),
  });

  const hit = json?.data?.[0];
  if (!hit?.domain) return null;
  return {
    domain: hit.domain,
    companyName: hit.company_name ?? undefined,
    emailCount: hit.email_count ?? undefined,
  };
}

/** Normalize Hunter / manual website strings to https://domain form. */
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

/** Company name → website URL using Hunter Domain Finder. */
export async function websiteFromCompanyName(company: string): Promise<string | null> {
  const hit = await domainFinder(company, { limit: 1, perfectMatch: false });
  return normalizeWebsiteUrl(hit?.domain ?? null);
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
export function pickBestDomainEmail(
  emails: HunterEmail[],
  opts: { minConfidence?: number } = {},
): HunterEmail | null {
  const minConfidence = opts.minConfidence ?? HUNTER_MIN_DOMAIN_CONFIDENCE;
  const usable = emails.filter(
    (e) =>
      e.value &&
      e.type === "personal" &&
      (e.confidence ?? 0) >= minConfidence &&
      !UNSENDABLE.has((e.verification?.status ?? "").toLowerCase()),
  );
  if (usable.length === 0) return null;

  return (
    [...usable].sort((a, b) => {
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

const ROLE_ONLY_TOKENS = new Set([
  "marketing", "sales", "operations", "ops", "support", "info", "admin",
  "team", "director", "manager", "lead", "head", "vp", "ceo", "cto", "cfo",
  "president", "founder", "owner", "contact", "inquiry", "enquiries",
]);

function isUsableHunterNamePart(part: string): boolean {
  return /^[A-Za-z][A-Za-z'.-]{0,40}$/.test(part);
}

/**
 * Strip junk / role-only "contact names" before Hunter Email Finder.
 * Returns {} when the string is not a real person (avoids 400 "wrong format").
 */
export function sanitizeContactNameForHunter(name?: string | null): { first?: string; last?: string } {
  const raw = (name ?? "").trim();
  if (!raw || raw.length < 2) return {};
  if (/[\[\]{}<>]/.test(raw)) return {};
  if (/best\s*guess|not\s*provided|name\s*not|\bunknown\b|^none$|^null$|^tbd$/i.test(raw)) {
    return {};
  }
  if (/^n\/?a$/i.test(raw) || /\bn\/a\b/i.test(raw)) return {};

  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.every((p) => ROLE_ONLY_TOKENS.has(p.toLowerCase().replace(/[^a-z]/g, "")))) {
    return {};
  }

  const { first, last } = splitName(raw);
  if (!first || !isUsableHunterNamePart(first)) return {};
  if (last && !isUsableHunterNamePart(last)) return {};
  // Email Finder needs first + last for reliable results
  if (!last) return {};
  return { first, last };
}

/**
 * Find the best real outreach contact for a prospect.
 * Strategy: if we know the contact's name, use Email Finder (returns a verified,
 * person-level email). Otherwise fall back to Domain Search and pick the best
 * decision-maker. Returns null when Hunter is disabled or finds nothing usable.
 */
export async function findBestProspectEmail(
  prospect: ProspectLike,
  opts?: { minDomainConfidence?: number; minFinderScore?: number },
): Promise<HunterContact | null> {
  if (!hunterEnabled()) return null;
  const domain = deriveCompanyDomain(prospect);
  if (!domain) return null;

  const minFinder = opts?.minFinderScore ?? HUNTER_MIN_FINDER_SCORE;
  const minDomain = opts?.minDomainConfidence ?? HUNTER_MIN_DOMAIN_CONFIDENCE;

  const { first, last } = sanitizeContactNameForHunter(prospect.contactName);
  if (first && last) {
    const found = await emailFinder(domain, first, last);
    if (
      found &&
      found.score >= minFinder &&
      !UNSENDABLE.has((found.status ?? "").toLowerCase())
    ) {
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

  const search = await domainSearch(domain, { company: prospect.company ?? undefined });
  const best = search ? pickBestDomainEmail(search.emails, { minConfidence: minDomain }) : null;
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
