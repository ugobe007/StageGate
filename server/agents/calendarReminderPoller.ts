/**
 * Calendar Reminder Poller — Hourly heartbeat handler
 * Finds events starting in 22–26 hours that haven't had a reminder sent yet,
 * sends reminder emails to the prospect, Tommy, and the owner, then stamps
 * reminderSentAt to prevent duplicate sends.
 */
import { getDb } from "../db";
import { calendarEvents } from "../../drizzle/schema";
import { and, isNull, gte, lte } from "drizzle-orm";
import { sendEmail } from "../email";
import { notifyOwner } from "../_core/notification";
import { emailLogoHtml } from "@shared/siteBrand";

const TOMMY_EMAIL = "tom@starsupportinc.com";
const OWNER_EMAIL = "ugobe07@gmail.com";

export interface ReminderResult {
  checked: number;
  reminded: number;
  errors: number;
}

export async function runCalendarReminderPoller(): Promise<ReminderResult> {
  const db = await getDb();
  if (!db) return { checked: 0, reminded: 0, errors: 0 };

  const now = new Date();
  // Window: events starting between 22h and 26h from now
  const windowStart = new Date(now.getTime() + 22 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 26 * 60 * 60 * 1000);

  const upcoming = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        gte(calendarEvents.startAt, windowStart),
        lte(calendarEvents.startAt, windowEnd),
        isNull(calendarEvents.reminderSentAt),
      )
    );

  let reminded = 0;
  let errors = 0;

  for (const evt of upcoming) {
    // Skip cancelled / completed events
    if (evt.status === "cancelled" || evt.status === "completed") continue;

    try {
      const startDisplay = evt.startAt.toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
        dateStyle: "full",
        timeStyle: "short",
      });
      const shareUrl = evt.shareToken
        ? `https://onstage.bot/calendar/${evt.shareToken}`
        : "https://onstage.bot";

      const internalHtml = `
<div style="font-family:sans-serif;max-width:600px;">
  <h2 style="color:#00E87A;">⏰ Meeting Reminder — ${evt.companyName ?? evt.title}</h2>
  <p>This is a 24-hour reminder for an upcoming meeting.</p>
  <table style="border-collapse:collapse;width:100%;margin:1rem 0;">
    <tr><td style="padding:0.5rem 0;color:#555;width:120px;"><strong>Title</strong></td><td style="padding:0.5rem 0;">${evt.title}</td></tr>
    <tr><td style="padding:0.5rem 0;color:#555;"><strong>Date &amp; Time</strong></td><td style="padding:0.5rem 0;">${startDisplay} (Pacific Time)</td></tr>
    ${evt.companyName ? `<tr><td style="padding:0.5rem 0;color:#555;"><strong>Company</strong></td><td style="padding:0.5rem 0;">${evt.companyName}</td></tr>` : ""}
    ${evt.prospectName ? `<tr><td style="padding:0.5rem 0;color:#555;"><strong>Contact</strong></td><td style="padding:0.5rem 0;">${evt.prospectName} (${evt.prospectEmail ?? ""})</td></tr>` : ""}
    ${evt.notes ? `<tr><td style="padding:0.5rem 0;color:#555;"><strong>Notes</strong></td><td style="padding:0.5rem 0;">${evt.notes}</td></tr>` : ""}
  </table>
  <p><a href="${shareUrl}" style="color:#00E87A;">View Event Details →</a></p>
  <hr style="border-color:#333;">
  <p style="color:#888;font-size:12px;">StageGate • onstage.bot</p>
</div>`;

      const internalSubject = `[StageGate] Reminder: ${evt.title} — Tomorrow at ${startDisplay} PT`;
      const internalText = `Reminder: "${evt.title}" is scheduled for ${startDisplay} PT.\n\nView: ${shareUrl}`;

      // Email Tommy
      await sendEmail({
        to: TOMMY_EMAIL,
        subject: internalSubject,
        body: internalText,
        htmlBody: internalHtml,
      }).catch(e => console.warn("[CalendarReminder] Tommy email failed:", e));

      // Email owner
      await sendEmail({
        to: OWNER_EMAIL,
        subject: internalSubject,
        body: internalText,
        htmlBody: internalHtml,
      }).catch(e => console.warn("[CalendarReminder] Owner email failed:", e));

      // Notify owner via Manus notification
      await notifyOwner({
        title: `Reminder: ${evt.title} — Tomorrow`,
        content: `Meeting with ${evt.companyName ?? "a prospect"} is scheduled for ${startDisplay} PT.\n\nView: ${shareUrl}`,
      }).catch(e => console.warn("[CalendarReminder] Owner notification failed:", e));

      // Email prospect if available
      if (evt.prospectEmail) {
        const prospectHtml = `
<div style="font-family:sans-serif;max-width:600px;">
  ${emailLogoHtml(48)}
  <h2 style="color:#1a1a1a;margin-top:16px;">Reminder: Your Meeting with StageGate is Tomorrow</h2>
  <p>Hi ${evt.prospectName ?? "there"},</p>
  <p>This is a friendly reminder that your meeting with the StageGate team is scheduled for tomorrow:</p>
  <table style="border-collapse:collapse;width:100%;margin:1rem 0;">
    <tr><td style="padding:0.5rem 0;color:#555;width:120px;"><strong>Date &amp; Time</strong></td><td style="padding:0.5rem 0;">${startDisplay} (Pacific Time)</td></tr>
  </table>
  <p><a href="${shareUrl}" style="display:inline-block;background:#00E87A;color:#1C1E22;padding:0.6rem 1.2rem;border-radius:0.25rem;text-decoration:none;font-weight:600;">View Event Details →</a></p>
  <p style="color:#555;">Need to reschedule? Reply to this email or reach us at <a href="mailto:hello@onstage.bot">hello@onstage.bot</a>.</p>
  <hr style="border-color:#eee;">
  <p style="color:#999;font-size:12px;">StageGate — Robotics Activation Infrastructure • <a href="https://onstage.bot" style="color:#999;">onstage.bot</a></p>
</div>`;
        await sendEmail({
          to: evt.prospectEmail,
          subject: `Reminder: Your Meeting with StageGate — Tomorrow at ${startDisplay} PT`,
          body: `Hi ${evt.prospectName ?? "there"},\n\nThis is a reminder that your meeting with StageGate is tomorrow at ${startDisplay} PT.\n\nView event: ${shareUrl}\n\n— StageGate Team\nhello@onstage.bot`,
          htmlBody: prospectHtml,
        }).catch(e => console.warn("[CalendarReminder] Prospect email failed:", e));
      }

      // Stamp reminderSentAt to prevent duplicate sends
      await db
        .update(calendarEvents)
        .set({ reminderSentAt: new Date() })
        .where(
          // Use a raw SQL comparison since Drizzle eq needs exact column reference
          and(gte(calendarEvents.id, evt.id), lte(calendarEvents.id, evt.id))
        );

      reminded++;
    } catch (e) {
      console.error(`[CalendarReminder] Failed for event ${evt.id}:`, e);
      errors++;
    }
  }

  console.log(`[CalendarReminder] checked=${upcoming.length} reminded=${reminded} errors=${errors}`);
  return { checked: upcoming.length, reminded, errors };
}
