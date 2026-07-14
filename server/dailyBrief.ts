/**
 * Admin daily brief — today's intake, outreach queue, and actionable next steps.
 */
import { getDb } from "./db";
import {
  draftEmails,
  exhibitorLeads,
  prospects,
  salesAgentConversations,
} from "../drizzle/schema";
import { and, count, eq, gte } from "drizzle-orm";
import { getDraftCountByAudience, isPartnerAudienceDraft } from "./email";

export type DailyBriefStep = {
  label: string;
  count: number;
  href: string;
  priority: "high" | "medium" | "low";
};

export type DailyBrief = {
  date: string;
  metrics: {
    newExhibitorLeadsToday: number;
    newProspectsToday: number;
    draftsPending: number;
    draftsApproved: number;
    draftsCreatedToday: number;
    partnerDraftsPending: number;
    emailsSentToday: number;
    emailsSentTotal: number;
    followUpsDue: number;
    awaitingReply: number;
    newExhibitorLeadsOpen: number;
  };
  nextSteps: DailyBriefStep[];
};

const TERMINAL_CONV_STATES = new Set([
  "booked",
  "not_interested",
  "converted",
  "responded",
  "scheduling",
  "awaiting_reply",
]);

function startOfUtcDay(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function pushStep(
  steps: DailyBriefStep[],
  label: string,
  count: number,
  href: string,
  priority: DailyBriefStep["priority"],
) {
  if (count <= 0) return;
  steps.push({ label, count, href, priority });
}

export async function getDailyBrief(): Promise<DailyBrief> {
  const db = await getDb();
  const dayStart = startOfUtcDay();
  const empty: DailyBrief = {
    date: dayStart.toISOString().slice(0, 10),
    metrics: {
      newExhibitorLeadsToday: 0,
      newProspectsToday: 0,
      draftsPending: 0,
      draftsApproved: 0,
      draftsCreatedToday: 0,
      partnerDraftsPending: 0,
      emailsSentToday: 0,
      emailsSentTotal: 0,
      followUpsDue: 0,
      awaitingReply: 0,
      newExhibitorLeadsOpen: 0,
    },
    nextSteps: [],
  };
  if (!db) return empty;

  const now = new Date();

  const [
    newLeadsTodayRow,
    newProspectsTodayRow,
    draftsCreatedTodayRow,
    emailsSentTodayRow,
    openLeadsRow,
    draftCounts,
    partnerDraftCounts,
    convRows,
    allDrafts,
  ] = await Promise.all([
    db
      .select({ n: count() })
      .from(exhibitorLeads)
      .where(gte(exhibitorLeads.createdAt, dayStart)),
    db
      .select({ n: count() })
      .from(prospects)
      .where(gte(prospects.createdAt, dayStart)),
    db
      .select({ n: count() })
      .from(draftEmails)
      .where(gte(draftEmails.createdAt, dayStart)),
    db
      .select({ n: count() })
      .from(draftEmails)
      .where(and(eq(draftEmails.status, "sent"), gte(draftEmails.sentAt, dayStart))),
    db
      .select({ n: count() })
      .from(exhibitorLeads)
      .where(eq(exhibitorLeads.outreachStatus, "new")),
    getDraftCountByAudience("prospect"),
    getDraftCountByAudience("partner"),
    db
      .select({
        state: salesAgentConversations.state,
        nextFollowUpAt: salesAgentConversations.nextFollowUpAt,
      })
      .from(salesAgentConversations),
    db.select().from(draftEmails),
  ]);

  const partnerPending =
    allDrafts.filter(
      (d) =>
        isPartnerAudienceDraft(d) &&
        (d.status === "pending" || d.status === "approved"),
    ).length;

  let followUpsDue = 0;
  let awaitingReply = 0;
  for (const c of convRows) {
    if (c.state === "awaiting_reply") awaitingReply++;
    const state = c.state ?? "";
    if (TERMINAL_CONV_STATES.has(state)) continue;
    const next = c.nextFollowUpAt ? new Date(c.nextFollowUpAt) : null;
    if (next && next <= now) followUpsDue++;
  }

  const metrics = {
    newExhibitorLeadsToday: Number(newLeadsTodayRow[0]?.n ?? 0),
    newProspectsToday: Number(newProspectsTodayRow[0]?.n ?? 0),
    draftsPending: draftCounts.pending,
    draftsApproved: draftCounts.approved,
    draftsCreatedToday: Number(draftsCreatedTodayRow[0]?.n ?? 0),
    partnerDraftsPending: partnerPending,
    emailsSentToday: Number(emailsSentTodayRow[0]?.n ?? 0),
    emailsSentTotal: draftCounts.sent + partnerDraftCounts.sent,
    followUpsDue,
    awaitingReply,
    newExhibitorLeadsOpen: Number(openLeadsRow[0]?.n ?? 0),
  };

  const nextSteps: DailyBriefStep[] = [];
  pushStep(
    nextSteps,
    "Review Cal drafts",
    metrics.draftsPending,
    "/admin/sales-agent?step=review",
    "high",
  );
  pushStep(
    nextSteps,
    "Send approved Cal emails",
    metrics.draftsApproved,
    "/admin/sales-agent?step=send",
    "high",
  );
  pushStep(
    nextSteps,
    "Review partner drafts",
    metrics.partnerDraftsPending,
    "/admin/partner-outreach",
    "high",
  );
  pushStep(
    nextSteps,
    "Follow-ups due now",
    metrics.followUpsDue,
    "/admin/sales-agent?step=followup",
    "high",
  );
  pushStep(
    nextSteps,
    "Awaiting your reply",
    metrics.awaitingReply,
    "/admin/sales-agent?step=followup",
    "medium",
  );
  pushStep(
    nextSteps,
    "New exhibitor leads to contact",
    metrics.newExhibitorLeadsOpen,
    "/admin/leads",
    "medium",
  );
  if (metrics.newProspectsToday > 0) {
    pushStep(
      nextSteps,
      "New prospects discovered today",
      metrics.newProspectsToday,
      "/admin/prospects",
      "medium",
    );
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  nextSteps.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return { date: dayStart.toISOString().slice(0, 10), metrics, nextSteps };
}
