/**
 * server/email.ts
 * Resend email sending helper + draft_emails DB helpers
 */
import { getDb } from "./db";
import {
  draftEmails,
  emailThreads,
  logisticsPartners,
  prospectActivities,
  prospects,
  vendors,
} from "../drizzle/schema";
import { and, eq, inArray } from "drizzle-orm";
import { selectOutreachEmail } from "./outreachContacts";

const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const FROM_ADDRESS = "outreach@onstage.bot";
const FROM_NAME = "StageGate";

type ProspectEmailTarget = {
  id: number;
  company?: string | null;
  website?: string | null;
  contactEmail?: string | null;
};

export type OutreachAudience = "prospect" | "partner" | "all";

export type OutreachRecipient = {
  company: string;
  contactName: string | null;
  contactEmail: string | null;
  sourceLabel?: string;
  audience: "prospect" | "partner";
  recipientKey?: string | null;
};

export type UnifiedDraftEntry = {
  draft: typeof draftEmails.$inferSelect;
  prospect: typeof prospects.$inferSelect | null;
  recipient: OutreachRecipient;
};

/** Partner/vendor drafts — includes rows keyed by vendor, logistics partner, or partner prospect. */
export function isPartnerAudienceDraft(draft: {
  audience?: string | null;
  vendorId?: number | null;
  logisticsPartnerId?: number | null;
  recipientKey?: string | null;
}): boolean {
  if (draft.audience === "partner") return true;
  if (draft.vendorId != null || draft.logisticsPartnerId != null) return true;
  const key = draft.recipientKey ?? "";
  return key.startsWith("vendor:") || key.startsWith("logistics_partner:");
}

export function draftRecipientKey(draft: {
  recipientKey?: string | null;
  vendorId?: number | null;
  logisticsPartnerId?: number | null;
  prospectId?: number | null;
}): string | null {
  if (draft.recipientKey) return draft.recipientKey;
  if (draft.vendorId != null) return `vendor:${draft.vendorId}`;
  if (draft.logisticsPartnerId != null) return `logistics_partner:${draft.logisticsPartnerId}`;
  if (draft.prospectId != null) return `prospect:${draft.prospectId}`;
  return null;
}

function matchesAudienceFilter(
  draft: typeof draftEmails.$inferSelect,
  audience: OutreachAudience,
): boolean {
  if (audience === "all") return true;
  if (audience === "partner") return isPartnerAudienceDraft(draft);
  return draft.audience === "prospect" || (!isPartnerAudienceDraft(draft) && draft.audience !== "partner");
}

// ─── Resend send helper ───────────────────────────────────────────────────────

function _isNotificationUrlError(errText: string): boolean {
  const t = errText.toLowerCase();
  return ["notification service", "notification_service", "notification url",
    "notification_url", "not set", "not configured", "inbound"].some(kw => t.includes(kw));
}

export async function sendEmail({
  to,
  subject,
  body,
  htmlBody,
}: {
  to: string | string[];
  subject: string;
  body: string;
  /** Optional: provide a full HTML document to send instead of auto-converting body */
  htmlBody?: string;
}): Promise<{ id: string; warning?: string }> {
  const toArray = Array.isArray(to) ? to : [to];
  const htmlFallback = htmlBody ?? body
    .split("\n\n")
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  const buildPayload = (withTracking: boolean) => ({
    from: `${FROM_NAME} <${FROM_ADDRESS}>`,
    to: toArray,
    subject,
    text: body,
    html: htmlFallback,
    ...(withTracking ? { open_tracking: true, click_tracking: true } : {}),
  });

  const attempt = async (withTracking: boolean) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildPayload(withTracking)),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error ${res.status}: ${err}`);
    }
    return res.json() as Promise<{ id: string }>;
  };

  try {
    return await attempt(true);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (_isNotificationUrlError(msg)) {
      console.warn("[email] Resend notification URL not configured — retrying without tracking. Configure webhook at: https://resend.com/webhooks");
      try {
        const result = await attempt(false);
        return {
          ...result,
          warning: "Email sent without open/click tracking. Configure Resend webhook to enable tracking.",
        };
      } catch (e2) {
        const msg2 = e2 instanceof Error ? e2.message : String(e2);
        if (_isNotificationUrlError(msg2)) {
          throw new Error(
            "Resend inbound not configured: go to resend.com → Domains → onstage.bot → Inbound → set Notification URL to https://stagegate-production.up.railway.app/api/webhooks/resend-inbound"
          );
        }
        throw e2;
      }
    }
    throw e;
  }
}

// ─── Draft DB helpers ─────────────────────────────────────────────────────────

function buildRecipientFromRow(row: {
  draft: typeof draftEmails.$inferSelect;
  prospect: typeof prospects.$inferSelect | null;
  vendor: typeof vendors.$inferSelect | null;
  logisticsPartner: typeof logisticsPartners.$inferSelect | null;
}): OutreachRecipient {
  const { draft, prospect, vendor, logisticsPartner } = row;
  if (prospect) {
    return {
      company: prospect.company,
      contactName: prospect.contactName,
      contactEmail: prospect.contactEmail,
      sourceLabel: "Prospect",
      audience: "prospect",
      recipientKey: draft.recipientKey ?? `prospect:${prospect.id}`,
    };
  }
  if (vendor) {
    return {
      company: vendor.name,
      contactName: vendor.contactName,
      contactEmail: vendor.contactEmail,
      sourceLabel: "Vendor",
      audience: "partner",
      recipientKey: draft.recipientKey ?? `vendor:${vendor.id}`,
    };
  }
  if (logisticsPartner) {
    return {
      company: logisticsPartner.name,
      contactName: logisticsPartner.contactName,
      contactEmail: logisticsPartner.contactEmail,
      sourceLabel: "Partner",
      audience: "partner",
      recipientKey: draft.recipientKey ?? `logistics_partner:${logisticsPartner.id}`,
    };
  }
  return {
    company: "Unknown recipient",
    contactName: null,
    contactEmail: null,
    audience: draft.audience === "partner" ? "partner" : "prospect",
    recipientKey: draft.recipientKey,
  };
}

function parseRecipientKey(key: string): {
  prospectId?: number;
  vendorId?: number;
  logisticsPartnerId?: number;
} {
  const [source, idStr] = key.split(":");
  const id = Number(idStr);
  if (!source || !id) throw new Error("Invalid recipient key");
  if (source === "prospect") return { prospectId: id };
  if (source === "vendor") return { vendorId: id };
  if (source === "logistics_partner") return { logisticsPartnerId: id };
  throw new Error("Unknown recipient source");
}

export async function getDraftsForProspect(prospectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(draftEmails)
    .where(eq(draftEmails.prospectId, prospectId))
    .orderBy(draftEmails.createdAt);
}

/** @deprecated Use getDraftsWithRecipients */
export async function getDraftsWithProspects(statuses: string[]) {
  const entries = await getDraftsWithRecipients(statuses, "prospect");
  return entries.filter((e) => e.prospect).map((e) => ({
    draft: e.draft,
    prospect: e.prospect!,
  }));
}

export async function getDraftsWithRecipients(
  statuses: string[],
  audience: OutreachAudience = "all",
): Promise<UnifiedDraftEntry[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      draft: draftEmails,
      prospect: prospects,
      vendor: vendors,
      logisticsPartner: logisticsPartners,
    })
    .from(draftEmails)
    .leftJoin(prospects, eq(draftEmails.prospectId, prospects.id))
    .leftJoin(vendors, eq(draftEmails.vendorId, vendors.id))
    .leftJoin(logisticsPartners, eq(draftEmails.logisticsPartnerId, logisticsPartners.id))
    .where(inArray(draftEmails.status, statuses))
    .orderBy(draftEmails.createdAt);

  const filtered = rows.filter((r) => matchesAudienceFilter(r.draft, audience));

  return filtered.map((row) => ({
    draft: row.draft,
    prospect: row.prospect,
    recipient: buildRecipientFromRow(row),
  }));
}

export async function getDraftCountByAudience(audience: OutreachAudience = "all") {
  const db = await getDb();
  if (!db) return { pending: 0, approved: 0, sent: 0, lastSentAt: null as Date | null };

  const rows = await db.select().from(draftEmails);
  const filtered = rows.filter((r) => matchesAudienceFilter(r, audience));

  const pending = filtered.filter((r) => r.status === "pending").length;
  const approved = filtered.filter((r) => r.status === "approved").length;
  const sent = filtered.filter((r) => r.status === "sent").length;
  const lastSent = filtered
    .filter((r) => r.status === "sent" && r.sentAt)
    .sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0))[0];

  return { pending, approved, sent, lastSentAt: lastSent?.sentAt ?? null };
}

export async function createDraft(data: {
  prospectId: number;
  subject: string;
  body: string;
  agentReasoning?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [row] = await db
    .insert(draftEmails)
    .values({
      ...data,
      audience: "prospect",
      recipientKey: `prospect:${data.prospectId}`,
      status: "pending",
    })
    .returning();
  return row;
}

export async function createPartnerDraft(data: {
  recipientKey: string;
  subject: string;
  body: string;
  agentReasoning?: string;
  replaceExisting?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const refs = parseRecipientKey(data.recipientKey);
  const audience = "partner" as const;

  if (data.replaceExisting !== false) {
    await db
      .delete(draftEmails)
      .where(
        and(
          eq(draftEmails.recipientKey, data.recipientKey),
          inArray(draftEmails.status, ["pending", "approved"]),
        ),
      );
  }

  const [row] = await db
    .insert(draftEmails)
    .values({
      ...refs,
      recipientKey: data.recipientKey,
      audience,
      subject: data.subject,
      body: data.body,
      agentReasoning: data.agentReasoning ?? "Cal partner outreach draft",
      status: "pending",
    })
    .returning();
  return row;
}

export async function updateDraft(
  id: number,
  data: Partial<{ subject: string; body: string; status: string }>
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [row] = await db
    .update(draftEmails)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(draftEmails.id, id))
    .returning();
  return row;
}

export async function markDraftSent(id: number, resendMessageId?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [row] = await db
    .update(draftEmails)
    .set({ status: "sent", sentAt: new Date(), updatedAt: new Date(), ...(resendMessageId ? { resendMessageId } : {}) })
    .where(eq(draftEmails.id, id))
    .returning();
  return row;
}

export function getProspectOutreachEmail(prospect: ProspectEmailTarget): string | null {
  return selectOutreachEmail(prospect);
}

export function getDraftOutreachEmail(entry: UnifiedDraftEntry): string | null {
  if (entry.prospect) {
    return getProspectOutreachEmail(entry.prospect);
  }
  return entry.recipient.contactEmail?.trim() || null;
}

export async function recordOutboundCommunication({
  prospect,
  subject,
  body,
  resendMessageId,
  source = "draft",
}: {
  prospect: ProspectEmailTarget;
  subject: string;
  body: string;
  resendMessageId?: string;
  source?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const toEmail = getProspectOutreachEmail(prospect);
  if (!toEmail) return;

  try {
    await db.insert(emailThreads).values({
      prospectId: prospect.id,
      threadId: `stagegate-${prospect.id}-${Date.now()}`,
      direction: "outbound",
      fromAddress: FROM_ADDRESS,
      toAddress: toEmail,
      subject,
      body,
      resendMessageId,
    });
  } catch (err) {
    console.error("[email] emailThreads insert failed:", err);
  }

  try {
    await db.insert(prospectActivities).values({
      prospectId: prospect.id,
      type: "email_sent",
      title: subject,
      description: `Outbound email sent to ${toEmail}`,
      metadata: { source, messageId: resendMessageId ?? null, toEmail } as Record<string, unknown>,
    });
  } catch (err) {
    console.error("[email] prospectActivities insert failed (prospectId:", prospect.id, "):", err);
  }
}

/** Send a draft_emails row — prospect OEM or partner/vendor audience. */
export async function sendUnifiedDraftEntry(
  entry: UnifiedDraftEntry,
): Promise<{ sentTo: string; messageId?: string; warning?: string }> {
  const toEmail = getDraftOutreachEmail(entry);
  if (!toEmail) {
    throw new Error(`${entry.recipient.company} has no email address`);
  }

  if (isPartnerAudienceDraft(entry.draft)) {
    const recipientKey =
      entry.recipient.recipientKey ?? draftRecipientKey(entry.draft);
    if (!recipientKey) {
      throw new Error(`${entry.recipient.company}: missing partner recipient key`);
    }
    const { sendPartnerOutreachEmail } = await import("./services/partnerEmail");
    const allowTeam = /^Hi team,/m.test(entry.draft.body);
    return sendPartnerOutreachEmail({
      recipientKey,
      subject: entry.draft.subject,
      body: entry.draft.body,
      allowTeamGreeting: allowTeam,
    });
  }

  if (!entry.prospect) {
    throw new Error("Prospect not found for draft");
  }

  // Send gate: reject guessed inboxes, suppressed addresses, and dead domains
  // before hitting Resend (mirrors the automated Cal path).
  {
    const { screenRecipient } = await import("./outreachGate.js");
    const { getDb } = await import("./db.js");
    const gateDb = await getDb();
    const screen = await screenRecipient(gateDb, toEmail);
    if (!screen.ok) {
      throw new Error(`Recipient failed the send gate (${screen.reason}): ${toEmail}`);
    }
  }

  let sendResult: { id: string; warning?: string } | undefined;
  let deliveryWarning: string | undefined;
  try {
    sendResult = await sendEmail({
      to: toEmail,
      subject: entry.draft.subject,
      body: entry.draft.body,
    });
    if (sendResult?.warning) deliveryWarning = sendResult.warning;
  } catch (sendErr) {
    const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
    console.error("[sendUnifiedDraftEntry] Resend delivery failed:", msg);
    deliveryWarning = msg.startsWith("Resend inbound not configured")
      ? "Email queued but not delivered — configure Resend inbound: resend.com → Domains → onstage.bot → Inbound → Notification URL: https://stagegate-production.up.railway.app/api/webhooks/resend-inbound"
      : `Email delivery failed: ${msg}`;
  }

  if (sendResult?.id) {
    await recordOutboundCommunication({
      prospect: entry.prospect,
      subject: entry.draft.subject,
      body: entry.draft.body,
      resendMessageId: sendResult.id,
      source: "draft_send",
    });
  }

  const { updateProspectStatus } = await import("./db");
  await updateProspectStatus(entry.prospect.id, "contacted");

  return {
    sentTo: toEmail,
    messageId: sendResult?.id,
    warning: deliveryWarning,
  };
}
