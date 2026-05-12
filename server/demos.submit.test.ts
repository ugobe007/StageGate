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
