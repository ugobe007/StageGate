/**
 * v16 feature tests:
 * Hot filter logic — prospects.listWithEngagement returns engagementScore
 * that the client uses to filter "hot" prospects (score >= 3).
 *
 * The filter itself is client-side, but the underlying score computation
 * is server-side. These tests verify the score values that drive the filter.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mocks ────────────────────────────────────────────────────────────────────

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
  getAllServices: vi.fn().mockResolvedValue([]),
  getServiceBySlug: vi.fn(),
  createOrder: vi.fn(),
  createOrderItem: vi.fn(),
  getOrderItems: vi.fn().mockResolvedValue([]),
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

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "mock response" } }],
  }),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

vi.mock("./research-agent", () => ({
  researchProspect: vi.fn().mockResolvedValue({}),
}));

// ─── Context helpers ──────────────────────────────────────────────────────────

function createAdminCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-openid",
      name: "Admin User",
      email: "admin@stagegate.com",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUserCtx(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "user-openid",
      name: "Regular User",
      email: "user@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Drizzle chain builder ────────────────────────────────────────────────────

function makeChain(resolveWith: unknown) {
  const chain: Record<string, unknown> = {};
  const terminal = vi.fn().mockResolvedValue(resolveWith);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.groupBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.returning = terminal;
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolveWith).then(resolve);
  return chain;
}

// ─── v16 — Hot filter score threshold ────────────────────────────────────────

import * as dbModule16 from "./db";

describe("Hot filter — engagementScore threshold (score >= 3)", () => {
  const mockGetDb = vi.mocked(dbModule16.getDb);
  const mockListProspects = vi.mocked(dbModule16.listProspects);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("correctly identifies hot prospects (score >= 3) vs cold (score < 3)", async () => {
    const mockProspects = [
      { id: 1, company: "HotCo",    status: "contacted",  contactEmail: "a@hot.com",  shows: [], createdAt: new Date(), updatedAt: new Date() },
      { id: 2, company: "WarmCo",   status: "new",        contactEmail: "b@warm.com", shows: [], createdAt: new Date(), updatedAt: new Date() },
      { id: 3, company: "ColdCo",   status: "new",        contactEmail: "c@cold.com", shows: [], createdAt: new Date(), updatedAt: new Date() },
      { id: 4, company: "ExactCo",  status: "responded",  contactEmail: "d@exact.com",shows: [], createdAt: new Date(), updatedAt: new Date() },
    ];
    mockListProspects.mockResolvedValue(mockProspects as any);

    // Engagement: HotCo = 1 open + 2 clicks = 5 (hot), WarmCo = 2 opens = 2 (cold),
    // ColdCo = 0 (cold), ExactCo = 1 open + 1 click = 3 (exactly hot boundary)
    const mockEngagementRows = [
      { prospectId: 1, opens: 1, clicks: 2 },  // score = 1 + 4 = 5 ✓ hot
      { prospectId: 2, opens: 2, clicks: 0 },  // score = 2 + 0 = 2 ✗ cold
      { prospectId: 4, opens: 1, clicks: 1 },  // score = 1 + 2 = 3 ✓ hot (boundary)
    ];

    const selectChain = makeChain(mockEngagementRows);
    const mockDbConn = { select: vi.fn().mockReturnValue(selectChain) };
    mockGetDb.mockResolvedValue(mockDbConn as any);

    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.prospects.listWithEngagement({});

    const withScores = result.prospects as Array<{ id: number; engagementScore: number }>;

    // Verify scores
    expect(withScores.find(p => p.id === 1)?.engagementScore).toBe(5);  // hot
    expect(withScores.find(p => p.id === 2)?.engagementScore).toBe(2);  // cold
    expect(withScores.find(p => p.id === 3)?.engagementScore).toBe(0);  // cold (no events)
    expect(withScores.find(p => p.id === 4)?.engagementScore).toBe(3);  // hot (boundary)

    // Simulate the client-side hot filter (score >= 3)
    const hotProspects = withScores.filter(p => p.engagementScore >= 3);
    const coldProspects = withScores.filter(p => p.engagementScore < 3);

    expect(hotProspects).toHaveLength(2);
    expect(hotProspects.map(p => p.id).sort()).toEqual([1, 4]);

    expect(coldProspects).toHaveLength(2);
    expect(coldProspects.map(p => p.id).sort()).toEqual([2, 3]);
  });

  it("returns hotCount = 0 when no prospects have score >= 3", async () => {
    const mockProspects = [
      { id: 10, company: "LoScoreCo", status: "new", contactEmail: "x@lo.com", shows: [], createdAt: new Date(), updatedAt: new Date() },
    ];
    mockListProspects.mockResolvedValue(mockProspects as any);

    // Only 1 open → score = 1 (below threshold)
    const mockEngagementRows = [{ prospectId: 10, opens: 1, clicks: 0 }];
    const selectChain = makeChain(mockEngagementRows);
    const mockDbConn = { select: vi.fn().mockReturnValue(selectChain) };
    mockGetDb.mockResolvedValue(mockDbConn as any);

    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.prospects.listWithEngagement({});

    const withScores = result.prospects as Array<{ id: number; engagementScore: number }>;
    const hotProspects = withScores.filter(p => p.engagementScore >= 3);
    expect(hotProspects).toHaveLength(0);
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    await expect(caller.prospects.listWithEngagement({})).rejects.toThrow();
  });
});
