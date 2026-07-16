/** Mirrors server/outreachContacts.prospectNeedsContactFix for Cal workflow UI. */
const GENERIC_LOCAL_PARTS = new Set([
  "marketing", "sales", "info", "support", "hello", "contact",
  "partnerships", "events", "team", "admin", "office", "operations",
  "hi", "help", "press", "media", "careers", "jobs", "noreply", "no-reply",
]);

const DEPRECATED_ROLE_INBOXES = new Set(["partnerships", "info", "support", "hello", "contact"]);

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

export function prospectNeedsContactFix(prospect: {
  contactEmail?: string | null;
  emailConfidence?: string | null;
}): boolean {
  const email = prospect.contactEmail?.trim();
  if (!email || !email.includes("@")) return true;
  if (isGuessedRoleInbox(email) || isDeprecatedRoleInbox(email)) return true;
  const conf = (prospect.emailConfidence ?? "").trim().toLowerCase();
  if (!isSendableEmailConfidence(conf)) return true;
  return false;
}
