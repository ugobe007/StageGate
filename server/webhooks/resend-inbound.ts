/**
 * Resend Inbound Email Webhook Handler — v2
 *
 * Receives inbound emails at @onstage.bot via Resend inbound routing.
 * Uses the intentClassifier to detect mood and intent, then:
 *
 * POSITIVE_SCHEDULE | CALENDAR_REQUEST:
 *   → Creates calendar event (next business day 10am PT)
 *   → Sends .ics invite to prospect + admins
 *   → Moves conversation to "scheduling"
 *   → Cal's draft acknowledges and confirms the invite was sent
 *
 * AVAILABILITY_GIVEN:
 *   → Moves to "scheduling"
 *   → Cal's draft proposes a specific time based on what they shared
 *
 * ASKING_AVAILABILITY:
 *   → Moves to "scheduling"
 *   → Cal's draft shares a scheduling link (onstage.bot/schedule)
 *
 * QUESTION:
 *   → Moves to "awaiting_reply"
 *   → Cal's draft answers the question in his voice
 *
 * NEGATIVE:
 *   → Moves to "not_interested"
 *   → No draft generated
 *
 * OPT_OUT:
 *   → Moves to "not_interested"
 *   → No draft generated, logs opt-out
 *
 * NEUTRAL:
 *   → Moves to "awaiting_reply"
 *   → Cal's draft acknowledges and asks how he can help
 */
import type { Request, Response } from "express";
import { getDb } from "../db.js";
import {
  emailThreads,
  salesAgentConversations,
  prospects,
  prospectActivities,
  draftEmails,
  calendarEvents,
} from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { invokeLLM } from "../_core/llm.js";
import { FRANK_PERSONA, FRANK_SYSTEM_PROMPT } from "../agents/frankPlaybook.js";
import { classifyEmailIntent } from "../agents/intentClassifier.js";
import type { IntentCategory } from "../agents/intentClassifier.js";
import { verifyResendSignature } from "./resendVerify.js";

const FRANK_FROM_NAME = FRANK_PERSONA.fromName;
const FRANK_FROM_EMAIL = FRANK_PERSONA.fromEmail;
const ADMIN_EMAILS = ["bob@starsupportinc.com", "tom@starsupportinc.com"];
const RESEND_API = "https://api.resend.com/emails";

// Stages that allow auto-reply drafts
const OUTREACH_STAGES = new Set([
  "discovery", "intro_sent", "followup_1", "followup_2",
  "robot_guild", "email_opened", "link_clicked", "awaiting_reply",
]);

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function resendInboundHandler(req: Request, res: Response) {
  try {
    if (!verifyResendSignature(req)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const payload = req.body as ResendInboundPayload;
    const fromAddress = extractEmail(payload.from ?? "");
    const toAddress = payload.to ?? FRANK_FROM_EMAIL;
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

    // ── 1. Match prospect ─────────────────────────────────────────────────────
    let prospect = (await db.select().from(prospects).where(eq(prospects.contactEmail, fromAddress)).limit(1))[0] ?? null;

    if (!prospect && inReplyTo) {
      const thread = await db
        .select({ prospectId: emailThreads.prospectId })
        .from(emailThreads)
        .where(eq(emailThreads.resendMessageId, inReplyTo))
        .limit(1);
      if (thread[0]?.prospectId) {
        prospect = (await db.select().from(prospects).where(eq(prospects.id, thread[0].prospectId)).limit(1))[0] ?? null;
      }
    }

    const prospectId = prospect?.id ?? null;

    // ── 2. Store inbound email thread ─────────────────────────────────────────
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
      console.log(`[Inbound] Unknown sender: ${fromAddress}`);
      return res.json({ ok: true, matched: false });
    }

    // ── 3. Classify intent + mood ─────────────────────────────────────────────
    const intent = await classifyEmailIntent(bodyText, prospect.company, true);
    console.log(`[Inbound] ${prospect.company} → intent=${intent.intent} mood=${intent.mood} confidence=${intent.confidence}`);

    // ── 4. Log reply activity ─────────────────────────────────────────────────
    const trimmedBody = bodyText.trim();
    const replySnippet = trimmedBody.slice(0, 300);
    await db.insert(prospectActivities).values({
      prospectId,
      type: "email_replied",
      title: `Reply: "${subject.slice(0, 80)}"`,
      description: replySnippet
        ? `${replySnippet}${trimmedBody.length > 300 ? "…" : ""}`
        : `Reply from ${fromAddress}`,
      metadata: {
        fromAddress,
        subject,
        replyBody: trimmedBody || null,
        intent: intent.intent,
        mood: intent.mood,
        confidence: intent.confidence,
        extractedDates: intent.extractedDates,
      },
    });

    // ── 5. Determine new conversation state ───────────────────────────────────
    const conv = (await db
      .select()
      .from(salesAgentConversations)
      .where(eq(salesAgentConversations.prospectId, prospectId))
      .limit(1))[0] ?? null;

    const currentState = conv?.state ?? "discovery";
    const newState = intentToState(intent.intent, currentState);

    if (conv) {
      await db
        .update(salesAgentConversations)
        .set({ state: newState, lastActivityAt: new Date(), nextFollowUpAt: null, updatedAt: new Date() })
        .where(eq(salesAgentConversations.id, conv.id));
    }

    // ── 6. Auto-book calendar event for scheduling intents ────────────────────
    let calendarEventId: number | null = null;
    if (["POSITIVE_SCHEDULE", "CALENDAR_REQUEST"].includes(intent.intent)) {
      calendarEventId = await autoCreateCalendarEvent({
        prospect,
        subject,
        db,
        extractedDates: intent.extractedDates,
      });
    }

    // ── 7. Generate Cal's reply draft ─────────────────────────────────────────
    if (!["NEGATIVE", "OPT_OUT"].includes(intent.intent)) {
      await generateCalDraft({
        prospect,
        subject,
        bodyText,
        inReplyTo,
        references,
        threadId: inReplyTo ?? messageId,
        db,
        prospectId,
        convState: newState,
        intent: intent.intent,
        extractedDates: intent.extractedDates,
        calendarEventBooked: calendarEventId !== null,
      });
    }

    // ── 8. Log opt-out separately ─────────────────────────────────────────────
    if (intent.wantsOptOut) {
      await db.insert(prospectActivities).values({
        prospectId,
        type: "opt_out",
        title: "Prospect requested to be removed",
        description: `Opt-out detected — automated emails stopped`,
        metadata: { fromAddress, subject },
      });
    }

    res.json({ ok: true, matched: true, intent: intent.intent, mood: intent.mood, newState, calendarEventId });
  } catch (err) {
    console.error("[Inbound webhook error]", err);
    res.status(500).json({ error: String(err) });
  }
}

// ─── Intent → Conversation state ─────────────────────────────────────────────

function intentToState(intent: IntentCategory, currentState: string): string {
  switch (intent) {
    case "POSITIVE_SCHEDULE":
    case "CALENDAR_REQUEST":
    case "AVAILABILITY_GIVEN":
    case "ASKING_AVAILABILITY":
      return "scheduling";
    case "NEGATIVE":
    case "OPT_OUT":
      return "not_interested";
    case "QUESTION":
    case "NEUTRAL":
    default:
      if (OUTREACH_STAGES.has(currentState)) return "awaiting_reply";
      return currentState;
  }
}

// ─── Auto-create calendar event + send .ics invites ──────────────────────────

async function autoCreateCalendarEvent({
  prospect,
  subject,
  db,
  extractedDates,
}: {
  prospect: typeof prospects.$inferSelect;
  subject: string;
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>;
  extractedDates: string[];
}): Promise<number | null> {
  try {
    // Propose next business day at 10am PT (UTC-7)
    const proposed = nextBusinessDay10amPT();
    const startAt = proposed;
    const endAt = new Date(proposed.getTime() + 30 * 60_000); // 30 min call

    const shareToken = crypto_v2.randomBytes(24).toString("hex");

    const [evt] = await db.insert(calendarEvents).values({
      title: `Intro Call — ${prospect.company}`,
      description: `Inbound reply from ${prospect.contactName ?? prospect.company}. Extracted dates: ${extractedDates.join(", ") || "none mentioned"}.`,
      startAt,
      endAt,
      type: "call",
      status: "scheduled",
      prospectId: prospect.id,
      prospectEmail: prospect.contactEmail ?? undefined,
      prospectName: prospect.contactName ?? undefined,
      companyName: prospect.company,
      shareToken,
      notes: `Auto-created from inbound reply. Subject: "${subject}"`,
    }).returning({ id: calendarEvents.id });

    if (!evt?.id) return null;

    // Generate .ics content
    const ics = buildIcs({
      uid: `stagegate-call-${evt.id}-${Date.now()}@onstage.bot`,
      startAt,
      endAt,
      summary: `StageGate Call — ${prospect.company}`,
      description: `Intro call with Cal from StageGate and ${prospect.contactName ?? "your team"} at ${prospect.company}.`,
      organizerName: "Cal at StageGate",
      organizerEmail: FRANK_FROM_EMAIL,
      attendees: [
        ...(prospect.contactEmail ? [{ name: prospect.contactName ?? prospect.company, email: prospect.contactEmail }] : []),
        ...ADMIN_EMAILS.map(e => ({ name: "StageGate", email: e })),
      ],
    });

    const startDisplay = startAt.toLocaleString("en-US", {
      weekday: "long", month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles", timeZoneName: "short",
    });

    // Send .ics to prospect
    if (prospect.contactEmail) {
      await sendEmail({
        to: prospect.contactEmail,
        toName: prospect.contactName ?? prospect.company,
        subject: `Cal from StageGate — Let's Talk (${startDisplay})`,
        html: `<p>Hi ${prospect.contactName ?? "there"},</p>
<p>Great to hear from you. I've put a hold on the calendar for <strong>${startDisplay}</strong> — feel free to suggest another time if that doesn't work.</p>
<p>We'll chat about your upcoming shows, how StageGate can handle the logistics, and what we can do to make sure your robot is ready to go when you land in Vegas.</p>
<p>Look forward to it.</p>
<p>— Cal<br><small>Robot Ready Team @ StageGate | <a href="https://onstage.bot">onstage.bot</a></small></p>`,
        icsContent: ics,
      });
    }

    // Send .ics to all admins
    for (const adminEmail of ADMIN_EMAILS) {
      await sendEmail({
        to: adminEmail,
        toName: "StageGate Admin",
        subject: `Cal auto-booked a call — ${prospect.company} (${startDisplay})`,
        html: `<p>Cal auto-detected scheduling intent from <strong>${prospect.contactName ?? "unknown"}</strong> at <strong>${prospect.company}</strong> and created a calendar event.</p>
<p><strong>Time:</strong> ${startDisplay}</p>
<p><strong>Prospect email:</strong> ${prospect.contactEmail ?? "unknown"}</p>
<p><strong>Their message subject:</strong> ${subject}</p>
<p>Review in the admin <a href="https://onstage.bot/admin/sales-agent">Sales Agent dashboard</a> under Meetings.</p>`,
        icsContent: ics,
      });
    }

    console.log(`[Inbound] Auto-created calendar event #${evt.id} for ${prospect.company}`);
    return evt.id;
  } catch (err) {
    console.error("[Inbound] Failed to auto-create calendar event:", err);
    return null;
  }
}

// ─── Cal's Reply Draft ────────────────────────────────────────────────────────

async function generateCalDraft({
  prospect,
  subject,
  bodyText,
  inReplyTo,
  references,
  threadId,
  db,
  prospectId,
  convState,
  intent,
  extractedDates,
  calendarEventBooked,
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
  intent: IntentCategory;
  extractedDates: string[];
  calendarEventBooked: boolean;
}) {
  // Thread history for context
  const threadHistory = threadId
    ? (await db.select().from(emailThreads).where(eq(emailThreads.threadId, threadId)).limit(10))
    : [];

  const historyText = threadHistory
    .map(t => `[${t.direction === "outbound" ? "Cal" : t.fromAddress}]: ${(t.body ?? "").slice(0, 400)}`)
    .join("\n\n---\n\n");

  // Instruction tuned to the detected intent
  const intentInstruction = buildIntentInstruction(intent, calendarEventBooked, extractedDates, prospect);

  const userPrompt = `You are Cal from StageGate replying to ${prospect.contactName ?? "someone"} at ${prospect.company}.

Their robot: ${[prospect.robotName, prospect.robotType].filter(Boolean).join(" / ") || "unknown"}
Shows they're attending: ${Array.isArray(prospect.shows) ? (prospect.shows as string[]).join(", ") : "unknown"}
Conversation state: ${convState}

${intentInstruction}

Previous thread:
${historyText || "(no prior history)"}

Their latest message:
${bodyText.slice(0, 600)}

Write Cal's reply. Short, warm, direct. Cal's voice — not corporate.
Sign off as: ${FRANK_PERSONA.signature}`;

  try {
    const llmResponse = await invokeLLM({
      messages: [
        { role: "system", content: FRANK_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
    const raw = llmResponse.choices?.[0]?.message?.content ?? "";
    const replyBody = typeof raw === "string" ? raw : "";
    if (!replyBody) return;

    const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;

    await db.insert(draftEmails).values({
      prospectId,
      subject: replySubject,
      body: replyBody,
      agentReasoning: `Intent: ${intent} | State: ${convState} | CalendarBooked: ${calendarEventBooked} | Dates: ${extractedDates.join(", ") || "none"}`,
      status: "pending",
    });

    await db.insert(prospectActivities).values({
      prospectId,
      type: "draft_created",
      title: `Cal draft ready: "${replySubject.slice(0, 60)}"`,
      description: `Intent detected: ${intent}. Cal's reply draft is in the Pending Drafts queue.`,
      metadata: { intent, convState, calendarBooked: calendarEventBooked },
    });

    console.log(`[Inbound] Draft created for ${prospect.company} (intent=${intent})`);
  } catch (err) {
    console.error("[Inbound] LLM draft failed:", String(err).slice(0, 200));
  }
}

function buildIntentInstruction(
  intent: IntentCategory,
  calendarBooked: boolean,
  extractedDates: string[],
  prospect: typeof prospects.$inferSelect,
): string {
  const name = prospect.contactName?.split(" ")[0] ?? "there";
  switch (intent) {
    case "POSITIVE_SCHEDULE":
    case "CALENDAR_REQUEST":
      return calendarBooked
        ? `They said yes or asked for a calendar invite. A calendar event has already been created and a .ics invite was sent. Cal should confirm the meeting is on the calendar, mention the time (next business day 10am PT), and say he's looking forward to talking. Keep it brief and warm — 2-3 sentences.`
        : `They said yes or asked for a calendar invite. Cal should confirm he'll send a calendar invite and ask if the proposed time works. Keep it brief.`;
    case "AVAILABILITY_GIVEN":
      return `They shared their availability: ${extractedDates.join(", ") || "see message"}. Cal should propose a specific time that works, confirm it, and offer to send a calendar invite. Keep it short.`;
    case "ASKING_AVAILABILITY":
      return `They asked when Cal is available. Cal should share a few time options (next business day 10am PT, or a couple of other slots this week) and offer to send a calendar invite once they confirm. Keep it simple.`;
    case "QUESTION":
      return `They have a question about StageGate services. Cal should answer it directly in his own voice — honest, plain English, no fluff. If it's a technical question he can't fully answer, he should say he'll loop in the right person.`;
    case "NEUTRAL":
    default:
      return `Their reply was general or unclear. Cal should acknowledge the reply warmly and ask how he can help — one simple open question.`;
  }
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

function nextBusinessDay10amPT(): Date {
  const now = new Date();
  // PT offset: UTC-7 (PDT) — use a fixed offset approximation
  const ptOffsetMs = 7 * 60 * 60 * 1000;
  const ptNow = new Date(now.getTime() - ptOffsetMs);

  // Move to next business day
  const proposed = new Date(ptNow);
  proposed.setDate(proposed.getDate() + 1);
  // Skip weekends
  while (proposed.getDay() === 0 || proposed.getDay() === 6) {
    proposed.setDate(proposed.getDate() + 1);
  }
  // Set to 10:00 AM PT
  proposed.setHours(10, 0, 0, 0);

  // Convert back to UTC
  return new Date(proposed.getTime() + ptOffsetMs);
}

function buildIcs({
  uid, startAt, endAt, summary, description, organizerName, organizerEmail, attendees,
}: {
  uid: string;
  startAt: Date;
  endAt: Date;
  summary: string;
  description: string;
  organizerName: string;
  organizerEmail: string;
  attendees: { name: string; email: string }[];
}): string {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StageGate//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${fmt(startAt)}`,
    `DTEND:${fmt(endAt)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
    `ORGANIZER;CN=${organizerName}:mailto:${organizerEmail}`,
    ...attendees.map(a => `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;CN=${a.name}:mailto:${a.email}`),
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

async function sendEmail({
  to, toName, subject, html, icsContent,
}: {
  to: string;
  toName: string;
  subject: string;
  html: string;
  icsContent: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Inbound] RESEND_API_KEY not set — skipping email send");
    return;
  }
  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${FRANK_FROM_NAME} <${FRANK_FROM_EMAIL}>`,
      to: [`${toName} <${to}>`],
      subject,
      html,
      attachments: [{
        filename: "invite.ics",
        content: Buffer.from(icsContent).toString("base64"),
      }],
    }),
  });
  if (!res.ok) {
    console.error("[Inbound] Email send failed:", await res.text());
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return match ? match[1].trim() : raw.trim();
}

// ─── Payload type ─────────────────────────────────────────────────────────────

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
