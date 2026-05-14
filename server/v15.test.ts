/**
 * v15 feature tests:
 * 1. prospects.listWithEngagement — computes engagementScore = opens×1 + clicks×2
 * 2. orders.addLineItem — inserts order_items row, admin-only
 * 3. orders.removeLineItem — deletes order_items row, admin-only
 * 4. orders.updateLineItem — updates quantity/unitPrice, admin-only
 * 5. orders.allOrders — returns bookingId field in rows
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
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.returning = terminal;
  // Make the chain itself awaitable
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolveWith).then(resolve);
  return chain;
}

// ─── v15.1 — prospects.listWithEngagement ─────────────────────────────────────

import * as dbModule15 from "./db";

describe("prospects.listWithEngagement", () => {
  const mockGetDb = vi.mocked(dbModule15.getDb);
  const mockListProspects = vi.mocked(dbModule15.listProspects);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns prospects with engagementScore = opens×1 + clicks×2", async () => {
    const mockProspects = [
      { id: 10, company: "RoboticsCo", status: "new", contactEmail: "a@robo.com", shows: [], createdAt: new Date(), updatedAt: new Date() },
      { id: 11, company: "BotWorks", status: "contacted", contactEmail: "b@bot.com", shows: [], createdAt: new Date(), updatedAt: new Date() },
      { id: 12, company: "DroneInc", status: "new", contactEmail: "c@drone.com", shows: [], createdAt: new Date(), updatedAt: new Date() },
    ];
    mockListProspects.mockResolvedValue(mockProspects as any);

    // Engagement rows: prospect 10 has 2 opens + 1 click (score=4), prospect 11 has 0, prospect 12 has 3 opens (score=3)
    const mockEngagementRows = [
      { prospectId: 10, opens: 2, clicks: 1 },
      { prospectId: 12, opens: 3, clicks: 0 },
    ];

    // Mock getDb to return a Drizzle-like connection
    const selectChain = makeChain(mockEngagementRows);
    const mockDbConn = {
      select: vi.fn().mockReturnValue(selectChain),
    };
    mockGetDb.mockResolvedValue(mockDbConn as any);

    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.prospects.listWithEngagement({});

    expect(result.prospects).toHaveLength(3);

    // Prospect 10: 2 opens × 1 + 1 click × 2 = 4
    const p10 = result.prospects.find((p: any) => p.id === 10);
    expect(p10).toBeDefined();
    expect((p10 as any).engagementScore).toBe(4);
    expect((p10 as any).opens).toBe(2);
    expect((p10 as any).clicks).toBe(1);

    // Prospect 11: no engagement rows → score = 0
    const p11 = result.prospects.find((p: any) => p.id === 11);
    expect((p11 as any).engagementScore).toBe(0);

    // Prospect 12: 3 opens × 1 + 0 clicks × 2 = 3
    const p12 = result.prospects.find((p: any) => p.id === 12);
    expect((p12 as any).engagementScore).toBe(3);
  });

  it("returns empty array when no prospects exist", async () => {
    mockListProspects.mockResolvedValue([]);
    const mockDbConn = { select: vi.fn() };
    mockGetDb.mockResolvedValue(mockDbConn as any);

    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.prospects.listWithEngagement({});
    expect(result.prospects).toHaveLength(0);
    // getDb.select should NOT be called when prospects list is empty
    expect(mockDbConn.select).not.toHaveBeenCalled();
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    await expect(caller.prospects.listWithEngagement({})).rejects.toThrow();
  });
});

// ─── v15.2 — orders.addLineItem ───────────────────────────────────────────────

describe("orders.addLineItem", () => {
  const mockCreateOrderItem = vi.mocked(dbModule15.createOrderItem);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an order item and returns its id", async () => {
    mockCreateOrderItem.mockResolvedValue(42 as any);

    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.orders.addLineItem({
      orderId: 5,
      serviceId: 3,
      quantity: 2,
      unitPrice: "150.00",
    });

    expect(result.id).toBe(42);
    expect(mockCreateOrderItem).toHaveBeenCalledWith({
      orderId: 5,
      serviceId: 3,
      quantity: 2,
      unitPrice: "150.00",
    });
  });

  it("uses default quantity of 1 when not specified", async () => {
    mockCreateOrderItem.mockResolvedValue(43 as any);

    const caller = appRouter.createCaller(createAdminCtx());
    await caller.orders.addLineItem({ orderId: 5, serviceId: 3 });

    expect(mockCreateOrderItem).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 1 })
    );
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    await expect(
      caller.orders.addLineItem({ orderId: 5, serviceId: 3 })
    ).rejects.toThrow();
  });
});

// ─── v15.3 — orders.removeLineItem ───────────────────────────────────────────

describe("orders.removeLineItem", () => {
  const mockGetDb = vi.mocked(dbModule15.getDb);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes the order item and returns success", async () => {
    const deleteChain = makeChain([]);
    const mockDbConn = {
      delete: vi.fn().mockReturnValue(deleteChain),
    };
    mockGetDb.mockResolvedValue(mockDbConn as any);

    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.orders.removeLineItem({ itemId: 7, orderId: 5 });

    expect(result.success).toBe(true);
    expect(mockDbConn.delete).toHaveBeenCalled();
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    await expect(
      caller.orders.removeLineItem({ itemId: 7, orderId: 5 })
    ).rejects.toThrow();
  });
});

// ─── v15.4 — orders.updateLineItem ───────────────────────────────────────────

describe("orders.updateLineItem", () => {
  const mockGetDb = vi.mocked(dbModule15.getDb);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates quantity and unitPrice, returns success", async () => {
    const updateChain = makeChain([]);
    const mockDbConn = {
      update: vi.fn().mockReturnValue(updateChain),
    };
    mockGetDb.mockResolvedValue(mockDbConn as any);

    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.orders.updateLineItem({
      itemId: 7,
      quantity: 3,
      unitPrice: "200.00",
    });

    expect(result.success).toBe(true);
    expect(mockDbConn.update).toHaveBeenCalled();
  });

  it("does nothing when no fields provided (no-op)", async () => {
    const updateChain = makeChain([]);
    const mockDbConn = {
      update: vi.fn().mockReturnValue(updateChain),
    };
    mockGetDb.mockResolvedValue(mockDbConn as any);

    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.orders.updateLineItem({ itemId: 7 });

    expect(result.success).toBe(true);
    // update should NOT be called when no fields are provided
    expect(mockDbConn.update).not.toHaveBeenCalled();
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    await expect(
      caller.orders.updateLineItem({ itemId: 7, quantity: 2 })
    ).rejects.toThrow();
  });
});

// ─── v15.5 — orders.allOrders returns bookingId ───────────────────────────────

describe("orders.allOrders — bookingId field", () => {
  const mockGetAllOrders = vi.mocked(dbModule15.getAllOrders);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns bookingId in order rows (null for manual orders)", async () => {
    const mockOrders = [
      { id: 1, userId: 2, showId: 3, status: "pending", totalAmount: "500.00", notes: null, bookingId: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 2, userId: 2, showId: 3, status: "confirmed", totalAmount: "750.00", notes: null, bookingId: 42, createdAt: new Date(), updatedAt: new Date() },
    ];
    mockGetAllOrders.mockResolvedValue(mockOrders as any);

    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.orders.allOrders();

    expect(result).toHaveLength(2);
    // Manual order: no bookingId
    expect(result[0].bookingId).toBeNull();
    // Converted order: has bookingId
    expect(result[1].bookingId).toBe(42);
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    await expect(caller.orders.allOrders()).rejects.toThrow();
  });
});
