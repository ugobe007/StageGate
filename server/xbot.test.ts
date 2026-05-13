import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ── Mock DB helpers ───────────────────────────────────────────────────────────

vi.mock("./db", () => {
  const proj = {
    id: 1,
    sessionToken: "test-session-token-abc123",
    userId: null,
    robotMake: "Unitree",
    robotModel: "G1",
    robotDimensions: "60x45x130",
    robotWeight: "35",
    powerRequirements: "220V",
    specialHandling: null,
    originCountry: "China",
    originCity: "Shenzhen",
    shippingMethod: "air",
    flightVesselNumber: "CA881",
    eta: new Date("2026-12-15"),
    portOfEntry: "Los Angeles (LAX/Port of LA)",
    hsCode: null,
    ataCarnet: false,
    customsBroker: "stagegate",
    customsBrokerName: null,
    showId: null,
    boothNumber: null,
    setupDate: null,
    teardownDate: null,
    selectedServices: ["warehouse", "staging"],
    groundTransportProvider: "stagegate",
    contacts: { primary: { name: "Jane Smith", email: "jane@unitree.com", phone: "+1 555 000 0000" } },
    currentStep: 1,
    status: "draft",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const brief = {
    id: 1,
    projectId: 1,
    timeline: [{ date: "2026-12-01", label: "Ship By Deadline", description: "Must ship by this date", critical: true }],
    customsChecklist: [{ item: "Commercial Invoice", required: true, notes: "Must include HS code" }],
    groundTransportOptions: [],
    servicePackage: [{ service: "Warehousing", description: "Climate-controlled storage", included: true }],
    hsCodeSuggestion: "8479.89",
    ataCarnetEligible: true,
    shipByDeadline: new Date("2026-12-01"),
    summaryNotes: "Your robot is eligible for ATA Carnet.",
    generatedAt: new Date(),
  };
  return {
    createXbotProject: vi.fn().mockResolvedValue(proj),
    getXbotProject: vi.fn().mockResolvedValue(proj),
    updateXbotProject: vi.fn().mockResolvedValue(undefined),
    getXbotBrief: vi.fn().mockResolvedValue(null),
    upsertXbotBrief: vi.fn().mockResolvedValue(brief),
    listXbotProjectsByUser: vi.fn().mockResolvedValue([proj]),
    listAllXbotProjects: vi.fn().mockResolvedValue([proj]),
    getTradeShowById: vi.fn().mockResolvedValue(null),
    createDemoRequest: vi.fn().mockResolvedValue(undefined),
    getAllDemoRequests: vi.fn().mockResolvedValue([]),
    updateDemoRequestStatus: vi.fn().mockResolvedValue(undefined),
    createQuoteRequest: vi.fn().mockResolvedValue(undefined),
    getAllQuoteRequests: vi.fn().mockResolvedValue([]),
    updateQuoteRequestStatus: vi.fn().mockResolvedValue(undefined),
    getAllTradeShows: vi.fn().mockResolvedValue([]),
    searchTradeShows: vi.fn().mockResolvedValue([]),
    getTradeShowsByCity: vi.fn().mockResolvedValue([]),
    getShowNotificationsByShow: vi.fn().mockResolvedValue([]),
    createShowNotification: vi.fn().mockResolvedValue(undefined),
    getAllLogisticsPartners: vi.fn().mockResolvedValue([]),
    createLogisticsPartner: vi.fn().mockResolvedValue(1),
    updateLogisticsPartner: vi.fn().mockResolvedValue(undefined),
    deleteLogisticsPartner: vi.fn().mockResolvedValue(undefined),
    getLeadById: vi.fn().mockResolvedValue(null),
    updateLead: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          timeline: [{ date: "2026-12-01", label: "Ship By", description: "Must ship", critical: true }],
          customsChecklist: [{ item: "Invoice", required: true, notes: "" }],
          groundTransportOptions: [],
          servicePackage: [{ service: "Warehouse", description: "Storage", included: true }],
          hsCodeSuggestion: "8479.89",
          ataCarnetEligible: true,
          shipByDeadline: "2026-12-01",
          summaryNotes: "Brief generated successfully.",
        }),
      },
    }],
  }),
}));

import * as db from "./db";

// Shared test data shapes (for use in test assertions)
const MOCK_PROJECT_ID = 1;
const MOCK_SESSION_TOKEN = "test-session-token-abc123";

// ── Context helpers ───────────────────────────────────────────────────────────

function createAnonContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createAuthContext(role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "user-42",
      email: "user@example.com",
      name: "Test User",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("xbot.createProject", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a project for anonymous user and returns projectId + sessionToken", async () => {
    const caller = appRouter.createCaller(createAnonContext());
    const result = await caller.xbot.createProject({});
    expect(result.projectId).toBe(MOCK_PROJECT_ID);
    expect(typeof result.sessionToken).toBe("string");
    expect(result.sessionToken.length).toBeGreaterThan(10);
    expect(db.createXbotProject).toHaveBeenCalledOnce();
  });

  it("creates a project for authenticated user with userId set", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.xbot.createProject({ robotMake: "Unitree", robotModel: "G1" });
    expect(result.projectId).toBe(MOCK_PROJECT_ID);
    const callArg = (db.createXbotProject as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.userId).toBe(42);
    expect(callArg.robotMake).toBe("Unitree");
  });
});

describe("xbot.getProject", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns project and brief for valid sessionToken", async () => {
    const caller = appRouter.createCaller(createAnonContext());
    const result = await caller.xbot.getProject({
      projectId: MOCK_PROJECT_ID,
      sessionToken: MOCK_SESSION_TOKEN,
    });
    expect(result.project.id).toBe(MOCK_PROJECT_ID);
    expect(result.project.robotMake).toBe("Unitree");
    expect(result.brief).toBeNull();
  });

  it("throws FORBIDDEN if sessionToken does not match", async () => {
    const caller = appRouter.createCaller(createAnonContext());
    await expect(
      caller.xbot.getProject({ projectId: MOCK_PROJECT_ID, sessionToken: "wrong-token" })
    ).rejects.toThrow();
  });

  it("returns project for authenticated owner", async () => {
    (db.getXbotProject as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 1, sessionToken: MOCK_SESSION_TOKEN, userId: 42, robotMake: "Unitree", robotModel: "G1",
      status: "draft", createdAt: new Date(), updatedAt: new Date(), currentStep: 1,
      ataCarnet: false, customsBroker: "stagegate",
    });
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.xbot.getProject({ projectId: MOCK_PROJECT_ID });
    expect(result.project.userId).toBe(42);
  });

  it("throws NOT_FOUND if project does not exist", async () => {
    (db.getXbotProject as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(createAnonContext());
    await expect(
      caller.xbot.getProject({ projectId: 999, sessionToken: "any" })
    ).rejects.toThrow();
  });
});

describe("xbot.updateProject", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates project data for valid sessionToken", async () => {
    const caller = appRouter.createCaller(createAnonContext());
    const result = await caller.xbot.updateProject({
      projectId: MOCK_PROJECT_ID,
      sessionToken: MOCK_SESSION_TOKEN,
      data: { robotMake: "Boston Dynamics", robotModel: "Spot" },
    });
    expect(result.success).toBe(true);
    expect(db.updateXbotProject).toHaveBeenCalledOnce();
  });

  it("throws FORBIDDEN if sessionToken is wrong", async () => {
    const caller = appRouter.createCaller(createAnonContext());
    await expect(
      caller.xbot.updateProject({
        projectId: MOCK_PROJECT_ID,
        sessionToken: "bad-token",
        data: { robotMake: "Hacked" },
      })
    ).rejects.toThrow();
  });
});

describe("xbot.generateBrief", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates a brief and updates project status", async () => {
    const caller = appRouter.createCaller(createAnonContext());
    const result = await caller.xbot.generateBrief({
      projectId: MOCK_PROJECT_ID,
      sessionToken: MOCK_SESSION_TOKEN,
    });
    expect(result.brief).toBeDefined();
    expect(db.upsertXbotBrief).toHaveBeenCalledOnce();
    expect(db.updateXbotProject).toHaveBeenCalledWith(MOCK_PROJECT_ID, { status: "brief_generated" });
  });

  it("throws FORBIDDEN for wrong sessionToken", async () => {
    const caller = appRouter.createCaller(createAnonContext());
    await expect(
      caller.xbot.generateBrief({ projectId: MOCK_PROJECT_ID, sessionToken: "wrong" })
    ).rejects.toThrow();
  });
});

describe("xbot.submitServiceRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires authentication", async () => {
    const caller = appRouter.createCaller(createAnonContext());
    await expect(caller.xbot.submitServiceRequest({ projectId: MOCK_PROJECT_ID })).rejects.toThrow();
  });

  it("submits request for authenticated owner and notifies owner", async () => {
    (db.getXbotProject as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: MOCK_PROJECT_ID, sessionToken: MOCK_SESSION_TOKEN, userId: 42,
      robotMake: "Unitree", robotModel: "G1", status: "draft",
      selectedServices: ["warehouse"], contacts: { primary: { name: "Jane", email: "jane@u.com" } },
      originCity: "Shenzhen", originCountry: "China", shippingMethod: "air",
      createdAt: new Date(), updatedAt: new Date(), currentStep: 1,
      ataCarnet: false, customsBroker: "stagegate",
    });
    const { notifyOwner } = await import("./_core/notification");
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.xbot.submitServiceRequest({ projectId: MOCK_PROJECT_ID });
    expect(result.success).toBe(true);
    expect(db.updateXbotProject).toHaveBeenCalledWith(MOCK_PROJECT_ID, { status: "submitted" });
    expect(notifyOwner).toHaveBeenCalledOnce();
  });

  it("throws FORBIDDEN if authenticated user does not own project", async () => {
    (db.getXbotProject as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: MOCK_PROJECT_ID, sessionToken: MOCK_SESSION_TOKEN, userId: 99,
      robotMake: "Hacked", robotModel: "Bot", status: "draft",
      createdAt: new Date(), updatedAt: new Date(), currentStep: 1,
      ataCarnet: false, customsBroker: "stagegate",
    });
    const caller = appRouter.createCaller(createAuthContext());
    await expect(caller.xbot.submitServiceRequest({ projectId: MOCK_PROJECT_ID })).rejects.toThrow();
  });
});

describe("xbot.listProjects", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires authentication", async () => {
    const caller = appRouter.createCaller(createAnonContext());
    await expect(caller.xbot.listProjects()).rejects.toThrow();
  });

  it("returns projects for authenticated user", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.xbot.listProjects();
    expect(result.projects).toHaveLength(1);
    expect(db.listXbotProjectsByUser).toHaveBeenCalledWith(42);
  });
});

describe("xbot.adminList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires admin role", async () => {
    const caller = appRouter.createCaller(createAuthContext("user"));
    await expect(caller.xbot.adminList({})).rejects.toThrow();
  });

  it("returns all projects for admin", async () => {
    const caller = appRouter.createCaller(createAuthContext("admin"));
    const result = await caller.xbot.adminList({});
    expect(result.projects).toHaveLength(1);
    expect(db.listAllXbotProjects).toHaveBeenCalledOnce();
  });

  it("passes status filter to db when provided", async () => {
    const caller = appRouter.createCaller(createAuthContext("admin"));
    await caller.xbot.adminList({ status: "submitted" });
    expect(db.listAllXbotProjects).toHaveBeenCalledWith("submitted");
  });
});
