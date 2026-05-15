/**
 * server/agents/salesAgent.ts
 *
 * Sales Agent — runs as an AGENT cron (nightly).
 * The agent cron spawns a fresh Manus session that does the heavy research
 * (web browsing, deep search) and then POSTs results back to
 * POST /api/scheduled/sales-agent-ingest
 *
 * THIS FILE contains:
 * 1. The /api/scheduled/sales-agent-ingest handler (receives discoveries)
 * 2. The /api/scheduled/sales-agent-outreach handler (sends first emails)
 * 3. The /api/scheduled/sales-agent-followup handler (sends follow-ups)
 * 4. Helper: buildOutreachStrategy (AI per-company strategy)
 * 5. Helper: sendFirstOutreachEmail
 */
import type { Request, Response } from "express";
import { getDb } from "../db";
import {
  prospects,
  tradeShows,
  salesAgentConversations,
  salesAgentRuns,
  emailThreads,
  prospectActivities,
} from "../../drizzle/schema";
import { eq, and, isNull, lt, lte, or, sql } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { sdk } from "../_core/sdk";

const FROM_ADDRESS = "hello@onstage.bot";
const ADMIN_BCC = ["bob@onstage.bot", "tom@starsupportinc.com"];

// ─── 1. Ingest handler — receives discoveries from AGENT cron ────────────────

export async function salesAgentIngestHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "db unavailable" });

    const {
      newProspects = [],
      newShows = [],
      runId,
    } = req.body as {
      newProspects: DiscoveredProspect[];
      newShows: DiscoveredShow[];
      runId?: number;
    };

    let prospectsCreated = 0;
    let showsCreated = 0;

    // Upsert new shows
    for (const show of newShows) {
      const existing = await db
        .select({ id: tradeShows.id })
        .from(tradeShows)
        .where(eq(tradeShows.name, show.name))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(tradeShows).values({
          name: show.name,
          location: show.location ?? null,
          venue: show.venue ?? null,
          city: show.city ?? null,
          website: show.website ?? null,
          description: show.description ?? null,
          roboticsRelevance: show.roboticsRelevance ?? 3,
          status: "upcoming",
        });
        showsCreated++;
      }
    }

    // Upsert new prospects
    for (const p of newProspects) {
      if (!p.company || !p.contactEmail) continue;

      const existing = await db
        .select({ id: prospects.id })
        .from(prospects)
        .where(eq(prospects.contactEmail, p.contactEmail))
        .limit(1);

      if (existing.length > 0) continue; // already in DB

      const [inserted] = await db
        .insert(prospects)
        .values({
          company: p.company,
          contactName: p.contactName ?? null,
          contactEmail: p.contactEmail,
          contactTitle: p.contactTitle ?? null,
          website: p.website ?? null,
          robotName: p.robotName ?? null,
          robotType: p.robotType ?? null,
          shows: p.shows ?? [],
          notes: p.notes ?? null,
          status: "new",
          emailConfidence: p.emailConfidence ?? "medium",
        })
        .returning({ id: prospects.id });

      prospectsCreated++;

      // Create conversation record
      if (inserted?.id) {
        await db.insert(salesAgentConversations).values({
          prospectId: inserted.id,
          state: "discovery",
          lastActivityAt: new Date(),
        });
      }
    }

    // Update run record if provided
    if (runId) {
      await db
        .update(salesAgentRuns)
        .set({
          prospectsFound: newProspects.length,
          prospectsCreated,
          showsFound: newShows.length,
          status: "completed",
          completedAt: new Date(),
        })
        .where(eq(salesAgentRuns.id, runId));
    }

    res.json({ ok: true, prospectsCreated, showsCreated });
  } catch (err) {
    console.error("[SalesAgent ingest error]", err);
    res.status(500).json({ error: String(err), timestamp: new Date().toISOString() });
  }
}

// ─── 2. Outreach handler — sends first emails to new prospects ───────────────

export async function salesAgentOutreachHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "db unavailable" });

    // Find prospects in discovery state with no outreach yet (limit 10 per run)
    const pendingConvs = await db
      .select({
        conv: salesAgentConversations,
        prospect: prospects,
      })
      .from(salesAgentConversations)
      .innerJoin(prospects, eq(salesAgentConversations.prospectId, prospects.id))
      .where(
        and(
          eq(salesAgentConversations.state, "discovery"),
          eq(salesAgentConversations.followUpCount, 0)
        )
      )
      .limit(10);

    let emailsSent = 0;

    for (const { conv, prospect } of pendingConvs) {
      if (!prospect.contactEmail) continue;

      try {
        // Build AI strategy for this company
        const strategy = await buildOutreachStrategy(prospect);

        // Update conversation with strategy
        await db
          .update(salesAgentConversations)
          .set({ strategy, outreachAngle: strategy.slice(0, 200), updatedAt: new Date() })
          .where(eq(salesAgentConversations.id, conv.id));

        // Send first outreach email
        const messageId = await sendFirstOutreachEmail(prospect, strategy);

        // Update conversation state
        await db
          .update(salesAgentConversations)
          .set({
            state: "awaiting_reply",
            followUpCount: 1,
            lastActivityAt: new Date(),
            nextFollowUpAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
            updatedAt: new Date(),
          })
          .where(eq(salesAgentConversations.id, conv.id));

        // Update prospect status
        await db
          .update(prospects)
          .set({ status: "contacted", updatedAt: new Date() })
          .where(eq(prospects.id, prospect.id));

        // Log activity
        await db.insert(prospectActivities).values({
          prospectId: prospect.id,
          type: "email_sent",
          title: `First outreach email sent`,
          description: `AI sales agent sent initial outreach to ${prospect.contactEmail}`,
          metadata: { resendMessageId: messageId, isAiReply: false, isFirstOutreach: true },
        });

        emailsSent++;
      } catch (err) {
        console.error(`[SalesAgent outreach] Failed for prospect ${prospect.id}:`, err);
      }
    }

    res.json({ ok: true, emailsSent });
  } catch (err) {
    console.error("[SalesAgent outreach error]", err);
    res.status(500).json({ error: String(err), timestamp: new Date().toISOString() });
  }
}

// ─── 3. Follow-up handler — sends follow-ups to non-responding prospects ─────

export async function salesAgentFollowupHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "db unavailable" });

    const now = new Date();

    // Find conversations awaiting reply with overdue follow-up date (max 3 follow-ups)
    const dueConvs = await db
      .select({
        conv: salesAgentConversations,
        prospect: prospects,
      })
      .from(salesAgentConversations)
      .innerJoin(prospects, eq(salesAgentConversations.prospectId, prospects.id))
      .where(
        and(
          eq(salesAgentConversations.state, "awaiting_reply"),
          lte(salesAgentConversations.nextFollowUpAt, now),
          lte(salesAgentConversations.followUpCount, 3)
        )
      )
      .limit(15);

    let emailsSent = 0;

    for (const { conv, prospect } of dueConvs) {
      if (!prospect.contactEmail) continue;

      try {
        const followUpNum = (conv.followUpCount ?? 1) + 1;

        // Generate contextual follow-up
        const followUpBody = await generateFollowUp(prospect, conv, followUpNum);

        // Send follow-up
        const subject = `Following up — ${prospect.company} at upcoming shows`;
        const sendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `StageGate Team <${FROM_ADDRESS}>`,
            to: [prospect.contactEmail],
            bcc: ADMIN_BCC,
            subject,
            text: followUpBody,
          }),
        });

        const sendData = sendRes.ok ? (await sendRes.json() as { id?: string }) : null;
        const messageId = sendData?.id ?? null;

        // Store in email_threads
        await db.insert(emailThreads).values({
          prospectId: prospect.id,
          threadId: `prospect-${prospect.id}-thread`,
          direction: "outbound",
          fromAddress: FROM_ADDRESS,
          toAddress: prospect.contactEmail,
          subject,
          body: followUpBody,
          resendMessageId: messageId ?? undefined,
        });

        // Update conversation
        const nextFollowUp = followUpNum >= 3
          ? null // No more follow-ups after 3
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await db
          .update(salesAgentConversations)
          .set({
            followUpCount: followUpNum,
            lastActivityAt: new Date(),
            nextFollowUpAt: nextFollowUp,
            state: followUpNum >= 3 ? "closed" : "awaiting_reply",
            updatedAt: new Date(),
          })
          .where(eq(salesAgentConversations.id, conv.id));

        // Log activity
        await db.insert(prospectActivities).values({
          prospectId: prospect.id,
          type: "email_sent",
          title: `Follow-up #${followUpNum - 1} sent`,
          description: `AI agent sent follow-up to ${prospect.contactEmail}`,
          metadata: { resendMessageId: messageId, followUpNum },
        });

        emailsSent++;
      } catch (err) {
        console.error(`[SalesAgent followup] Failed for prospect ${prospect.id}:`, err);
      }
    }

    res.json({ ok: true, emailsSent });
  } catch (err) {
    console.error("[SalesAgent followup error]", err);
    res.status(500).json({ error: String(err), timestamp: new Date().toISOString() });
  }
}

// ─── 4. Build per-company outreach strategy ──────────────────────────────────

async function buildOutreachStrategy(
  prospect: typeof prospects.$inferSelect
): Promise<string> {
  const showsList = Array.isArray(prospect.shows) ? prospect.shows.join(", ") : "various trade shows";

  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a strategic sales advisor for StageGate, the premier robotics activation infrastructure company in Las Vegas. 
StageGate handles all logistics, warehousing, staging, calibration testing, and trade show activation for robot companies exhibiting at conferences.
Our services: receiving robots at our Las Vegas warehouse, unpacking and staging, calibration and functionality testing, identifying technical issues before the show, booth delivery, show-floor support, and post-show pickup and return shipping.
Write a concise outreach strategy (3-4 sentences) for reaching out to this specific robot company. Focus on their specific robot type, the shows they attend, and what pain points StageGate solves for them. Be specific, not generic.`,
      },
      {
        role: "user",
        content: `Company: ${prospect.company}
Robot: ${prospect.robotName ?? "unknown"} (${prospect.robotType ?? "unknown type"})
Shows they attend: ${showsList}
Website: ${prospect.website ?? "unknown"}
Contact: ${prospect.contactName ?? "unknown"} (${prospect.contactTitle ?? "unknown title"})

Write a 3-4 sentence outreach strategy for this company.`,
      },
    ],
  });

  const content = result.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "Standard robotics activation outreach.";
}

// ─── 5. Send first outreach email ────────────────────────────────────────────

async function sendFirstOutreachEmail(
  prospect: typeof prospects.$inferSelect,
  strategy: string
): Promise<string | null> {
  const showsList = Array.isArray(prospect.shows) ? prospect.shows.join(", ") : "upcoming shows";
  const firstName = prospect.contactName?.split(" ")[0] ?? "there";

  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are writing a first outreach email on behalf of StageGate — the premier robotics activation infrastructure company in Las Vegas.
StageGate handles: receiving robots at our Las Vegas warehouse, unpacking and staging, calibration and functionality testing, identifying technical issues, booth delivery, show-floor support, and post-show pickup.
Write a warm, personalized, non-salesy first outreach email. It should feel like it's from a real person who genuinely understands their business. 3-4 short paragraphs. No bullet points. No subject line in the body.
Sign as: "The StageGate Team\nhello@onstage.bot | onstage.bot"`,
      },
      {
        role: "user",
        content: `Outreach strategy: ${strategy}

Company: ${prospect.company}
Contact first name: ${firstName}
Robot: ${prospect.robotName ?? "your robot"} (${prospect.robotType ?? ""})
Shows they attend: ${showsList}

Write the email body only (no subject line).`,
      },
    ],
  });

  const content = result.choices?.[0]?.message?.content;
  const emailBody = typeof content === "string" ? content : "";
  if (!emailBody) return null;

  const subject = `${prospect.company} at ${showsList.split(",")[0].trim()} — a quick note from StageGate`;

  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `StageGate Team <${FROM_ADDRESS}>`,
      to: [prospect.contactEmail!],
      bcc: ADMIN_BCC,
      subject,
      text: emailBody,
    }),
  });

  const sendData = sendRes.ok ? (await sendRes.json() as { id?: string }) : null;
  const messageId = sendData?.id ?? null;

  // Store in email_threads
  const db = await getDb();
  if (db) {
    await db.insert(emailThreads).values({
      prospectId: prospect.id,
      threadId: `prospect-${prospect.id}-thread`,
      direction: "outbound",
      fromAddress: FROM_ADDRESS,
      toAddress: prospect.contactEmail!,
      subject,
      body: emailBody,
      resendMessageId: messageId ?? undefined,
    });
  }

  return messageId;
}

// ─── 6. Generate follow-up email ─────────────────────────────────────────────

async function generateFollowUp(
  prospect: typeof prospects.$inferSelect,
  conv: typeof salesAgentConversations.$inferSelect,
  followUpNum: number
): Promise<string> {
  const firstName = prospect.contactName?.split(" ")[0] ?? "there";
  const followUpMessages = [
    "a gentle nudge",
    "one final note",
    "a last check-in",
  ];
  const tone = followUpMessages[Math.min(followUpNum - 2, 2)];

  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are writing a follow-up email for StageGate — a robotics activation infrastructure company in Las Vegas. 
This is follow-up #${followUpNum - 1} to a prospect who hasn't responded. Keep it short (2-3 sentences), warm, and not pushy. 
Sign as: "The StageGate Team\nhello@onstage.bot | onstage.bot"`,
      },
      {
        role: "user",
        content: `Write ${tone} follow-up email to ${firstName} at ${prospect.company}.
Original outreach angle: ${conv.outreachAngle ?? "robotics activation services at Las Vegas trade shows"}
Keep it under 3 sentences. No subject line in body.`,
      },
    ],
  });

  const content = result.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : `Hi ${firstName}, just wanted to follow up on my previous note about StageGate's robotics activation services. Would love to connect if the timing is right.\n\nThe StageGate Team\nhello@onstage.bot | onstage.bot`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiscoveredProspect {
  company: string;
  contactName?: string;
  contactEmail?: string;
  contactTitle?: string;
  website?: string;
  robotName?: string;
  robotType?: string;
  shows?: string[];
  notes?: string;
  emailConfidence?: string;
}

interface DiscoveredShow {
  name: string;
  location?: string;
  venue?: string;
  city?: string;
  website?: string;
  description?: string;
  roboticsRelevance?: number;
}
