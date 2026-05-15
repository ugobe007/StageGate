/**
 * server/scheduled/quoteFollowup.ts
 *
 * Heartbeat handler: POST /api/scheduled/quote-followup
 *
 * Runs daily at 09:00 UTC (project-level cron, no end-user session).
 * Finds all booking_requests where:
 *   - status = 'quoted'
 *   - quoteSentAt < NOW() - 5 days
 *   - quoteFollowUpSentAt IS NULL   (idempotent: only send once)
 *
 * Sends a friendly follow-up email via Resend and stamps quoteFollowUpSentAt.
 */

import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { bookingRequests } from "../../drizzle/schema";
import { and, eq, isNull, lt } from "drizzle-orm";
import { sendEmail } from "../email";

export async function quoteFollowupHandler(req: Request, res: Response) {
  try {
    // ── 1. Authenticate: must be a cron trigger ──────────────────────────────
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const dbConn = await getDb();
    if (!dbConn) {
      return res.status(500).json({ error: "DB unavailable" });
    }

    // ── 2. Find eligible bookings ─────────────────────────────────────────────
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    const eligible = await dbConn
      .select()
      .from(bookingRequests)
      .where(
        and(
          eq(bookingRequests.status, "quoted"),
          lt(bookingRequests.quoteSentAt, fiveDaysAgo),
          isNull(bookingRequests.quoteFollowUpSentAt)
        )
      );

    let processed = 0;
    let skipped = 0;
    const errors: string[] = [];

    // ── 3. Send follow-up email to each eligible booking ─────────────────────
    for (const b of eligible) {
      if (!b.contactEmail) {
        skipped++;
        continue;
      }

      const quoteNumber = `SG-${String(b.id).padStart(5, "0")}`;
      const services = Array.isArray(b.services) ? (b.services as string[]) : [];

      const subject = `Following up on your StageGate Quote ${quoteNumber}`;

      const bodyText = [
        `Hi ${b.contactName ?? "there"},`,
        ``,
        `I wanted to follow up on the quote we sent you for ${b.showName ?? "your upcoming show"}.`,
        ``,
        `Quote reference: ${quoteNumber}`,
        `Company: ${b.company}`,
        ...(b.showDate ? [`Show date: ${b.showDate}`] : []),
        ...(services.length > 0 ? [`Services: ${services.join(", ")}`] : []),
        ...(b.warehouseEstimate ? [`Warehouse storage estimate: $${b.warehouseEstimate}`] : []),
        ``,
        `If you have any questions or would like to move forward, just reply to this email or book a call at onstage.bot/schedule.`,
        ``,
        `We look forward to supporting your robot activation at the show!`,
        ``,
        `— The StageGate Team`,
        `onstage.bot | info@onstage.bot`,
      ].join("\n");

      const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f9f9f9; margin:0; padding:40px 20px; color:#111; }
    .card { background:#fff; max-width:600px; margin:0 auto; border-radius:12px; box-shadow:0 2px 16px rgba(0,0,0,0.08); padding:40px 48px; }
    .logo { font-size:20px; font-weight:800; letter-spacing:-0.5px; color:#111; margin-bottom:28px; }
    .logo span { color:#f59e0b; }
    h2 { font-size:22px; font-weight:700; margin:0 0 12px; }
    p { font-size:14px; line-height:1.7; color:#333; margin:0 0 14px; }
    .quote-ref { background:#f9f9f9; border:1px solid #e5e7eb; border-radius:8px; padding:14px 18px; margin:20px 0; }
    .quote-ref .label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#999; margin-bottom:6px; }
    .quote-ref .value { font-size:14px; font-weight:600; color:#111; }
    .cta { display:inline-block; margin-top:8px; padding:10px 24px; background:#f59e0b; color:#000; font-weight:700; font-size:14px; border-radius:8px; text-decoration:none; }
    .footer { margin-top:36px; padding-top:20px; border-top:1px solid #eee; font-size:12px; color:#999; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Stage<span>Gate</span></div>
    <h2>Just checking in on your quote</h2>
    <p>Hi ${b.contactName ?? "there"},</p>
    <p>
      I wanted to follow up on the quote we sent you for
      <strong>${b.showName ?? "your upcoming show"}</strong>.
      We'd love to help make your robot activation a success!
    </p>

    <div class="quote-ref">
      <div class="label">Your Quote Reference</div>
      <div class="value">${quoteNumber} — ${b.company}</div>
      ${b.showDate ? `<div style="font-size:13px;color:#666;margin-top:4px">Show date: ${b.showDate}</div>` : ""}
      ${b.warehouseEstimate ? `<div style="font-size:13px;color:#666;margin-top:4px">Warehouse estimate: <strong>$${b.warehouseEstimate}</strong></div>` : ""}
    </div>

    <p>
      If you have any questions, want to adjust the scope, or are ready to move forward,
      just reply to this email — we're here to help.
    </p>

    <a href="https://onstage.bot/schedule" class="cta">Book a Call →</a>

    <div class="footer">
      StageGate &bull; onstage.bot &bull; info@onstage.bot<br>
      Robotics Activation Infrastructure &bull; Las Vegas, NV
    </div>
  </div>
</body>
</html>`;

      try {
        await sendEmail({
          to: b.contactEmail,
          subject,
          body: bodyText,
          htmlBody,
        });

        // Stamp follow-up sent timestamp
        await dbConn
          .update(bookingRequests)
          .set({ quoteFollowUpSentAt: new Date() })
          .where(eq(bookingRequests.id, b.id));

        processed++;
      } catch (emailErr: unknown) {
        errors.push(`booking #${b.id}: ${emailErr instanceof Error ? emailErr.message : String(emailErr)}`);
        skipped++;
      }
    }

    return res.json({
      ok: true,
      processed,
      skipped,
      total: eligible.length,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    return res.status(500).json({
      error: message,
      stack,
      context: { url: req.url, taskUid: "unknown" },
      timestamp: new Date().toISOString(),
    });
  }
}
