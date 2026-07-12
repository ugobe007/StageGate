/**
 * v36 Test Suite
 * Covers: link_clicked follow-up shortening logic in the Resend webhook handler.
 * - nextFollowUpAt is set to ~1 day from now when a link is clicked (and current is far away)
 * - A followup_accelerated activity entry is logged
 * - No shortening when nextFollowUpAt is already within 1 day
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ─── Static content checks ────────────────────────────────────────────────────
const RESEND_WEBHOOK = path.resolve(__dirname, "webhooks/resend.ts");
const resendWebhookContent = fs.readFileSync(RESEND_WEBHOOK, "utf-8");

describe("v36: link_clicked follow-up shortening — static analysis", () => {
  it("webhook reads nextFollowUpAt from the conversation row", () => {
    expect(resendWebhookContent).toContain("nextFollowUpAt: salesAgentConversations.nextFollowUpAt");
  });

  it("webhook computes oneDayFromNow", () => {
    expect(resendWebhookContent).toContain("oneDayFromNow");
    expect(resendWebhookContent).toContain("24 * 60 * 60 * 1000");
  });

  it("webhook sets nextFollowUpAt to oneDayFromNow when shouldShorten is true", () => {
    expect(resendWebhookContent).toContain("shouldShorten");
    expect(resendWebhookContent).toContain("nextFollowUpAt: oneDayFromNow");
  });

  it("webhook only shortens when current nextFollowUpAt is more than 1 day away", () => {
    const idx = resendWebhookContent.indexOf("shouldShorten");
    const snippet = resendWebhookContent.slice(idx, idx + 200);
    expect(snippet).toContain("currentNext > oneDayFromNow");
  });

  it("webhook logs a followup_accelerated activity entry", () => {
    expect(resendWebhookContent).toContain("followup_accelerated");
    expect(resendWebhookContent).toContain("Follow-up accelerated");
    expect(resendWebhookContent).toContain("Link click detected");
  });

  it("activity entry includes nextFollowUpAt in metadata", () => {
    const idx = resendWebhookContent.indexOf("followup_accelerated");
    const snippet = resendWebhookContent.slice(idx, idx + 400);
    expect(snippet).toContain("nextFollowUpAt");
  });
});

// ─── Dynamic / integration-style tests ───────────────────────────────────────
// Mock the DB module at the top level (hoisted by Vitest).
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

import * as dbModule36 from "./db";

// Awaitable Drizzle chain builder (matches v14 pattern)
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

describe("v36: link_clicked follow-up shortening — runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.RESEND_WEBHOOK_SECRET;
  });

  it("sets nextFollowUpAt ≈ now+1d when current nextFollowUpAt is far in the future", async () => {
    const { resendWebhookHandler } = await import("./webhooks/resend");
    const mockGetDb = vi.mocked(dbModule36.getDb);

    const fiveDaysFromNow = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

    let selectCallCount = 0;
    const selectFn = vi.fn().mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) return makeChain([]); // draftEmails: no match by messageId
      if (selectCallCount === 2) return makeChain([]); // emailThreads: no match by messageId
      if (selectCallCount === 3) return makeChain([{ id: 99 }]); // prospects: found by email
      if (selectCallCount === 4) return makeChain([{ id: 7, state: "intro_sent", nextFollowUpAt: fiveDaysFromNow }]); // conv
      return makeChain([]);
    });

    const updateChain = makeChain(undefined);
    const insertChain = makeChain([{ id: 1 }]);

    mockGetDb.mockResolvedValue({
      select: selectFn,
      insert: vi.fn().mockReturnValue(insertChain),
      update: vi.fn().mockReturnValue(updateChain),
    } as never);

    const { req, res, statusMock } = makeReqRes({
      type: "email.clicked",
      data: {
        email_id: "msg_abc",
        to: ["ceo@robotco.com"],
        click: { link: "https://onstage.bot/services" },
        created_at: new Date().toISOString(),
      },
    });

    await resendWebhookHandler(req as never, res as never);

    expect(statusMock).toHaveBeenCalledWith(200);

    // The update chain's .set() should have been called with nextFollowUpAt
    const setFn = updateChain.set as ReturnType<typeof vi.fn>;
    expect(setFn).toHaveBeenCalled();
    const setArg = setFn.mock.calls[0][0] as Record<string, unknown>;
    expect(setArg).toHaveProperty("state", "link_clicked");
    expect(setArg).toHaveProperty("nextFollowUpAt");

    // nextFollowUpAt should be within a few seconds of now+1d
    const expectedNext = Date.now() + 24 * 60 * 60 * 1000;
    const actualNext = (setArg.nextFollowUpAt as Date).getTime();
    expect(Math.abs(actualNext - expectedNext)).toBeLessThan(5000);
  });

  it("does NOT set nextFollowUpAt when current nextFollowUpAt is already within 1 day", async () => {
    const { resendWebhookHandler } = await import("./webhooks/resend");
    const mockGetDb = vi.mocked(dbModule36.getDb);

    const sixHoursFromNow = new Date(Date.now() + 6 * 60 * 60 * 1000);

    let selectCallCount = 0;
    const selectFn = vi.fn().mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) return makeChain([]);
      if (selectCallCount === 2) return makeChain([]);
      if (selectCallCount === 3) return makeChain([{ id: 100 }]);
      if (selectCallCount === 4) return makeChain([{ id: 8, state: "followup_1", nextFollowUpAt: sixHoursFromNow }]);
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

    const { req, res, statusMock } = makeReqRes({
      type: "email.clicked",
      data: {
        email_id: "msg_def",
        to: ["ops@acme.com"],
        click: { link: "https://onstage.bot/book" },
        created_at: new Date().toISOString(),
      },
    });

    await resendWebhookHandler(req as never, res as never);
    expect(statusMock).toHaveBeenCalledWith(200);

    // update should have been called but WITHOUT nextFollowUpAt
    const setFn = updateChain.set as ReturnType<typeof vi.fn>;
    expect(setFn).toHaveBeenCalled();
    const setArg = setFn.mock.calls[0][0] as Record<string, unknown>;
    expect(setArg).toHaveProperty("state", "link_clicked");
    expect(setArg).not.toHaveProperty("nextFollowUpAt");

    // No followup_accelerated activity — only 2 inserts (tracking event + email_clicked activity)
    expect(insertFn).toHaveBeenCalledTimes(2);
  });

  it("sets nextFollowUpAt when conv has no nextFollowUpAt set (null)", async () => {
    const { resendWebhookHandler } = await import("./webhooks/resend");
    const mockGetDb = vi.mocked(dbModule36.getDb);

    let selectCallCount = 0;
    const selectFn = vi.fn().mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) return makeChain([]);
      if (selectCallCount === 2) return makeChain([]);
      if (selectCallCount === 3) return makeChain([{ id: 101 }]);
      if (selectCallCount === 4) return makeChain([{ id: 9, state: "intro_sent", nextFollowUpAt: null }]);
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

    const { req, res, statusMock } = makeReqRes({
      type: "email.clicked",
      data: {
        email_id: "msg_ghi",
        to: ["cto@startup.io"],
        click: { link: "https://onstage.bot/pricing" },
        created_at: new Date().toISOString(),
      },
    });

    await resendWebhookHandler(req as never, res as never);
    expect(statusMock).toHaveBeenCalledWith(200);

    const setFn = updateChain.set as ReturnType<typeof vi.fn>;
    expect(setFn).toHaveBeenCalled();
    const setArg = setFn.mock.calls[0][0] as Record<string, unknown>;
    expect(setArg).toHaveProperty("nextFollowUpAt");

    // 3 inserts: tracking event + email_clicked activity + followup_accelerated activity
    expect(insertFn).toHaveBeenCalledTimes(3);
  });
});
