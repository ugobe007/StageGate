import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ── Mock the DB and notification helpers ─────────────────────────────────────
vi.mock("./db", () => ({
  createDemoRequest: vi.fn().mockResolvedValue(undefined),
  getAllDemoRequests: vi.fn().mockResolvedValue([]),
  updateDemoRequestStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

import * as db from "./db";
import { notifyOwner } from "./_core/notification";

// ── Shared anonymous context ──────────────────────────────────────────────────
function createAnonContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("demos.submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores the demo request and returns success", async () => {
    const caller = appRouter.createCaller(createAnonContext());

    const result = await caller.demos.submit({
      name: "Jane Smith",
      email: "jane@unitree.com",
      company: "Unitree Robotics",
      robotType: "Quadruped / Dog-style",
      preferredShowName: "CES 2026",
    });

    expect(result).toEqual({ success: true });
    expect(db.createDemoRequest).toHaveBeenCalledOnce();
    expect(db.createDemoRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Jane Smith",
        email: "jane@unitree.com",
        company: "Unitree Robotics",
        robotType: "Quadruped / Dog-style",
        preferredShowName: "CES 2026",
      })
    );
  });

  it("sends an owner notification with company name in title", async () => {
    const caller = appRouter.createCaller(createAnonContext());

    await caller.demos.submit({
      name: "Bob Lee",
      email: "bob@figure.ai",
      company: "Figure AI",
      robotType: "Humanoid / Bipedal",
    });

    expect(notifyOwner).toHaveBeenCalledOnce();
    const call = (notifyOwner as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.title).toContain("Figure AI");
    expect(call.content).toContain("bob@figure.ai");
    expect(call.content).toContain("Humanoid / Bipedal");
  });

  it("rejects if name is missing", async () => {
    const caller = appRouter.createCaller(createAnonContext());

    await expect(
      caller.demos.submit({
        name: "",
        email: "test@test.com",
        company: "ACME",
        robotType: "Wheeled Mobile Robot",
      })
    ).rejects.toThrow();
  });

  it("rejects if email is invalid", async () => {
    const caller = appRouter.createCaller(createAnonContext());

    await expect(
      caller.demos.submit({
        name: "Alice",
        email: "not-an-email",
        company: "ACME",
        robotType: "Wheeled Mobile Robot",
      })
    ).rejects.toThrow();
  });

  it("rejects if robotType is missing", async () => {
    const caller = appRouter.createCaller(createAnonContext());

    await expect(
      caller.demos.submit({
        name: "Alice",
        email: "alice@acme.com",
        company: "ACME",
        robotType: "",
      })
    ).rejects.toThrow();
  });

  it("includes funnel source in owner notification when provided", async () => {
    const caller = appRouter.createCaller(createAnonContext());

    await caller.demos.submit({
      name: "Dana",
      email: "dana@acme.com",
      company: "Acme Robotics",
      robotType: "Humanoid / Bipedal",
      source: "dashboard",
    });

    const call = (notifyOwner as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.content).toContain("Funnel: demo_submit");
    expect(call.content).toContain("source=dashboard");
    expect(db.createDemoRequest).toHaveBeenCalledWith(
      expect.not.objectContaining({ source: expect.anything() })
    );
  });

  it("accepts optional fields (no show, no message)", async () => {
    const caller = appRouter.createCaller(createAnonContext());

    const result = await caller.demos.submit({
      name: "Carlos",
      email: "carlos@boston.com",
      company: "Boston Dynamics",
      robotType: "Quadruped / Dog-style",
    });

    expect(result).toEqual({ success: true });
  });
});

// ── Admin: demos.list ─────────────────────────────────────────────────────────
describe("demos.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createAdminContext(): TrpcContext {
    return {
      user: {
        id: 1,
        openId: "admin-open-id",
        email: "admin@stagegate.com",
        name: "Admin User",
        loginMethod: "manus",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
  }

  function createUserContext(): TrpcContext {
    return {
      user: {
        id: 2,
        openId: "user-open-id",
        email: "user@example.com",
        name: "Regular User",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
  }

  it("allows admin to list all demo requests", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.demos.list();
    expect(Array.isArray(result)).toBe(true);
    expect(db.getAllDemoRequests).toHaveBeenCalledOnce();
  });

  it("throws FORBIDDEN for regular user", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.demos.list()).rejects.toThrow();
  });

  it("throws UNAUTHORIZED for unauthenticated user", async () => {
    const caller = appRouter.createCaller(createAnonContext());
    await expect(caller.demos.list()).rejects.toThrow();
  });
});

// ── Admin: demos.updateStatus ─────────────────────────────────────────────────
describe("demos.updateStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createAdminContext(): TrpcContext {
    return {
      user: {
        id: 1,
        openId: "admin-open-id",
        email: "admin@stagegate.com",
        name: "Admin User",
        loginMethod: "manus",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
  }

  it("allows admin to update demo request status", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.demos.updateStatus({ id: 1, status: "contacted" });
    expect(result).toEqual({ success: true });
    expect(db.updateDemoRequestStatus).toHaveBeenCalledWith(1, "contacted");
  });

  it("allows all valid statuses", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    for (const status of ["new", "contacted", "scheduled", "completed", "closed"] as const) {
      vi.clearAllMocks();
      const result = await caller.demos.updateStatus({ id: 1, status });
      expect(result).toEqual({ success: true });
    }
  });

  it("throws FORBIDDEN for regular user", async () => {
    const caller = appRouter.createCaller({
      user: {
        id: 2,
        openId: "user-open-id",
        email: "user@example.com",
        name: "Regular User",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    });
    await expect(
      caller.demos.updateStatus({ id: 1, status: "contacted" })
    ).rejects.toThrow();
  });
});
