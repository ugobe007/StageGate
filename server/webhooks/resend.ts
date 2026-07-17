/**
 * Resend webhook handler
 * Validates HMAC-SHA256 signatures and logs email.opened / email.clicked events
 * to both email_tracking_events and prospect_activities tables.
 */
import type { Request, Response } from "express";
import { getDb } from "../db";
import { emailTrackingEvents, prospectActivities, draftEmails, salesAgentConversations, emailThreads } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { verifyResendSignature } from "./resendVerify";
import { extractEmailAddress } from "../outreachContacts.js";

export async function resendWebhookHandler(req: Request, res: Response): Promise<void> {
  // Validate signature
  if (!verifyResendSignature(req)) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const event = req.body as {
    type?: string;
    data?: {
      email_id?: string;
      message_id?: string;
      to?: string[] | string;
      click?: { link?: string };
      created_at?: string;
    };
  };

  const eventType = event.type ?? "";
  const data = event.data ?? {};
  const messageId = data.email_id ?? data.message_id ?? "";
  const occurredAt = data.created_at ? new Date(data.created_at) : new Date();
  const clickUrl = data.click?.link ?? null;

  const recipientOf = (): string | null => {
    const raw = Array.isArray(data.to) ? data.to[0] : typeof data.to === "string" ? data.to : null;
    return extractEmailAddress(raw) ?? raw?.trim().toLowerCase() ?? null;
  };

  // Deliverability: a bounce or complaint is a hard signal never to send to this
  // address again. Record it in the suppression store (blocks future sends and
  // feeds the trailing-bounce-rate circuit breaker). Previously these events
  // were ignored, so bad addresses were re-sent every cycle.
  if (eventType === "email.bounced" || eventType === "email.complained") {
    try {
      const db = await getDb();
      const recipient = recipientOf();
      if (db && recipient) {
        const { recordSuppression } = await import("../outreachGate");
        const reason = eventType === "email.complained" ? "complaint" : "bounce";
        await recordSuppression(db, recipient, reason, { source: "resend_webhook" });
        // Downgrade matching prospects so Hunter re-enrichment runs on next send attempt.
        const { prospects: prospectsTable } = await import("../../drizzle/schema");
        await db
          .update(prospectsTable)
          .set({ emailConfidence: "low", updatedAt: new Date() })
          .where(sql`lower(${prospectsTable.contactEmail}) = ${recipient}`);
        await db.insert(emailTrackingEvents).values({
          messageId,
          eventType,
          occurredAt,
          raw: event as Record<string, unknown>,
        });
        console.warn(`[Resend Webhook] ${eventType} → suppressed ${recipient}`);
      }
      res.status(200).json({ received: true, suppressed: recipient ?? undefined, eventType });
      return;
    } catch (err) {
      console.error("[Resend Webhook] Error recording suppression:", err);
      res.status(200).json({ received: true, eventType, error: "suppression_failed" });
      return;
    }
  }

  // Handle email.opened, email.clicked, and email.replied
  if (eventType !== "email.opened" && eventType !== "email.clicked" && eventType !== "email.replied") {
    res.status(200).json({ received: true, ignored: true });
    return;
  }

  try {
    const db = await getDb();
    if (!db) {
      res.status(503).json({ error: "DB unavailable" });
      return;
    }

    // Resolve the prospect behind this event. Attribution is best-effort and
    // layered so a single missing field (e.g. an older send that never stored
    // its Resend message ID) does not drop the event on the floor:
    //   1a. Resend message ID on the sent draft.
    //   1b. Resend message ID on the outbound thread (stored more often).
    //   2a. Recipient email → prospect (case-insensitive).
    //   2b. Recipient email → outbound thread's toAddress (case-insensitive).
    let prospectId: number | null = null;

    if (messageId) {
      const draftRows = await db
        .select({ prospectId: draftEmails.prospectId })
        .from(draftEmails)
        .where(eq(draftEmails.resendMessageId, messageId))
        .limit(1);
      prospectId = draftRows[0]?.prospectId ?? null;

      if (!prospectId) {
        const threadRows = await db
          .select({ prospectId: emailThreads.prospectId })
          .from(emailThreads)
          .where(eq(emailThreads.resendMessageId, messageId))
          .limit(1);
        prospectId = threadRows[0]?.prospectId ?? null;
      }
    }

    if (!prospectId) {
      const rawRecipient = Array.isArray(data.to)
        ? data.to[0]
        : typeof data.to === "string"
          ? data.to
          : null;
      const recipient = rawRecipient?.trim().toLowerCase() ?? null;
      if (recipient) {
        const { prospects: prospectsTable } = await import("../../drizzle/schema");
        const found = await db
          .select({ id: prospectsTable.id })
          .from(prospectsTable)
          .where(sql`lower(${prospectsTable.contactEmail}) = ${recipient}`)
          .limit(1);
        prospectId = found[0]?.id ?? null;

        if (!prospectId) {
          const threadByTo = await db
            .select({ prospectId: emailThreads.prospectId })
            .from(emailThreads)
            .where(
              and(
                eq(emailThreads.direction, "outbound"),
                sql`lower(${emailThreads.toAddress}) = ${recipient}`
              )
            )
            .limit(1);
          prospectId = threadByTo[0]?.prospectId ?? null;
        }
      }
    }

    // Insert into email_tracking_events
    await db.insert(emailTrackingEvents).values({
      prospectId: prospectId ?? undefined,
      messageId,
      eventType,
      url: clickUrl,
      occurredAt,
      raw: event as Record<string, unknown>,
    });

    // Log to prospect_activities if we have a prospect
    if (prospectId) {
      if (eventType === "email.opened") {
        await db.insert(prospectActivities).values({
          prospectId,
          type: "email_opened",
          title: "Email opened",
          description: `Prospect opened outreach email (message ID: ${messageId})`,
          metadata: { messageId, occurredAt: occurredAt.toISOString() },
        });
      } else if (eventType === "email.clicked") {
        await db.insert(prospectActivities).values({
          prospectId,
          type: "email_clicked",
          title: "Email link clicked",
          description: `Prospect clicked a link in outreach email${clickUrl ? `: ${clickUrl}` : ""}`,
          metadata: { messageId, url: clickUrl, occurredAt: occurredAt.toISOString() },
        });
      }

      // v37: handle email.replied — advance to awaiting_reply and pause follow-ups
      if (eventType === "email.replied") {
        const replyConvRows = await db
          .select({ id: salesAgentConversations.id, state: salesAgentConversations.state })
          .from(salesAgentConversations)
          .where(eq(salesAgentConversations.prospectId, prospectId))
          .limit(1);
        const replyConv = replyConvRows[0];
        if (replyConv && replyConv.state !== "awaiting_reply" && replyConv.state !== "scheduling" && replyConv.state !== "booked") {
          await db
            .update(salesAgentConversations)
            .set({ state: "awaiting_reply", nextFollowUpAt: null, lastActivityAt: new Date(), updatedAt: new Date() })
            .where(eq(salesAgentConversations.id, replyConv.id));
          await db.insert(prospectActivities).values({
            prospectId,
            type: "email_replied",
            title: "Reply received",
            description: "Prospect replied to outreach email — automated follow-ups paused",
            metadata: { messageId, occurredAt: occurredAt.toISOString() },
          });
          console.log(`[Resend Webhook] Prospect ${prospectId} replied — advanced to awaiting_reply`);
        }
        res.status(200).json({ received: true, prospectId, eventType });
        return;
      }

      // v35: advance conversation state on engagement signals
      // email.opened → email_opened (if currently in an outreach-sent state)
      // email.clicked → link_clicked (strongest engagement signal)
      const OUTREACH_SENT_STATES = ["intro_sent", "followup_1", "followup_2", "robot_guild", "email_opened", "link_clicked"];
      const convRows = await db
        .select({
          id: salesAgentConversations.id,
          state: salesAgentConversations.state,
          nextFollowUpAt: salesAgentConversations.nextFollowUpAt,
        })
        .from(salesAgentConversations)
        .where(eq(salesAgentConversations.prospectId, prospectId))
        .limit(1);
      const conv = convRows[0];
      if (conv) {
        if (eventType === "email.clicked" && conv.state !== "link_clicked") {
          // v36: Click is the strongest signal — advance to link_clicked AND shorten follow-up to 1 day
          const oneDayFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);
          // Only shorten if the current nextFollowUpAt is more than 1 day away (don't push it further out)
          const currentNext = conv.nextFollowUpAt ? new Date(conv.nextFollowUpAt) : null;
          const shouldShorten = !currentNext || currentNext > oneDayFromNow;
          await db
            .update(salesAgentConversations)
            .set({
              state: "link_clicked",
              lastActivityAt: new Date(),
              updatedAt: new Date(),
              ...(shouldShorten ? { nextFollowUpAt: oneDayFromNow } : {}),
            })
            .where(eq(salesAgentConversations.id, conv.id));
          console.log(`[Resend Webhook] Prospect ${prospectId} advanced to link_clicked${shouldShorten ? " — follow-up shortened to 1 day" : ""}`);
          // Log accelerated follow-up activity
          if (shouldShorten) {
            await db.insert(prospectActivities).values({
              prospectId,
              type: "followup_accelerated",
              title: "Follow-up accelerated",
              description: "Link click detected — next follow-up shortened to 1 day",
              metadata: { messageId, url: clickUrl, occurredAt: occurredAt.toISOString(), nextFollowUpAt: oneDayFromNow.toISOString() },
            });
          }
        } else if (eventType === "email.opened" && OUTREACH_SENT_STATES.includes(conv.state ?? "") && conv.state !== "link_clicked") {
          // Open advances from outreach-sent states to email_opened
          await db
            .update(salesAgentConversations)
            .set({ state: "email_opened", lastActivityAt: new Date(), updatedAt: new Date() })
            .where(eq(salesAgentConversations.id, conv.id));
          console.log(`[Resend Webhook] Prospect ${prospectId} advanced to email_opened`);
        }
      }
    }

    res.status(200).json({ received: true, prospectId, eventType });
  } catch (err) {
    console.error("[Resend Webhook] Error processing event:", err);
    res.status(500).json({ error: "Internal error" });
  }
}
