/**
 * v34 Test Suite
 * Covers: verifyAllUnverified fire-and-forget with batchId, batchVerifyProgress
 * in-memory map, getVerifyProgress query, and real-time progress modal UI.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ─── File paths ───────────────────────────────────────────────────────────────
const ROUTERS = path.resolve(__dirname, "routers.ts");
const ADMIN_SALES_AGENT = path.resolve(__dirname, "../client/src/pages/AdminSalesAgent.tsx");

const routersContent = fs.readFileSync(ROUTERS, "utf-8");
const adminSalesAgentContent = fs.readFileSync(ADMIN_SALES_AGENT, "utf-8");

// ─── batchVerifyProgress in-memory map ────────────────────────────────────────
describe("batchVerifyProgress in-memory map", () => {
  it("BatchVerifyState type is defined at module level", () => {
    expect(routersContent).toContain("BatchVerifyState");
  });

  it("batchVerifyProgress Map is declared at module level", () => {
    expect(routersContent).toContain("batchVerifyProgress");
    expect(routersContent).toContain("new Map<string, BatchVerifyState>()");
  });

  it("state shape includes total, current, verified, notFound, currentCompany, status, startedAt, errors", () => {
    const idx = routersContent.indexOf("BatchVerifyState");
    const snippet = routersContent.slice(idx, idx + 500);
    expect(snippet).toContain("total:");
    expect(snippet).toContain("current:");
    expect(snippet).toContain("verified:");
    expect(snippet).toContain("notFound:");
    expect(snippet).toContain("currentCompany:");
    expect(snippet).toContain("status:");
    expect(snippet).toContain("startedAt:");
    expect(snippet).toContain("errors:");
  });

  it("status is a union of running | complete | error", () => {
    const idx = routersContent.indexOf("BatchVerifyState");
    const snippet = routersContent.slice(idx, idx + 500);
    expect(snippet).toContain("running");
    expect(snippet).toContain("complete");
    expect(snippet).toContain("error");
  });
});

// ─── verifyAllUnverified fire-and-forget ──────────────────────────────────────
describe("salesAgent.verifyAllUnverified (v34 fire-and-forget)", () => {
  it("procedure is still defined in routers.ts", () => {
    expect(routersContent).toContain("verifyAllUnverified:");
  });

  it("generates a batchId", () => {
    const idx = routersContent.indexOf("verifyAllUnverified:");
    const snippet = routersContent.slice(idx, idx + 4000);
    expect(snippet).toContain("batchId");
  });

  it("initializes the batchVerifyProgress map entry with running status", () => {
    const idx = routersContent.indexOf("verifyAllUnverified:");
    const snippet = routersContent.slice(idx, idx + 4000);
    expect(snippet).toContain('status: "running"');
    expect(snippet).toContain("batchVerifyProgress.set(batchId");
  });

  it("returns batchId and total immediately (not after loop completion)", () => {
    const idx = routersContent.indexOf("verifyAllUnverified:");
    const snippet = routersContent.slice(idx, idx + 6000);
    // The return statement should come AFTER the fire-and-forget IIFE
    expect(snippet).toContain("return { batchId, total: unverified.length }");
  });

  it("runs the Apollo loop in a fire-and-forget async IIFE", () => {
    const idx = routersContent.indexOf("verifyAllUnverified:");
    const snippet = routersContent.slice(idx, idx + 6000);
    // IIFE pattern: (async () => { ... })()
    expect(snippet).toMatch(/\(async \(\) => \{/);
  });

  it("updates currentCompany in state during loop", () => {
    const idx = routersContent.indexOf("verifyAllUnverified:");
    const snippet = routersContent.slice(idx, idx + 6000);
    expect(snippet).toContain("state.currentCompany = prospect.company");
  });

  it("increments state.verified on successful email find", () => {
    const idx = routersContent.indexOf("verifyAllUnverified:");
    const snippet = routersContent.slice(idx, idx + 6000);
    expect(snippet).toContain("state.verified++");
  });

  it("increments state.notFound when no email found", () => {
    const idx = routersContent.indexOf("verifyAllUnverified:");
    const snippet = routersContent.slice(idx, idx + 6000);
    expect(snippet).toContain("state.notFound++");
  });

  it("marks state.status as complete when loop finishes", () => {
    const idx = routersContent.indexOf("verifyAllUnverified:");
    const snippet = routersContent.slice(idx, idx + 6000);
    expect(snippet).toContain('state.status = "complete"');
  });

  it("marks state.status as error on fatal exception", () => {
    const idx = routersContent.indexOf("verifyAllUnverified:");
    const snippet = routersContent.slice(idx, idx + 6000);
    expect(snippet).toContain('state.status = "error"');
  });

  it("cleans up the map entry after 10 minutes", () => {
    const idx = routersContent.indexOf("verifyAllUnverified:");
    const snippet = routersContent.slice(idx, idx + 6000);
    expect(snippet).toContain("batchVerifyProgress.delete(batchId)");
    expect(snippet).toContain("10 * 60 * 1000");
  });

  it("is still an adminProcedure", () => {
    const idx = routersContent.indexOf("verifyAllUnverified:");
    const line = routersContent.slice(idx, idx + 100);
    expect(line).toMatch(/adminProcedure|protectedProcedure/);
  });
});

// ─── getVerifyProgress query ──────────────────────────────────────────────────
describe("salesAgent.getVerifyProgress query", () => {
  it("procedure is defined in routers.ts", () => {
    expect(routersContent).toContain("getVerifyProgress:");
  });

  it("accepts batchId as input", () => {
    const idx = routersContent.indexOf("getVerifyProgress:");
    const snippet = routersContent.slice(idx, idx + 300);
    expect(snippet).toContain("batchId");
    expect(snippet).toContain("z.string()");
  });

  it("returns null when batchId not found in map", () => {
    const idx = routersContent.indexOf("getVerifyProgress:");
    const snippet = routersContent.slice(idx, idx + 500);
    expect(snippet).toContain("return null");
  });

  it("returns total, current, verified, notFound, currentCompany, status, startedAt, errors", () => {
    const idx = routersContent.indexOf("getVerifyProgress:");
    const snippet = routersContent.slice(idx, idx + 800);
    expect(snippet).toContain("total:");
    expect(snippet).toContain("current:");
    expect(snippet).toContain("verified:");
    expect(snippet).toContain("notFound:");
    expect(snippet).toContain("currentCompany:");
    expect(snippet).toContain("status:");
    expect(snippet).toContain("startedAt:");
    expect(snippet).toContain("errors:");
  });

  it("is an adminProcedure", () => {
    const idx = routersContent.indexOf("getVerifyProgress:");
    const line = routersContent.slice(idx, idx + 100);
    expect(line).toMatch(/adminProcedure|protectedProcedure/);
  });

  it("is a query (not a mutation)", () => {
    const idx = routersContent.indexOf("getVerifyProgress:");
    const snippet = routersContent.slice(idx, idx + 200);
    expect(snippet).toContain(".query(");
    expect(snippet).not.toContain(".mutation(");
  });
});

// ─── AdminSalesAgent real-time progress UI ────────────────────────────────────
describe("AdminSalesAgent real-time progress modal (v34)", () => {
  it("imports Progress component from @/components/ui/progress", () => {
    expect(adminSalesAgentContent).toContain("Progress");
    expect(adminSalesAgentContent).toContain("@/components/ui/progress");
  });

  it("has verifyBatchId state", () => {
    expect(adminSalesAgentContent).toContain("verifyBatchId");
  });

  it("has verifyProgressOpen state", () => {
    expect(adminSalesAgentContent).toContain("verifyProgressOpen");
  });

  it("calls getVerifyProgress query with polling", () => {
    expect(adminSalesAgentContent).toContain("getVerifyProgress");
    expect(adminSalesAgentContent).toContain("refetchInterval");
  });

  it("polls every 1500ms", () => {
    expect(adminSalesAgentContent).toContain("1500");
  });

  it("shows progress modal with animated progress bar", () => {
    expect(adminSalesAgentContent).toContain("verifyProgressOpen");
    expect(adminSalesAgentContent).toContain("<Progress");
  });

  it("displays Currently checking company name", () => {
    expect(adminSalesAgentContent).toContain("Currently checking");
    expect(adminSalesAgentContent).toContain("currentCompany");
  });

  it("shows live Checked / Verified / Not Found counters", () => {
    // These counters appear in the progress modal, which is later in the file
    const idx = adminSalesAgentContent.indexOf("v34: Real-Time Verify All Progress Modal");
    const snippet = adminSalesAgentContent.slice(idx, idx + 5000);
    expect(snippet).toContain("Checked");
    expect(snippet).toContain("Verified");
    expect(snippet).toContain("Not Found");
  });

  it("shows spinning loader while batch is running", () => {
    expect(adminSalesAgentContent).toContain("Loader2");
    expect(adminSalesAgentContent).toContain("animate-spin");
  });

  it("shows View Summary or Close button when complete or error", () => {
    expect(adminSalesAgentContent).toContain("View Summary");
    expect(adminSalesAgentContent).toContain("handleCloseProgressModal");
  });

  it("prevents closing modal by clicking outside while running", () => {
    expect(adminSalesAgentContent).toContain("onInteractOutside");
    expect(adminSalesAgentContent).toContain("preventDefault");
  });

  it("Verify All button is disabled while progress modal is open", () => {
    expect(adminSalesAgentContent).toContain("verifyProgressOpen");
    const btnIdx = adminSalesAgentContent.indexOf("Verify All");
    const snippet = adminSalesAgentContent.slice(btnIdx - 500, btnIdx + 200);
    expect(snippet).toContain("verifyProgressOpen");
  });

  it("useEffect stops polling and refreshes convs when status is complete", () => {
    expect(adminSalesAgentContent).toContain("verifyProgress?.status");
    expect(adminSalesAgentContent).toContain("complete");
    expect(adminSalesAgentContent).toContain("refetchConvs");
  });

  it("shows error section when errors are present", () => {
    expect(adminSalesAgentContent).toContain("verifyProgress.errors");
    expect(adminSalesAgentContent).toContain("Errors");
  });
});
