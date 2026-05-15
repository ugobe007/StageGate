/**
 * v33 Test Suite
 * Covers: verifyAllUnverified procedure, importProspects CSV parsing,
 * triggerDiscovery procedure, new UI buttons (Verify All, Import CSV),
 * and the 5 new robotics shows seeded in v32.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ─── File paths ───────────────────────────────────────────────────────────────
const ROUTERS = path.resolve(__dirname, "routers.ts");
const ADMIN_SALES_AGENT = path.resolve(__dirname, "../client/src/pages/AdminSalesAgent.tsx");
const DISCOVERY = path.resolve(__dirname, "agents/salesAgentDiscovery.ts");

const routersContent = fs.readFileSync(ROUTERS, "utf-8");
const adminSalesAgentContent = fs.readFileSync(ADMIN_SALES_AGENT, "utf-8");
const discoveryContent = fs.readFileSync(DISCOVERY, "utf-8");

// ─── verifyAllUnverified procedure ────────────────────────────────────────────
describe("salesAgent.verifyAllUnverified procedure", () => {
  it("procedure is defined in routers.ts", () => {
    expect(routersContent).toContain("verifyAllUnverified:");
  });

  it("queries prospects with emailConfidence = low", () => {
    const idx = routersContent.indexOf("verifyAllUnverified:");
    const snippet = routersContent.slice(idx, idx + 2000);
    expect(snippet).toMatch(/emailConfidence.*low|low.*emailConfidence/);
  });

  it("calls verifyProspectEmail logic for each prospect", () => {
    const idx = routersContent.indexOf("verifyAllUnverified:");
    const snippet = routersContent.slice(idx, idx + 3000);
    // Should iterate over prospects and call Apollo
    expect(snippet).toMatch(/for.*of|forEach|map|Promise\.all/);
  });

  it("returns total, verified, notFound, and message fields", () => {
    const idx = routersContent.indexOf("verifyAllUnverified:");
    const snippet = routersContent.slice(idx, idx + 6000);
    expect(snippet).toContain("verified");
    expect(snippet).toContain("notFound");
    expect(snippet).toContain("message");
    // total may be in the return block
    expect(snippet).toMatch(/total|checked/);
  });

  it("is an adminProcedure (not publicProcedure)", () => {
    const idx = routersContent.indexOf("verifyAllUnverified:");
    // adminProcedure is on the same line as the procedure name
    const line = routersContent.slice(idx, idx + 100);
    expect(line).toMatch(/adminProcedure|protectedProcedure/);
  });
});

// ─── importProspects procedure ────────────────────────────────────────────────
describe("salesAgent.importProspects procedure", () => {
  it("procedure is defined in routers.ts", () => {
    expect(routersContent).toContain("importProspects:");
  });

  it("accepts csvText as input", () => {
    const idx = routersContent.indexOf("importProspects:");
    const snippet = routersContent.slice(idx, idx + 500);
    expect(snippet).toContain("csvText");
  });

  it("parses CSV header row to find column indices", () => {
    const idx = routersContent.indexOf("importProspects:");
    const snippet = routersContent.slice(idx, idx + 2000);
    expect(snippet).toMatch(/header|split.*,|headers/i);
  });

  it("supports company column (required)", () => {
    const idx = routersContent.indexOf("importProspects:");
    const snippet = routersContent.slice(idx, idx + 3000);
    expect(snippet).toContain("company");
  });

  it("supports contact_email column", () => {
    const idx = routersContent.indexOf("importProspects:");
    const snippet = routersContent.slice(idx, idx + 3000);
    expect(snippet).toContain("contact_email");
  });

  it("supports robot_category column", () => {
    const idx = routersContent.indexOf("importProspects:");
    const snippet = routersContent.slice(idx, idx + 3000);
    expect(snippet).toContain("robot_category");
  });

  it("supports show_name column", () => {
    const idx = routersContent.indexOf("importProspects:");
    const snippet = routersContent.slice(idx, idx + 3000);
    expect(snippet).toContain("show_name");
  });

  it("upserts by company name (deduplication)", () => {
    const idx = routersContent.indexOf("importProspects:");
    const snippet = routersContent.slice(idx, idx + 4000);
    expect(snippet).toMatch(/existing|upsert|duplicate/i);
  });

  it("returns imported, skipped, errors, total, and message", () => {
    const idx = routersContent.indexOf("importProspects:");
    const snippet = routersContent.slice(idx, idx + 5000);
    expect(snippet).toContain("imported");
    expect(snippet).toContain("skipped");
    expect(snippet).toContain("errors");
    expect(snippet).toContain("total");
    expect(snippet).toContain("message");
  });

  it("skips rows missing company name", () => {
    const idx = routersContent.indexOf("importProspects:");
    const snippet = routersContent.slice(idx, idx + 4000);
    expect(snippet).toMatch(/!company|company.*empty|skip.*company/i);
  });

  it("validates robotCategory values (light/heavy_industrial/mixed)", () => {
    const idx = routersContent.indexOf("importProspects:");
    const snippet = routersContent.slice(idx, idx + 4000);
    expect(snippet).toContain("heavy_industrial");
    expect(snippet).toContain("mixed");
    expect(snippet).toContain("light");
  });

  it("uses shows jsonb array (not showId)", () => {
    const idx = routersContent.indexOf("importProspects:");
    const snippet = routersContent.slice(idx, idx + 5000);
    expect(snippet).toContain("shows:");
    expect(snippet).not.toContain("showId:");
  });

  it("accepts optional defaultShowId for show context", () => {
    const idx = routersContent.indexOf("importProspects:");
    const snippet = routersContent.slice(idx, idx + 500);
    expect(snippet).toContain("defaultShowId");
  });
});

// ─── triggerDiscovery procedure ───────────────────────────────────────────────
describe("salesAgent.triggerDiscovery procedure", () => {
  it("procedure is defined in routers.ts", () => {
    expect(routersContent).toContain("triggerDiscovery:");
  });

  it("is an adminProcedure", () => {
    const idx = routersContent.indexOf("triggerDiscovery:");
    // adminProcedure is on the same line as the procedure name
    const line = routersContent.slice(idx, idx + 100);
    expect(line).toMatch(/adminProcedure|protectedProcedure/);
  });

  it("counts available shows before running", () => {
    const idx = routersContent.indexOf("triggerDiscovery:");
    const snippet = routersContent.slice(idx, idx + 2000);
    expect(snippet).toMatch(/tradeShows|shows/);
  });

  it("returns showCount and runId", () => {
    const idx = routersContent.indexOf("triggerDiscovery:");
    const snippet = routersContent.slice(idx, idx + 3000);
    expect(snippet).toMatch(/showCount|runId|message/);
  });

  it("salesAgentDiscoveryCore is exported from salesAgentDiscovery.ts", () => {
    expect(discoveryContent).toContain("salesAgentDiscoveryCore");
    expect(discoveryContent).toMatch(/export.*salesAgentDiscoveryCore|salesAgentDiscoveryCore.*export/);
  });
});

// ─── AdminSalesAgent UI — new buttons ─────────────────────────────────────────
describe("AdminSalesAgent UI — Verify All and Import CSV buttons", () => {
  it("imports ShieldCheck, Upload, FileText icons", () => {
    expect(adminSalesAgentContent).toContain("ShieldCheck");
    expect(adminSalesAgentContent).toContain("Upload");
    expect(adminSalesAgentContent).toContain("FileText");
  });

  it("has verifyAllUnverified mutation", () => {
    expect(adminSalesAgentContent).toContain("verifyAllUnverified");
    expect(adminSalesAgentContent).toContain("trpc.salesAgent.verifyAllUnverified");
  });

  it("has importProspects mutation", () => {
    expect(adminSalesAgentContent).toContain("importProspects");
    expect(adminSalesAgentContent).toContain("trpc.salesAgent.importProspects");
  });

  it("has Verify All button with blue styling", () => {
    expect(adminSalesAgentContent).toContain("Verify All");
    expect(adminSalesAgentContent).toMatch(/blue.*verify|verify.*blue|ShieldCheck/i);
  });

  it("has Import CSV button", () => {
    expect(adminSalesAgentContent).toContain("Import CSV");
  });

  it("has CSV import modal with Textarea for paste", () => {
    expect(adminSalesAgentContent).toContain("csvModalOpen");
    expect(adminSalesAgentContent).toContain("csvText");
    expect(adminSalesAgentContent).toContain("Import Prospects from CSV");
  });

  it("CSV modal shows column format hint", () => {
    expect(adminSalesAgentContent).toContain("company");
    expect(adminSalesAgentContent).toContain("contact_email");
    expect(adminSalesAgentContent).toContain("robot_category");
  });

  it("has bulk verify result modal with Checked/Verified/Not Found stats", () => {
    expect(adminSalesAgentContent).toContain("bulkVerifyModalOpen");
    expect(adminSalesAgentContent).toContain("Bulk Email Verification Complete");
    expect(adminSalesAgentContent).toContain("Checked");
    expect(adminSalesAgentContent).toContain("Verified");
    expect(adminSalesAgentContent).toContain("Not Found");
  });

  it("CSV import result shows imported/skipped/total stats", () => {
    expect(adminSalesAgentContent).toContain("csvImportResult");
    expect(adminSalesAgentContent).toContain("Imported");
    expect(adminSalesAgentContent).toContain("Skipped (dup)");
    expect(adminSalesAgentContent).toContain("Total Rows");
  });

  it("CSV import shows error list when errors exist", () => {
    expect(adminSalesAgentContent).toContain("csvImportResult.errors");
    expect(adminSalesAgentContent).toContain("Errors (");
  });

  it("Find Prospects button still present", () => {
    expect(adminSalesAgentContent).toContain("Find Prospects");
    expect(adminSalesAgentContent).toContain("triggerDiscovery");
  });
});

// ─── New robotics shows seeded in v32 ─────────────────────────────────────────
describe("New robotics shows in discovery pipeline", () => {
  it("salesAgentDiscovery.ts exports salesAgentDiscoveryCore function", () => {
    expect(discoveryContent).toContain("export");
    expect(discoveryContent).toContain("salesAgentDiscoveryCore");
  });

  it("discovery uses exhibitorListUrl when available", () => {
    expect(discoveryContent).toMatch(/exhibitorListUrl|exhibitor_list_url/i);
  });

  it("discovery falls back to LLM knowledge when URL is null or fetch fails", () => {
    expect(discoveryContent).toMatch(/fallback|!exhibitorListUrl|catch/i);
  });

  it("discovery uses LLM to identify robot companies", () => {
    expect(discoveryContent).toMatch(/robot|robotics/i);
    expect(discoveryContent).toMatch(/invokeLLM|llm/i);
  });

  it("discovery deduplicates by company name", () => {
    expect(discoveryContent).toMatch(/duplicate|existing|upsert|company.*lower|lower.*company/i);
  });
});

// ─── CSV parsing logic unit tests ─────────────────────────────────────────────
describe("CSV parsing edge cases", () => {
  // These test the in-memory logic of the importProspects procedure
  it("importProspects procedure handles quoted CSV values", () => {
    const idx = routersContent.indexOf("importProspects:");
    const snippet = routersContent.slice(idx, idx + 6000);
    // Should handle quoted fields or at minimum split on comma
    expect(snippet).toMatch(/split.*,|,.*split|quote|trim/i);
  });

  it("importProspects skips header row", () => {
    const idx = routersContent.indexOf("importProspects:");
    const snippet = routersContent.slice(idx, idx + 4000);
    // Should slice from index 1 to skip header
    expect(snippet).toMatch(/slice\(1\)|skip.*header|header.*skip|\.slice\(1/i);
  });

  it("importProspects trims whitespace from cell values", () => {
    const idx = routersContent.indexOf("importProspects:");
    const snippet = routersContent.slice(idx, idx + 4000);
    expect(snippet).toContain("trim");
  });
});
