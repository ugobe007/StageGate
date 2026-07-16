/** Mirrors server/outreachContacts for Cal workflow UI. */

const GENERIC_LOCAL_PARTS = new Set([
  "marketing", "sales", "info", "support", "hello", "contact",
  "partnerships", "events", "team", "admin", "office", "operations",
  "hi", "help", "press", "media", "careers", "jobs", "noreply", "no-reply",
]);

const DEPRECATED_ROLE_INBOXES = new Set(["partnerships", "info", "support", "hello", "contact"]);

function deriveDomain(website?: string | null): string | null {
  const raw = website?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./, "").toLowerCase() || null;
  } catch {
    const cleaned = raw.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]?.toLowerCase();
    return cleaned?.includes(".") ? cleaned : null;
  }
}

function isGuessedRoleInbox(email: string): boolean {
  const local = email.split("@")[0]?.toLowerCase();
  return Boolean(local && GENERIC_LOCAL_PARTS.has(local));
}

function isDeprecatedRoleInbox(email: string): boolean {
  const local = email.split("@")[0]?.toLowerCase();
  return Boolean(local && DEPRECATED_ROLE_INBOXES.has(local));
}

function isSendableEmailConfidence(conf: string): boolean {
  return conf === "high" || conf === "medium" || conf === "verified";
}

export function prospectHasUsableWebsite(prospect: {
  website?: string | null;
}): boolean {
  return Boolean(deriveDomain(prospect.website));
}

export function prospectNeedsWebsite(prospect: {
  website?: string | null;
}): boolean {
  return !prospectHasUsableWebsite(prospect);
}

/** Has website but email still needs Hunter / verify. */
export function prospectNeedsEmailFix(prospect: {
  website?: string | null;
  contactEmail?: string | null;
  emailConfidence?: string | null;
}): boolean {
  if (!prospectHasUsableWebsite(prospect)) return false;
  const email = prospect.contactEmail?.trim();
  if (!email || !email.includes("@")) return true;
  if (isGuessedRoleInbox(email) || isDeprecatedRoleInbox(email)) return true;
  const conf = (prospect.emailConfidence ?? "").trim().toLowerCase();
  if (!isSendableEmailConfidence(conf)) return true;
  return false;
}

/** @deprecated Use prospectNeedsEmailFix */
export function prospectNeedsContactFix(prospect: {
  website?: string | null;
  contactEmail?: string | null;
  emailConfidence?: string | null;
}): boolean {
  return prospectNeedsEmailFix(prospect);
}
