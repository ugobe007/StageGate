/**
 * Autonomous Partner & Vendor Outreach — Cal drafts for ecosystem partners.
 *
 * Recipients: discovered partner prospects, vendors directory, logistics partners.
 * Drafts land in draft_emails with audience=partner for human review (Relay never auto-sends).
 */
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { draftEmails } from "../../drizzle/schema";
import {
  bulkSaveCalPartnerDrafts,
  isPartnerProspect,
  listPartnerRecipients,
  type PartnerRecipient,
} from "./partnerEmail";

const DEFAULT_BATCH = Number(process.env.CAL_PARTNER_DRAFT_BATCH) || 40;

export type PartnerOutreachSummary = {
  totalRecipients: number;
  withEmail: number;
  needsEmail: number;
  needsDraft: number;
  pendingReview: number;
  approvedToSend: number;
  sent: number;
  bySource: { prospect: number; vendor: number; logistics_partner: number };
};

export async function hasPendingPartnerDraft(recipientKey: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const byKey = await db
    .select({ id: draftEmails.id })
    .from(draftEmails)
    .where(
      and(
        eq(draftEmails.recipientKey, recipientKey),
        inArray(draftEmails.status, ["pending", "approved"]),
      ),
    )
    .limit(1);
  if (byKey.length > 0) return true;

  const [source, idStr] = recipientKey.split(":");
  const id = Number(idStr);
  if (source === "prospect" && id) {
    const legacy = await db
      .select({ id: draftEmails.id })
      .from(draftEmails)
      .where(
        and(
          eq(draftEmails.prospectId, id),
          inArray(draftEmails.status, ["pending", "approved"]),
        ),
      )
      .limit(1);
    return legacy.length > 0;
  }

  return false;
}

export async function listPartnerRecipientsNeedingDraft(
  limit = DEFAULT_BATCH,
): Promise<PartnerRecipient[]> {
  const recipients = await listPartnerRecipients({ hasEmail: true });
  const needing: PartnerRecipient[] = [];

  for (const r of recipients) {
    if (needing.length >= limit) break;
    if (!(await hasPendingPartnerDraft(r.key))) {
      needing.push(r);
    }
  }

  return needing;
}

export async function getPartnerOutreachSummary(): Promise<PartnerOutreachSummary> {
  const db = await getDb();
  const all = await listPartnerRecipients();
  const withEmail = all.filter((r) => !!r.contactEmail?.trim());

  let needsDraft = 0;
  for (const r of withEmail) {
    if (!(await hasPendingPartnerDraft(r.key))) needsDraft++;
  }

  const partnerDrafts = db
    ? await db.select().from(draftEmails).where(eq(draftEmails.audience, "partner"))
    : [];

  const pendingReview = partnerDrafts.filter((d) => d.status === "pending").length;
  const approvedToSend = partnerDrafts.filter((d) => d.status === "approved").length;
  const sent = partnerDrafts.filter((d) => d.status === "sent").length;

  const bySource = { prospect: 0, vendor: 0, logistics_partner: 0 };
  for (const r of all) {
    bySource[r.source]++;
  }

  return {
    totalRecipients: all.length,
    withEmail: withEmail.length,
    needsEmail: all.length - withEmail.length,
    needsDraft,
    pendingReview,
    approvedToSend,
    sent,
    bySource,
  };
}

/** Cal operator: draft partner/vendor emails that have email and no pending draft. */
export async function refreshPartnerOutreachDraftsCore(options?: {
  limit?: number;
  recipientKeys?: string[];
}): Promise<{ drafted: number; skipped: number; errors: string[] }> {
  const limit = options?.limit ?? DEFAULT_BATCH;
  const errors: string[] = [];

  let keys: string[];
  if (options?.recipientKeys?.length) {
    keys = options.recipientKeys;
  } else {
    const needing = await listPartnerRecipientsNeedingDraft(limit);
    keys = needing.map((r) => r.key);
  }

  if (keys.length === 0) {
    return { drafted: 0, skipped: 0, errors };
  }

  try {
    const result = await bulkSaveCalPartnerDrafts(keys);
    return {
      drafted: result.drafted,
      skipped: result.skipped + (keys.length - result.drafted - result.skipped),
      errors,
    };
  } catch (err) {
    errors.push(String(err).slice(0, 200));
    return { drafted: 0, skipped: keys.length, errors };
  }
}
