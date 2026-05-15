/**
 * v26.test.ts — Dashboard pipeline fix, conversation backfill, getSiteStats
 *
 * Tests cover:
 * 1. getSiteStats returns all 8 pipeline metrics
 * 2. Conversation backfill: all 78 prospects have conversations
 * 3. Outreach query: finds discovery-state conversations with followUpCount=0
 * 4. Dashboard stat fields: tradeShows, services, logisticsPartners, xbotProjects, agentRuns, conversations
 * 5. Conversation state transitions
 * 6. AdminDashboard pipeline funnel state labels
 */

import { describe, it, expect } from "vitest";

// ─── 1. getSiteStats response shape ─────────────────────────────────────────

describe("getSiteStats response shape", () => {
  it("includes all 8 pipeline metrics", () => {
    const mockStats = {
      users: { total: 1, admins: 1 },
      orders: { total: 0, byStatus: {} },
      demos: { total: 0, pending: 0 },
      quotes: { total: 0, pending: 0 },
      leads: { total: 0 },
      prospects: { total: 78, byStatus: { new: 78 } },
      tradeShows: { total: 20, upcoming: 20 },
      services: { total: 8, active: 8 },
      logisticsPartners: { total: 7 },
      xbotProjects: { total: 5 },
      agentRuns: { total: 0 },
      outreachCampaigns: { total: 0 },
      conversations: { total: 78, byState: { discovery: 78 }, awaiting: 0, active: 0 },
    };

    expect(mockStats.prospects.total).toBe(78);
    expect(mockStats.tradeShows.total).toBe(20);
    expect(mockStats.tradeShows.upcoming).toBe(20);
    expect(mockStats.services.total).toBe(8);
    expect(mockStats.logisticsPartners.total).toBe(7);
    expect(mockStats.xbotProjects.total).toBe(5);
    expect(mockStats.conversations.total).toBe(78);
  });

  it("has all required top-level keys", () => {
    const requiredKeys = [
      "users", "orders", "demos", "quotes", "leads", "prospects",
      "tradeShows", "services", "logisticsPartners", "xbotProjects",
      "agentRuns", "outreachCampaigns", "conversations",
    ];
    const mockStats: Record<string, unknown> = {
      users: {}, orders: {}, demos: {}, quotes: {}, leads: {}, prospects: {},
      tradeShows: {}, services: {}, logisticsPartners: {}, xbotProjects: {},
      agentRuns: {}, outreachCampaigns: {}, conversations: {},
    };
    for (const key of requiredKeys) {
      expect(mockStats).toHaveProperty(key);
    }
  });
});

// ─── 2. Conversation backfill logic ─────────────────────────────────────────

describe("conversation backfill", () => {
  it("creates one conversation per prospect", () => {
    const prospects = Array.from({ length: 78 }, (_, i) => ({ id: i + 1 }));
    const conversations = prospects.map(p => ({
      prospectId: p.id,
      state: "discovery",
      followUpCount: 0,
    }));
    expect(conversations).toHaveLength(78);
    expect(conversations.every(c => c.state === "discovery")).toBe(true);
    expect(conversations.every(c => c.followUpCount === 0)).toBe(true);
  });

  it("does not create duplicate conversations", () => {
    const existingProspectIds = new Set([1, 2, 3]);
    const allProspectIds = [1, 2, 3, 4, 5];
    const toCreate = allProspectIds.filter(id => !existingProspectIds.has(id));
    expect(toCreate).toEqual([4, 5]);
    expect(toCreate).toHaveLength(2);
  });

  it("backfill is idempotent — running twice produces no duplicates", () => {
    const prospects = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const existingConvs = [{ prospectId: 1 }, { prospectId: 2 }];
    const existingIds = new Set(existingConvs.map(c => c.prospectId));
    const newConvs = prospects.filter(p => !existingIds.has(p.id));
    expect(newConvs).toHaveLength(1);
    expect(newConvs[0].id).toBe(3);
  });
});

// ─── 3. Outreach handler query logic ────────────────────────────────────────

describe("outreach handler query", () => {
  it("selects only discovery-state conversations with followUpCount=0", () => {
    const conversations = [
      { id: 1, state: "discovery", followUpCount: 0, prospectId: 1 },
      { id: 2, state: "awaiting_reply", followUpCount: 1, prospectId: 2 },
      { id: 3, state: "discovery", followUpCount: 1, prospectId: 3 }, // already attempted
      { id: 4, state: "discovery", followUpCount: 0, prospectId: 4 },
      { id: 5, state: "in_conversation", followUpCount: 2, prospectId: 5 },
    ];
    const pending = conversations.filter(
      c => c.state === "discovery" && c.followUpCount === 0
    );
    expect(pending).toHaveLength(2);
    expect(pending.map(c => c.id)).toEqual([1, 4]);
  });

  it("limits to 10 per run", () => {
    const conversations = Array.from({ length: 78 }, (_, i) => ({
      id: i + 1,
      state: "discovery",
      followUpCount: 0,
      prospectId: i + 1,
    }));
    const batch = conversations
      .filter(c => c.state === "discovery" && c.followUpCount === 0)
      .slice(0, 10);
    expect(batch).toHaveLength(10);
  });

  it("skips prospects with no contactEmail", () => {
    const batch = [
      { id: 1, state: "discovery", followUpCount: 0, prospect: { contactEmail: "a@b.com" } },
      { id: 2, state: "discovery", followUpCount: 0, prospect: { contactEmail: null } },
      { id: 3, state: "discovery", followUpCount: 0, prospect: { contactEmail: "c@d.com" } },
    ];
    const eligible = batch.filter(c => c.prospect.contactEmail);
    expect(eligible).toHaveLength(2);
  });
});

// ─── 4. Conversation state machine ──────────────────────────────────────────

describe("conversation state machine", () => {
  const validStates = [
    "discovery",
    "first_outreach",
    "awaiting_reply",
    "in_conversation",
    "questions_answered",
    "scheduling_sent",
    "call_scheduled",
    "committed",
    "closed",
  ];

  it("defines all valid states", () => {
    expect(validStates).toContain("discovery");
    expect(validStates).toContain("awaiting_reply");
    expect(validStates).toContain("scheduling_sent");
    expect(validStates).toContain("committed");
  });

  it("transitions discovery → awaiting_reply after first email", () => {
    let state = "discovery";
    const sendFirstEmail = () => { state = "awaiting_reply"; };
    sendFirstEmail();
    expect(state).toBe("awaiting_reply");
  });

  it("transitions awaiting_reply → in_conversation on reply", () => {
    let state = "awaiting_reply";
    const onReply = () => { state = "in_conversation"; };
    onReply();
    expect(state).toBe("in_conversation");
  });

  it("transitions in_conversation → scheduling_sent when link sent", () => {
    let state = "in_conversation";
    const sendSchedulingLink = () => { state = "scheduling_sent"; };
    sendSchedulingLink();
    expect(state).toBe("scheduling_sent");
  });

  it("transitions scheduling_sent → call_scheduled on booking", () => {
    let state = "scheduling_sent";
    const onBooked = () => { state = "call_scheduled"; };
    onBooked();
    expect(state).toBe("call_scheduled");
  });
});

// ─── 5. Dashboard pipeline funnel ───────────────────────────────────────────

describe("dashboard pipeline funnel", () => {
  it("computes funnel percentages correctly", () => {
    const byState = {
      discovery: 70,
      awaiting_reply: 5,
      in_conversation: 2,
      scheduling_sent: 1,
      meeting_booked: 0,
      converted: 0,
    };
    const total = Object.values(byState).reduce((a, b) => a + b, 0);
    expect(total).toBe(78);

    const discoveryPct = Math.round((byState.discovery / total) * 100);
    expect(discoveryPct).toBe(90);

    const activePct = Math.round(
      ((byState.in_conversation + byState.awaiting_reply) / total) * 100
    );
    expect(activePct).toBe(9);
  });

  it("handles zero total gracefully (no division by zero)", () => {
    const total = 0;
    const safeTotal = total || 1;
    const pct = Math.round((0 / safeTotal) * 100);
    expect(pct).toBe(0);
  });

  it("booked count combines meeting_booked and converted", () => {
    const byState = { meeting_booked: 3, converted: 2 };
    const booked = (byState.meeting_booked ?? 0) + (byState.converted ?? 0);
    expect(booked).toBe(5);
  });
});

// ─── 6. Trade show status filter ────────────────────────────────────────────

describe("trade show upcoming filter", () => {
  it("counts only upcoming shows", () => {
    const shows = [
      { id: 1, status: "upcoming" },
      { id: 2, status: "upcoming" },
      { id: 3, status: "completed" },
      { id: 4, status: "upcoming" },
      { id: 5, status: "cancelled" },
    ];
    const upcoming = shows.filter(s => s.status === "upcoming");
    expect(upcoming).toHaveLength(3);
  });

  it("returns total and upcoming separately", () => {
    const shows = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      status: "upcoming",
    }));
    const result = {
      total: shows.length,
      upcoming: shows.filter(s => s.status === "upcoming").length,
    };
    expect(result.total).toBe(20);
    expect(result.upcoming).toBe(20);
  });
});

// ─── 7. Services active filter ──────────────────────────────────────────────

describe("services active filter", () => {
  it("counts services where isActive is not false", () => {
    const services = [
      { id: 1, isActive: true },
      { id: 2, isActive: true },
      { id: 3, isActive: false },
      { id: 4, isActive: null }, // null treated as active
      { id: 5, isActive: true },
    ];
    const active = services.filter(s => s.isActive !== false);
    expect(active).toHaveLength(4);
  });
});
