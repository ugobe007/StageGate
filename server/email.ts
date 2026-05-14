/**
 * server/email.ts
 * Resend email sending helper + draft_emails DB helpers
 */
import { getDb } from "./db";
import { draftEmails, prospects } from "../drizzle/schema";
import { eq, inArray } from "drizzle-orm";

const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const FROM_ADDRESS = "outreach@onstage.bot";
const FROM_NAME = "StageGate";

// ─── Resend send helper ───────────────────────────────────────────────────────

export async function sendEmail({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ id: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_ADDRESS}>`,
      to: [to],
      subject,
      text: body,
      html: body
        .split("\n\n")
        .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join(""),
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

export async function markDraftSent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [row] = await db
    .update(draftEmails)
    .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
    .where(eq(draftEmails.id, id))
    .returning();
  return row;
}
