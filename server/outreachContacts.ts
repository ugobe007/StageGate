/**
 * Outreach recipient selection.
 *
 * Hard rule (mirrors the ReadyForRobots deliverability fixes): Cal only sends to
 * a real, person-level address that is actually on file. Two guessing patterns
 * that were the dominant hard-bounce sources are now disallowed outright:
 *
 *   1. Company-name → domain fabrication ("Apptronik" → apptronik.com). A domain
 *      guessed from a name resolves in DNS but usually belongs to someone else,
 *      so mail hard-bounces or lands on an unrelated party. Domains must come
 *      from a real website on the record — never from the company name.
 *   2. Guessed role inboxes (marketing@/sales@/info@…). We don't know these are
 *      monitored or even exist; they bounce and burn sender reputation. They are
 *      never used as a send target.
 *
 * When no real address is available, selection returns null and the caller skips
 * the send rather than inventing a recipient.
 */

/**
 * Generic mailbox local-parts that are role/guessed inboxes, not real people.
 * Sending to these was a top bounce source, so they are never a valid target.
 */
export const GENERIC_LOCAL_PARTS = new Set([
  "marketing", "sales", "info", "support", "hello", "contact",
  "partnerships", "events", "team", "admin", "office", "operations",
  "hi", "help", "press", "media", "careers", "jobs", "noreply", "no-reply",
]);

// Retained for backward-compatible call sites that still reference it.
const DEPRECATED_ROLE_INBOXES = new Set(["partnerships", "info", "support", "hello", "contact"]);

type ProspectLike = {
  company?: string | null;
  website?: string | null;
  contactEmail?: string | null;
};

/**
 * Real company email domain from a website URL on the record. Returns null when
 * there is no usable website — we deliberately do NOT fall back to guessing a
 * domain from the company name (see file header).
 */
export function deriveCompanyDomain(prospect: ProspectLike): string | null {
  const website = prospect.website?.trim();
  if (!website) return null;
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, "").toLowerCase() || null;
  } catch {
    const cleaned = website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]?.toLowerCase();
    return cleaned?.includes(".") ? cleaned : null;
  }
}

export function isDeprecatedRoleInbox(email: string | null | undefined): boolean {
  if (!email || !email.includes("@")) return false;
  const localPart = email.split("@")[0]?.toLowerCase();
  return Boolean(localPart && DEPRECATED_ROLE_INBOXES.has(localPart));
}

/** True when the address is a generic/role inbox rather than a real person. */
export function isGuessedRoleInbox(email: string | null | undefined): boolean {
  if (!email || !email.includes("@")) return false;
  const localPart = email.split("@")[0]?.toLowerCase();
  return Boolean(localPart && GENERIC_LOCAL_PARTS.has(localPart));
}

/** Basic RFC-ish sanity check — not a deliverability guarantee (see outreachGate). */
export function isPlausibleEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Extract bare address from Resend/Hunter shapes like `Name <user@domain.com>`. */
export function extractEmailAddress(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const bracket = trimmed.match(/<([^>]+@[^>]+)>/);
  if (bracket?.[1]) {
    const inner = bracket[1].trim().toLowerCase();
    return isPlausibleEmail(inner) ? inner : null;
  }
  const lowered = trimmed.toLowerCase();
  return isPlausibleEmail(lowered) ? lowered : null;
}

/**
 * @deprecated Role-inbox fabrication is disabled. Sending to guessed inboxes was
 * a dominant bounce source. Retained only so existing call sites compile; it now
 * always returns an empty list so nothing fabricates a recipient.
 */
export function roleBasedOutreachEmails(_prospect: ProspectLike): string[] {
  return [];
}

/**
 * The address to send to, or null. Only a real, person-level address already on
 * file qualifies. Guessed role inboxes and fabricated domains are rejected; the
 * caller should skip the send (and let enrichment find a real contact) rather
 * than fall back to a guess.
 */
export function selectOutreachEmail(prospect: ProspectLike): string | null {
  const current = prospect.contactEmail?.trim();
  if (!current) return null;
  if (!isPlausibleEmail(current)) return null;
  if (isGuessedRoleInbox(current)) return null;
  return current;
}

export function outreachEmailPolicySummary(prospect: ProspectLike) {
  const selected = selectOutreachEmail(prospect);
  return {
    preferred: selected,
    candidates: selected ? [selected] : [],
    replacedDeprecatedInbox: isDeprecatedRoleInbox(prospect.contactEmail),
    rejectedGuessedInbox: isGuessedRoleInbox(prospect.contactEmail),
  };
}

/** Confidence levels we will cold-send to after Hunter / ZeroBounce screening. */
export function isSendableEmailConfidence(conf: string | null | undefined): boolean {
  const c = (conf ?? "").trim().toLowerCase();
  return c === "high" || c === "medium" || c === "verified";
}

/** True when the prospect has a real website URL on file (required before email enrichment). */
export function prospectHasUsableWebsite(
  prospect: Pick<ProspectLike, "website">,
): boolean {
  return Boolean(deriveCompanyDomain(prospect));
}

/** True when email/contact still needs Hunter or verify — only when a website exists. */
export function prospectNeedsEmailFix(
  prospect: Pick<ProspectLike, "contactEmail" | "emailConfidence" | "website">,
): boolean {
  if (!prospectHasUsableWebsite(prospect)) return false;
  const email = prospect.contactEmail?.trim();
  if (!email || !email.includes("@")) return true;
  if (isGuessedRoleInbox(email) || isDeprecatedRoleInbox(email)) return true;
  const conf = (prospect.emailConfidence ?? "").trim().toLowerCase();
  if (!isSendableEmailConfidence(conf)) return true;
  return !selectOutreachEmail(prospect);
}

/** Junk / unresolved names — no website means Hunter cannot run. */
export function prospectNeedsWebsite(
  prospect: Pick<ProspectLike, "website">,
): boolean {
  return !prospectHasUsableWebsite(prospect);
}

/** @deprecated Use prospectNeedsEmailFix — kept for existing imports. */
export function prospectNeedsContactFix(
  prospect: Pick<ProspectLike, "contactEmail" | "emailConfidence" | "website">,
): boolean {
  return prospectNeedsEmailFix(prospect);
}
