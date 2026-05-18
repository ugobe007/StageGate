/**
 * server/email.ts
 * Resend email sending helper + draft_emails DB helpers
 */
import { getDb } from "./db";
import { draftEmails, emailThreads, prospectActivities, prospects } from "../drizzle/schema";
import { eq, inArray } from "drizzle-orm";
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

// ─── Resend send helper ───────────────────────────────────────────────────────

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
}): Promise<{ id: string }> {
  const toArray = Array.isArray(to) ? to : [to];
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_ADDRESS}>`,
      to: toArray,
      subject,
      text: body,
      html: htmlBody ?? body
        .split("\n\n")
        .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join(""),
      // v35: enable Resend native open + click tracking
      open_tracking: true,
      click_tracking: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }

  return res.json();
}

// ─── Draft DB helpers ─────────────────────────────────────────────────────────

export async function getDraftsForProspect(prospectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(draftEmails)
    .where(eq(draftEmails.prospectId, prospectId))
    .orderBy(draftEmails.createdAt);
}

export async function getDraftsWithProspects(statuses: string[]) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      draft: draftEmails,
      prospect: prospects,
    })
    .from(draftEmails)
    .innerJoin(prospects, eq(draftEmails.prospectId, prospects.id))
    .where(inArray(draftEmails.status, statuses))
    .orderBy(draftEmails.createdAt);
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
    .values({ ...data, status: "pending" })
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

  // Write to email_threads (best-effort, no FK constraint)
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

  // Write persistent activity log (separate try so a FK miss never blocks email delivery)
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
