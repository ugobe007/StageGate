import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    listCalendarEvents: vi.fn().mockResolvedValue([]),
    getCalendarEventById: vi.fn().mockResolvedValue(null),
    getCalendarEventByToken: vi.fn().mockResolvedValue(null),
    createCalendarEvent: vi.fn().mockImplementation(async (data) => ({
      id: 1,
      ...data,
      shareToken: data.shareToken ?? "tok123",
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    updateCalendarEvent: vi.fn().mockImplementation(async (id, data) => ({
      id,
      title: "Updated",
      description: null,
      startAt: new Date(),
      endAt: new Date(),
      type: "meeting",
      status: "scheduled",
      prospectId: null,
      prospectEmail: null,
      prospectName: null,
      companyName: null,
      notes: null,
      shareToken: "tok123",
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    })),
    deleteCalendarEvent: vi.fn().mockResolvedValue(undefined),
  };
});

// ─── Test context helpers ─────────────────────────────────────────────────────
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeAdminCtx(): TrpcContext {
  const user: AuthenticatedUser = {
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
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function makePublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("calendar.list", () => {
  it("returns events for admin", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.calendar.list({});
    expect(result).toHaveProperty("events");
    expect(Array.isArray(result.events)).toBe(true);
  });

  it("throws FORBIDDEN for non-admin user", async () => {
    const ctx = makePublicCtx();
    ctx.user = {
      id: 99,
      openId: "user-open-id",
      email: "user@example.com",
      name: "Regular User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.calendar.list({})).rejects.toThrow();
  });
});

describe("calendar.create", () => {
  it("creates an event and returns it with a shareToken", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const now = new Date();
    const later = new Date(now.getTime() + 30 * 60 * 1000);
    const result = await caller.calendar.create({
      title: "Intro Call — Test Co",
      startAt: now.toISOString(),
      endAt: later.toISOString(),
      type: "call",
      status: "scheduled",
    });
    expect(result.event).toBeDefined();
    expect(result.event.title).toBe("Intro Call — Test Co");
    expect(result.event.shareToken).toBeTruthy();
  });

  it("throws FORBIDDEN for non-admin", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const now = new Date();
    await expect(
      caller.calendar.create({
        title: "Test",
        startAt: now.toISOString(),
        endAt: new Date(now.getTime() + 3600000).toISOString(),
      })
    ).rejects.toThrow();
  });
});

describe("calendar.update", () => {
  it("updates an existing event", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.calendar.update({ id: 1, title: "Updated Title" });
    expect(result.event).toBeDefined();
  });
});

describe("calendar.delete", () => {
  it("deletes an event and returns success", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.calendar.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });
});

describe("calendar.getByToken", () => {
  it("returns NOT_FOUND for unknown token", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(caller.calendar.getByToken({ token: "nonexistent" })).rejects.toThrow();
  });

  it("returns public event fields for valid token", async () => {
    const { getCalendarEventByToken } = await import("./db");
    vi.mocked(getCalendarEventByToken).mockResolvedValueOnce({
      id: 5,
      title: "Partner Demo",
      description: "Live demo for partner",
      startAt: new Date("2026-06-01T18:00:00Z"),
      endAt: new Date("2026-06-01T19:00:00Z"),
      type: "demo",
      status: "confirmed",
      prospectId: null,
      prospectEmail: "partner@example.com",
      prospectName: "Jane Partner",
      companyName: "Partner Corp",
      notes: "internal notes",
      shareToken: "valid-token-abc",
      createdBy: 42,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.calendar.getByToken({ token: "valid-token-abc" });
    expect(result.event.title).toBe("Partner Demo");
    expect(result.event.companyName).toBe("Partner Corp");
    // Internal notes should NOT be exposed
    expect((result.event as Record<string, unknown>).notes).toBeUndefined();
  });
});

describe("calendar.agentList", () => {
  it("allows admin to list events", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.calendar.agentList({});
    expect(result).toHaveProperty("events");
  });

  it("rejects unauthenticated requests without apiKey", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(caller.calendar.agentList({})).rejects.toThrow();
  });
});

describe("calendar.cancel", () => {
  beforeEach(async () => {
    const { getCalendarEventById, updateCalendarEvent } = await import("./db");
    // Default: event exists and is scheduled
    vi.mocked(getCalendarEventById).mockResolvedValue({
      id: 10,
      title: "Intro Call",
      description: null,
      startAt: new Date(Date.now() + 86400000),
      endAt: new Date(Date.now() + 90000000),
      type: "meeting",
      status: "scheduled",
      prospectId: null,
      prospectEmail: "prospect@example.com",
      prospectName: "Test Prospect",
      companyName: "Test Co",
      notes: null,
      shareToken: "tok-cancel",
      createdBy: 42,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(updateCalendarEvent).mockImplementation(async (id, data) => ({
      id,
      title: "Intro Call",
      description: null,
      startAt: new Date(Date.now() + 86400000),
      endAt: new Date(Date.now() + 90000000),
      type: "meeting",
      status: "scheduled",
      prospectId: null,
      prospectEmail: "prospect@example.com",
      prospectName: "Test Prospect",
      companyName: "Test Co",
      notes: null,
      shareToken: "tok-cancel",
      createdBy: 42,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }));
  });

  it("admin can cancel a scheduled event", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.calendar.cancel({ id: 10, reason: "Scheduling conflict" });
    expect(result.event.status).toBe("cancelled");
  });

  it("throws BAD_REQUEST when event is already cancelled", async () => {
    const { getCalendarEventById } = await import("./db");
    vi.mocked(getCalendarEventById).mockResolvedValueOnce({
      id: 10,
      title: "Already Cancelled",
      description: null,
      startAt: new Date(Date.now() + 86400000),
      endAt: new Date(Date.now() + 90000000),
      type: "meeting",
      status: "cancelled",
      prospectId: null,
      prospectEmail: null,
      prospectName: null,
      companyName: null,
      notes: null,
      shareToken: "tok-cancel",
      createdBy: 42,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const caller = appRouter.createCaller(makeAdminCtx());
    await expect(caller.calendar.cancel({ id: 10 })).rejects.toThrow();
  });

  it("non-admin cannot cancel events", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(caller.calendar.cancel({ id: 10 })).rejects.toThrow();
  });
});
