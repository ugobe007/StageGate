/**
 * v13 feature tests:
 * 1. bookings.getNewCount — returns count of 'new' bookings
 * 2. bookings.convertToOrder — creates order, marks booking converted, notifies owner
 * 3. Resend webhook handler — signature validation, activity logging
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { TRPCError } from "@trpc/server";
import * as dbModule from "./db";
import * as notificationModule from "./_core/notification";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();

// Build a mock DB that supports the Drizzle chaining pattern
function makeMockDb(overrides: Record<string, unknown> = {}) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 99, status: "pending" }]),
    ...overrides,
  };
  return {
    select: vi.fn().mockReturnValue(chain),
    insert: vi.fn().mockReturnValue(chain),
    update: vi.fn().mockReturnValue(chain),
    _chain: chain,
  };
}

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
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "mock response" } }],
  }),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
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

function createPublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── bookings.getNewCount ─────────────────────────────────────────────────────

describe("bookings.getNewCount", () => {
  const getDb = vi.mocked(dbModule.getDb);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns count of new bookings for admin", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ cnt: 5 }]),
    };
    getDb.mockResolvedValue({
      select: vi.fn().mockReturnValue(chain),
    });

    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.bookings.getNewCount();
    expect(result).toEqual({ count: 5 });
  });

  it("returns count 0 when DB is unavailable", async () => {
    getDb.mockResolvedValue(null);

    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.bookings.getNewCount();
    expect(result).toEqual({ count: 0 });
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    await expect(caller.bookings.getNewCount()).rejects.toThrow();
  });

  it("rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.bookings.getNewCount()).rejects.toThrow();
  });
});

// ─── bookings.convertToOrder ──────────────────────────────────────────────────

describe("bookings.convertToOrder", () => {
  const getDb = vi.mocked(dbModule.getDb);
  const notifyOwner = vi.mocked(notificationModule.notifyOwner);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a service order and marks booking as converted", async () => {
    const mockBooking = {
      id: 1,
      company: "Acme Robotics",
      contactName: "Jane Doe",
      contactEmail: "jane@acme.com",
      contactPhone: "+1-555-0100",
      robotName: "ARIA-7",
      robotType: "Humanoid",
      showName: "CES 2026",
      boothNumber: "A42",
      services: ["staging", "delivery"],
      status: "confirmed",
    };

    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 99, status: "pending" }]),
    };
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([mockBooking]),
    };

    getDb.mockResolvedValue({
      select: vi.fn().mockReturnValue(selectChain),
      insert: vi.fn().mockReturnValue(insertChain),
      update: vi.fn().mockReturnValue(updateChain),
    });

    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.bookings.convertToOrder({ id: 1 });

    expect(result).toEqual({ success: true, orderId: 99 });
    expect(notifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("converted to Order") })
    );
  });

  it("throws NOT_FOUND when booking does not exist", async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    getDb.mockResolvedValue({
      select: vi.fn().mockReturnValue(selectChain),
    });

    const caller = appRouter.createCaller(createAdminCtx());
    await expect(caller.bookings.convertToOrder({ id: 999 })).rejects.toThrow("Booking not found");
  });

  it("throws BAD_REQUEST when booking is already converted", async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ id: 1, status: "converted", company: "Acme", contactName: "Jane", contactEmail: "jane@acme.com", services: [] }]),
    };
    getDb.mockResolvedValue({
      select: vi.fn().mockReturnValue(selectChain),
    });

    const caller = appRouter.createCaller(createAdminCtx());
    await expect(caller.bookings.convertToOrder({ id: 1 })).rejects.toThrow("already converted");
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    await expect(caller.bookings.convertToOrder({ id: 1 })).rejects.toThrow();
  });

  it("throws INTERNAL_SERVER_ERROR when DB is unavailable", async () => {
    getDb.mockResolvedValue(null);
    const caller = appRouter.createCaller(createAdminCtx());
    await expect(caller.bookings.convertToOrder({ id: 1 })).rejects.toThrow();
  });
});

// ─── Resend webhook handler ───────────────────────────────────────────────────

describe("Resend webhook handler", () => {
  // We test the handler directly, not via HTTP
  let resendWebhookHandler: (req: unknown, res: unknown) => Promise<void>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    // Re-import to get fresh module with mocked deps
    const mod = await import("./webhooks/resend");
    resendWebhookHandler = mod.resendWebhookHandler;
  });

  function makeReqRes(body: unknown, headers: Record<string, string> = {}) {
    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const res = { status: statusMock, json: jsonMock };
    const req = { body, headers };
    return { req, res, jsonMock, statusMock };
  }

  it("returns 401 when signature is invalid (secret set but no headers)", async () => {
    const origSecret = process.env.RESEND_WEBHOOK_SECRET;
    process.env.RESEND_WEBHOOK_SECRET = "whsec_dGVzdHNlY3JldA==";
    try {
      const { req, res, statusMock } = makeReqRes({ type: "email.opened", data: {} });
      await resendWebhookHandler(req as never, res as never);
      expect(statusMock).toHaveBeenCalledWith(401);
    } finally {
      process.env.RESEND_WEBHOOK_SECRET = origSecret;
    }
  });

  it("returns 200 and ignores unknown event types when no secret set", async () => {
    const origSecret = process.env.RESEND_WEBHOOK_SECRET;
    delete process.env.RESEND_WEBHOOK_SECRET;
    try {
      const { req, res, statusMock, jsonMock } = makeReqRes({ type: "email.bounced", data: { email_id: "msg_123", to: [] } });
      const getDb = vi.mocked(dbModule.getDb);
      getDb.mockResolvedValue(null);
      await resendWebhookHandler(req as never, res as never);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ ignored: true }));
    } finally {
      process.env.RESEND_WEBHOOK_SECRET = origSecret;
    }
  });

  it("returns 503 when DB is unavailable for email.opened event", async () => {
    const origSecret = process.env.RESEND_WEBHOOK_SECRET;
    delete process.env.RESEND_WEBHOOK_SECRET;
    try {
      const getDb = vi.mocked(dbModule.getDb);
      getDb.mockResolvedValue(null);
      const { req, res, statusMock } = makeReqRes({
        type: "email.opened",
        data: { email_id: "msg_123", to: ["test@acme.com"] },
      });
      await resendWebhookHandler(req as never, res as never);
      expect(statusMock).toHaveBeenCalledWith(503);
    } finally {
      process.env.RESEND_WEBHOOK_SECRET = origSecret;
    }
  });

  it("logs email.opened event and prospect activity when prospect found", async () => {
    const origSecret = process.env.RESEND_WEBHOOK_SECRET;
    delete process.env.RESEND_WEBHOOK_SECRET;
    try {
      const getDb = vi.mocked(dbModule.getDb);

      const insertChain = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      const prospectSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 42 }]),
      };

      const db = {
        select: vi.fn().mockReturnValue(prospectSelectChain),
        insert: vi.fn().mockReturnValue(insertChain),
      };
      getDb.mockResolvedValue(db as never);

      const { req, res, statusMock, jsonMock } = makeReqRes({
        type: "email.opened",
        data: { email_id: "msg_abc", to: ["jane@acme.com"], created_at: "2026-01-01T00:00:00Z" },
      });
      await resendWebhookHandler(req as never, res as never);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ received: true, eventType: "email.opened" }));
      // insert should have been called twice: once for tracking event, once for activity
      expect(db.insert).toHaveBeenCalledTimes(2);
    } finally {
      process.env.RESEND_WEBHOOK_SECRET = origSecret;
    }
  });

  it("logs email.clicked event with URL when prospect found", async () => {
    const origSecret = process.env.RESEND_WEBHOOK_SECRET;
    delete process.env.RESEND_WEBHOOK_SECRET;
    try {
      const getDb = vi.mocked(dbModule.getDb);

      const insertChain = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      const prospectSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 42 }]),
      };

      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };
      const db = {
        select: vi.fn().mockReturnValue(prospectSelectChain),
        insert: vi.fn().mockReturnValue(insertChain),
        update: vi.fn().mockReturnValue(updateChain),
      };
      getDb.mockResolvedValue(db as never);

      const { req, res, statusMock, jsonMock } = makeReqRes({
        type: "email.clicked",
        data: {
          email_id: "msg_xyz",
          to: ["jane@acme.com"],
          click: { link: "https://onstage.bot/get-started" },
          created_at: "2026-01-01T00:00:00Z",
        },
      });
      await resendWebhookHandler(req as never, res as never);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ received: true, eventType: "email.clicked" }));
      // v36: 3 inserts — tracking event + email.clicked activity + followup_accelerated activity
      // (nextFollowUpAt is null on the conv row, so shortening fires)
      expect(db.insert).toHaveBeenCalledTimes(3);
    } finally {
      process.env.RESEND_WEBHOOK_SECRET = origSecret;
    }
  });
});
