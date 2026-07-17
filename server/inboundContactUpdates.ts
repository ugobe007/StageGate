/**
 * Detect contact email / website changes announced in inbound replies
 * (auto-replies, OOO, mailbox migrations, reorgs).
 */
import { eq } from "drizzle-orm";
import { getDb } from "./db.js";
import { prospects, prospectActivities } from "../drizzle/schema.js";
import {
  deriveCompanyDomain,
  extractEmailAddress,
  isGuessedRoleInbox,
  isPlausibleEmail,
} from "./outreachContacts.js";
import { isSuppressed } from "./outreachGate.js";

type ProspectRow = typeof prospects.$inferSelect;
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const INTERNAL_DOMAINS = new Set(["onstage.bot", "starsupportinc.com", "readyforrobots.com"]);
const PERSONAL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "hotmail.com", "outlook.com",
  "live.com", "icloud.com", "me.com", "aol.com", "protonmail.com", "proton.me",
]);

const ANNOUNCEMENT_PATTERNS: RegExp[] = [
  /new\s+email\s*[:：]?\s*(?:is\s*)?([^\s<>,;]+@[^\s<>,;]+)/i,
  /email\s+address\s+has\s+changed[^.\n]{0,120}?(?:to|:)\s*([^\s<>,;]+@[^\s<>,;]+)/i,
  /(?:please\s+(?:make\s+sure\s+to\s+)?use|use)\s+(?:this\s+)?(?:address|email)\s*(?:for\s+[^.\n]{0,40})?[:：]?\s*([^\s<>,;]+@[^\s<>,;]+)/i,
  /reach\s+me\s+at\s+([^\s<>,;]+@[^\s<>,;]+)/i,
  /contact\s+me\s+at\s+([^\s<>,;]+@[^\s<>,;]+)/i,
  /(?:my|updated?)\s+email\s+(?:is\s+now\s+|address\s+is\s+)?[:：]?\s*([^\s<>,;]+@[^\s<>,;]+)/i,
];

const AUTO_REPLY_HINTS = [
  /automatic\s+reply/i,
  /auto[-\s]?reply/i,
  /out\s+of\s+office/i,
  /mailbox\s+reorganization/i,
  /email\s+address\s+has\s+changed/i,
  /old\s+mailbox\s+will\s+be\s+suspended/i,
];

export type InboundContactUpdateResult = {
  applied: boolean;
  previousEmail: string | null;
  newEmail: string | null;
  previousWebsite: string | null;
  newWebsite: string | null;
  source: "reply_body" | "reply_from" | null;
  reason?: string;
};

function domainOf(email: string): string | null {
  const parts = email.split("@");
  return parts[1]?.toLowerCase() ?? null;
}

function isBlockedEmail(email: string): boolean {
  const domain = domainOf(email);
  if (!domain) return true;
  if (INTERNAL_DOMAINS.has(domain)) return true;
  if (isGuessedRoleInbox(email)) return true;
  return false;
}

function normalizeCandidate(raw: string): string | null {
  const trimmed = raw.trim();
  const beforeBracket = trimmed.split("<")[0].trim();
  const cleaned = beforeBracket.replace(/^mailto:/i, "").replace(/[>,;.)]+$/, "");
  return extractEmailAddress(cleaned);
}

function sanitizeReplyText(text: string): string {
  return text
    .replace(/<mailto:[^>]+>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

/** Extract email addresses explicitly announced in reply text/HTML. */
export function extractAnnouncedEmails(bodyText: string, bodyHtml?: string): string[] {
  const haystack = sanitizeReplyText([bodyText, stripHtml(bodyHtml ?? "")].filter(Boolean).join("\n"));
  const found = new Set<string>();

  for (const pattern of ANNOUNCEMENT_PATTERNS) {
    const match = haystack.match(pattern);
    if (match?.[1]) {
      const addr = normalizeCandidate(match[1]);
      if (addr && !isBlockedEmail(addr)) found.add(addr);
    }
  }

  if (found.size > 0) return Array.from(found);

  // Fallback: any plausible emails in the first 2k chars when body hints at a change
  const emailRegex = /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/gi;
  for (const match of Array.from(haystack.slice(0, 2000).matchAll(emailRegex))) {
    const addr = normalizeCandidate(match[1] ?? "");
    if (addr && !isBlockedEmail(addr)) found.add(addr);
  }

  return Array.from(found);
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function looksLikeContactChangeReply(subject: string, bodyText: string): boolean {
  const combined = `${subject}\n${bodyText.slice(0, 1500)}`;
  if (AUTO_REPLY_HINTS.some((re) => re.test(combined))) return true;
  return ANNOUNCEMENT_PATTERNS.some((re) => re.test(combined));
}

function deriveWebsiteFromEmail(email: string): string | null {
  const domain = domainOf(email);
  if (!domain || PERSONAL_DOMAINS.has(domain)) return null;
  return `https://${domain}`;
}

function pickBestEmail(
  prospect: ProspectRow,
  fromAddress: string,
  announced: string[],
): { email: string; source: "reply_body" | "reply_from" } | null {
  const current = extractEmailAddress(prospect.contactEmail) ?? prospect.contactEmail?.trim().toLowerCase() ?? null;
  const fromNorm = extractEmailAddress(fromAddress) ?? fromAddress.toLowerCase();

  // Prefer explicitly announced addresses (mailbox migration copy)
  for (const candidate of announced) {
    if (candidate === current) continue;
    if (candidate === fromNorm && !looksLikeContactChangeReply("", announced.join(" "))) continue;
    return { email: candidate, source: "reply_body" };
  }

  // Reply-from differs from stored contact → treat sender as authoritative
  if (fromNorm && current && fromNorm !== current && isPlausibleEmail(fromNorm) && !isBlockedEmail(fromNorm)) {
    return { email: fromNorm, source: "reply_from" };
  }

  return null;
}

/**
 * Apply email/website updates from an inbound reply. Mutates `prospect` in memory
 * when updates are persisted so downstream draft/send uses the new address.
 */
export async function applyInboundContactUpdates(
  db: Db,
  prospect: ProspectRow,
  input: {
    fromAddress: string;
    bodyText: string;
    bodyHtml?: string;
    subject: string;
  },
): Promise<InboundContactUpdateResult> {
  const previousEmail = extractEmailAddress(prospect.contactEmail) ?? prospect.contactEmail ?? null;
  const previousWebsite = prospect.website ?? null;

  const announced = extractAnnouncedEmails(input.bodyText, input.bodyHtml);
  const isContactChange = looksLikeContactChangeReply(input.subject, input.bodyText);
  const picked = pickBestEmail(prospect, input.fromAddress, announced);

  if (!picked) {
    return {
      applied: false,
      previousEmail,
      newEmail: null,
      previousWebsite,
      newWebsite: null,
      source: null,
      reason: isContactChange ? "no_valid_new_email_found" : "no_change_detected",
    };
  }

  if (await isSuppressed(db, picked.email)) {
    return {
      applied: false,
      previousEmail,
      newEmail: picked.email,
      previousWebsite,
      newWebsite: null,
      source: picked.source,
      reason: "suppressed",
    };
  }

  if (picked.email === previousEmail) {
    return {
      applied: false,
      previousEmail,
      newEmail: picked.email,
      previousWebsite,
      newWebsite: null,
      source: picked.source,
      reason: "unchanged",
    };
  }

  const patch: Partial<ProspectRow> = {
    contactEmail: picked.email,
    emailConfidence: "verified",
    repliedAt: prospect.repliedAt ?? new Date(),
    updatedAt: new Date(),
  };

  let newWebsite: string | null = null;
  const proposedSite = deriveWebsiteFromEmail(picked.email);
  const currentDomain = previousWebsite ? deriveCompanyDomain({ website: previousWebsite }) : null;
  const proposedDomain = proposedSite ? deriveCompanyDomain({ website: proposedSite }) : null;

  if (proposedSite && proposedDomain && proposedDomain !== currentDomain) {
    patch.website = proposedSite;
    newWebsite = proposedSite;
  }

  await db.update(prospects).set(patch).where(eq(prospects.id, prospect.id));

  await db.insert(prospectActivities).values({
    prospectId: prospect.id,
    type: "contact_email_updated",
    title: `Contact updated → ${picked.email}`,
    description:
      `Cal detected ${picked.source === "reply_body" ? "a new address in the reply" : "reply from a different address"} ` +
      `(was ${previousEmail ?? "unknown"}).` +
      (newWebsite ? ` Website updated to ${newWebsite}.` : ""),
    metadata: {
      previousEmail,
      newEmail: picked.email,
      previousWebsite,
      newWebsite,
      source: picked.source,
      fromAddress: input.fromAddress,
      subject: input.subject,
      announcedCandidates: announced,
    },
  });

  prospect.contactEmail = picked.email;
  prospect.emailConfidence = "verified";
  if (newWebsite) prospect.website = newWebsite;
  if (!prospect.repliedAt) prospect.repliedAt = patch.repliedAt as Date;

  console.log(
    `[Inbound] Updated contact for ${prospect.company}: ${previousEmail ?? "?"} → ${picked.email}` +
      (newWebsite ? `, website → ${newWebsite}` : ""),
  );

  return {
    applied: true,
    previousEmail,
    newEmail: picked.email,
    previousWebsite,
    newWebsite,
    source: picked.source,
  };
}
