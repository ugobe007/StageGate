/**
 * Relay conversion metrics — north-star funnel for mission prioritization.
 */
import { count, eq, gte, sql } from "drizzle-orm";
import type { getDb } from "../db.js";
import {
  demoRequests,
  quoteRequests,
  users,
  prospects,
  serviceOrders,
} from "../../drizzle/schema.js";
import type { PartnerOutreachSummary } from "../services/partnerOutreach.js";
import type { CalWorkflowSummary } from "./salesAgent.js";
import type { RelayPriority } from "./relayPlaybook.js";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type ConversionSnapshot = {
  usersTotal: number;
  usersLast7d: number;
  demosTotal: number;
  demosPending: number;
  demosLast7d: number;
  quotesTotal: number;
  quotesPending: number;
  quotesLast7d: number;
  ordersTotal: number;
  ordersPaid: number;
  prospectsTotal: number;
  prospectsScheduled: number;
  prospectsConverted: number;
};

export type RelayMission = {
  priority: RelayPriority;
  title: string;
  detail: string;
  metric?: string;
};

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86400000);
}

export async function getConversionSnapshot(db: Db): Promise<ConversionSnapshot> {
  const since7d = daysAgo(7);

  const [
    usersTotalRow,
    users7dRow,
    demosTotalRow,
    demosPendingRow,
    demos7dRow,
    quotesTotalRow,
    quotesPendingRow,
    quotes7dRow,
    ordersTotalRow,
    ordersPaidRow,
    prospectsTotalRow,
    prospectsScheduledRow,
    prospectsConvertedRow,
  ] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(users).where(gte(users.createdAt, since7d)),
    db.select({ n: count() }).from(demoRequests),
    db.select({ n: count() }).from(demoRequests).where(eq(demoRequests.status, "pending")),
    db.select({ n: count() }).from(demoRequests).where(gte(demoRequests.createdAt, since7d)),
    db.select({ n: count() }).from(quoteRequests),
    db.select({ n: count() }).from(quoteRequests).where(eq(quoteRequests.status, "pending")),
    db.select({ n: count() }).from(quoteRequests).where(gte(quoteRequests.createdAt, since7d)),
    db.select({ n: count() }).from(serviceOrders),
    db
      .select({ n: count() })
      .from(serviceOrders)
      .where(sql`${serviceOrders.stripePaymentStatus} IN ('paid', 'complete') OR ${serviceOrders.paidAt} IS NOT NULL`),
    db.select({ n: count() }).from(prospects),
    db.select({ n: count() }).from(prospects).where(eq(prospects.status, "scheduled")),
    db.select({ n: count() }).from(prospects).where(eq(prospects.status, "converted")),
  ]);

  const num = (row: { n: number }[] | undefined) => Number(row?.[0]?.n ?? 0);

  return {
    usersTotal: num(usersTotalRow),
    usersLast7d: num(users7dRow),
    demosTotal: num(demosTotalRow),
    demosPending: num(demosPendingRow),
    demosLast7d: num(demos7dRow),
    quotesTotal: num(quotesTotalRow),
    quotesPending: num(quotesPendingRow),
    quotesLast7d: num(quotes7dRow),
    ordersTotal: num(ordersTotalRow),
    ordersPaid: num(ordersPaidRow),
    prospectsTotal: num(prospectsTotalRow),
    prospectsScheduled: num(prospectsScheduledRow),
    prospectsConverted: num(prospectsConvertedRow),
  };
}

export function prioritizeMissions(input: {
  conversion: ConversionSnapshot;
  workflow: CalWorkflowSummary;
  partnerOutreach?: PartnerOutreachSummary;
  introsPaused: boolean;
  hunterEnabled: boolean;
  cronsMissing: string[];
  pendingDemos: number;
  pendingQuotes: number;
}): RelayMission[] {
  const missions: RelayMission[] = [];

  if (input.cronsMissing.length > 0) {
    missions.push({
      priority: "infrastructure",
      title: "Register missing heartbeat crons",
      detail: `Missing: ${input.cronsMissing.join(", ")}`,
      metric: `${input.cronsMissing.length} jobs`,
    });
  }

  if (!input.hunterEnabled) {
    missions.push({
      priority: "infrastructure",
      title: "Configure Hunter API key",
      detail: "Email enrichment and domain resolution are disabled without HUNTER_API_KEY.",
    });
  }

  if (input.introsPaused) {
    missions.push({
      priority: "deliverability",
      title: "Circuit breaker open — recovery mode",
      detail: "Follow-ups and scheduling replies only; new intros held until bounce rate recovers.",
    });
  }

  const enrichPct =
    input.workflow.needsContactFix + input.workflow.needsWebsite > 0
      ? input.workflow.needsContactFix /
        Math.max(1, input.workflow.needsContactFix + input.workflow.needsWebsite)
      : 0;

  if (input.hunterEnabled && enrichPct > 0.3 && input.workflow.needsContactFix > 10) {
    missions.push({
      priority: "deliverability",
      title: "Enrichment queue backlog",
      detail: `${input.workflow.needsContactFix} prospects need contact fix — Hunter recovery priority.`,
      metric: `${Math.round(enrichPct * 100)}% of prep queue`,
    });
  }

  if (input.pendingDemos > 0 || input.pendingQuotes > 0) {
    missions.push({
      priority: "conversion_blockers",
      title: "Respond to inbound demo/quote requests",
      detail: `${input.pendingDemos} demo(s) and ${input.pendingQuotes} quote(s) awaiting response.`,
      metric: `${input.pendingDemos + input.pendingQuotes} pending`,
    });
  }

  if (input.conversion.demosLast7d === 0 && input.conversion.quotesLast7d === 0) {
    missions.push({
      priority: "conversion_blockers",
      title: "No demo or quote intake this week",
      detail: "Check landing CTAs, pricing page, and top-of-funnel traffic.",
    });
  }

  if (input.workflow.pendingReview > 0 || input.workflow.readyToSend > 0) {
    missions.push({
      priority: "outreach_motion",
      title: "Clear OEM draft send queue",
      detail: `${input.workflow.pendingReview} pending review, ${input.workflow.readyToSend} approved — Relay auto-send will attempt safe sends.`,
      metric: `${input.workflow.pendingReview + input.workflow.readyToSend} OEM drafts`,
    });
  }

  if (input.partnerOutreach && input.partnerOutreach.pendingReview > 0) {
    missions.push({
      priority: "outreach_motion",
      title: "Review partner & vendor drafts",
      detail: `${input.partnerOutreach.pendingReview} Cal partner draft(s) at /admin/partner-outreach — human approve & send.`,
      metric: `${input.partnerOutreach.pendingReview} partner drafts`,
    });
  }

  if (input.partnerOutreach && input.partnerOutreach.needsDraft > 0) {
    missions.push({
      priority: "outreach_motion",
      title: "Partner outreach queue",
      detail: `${input.partnerOutreach.needsDraft} ecosystem partner(s) have email but no draft — Cal drafts on operator runs.`,
      metric: `${input.partnerOutreach.needsDraft} need partner draft`,
    });
  }

  if (input.workflow.needsDraft > 20) {
    missions.push({
      priority: "outreach_motion",
      title: "Generate Cal drafts for send-ready prospects",
      detail: `${input.workflow.needsDraft} enriched prospects have no draft yet.`,
      metric: `${input.workflow.needsDraft} need draft`,
    });
  }

  if (input.workflow.awaitingReply > 0) {
    missions.push({
      priority: "human_loop",
      title: "Monitor active reply threads",
      detail: `${input.workflow.awaitingReply} conversation(s) awaiting reply — scheduling intents auto-send when confident.`,
      metric: `${input.workflow.awaitingReply} threads`,
    });
  }

  if (missions.length === 0) {
    missions.push({
      priority: "growth_experiments",
      title: "Pipeline healthy — test growth experiments",
      detail: "Consider new show targets, partner outreach, or content experiments.",
    });
  }

  return missions.slice(0, 5);
}
