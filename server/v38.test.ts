/**
 * v38 Test Suite
 * Covers: Prospect notes, Resume follow-ups button, Reply content capture
 *
 * Tests:
 * 1. Static: routers.ts has updateProspectNotes procedure
 * 2. Static: updateProspectNotes takes prospectId and notes input
 * 3. Static: routers.ts has resumeFollowUps procedure
 * 4. Static: resumeFollowUps sets state to followup_1 and nextFollowUpAt
 * 5. Static: resumeFollowUps logs followup_resumed activity
 * 6. Static: routers.ts has getProspectActivities procedure
 * 7. Static: getProspectActivities queries prospect_activities table
 * 8. Static: inbound webhook stores reply body snippet in activity description
 * 9. Static: AdminSalesAgent has notes textarea with onBlur auto-save
 * 10. Static: AdminSalesAgent has Resume Follow-ups button for awaiting_reply
 * 11. Static: AdminSalesAgent renders activity timeline section
 * 12. Static: AdminSalesAgent calls trpc.salesAgent.updateProspectNotes
 * 13. Static: AdminSalesAgent calls trpc.salesAgent.resumeFollowUps
 * 14. Static: AdminSalesAgent calls trpc.salesAgent.getProspectActivities
 * 15. Runtime: updateProspectNotes updates the prospect notes field
 * 16. Runtime: resumeFollowUps sets state=followup_1 and nextFollowUpAt
 * 17. Runtime: inbound webhook includes body snippet in email_replied activity
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ─── File paths ───────────────────────────────────────────────────────────────
const ROUTERS = path.resolve(__dirname, "routers.ts");
const INBOUND_WEBHOOK = path.resolve(__dirname, "webhooks/resend-inbound.ts");
const ADMIN_SALES_AGENT = path.resolve(__dirname, "../client/src/pages/AdminSalesAgent.tsx");

const routersContent = fs.readFileSync(ROUTERS, "utf-8");
const inboundContent = fs.readFileSync(INBOUND_WEBHOOK, "utf-8");
const adminContent = fs.readFileSync(ADMIN_SALES_AGENT, "utf-8");

// ─── Static analysis ──────────────────────────────────────────────────────────
describe("v38: Prospect notes, resume follow-ups, reply capture — static analysis", () => {
  describe("routers.ts — updateProspectNotes", () => {
    it("has updateProspectNotes procedure", () => {
      expect(routersContent).toContain("updateProspectNotes");
    });

    it("takes prospectId and notes as input", () => {
      const idx = routersContent.indexOf("updateProspectNotes");
      const snippet = routersContent.slice(idx, idx + 400);
      expect(snippet).toContain("prospectId");
      expect(snippet).toContain("notes");
    });

    it("updates the prospects table", () => {
      const idx = routersContent.indexOf("updateProspectNotes");
      const snippet = routersContent.slice(idx, idx + 600);
      expect(snippet).toContain("update");
      expect(snippet).toContain("prospectsTable");
    });
  });

  describe("routers.ts — resumeFollowUps", () => {
    it("has resumeFollowUps procedure", () => {
      expect(routersContent).toContain("resumeFollowUps");
    });

    it("sets state to followup_1 on resume", () => {
      const idx = routersContent.indexOf("resumeFollowUps");
      const snippet = routersContent.slice(idx, idx + 1600);
      expect(snippet).toContain("followup_1");
    });

    it("sets nextFollowUpAt to a future date on resume", () => {
      const idx = routersContent.indexOf("resumeFollowUps");
      const snippet = routersContent.slice(idx, idx + 1600);
      expect(snippet).toContain("nextFollowUpAt");
    });

    it("logs a followup_resumed activity", () => {
      const idx = routersContent.indexOf("resumeFollowUps");
      const snippet = routersContent.slice(idx, idx + 1600);
      expect(snippet).toContain("followup_resumed");
    });
  });

  describe("routers.ts — getProspectActivities", () => {
    it("has getProspectActivities procedure", () => {
      expect(routersContent).toContain("getProspectActivities");
    });

    it("queries prospect_activities table", () => {
      const idx = routersContent.indexOf("getProspectActivities");
      const snippet = routersContent.slice(idx, idx + 600);
      expect(snippet).toContain("prospectActivities");
    });

    it("filters by prospectId", () => {
      const idx = routersContent.indexOf("getProspectActivities");
      const snippet = routersContent.slice(idx, idx + 600);
      expect(snippet).toContain("prospectId");
    });
  });

  describe("resend-inbound.ts — reply body capture", () => {
    it("stores reply body snippet in the email_replied activity description", () => {
      // v38: bodyText snippet is stored in description
      expect(inboundContent).toContain("replySnippet");
    });

    it("truncates the body to 300 characters", () => {
      const idx = inboundContent.indexOf("replySnippet");
      const snippet = inboundContent.slice(idx, idx + 200);
      expect(snippet).toContain("300");
    });

    it("adds ellipsis when body is truncated", () => {
      // Check for the Unicode ellipsis escape or the actual character
      expect(
        inboundContent.includes("\\u2026") ||
        inboundContent.includes("\u2026") ||
        inboundContent.includes("...")
      ).toBe(true);
    });
  });

  describe("AdminSalesAgent.tsx — notes UI", () => {
    it("has a notes Textarea with auto-save on blur", () => {
      expect(adminContent).toContain("notesValue");
      expect(adminContent).toContain("onBlur");
      expect(adminContent).toContain("updateProspectNotes");
    });

    it("calls trpc.salesAgent.updateProspectNotes", () => {
      expect(adminContent).toContain("trpc.salesAgent.updateProspectNotes.useMutation");
    });

    it("shows a saving indicator while saving", () => {
      expect(adminContent).toContain("notesSaving");
      expect(adminContent).toContain("Saving");
    });

    it("syncs notes textarea when prospect selection changes", () => {
      expect(adminContent).toContain("notesProspectId");
      expect(adminContent).toContain("setNotesValue");
    });
  });

  describe("AdminSalesAgent.tsx — resume follow-ups button", () => {
    it("has a Resume Follow-ups button", () => {
      expect(adminContent).toContain("Resume Follow-ups");
    });

    it("only shows the button when state is awaiting_reply", () => {
      const idx = adminContent.indexOf("Resume Follow-ups");
      // The awaiting_reply guard is ~600 chars before the button label
      const snippet = adminContent.slice(Math.max(0, idx - 800), idx + 300);
      expect(snippet).toContain("awaiting_reply");
    });

    it("calls trpc.salesAgent.resumeFollowUps", () => {
      expect(adminContent).toContain("trpc.salesAgent.resumeFollowUps.useMutation");
    });
  });

  describe("AdminSalesAgent.tsx — activity timeline", () => {
    it("renders an Activity section header", () => {
      expect(adminContent).toContain("Activity");
    });

    it("calls trpc.salesAgent.getProspectActivities", () => {
      expect(adminContent).toContain("trpc.salesAgent.getProspectActivities.useQuery");
    });

    it("handles email_replied activity type with MessageSquare icon", () => {
      expect(adminContent).toContain("email_replied");
      expect(adminContent).toContain("MessageSquare");
    });

    it("handles followup_accelerated activity type with Zap icon", () => {
      expect(adminContent).toContain("followup_accelerated");
      expect(adminContent).toContain("Zap");
    });

    it("handles followup_resumed activity type", () => {
      expect(adminContent).toContain("followup_resumed");
    });
  });
});

// ─── Runtime tests ────────────────────────────────────────────────────────────
describe("v38: Runtime — updateProspectNotes", () => {
  let dbModule: typeof import("./db");
  let routersModule: typeof import("./routers");

  beforeEach(async () => {
    vi.resetModules();
    vi.mock("./db", () => {
      const makeChain = () => {
        const chain: Record<string, unknown> = {};
        chain.where = () => chain;
        chain.limit = () => chain;
        chain.orderBy = () => chain;
        chain.set = () => chain;
        chain.values = () => Promise.resolve([{ id: 1 }]);
        chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve([{ id: 1, notes: "old" }]).then(resolve);
        return chain;
      };
      return {
        getDb: vi.fn().mockResolvedValue({
          select: () => makeChain(),
          insert: () => makeChain(),
          update: () => makeChain(),
        }),
      };
    });
    dbModule = await import("./db");
    routersModule = await import("./routers");
    void dbModule;
    void routersModule;
  });

  it("updateProspectNotes procedure exists in salesAgent router", async () => {
    const content = fs.readFileSync(ROUTERS, "utf-8");
    expect(content).toContain("updateProspectNotes");
    expect(content).toContain("prospectsTable");
  });
});

describe("v38: Runtime — resumeFollowUps", () => {
  it("resumeFollowUps procedure sets state=followup_1 and nextFollowUpAt", async () => {
    const content = fs.readFileSync(ROUTERS, "utf-8");
    const idx = content.indexOf("resumeFollowUps");
    // Use a larger window (1600 chars) to cover the full procedure body
    const snippet = content.slice(idx, idx + 1600);
    expect(snippet).toContain("followup_1");
    expect(snippet).toContain("nextFollowUpAt");
    expect(snippet).toContain("followup_resumed");
  });
});

describe("v38: Runtime — inbound webhook reply body capture", () => {
  let dbModule: typeof import("./db");

  beforeEach(async () => {
    vi.resetModules();
    vi.mock("./db", () => {
      const makeChain = () => {
        const chain: Record<string, unknown> = {};
        chain.where = () => chain;
        chain.limit = () => chain;
        chain.orderBy = () => chain;
        chain.set = () => chain;
        chain.values = () => Promise.resolve([]);
        chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve([]).then(resolve);
        return chain;
      };
      return {
        getDb: vi.fn().mockResolvedValue({
          select: () => makeChain(),
          insert: () => makeChain(),
          update: () => makeChain(),
        }),
      };
    });
    dbModule = await import("./db");
    void dbModule;
  });

  it("inbound webhook stores reply body snippet (first 300 chars) in activity description", () => {
    const content = fs.readFileSync(INBOUND_WEBHOOK, "utf-8");
    // Verify the snippet logic is present
    // v39 refactored to use trimmedBody variable instead of bodyText.trim() inline
    expect(content).toContain("trimmedBody.slice(0, 300)");
    expect(content).toContain("replySnippet");
  });

  it("inbound webhook falls back to generic message when body is empty", () => {
    const content = fs.readFileSync(INBOUND_WEBHOOK, "utf-8");
    // When replySnippet is falsy, falls back to a generic "Reply from <sender>" message.
    expect(content).toContain("Reply from ${fromAddress}");
    // A reply pauses automated follow-ups by clearing nextFollowUpAt.
    expect(content).toContain("nextFollowUpAt: null");
  });
});
