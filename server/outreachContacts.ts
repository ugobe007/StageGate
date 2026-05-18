const PREFERRED_ROLE_INBOXES = ["marketing", "sales"] as const;
const DEPRECATED_ROLE_INBOXES = new Set(["partnerships", "info", "support", "hello", "contact"]);

type ProspectLike = {
  company?: string | null;
  website?: string | null;
  contactEmail?: string | null;
};

export function deriveCompanyDomain(prospect: ProspectLike): string | null {
  const website = prospect.website?.trim();
  if (website) {
    try {
      const url = new URL(website.startsWith("http") ? website : `https://${website}`);
      return url.hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      const cleaned = website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]?.toLowerCase();
      if (cleaned?.includes(".")) return cleaned;
    }
  }

  const company = prospect.company?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return company ? `${company}.com` : null;
}

export function roleBasedOutreachEmails(prospect: ProspectLike): string[] {
  const domain = deriveCompanyDomain(prospect);
  if (!domain) return [];
  return PREFERRED_ROLE_INBOXES.map(localPart => `${localPart}@${domain}`);
}

export function isDeprecatedRoleInbox(email: string | null | undefined): boolean {
  if (!email || !email.includes("@")) return false;
  const localPart = email.split("@")[0]?.toLowerCase();
  return Boolean(localPart && DEPRECATED_ROLE_INBOXES.has(localPart));
}

export function selectOutreachEmail(prospect: ProspectLike): string | null {
  const current = prospect.contactEmail?.trim();
  if (current && !isDeprecatedRoleInbox(current)) return current;
  return roleBasedOutreachEmails(prospect)[0] ?? current ?? null;
}

export function outreachEmailPolicySummary(prospect: ProspectLike) {
  const candidates = roleBasedOutreachEmails(prospect);
  return {
    preferred: candidates[0] ?? null,
    candidates,
    replacedDeprecatedInbox: isDeprecatedRoleInbox(prospect.contactEmail),
  };
}
