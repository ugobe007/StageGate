/**
 * v30.test.ts
 *
 * Tests for v30 features:
 * 1. robotCategory field — schema, DB column, type definitions
 * 2. salesAgentPreviewHandler — exported, accepts prospectId + stage
 * 3. Hardware-aware breakpoints — heavy_industrial uses power/staging/crating
 * 4. /tour page — TourBooking component exists, has correct venue list
 * 5. salesAgent.previewEmail — tRPC procedure exists in router
 * 6. Discovery auto-classification — robotCategory in DiscoveredProspect type
 * 7. VENUES list — 4 venues, StageGate office is first and free
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

function readFile(rel: string) {
  return readFileSync(join(ROOT, rel), "utf-8");
}

// ─── 1. robotCategory in schema ───────────────────────────────────────────────
describe("v30.1 — robotCategory schema", () => {
  it("drizzle schema includes robotCategory column on prospects table", () => {
    const schema = readFile("drizzle/schema.ts");
    expect(schema).toContain("robotCategory");
  });

  it("robotCategory is a varchar column for flexibility", () => {
    const schema = readFile("drizzle/schema.ts");
    const idx = schema.indexOf("robotCategory");
    const snippet = schema.slice(idx, idx + 80);
    // varchar is the TiDB-compatible text column type used in this schema
    expect(snippet.toLowerCase()).toMatch(/varchar|text/);
  });

  it("prospects table definition includes robotCategory after robotType", () => {
    const schema = readFile("drizzle/schema.ts");
    const robotTypeIdx = schema.indexOf("robotType");
    const robotCategoryIdx = schema.indexOf("robotCategory");
    expect(robotCategoryIdx).toBeGreaterThan(robotTypeIdx);
  });
});

// ─── 2. salesAgentPreviewHandler export ───────────────────────────────────────
describe("v30.2 — salesAgentPreviewHandler", () => {
  it("salesAgent.ts exports salesAgentPreviewHandler", () => {
    const agent = readFile("server/agents/salesAgent.ts");
    expect(agent).toContain("export async function salesAgentPreviewHandler");
  });

  it("preview handler validates auth via BUILT_IN_FORGE_API_KEY", () => {
    const agent = readFile("server/agents/salesAgent.ts");
    const previewIdx = agent.indexOf("salesAgentPreviewHandler");
    const snippet = agent.slice(previewIdx, previewIdx + 400);
    expect(snippet).toContain("BUILT_IN_FORGE_API_KEY");
    expect(snippet).toContain("Forbidden");
  });

  it("preview handler calls generateFrankEmail and returns subject + body", () => {
    const agent = readFile("server/agents/salesAgent.ts");
    const previewIdx = agent.indexOf("export async function salesAgentPreviewHandler");
    const snippet = agent.slice(previewIdx, previewIdx + 1400);
    expect(snippet).toContain("generateFrankEmail");
    expect(snippet).toContain("subject");
    expect(snippet).toContain("body");
    expect(snippet).toContain("nextStage");
  });

  it("preview handler does NOT call sendFrankEmail (no actual send)", () => {
    const agent = readFile("server/agents/salesAgent.ts");
    const previewIdx = agent.indexOf("export async function salesAgentPreviewHandler");
    // The next export is generateFrankEmail (private function, no export) or the section comment
    // Use a fixed window of 900 chars which covers the full preview handler
    const snippet = agent.slice(previewIdx, previewIdx + 900);
    expect(snippet).not.toContain("sendFrankEmail");
    // Should not call Resend API directly
    expect(snippet).not.toContain("RESEND_API");
  });

  it("preview handler is registered at /api/scheduled/sales-agent-preview", () => {
    const index = readFile("server/_core/index.ts");
    expect(index).toContain("/api/scheduled/sales-agent-preview");
    expect(index).toContain("salesAgentPreviewHandler");
  });
});

// ─── 3. Hardware-aware breakpoints ────────────────────────────────────────────
describe("v30.3 — hardware-aware breakpoints", () => {
  it("pickBreakpoints accepts robotCategory as second argument", () => {
    const agent = readFile("server/agents/salesAgent.ts");
    expect(agent).toContain("function pickBreakpoints(robotType: string, robotCategory: string");
  });

  it("heavy_industrial category triggers power/staging/crating breakpoints", () => {
    const agent = readFile("server/agents/salesAgent.ts");
    const idx = agent.indexOf("isHeavy");
    const snippet = agent.slice(idx, idx + 300);
    expect(snippet).toContain("power");
    expect(snippet).toContain("staging");
    expect(snippet).toContain("crating");
  });

  it("mixed category also triggers heavy industrial breakpoints", () => {
    const agent = readFile("server/agents/salesAgent.ts");
    expect(agent).toContain("robotCategory === \"mixed\"");
  });

  it("generateFrankEmail passes robotCategory to pickBreakpoints", () => {
    const agent = readFile("server/agents/salesAgent.ts");
    expect(agent).toContain("pickBreakpoints(prospect.robotType");
    expect(agent).toContain("prospect.robotCategory");
  });

  it("DiscoveredProspect type includes robotCategory field", () => {
    const agent = readFile("server/agents/salesAgent.ts");
    const typeIdx = agent.indexOf("export interface DiscoveredProspect");
    const snippet = agent.slice(typeIdx, typeIdx + 300);
    expect(snippet).toContain("robotCategory");
  });
});

// ─── 4. salesAgent.previewEmail tRPC procedure ────────────────────────────────
describe("v30.4 — salesAgent.previewEmail tRPC procedure", () => {
  it("routers.ts defines salesAgent.previewEmail procedure", () => {
    const routers = readFile("server/routers.ts");
    expect(routers).toContain("previewEmail: adminProcedure");
  });

  it("previewEmail accepts prospectId (number) and optional stage", () => {
    const routers = readFile("server/routers.ts");
    const idx = routers.indexOf("previewEmail: adminProcedure");
    const snippet = routers.slice(idx, idx + 400);
    expect(snippet).toContain("prospectId: z.number()");
    expect(snippet).toContain("stage:");
    expect(snippet).toContain("optional()");
  });

  it("previewEmail calls the preview endpoint via internal fetch", () => {
    const routers = readFile("server/routers.ts");
    const idx = routers.indexOf("previewEmail: adminProcedure");
    const snippet = routers.slice(idx, idx + 1600);
    expect(snippet).toContain("sales-agent-preview");
    expect(snippet).toContain("fetch");
  });

  it("previewEmail returns subject, body, stage, nextStage", () => {
    const routers = readFile("server/routers.ts");
    const idx = routers.indexOf("previewEmail: adminProcedure");
    const snippet = routers.slice(idx, idx + 2000);
    expect(snippet).toContain("subject");
    expect(snippet).toContain("body");
    expect(snippet).toContain("nextStage");
  });
});

// ─── 5. /tour page ────────────────────────────────────────────────────────────
describe("v30.5 — /tour showroom booking page", () => {
  it("TourBooking.tsx exists", () => {
    const page = readFile("client/src/pages/TourBooking.tsx");
    expect(page).toBeTruthy();
  });

  it("TourBooking has 4 venue options", () => {
    const page = readFile("client/src/pages/TourBooking.tsx");
    expect(page).toContain("stagegate_office");
    expect(page).toContain("innovation_center");
    expect(page).toContain("black_fire");
    expect(page).toContain("hotel_casino");
  });

  it("StageGate office is listed as free for qualified companies", () => {
    const page = readFile("client/src/pages/TourBooking.tsx");
    expect(page).toContain("Free for qualified robot companies");
  });

  it("form submits via bookings.create tRPC procedure", () => {
    const page = readFile("client/src/pages/TourBooking.tsx");
    expect(page).toContain("trpc.bookings.create.useMutation");
  });

  it("success state shows frank@onstage.bot contact", () => {
    const page = readFile("client/src/pages/TourBooking.tsx");
    expect(page).toContain("frank@onstage.bot");
  });

  it("page includes robot type selector with heavy industrial option", () => {
    const page = readFile("client/src/pages/TourBooking.tsx");
    expect(page).toContain("Heavy Industrial");
    expect(page).toContain("Fanuc");
    expect(page).toContain("Yaskawa");
  });

  it("/tour route is registered in App.tsx", () => {
    const app = readFile("client/src/App.tsx");
    expect(app).toContain("/tour");
    expect(app).toContain("TourBooking");
  });
});

// ─── 6. AdminSalesAgent preview modal ─────────────────────────────────────────
describe("v30.6 — AdminSalesAgent preview modal", () => {
  it("AdminSalesAgent imports Dialog components", () => {
    const page = readFile("client/src/pages/AdminSalesAgent.tsx");
    expect(page).toContain("Dialog");
    expect(page).toContain("DialogContent");
  });

  it("AdminSalesAgent has Preview Frank's Email button", () => {
    const page = readFile("client/src/pages/AdminSalesAgent.tsx");
    expect(page).toContain("Preview Frank's Email");
  });

  it("PreviewEmailModal calls salesAgent.previewEmail mutation", () => {
    const page = readFile("client/src/pages/AdminSalesAgent.tsx");
    expect(page).toContain("trpc.salesAgent.previewEmail.useMutation");
  });

  it("PreviewEmailModal shows stage selector for 5 preview stages", () => {
    const page = readFile("client/src/pages/AdminSalesAgent.tsx");
    expect(page).toContain("PREVIEW_STAGES");
    expect(page).toContain("robot_guild");
  });

  it("robotCategoryBadge renders heavy_industrial badge with Factory icon", () => {
    const page = readFile("client/src/pages/AdminSalesAgent.tsx");
    expect(page).toContain("heavy_industrial");
    expect(page).toContain("Factory");
    expect(page).toContain("Heavy Industrial");
  });
});

// ─── 7. Discovery classification ──────────────────────────────────────────────
describe("v30.7 — discovery auto-classification", () => {
  it("salesAgentDiscovery.ts includes robotCategory in LLM schema", () => {
    const discovery = readFile("server/agents/salesAgentDiscovery.ts");
    expect(discovery).toContain("robotCategory");
  });

  it("ingest handler passes robotCategory to prospects insert", () => {
    const agent = readFile("server/agents/salesAgent.ts");
    const ingestIdx = agent.indexOf("salesAgentIngestHandler");
    const snippet = agent.slice(ingestIdx, ingestIdx + 2000);
    expect(snippet).toContain("robotCategory");
  });
});
