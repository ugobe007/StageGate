/**
 * Resend webhook handler
 * Validates HMAC-SHA256 signatures and logs email.opened / email.clicked events
 * to both email_tracking_events and prospect_activities tables.
 */
import type { Request, Response } from "express";
import crypto from "crypto";
import { getDb } from "../db";
import { emailTrackingEvents, prospectActivities, draftEmails, salesAgentConversations } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// Resend uses Svix-style webhook signing: HMAC-SHA256 over "timestamp.body"
// Header: svix-id, svix-timestamp, svix-signature
// Fallback: resend-signature (older format)
function verifyResendSignature(req: Request): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    // If no secret configured, skip verification (dev/test only)
    console.warn("[Resend Webhook] RESEND_WEBHOOK_SECRET not set — skipping signature verification");
    return true;
  }

  // Svix format
  const svixId = req.headers["svix-id"] as string | undefined;
  const svixTimestamp = req.headers["svix-timestamp"] as string | undefined;
  const svixSignature = req.headers["svix-signature"] as string | undefined;

  if (svixId && svixTimestamp && svixSignature) {
    try {
      // The secret may be prefixed with "whsec_"
      const rawSecret = secret.startsWith("whsec_")
        ? Buffer.from(secret.slice(6), "base64")
        : Buffer.from(secret, "base64");

      const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      const toSign = `${svixId}.${svixTimestamp}.${body}`;
      const hmac = crypto.createHmac("sha256", rawSecret).update(toSign).digest("base64");

      // svix-signature may contain multiple space-separated "v1,<base64>" values
      const signatures = svixSignature.split(" ");
      return signatures.some(sig => {
        const parts = sig.split(",");
        return parts.length === 2 && parts[0] === "v1" && parts[1] === hmac;
      });
    } catch {
      return false;
    }
  }

  // Legacy Resend format: resend-signature header = "t=<ts>,v1=<hmac>"
  const legacySig = req.headers["resend-signature"] as string | undefined;
  if (legacySig) {
    try {
      const parts = Object.fromEntries(legacySig.split(",").map(p => p.split("=")));
      const ts = parts["t"];
      const v1 = parts["v1"];
      if (!ts || !v1) return false;
      const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      const toSign = `${ts}.${body}`;
      const hmac = crypto.createHmac("sha256", secret).update(toSign).digest("hex");
      return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(v1));
    } catch {
      return false;
    }
  }

  // No signature headers present — reject
  return false;
}

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
      to?: string[];
      click?: { link?: string };
      created_at?: string;
    };
  };

  const eventType = event.type ?? "";
  const data = event.data ?? {};
  const messageId = data.email_id ?? data.message_id ?? "";
  const occurredAt = data.created_at ? new Date(data.created_at) : new Date();
  const clickUrl = data.click?.link ?? null;

  // Only handle email.opened and email.clicked
  if (eventType !== "email.opened" && eventType !== "email.clicked") {
    res.status(200).json({ received: true, ignored: true });
    return;
  }

  try {
    const db = await getDb();
    if (!db) {
      res.status(503).json({ error: "DB unavailable" });
      return;
    }

    // Try to find the prospect linked to this messageId.
    // Strategy 1: match by Resend message ID stored on draft_emails (most reliable)
    // Strategy 2: fall back to recipient email address
    let prospectId: number | null = null;

    if (messageId) {
      const draftRows = await db
        .select({ prospectId: draftEmails.prospectId })
        .from(draftEmails)
        .where(eq(draftEmails.resendMessageId, messageId))
        .limit(1);
      if (draftRows[0]?.prospectId) {
        prospectId = draftRows[0].prospectId;
      }
    }

    if (!prospectId) {
      const recipientEmail = Array.isArray(data.to) ? data.to[0] : null;
      if (recipientEmail) {
        const { prospects: prospectsTable } = await import("../../drizzle/schema");
        const found = await db
          .select({ id: prospectsTable.id })
          .from(prospectsTable)
          .where(eq(prospectsTable.contactEmail, recipientEmail))
          .limit(1);
        if (found[0]?.id) {
          prospectId = found[0].id;
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

      // v35: advance conversation state on engagement signals
      // email.opened → email_opened (if currently in an outreach-sent state)
      // email.clicked → link_clicked (strongest engagement signal)
      const OUTREACH_SENT_STATES = ["intro_sent", "followup_1", "followup_2", "robot_guild", "awaiting_reply"];
      const convRows = await db
        .select({ id: salesAgentConversations.id, state: salesAgentConversations.state })
        .from(salesAgentConversations)
        .where(eq(salesAgentConversations.prospectId, prospectId))
        .limit(1);
      const conv = convRows[0];
      if (conv) {
        if (eventType === "email.clicked" && conv.state !== "link_clicked") {
          // Click is the strongest signal — always advance to link_clicked
          await db
            .update(salesAgentConversations)
            .set({ state: "link_clicked", lastActivityAt: new Date(), updatedAt: new Date() })
            .where(eq(salesAgentConversations.id, conv.id));
          console.log(`[Resend Webhook] Prospect ${prospectId} advanced to link_clicked`);
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
