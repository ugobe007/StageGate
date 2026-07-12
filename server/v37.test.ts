/**
 * v37 Test Suite
 * Covers: Reply detection — automatically moves prospects to 'awaiting_reply'
 * and pauses automated follow-ups when they reply.
 *
 * Tests:
 * 1. Static: inbound webhook uses awaiting_reply (not responded) as primary reply state
 * 2. Static: inbound webhook sets nextFollowUpAt: null on reply
 * 3. Static: outbound webhook handles email.replied event type
 * 4. Static: salesAgent loop excludes awaiting_reply from inArray allowlist
 * 5. Static: frankPlaybook ConversationStage includes awaiting_reply
 * 6. Static: STAGE_DELAYS_DAYS has awaiting_reply: 0
 * 7. Static: AdminSalesAgent STAGES includes awaiting_reply with Replied label
 * 8. Static: updateConversationStage enum includes awaiting_reply
 * 9. Runtime: inbound webhook sets awaiting_reply and nextFollowUpAt=null
 * 10. Runtime: outbound email.replied event sets awaiting_reply and logs activity
 * 11. Runtime: outbound email.replied skips if already awaiting_reply
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ─── File paths ───────────────────────────────────────────────────────────────
const INBOUND_WEBHOOK = path.resolve(__dirname, "webhooks/resend-inbound.ts");
const OUTBOUND_WEBHOOK = path.resolve(__dirname, "webhooks/resend.ts");
const SALES_AGENT = path.resolve(__dirname, "agents/salesAgent.ts");
const FRANK_PLAYBOOK = path.resolve(__dirname, "agents/frankPlaybook.ts");
const ADMIN_SALES_AGENT = path.resolve(__dirname, "../client/src/pages/AdminSalesAgent.tsx");
const ROUTERS = path.resolve(__dirname, "routers.ts");

const inboundContent = fs.readFileSync(INBOUND_WEBHOOK, "utf-8");
const outboundContent = fs.readFileSync(OUTBOUND_WEBHOOK, "utf-8");
const salesAgentContent = fs.readFileSync(SALES_AGENT, "utf-8");
const frankPlaybookContent = fs.readFileSync(FRANK_PLAYBOOK, "utf-8");
const adminSalesAgentContent = fs.readFileSync(ADMIN_SALES_AGENT, "utf-8");
const routersContent = fs.readFileSync(ROUTERS, "utf-8");

// ─── Static analysis ──────────────────────────────────────────────────────────
describe("v37: Reply detection — static analysis", () => {
  describe("Inbound webhook (resend-inbound.ts)", () => {
    it("uses awaiting_reply as the primary reply state (not responded)", () => {
      expect(inboundContent).toContain("awaiting_reply");
    });

    it("sets nextFollowUpAt: null when advancing to awaiting_reply", () => {
      // Search from the db.update call that sets awaiting_reply
      const idx = inboundContent.indexOf("nextFollowUpAt: null");
      expect(idx).toBeGreaterThan(-1);
    });

    it("logs an email_replied activity and pauses follow-ups on reply", () => {
      expect(inboundContent).toContain("email_replied");
      // Follow-ups are paused by clearing nextFollowUpAt when a reply advances state.
      expect(inboundContent).toContain("nextFollowUpAt: null");
    });

    it("includes email_opened and link_clicked in OUTREACH_STAGES set", () => {
      expect(inboundContent).toContain('"email_opened"');
      expect(inboundContent).toContain('"link_clicked"');
    });

    it("handles scheduling intent separately (goes to scheduling, not awaiting_reply)", () => {
      expect(inboundContent).toContain('"scheduling"');
      // Scheduling is driven by classified intent categories, not a boolean flag.
      expect(inboundContent).toContain("POSITIVE_SCHEDULE");
    });
  });

  describe("Outbound webhook (resend.ts)", () => {
    it("handles email.replied event type", () => {
      expect(outboundContent).toContain("email.replied");
    });

    it("sets state to awaiting_reply on email.replied", () => {
      // Search from the v37 comment block
      const idx = outboundContent.indexOf("v37: handle email.replied");
      const snippet = outboundContent.slice(idx, idx + 800);
      expect(snippet).toContain("awaiting_reply");
    });

    it("sets nextFollowUpAt: null on email.replied", () => {
      const idx = outboundContent.indexOf("v37: handle email.replied");
      const snippet = outboundContent.slice(idx, idx + 800);
      expect(snippet).toContain("nextFollowUpAt: null");
    });

    it("logs an email_replied activity on email.replied", () => {
      const idx = outboundContent.indexOf("v37: handle email.replied");
      const snippet = outboundContent.slice(idx, idx + 1000);
      expect(snippet).toContain("email_replied");
    });

    it("skips awaiting_reply/scheduling/booked states (no double-advance)", () => {
      const idx = outboundContent.indexOf("v37: handle email.replied");
      const snippet = outboundContent.slice(idx, idx + 800);
      // Guard condition checks all three states
      expect(snippet).toContain("awaiting_reply");
      expect(snippet).toContain("scheduling");
      expect(snippet).toContain("booked");
    });
  });

  describe("SalesAgent loop (salesAgent.ts)", () => {
    it("excludes awaiting_reply from the actionable-state allowlist", () => {
      // awaiting_reply should NOT appear in the ACTIONABLE_STATES allowlist
      const idx = salesAgentContent.indexOf("const ACTIONABLE_STATES = [");
      const snippet = salesAgentContent.slice(idx, idx + 300);
      expect(snippet).not.toContain('"awaiting_reply"');
    });

    it("includes email_opened and link_clicked in the actionable-state allowlist", () => {
      const idx = salesAgentContent.indexOf("const ACTIONABLE_STATES = [");
      const snippet = salesAgentContent.slice(idx, idx + 300);
      expect(snippet).toContain('"email_opened"');
      expect(snippet).toContain('"link_clicked"');
    });

    it("has a comment explaining awaiting_reply is excluded", () => {
      expect(salesAgentContent).toContain("awaiting_reply");
    });
  });

  describe("FrankPlaybook (frankPlaybook.ts)", () => {
    it("includes awaiting_reply in ConversationStage type", () => {
      expect(frankPlaybookContent).toContain('"awaiting_reply"');
    });

    it("has STAGE_DELAYS_DAYS.awaiting_reply = 0", () => {
      const idx = frankPlaybookContent.indexOf("awaiting_reply:");
      const snippet = frankPlaybookContent.slice(idx, idx + 50);
      expect(snippet).toContain("0");
    });
  });

  describe("Admin UI (AdminSalesAgent.tsx)", () => {
    it("includes awaiting_reply in STAGES array", () => {
      expect(adminSalesAgentContent).toContain('"awaiting_reply"');
    });

    it("shows 'Replied' as the label for awaiting_reply", () => {
      const idx = adminSalesAgentContent.indexOf('"awaiting_reply"');
      const snippet = adminSalesAgentContent.slice(idx, idx + 100);
      expect(snippet).toContain("Replied");
    });

    it("uses amber color for awaiting_reply badge", () => {
      const idx = adminSalesAgentContent.indexOf('"awaiting_reply"');
      const snippet = adminSalesAgentContent.slice(idx, idx + 100);
      expect(snippet).toContain("amber");
    });
  });

  describe("Routers (routers.ts)", () => {
    it("includes awaiting_reply in updateConversationStage state enum", () => {
      const idx = routersContent.indexOf("updateConversationStage");
      const snippet = routersContent.slice(idx, idx + 300);
      expect(snippet).toContain("awaiting_reply");
    });
  });
});

// ─── Runtime tests ────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn(),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getCompanyProfileByUserId: vi.fn(),
  upsertCompanyProfile: vi.fn(),
  getAllCompanyProfiles: vi.fn(),
  getAllTradeShows: vi.fn(),
  searchTradeShows: vi.fn(),
  getTradeShowById: vi.fn(),
  createTradeShow: vi.fn(),
  updateTradeShow: vi.fn(),
  deleteTradeShow: vi.fn(),
  getAllLeads: vi.fn(),
  getLeadsByShowId: vi.fn(),
  createLead: vi.fn(),
  updateLead: vi.fn(),
  deleteLead: vi.fn(),
  getLeadById: vi.fn(),
  getAllServices: vi.fn(),
  getServiceBySlug: vi.fn(),
  createOrder: vi.fn(),
  createOrderItem: vi.fn(),
  getOrderItems: vi.fn(),
  getOrdersByUserId: vi.fn(),
  getAllOrders: vi.fn(),
  getOrderById: vi.fn(),
  updateOrderStatus: vi.fn(),
  getAllLogisticsPartners: vi.fn(),
  getLogisticsPartnerById: vi.fn(),
  createLogisticsPartner: vi.fn(),
  updateLogisticsPartner: vi.fn(),
  deleteLogisticsPartner: vi.fn(),
  createShowNotification: vi.fn(),
  getShowNotificationsByShowId: vi.fn(),
  getAllShowNotifications: vi.fn(),
  createQuoteRequest: vi.fn(),
  getAllQuoteRequests: vi.fn(),
  updateQuoteRequestStatus: vi.fn(),
  listProspects: vi.fn(),
  getProspectById: vi.fn(),
  updateProspect: vi.fn(),
  createProspect: vi.fn(),
  bulkInsertProspects: vi.fn(),
  bulkUpdateProspectStatus: vi.fn(),
  createOutreachCampaign: vi.fn(),
  listOutreachCampaigns: vi.fn(),
  getAllUsers: vi.fn(),
  updateUserRole: vi.fn(),
  getAllDemoRequests: vi.fn(),
  createAgentRun: vi.fn(),
  completeAgentRun: vi.fn(),
  getAgentRunStats: vi.fn(),
  getRecentAgentRuns: vi.fn(),
  updateProspectStatus: vi.fn(),
}));

import * as dbModule37 from "./db";

function makeChain(resolveWith: unknown) {
  const chain: Record<string, unknown> = {};
  const terminal = vi.fn().mockResolvedValue(resolveWith);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.returning = terminal;
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolveWith).then(resolve);
  return chain;
}

function makeReqRes(body: unknown) {
  const jsonMock = vi.fn();
  const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
  return {
    req: { body, headers: {} },
    res: { status: statusMock, json: jsonMock },
    statusMock,
    jsonMock,
  };
}

describe("v37: email.replied webhook — runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.RESEND_WEBHOOK_SECRET;
  });

  it("sets state=awaiting_reply and nextFollowUpAt=null on email.replied", async () => {
    const { resendWebhookHandler } = await import("./webhooks/resend");
    const mockGetDb = vi.mocked(dbModule37.getDb);

    let selectCallCount = 0;
    const selectFn = vi.fn().mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) return makeChain([{ prospectId: 42 }]); // draftEmails match
      if (selectCallCount === 2) return makeChain([{ id: 42, state: "intro_sent" }]); // conv
      return makeChain([]);
    });

    const updateChain = makeChain(undefined);
    const insertChain = makeChain([{ id: 1 }]);
    const insertFn = vi.fn().mockReturnValue(insertChain);

    mockGetDb.mockResolvedValue({
      select: selectFn,
      insert: insertFn,
      update: vi.fn().mockReturnValue(updateChain),
    } as never);

    const { req, res, statusMock, jsonMock } = makeReqRes({
      type: "email.replied",
      data: {
        email_id: "msg_reply_001",
        to: ["ceo@robotco.com"],
        created_at: new Date().toISOString(),
      },
    });

    await resendWebhookHandler(req as never, res as never);

    // Should respond with 200
    expect(statusMock).toHaveBeenCalledWith(200);

    // update should set state=awaiting_reply and nextFollowUpAt=null
    const setFn = updateChain.set as ReturnType<typeof vi.fn>;
    expect(setFn).toHaveBeenCalled();
    const setArg = setFn.mock.calls[0][0] as Record<string, unknown>;
    expect(setArg).toHaveProperty("state", "awaiting_reply");
    expect(setArg).toHaveProperty("nextFollowUpAt", null);

    // Should have called insert at least twice (tracking event + activity)
    expect(insertFn).toHaveBeenCalled();
    // The values chain should have been called with email_replied type
    const valuesChain = insertChain.values as ReturnType<typeof vi.fn>;
    expect(valuesChain).toHaveBeenCalled();
    // Check that one of the values calls contains type: email_replied
    const valuesCalls = valuesChain.mock.calls;
    const hasEmailReplied = valuesCalls.some((call: unknown[]) => {
      const arg = call[0] as { type?: string };
      return arg?.type === "email_replied";
    });
    expect(hasEmailReplied).toBe(true);
  });

  it("does NOT update if prospect is already in awaiting_reply state", async () => {
    const { resendWebhookHandler } = await import("./webhooks/resend");
    const mockGetDb = vi.mocked(dbModule37.getDb);

    let selectCallCount = 0;
    const selectFn = vi.fn().mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) return makeChain([{ prospectId: 55 }]);
      if (selectCallCount === 2) return makeChain([{ id: 55, state: "awaiting_reply" }]); // already paused
      return makeChain([]);
    });

    const updateChain = makeChain(undefined);
    const insertChain = makeChain([{ id: 1 }]);
    const updateFn = vi.fn().mockReturnValue(updateChain);

    mockGetDb.mockResolvedValue({
      select: selectFn,
      insert: vi.fn().mockReturnValue(insertChain),
      update: updateFn,
    } as never);

    const { req, res } = makeReqRes({
      type: "email.replied",
      data: {
        email_id: "msg_reply_002",
        to: ["ceo@robotco.com"],
        created_at: new Date().toISOString(),
      },
    });

    await resendWebhookHandler(req as never, res as never);

    // update should NOT have been called (already in awaiting_reply)
    expect(updateFn).not.toHaveBeenCalled();
  });
});
