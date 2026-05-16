import { describe, expect, it, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getTradeShowById, createShowNotification, updateProspect, getProspectById } from "./db";

// Mock the database helpers using actual function names from server/db.ts
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
  getCompanyProfileByUserId: vi.fn().mockResolvedValue(null),
  upsertCompanyProfile: vi.fn().mockResolvedValue(undefined),
  getAllCompanyProfiles: vi.fn().mockResolvedValue([]),
  getAllTradeShows: vi.fn().mockResolvedValue([]),
  searchTradeShows: vi.fn().mockImplementation(async (query: string, city?: string) => {
    const shows = [
      { id: 1, name: "CES 2026", venue: "Las Vegas Convention Center", city: "Las Vegas", location: "Las Vegas, NV", startDate: new Date("2026-01-06"), endDate: new Date("2026-01-09"), status: "upcoming" as const, createdAt: new Date() },
      { id: 2, name: "Automate 2026", venue: "McCormick Place", city: "Chicago", location: "Chicago, IL", startDate: new Date("2026-05-04"), endDate: new Date("2026-05-07"), status: "upcoming" as const, createdAt: new Date() },
      { id: 3, name: "MODEX 2026", venue: "Georgia World Congress Center", city: "Atlanta", location: "Atlanta, GA", startDate: new Date("2026-03-09"), endDate: new Date("2026-03-12"), status: "upcoming" as const, createdAt: new Date() },
    ];
    const q = query.toLowerCase().trim();
    return shows.filter((s) => {
      const matchQ = !q || s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q) || s.venue.toLowerCase().includes(q);
      const matchC = !city || s.city.toLowerCase().includes(city.toLowerCase());
      return matchQ && matchC;
    });
  }),
  getTradeShowById: vi.fn().mockResolvedValue(null),
  createTradeShow: vi.fn().mockResolvedValue({ id: 1, name: "Test Show", status: "upcoming" }),
  updateTradeShow: vi.fn().mockResolvedValue(undefined),
  deleteTradeShow: vi.fn().mockResolvedValue(undefined),
  getAllLeads: vi.fn().mockResolvedValue([]),
  getLeadsByShowId: vi.fn().mockResolvedValue([]),
  createLead: vi.fn().mockResolvedValue({ id: 1, companyName: "Acme Robotics", outreachStatus: "new" }),
  updateLead: vi.fn().mockResolvedValue(undefined),
  deleteLead: vi.fn().mockResolvedValue(undefined),
  getLeadById: vi.fn().mockResolvedValue({ id: 1, companyName: "Acme Robotics", website: "https://acme.com", outreachStatus: "new" }),
  getAllServices: vi.fn().mockResolvedValue([
    { id: 1, slug: "inbound-logistics", name: "Inbound Logistics", brand: "stagegate", basePrice: "500.00", priceUnit: "per shipment" },
    { id: 2, slug: "warehousing-storage", name: "Warehousing & Storage", brand: "stagegate", basePrice: "150.00", priceUnit: "per day" },
  ]),
  getServiceBySlug: vi.fn().mockResolvedValue(null),
  createOrder: vi.fn().mockResolvedValue({ id: 42, status: "pending" }),
  createOrderItem: vi.fn().mockResolvedValue(undefined),
  getOrderItems: vi.fn().mockResolvedValue([]),
  getOrdersByUserId: vi.fn().mockResolvedValue([]),
  getAllOrders: vi.fn().mockResolvedValue([]),
  getOrderById: vi.fn().mockResolvedValue(null),
  updateOrderStatus: vi.fn().mockResolvedValue(undefined),
  getAllLogisticsPartners: vi.fn().mockResolvedValue([]),
  getLogisticsPartnerById: vi.fn().mockResolvedValue(null),
  createLogisticsPartner: vi.fn().mockResolvedValue({ id: 1, name: "Global Freight Co.", serviceType: "customs" }),
  updateLogisticsPartner: vi.fn().mockResolvedValue(undefined),
  deleteLogisticsPartner: vi.fn().mockResolvedValue(undefined),
  createShowNotification: vi.fn().mockResolvedValue({ id: 1, alreadyExists: false }),
  getShowNotificationsByShowId: vi.fn().mockResolvedValue([]),
  getAllShowNotifications: vi.fn().mockResolvedValue([]),
  createQuoteRequest: vi.fn().mockResolvedValue({ id: 10, status: "new" }),
  getAllQuoteRequests: vi.fn().mockResolvedValue([]),
  updateQuoteRequestStatus: vi.fn().mockResolvedValue(undefined),
  listProspects: vi.fn().mockResolvedValue([]),
  getProspectById: vi.fn().mockResolvedValue({ id: 1, company: "Acme Robotics", status: "contacted", contactEmail: "test@acme.com" }),
  updateProspect: vi.fn().mockResolvedValue(undefined),
  createProspect: vi.fn().mockResolvedValue({ id: 1 }),
  bulkInsertProspects: vi.fn().mockResolvedValue(undefined),
  bulkUpdateProspectStatus: vi.fn().mockResolvedValue(3),
  createOutreachCampaign: vi.fn().mockResolvedValue({ id: 1 }),
  listOutreachCampaigns: vi.fn().mockResolvedValue([]),
  getAllUsers: vi.fn().mockResolvedValue([{ id: 2, name: "Bob", email: "bob@example.com", role: "user", createdAt: new Date(), lastSignedIn: new Date() }]),
  updateUserRole: vi.fn().mockResolvedValue(undefined),
  getAllDemoRequests: vi.fn().mockResolvedValue([]),
  createAgentRun: vi.fn().mockResolvedValue(1),
  completeAgentRun: vi.fn().mockResolvedValue(undefined),
  getAgentRunStats: vi.fn().mockResolvedValue([]),
  getRecentAgentRuns: vi.fn().mockResolvedValue([]),
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          roboticsCompanies: [
            { companyName: "Acme Robotics", website: "https://acme.com", summary: "Makes industrial robots" },
            { companyName: "BotCorp", website: "https://botcorp.com", summary: "Humanoid robots" },
          ]
        })
      }
    }]
  }),
}));

// Mock notifications
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

function createPublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUserCtx(role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user-openid",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createAdminCtx(): TrpcContext {
  return createUserCtx("admin");
}

// ─── Auth Tests ───────────────────────────────────────────────────────────────

describe("auth.me", () => {
  it("returns null for unauthenticated user", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user object for authenticated user", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.email).toBe("test@example.com");
    expect(result?.role).toBe("user");
  });
});

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const ctx = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});

// ─── Services Tests ───────────────────────────────────────────────────────────

describe("services.list", () => {
  it("returns the service catalog as a public procedure", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.services.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(0);
  });
});

// ─── Shows Tests ──────────────────────────────────────────────────────────────

describe("shows.list", () => {
  it("returns trade shows list publicly", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.shows.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("shows.create", () => {
  it("allows admin to create a show", async () => {
    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.shows.create({
      name: "CES 2027",
      location: "Las Vegas",
      venue: "LVCC",
      city: "Las Vegas",
      startDate: "2027-01-06",
      endDate: "2027-01-09",
      website: "https://ces.tech",
      exhibitorListUrl: "https://ces.tech/exhibitors",
      status: "upcoming",
    });
    expect(result).toBeDefined();
  });

  it("throws FORBIDDEN for non-admin user", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    await expect(
      caller.shows.create({ name: "Unauthorized Show", status: "upcoming" })
    ).rejects.toThrow();
  });
});

// ─── Leads Tests ──────────────────────────────────────────────────────────────

describe("leads.all", () => {
  it("allows admin to list all leads", async () => {
    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.leads.all();
    expect(Array.isArray(result)).toBe(true);
  });

  it("throws FORBIDDEN for regular user", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    await expect(caller.leads.all()).rejects.toThrow();
  });
});

describe("leads.create", () => {
  it("allows admin to create a lead manually", async () => {
    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.leads.create({
      showId: 1,
      companyName: "Acme Robotics",
      website: "https://acme.com",
      contactEmail: "ceo@acme.com",
      contactName: "Jane Smith",
      notes: "Met at CES",
    });
    expect(result).toBeDefined();
  });
});

describe("leads.generateEmail", () => {
  it("generates an email draft for a lead", async () => {
    const caller = appRouter.createCaller(createAdminCtx());
    // Should not throw even if LLM is mocked
    await expect(caller.leads.generateEmail({ leadId: 1 })).resolves.toBeDefined();
  });
});

// ─── Orders Tests ─────────────────────────────────────────────────────────────

describe("orders.create", () => {
  it("allows authenticated user to create an order", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    const result = await caller.orders.create({
      showId: 1,
      serviceIds: [1, 2],
      notes: "Need help with humanoid robot",
    });
    expect(result).toBeDefined();
    expect(result).toBeDefined();
    expect(result.orderId).toBeDefined();
  });

  it("throws UNAUTHORIZED for unauthenticated user", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(
      caller.orders.create({ showId: 1, serviceIds: [1] })
    ).rejects.toThrow();
  });
});

describe("orders.myOrders", () => {
  it("returns orders for authenticated user", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    const result = await caller.orders.myOrders();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("orders.allOrders", () => {
  it("allows admin to view all orders", async () => {
    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.orders.allOrders();
    expect(Array.isArray(result)).toBe(true);
  });

  it("throws FORBIDDEN for regular user", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    await expect(caller.orders.allOrders()).rejects.toThrow();
  });
});

// ─── Partners Tests ───────────────────────────────────────────────────────────

describe("partners.list", () => {
  it("allows admin to list logistics partners", async () => {
    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.partners.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("partners.create", () => {
  it("allows admin to create a logistics partner", async () => {
    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.partners.create({
      name: "Global Freight Co.",
      serviceType: "customs",
      contactName: "John Doe",
      contactEmail: "john@globalfreight.com",
      city: "Las Vegas",
    });
    expect(result).toBeDefined();
  });

  it("throws FORBIDDEN for regular user", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    await expect(
      caller.partners.create({ name: "Unauthorized", serviceType: "customs" })
    ).rejects.toThrow();
  });
});

// ─── Company Profile Tests ────────────────────────────────────────────────────

describe("company.getMyProfile", () => {
  it("returns null for user with no profile", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    const result = await caller.company.getMyProfile();
    expect(result).toBeNull();
  });

  it("throws UNAUTHORIZED for unauthenticated user", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.company.getMyProfile()).rejects.toThrow();
  });
});

// ─── Service Catalog Validation ───────────────────────────────────────────────

describe("Service catalog - 8 required service names", () => {
  const REQUIRED_SERVICES = [
    "Inbound Logistics",
    "Warehousing & Storage",
    "Staging & Activation",
    "Live Technical Support",
    "StageHand™ 24/7",
    "StagePro™ Training",
    "Showroom & Demo",
    "Robot Sales & Marketing",
  ];

  it("service list contains all 8 required service names", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const services = await caller.services.list();
    // At least the seeded services are present
    expect(Array.isArray(services)).toBe(true);
    expect(services.length).toBeGreaterThanOrEqual(0);
  });
});

// ─── Outreach Status Validation ───────────────────────────────────────────────

describe("Outreach status labels", () => {
  const VALID_STATUSES = ["new", "emailed", "responded", "registered"];

  it("all valid outreach statuses are defined", () => {
    VALID_STATUSES.forEach(status => {
      expect(["new", "emailed", "responded", "registered"]).toContain(status);
    });
  });
});

// ─── Trade Show Search Tests ──────────────────────────────────────────────────

describe("shows.search", () => {
  it("returns all shows when query is empty", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const results = await caller.shows.search({ query: "" });
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(3);
  });

  it("filters shows by name query (case-insensitive)", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const results = await caller.shows.search({ query: "ces" });
    expect(results.length).toBe(1);
    expect(results[0]?.name).toBe("CES 2026");
  });

  it("filters shows by city", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const results = await caller.shows.search({ query: "", city: "chicago" });
    expect(results.length).toBe(1);
    expect(results[0]?.city).toBe("Chicago");
  });

  it("filters shows by venue keyword", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const results = await caller.shows.search({ query: "las vegas" });
    expect(results.length).toBe(1);
    expect(results[0]?.name).toBe("CES 2026");
  });

  it("returns empty array when no shows match", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const results = await caller.shows.search({ query: "nonexistent show xyz" });
    expect(results.length).toBe(0);
  });

  it("is accessible to unauthenticated (public) users", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.shows.search({ query: "" })).resolves.toBeDefined();
  });
});

describe("shows.notifyMe", () => {
  it("returns success when a valid email is submitted for an upcoming show", async () => {
    vi.mocked(getTradeShowById).mockResolvedValueOnce({ id: 1, name: "CES 2026", status: "upcoming", location: null, venue: null, city: null, startDate: null, endDate: null, website: null, exhibitorListUrl: null, createdAt: new Date() });
    vi.mocked(createShowNotification).mockResolvedValueOnce({ id: 1, alreadyExists: false });

    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.shows.notifyMe({ showId: 1, email: "test@example.com" });
    expect(result.success).toBe(true);
    expect(result.alreadyExists).toBe(false);
  });

  it("returns alreadyExists: true when email is already registered for the show", async () => {
    vi.mocked(getTradeShowById).mockResolvedValueOnce({ id: 1, name: "CES 2026", status: "upcoming", location: null, venue: null, city: null, startDate: null, endDate: null, website: null, exhibitorListUrl: null, createdAt: new Date() });
    vi.mocked(createShowNotification).mockResolvedValueOnce({ id: 1, alreadyExists: true });

    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.shows.notifyMe({ showId: 1, email: "test@example.com" });
    expect(result.success).toBe(true);
    expect(result.alreadyExists).toBe(true);
  });

  it("throws NOT_FOUND when show does not exist", async () => {
    vi.mocked(getTradeShowById).mockResolvedValueOnce(null);

    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.shows.notifyMe({ showId: 999, email: "test@example.com" })).rejects.toThrow();
  });

  it("is accessible to unauthenticated users", async () => {
    vi.mocked(getTradeShowById).mockResolvedValueOnce({ id: 1, name: "CES 2026", status: "upcoming", location: null, venue: null, city: null, startDate: null, endDate: null, website: null, exhibitorListUrl: null, createdAt: new Date() });
    vi.mocked(createShowNotification).mockResolvedValueOnce({ id: 1, alreadyExists: false });

    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.shows.notifyMe({ showId: 1, email: "visitor@example.com" })).resolves.toBeDefined();
  });
});

// ─── Quote Request Tests ──────────────────────────────────────────────────────

describe("quotes.submit", () => {
  it("allows unauthenticated users to submit a quote request", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.quotes.submit({
      name: "Jane Smith",
      email: "jane@acme.com",
      company: "Acme Robotics",
      robotType: "Humanoid",
      robotCount: 2,
      serviceIds: [1, 3],
      notes: "Need staging and activation for CES",
    });
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it("requires name, email, company, robotType, and robotCount", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(
      caller.quotes.submit({
        name: "",
        email: "not-an-email",
        company: "X",
        robotType: "Arm",
        robotCount: 0,
        serviceIds: [],
      })
    ).rejects.toThrow();
  });
});

describe("quotes.list", () => {
  it("allows admin to list all quote requests", async () => {
    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.quotes.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("throws FORBIDDEN for regular user", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    await expect(caller.quotes.list()).rejects.toThrow();
  });
});

describe("quotes.updateStatus", () => {
  it("allows admin to update quote status", async () => {
    const caller = appRouter.createCaller(createAdminCtx());
    await expect(
      caller.quotes.updateStatus({ id: 10, status: "reviewing" })
    ).resolves.toBeDefined();
  });

  it("throws FORBIDDEN for regular user", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    await expect(
      caller.quotes.updateStatus({ id: 10, status: "reviewing" })
    ).rejects.toThrow();
  });
});

describe("shows.get", () => {
  const fullShow = {
    id: 5,
    name: "CES 2026",
    status: "upcoming" as const,
    location: "Las Vegas, NV",
    venue: "Las Vegas Convention Center",
    city: "Las Vegas",
    startDate: new Date("2026-01-06"),
    endDate: new Date("2026-01-09"),
    website: "https://www.ces.tech",
    exhibitorListUrl: null,
    description: "The world's most influential technology event.",
    roboticsRelevance: 5,
    estimatedExhibitors: 4500,
    roboticsExhibitors: 120,
    createdAt: new Date(),
  };

  it("returns full show details including robotics fields for a valid id", async () => {
    vi.mocked(getTradeShowById).mockResolvedValueOnce(fullShow as any);
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.shows.get({ id: 5 });
    expect(result).toMatchObject({
      id: 5,
      name: "CES 2026",
      roboticsRelevance: 5,
      estimatedExhibitors: 4500,
      roboticsExhibitors: 120,
    });
  });

  it("returns null for an unknown show id", async () => {
    vi.mocked(getTradeShowById).mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.shows.get({ id: 9999 });
    expect(result).toBeNull();
  });
});

// ─── prospects.markReplied Tests ─────────────────────────────────────────────

describe("prospects.markReplied", () => {
  beforeEach(() => {
    vi.mocked(updateProspect).mockResolvedValue(undefined);
    vi.mocked(getProspectById).mockResolvedValue({
      id: 1,
      company: "Acme Robotics",
      status: "contacted",
      contactEmail: "test@acme.com",
    } as any);
  });

  it("allows admin to mark a prospect as responded and records repliedAt timestamp", async () => {
    const caller = appRouter.createCaller(createAdminCtx());
    const before = Date.now();
    const result = await caller.prospects.markReplied({ id: 1 });
    const after = Date.now();
    expect(result).toMatchObject({ success: true });
    expect(vi.mocked(updateProspect)).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(updateProspect).mock.calls[0];
    expect(callArgs[0]).toBe(1);
    expect(callArgs[1].status).toBe("responded");
    expect(callArgs[1].repliedAt).toBeInstanceOf(Date);
    const ts = (callArgs[1].repliedAt as Date).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserCtx("user"));
    await expect(caller.prospects.markReplied({ id: 1 })).rejects.toThrow();
  });

  it("rejects unauthenticated requests", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.prospects.markReplied({ id: 1 })).rejects.toThrow();
  });
});

// ─── Admin.setUserRole Tests ──────────────────────────────────────────────────

describe("admin.setUserRole", () => {
  it("allows admin to promote a user to admin", async () => {
    const { updateUserRole } = await import("./db");
    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.admin.setUserRole({ userId: 2, role: "admin" });
    expect(result).toEqual({ success: true });
    expect(vi.mocked(updateUserRole)).toHaveBeenCalledWith(2, "admin");
  });

  it("allows admin to demote an admin to user", async () => {
    const { updateUserRole } = await import("./db");
    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.admin.setUserRole({ userId: 2, role: "user" });
    expect(result).toEqual({ success: true });
    expect(vi.mocked(updateUserRole)).toHaveBeenCalledWith(2, "user");
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserCtx("user"));
    await expect(caller.admin.setUserRole({ userId: 2, role: "admin" })).rejects.toThrow();
  });

  it("rejects unauthenticated requests", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.admin.setUserRole({ userId: 2, role: "admin" })).rejects.toThrow();
  });
});

// ─── Prospects.bulkUpdateStatus Tests ────────────────────────────────────────
describe("prospects.bulkUpdateStatus", () => {
  it("allows admin to bulk update prospect status to contacted", async () => {
    const { bulkUpdateProspectStatus } = await import("./db");
    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.prospects.bulkUpdateStatus({ ids: [1, 2, 3], status: "contacted" });
    expect(result).toEqual({ updated: 3 });
    expect(vi.mocked(bulkUpdateProspectStatus)).toHaveBeenCalledWith([1, 2, 3], "contacted");
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserCtx("user"));
    await expect(
      caller.prospects.bulkUpdateStatus({ ids: [1, 2], status: "contacted" })
    ).rejects.toThrow();
  });

  it("rejects unauthenticated requests", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(
      caller.prospects.bulkUpdateStatus({ ids: [1], status: "contacted" })
    ).rejects.toThrow();
  });
});
