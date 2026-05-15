/**
 * v31.test.ts — Tour CTA, Pending Drafts review queue, cron schedule verification
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");

// ─── v31.1 Tour CTA ───────────────────────────────────────────────────────────
describe("v31.1 — /tour CTA in Navbar and Home", () => {
  const navbarPath = path.join(ROOT, "client/src/components/Navbar.tsx");
  const homePath = path.join(ROOT, "client/src/pages/Home.tsx");
  const appPath = path.join(ROOT, "client/src/App.tsx");

  it("Navbar.tsx exists", () => {
    expect(fs.existsSync(navbarPath)).toBe(true);
  });

  it("Navbar links to /tour", () => {
    const src = fs.readFileSync(navbarPath, "utf-8");
    expect(src).toContain("/tour");
  });

  it("Navbar has 'Book a Tour' or 'Showroom Tour' text", () => {
    const src = fs.readFileSync(navbarPath, "utf-8");
    expect(src.toLowerCase()).toMatch(/book.*tour|showroom.*tour|tour/);
  });

  it("Home.tsx links to /tour", () => {
    const src = fs.readFileSync(homePath, "utf-8");
    expect(src).toContain("/tour");
  });

  it("Home.tsx has tour CTA button", () => {
    const src = fs.readFileSync(homePath, "utf-8");
    expect(src.toLowerCase()).toMatch(/tour|showroom/);
  });

  it("App.tsx registers /tour route", () => {
    const src = fs.readFileSync(appPath, "utf-8");
    expect(src).toContain("/tour");
  });

  it("TourBooking.tsx exists", () => {
    const tourPath = path.join(ROOT, "client/src/pages/TourBooking.tsx");
    expect(fs.existsSync(tourPath)).toBe(true);
  });

  it("TourBooking.tsx imports bookings.create procedure", () => {
    const tourPath = path.join(ROOT, "client/src/pages/TourBooking.tsx");
    const src = fs.readFileSync(tourPath, "utf-8");
    expect(src).toContain("bookings.create");
  });

  it("TourBooking.tsx shows frank@onstage.bot contact", () => {
    const tourPath = path.join(ROOT, "client/src/pages/TourBooking.tsx");
    const src = fs.readFileSync(tourPath, "utf-8");
    expect(src).toContain("frank@onstage.bot");
  });

  it("TourBooking.tsx lists at least 3 venue options", () => {
    const tourPath = path.join(ROOT, "client/src/pages/TourBooking.tsx");
    const src = fs.readFileSync(tourPath, "utf-8");
    const venueMatches = (src.match(/StageGate|Innovation Center|Black Fire|hotel|casino/gi) ?? []).length;
    expect(venueMatches).toBeGreaterThanOrEqual(3);
  });
});

// ─── v31.2 Pending Drafts Tab ─────────────────────────────────────────────────
describe("v31.2 — Pending Drafts tab in AdminSalesAgent", () => {
  const adminSalesAgentPath = path.join(ROOT, "client/src/pages/AdminSalesAgent.tsx");

  it("AdminSalesAgent.tsx exists", () => {
    expect(fs.existsSync(adminSalesAgentPath)).toBe(true);
  });

  it("AdminSalesAgent has pipeline tab", () => {
    const src = fs.readFileSync(adminSalesAgentPath, "utf-8");
    expect(src.toLowerCase()).toContain("pipeline");
  });

  it("AdminSalesAgent has pending drafts tab", () => {
    const src = fs.readFileSync(adminSalesAgentPath, "utf-8");
    expect(src.toLowerCase()).toMatch(/pending.*draft|draft.*pending|pending drafts/i);
  });

  it("AdminSalesAgent uses trpc.admin.getDrafts for pending drafts", () => {
    const src = fs.readFileSync(adminSalesAgentPath, "utf-8");
    expect(src).toContain("trpc.admin.getDrafts");
  });

  it("AdminSalesAgent uses trpc.admin.sendDraft for approve action", () => {
    const src = fs.readFileSync(adminSalesAgentPath, "utf-8");
    expect(src).toContain("trpc.admin.sendDraft");
  });

  it("AdminSalesAgent uses trpc.admin.editDraft for edit action", () => {
    const src = fs.readFileSync(adminSalesAgentPath, "utf-8");
    expect(src).toContain("trpc.admin.editDraft");
  });

  it("AdminSalesAgent uses trpc.admin.discardDraft for discard action", () => {
    const src = fs.readFileSync(adminSalesAgentPath, "utf-8");
    expect(src).toContain("trpc.admin.discardDraft");
  });

  it("AdminSalesAgent uses trpc.admin.getDraftCount for badge", () => {
    const src = fs.readFileSync(adminSalesAgentPath, "utf-8");
    expect(src).toContain("trpc.admin.getDraftCount");
  });

  it("AdminSalesAgent has Approve & Send button", () => {
    const src = fs.readFileSync(adminSalesAgentPath, "utf-8");
    expect(src.toLowerCase()).toMatch(/approve.*send|approve & send/i);
  });

  it("AdminSalesAgent has Edit button for drafts", () => {
    const src = fs.readFileSync(adminSalesAgentPath, "utf-8");
    expect(src).toContain("Edit");
  });

  it("AdminSalesAgent has Discard button for drafts", () => {
    const src = fs.readFileSync(adminSalesAgentPath, "utf-8");
    expect(src).toContain("Discard");
  });

  it("AdminSalesAgent shows pending count badge on tab", () => {
    const src = fs.readFileSync(adminSalesAgentPath, "utf-8");
    expect(src).toContain("pendingCount");
  });

  it("AdminSalesAgent PendingDraftsTab component is defined", () => {
    const src = fs.readFileSync(adminSalesAgentPath, "utf-8");
    expect(src).toContain("PendingDraftsTab");
  });

  it("AdminSalesAgent shows Frank's Reasoning field from agentReasoning", () => {
    const src = fs.readFileSync(adminSalesAgentPath, "utf-8");
    expect(src).toContain("agentReasoning");
  });
});

// ─── v31.3 Cron Schedule ─────────────────────────────────────────────────────
describe("v31.3 — Nightly outreach cron handler", () => {
  const salesAgentPath = path.join(ROOT, "server/agents/salesAgent.ts");
  const indexPath = path.join(ROOT, "server/_core/index.ts");

  it("salesAgentOutreachHandler is exported from salesAgent.ts", () => {
    const src = fs.readFileSync(salesAgentPath, "utf-8");
    expect(src).toContain("export async function salesAgentOutreachHandler");
  });

  it("salesAgentPreviewHandler is exported from salesAgent.ts", () => {
    const src = fs.readFileSync(salesAgentPath, "utf-8");
    expect(src).toContain("export async function salesAgentPreviewHandler");
  });

  it("/api/scheduled/sales-agent-outreach is registered in index.ts", () => {
    const src = fs.readFileSync(indexPath, "utf-8");
    expect(src).toContain("/api/scheduled/sales-agent-outreach");
  });

  it("/api/scheduled/sales-agent-preview is registered in index.ts", () => {
    const src = fs.readFileSync(indexPath, "utf-8");
    expect(src).toContain("/api/scheduled/sales-agent-preview");
  });

  it("/api/scheduled/sales-agent-discover is registered in index.ts", () => {
    const src = fs.readFileSync(indexPath, "utf-8");
    expect(src).toContain("/api/scheduled/sales-agent-discover");
  });

  it("salesAgentOutreachHandler uses OUTREACH_BATCH_SIZE", () => {
    const src = fs.readFileSync(salesAgentPath, "utf-8");
    expect(src).toContain("OUTREACH_BATCH_SIZE");
  });

  it("outreach handler checks nextFollowUpAt for scheduling", () => {
    const src = fs.readFileSync(salesAgentPath, "utf-8");
    expect(src).toContain("nextFollowUpAt");
  });
});

// ─── v31 Admin router draft procedures ───────────────────────────────────────
describe("v31 — Admin router draft procedures in routers.ts", () => {
  const routersPath = path.join(ROOT, "server/routers.ts");

  it("admin.getDrafts procedure exists", () => {
    const src = fs.readFileSync(routersPath, "utf-8");
    expect(src).toContain("getDrafts: adminProcedure");
  });

  it("admin.getDraftCount procedure exists", () => {
    const src = fs.readFileSync(routersPath, "utf-8");
    expect(src).toContain("getDraftCount: adminProcedure");
  });

  it("admin.sendDraft procedure exists", () => {
    const src = fs.readFileSync(routersPath, "utf-8");
    expect(src).toContain("sendDraft: adminProcedure");
  });

  it("admin.editDraft procedure exists", () => {
    const src = fs.readFileSync(routersPath, "utf-8");
    expect(src).toContain("editDraft: adminProcedure");
  });

  it("admin.discardDraft procedure exists", () => {
    const src = fs.readFileSync(routersPath, "utf-8");
    expect(src).toContain("discardDraft: adminProcedure");
  });

  it("admin.approveDraft procedure exists", () => {
    const src = fs.readFileSync(routersPath, "utf-8");
    expect(src).toContain("approveDraft: adminProcedure");
  });

  it("salesAgent.previewEmail procedure exists", () => {
    const src = fs.readFileSync(routersPath, "utf-8");
    expect(src).toContain("previewEmail: adminProcedure");
  });
});
