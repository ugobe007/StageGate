/**
 * server/agents/salesAgent.ts
 *
 * Cal — StageGate Lead Solutions Engineer
 * Handles discovery drafts (template + insights), follow-ups, and scheduled outreach.
 * Cal writes like a person who genuinely wants to help — not a volume-driven sales bot.
 *
 * 4-stage conversation playbook:
 *   Stage 1 (discovery → intro_sent):     Cold intro — who Cal is, what StageGate does
 *   Stage 2 (intro_sent → followup_1):    Breakpoints — 2 specific logistics pain points
 *   Stage 3 (followup_1 → followup_2):    Demo venue offer — off-floor private space options
 *   Stage 4 (followup_2 → robot_guild):   Robot Guild handoff — brand deals, activations, press
 *
 * Handlers:
 *   POST /api/scheduled/sales-agent-outreach  — nightly batch (cron or admin)
 *   POST /api/scheduled/sales-agent-ingest    — receives discoveries from agent cron
 *   POST /api/scheduled/sales-agent-manual    — admin manual send for a single prospect
 */

import type { Request, Response } from "express";
import { eq, and, or, lte, gte, isNull, inArray, count, sql } from "drizzle-orm";
import { getDb, getUpcomingLasVegasShows } from "../db.js";
import {
  prospects,
  tradeShows,
  salesAgentConversations,
  salesAgentRuns,
  emailThreads,
  draftEmails,
  prospectActivities,
} from "../../drizzle/schema.js";
import { invokeLLM } from "../_core/llm.js";
import { sdk } from "../_core/sdk.js";
import {
  FRANK_PERSONA,
  FRANK_SYSTEM_PROMPT,
  STAGE_PROMPTS,
  STAGE_DELAYS_DAYS,
  MAX_OUTREACH_EMAILS,
  OUTREACH_WEEKLY_DAYS,
  LOGISTICS_BREAKPOINTS,
  DEMO_VENUES,
  ROBOT_GUILD_PITCH,
  type ConversationStage,
} from "./frankPlaybook.js";
import { outreachEmailPolicySummary, selectOutreachEmail } from "../outreachContacts.js";
import { pickCalInsight } from "./calInsights.js";
import { hunterEnabled } from "../integrations/hunter.js";
import { enrichProspectContact, prospectNeedsEnrichment } from "./prospectEnrichment.js";
import { outreachDisabled, screenRecipient, shouldPauseNewIntros } from "../outreachGate.js";

// Emails Cal sends per nightly run. Env-tunable so throughput can be ramped for
// deliverability. Default 20 (the team's documented Resend-safe ceiling) clears
// a ~236-lead backlog in ~12 nights vs the ~30 the old value of 8 required.
const OUTREACH_BATCH_SIZE = Number(process.env.OUTREACH_BATCH_SIZE) || 20;
// Minimum days between two Cal emails to the same prospect. Guards against
// duplicate sends from state drift or overlapping runs; long-dormant leads
// (past campaigns) are outside the window and may re-engage.
const RECENT_SEND_COOLDOWN_DAYS = Number(process.env.OUTREACH_COOLDOWN_DAYS) || 3;
const RESEND_API = "https://api.resend.com/emails";
const ADMIN_BCC = "bob@starsupportinc.com";

// Stage advancement map
const NEXT_STAGE: Record<ConversationStage, ConversationStage> = {
  discovery: "intro_sent",
  intro_sent: "followup_1",
  followup_1: "followup_2",
  followup_2: "followup_2", // Terminal after 3rd email
  robot_guild: "robot_guild",
  email_opened: "followup_1",  // Opened but no reply — send follow-up 1
  link_clicked: "followup_1",  // Clicked a link — send follow-up 1
  awaiting_reply: "awaiting_reply", // v37: replied — no auto-advance
  responded: "responded",
  scheduling: "scheduling",
  booked: "booked",
  not_interested: "not_interested",
  converted: "converted",
};

// ─── 1. Outreach Handler ───────────────────────────────────────────────────────
export async function salesAgentOutreachHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron && user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
  } catch {
    return res.status(403).json({ error: "Invalid session" });
  }

  const db = await getDb();
  if (!db) return res.status(503).json({ error: "db unavailable" });

  // Hard kill switch — stop all automated sends immediately when set.
  if (outreachDisabled()) {
    console.warn("[Cal outreach] OUTREACH_DISABLED is set — skipping run");
    return res.json({ ok: true, emailsSent: 0, disabled: true });
  }

  // Deliverability circuit breaker: if the trailing bounce rate is over
  // threshold, HOLD new intros this cycle to protect sender reputation.
  // Follow-ups to already-engaged threads still run (they land in real inboxes).
  const { paused: introsPaused, stats: bounceStats } = await shouldPauseNewIntros(db);
  if (introsPaused) {
    console.warn(
      `[Cal outreach] circuit breaker OPEN — new intros paused. ` +
        `Trailing ${bounceStats.windowDays}d: ${bounceStats.bounced}/${bounceStats.sent} bounced ` +
        `(${(bounceStats.rate * 100).toFixed(1)}%), threshold ${(bounceStats.threshold * 100).toFixed(0)}%`,
    );
  }

  const [runRecord] = await db
    .insert(salesAgentRuns)
    .values({ runType: "outreach", status: "running" })
    .returning();
  const runId = runRecord?.id;

  let emailsSent = 0;
  const errors: string[] = [];

  try {
    const now = new Date();

    // Actionable stages only. awaiting_reply, responded, scheduling, booked,
    // not_interested, converted are intentionally excluded — automated
    // follow-ups are paused once a human is (or should be) in the loop.
    const ACTIONABLE_STATES = [
      "discovery",
      "intro_sent",
      "followup_1",
      "email_opened",
      "link_clicked",
    ] as ConversationStage[];

    // A conversation is "due" when its timer has elapsed OR was never set.
    // Older discovery seeds left nextFollowUpAt NULL; the previous `<= now`
    // check silently excluded them (SQL NULL comparison), stranding them
    // forever. Treating NULL as due is what actually gets Cal talking.
    const dueFilter = and(
      inArray(salesAgentConversations.state, ACTIONABLE_STATES),
      or(
        lte(salesAgentConversations.nextFollowUpAt, now),
        isNull(salesAgentConversations.nextFollowUpAt)
      )
    );

    const readyConvs = await db
      .select({ conv: salesAgentConversations, prospect: prospects })
      .from(salesAgentConversations)
      .innerJoin(prospects, eq(salesAgentConversations.prospectId, prospects.id))
      .where(dueFilter)
      // Prioritise leads we can actually reach (real inbox on file), then the
      // longest-waiting, so each capped batch converts to the most real sends.
      .orderBy(
        sql`(${prospects.contactEmail} IS NOT NULL AND ${prospects.contactEmail} <> '') DESC`,
        sql`${salesAgentConversations.nextFollowUpAt} ASC NULLS LAST`
      )
      .limit(OUTREACH_BATCH_SIZE);

    // Diagnostics: without this, a run that skips every ready conversation looks
    // identical to a run with nothing to do (status "completed", emailsSent 0).
    // Record why each candidate was skipped so runs are explainable after the fact.
    const skips = { cap: 0, noEmail: 0, emptyBody: 0, recentlyContacted: 0, unverified: 0, pausedIntro: 0 };
    let hunterEnriched = 0;
    const totalDue = await db
      .select({ count: count() })
      .from(salesAgentConversations)
      .where(dueFilter)
      .then((r) => Number(r[0]?.count ?? 0));

    // Safety rail: never email the same prospect twice inside a short window,
    // regardless of conversation-state drift or overlapping runs. Prospects
    // last contacted long ago (e.g. a prior campaign) fall outside this and are
    // free to re-engage. Fetched once as a Set to avoid a per-lead query.
    const cooldownSince = new Date(now.getTime() - RECENT_SEND_COOLDOWN_DAYS * 86400000);
    const recentlyContacted = new Set<number>(
      (
        await db
          .selectDistinct({ prospectId: emailThreads.prospectId })
          .from(emailThreads)
          .where(
            and(
              eq(emailThreads.direction, "outbound"),
              gte(emailThreads.createdAt, cooldownSince)
            )
          )
      )
        .map((r) => r.prospectId)
        .filter((id): id is number => id != null)
    );

    console.log(
      `[Cal outreach] run ${runId}: ${totalDue} conversations due, processing batch of ${readyConvs.length}`
    );

    for (const { conv, prospect } of readyConvs) {
      if ((conv.followUpCount ?? 0) >= MAX_OUTREACH_EMAILS) {
        skips.cap++;
        continue;
      }
      if (recentlyContacted.has(prospect.id)) {
        skips.recentlyContacted++;
        continue;
      }

      // Circuit breaker: when tripped, hold NEW intros (a prospect that has
      // never been emailed sits in "discovery") but let follow-ups to already-
      // contacted threads through — those reach real, engaged inboxes.
      if (introsPaused && (conv.state as ConversationStage) === "discovery") {
        skips.pausedIntro++;
        continue;
      }

      let toEmail = selectOutreachEmail(prospect);
      // No real inbox on file — try Hunter for a verified decision-maker before
      // falling back to a guessed role inbox. Bounded to the batch size per run.
      if ((!toEmail || prospectNeedsEnrichment(prospect)) && hunterEnabled()) {
        const enriched = await enrichProspectContact(prospect, { db });
        if (enriched) {
          hunterEnriched++;
          toEmail = enriched;
        }
      }
      if (!toEmail) {
        skips.noEmail++;
        continue;
      }

      // Final send gate: reject guessed inboxes, suppressed (previously bounced)
      // addresses, and dead domains before we ever hit Resend.
      const screen = await screenRecipient(db, toEmail);
      if (!screen.ok) {
        skips.unverified++;
        console.log(`[Cal outreach] skip prospect ${prospect.id} (${toEmail}): ${screen.reason}`);
        continue;
      }
      const emailPolicy = outreachEmailPolicySummary(prospect);

      try {
        const currentStage = conv.state as ConversationStage;
        const { subject, body, nextStage } = await generateFrankEmail(
          prospect,
          conv,
          currentStage
        );
        if (!subject || !body) {
          skips.emptyBody++;
          continue;
        }

        const messageId = await sendFrankEmail(
          toEmail,
          prospect.contactName,
          subject,
          body
        );

        // Store thread record
        await db.insert(emailThreads).values({
          prospectId: prospect.id,
          threadId: `frank-${prospect.id}`,
          direction: "outbound",
          fromAddress: FRANK_PERSONA.fromEmail,
          toAddress: toEmail,
          subject,
          body,
          resendMessageId: messageId ?? undefined,
        });

        // Store draft record (sent)
        await db.insert(draftEmails).values({
          prospectId: prospect.id,
          subject,
          body,
          agentReasoning: `Cal stage: ${currentStage} → ${nextStage}`,
          status: "sent",
          sentAt: now,
          resendMessageId: messageId ?? undefined,
        });

        // Advance conversation state
        const delayDays = STAGE_DELAYS_DAYS[nextStage] ?? 5;
        const nextFollowUp = delayDays > 0 ? new Date(now.getTime() + delayDays * 86400000) : null;

        await db
          .update(salesAgentConversations)
          .set({
            state: nextStage,
            lastActivityAt: now,
            nextFollowUpAt: nextFollowUp,
            followUpCount: (conv.followUpCount ?? 0) + 1,
            updatedAt: now,
          })
          .where(eq(salesAgentConversations.id, conv.id));

        // Update prospect status
        await db
          .update(prospects)
          .set({ status: "contacted", updatedAt: now })
          .where(eq(prospects.id, prospect.id));

        // Log activity
        await db.insert(prospectActivities).values({
          prospectId: prospect.id,
          type: "email_sent",
          title: `Cal: ${subject}`,
          description: `Stage ${currentStage} → ${nextStage}`,
          metadata: { stage: currentStage, nextStage, messageId, toEmail, outreachEmailCandidates: emailPolicy.candidates },
        });

        emailsSent++;
      } catch (err) {
        const msg = `Prospect ${prospect.id}: ${String(err)}`;
        errors.push(msg);
        console.error("[Cal outreach]", msg);
      }
    }

    if (runId) {
      await db
        .update(salesAgentRuns)
        .set({
          status: "completed",
          emailsSent,
          completedAt: now,
          details: {
            totalDue,
            batchSize: readyConvs.length,
            hunterEnriched,
            skips,
            introsPaused,
            bounceStats,
            errors: errors.slice(0, 10),
          },
        })
        .where(eq(salesAgentRuns.id, runId));
    }
    console.log(
      `[Cal outreach] run ${runId} done: sent ${emailsSent}, hunterEnriched ${hunterEnriched}, skipped ${JSON.stringify(skips)}, errors ${errors.length}`
    );

    res.json({ ok: true, emailsSent, totalDue, hunterEnriched, skips, errors: errors.length, runId });
  } catch (err) {
    console.error("[Cal outreach fatal]", err);
    if (runId) {
      await db
        .update(salesAgentRuns)
        .set({ status: "failed", errorMessage: String(err), completedAt: new Date() })
        .where(eq(salesAgentRuns.id, runId));
    }
    res.status(500).json({ error: String(err) });
  }
}

/** Bearer token used by discovery/RSS jobs when POSTing to the ingest endpoint. */
export function isForgeCronBearer(req: Request): boolean {
  const expected = process.env.BUILT_IN_FORGE_API_KEY;
  if (!expected) return false;
  return req.headers.authorization === `Bearer ${expected}`;
}

// ─── 2. Ingest Handler ────────────────────────────────────────────────────────
export async function salesAgentIngestHandler(req: Request, res: Response) {
  if (!isForgeCronBearer(req)) {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron && user.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
    } catch {
      return res.status(403).json({ error: "Invalid session" });
    }
  }

  const db = await getDb();
  if (!db) return res.status(503).json({ error: "db unavailable" });

  const { newProspects = [], newShows = [], runId } = req.body as {
    newProspects: DiscoveredProspect[];
    newShows: DiscoveredShow[];
    runId?: number;
  };

  let prospectsCreated = 0;
  let showsCreated = 0;

  // Upsert shows
  for (const show of newShows) {
    if (!show.name) continue;
    const existing = await db
      .select({ id: tradeShows.id })
      .from(tradeShows)
      .where(eq(tradeShows.name, show.name))
      .limit(1);
    if (existing.length > 0) continue;

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

  // Upsert prospects
  for (const p of newProspects) {
    if (!p.company) continue;

    // Deduplicate by company name or email
    const existing = await db
      .select({ id: prospects.id })
      .from(prospects)
      .where(eq(prospects.company, p.company))
      .limit(1);
    if (existing.length > 0) continue;

    const [inserted] = await db
      .insert(prospects)
      .values({
        company: p.company,
        contactName: p.contactName ?? null,
        contactEmail: p.contactEmail ?? null,
        contactTitle: p.contactTitle ?? null,
        website: p.website ?? null,
        robotName: p.robotName ?? null,
        robotType: p.robotType ?? null,
        robotCategory: p.robotCategory ?? "light",
        shows: p.shows ?? [],
        notes: p.notes ?? null,
        emailConfidence: p.emailConfidence ?? "low",
        status: "new",
        vendorType: p.vendorType ?? "robot_oem",
        outreachAngle: p.outreachAngle ?? "customer",
      })
      .returning({ id: prospects.id });

    if (inserted?.id) {
      await db.insert(salesAgentConversations).values({
        prospectId: inserted.id,
        state: "discovery",
        nextFollowUpAt: new Date(), // ready immediately
        lastActivityAt: new Date(),
      });
      prospectsCreated++;
    }
  }

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
}

// ─── 3. Manual Send Handler ───────────────────────────────────────────────────
export async function salesAgentManualSendHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
  } catch {
    return res.status(403).json({ error: "Invalid session" });
  }

  const db = await getDb();
  if (!db) return res.status(503).json({ error: "db unavailable" });

  const { prospectId } = req.body as { prospectId: number };
  if (!prospectId) return res.status(400).json({ error: "prospectId required" });
  try {
    const result = await salesAgentManualSendCore(prospectId);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("not found") ? 404 : message.includes("No contact email") ? 400 : 500;
    res.status(status).json({ error: message });
  }
}

export async function salesAgentManualSendCore(
  prospectId: number
): Promise<{ ok: true; subject: string; messageId: string | null; nextStage: ConversationStage; warning?: string }> {
  const db = await getDb();
  if (!db) throw new Error("db unavailable");

  const [prospect] = await db
    .select()
    .from(prospects)
    .where(eq(prospects.id, prospectId))
    .limit(1);
  if (!prospect) throw new Error("Prospect not found");
  const toEmail = selectOutreachEmail(prospect);
  if (!toEmail) throw new Error("No verified contact email (guessed inboxes are no longer sent)");
  const screen = await screenRecipient(db, toEmail);
  if (!screen.ok) {
    throw new Error(`Recipient failed the send gate (${screen.reason}): ${toEmail}`);
  }
  const emailPolicy = outreachEmailPolicySummary(prospect);

  const [conv] = await db
    .select()
    .from(salesAgentConversations)
    .where(eq(salesAgentConversations.prospectId, prospectId))
    .limit(1);

  if ((conv?.followUpCount ?? 0) >= MAX_OUTREACH_EMAILS) {
    throw new Error(`Already sent ${MAX_OUTREACH_EMAILS} emails to this lead`);
  }

  const currentStage = (conv?.state ?? "discovery") as ConversationStage;
  const { subject, body, nextStage } = await generateFrankEmail(prospect, conv ?? null, currentStage);

  if (!subject || !body) {
    throw new Error("Failed to generate email");
  }

  // Attempt to send — capture delivery failure without blocking the workflow
  let messageId: string | null = null;
  let deliveryWarning: string | undefined;
  try {
    messageId = await sendFrankEmail(toEmail, prospect.contactName, subject, body);
  } catch (sendErr) {
    const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
    console.error("[Cal] Delivery failed, recording attempt anyway:", msg);
    deliveryWarning = msg.startsWith("Resend inbound not configured")
      ? "Email queued but not delivered — configure Resend inbound at resend.com → Domains → onstage.bot → Inbound → Notification URL: https://stagegate-production.up.railway.app/api/webhooks/resend-inbound"
      : `Email delivery failed: ${msg}`;
  }

  const now = new Date();

  await db.insert(emailThreads).values({
    prospectId,
    threadId: `frank-${prospectId}`,
    direction: "outbound",
    fromAddress: FRANK_PERSONA.fromEmail,
    toAddress: toEmail,
    subject,
    body,
    resendMessageId: messageId ?? undefined,
  });

  await db.insert(draftEmails).values({
    prospectId,
    subject,
    body,
    agentReasoning: `Manual: ${currentStage} → ${nextStage}`,
    status: "sent",
    sentAt: now,
    resendMessageId: messageId ?? undefined,
  });

  await advanceProspectConversationAfterSend(prospectId, currentStage);

  await db.update(prospects).set({ status: "contacted", updatedAt: now }).where(eq(prospects.id, prospectId));

  await db.insert(prospectActivities).values({
    prospectId,
    type: "email_sent",
    title: `Cal (manual): ${subject}`,
    description: `Stage ${currentStage} → ${nextStage}`,
    metadata: { stage: currentStage, nextStage, messageId, manual: true, toEmail, outreachEmailCandidates: emailPolicy.candidates },
  });

  return { ok: true, subject, messageId, nextStage, ...(deliveryWarning ? { warning: deliveryWarning } : {}) };
}

// ─── 3b. Preview Handler (generates email but does NOT send) ────────────────
export async function salesAgentPreviewHandler(req: Request, res: Response) {
  // Uses salesAgentPreviewCore, which calls generateFrankEmail without an internal HTTP hop.
  try {
    const authHeader = req.headers.authorization;
    const isCronToken = authHeader === `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}`;
    if (!isCronToken) {
      return res.status(403).json({ error: "Forbidden" });
    }
  } catch {
    return res.status(403).json({ error: "Invalid auth" });
  }

  const db = await getDb();
  if (!db) return res.status(503).json({ error: "db unavailable" });

  const { prospectId, stage } = req.body as { prospectId: number; stage?: ConversationStage };
  if (!prospectId) return res.status(400).json({ error: "prospectId required" });
  try {
    const result = await salesAgentPreviewCore(prospectId, stage);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("not found") ? 404 : 500;
    res.status(status).json({ error: message });
  }
}

export async function salesAgentPreviewCore(
  prospectId: number,
  stage?: ConversationStage
): Promise<{ subject: string; body: string; stage: ConversationStage; nextStage: ConversationStage }> {
  const db = await getDb();
  if (!db) throw new Error("db unavailable");

  const [prospect] = await db
    .select()
    .from(prospects)
    .where(eq(prospects.id, prospectId))
    .limit(1);
  if (!prospect) throw new Error("Prospect not found");

  const [conv] = await db
    .select()
    .from(salesAgentConversations)
    .where(eq(salesAgentConversations.prospectId, prospectId))
    .limit(1);

  const currentStage = (stage ?? conv?.state ?? "discovery") as ConversationStage;
  const { subject, body, nextStage } = await generateFrankEmail(prospect, conv ?? null, currentStage);

  return { subject, body, stage: currentStage, nextStage };
}

// ─── 4. Generate Cal's Email ──────────────────────────────────────────────────

// Known show → city. Covers full names, abbreviated names, and year-stripped variants.
// Source: Master Conference Calendar 2026–2027
// Source of truth: trade_shows DB (116 shows, cleaned May 2026).
// Year-specific entries take precedence over base-name entries via resolveShowCity().
const KNOWN_SHOW_CITIES: Record<string, string> = {
  // ── Las Vegas — home market (highest StageGate priority) ─────────────────────
  "CES": "Las Vegas",
  "NAB": "Las Vegas", "NAB Show": "Las Vegas",
  "Manifest": "Las Vegas", "Manifest Vegas": "Las Vegas",
  "Manifest 2026": "Las Vegas", "Manifest 2027": "Las Vegas",
  "HIMSS 2026": "Las Vegas", "HIMSS26": "Las Vegas",   // 2026 = Las Vegas
  "ISC West": "Las Vegas",
  "ISSA Show": "Las Vegas", "ISSA Show North America": "Las Vegas", "ISSA Show North America 2026": "Las Vegas",
  "G2E": "Las Vegas", "G2E — Global Gaming Expo": "Las Vegas",
  "PACK EXPO Las Vegas": "Las Vegas",
  "World of Concrete": "Las Vegas",
  "HDExpo": "Las Vegas", "HDExpo + Conference": "Las Vegas",
  "MINExpo": "Las Vegas",
  "CONEXPO": "Las Vegas", "CONEXPO-CON/AGG": "Las Vegas",
  "Ai4": "Las Vegas", "Ai4 Conference": "Las Vegas",
  "AI4": "Las Vegas",
  "FABTECH 2026": "Las Vegas",
  "SHOT Show": "Las Vegas",
  "SEMA Show": "Las Vegas", "SEMA": "Las Vegas",
  "SAGES Annual Meeting 2027": "Las Vegas",  // 2027 moves to LV
  "Transform": "Las Vegas", "Transform 2027": "Las Vegas",
  "Interop": "Las Vegas",
  "Automate 2027": "Las Vegas",              // confirmed: moves LV for 2027
  "PACK EXPO Las Vegas 2027": "Las Vegas",
  "AWS re:Invent": "Las Vegas",
  "MJBizCon": "Las Vegas",
  "ACT Expo": "Las Vegas", "ACT Expo 2027": "Las Vegas",
  "Fastmarkets Global Lithium": "Las Vegas",
  // ── Chicago ──────────────────────────────────────────────────────────────────
  "IMTS": "Chicago", "IMTS 2026": "Chicago",
  "ProMat": "Chicago", "MHI ProMat": "Chicago", "ProMat 2027": "Chicago",
  "Automate": "Chicago", "Automate 2026": "Chicago",
  "PACK EXPO International": "Chicago", "PACK EXPO International 2026": "Chicago",
  "Assembly Show": "Rosemont, IL", "Assembly Show 2026": "Rosemont, IL",
  "Assembly Show 2027": "Rosemont, IL",
  "RSNA": "Chicago", "RSNA 2026": "Chicago", "RSNA 2027": "Chicago",
  "FABTECH 2027": "Chicago",
  "HIMSS 2027": "Chicago", "HIMSS27": "Chicago",  // 2027 moved to Chicago
  "CoRL": "Austin, TX", "CoRL 2026": "Austin, TX",
  // ── Atlanta ──────────────────────────────────────────────────────────────────
  "MODEX": "Atlanta", "MODEX 2026": "Atlanta",
  "SPS Americas": "Atlanta", "SPS Americas 2027": "Atlanta",
  // ── Other US ─────────────────────────────────────────────────────────────────
  "NVIDIA GTC": "San Jose, CA", "GTC": "San Jose, CA",
  "NVIDIA GTC 2026": "San Jose, CA", "NVIDIA GTC 2027": "San Jose, CA",
  "World Agri-Tech": "San Francisco, CA", "World Agri-Tech Summit": "San Francisco, CA",
  "SXSW": "Austin, TX", "SXSW 2026": "Austin, TX", "SXSW 2027": "Austin, TX",
  "Robotics Summit": "Boston, MA", "Robotics Summit & Expo": "Boston, MA",
  "RoboBusiness": "Santa Clara, CA", "RoboBusiness 2026": "Santa Clara, CA",
  "RoboBusiness 2027": "Santa Clara, CA",
  "Humanoids": "Santa Clara, CA", "Humanoids 2026": "Santa Clara, CA",
  "VB Transform": "Menlo Park, CA",
  "FIRA USA": "Yakima, WA", "FIRA USA 2026": "Yakima, WA",
  "AUVSI XPONENTIAL": "Detroit, MI", "AUVSI XPONENTIAL 2026": "Detroit, MI",
  "AUVSI XPONENTIAL 2027": "Miami Beach, FL",  // moves to Miami Beach
  "AUVSI": "Detroit, MI",
  "Sea-Air-Space": "National Harbor, MD",
  "Modern Day Marine": "Washington, DC",
  "AUSA": "Washington, DC", "AUSA Annual Meeting": "Washington, DC",
  "IROS": "Pittsburgh, PA", "IROS 2026": "Pittsburgh, PA",
  "IROS 2027": "Florence, Italy",
  "PARCEL Forum": "Orlando, FL",
  "Home Delivery World": "Nashville, TN",
  "ISMR": "Knoxville, TN", "ISMR 2026": "Knoxville, TN",
  "ATX West": "Anaheim, CA",
  "ICRA": "Vienna, Austria", "ICRA 2026": "Vienna, Austria",
  "ICRA 2027": "Seoul, South Korea",
  "SAGES Annual Meeting": "Tampa, FL",       // base = Tampa (2026 location)
  "SAGES Annual Meeting 2026": "Tampa, FL",
  "AI Summit New York": "New York, NY",
  "CEDIA": "Denver, CO",
  // ── Europe ───────────────────────────────────────────────────────────────────
  "Hannover Messe": "Hannover, Germany",
  "SPS Nuremberg": "Nuremberg, Germany", "SPS": "Nuremberg, Germany",
  "MEDICA": "Düsseldorf, Germany",
  "Agritechnica": "Hannover, Germany",
  "Automatica": "Munich, Germany", "Automatica 2027": "Munich, Germany",
  "EMO Milan": "Milan, Italy", "EMO Milan 2027": "Milan, Italy",
  "Eurosatory": "Paris, France",
  "DSEI": "London, UK", "DSEI 2027": "London, UK",
  "AI Summit London": "London, UK",
  "LogiMAT": "Stuttgart, Germany",
  "Web Summit Lisbon": "Lisbon, Portugal", "Web Summit": "Lisbon, Portugal",
  "NeurIPS": "Sydney, Australia", "NeurIPS 2026": "Sydney, Australia",
  "RSS": "Sydney, Australia", "RSS 2026": "Sydney, Australia",
  "ICML 2026": "Seoul, South Korea",
  "RoboCup 2026": "Incheon, South Korea",
  "RoboCup 2027": "Nuremberg, Germany",
  // ── Asia / International ──────────────────────────────────────────────────────
  "Manufacturing World Tokyo": "Tokyo, Japan",
  "iREX": "Tokyo, Japan", "iREX 2027": "Tokyo, Japan",
  "Smart Factory Expo Tokyo": "Tokyo, Japan",
  "WAIC": "Shanghai, China", "WAIC Shanghai": "Shanghai, China",
  "CIIF": "Shanghai, China",
  "World Robot Conference": "Beijing, China",
  "IDEX": "Abu Dhabi, UAE", "IDEX 2027": "Abu Dhabi, UAE",
  "ITAP": "Singapore",
  "AAAI": "Singapore", "AAAI-26": "Singapore",
  "AAAI-27": "Montréal, Canada",
  "Web Summit Vancouver": "Vancouver, Canada",
  "ICLR 2026": "Rio de Janeiro, Brazil",
  // ── Academic varies by year ───────────────────────────────────────────────────
  "HITEC": "varies",
};

async function resolveShowCity(showName: string): Promise<string> {
  if (!showName || showName === "the upcoming show") return "Las Vegas";

  // 1. Hardcoded map — exact key match first, then substring, then year-stripped
  if (KNOWN_SHOW_CITIES[showName]) return KNOWN_SHOW_CITIES[showName]!;

  // Try stripping trailing year (e.g. "CES 2026" → "CES")
  const yearStripped = showName.replace(/\s+20\d{2}$/, "").trim();
  if (yearStripped !== showName && KNOWN_SHOW_CITIES[yearStripped]) {
    return KNOWN_SHOW_CITIES[yearStripped]!;
  }

  // Substring match (show name contains a known key)
  for (const [key, city] of Object.entries(KNOWN_SHOW_CITIES)) {
    if (showName.toLowerCase().includes(key.toLowerCase())) return city;
  }

  // 2. Exact DB match
  try {
    const db = await getDb();
    if (db) {
      const [exact] = await db
        .select({ city: tradeShows.city, location: tradeShows.location })
        .from(tradeShows)
        .where(eq(tradeShows.name, showName))
        .limit(1);
      if (exact?.city ?? exact?.location) return exact.city ?? exact.location ?? "Las Vegas";

      // 3. Fuzzy DB match — show name contains or is contained by DB name
      const all = await db
        .select({ name: tradeShows.name, city: tradeShows.city, location: tradeShows.location })
        .from(tradeShows);
      const nameLower = showName.toLowerCase();
      for (const row of all) {
        const dbLower = row.name.toLowerCase();
        if (dbLower.includes(nameLower) || nameLower.includes(dbLower)) {
          return row.city ?? row.location ?? "Las Vegas";
        }
      }
    }
  } catch { /* fall through */ }

  return "Las Vegas";
}

import {
  buildCalPartnerEmail,
  isPartnerProspect,
  resolveGreetingName,
  greetingLine,
  normalizeCalEmailGreeting,
  calSalutationForProspect,
} from "../services/partnerEmail.js";

/**
 * Stage 1 (Introduce) uses a fixed template — no LLM — so Cal's advisor voice is
 * always consistent. This is an introduction, not a pitch: it teaches one field
 * lesson, makes no ask, and offers help only if it's useful. Later stages use
 * the LLM with the trusted-advisor stage prompts.
 */
function buildDiscoveryEmail(
  prospect: typeof prospects.$inferSelect,
  showName: string,
  _showCity: string,
  _upcomingLvShows: string[] = []
): { subject: string; body: string } {
  const resolved = resolveGreetingName({
    contactName: prospect.contactName,
    contactEmail: prospect.contactEmail,
    company: prospect.company,
  });
  const salutation = greetingLine(resolved.greetingName, prospect.company);

  // One field lesson to teach in the intro (deployment-focused, not show-floor).
  const insight = pickCalInsight({
    showName,
    robotType: prospect.robotType,
    companyName: prospect.company,
    allowHumor: false,
  });

  const body = normalizeCalEmailGreeting(
    [
      `This is Cal at StageGate. I spend most of my time helping companies get robots ready for real operations — not demos — so I wanted to introduce myself. Your team looks like it's investing in automation, and we've learned a few things that tend to save people time and money.`,
      ``,
      insight,
      ``,
      `No ask here — I'm not trying to sell you anything. StageGate is the deployment side of physical AI: the logistics, activation, integration, training, and support that turn a robot you bought into a system that actually runs. If that's ever useful, I'm glad to share what works.`,
      ``,
      `onstage.bot has more if you want it. Either way, good luck with what you're building.`,
      ``,
      FRANK_PERSONA.signature,
    ].join("\n"),
    salutation,
  );

  const subject = `Introducing myself — deployment notes for ${prospect.company}`;

  return { subject, body };
}

async function generateFrankEmail(
  prospect: typeof prospects.$inferSelect,
  conv: typeof salesAgentConversations.$inferSelect | null,
  stage: ConversationStage
): Promise<{ subject: string; body: string; nextStage: ConversationStage }> {
  const nextStage = NEXT_STAGE[stage] ?? "robot_guild";

  const primaryShow = Array.isArray(prospect.shows) && prospect.shows.length > 0
    ? prospect.shows[0]!
    : "the upcoming show";

  // Discovery: template only — no LLM, guaranteed Cal's voice
  if (stage === "discovery") {
    const showCity = await resolveShowCity(primaryShow);
    // Fetch upcoming LV shows so Cal can name them in non-LV emails
    const lvShows = await getUpcomingLasVegasShows(6);
    const lvShowNames = lvShows
      .filter(s => s.name !== primaryShow)
      .map(s => s.name)
      .slice(0, 3);
    const { subject, body } = isPartnerProspect(prospect)
      ? buildCalPartnerEmail({
          company: prospect.company,
          contactName: prospect.contactName,
          vendorType: prospect.vendorType,
          showName: primaryShow,
          showCity,
        })
      : buildDiscoveryEmail(prospect, primaryShow, showCity, lvShowNames);
    return { subject, body, nextStage };
  }

  // Follow-up stages: LLM with a tight, minimal prompt

  const robotDesc = [prospect.robotName, prospect.robotType]
    .filter(Boolean)
    .join(" — ") || "your robot";

  const resolved = resolveGreetingName({
    contactName: prospect.contactName,
    contactEmail: prospect.contactEmail,
    company: prospect.company,
  });
  const salutation = greetingLine(resolved.greetingName, prospect.company);
  const contactLabel = resolved.greetingName ?? `${prospect.company} team`;

  const promptTemplate = STAGE_PROMPTS[stage] ?? STAGE_PROMPTS["followup_1"]!;

  const calInsight = pickCalInsight({
    showName: primaryShow,
    robotType: prospect.robotType,
    companyName: prospect.company,
    seed: `${prospect.company}:${stage}`,
    allowHumor: true,
  });

  const userPrompt = promptTemplate
    .replace(/\{\{companyName\}\}/g, prospect.company)
    .replace(/\{\{contactName\}\}/g, contactLabel)
    .replace(/\{\{greetingLine\}\}/g, salutation)
    .replace(/\{\{showName\}\}/g, primaryShow)
    .replace(/\{\{showDates\}\}/g, "")
    .replace(/\{\{showLocation\}\}/g, "Las Vegas")
    .replace(/\{\{robotDescription\}\}/g, robotDesc)
    .replace(/\{\{robotGuildPitch\}\}/g, `${ROBOT_GUILD_PITCH.pitch}\n${ROBOT_GUILD_PITCH.cta}`)
    .replace(/\{\{calInsight\}\}/g, calInsight);

  const result = await invokeLLM({
    messages: [
      { role: "system", content: FRANK_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "frank_email",
        strict: true,
        schema: {
          type: "object",
          properties: {
            subject: { type: "string", description: "Short specific subject line, no clickbait" },
            body: { type: "string", description: "Email body only, no subject line, Cal's voice, under 130 words" },
          },
          required: ["subject", "body"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = result.choices?.[0]?.message?.content;
  const contentStr = typeof rawContent === "string" ? rawContent : "{}";

  let parsed: { subject?: string; body?: string } = {};
  try {
    parsed = JSON.parse(contentStr);
  } catch {
    const lines = contentStr.split("\n");
    parsed.subject = lines[0]?.replace(/^Subject:\s*/i, "").trim();
    parsed.body = lines.slice(1).join("\n").trim();
  }

  // Strip any LLM-generated sign-off and append the canonical signature
  const bodyClean = normalizeCalEmailGreeting(
    (parsed.body ?? "")
      .replace(/\n*(Thanks[,.]?|Best[,.]?|Cheers[,.]?)[\s\S]*$/i, "")
      .trimEnd(),
    salutation,
  );

  const body = bodyClean + `\n\nThanks,\n${FRANK_PERSONA.signature}`;

  return {
    subject: parsed.subject ?? `Following up — ${prospect.company}`,
    body,
    nextStage,
  };
}

// ─── 5. Send Email via Resend ─────────────────────────────────────────────────
function _isNotificationUrlError(errText: string): boolean {
  const t = errText.toLowerCase();
  return ["notification service", "notification_service", "notification url",
    "notification_url", "not set", "not configured", "inbound"].some(kw => t.includes(kw));
}

async function sendFrankEmail(
  toEmail: string,
  toName: string | null | undefined,
  subject: string,
  body: string
): Promise<string | null> {
  const toAddress = toName ? `${toName} <${toEmail}>` : toEmail;

  const buildPayload = (withTracking: boolean) => ({
    from: `${FRANK_PERSONA.fromName} <${FRANK_PERSONA.fromEmail}>`,
    to: [toAddress],
    bcc: [ADMIN_BCC],
    subject,
    text: body,
    ...(withTracking ? { open_tracking: true, click_tracking: true } : {}),
  });

  const attempt = async (withTracking: boolean) => {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildPayload(withTracking)),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }
    return (await res.json()) as { id?: string };
  };

  try {
    const data = await attempt(true);
    return data.id ?? null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (_isNotificationUrlError(msg)) {
      console.warn("[Cal] Resend notification URL not configured — retrying without tracking. Set up Resend webhook at: https://resend.com/webhooks");
      try {
        const data = await attempt(false);
        return data.id ?? null;
      } catch (e2) {
        const msg2 = e2 instanceof Error ? e2.message : String(e2);
        if (_isNotificationUrlError(msg2)) {
          // Both attempts rejected — Resend requires the inbound Notification URL to be set on the domain.
          // Surface this as a thrown error so the tRPC layer can show the user an actionable message.
          throw new Error(
            "Resend inbound not configured: go to resend.com → Domains → onstage.bot → Inbound → set Notification URL to https://stagegate-production.up.railway.app/api/webhooks/resend-inbound"
          );
        }
        console.error("[Cal] Resend retry failed:", e2);
        return null;
      }
    }
    console.error("[Cal] Resend error:", msg);
    return null;
  }
}

// ─── 6. Pick Relevant Breakpoints ────────────────────────────────────────────
function pickBreakpoints(robotType: string, robotCategory: string = "light") {
  const type = robotType.toLowerCase();
  const isHeavy = robotCategory === "heavy_industrial" || robotCategory === "mixed";

  // Heavy industrial robots (Fanuc, Yaskawa, Omron, KUKA) — power and rigging are the key pain points
  if (isHeavy) {
    return LOGISTICS_BREAKPOINTS.filter((b) =>
      ["power", "staging", "crating", "repair"].includes(b.id)
    ).slice(0, 2);
  }


  if (type.includes("humanoid") || type.includes("biped")) {
    return LOGISTICS_BREAKPOINTS.filter((b) =>
      ["crating", "staging", "floor_surface", "repair"].includes(b.id)
    ).slice(0, 2);
  }
  if (type.includes("drone") || type.includes("aerial")) {
    return LOGISTICS_BREAKPOINTS.filter((b) =>
      ["shipping", "power", "off_floor_demos"].includes(b.id)
    ).slice(0, 2);
  }
  if (type.includes("mobile") || type.includes("amr") || type.includes("wheel")) {
    return LOGISTICS_BREAKPOINTS.filter((b) =>
      ["floor_surface", "staging", "storage"].includes(b.id)
    ).slice(0, 2);
  }
  if (type.includes("arm") || type.includes("manipulator")) {
    return LOGISTICS_BREAKPOINTS.filter((b) =>
      ["power", "staging", "repair"].includes(b.id)
    ).slice(0, 2);
  }

  return LOGISTICS_BREAKPOINTS.filter((b) =>
    ["shipping", "staging"].includes(b.id)
  ).slice(0, 2);
}

const DRAFTABLE_STAGES: ConversationStage[] = ["discovery", "intro_sent", "followup_1"];

/** Advance conversation after a draft is sent (manual or automated). Max 3 emails per lead. */
export async function advanceProspectConversationAfterSend(
  prospectId: number,
  sentStage?: ConversationStage,
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const [conv] = await db
    .select()
    .from(salesAgentConversations)
    .where(eq(salesAgentConversations.prospectId, prospectId))
    .limit(1);

  if (!conv) {
    await db.insert(salesAgentConversations).values({
      prospectId,
      state: "intro_sent",
      followUpCount: 1,
      nextFollowUpAt: new Date(now.getTime() + OUTREACH_WEEKLY_DAYS * 86400000),
      lastActivityAt: now,
    });
    return;
  }

  if ((conv.followUpCount ?? 0) >= MAX_OUTREACH_EMAILS) return;

  const currentStage = (sentStage ?? conv.state) as ConversationStage;
  const nextStage = NEXT_STAGE[currentStage] ?? "followup_2";
  const newCount = (conv.followUpCount ?? 0) + 1;
  const atCap = newCount >= MAX_OUTREACH_EMAILS;
  const delayDays = atCap ? 0 : OUTREACH_WEEKLY_DAYS;

  await db
    .update(salesAgentConversations)
    .set({
      state: atCap ? "followup_2" : nextStage,
      followUpCount: newCount,
      nextFollowUpAt: delayDays > 0 ? new Date(now.getTime() + delayDays * 86400000) : null,
      lastActivityAt: now,
      updatedAt: now,
    })
    .where(eq(salesAgentConversations.id, conv.id));
}

/** Fix pending drafts that open with "Hey there," / "Hi there," / generic "Hi team," etc. */
async function repairPendingDraftGreetings(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<number> {
  const emailHelpers = await import("../email.js");
  const entries = await emailHelpers.getDraftsWithRecipients(["pending", "approved"], "prospect");
  let fixed = 0;
  for (const entry of entries) {
    if (!entry.prospect) continue;
    const salutation = calSalutationForProspect(entry.prospect);
    const normalized = normalizeCalEmailGreeting(entry.draft.body, salutation);
    if (normalized !== entry.draft.body) {
      await db.update(draftEmails).set({ body: normalized }).where(eq(draftEmails.id, entry.draft.id));
      fixed++;
    }
  }
  if (fixed > 0) {
    console.log(`[Cal] Repaired greeting on ${fixed} pending draft(s)`);
  }
  return fixed;
}

/** Regenerate body + subject for every pending prospect draft (true redraft). */
export async function redraftPendingCalDraftsCore(): Promise<{
  redrafted: number;
  errors: string[];
}> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const emailHelpers = await import("../email.js");
  const entries = await emailHelpers.getDraftsWithRecipients(["pending"], "prospect");
  let redrafted = 0;
  const errors: string[] = [];

  for (const entry of entries) {
    if (!entry.prospect) continue;
    const [conv] = await db
      .select()
      .from(salesAgentConversations)
      .where(eq(salesAgentConversations.prospectId, entry.prospect.id))
      .limit(1);

    const stage = (conv?.state ?? "discovery") as ConversationStage;
    try {
      const preview = await salesAgentPreviewCore(entry.prospect.id, stage);
      await db
        .update(draftEmails)
        .set({
          subject: preview.subject,
          body: preview.body,
          agentReasoning: `Cal redraft — stage ${stage}`,
        })
        .where(eq(draftEmails.id, entry.draft.id));
      redrafted++;
    } catch (e) {
      errors.push(`${entry.prospect.company}: ${String(e).slice(0, 100)}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  await repairPendingDraftGreetings(db);
  console.log(`[Cal] Redrafted ${redrafted} pending draft(s)`);
  return { redrafted, errors: errors.slice(0, 20) };
}

/** Draft the next Cal email for each lead (weekly cadence, max 3 emails per lead). */
export async function generateCalDraftsCore(options?: {
  prospectIds?: number[];
}): Promise<{ generated: number; skipped: number; conversationsSeeded: number; errors: string[]; total: number }> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const { listProspects } = await import("../db.js");
  const emailHelpers = await import("../email.js");

  await repairPendingDraftGreetings(db);

  const allProspects = await listProspects();
  const targets = options?.prospectIds
    ? allProspects.filter((p: { id: number }) => options.prospectIds!.includes(p.id))
    : allProspects;

  let generated = 0;
  let skipped = 0;
  let conversationsSeeded = 0;
  const errors: string[] = [];
  const now = new Date();

  for (const prospect of targets as Array<{ id: number; company: string; contactEmail: string | null }>) {
    const toEmail = emailHelpers.getProspectOutreachEmail(prospect);
    if (!toEmail) { skipped++; continue; }

    const existing = await emailHelpers.getDraftsForProspect(prospect.id);
    const hasPending = existing.some((d: { status: string }) => d.status === "pending" || d.status === "approved");
    if (hasPending) { skipped++; continue; }

    const [conv] = await db
      .select()
      .from(salesAgentConversations)
      .where(eq(salesAgentConversations.prospectId, prospect.id))
      .limit(1);

    if ((conv?.followUpCount ?? 0) >= MAX_OUTREACH_EMAILS || conv?.state === "followup_2") {
      skipped++;
      continue;
    }

    const stage = (conv?.state ?? "discovery") as ConversationStage;
    if (!DRAFTABLE_STAGES.includes(stage)) {
      skipped++;
      continue;
    }

    // Weekly cadence: wait until nextFollowUpAt unless this is the first email
    if (
      conv &&
      (conv.followUpCount ?? 0) > 0 &&
      conv.nextFollowUpAt &&
      conv.nextFollowUpAt > now
    ) {
      skipped++;
      continue;
    }

    if (!conv) {
      await db.insert(salesAgentConversations).values({
        prospectId: prospect.id,
        state: "discovery",
        nextFollowUpAt: now,
        lastActivityAt: now,
      });
      conversationsSeeded++;
    }

    try {
      const preview = await salesAgentPreviewCore(prospect.id, stage);
      await emailHelpers.createDraft({
        prospectId: prospect.id,
        subject: preview.subject,
        body: preview.body,
        agentReasoning: `Cal draft — email ${(conv?.followUpCount ?? 0) + 1} of ${MAX_OUTREACH_EMAILS}, stage: ${stage}`,
      });
      generated++;
    } catch (e) {
      errors.push(`${prospect.company}: ${String(e).slice(0, 100)}`);
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  return { generated, skipped, conversationsSeeded, errors: errors.slice(0, 20), total: targets.length };
}

/** Weekly cron: draft the next Cal email for leads due this week. */
export async function calWeeklyDraftsHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron && user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
  } catch {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const result = await generateCalDraftsCore();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DiscoveredProspect {
  company: string;
  contactName?: string;
  contactEmail?: string;
  contactTitle?: string;
  website?: string;
  robotName?: string;
  robotType?: string;
  robotCategory?: string; // light | heavy_industrial | mixed
  shows?: string[];
  notes?: string;
  emailConfidence?: string;
  vendorType?: string;
  outreachAngle?: string;
}

export interface DiscoveredShow {
  name: string;
  location?: string;
  venue?: string;
  city?: string;
  website?: string;
  description?: string;
  roboticsRelevance?: number;
}
