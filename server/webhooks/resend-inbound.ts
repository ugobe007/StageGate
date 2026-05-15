/**
 * Resend Inbound Email Webhook Handler
 *
 * Receives inbound emails sent to @onstage.bot addresses via Resend's
 * inbound routing. Parses the email, matches to a prospect, stores the
 * thread, and triggers the AI conversational reply engine.
 *
 * Resend inbound webhook payload shape:
 * https://resend.com/docs/api-reference/webhooks/introduction
 */
import type { Request, Response } from "express";
import { getDb } from "../db";
import { emailThreads, salesAgentConversations, prospects, prospectActivities } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

const FROM_ADDRESS = "hello@onstage.bot";
const ADMIN_BCC = ["bob@onstage.bot", "tom@starsupportinc.com"];

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function resendInboundHandler(req: Request, res: Response) {
  try {
    const payload = req.body as ResendInboundPayload;

    // Resend sends inbound as a POST with the parsed email fields
    const fromAddress = extractEmail(payload.from ?? "");
    const toAddress = payload.to ?? FROM_ADDRESS;
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

    // 1. Find matching prospect by sender email
    const matchedProspects = await db
      .select()
      .from(prospects)
      .where(eq(prospects.contactEmail, fromAddress))
      .limit(1);

    const prospect = matchedProspects[0] ?? null;
    const prospectId = prospect?.id ?? null;

    // 2. Store the inbound email in email_threads
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

    // 3. Log activity on prospect timeline
    if (prospectId) {
      await db.insert(prospectActivities).values({
        prospectId,
        type: "email_replied",
        title: `Inbound reply: "${subject.slice(0, 80)}"`,
        description: `Inbound reply from ${fromAddress}`,
        metadata: { fromAddress, subject },
        createdAt: new Date(),
      });

      // 4. Update conversation state to in_conversation
      const existingConvs = await db
        .select()
        .from(salesAgentConversations)
        .where(eq(salesAgentConversations.prospectId, prospectId))
        .limit(1);

      if (existingConvs.length > 0) {
        const conv = existingConvs[0];
        const newState = conv.state === "awaiting_reply" ? "in_conversation" : conv.state;
        await db
          .update(salesAgentConversations)
          .set({
            state: newState,
            lastActivityAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(salesAgentConversations.id, conv.id));
      }

      // 5. Generate AI reply
      await generateAndSendReply({
        prospect,
        subject,
        bodyText,
        inReplyTo,
        references,
        threadId: inReplyTo ?? messageId,
        db,
        prospectId,
      });
    } else {
      // Unknown sender — forward to admin for manual review
      console.log(`[Inbound] Unknown sender: ${fromAddress} — no matching prospect`);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[Inbound webhook error]", err);
    res.status(500).json({ error: String(err) });
  }
}

// ─── AI Reply Generator ───────────────────────────────────────────────────────

async function generateAndSendReply({
  prospect,
  subject,
  bodyText,
  inReplyTo,
  references,
  threadId,
  db,
  prospectId,
}: {
  prospect: typeof prospects.$inferSelect;
  subject: string;
  bodyText: string;
  inReplyTo: string | null;
  references: string | null;
  threadId: string | null;
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>;
  prospectId: number;
}) {
  // Load full thread history for context
  const threadHistory = threadId
    ? await db
        .select()
        .from(emailThreads)
        .where(eq(emailThreads.threadId, threadId))
        .limit(20)
    : ([] as (typeof emailThreads.$inferSelect)[]);

  const historyText = threadHistory
    .map(t => `[${t.direction === "outbound" ? "StageGate" : t.fromAddress}]: ${t.body ?? ""}`)
    .join("\n\n---\n\n");

  // Load conversation strategy if available
  const convs = await db
    .select()
    .from(salesAgentConversations)
    .where(eq(salesAgentConversations.prospectId, prospectId))
    .limit(1);
  const strategy = convs[0]?.strategy ?? "";
  const convState = convs[0]?.state ?? "in_conversation";

  // Detect scheduling intent
  const schedulingKeywords = ["call", "meet", "schedule", "talk", "discuss", "demo", "available", "time", "calendar", "book"];
  const wantsToSchedule = schedulingKeywords.some(kw =>
    bodyText.toLowerCase().includes(kw)
  );

  const schedulingInstruction = wantsToSchedule
    ? `The prospect seems interested in scheduling a call. Include a link to our scheduling page: https://onstage.bot/schedule — invite them to pick a time that works for them.`
    : "";

  const systemPrompt = `You are the StageGate Team's AI sales representative. StageGate is the premier robotics activation infrastructure company in Las Vegas — we handle all logistics, warehousing, staging, and trade show activation for robot companies exhibiting at conferences.

Your job is to continue a warm, professional email conversation with a prospective robot company. You are NOT a bot — write naturally, conversationally, and helpfully. Never sound scripted or AI-generated.

Company context:
- Prospect company: ${prospect.company}
- Contact name: ${prospect.contactName ?? "there"}
- Robot type: ${prospect.robotType ?? "unknown"}
- Shows they attend: ${Array.isArray(prospect.shows) ? prospect.shows.join(", ") : "unknown"}
- Outreach strategy: ${strategy}
- Conversation state: ${convState}

${schedulingInstruction}

Sign all emails as:
"The StageGate Team
hello@onstage.bot | onstage.bot"

Rules:
1. Be warm, direct, and helpful — not salesy
2. Answer any questions they asked in their email
3. Keep it concise — 3-5 short paragraphs max
4. If they show interest, naturally guide toward scheduling a call
5. Never mention you are an AI
6. Do NOT include a subject line in your reply — just the body`;

  const userPrompt = `Email thread history:
${historyText || "(no prior history)"}

Their latest message:
${bodyText}

Write a natural, helpful reply.`;

  const llmResponse = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const rawContent = llmResponse.choices?.[0]?.message?.content ?? "";
  const replyBody = typeof rawContent === "string" ? rawContent : "";
  if (!replyBody) return;

  // Send the reply via Resend fetch API
  const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;

  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `StageGate Team <${FROM_ADDRESS}>`,
      to: [prospect.contactEmail ?? ""],
      bcc: ADMIN_BCC,
      subject: replySubject,
      text: replyBody,
      headers: {
        ...(inReplyTo ? { "In-Reply-To": inReplyTo } : {}),
        ...(references ? { References: references } : {}),
      },
    }),
  });

  const sendData = sendRes.ok ? (await sendRes.json() as { id?: string }) : null;
  const sentMessageId = sendData?.id ?? null;

  // Store the outbound reply in email_threads
  await db.insert(emailThreads).values({
    prospectId,
    threadId: inReplyTo ?? threadId ?? `thread-${prospectId}`,
    direction: "outbound",
    fromAddress: FROM_ADDRESS,
    toAddress: prospect.contactEmail ?? "",
    subject: replySubject,
    body: replyBody,
    resendMessageId: sentMessageId ?? undefined,
    inReplyTo: inReplyTo ?? undefined,
    references: references ?? undefined,
  });

  // Log activity
  await db.insert(prospectActivities).values({
    prospectId,
    type: "email_sent",
    title: `AI reply sent: "${replySubject.slice(0, 80)}"`,
    description: `AI reply sent to ${prospect.contactEmail}`,
    metadata: { resendMessageId: sentMessageId, isAiReply: true },
    createdAt: new Date(),
  });

  // Update conversation state
  if (convs.length > 0) {
    await db
      .update(salesAgentConversations)
      .set({
        state: wantsToSchedule ? "scheduling_sent" : "in_conversation",
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(salesAgentConversations.id, convs[0].id));
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractEmail(raw: string): string {
  // Handle "Name <email@domain.com>" format
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
