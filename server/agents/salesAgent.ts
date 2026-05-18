/**
 * server/agents/salesAgent.ts
 *
 * Cal — StageGate's Sales Agent
 * Cal is a logistics guy who knows robots. He's been on the show floor. He gets it.
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
import { eq, and, lte, inArray } from "drizzle-orm";
import { getDb } from "../db.js";
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
  LOGISTICS_BREAKPOINTS,
  DEMO_VENUES,
  ROBOT_GUILD_PITCH,
  type ConversationStage,
} from "./frankPlaybook.js";
import { outreachEmailPolicySummary, selectOutreachEmail } from "../outreachContacts.js";

const OUTREACH_BATCH_SIZE = 8;
const RESEND_API = "https://api.resend.com/emails";
const ADMIN_BCC = "bob@starsupportinc.com";

// Stage advancement map
const NEXT_STAGE: Record<ConversationStage, ConversationStage> = {
  discovery: "intro_sent",
  intro_sent: "followup_1",
  followup_1: "followup_2",
  followup_2: "robot_guild",
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

  const [runRecord] = await db
    .insert(salesAgentRuns)
    .values({ runType: "outreach", status: "running" })
    .returning();
  const runId = runRecord?.id;

  let emailsSent = 0;
  const errors: string[] = [];

  try {
    const now = new Date();

    // Find conversations ready for next action (any actionable stage with nextFollowUpAt due)
    // NOTE: awaiting_reply, responded, scheduling, booked, not_interested, converted are
    // intentionally excluded — automated follow-ups are paused for these states.
    const readyConvs = await db
      .select({ conv: salesAgentConversations, prospect: prospects })
      .from(salesAgentConversations)
      .innerJoin(prospects, eq(salesAgentConversations.prospectId, prospects.id))
      .where(
        and(
          inArray(salesAgentConversations.state, [
            "discovery",
            "intro_sent",
            "followup_1",
            "followup_2",
            "email_opened",  // Opened but no reply — still eligible for follow-up
            "link_clicked",  // Clicked a link — still eligible for follow-up
          ] as ConversationStage[]),
          lte(salesAgentConversations.nextFollowUpAt, now)
        )
      )
      .limit(OUTREACH_BATCH_SIZE);

    for (const { conv, prospect } of readyConvs) {
      const toEmail = selectOutreachEmail(prospect);
      if (!toEmail) continue;
      const emailPolicy = outreachEmailPolicySummary(prospect);

      try {
        const currentStage = conv.state as ConversationStage;
        const { subject, body, nextStage } = await generateFrankEmail(
          prospect,
          conv,
          currentStage
        );
        if (!subject || !body) continue;

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
          details: { errors: errors.slice(0, 10) },
        })
        .where(eq(salesAgentRuns.id, runId));
    }

    res.json({ ok: true, emailsSent, errors: errors.length, runId });
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

// ─── 2. Ingest Handler ────────────────────────────────────────────────────────
export async function salesAgentIngestHandler(req: Request, res: Response) {
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
): Promise<{ ok: true; subject: string; messageId: string | null; nextStage: ConversationStage }> {
  const db = await getDb();
  if (!db) throw new Error("db unavailable");

  const [prospect] = await db
    .select()
    .from(prospects)
    .where(eq(prospects.id, prospectId))
    .limit(1);
  if (!prospect) throw new Error("Prospect not found");
  const toEmail = selectOutreachEmail(prospect);
  if (!toEmail) throw new Error("No contact email");
  const emailPolicy = outreachEmailPolicySummary(prospect);

  const [conv] = await db
    .select()
    .from(salesAgentConversations)
    .where(eq(salesAgentConversations.prospectId, prospectId))
    .limit(1);

  const currentStage = (conv?.state ?? "discovery") as ConversationStage;
  const { subject, body, nextStage } = await generateFrankEmail(prospect, conv ?? null, currentStage);

  if (!subject || !body) {
    throw new Error("Failed to generate email");
  }

  const messageId = await sendFrankEmail(toEmail, prospect.contactName, subject, body);
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

  const delayDays = STAGE_DELAYS_DAYS[nextStage] ?? 5;
  const nextFollowUp = delayDays > 0 ? new Date(now.getTime() + delayDays * 86400000) : null;

  if (conv) {
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
  } else {
    await db.insert(salesAgentConversations).values({
      prospectId,
      state: nextStage,
      lastActivityAt: now,
      nextFollowUpAt: nextFollowUp,
      followUpCount: 1,
    });
  }

  await db.update(prospects).set({ status: "contacted", updatedAt: now }).where(eq(prospects.id, prospectId));

  await db.insert(prospectActivities).values({
    prospectId,
    type: "email_sent",
    title: `Cal (manual): ${subject}`,
    description: `Stage ${currentStage} → ${nextStage}`,
    metadata: { stage: currentStage, nextStage, messageId, manual: true, toEmail, outreachEmailCandidates: emailPolicy.candidates },
  });

  return { ok: true, subject, messageId, nextStage };
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

/**
 * For the discovery stage we use the user's exact example as a fill-in-the-blank
 * template — no LLM for the body. This guarantees Cal's voice is always natural
 * and never formulaic. Follow-up stages still use LLM with a minimal prompt.
 */
function buildDiscoveryEmail(
  prospect: typeof prospects.$inferSelect
): { subject: string; body: string } {
  const contactFirstName = prospect.contactName
    ? prospect.contactName.split(" ")[0] ?? prospect.contactName
    : null;
  const greetingName = contactFirstName ?? "there";

  const primaryShow = Array.isArray(prospect.shows) && prospect.shows.length > 0
    ? prospect.shows[0]!
    : "the upcoming show";

  const body = [
    `Hi ${greetingName},`,
    ``,
    `This is Cal from StageGate. We help companies like yours with robot logistics and technical support during their visit to Las Vegas conferences and with customer demos.`,
    ``,
    `I noticed ${primaryShow} is coming up in Las Vegas and wanted to reach out. Are you planning to attend the show and do you need help with warehousing and staging of your robots at the show?`,
    ``,
    `We operate fully bonded warehouses for robot storage and have teams that can help unpack, test, and fix technical issues that may have occurred during transit. We care for your robots so they are ready to go when you arrive at the conference.`,
    ``,
    `Let me know if this sounds interesting and I'll send a calendar invite for a time to chat. In the meantime, check out onstage.bot and register — it's free.`,
    ``,
    `Thanks,`,
    FRANK_PERSONA.signature,
  ].join("\n");

  const subject = `Quick note — ${prospect.company} at ${primaryShow}`;

  return { subject, body };
}

async function generateFrankEmail(
  prospect: typeof prospects.$inferSelect,
  conv: typeof salesAgentConversations.$inferSelect | null,
  stage: ConversationStage
): Promise<{ subject: string; body: string; nextStage: ConversationStage }> {
  const nextStage = NEXT_STAGE[stage] ?? "robot_guild";

  // Discovery: template only — no LLM, guaranteed Cal's voice
  if (stage === "discovery") {
    const { subject, body } = buildDiscoveryEmail(prospect);
    return { subject, body, nextStage };
  }

  // Follow-up stages: LLM with a tight, minimal prompt
  const primaryShow = Array.isArray(prospect.shows) && prospect.shows.length > 0
    ? prospect.shows[0]!
    : "the upcoming show";

  const robotDesc = [prospect.robotName, prospect.robotType]
    .filter(Boolean)
    .join(" — ") || "your robot";

  const contactFirstName = prospect.contactName
    ? prospect.contactName.split(" ")[0] ?? prospect.contactName
    : null;
  const greetingName = contactFirstName ?? "there";

  const promptTemplate = STAGE_PROMPTS[stage] ?? STAGE_PROMPTS["followup_1"]!;

  const userPrompt = promptTemplate
    .replace(/\{\{companyName\}\}/g, prospect.company)
    .replace(/\{\{contactName\}\}/g, greetingName)
    .replace(/\{\{showName\}\}/g, primaryShow)
    .replace(/\{\{showDates\}\}/g, "")
    .replace(/\{\{showLocation\}\}/g, "Las Vegas")
    .replace(/\{\{robotDescription\}\}/g, robotDesc)
    .replace(/\{\{robotGuildPitch\}\}/g, `${ROBOT_GUILD_PITCH.pitch}\n${ROBOT_GUILD_PITCH.cta}`);

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
  const bodyClean = (parsed.body ?? "")
    .replace(/\n*(Thanks[,.]?|Best[,.]?|Cheers[,.]?)[\s\S]*$/i, "")
    .trimEnd();

  const body = bodyClean + `\n\nThanks,\n${FRANK_PERSONA.signature}`;

  return {
    subject: parsed.subject ?? `Following up — ${prospect.company}`,
    body,
    nextStage,
  };
}

// ─── 5. Send Email via Resend ─────────────────────────────────────────────────
async function sendFrankEmail(
  toEmail: string,
  toName: string | null | undefined,
  subject: string,
  body: string
): Promise<string | null> {
  const toAddress = toName ? `${toName} <${toEmail}>` : toEmail;

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${FRANK_PERSONA.fromName} <${FRANK_PERSONA.fromEmail}>`,
      to: [toAddress],
      bcc: [ADMIN_BCC],
      subject,
      text: body,
      open_tracking: true,
      click_tracking: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[Cal] Resend error:", err);
    return null;
  }

  const data = (await res.json()) as { id?: string };
  return data.id ?? null;
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
