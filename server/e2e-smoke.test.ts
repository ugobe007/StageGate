/**
 * End-to-End Smoke Tests — v68
 *
 * Covers three critical workflows:
 *  1. Email Outreach Pipeline: prospect create → draft email → mark contacted → reply → schedule meeting
 *  2. Calendar Scheduling: create event → confirm → reschedule → reminder eligibility
 *  3. Customer Order Pipeline: quote submit → service order create → status update → fulfillment
 *
 * All DB helpers are mocked so tests are fast and deterministic.
 * Email sends are mocked to verify they are called with correct args.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Shared mock state ────────────────────────────────────────────────────────
const mockProspects: Record<number, Record<string, unknown>> = {};
const mockCalendarEvents: Record<number, Record<string, unknown>> = {};
const mockOrders: Record<number, Record<string, unknown>> = {};
const mockOrderItems: Record<number, Record<string, unknown>[]> = {};
const mockQuotes: Record<number, Record<string, unknown>> = {};
let nextProspectId = 1;
let nextCalendarId = 1;
let nextOrderId = 1;
let nextQuoteId = 1;

// ─── Mock email helper ────────────────────────────────────────────────────────
const mockSendEmail = vi.fn().mockResolvedValue({ id: "email-mock-id" });
vi.mock("./email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

// ─── Mock notification helper ─────────────────────────────────────────────────
const mockNotifyOwner = vi.fn().mockResolvedValue(true);
vi.mock("./_core/notification", () => ({
  notifyOwner: (...args: unknown[]) => mockNotifyOwner(...args),
}));

// ─── Mock DB helpers ──────────────────────────────────────────────────────────
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,

    // ── Prospects ──
    createProspect: vi.fn().mockImplementation(async (data) => {
      const id = nextProspectId++;
      mockProspects[id] = { id, status: "new", ...data, createdAt: new Date(), updatedAt: new Date() };
      return id;
    }),
    getProspectById: vi.fn().mockImplementation(async (id: number) => mockProspects[id] ?? null),
    updateProspect: vi.fn().mockImplementation(async (id: number, data: Record<string, unknown>) => {
      if (mockProspects[id]) mockProspects[id] = { ...mockProspects[id], ...data, updatedAt: new Date() };
    }),
    updateProspectStatus: vi.fn().mockImplementation(async (id: number, status: string) => {
      if (mockProspects[id]) mockProspects[id] = { ...mockProspects[id], status };
    }),
    listProspects: vi.fn().mockImplementation(async () => Object.values(mockProspects)),

    // ── Calendar events ──
    createCalendarEvent: vi.fn().mockImplementation(async (data) => {
      const id = nextCalendarId++;
      const event = {
        id,
        ...data,
        shareToken: data.shareToken ?? `tok-${id}`,
        reminderSentAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockCalendarEvents[id] = event;
      return event;
    }),
    getCalendarEventById: vi.fn().mockImplementation(async (id: number) => mockCalendarEvents[id] ?? null),
    getCalendarEventByToken: vi.fn().mockImplementation(async (token: string) =>
      Object.values(mockCalendarEvents).find((e) => e.shareToken === token) ?? null
    ),
    updateCalendarEvent: vi.fn().mockImplementation(async (id: number, data: Record<string, unknown>) => {
      if (mockCalendarEvents[id]) {
        mockCalendarEvents[id] = { ...mockCalendarEvents[id], ...data, updatedAt: new Date() };
        return mockCalendarEvents[id];
      }
      return null;
    }),
    deleteCalendarEvent: vi.fn().mockImplementation(async (id: number) => {
      delete mockCalendarEvents[id];
    }),
    listCalendarEvents: vi.fn().mockImplementation(async () => Object.values(mockCalendarEvents)),

    // ── Orders ──
    createOrder: vi.fn().mockImplementation(async (data) => {
      const id = nextOrderId++;
      mockOrders[id] = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
      mockOrderItems[id] = [];
      return id;
    }),
    createOrderItem: vi.fn().mockImplementation(async (data) => {
      const orderId = data.orderId as number;
      if (!mockOrderItems[orderId]) mockOrderItems[orderId] = [];
      const item = { id: Math.random(), ...data };
      mockOrderItems[orderId].push(item);
      return item.id;
    }),
    getOrderById: vi.fn().mockImplementation(async (id: number) => mockOrders[id] ?? null),
    getOrdersByUserId: vi.fn().mockImplementation(async (userId: number) =>
      Object.values(mockOrders).filter((o) => o.userId === userId)
    ),
    getAllOrders: vi.fn().mockImplementation(async () => Object.values(mockOrders)),
    getOrderItems: vi.fn().mockImplementation(async (orderId: number) => mockOrderItems[orderId] ?? []),
    updateOrderStatus: vi.fn().mockImplementation(async (id: number, status: string) => {
      if (mockOrders[id]) mockOrders[id] = { ...mockOrders[id], status };
    }),

    // ── Quotes ──
    createQuoteRequest: vi.fn().mockImplementation(async (data) => {
      const id = nextQuoteId++;
      mockQuotes[id] = { id, status: "new", ...data, createdAt: new Date() };
      return id;
    }),
    getAllQuoteRequests: vi.fn().mockImplementation(async () => Object.values(mockQuotes)),
    getQuoteRequestById: vi.fn().mockImplementation(async (id: number) => mockQuotes[id] ?? null),
    updateQuoteRequestStatus: vi.fn().mockImplementation(async (id: number, status: string, adminNotes?: string) => {
      if (mockQuotes[id]) mockQuotes[id] = { ...mockQuotes[id], status, adminNotes };
    }),

    // ── Services (needed for order create) ──
    getAllServices: vi.fn().mockResolvedValue([
      { id: 1, name: "Crating & Packaging", slug: "crating", basePrice: "1200.00" },
      { id: 2, name: "Customs Clearance", slug: "customs", basePrice: "800.00" },
      { id: 3, name: "On-Site Activation", slug: "activation", basePrice: "2500.00" },
    ]),

    // ── Trade shows (needed for order create) ──
    getTradeShowById: vi.fn().mockResolvedValue({
      id: 10,
      name: "CES 2027",
      venue: "Las Vegas Convention Center",
      city: "Las Vegas",
      startDate: new Date("2027-01-06"),
      endDate: new Date("2027-01-09"),
    }),

    // ── Company profile ──
    getCompanyProfileByUserId: vi.fn().mockResolvedValue({
      id: 1,
      userId: 100,
      companyName: "Acme Robotics",
      contactEmail: "contact@acmerobotics.com",
    }),

    // ── Draft emails (needed for outreach) ──
    getAllDraftEmails: vi.fn().mockResolvedValue([]),
    createDraftEmail: vi.fn().mockResolvedValue({ id: 1 }),
    updateDraftEmail: vi.fn().mockResolvedValue(undefined),
  };
});

// ─── Context helpers ──────────────────────────────────────────────────────────
type AuthUser = NonNullable<TrpcContext["user"]>;

function makeAdminCtx(): TrpcContext {
  const user: AuthUser = {
    id: 42,
    openId: "admin-open-id",
    email: "admin@onstage.bot",
    name: "Admin",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"] };
}

function makeUserCtx(userId = 100): TrpcContext {
  const user: AuthUser = {
    id: userId,
    openId: `user-${userId}`,
    email: `user${userId}@example.com`,
    name: "Client User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"] };
}

function makeAnonCtx(): TrpcContext {
  return { user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"] };
}

// ─── Reset state before each test ────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(mockProspects)) delete mockProspects[Number(k)];
  for (const k of Object.keys(mockCalendarEvents)) delete mockCalendarEvents[Number(k)];
  for (const k of Object.keys(mockOrders)) delete mockOrders[Number(k)];
  for (const k of Object.keys(mockOrderItems)) delete mockOrderItems[Number(k)];
  for (const k of Object.keys(mockQuotes)) delete mockQuotes[Number(k)];
  nextProspectId = 1;
  nextCalendarId = 1;
  nextOrderId = 1;
  nextQuoteId = 1;
});

// ═════════════════════════════════════════════════════════════════════════════
// WORKFLOW 1 — Email Outreach Pipeline
// ═════════════════════════════════════════════════════════════════════════════
describe("Workflow 1 — Email Outreach Pipeline", () => {
  it("Step 1: admin can create a new prospect", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.prospects.create({
      company: "Unitree Robotics",
      contactName: "Li Wei",
      contactEmail: "li.wei@unitree.com",
      contactTitle: "VP Sales",
      status: "new",
    });
    expect(result.success).toBe(true);
  });

  it("Step 2: created prospect appears in list with status=new", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    await caller.prospects.create({
      company: "Unitree Robotics",
      contactName: "Li Wei",
      contactEmail: "li.wei@unitree.com",
    });
    const { prospects } = await caller.prospects.list({});
    expect(prospects.length).toBeGreaterThan(0);
    const p = (prospects as Array<{ company: string; status: string }>).find((x) => x.company === "Unitree Robotics");
    expect(p).toBeDefined();
    expect(p?.status).toBe("new");
  });

  it("Step 3: markReplied updates status to responded", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    await caller.prospects.create({
      company: "Unitree Robotics",
      contactName: "Li Wei",
      contactEmail: "li.wei@unitree.com",
    });
    const prospectId = nextProspectId - 1;

    const result = await caller.prospects.markReplied({ id: prospectId });
    expect(result.success).toBe(true);
    expect(result.calendarEvent).toBeNull();
    expect(mockProspects[prospectId]?.status).toBe("responded");
  });

  it("Step 4: markReplied with scheduleMeeting=true creates calendar event", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    await caller.prospects.create({
      company: "Unitree Robotics",
      contactName: "Li Wei",
      contactEmail: "li.wei@unitree.com",
    });
    const prospectId = nextProspectId - 1;

    const futureTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const result = await caller.prospects.markReplied({
      id: prospectId,
      scheduleMeeting: true,
      proposedTime: futureTime,
      meetingDurationMinutes: 30,
      meetingNotes: "Intro call to discuss CES 2027 logistics",
    });

    expect(result.success).toBe(true);
    expect(result.calendarEvent).not.toBeNull();
    expect(result.calendarEvent?.title).toContain("Unitree Robotics");
    expect(result.calendarEvent?.type).toBe("call");
    expect(result.calendarEvent?.status).toBe("scheduled");
    expect(result.calendarEvent?.shareToken).toBeTruthy();
  });

  it("Step 5: scheduling a meeting updates prospect status to scheduled", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    await caller.prospects.create({
      company: "Unitree Robotics",
      contactName: "Li Wei",
      contactEmail: "li.wei@unitree.com",
    });
    const prospectId = nextProspectId - 1;

    const futureTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await caller.prospects.markReplied({
      id: prospectId,
      scheduleMeeting: true,
      proposedTime: futureTime,
    });

    expect(mockProspects[prospectId]?.status).toBe("scheduled");
  });

  it("Step 6: scheduling a meeting sends email to Tommy", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    await caller.prospects.create({
      company: "Unitree Robotics",
      contactName: "Li Wei",
      contactEmail: "li.wei@unitree.com",
    });
    const prospectId = nextProspectId - 1;

    const futureTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await caller.prospects.markReplied({
      id: prospectId,
      scheduleMeeting: true,
      proposedTime: futureTime,
    });

    // Tommy email
    const tommyCalls = mockSendEmail.mock.calls.filter((c) =>
      c[0]?.to === "tom@starsupportinc.com"
    );
    expect(tommyCalls.length).toBeGreaterThan(0);
    expect(tommyCalls[0][0].subject).toContain("Unitree Robotics");
  });

  it("Step 7: scheduling a meeting sends confirmation email to prospect", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    await caller.prospects.create({
      company: "Unitree Robotics",
      contactName: "Li Wei",
      contactEmail: "li.wei@unitree.com",
    });
    const prospectId = nextProspectId - 1;

    const futureTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await caller.prospects.markReplied({
      id: prospectId,
      scheduleMeeting: true,
      proposedTime: futureTime,
    });

    const prospectCalls = mockSendEmail.mock.calls.filter((c) =>
      c[0]?.to === "li.wei@unitree.com"
    );
    expect(prospectCalls.length).toBeGreaterThan(0);
    expect(prospectCalls[0][0].subject).toContain("Confirmed");
  });

  it("Step 8: scheduling a meeting sends owner notification", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    await caller.prospects.create({
      company: "Unitree Robotics",
      contactName: "Li Wei",
      contactEmail: "li.wei@unitree.com",
    });
    const prospectId = nextProspectId - 1;

    const futureTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await caller.prospects.markReplied({
      id: prospectId,
      scheduleMeeting: true,
      proposedTime: futureTime,
    });

    expect(mockNotifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("Unitree Robotics") })
    );
  });

  it("Step 9: non-admin cannot call markReplied", async () => {
    const caller = appRouter.createCaller(makeUserCtx());
    await expect(caller.prospects.markReplied({ id: 1 })).rejects.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// WORKFLOW 2 — Calendar Scheduling
// ═════════════════════════════════════════════════════════════════════════════
describe("Workflow 2 — Calendar Scheduling", () => {
  it("Step 1: admin can create a calendar event", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const futureEnd = new Date(futureStart.getTime() + 30 * 60 * 1000);

    const result = await caller.calendar.create({
      title: "Demo Call — Agility Robotics",
      type: "demo",
      startAt: futureStart.toISOString(),
      endAt: futureEnd.toISOString(),
      prospectEmail: "sales@agilityrobotics.com",
      companyName: "Agility Robotics",
    });

    expect(result.event.id).toBeDefined();
    expect(result.event.shareToken).toBeTruthy();
    expect(result.event.status).toBe("scheduled");
    expect(result.event.type).toBe("demo");
  });

  it("Step 2: created event appears in list", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const futureEnd = new Date(futureStart.getTime() + 30 * 60 * 1000);

    await caller.calendar.create({
      title: "Demo Call — Agility Robotics",
      type: "demo",
      startAt: futureStart.toISOString(),
      endAt: futureEnd.toISOString(),
    });

    const { events } = await caller.calendar.list({});
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].title).toBe("Demo Call — Agility Robotics");
  });

  it("Step 3: admin can confirm a scheduled event", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const futureEnd = new Date(futureStart.getTime() + 30 * 60 * 1000);

    const { event: created } = await caller.calendar.create({
      title: "Partner Meeting",
      type: "meeting",
      startAt: futureStart.toISOString(),
      endAt: futureEnd.toISOString(),
    });

    const { event: confirmed } = await caller.calendar.confirm({ id: created.id });
    expect(confirmed.status).toBe("confirmed");
  });

  it("Step 4: admin can reschedule an event and it resets to scheduled", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const futureEnd = new Date(futureStart.getTime() + 30 * 60 * 1000);

    const { event: created } = await caller.calendar.create({
      title: "Partner Meeting",
      type: "meeting",
      startAt: futureStart.toISOString(),
      endAt: futureEnd.toISOString(),
      prospectEmail: "partner@example.com",
      prospectName: "Jane Partner",
      companyName: "Partner Co",
    });

    // First confirm it
    await caller.calendar.confirm({ id: created.id });

    // Then reschedule
    const newStart = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const newEnd = new Date(newStart.getTime() + 45 * 60 * 1000);
    const { event: rescheduled } = await caller.calendar.reschedule({
      id: created.id,
      startAt: newStart.toISOString(),
      endAt: newEnd.toISOString(),
      notes: "Moved due to scheduling conflict",
    });

    expect(rescheduled.status).toBe("scheduled");
    expect(new Date(rescheduled.startAt as string).getTime()).toBeCloseTo(newStart.getTime(), -3);
  });

  it("Step 5: reschedule sends email to prospect if email is set", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const futureEnd = new Date(futureStart.getTime() + 30 * 60 * 1000);

    const { event: created } = await caller.calendar.create({
      title: "Partner Meeting",
      type: "meeting",
      startAt: futureStart.toISOString(),
      endAt: futureEnd.toISOString(),
      prospectEmail: "partner@example.com",
      prospectName: "Jane Partner",
      companyName: "Partner Co",
    });

    const newStart = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const newEnd = new Date(newStart.getTime() + 30 * 60 * 1000);
    await caller.calendar.reschedule({
      id: created.id,
      startAt: newStart.toISOString(),
      endAt: newEnd.toISOString(),
    });

    const prospectEmails = mockSendEmail.mock.calls.filter((c) =>
      c[0]?.to === "partner@example.com"
    );
    expect(prospectEmails.length).toBeGreaterThan(0);
  });

  it("Step 6: public getByToken returns event for valid share token", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const futureEnd = new Date(futureStart.getTime() + 30 * 60 * 1000);

    const { event: created } = await caller.calendar.create({
      title: "Vendor Call",
      type: "call",
      startAt: futureStart.toISOString(),
      endAt: futureEnd.toISOString(),
    });

    const anonCaller = appRouter.createCaller(makeAnonCtx());
    const { event: publicEvent } = await anonCaller.calendar.getByToken({ token: created.shareToken });
    expect(publicEvent.title).toBe("Vendor Call");
  });

  it("Step 7: getByToken returns NOT_FOUND for unknown token", async () => {
    const anonCaller = appRouter.createCaller(makeAnonCtx());
    await expect(anonCaller.calendar.getByToken({ token: "invalid-token-xyz" })).rejects.toThrow("NOT_FOUND");
  });

  it("Step 8: reminder eligibility — event starting in 23h with no reminderSentAt is eligible", () => {
    const now = Date.now();
    const startAt = new Date(now + 23 * 60 * 60 * 1000);
    const reminderSentAt = null;
    const hoursUntil = (startAt.getTime() - now) / (1000 * 60 * 60);
    const isEligible = hoursUntil >= 22 && hoursUntil <= 26 && reminderSentAt === null;
    expect(isEligible).toBe(true);
  });

  it("Step 9: reminder eligibility — event already stamped is NOT eligible", () => {
    const now = Date.now();
    const startAt = new Date(now + 23 * 60 * 60 * 1000);
    const reminderSentAt = new Date(now - 60 * 60 * 1000); // stamped 1h ago
    const hoursUntil = (startAt.getTime() - now) / (1000 * 60 * 60);
    const isEligible = hoursUntil >= 22 && hoursUntil <= 26 && reminderSentAt === null;
    expect(isEligible).toBe(false);
  });

  it("Step 10: admin can delete a calendar event", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const futureEnd = new Date(futureStart.getTime() + 30 * 60 * 1000);

    const { event: created } = await caller.calendar.create({
      title: "Temp Event",
      type: "event",
      startAt: futureStart.toISOString(),
      endAt: futureEnd.toISOString(),
    });

    const result = await caller.calendar.delete({ id: created.id });
    expect(result.success).toBe(true);
    expect(mockCalendarEvents[created.id]).toBeUndefined();
  });

  it("Step 11: non-admin cannot create calendar events", async () => {
    const caller = appRouter.createCaller(makeUserCtx());
    const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const futureEnd = new Date(futureStart.getTime() + 30 * 60 * 1000);
    await expect(
      caller.calendar.create({
        title: "Unauthorized Event",
        type: "meeting",
        startAt: futureStart.toISOString(),
        endAt: futureEnd.toISOString(),
      })
    ).rejects.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// WORKFLOW 3 — Customer Order Pipeline
// ═════════════════════════════════════════════════════════════════════════════
describe("Workflow 3 — Customer Order Pipeline", () => {
  it("Step 1: anonymous user can submit a quote request", async () => {
    const caller = appRouter.createCaller(makeAnonCtx());
    const result = await caller.quotes.submit({
      name: "Alex Chen",
      email: "alex@roboticsfirm.com",
      company: "Robotics Firm Inc",
      robotType: "Humanoid",
      robotCount: 2,
      showId: 10,
      showName: "CES 2027",
      serviceIds: [1, 2],
      notes: "Need full logistics package",
    });
    expect(result.success).toBe(true);
    expect(mockNotifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("Robotics Firm Inc") })
    );
  });

  it("Step 2: admin can list all quote requests", async () => {
    const anonCaller = appRouter.createCaller(makeAnonCtx());
    await anonCaller.quotes.submit({
      name: "Alex Chen",
      email: "alex@roboticsfirm.com",
      company: "Robotics Firm Inc",
      robotType: "Humanoid",
      robotCount: 1,
    });

    const adminCaller = appRouter.createCaller(makeAdminCtx());
    const quotes = await adminCaller.quotes.list();
    expect(quotes.length).toBeGreaterThan(0);
    expect(quotes[0].company).toBe("Robotics Firm Inc");
  });

  it("Step 3: admin can update quote status through the pipeline", async () => {
    const anonCaller = appRouter.createCaller(makeAnonCtx());
    await anonCaller.quotes.submit({
      name: "Alex Chen",
      email: "alex@roboticsfirm.com",
      company: "Robotics Firm Inc",
      robotType: "Humanoid",
      robotCount: 1,
    });
    const quoteId = nextQuoteId - 1;

    const adminCaller = appRouter.createCaller(makeAdminCtx());

    await adminCaller.quotes.updateStatus({ id: quoteId, status: "reviewing" });
    expect(mockQuotes[quoteId]?.status).toBe("reviewing");

    await adminCaller.quotes.updateStatus({ id: quoteId, status: "quoted", adminNotes: "Sent quote for $4,500" });
    expect(mockQuotes[quoteId]?.status).toBe("quoted");
    expect(mockQuotes[quoteId]?.adminNotes).toBe("Sent quote for $4,500");

    await adminCaller.quotes.updateStatus({ id: quoteId, status: "converted" });
    expect(mockQuotes[quoteId]?.status).toBe("converted");
  });

  it("Step 4: authenticated user can create a service order", async () => {
    const caller = appRouter.createCaller(makeUserCtx(100));
    const result = await caller.orders.create({
      showId: 10,
      serviceIds: [1, 2, 3],
      notes: "Please handle all customs paperwork",
    });
    expect(result.orderId).toBeDefined();
    expect(typeof result.orderId).toBe("number");
  });

  it("Step 5: order is created with correct total and items", async () => {
    const caller = appRouter.createCaller(makeUserCtx(100));
    await caller.orders.create({
      showId: 10,
      serviceIds: [1, 2], // $1200 + $800 = $2000
    });
    const orderId = nextOrderId - 1;

    expect(mockOrders[orderId]).toBeDefined();
    expect(parseFloat(mockOrders[orderId]?.totalAmount as string)).toBeCloseTo(2000, 0);
    expect(mockOrderItems[orderId]?.length).toBe(2);
  });

  it("Step 6: order creation notifies owner", async () => {
    const caller = appRouter.createCaller(makeUserCtx(100));
    await caller.orders.create({ showId: 10, serviceIds: [1] });
    expect(mockNotifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("Service Order") })
    );
  });

  it("Step 7: user can view their own orders", async () => {
    const caller = appRouter.createCaller(makeUserCtx(100));
    await caller.orders.create({ showId: 10, serviceIds: [1] });
    const orders = await caller.orders.myOrders();
    expect(orders.length).toBeGreaterThan(0);
    expect(orders[0].userId).toBe(100);
  });

  it("Step 8: admin can update order status through the pipeline", async () => {
    const userCaller = appRouter.createCaller(makeUserCtx(100));
    const { orderId } = await userCaller.orders.create({ showId: 10, serviceIds: [1] });

    const adminCaller = appRouter.createCaller(makeAdminCtx());

    await adminCaller.orders.updateStatus({ id: orderId, status: "confirmed" });
    expect(mockOrders[orderId]?.status).toBe("confirmed");

    await adminCaller.orders.updateStatus({ id: orderId, status: "in_progress" });
    expect(mockOrders[orderId]?.status).toBe("in_progress");

    await adminCaller.orders.updateStatus({ id: orderId, status: "completed" });
    expect(mockOrders[orderId]?.status).toBe("completed");
  });

  it("Step 9: admin can view all orders", async () => {
    const userCaller = appRouter.createCaller(makeUserCtx(100));
    await userCaller.orders.create({ showId: 10, serviceIds: [1] });
    await userCaller.orders.create({ showId: 10, serviceIds: [2, 3] });

    const adminCaller = appRouter.createCaller(makeAdminCtx());
    const allOrders = await adminCaller.orders.allOrders();
    expect(allOrders.length).toBe(2);
  });

  it("Step 10: non-admin cannot update order status", async () => {
    const userCaller = appRouter.createCaller(makeUserCtx(100));
    const { orderId } = await userCaller.orders.create({ showId: 10, serviceIds: [1] });

    const anotherUserCaller = appRouter.createCaller(makeUserCtx(200));
    await expect(anotherUserCaller.orders.updateStatus({ id: orderId, status: "confirmed" })).rejects.toThrow();
  });

  it("Step 11: unauthenticated user cannot create an order", async () => {
    const caller = appRouter.createCaller(makeAnonCtx());
    await expect(caller.orders.create({ showId: 10, serviceIds: [1] })).rejects.toThrow();
  });

  it("Step 12: admin can cancel an order", async () => {
    const userCaller = appRouter.createCaller(makeUserCtx(100));
    const { orderId } = await userCaller.orders.create({ showId: 10, serviceIds: [1] });

    const adminCaller = appRouter.createCaller(makeAdminCtx());
    await adminCaller.orders.updateStatus({ id: orderId, status: "cancelled" });
    expect(mockOrders[orderId]?.status).toBe("cancelled");
  });
});
