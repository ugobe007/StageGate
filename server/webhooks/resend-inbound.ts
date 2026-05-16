/**
 * Resend Inbound Email Webhook Handler
 *
 * Receives inbound emails sent to @onstage.bot addresses via Resend's
 * inbound routing. Parses the email, matches to a prospect, stores the
 * thread, advances conversation state, and generates a Cal-voice draft
 * for admin review (draft-first mode — no auto-send).
 *
 * State transitions on inbound reply:
 *   discovery / intro_sent / followup_1 / followup_2 / robot_guild → "responded"
 *   responded → "scheduling" (if scheduling intent detected)
 *   scheduling → "scheduling" (stays, admin books the call)
 *
 * Resend inbound webhook payload shape:
 * https://resend.com/docs/api-reference/webhooks/introduction
 */
import type { Request, Response } from "express";
import { getDb } from "../db";
import {
  emailThreads,
  salesAgentConversations,
  prospects,
  prospectActivities,
  draftEmails,
} from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { FRANK_PERSONA, FRANK_SYSTEM_PROMPT } from "../agents/frankPlaybook";

// Cal replies — consistent with outreach engine
const FRANK_FROM = `${FRANK_PERSONA.fromName} <${FRANK_PERSONA.fromEmail}>`;
const ADMIN_BCC = ["bob@starsupportinc.com", "tom@starsupportinc.com"];

// Stages that can be advanced to "awaiting_reply" on inbound reply
const OUTREACH_STAGES = new Set([
  "discovery",
  "intro_sent",
  "followup_1",
  "followup_2",
  "robot_guild",
  "email_opened",
  "link_clicked",
]);

// Keywords that indicate scheduling intent
const SCHEDULING_KEYWORDS = [
  "schedule", "call", "meeting", "talk", "chat", "demo",
  "when can we", "set up a time", "book a time", "calendly",
  "available", "availability", "speak with", "connect",
];

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function resendInboundHandler(req: Request, res: Response) {
  try {
    const payload = req.body as ResendInboundPayload;

    const fromAddress = extractEmail(payload.from ?? "");
    const toAddress = payload.to ?? FRANK_PERSONA.fromEmail;
    const subject = payload.subject ?? "(no subject)";
    const bodyText = payload.text ?? "";
    const bodyHtml = payload.html ?? "";
    const inReplyTo = payload.headers?.["in-reply-to"] ?? payload.inReplyTo ?? null;
    const references = payload.headers?.["references"] ?? payload.references ?? null;
    const messageId = payload.headers?.["message-id"] ?? null;

    if (!fromAddress) {
      return res.status(400).json({ error: "missing from address" });
    }

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "db unavailable" });

    // ── 1. Match prospect by sender email ─────────────────────────────────────
    // Primary: match by email address
    const matchedByEmail = await db
      .select()
      .from(prospects)
      .where(eq(prospects.contactEmail, fromAddress))
      .limit(1);

    let prospect = matchedByEmail[0] ?? null;

    // Fallback: match by In-Reply-To messageId in email_threads
    if (!prospect && inReplyTo) {
      const matchedThread = await db
        .select({ prospectId: emailThreads.prospectId })
        .from(emailThreads)
        .where(eq(emailThreads.resendMessageId, inReplyTo))
        .limit(1);

      if (matchedThread[0]?.prospectId) {
        const matchedProspects = await db
          .select()
          .from(prospects)
          .where(eq(prospects.id, matchedThread[0].prospectId))
          .limit(1);
        prospect = matchedProspects[0] ?? null;
      }
    }

    const prospectId = prospect?.id ?? null;

    // ── 2. Store inbound email in email_threads ───────────────────────────────
    await db.insert(emailThreads).values({
      prospectId: prospectId ?? undefined,
      threadId: inReplyTo ?? messageId ?? `inbound-${Date.now()}`,
      direction: "inbound",
      fromAddress,
      toAddress,
      subject,
      body: bodyText,
      htmlBody: bodyHtml,
      inReplyTo: inReplyTo ?? undefined,
      references: references ?? undefined,
      receivedAt: new Date(),
    });

    if (!prospect || !prospectId) {
      // Unknown sender — log and return
      console.log(`[Inbound] Unknown sender: ${fromAddress} — no matching prospect`);
      return res.json({ ok: true, matched: false });
    }

    // ── 3. Log activity on prospect timeline ──────────────────────────────────
    // v38: include reply body snippet so it's readable in the activity timeline
    // v39: also store full reply body in metadata.replyBody for the expandable UI
    const trimmedBody = bodyText.trim();
    const replySnippet = trimmedBody.slice(0, 300);
    await db.insert(prospectActivities).values({
      prospectId,
      type: "email_replied",
      title: `Reply received: "${subject.slice(0, 80)}"`,
      description: replySnippet
        ? `${replySnippet}${trimmedBody.length > 300 ? "\u2026" : ""}`
        : `Inbound reply from ${fromAddress} — automated follow-ups paused`,
      metadata: { fromAddress, subject, replyBody: trimmedBody || null },
      createdAt: new Date(),
    });

    // ── 4. Advance conversation state ─────────────────────────────────────────
    const existingConvs = await db
      .select()
      .from(salesAgentConversations)
      .where(eq(salesAgentConversations.prospectId, prospectId))
      .limit(1);

    const conv = existingConvs[0] ?? null;
    const currentState = conv?.state ?? "discovery";

    // Detect scheduling intent
    const lowerBody = bodyText.toLowerCase();
    const wantsToSchedule = SCHEDULING_KEYWORDS.some(kw => lowerBody.includes(kw));

    let newState: string;
    if (wantsToSchedule) {
      // Scheduling intent → skip awaiting_reply and go straight to scheduling
      newState = "scheduling";
    } else if (OUTREACH_STAGES.has(currentState) || currentState === "responded") {
      // v37: use awaiting_reply as the canonical "replied, paused" state
      newState = "awaiting_reply";
    } else {
      newState = currentState; // already in awaiting_reply/scheduling/booked — keep
    }

    if (conv) {
      await db
        .update(salesAgentConversations)
        .set({
          state: newState,
          lastActivityAt: new Date(),
          updatedAt: new Date(),
          // Clear nextFollowUpAt — human (or admin) takes over from here
          nextFollowUpAt: null,
        })
        .where(eq(salesAgentConversations.id, conv.id));
    }

    // ── 5. Generate Cal's reply draft (draft-first — no auto-send) ────────────
    await generateFrankDraft({
      prospect,
      subject,
      bodyText,
      inReplyTo,
      references,
      threadId: inReplyTo ?? messageId,
      db,
      prospectId,
      convState: newState,
      wantsToSchedule,
    });

    res.json({ ok: true, matched: true, newState });
  } catch (err) {
    console.error("[Inbound webhook error]", err);
    res.status(500).json({ error: String(err) });
  }
}

// ─── Cal Draft Generator ──────────────────────────────────────────────────────

async function generateFrankDraft({
  prospect,
  subject,
  bodyText,
  inReplyTo,
  references,
  threadId,
  db,
  prospectId,
  convState,
  wantsToSchedule,
}: {
  prospect: typeof prospects.$inferSelect;
  subject: string;
  bodyText: string;
  inReplyTo: string | null;
  references: string | null;
  threadId: string | null;
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>;
  prospectId: number;
  convState: string;
  wantsToSchedule: boolean;
}) {
  // Load thread history for context
  const threadHistory = threadId
    ? await db
        .select()
        .from(emailThreads)
        .where(eq(emailThreads.threadId, threadId))
        .limit(20)
    : ([] as (typeof emailThreads.$inferSelect)[]);

  const historyText = threadHistory
    .map(t => `[${t.direction === "outbound" ? "Cal (StageGate)" : t.fromAddress}]: ${t.body ?? ""}`)
    .join("\n\n---\n\n");

  const schedulingInstruction = wantsToSchedule
    ? `The prospect wants to schedule a call or demo. Include a link to our scheduling page: https://onstage.bot/schedule — invite them to pick a time.`
    : "";

  const userPrompt = `You are Cal from StageGate. You just received a reply from ${prospect.contactName ?? "someone"} at ${prospect.company}.

Their robot: ${prospect.robotName ?? "unknown"} (${prospect.robotType ?? "robot"})
Shows they attend: ${Array.isArray(prospect.shows) ? prospect.shows.join(", ") : "unknown"}
Current conversation state: ${convState}

${schedulingInstruction}

Email thread history:
${historyText || "(no prior history)"}

Their latest message:
${bodyText}

Write Cal's reply. Keep it short, direct, helpful. Sign as:
${FRANK_PERSONA.signature}`;

  let replyBody = "";
  try {
    const llmResponse = await invokeLLM({
      messages: [
        { role: "system", content: FRANK_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
    const rawContent = llmResponse.choices?.[0]?.message?.content ?? "";
    replyBody = typeof rawContent === "string" ? rawContent : "";
  } catch (llmErr) {
    console.error("[Inbound] LLM draft generation failed:", String(llmErr).slice(0, 200));
    return;
  }

  if (!replyBody) return;

  const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;

  // Store as a draft email for admin review (status: "pending")
  // draftEmails columns: prospectId, subject, body, agentReasoning, status, sentAt, resendMessageId, createdAt, updatedAt
  const draftReasoning = `Reply to inbound from ${prospect.contactEmail}. State: ${convState}. InReplyTo: ${inReplyTo ?? "none"}. BCC: ${ADMIN_BCC.join(", ")}. Scheduling intent: ${wantsToSchedule}.`;
  try {
    await db.insert(draftEmails).values({
      prospectId,
      subject: replySubject,
      body: replyBody,
      agentReasoning: draftReasoning,
      status: "pending",
      createdAt: new Date(),
    });

    console.log(`[Inbound] Draft created for prospect ${prospectId} (${prospect.company})`);
  } catch (draftErr) {
    console.error("[Inbound] Failed to save draft:", String(draftErr).slice(0, 200));
  }

  // Log activity
  await db.insert(prospectActivities).values({
    prospectId,
    type: "draft_created",
    title: `Cal draft ready: "${replySubject.slice(0, 80)}"`,
    description: `AI-generated reply draft ready for admin review`,
    metadata: { isAiDraft: true, convState },
    createdAt: new Date(),
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return match ? match[1].trim() : raw.trim();
}

// ─── Resend inbound payload type ──────────────────────────────────────────────

interface ResendInboundPayload {
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  inReplyTo?: string;
  references?: string;
  headers?: Record<string, string>;
}
