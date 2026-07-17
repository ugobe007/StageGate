/**
 * Relay auto-send policy — stage × confidence × breaker × intent matrix.
 *
 * Closes the draft-review gap for safe, pre-approved send classes while
 * respecting the deliverability circuit breaker for new intros.
 */

import { and, eq, inArray, or } from "drizzle-orm";
import type { getDb } from "../db.js";
import {
  draftEmails,
  prospects,
  salesAgentConversations,
} from "../../drizzle/schema.js";
import type { IntentCategory, Confidence } from "./intentClassifier.js";
import {
  outreachDisabled,
  shouldPauseNewIntros,
  isSuppressed,
} from "../outreachGate.js";
import { isSendableEmailConfidence } from "../outreachContacts.js";
import { advanceProspectConversationAfterSend } from "./salesAgent.js";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type AutoSendReason =
  | "approved_followup"
  | "approved_intro"
  | "inbound_scheduling"
  | "engaged_followup"
  | "blocked_breaker"
  | "blocked_low_confidence"
  | "blocked_question"
  | "blocked_no_email"
  | "blocked_suppressed"
  | "blocked_outreach_disabled"
  | "blocked_partner_draft"
  | "blocked_pending_review";

export type AutoSendDecision = {
  allowed: boolean;
  reason: AutoSendReason;
  detail?: string;
};

export type RelayAutoSendResult = {
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
  decisions: Array<{ draftId: number; company: string; reason: AutoSendReason }>;
  errors: string[];
};

const SCHEDULING_INTENTS = new Set<IntentCategory>([
  "POSITIVE_SCHEDULE",
  "CALENDAR_REQUEST",
  "AVAILABILITY_GIVEN",
  "ASKING_AVAILABILITY",
]);

const ENGAGED_STATES = new Set([
  "intro_sent",
  "followup_1",
  "followup_2",
  "email_opened",
  "link_clicked",
  "awaiting_reply",
  "scheduling",
]);

const BATCH = Number(process.env.RELAY_AUTO_SEND_BATCH) || 15;

/** Parse intent from inbound draft agentReasoning (`Intent: POSITIVE_SCHEDULE | ...`). */
export function parseDraftIntent(agentReasoning: string | null | undefined): IntentCategory | null {
  if (!agentReasoning) return null;
  const m = agentReasoning.match(/Intent:\s*([A-Z_]+)/);
  return (m?.[1] as IntentCategory | undefined) ?? null;
}

export function evaluateAutoSendPolicy(input: {
  convState: string;
  emailConfidence: string | null;
  introsPaused: boolean;
  intent?: IntentCategory | null;
  draftStatus: "pending" | "approved";
  isPartnerDraft: boolean;
  suppressed: boolean;
  hasEmail: boolean;
}): AutoSendDecision {
  if (input.isPartnerDraft) {
    return { allowed: false, reason: "blocked_partner_draft" };
  }
  if (!input.hasEmail) {
    return { allowed: false, reason: "blocked_no_email" };
  }
  if (input.suppressed) {
    return { allowed: false, reason: "blocked_suppressed" };
  }

  const conf = (input.emailConfidence ?? "").trim().toLowerCase();
  const sendableConf = isSendableEmailConfidence(conf);
  const intent = input.intent ?? null;

  if (intent === "QUESTION") {
    return { allowed: false, reason: "blocked_question", detail: "Questions need human review" };
  }

  if (intent && SCHEDULING_INTENTS.has(intent) && sendableConf) {
    return { allowed: true, reason: "inbound_scheduling" };
  }

  const isDiscoveryIntro = input.convState === "discovery";
  if (isDiscoveryIntro && input.introsPaused) {
    return { allowed: false, reason: "blocked_breaker", detail: "New intros paused — circuit breaker open" };
  }

  if (input.draftStatus === "approved") {
    if (isDiscoveryIntro && sendableConf) {
      return { allowed: true, reason: "approved_intro" };
    }
    if (ENGAGED_STATES.has(input.convState) && sendableConf) {
      return { allowed: true, reason: "approved_followup" };
    }
    if (ENGAGED_STATES.has(input.convState) && input.draftStatus === "approved") {
      return { allowed: true, reason: "engaged_followup" };
    }
  }

  if (input.draftStatus === "pending" && ENGAGED_STATES.has(input.convState) && sendableConf) {
    if (input.convState === "scheduling" || input.convState === "awaiting_reply") {
      return { allowed: true, reason: "inbound_scheduling" };
    }
    if (input.convState !== "discovery") {
      return { allowed: true, reason: "engaged_followup" };
    }
  }

  if (!sendableConf) {
    return { allowed: false, reason: "blocked_low_confidence" };
  }

  return { allowed: false, reason: "blocked_pending_review" };
}

/** Discard pending/approved drafts tied to dead, skipped, or suppressed prospects. */
export async function discardStaleDrafts(db: Db): Promise<{ discarded: number }> {
  const emailHelpers = await import("../email.js");
  const entries = await emailHelpers.getDraftsWithRecipients(["pending", "approved"], "prospect");

  let discarded = 0;
  for (const entry of entries) {
    const p = entry.prospect;
    if (!p) continue;

    const notes = (p.notes ?? "").toLowerCase();
    const junk =
      p.status === "not_interested" ||
      notes.includes("auto-dismissed") ||
      notes.includes("auto-skipped") ||
      notes.includes("no replacement");

    let suppressed = false;
    if (p.contactEmail) {
      suppressed = await isSuppressed(db, p.contactEmail);
    }

    const noEmail = !p.contactEmail?.trim();

    if (junk || suppressed || noEmail) {
      await emailHelpers.updateDraft(entry.draft.id, { status: "discarded" });
      discarded++;
    }
  }

  if (discarded > 0) {
    console.log(`[Relay] discarded ${discarded} stale draft(s)`);
  }
  return { discarded };
}

/** Send one inbound reply draft immediately after creation (scheduling intents). */
export async function tryAutoSendInboundDraft(
  db: Db,
  draftId: number,
  ctx: {
    prospectId: number;
    convState: string;
    intent: IntentCategory;
    confidence: Confidence;
    calendarEventBooked: boolean;
  },
): Promise<{ sent: boolean; reason: AutoSendReason }> {
  if (outreachDisabled()) {
    return { sent: false, reason: "blocked_outreach_disabled" };
  }

  const schedulingOk =
    SCHEDULING_INTENTS.has(ctx.intent) &&
    (ctx.confidence === "high" || ctx.confidence === "medium") &&
    (ctx.calendarEventBooked || ctx.intent === "ASKING_AVAILABILITY" || ctx.intent === "AVAILABILITY_GIVEN");

  if (!schedulingOk) {
    return { sent: false, reason: "blocked_pending_review" };
  }

  const emailHelpers = await import("../email.js");
  const entries = await emailHelpers.getDraftsWithRecipients(["pending"], "prospect");
  const entry = entries.find((e) => e.draft.id === draftId);
  if (!entry?.prospect) {
    return { sent: false, reason: "blocked_pending_review" };
  }

  const { paused: introsPaused } = await shouldPauseNewIntros(db);
  const suppressed = entry.prospect.contactEmail
    ? await isSuppressed(db, entry.prospect.contactEmail)
    : false;

  const decision = evaluateAutoSendPolicy({
    convState: ctx.convState,
    emailConfidence: entry.prospect.emailConfidence,
    introsPaused,
    intent: ctx.intent,
    draftStatus: "pending",
    isPartnerDraft: false,
    suppressed,
    hasEmail: Boolean(entry.prospect.contactEmail?.trim()),
  });

  if (!decision.allowed) {
    return { sent: false, reason: decision.reason };
  }

  try {
    const sendResult = await emailHelpers.sendUnifiedDraftEntry(entry);
    await emailHelpers.markDraftSent(entry.draft.id, sendResult.messageId);
    await advanceProspectConversationAfterSend(
      ctx.prospectId,
      ctx.convState as "discovery" | "intro_sent" | "followup_1" | "followup_2",
    );
    console.log(`[Relay] auto-sent inbound scheduling draft #${draftId} → ${sendResult.sentTo}`);
    return { sent: true, reason: decision.reason };
  } catch (err) {
    console.warn(`[Relay] inbound auto-send failed for draft #${draftId}:`, String(err));
    return { sent: false, reason: "blocked_pending_review" };
  }
}

/** Sweep pending/approved prospect drafts and send those that pass policy. */
export async function executeRelayAutoSend(db: Db): Promise<RelayAutoSendResult> {
  const result: RelayAutoSendResult = {
    attempted: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    decisions: [],
    errors: [],
  };

  if (outreachDisabled()) {
    result.errors.push("OUTREACH_DISABLED is set — auto-send skipped");
    return result;
  }

  const emailHelpers = await import("../email.js");
  const { paused: introsPaused } = await shouldPauseNewIntros(db);
  const entries = await emailHelpers.getDraftsWithRecipients(["pending", "approved"], "prospect");

  const convRows = await db.select().from(salesAgentConversations);
  const convByProspect = new Map(convRows.map((c) => [c.prospectId, c]));

  for (const entry of entries.slice(0, BATCH)) {
    result.attempted++;
    const p = entry.prospect;
    if (!p) {
      result.skipped++;
      continue;
    }

    const conv = convByProspect.get(p.id);
    const convState = conv?.state ?? "discovery";
    const intent = parseDraftIntent(entry.draft.agentReasoning);
    const suppressed = p.contactEmail ? await isSuppressed(db, p.contactEmail) : false;

    const decision = evaluateAutoSendPolicy({
      convState,
      emailConfidence: p.emailConfidence,
      introsPaused,
      intent,
      draftStatus: entry.draft.status as "pending" | "approved",
      isPartnerDraft: entry.draft.audience !== "prospect",
      suppressed,
      hasEmail: Boolean(p.contactEmail?.trim()),
    });

    result.decisions.push({
      draftId: entry.draft.id,
      company: p.company,
      reason: decision.reason,
    });

    if (!decision.allowed) {
      result.skipped++;
      continue;
    }

    try {
      const sendResult = await emailHelpers.sendUnifiedDraftEntry(entry);
      await emailHelpers.markDraftSent(entry.draft.id, sendResult.messageId);
      await advanceProspectConversationAfterSend(
        p.id,
        convState as "discovery" | "intro_sent" | "followup_1" | "followup_2",
      );
      result.sent++;
    } catch (err) {
      result.failed++;
      result.errors.push(`${p.company}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(
    `[Relay auto-send] attempted=${result.attempted} sent=${result.sent} skipped=${result.skipped} failed=${result.failed}`,
  );
  return result;
}
