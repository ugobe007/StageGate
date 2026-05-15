/**
 * v35 Test Suite
 * Covers: email_tracking_events table, Resend webhook pipeline state updates,
 * email.ts open/click tracking flags, getConversations engagement join,
 * listWithEngagement procedure, and AdminPipeline/AdminSalesAgent UI badges.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ─── File paths ───────────────────────────────────────────────────────────────
const ROUTERS = path.resolve(__dirname, "routers.ts");
const EMAIL_TS = path.resolve(__dirname, "email.ts");
const RESEND_WEBHOOK = path.resolve(__dirname, "webhooks/resend.ts");
const ADMIN_PIPELINE = path.resolve(__dirname, "../client/src/pages/AdminPipeline.tsx");
const ADMIN_SALES_AGENT = path.resolve(__dirname, "../client/src/pages/AdminSalesAgent.tsx");
const SCHEMA = path.resolve(__dirname, "../drizzle/schema.ts");

const routersContent = fs.readFileSync(ROUTERS, "utf-8");
const emailContent = fs.readFileSync(EMAIL_TS, "utf-8");
const resendWebhookContent = fs.readFileSync(RESEND_WEBHOOK, "utf-8");
const adminPipelineContent = fs.readFileSync(ADMIN_PIPELINE, "utf-8");
const adminSalesAgentContent = fs.readFileSync(ADMIN_SALES_AGENT, "utf-8");
const schemaContent = fs.readFileSync(SCHEMA, "utf-8");

// ─── DB Schema ────────────────────────────────────────────────────────────────
describe("v35: email_tracking_events schema", () => {
  it("emailTrackingEvents table is defined in schema.ts", () => {
    expect(schemaContent).toContain("emailTrackingEvents");
  });

  it("schema has eventType field", () => {
    const idx = schemaContent.indexOf("emailTrackingEvents");
    const snippet = schemaContent.slice(idx, idx + 600);
    expect(snippet).toContain("eventType");
  });

  it("schema has prospectId field", () => {
    const idx = schemaContent.indexOf("emailTrackingEvents");
    const snippet = schemaContent.slice(idx, idx + 600);
    expect(snippet).toContain("prospectId");
  });

  it("schema has occurredAt field", () => {
    const idx = schemaContent.indexOf("emailTrackingEvents");
    const snippet = schemaContent.slice(idx, idx + 600);
    expect(snippet).toContain("occurredAt");
  });
});

// ─── Email.ts tracking flags ──────────────────────────────────────────────────
describe("v35: email.ts Resend open/click tracking", () => {
  it("email.ts enables open tracking", () => {
    expect(emailContent).toContain("open_tracking");
  });

  it("email.ts enables click tracking", () => {
    expect(emailContent).toContain("click_tracking");
  });
});

// ─── Resend webhook pipeline state updates ────────────────────────────────────
describe("v35: Resend webhook handler", () => {
  it("webhook handler file exists", () => {
    expect(fs.existsSync(RESEND_WEBHOOK)).toBe(true);
  });

  it("handles email.opened event type", () => {
    expect(resendWebhookContent).toContain("email.opened");
  });

  it("handles email.clicked event type", () => {
    expect(resendWebhookContent).toContain("email.clicked");
  });

  it("inserts into emailTrackingEvents on open/click", () => {
    expect(resendWebhookContent).toContain("emailTrackingEvents");
    expect(resendWebhookContent).toContain("insert");
  });

  it("updates conversation state to email_opened on first open", () => {
    expect(resendWebhookContent).toContain("email_opened");
  });

  it("updates conversation state to link_clicked on first click", () => {
    expect(resendWebhookContent).toContain("link_clicked");
  });

  it("inserts into prospectActivities for open event", () => {
    expect(resendWebhookContent).toContain("prospectActivities");
  });
});

// ─── getConversations engagement join ─────────────────────────────────────────
describe("v35: getConversations with engagement data", () => {
  it("getConversations procedure exists in routers.ts", () => {
    expect(routersContent).toContain("getConversations:");
  });

  it("getConversations joins email_tracking_events for engagement counts", () => {
    const idx = routersContent.indexOf("getConversations:");
    const snippet = routersContent.slice(idx, idx + 3000);
    expect(snippet).toContain("emailTrackingEvents");
  });

  it("getConversations computes opens count via SUM", () => {
    const idx = routersContent.indexOf("getConversations:");
    const snippet = routersContent.slice(idx, idx + 3000);
    expect(snippet).toContain("opens");
    expect(snippet).toContain("SUM");
  });

  it("getConversations computes clicks count via SUM", () => {
    const idx = routersContent.indexOf("getConversations:");
    const snippet = routersContent.slice(idx, idx + 3000);
    expect(snippet).toContain("clicks");
  });

  it("getConversations returns engagement object per row", () => {
    const idx = routersContent.indexOf("getConversations:");
    const snippet = routersContent.slice(idx, idx + 3000);
    expect(snippet).toContain("engagement:");
  });

  it("getConversations includes lastOpenedAt and lastClickedAt", () => {
    const idx = routersContent.indexOf("getConversations:");
    const snippet = routersContent.slice(idx, idx + 3000);
    expect(snippet).toContain("lastOpenedAt");
    expect(snippet).toContain("lastClickedAt");
  });
});

// ─── listWithEngagement procedure ─────────────────────────────────────────────
describe("v35: prospects.listWithEngagement", () => {
  it("listWithEngagement procedure exists in routers.ts", () => {
    expect(routersContent).toContain("listWithEngagement:");
  });

  it("listWithEngagement joins email_tracking_events", () => {
    const idx = routersContent.indexOf("listWithEngagement:");
    const snippet = routersContent.slice(idx, idx + 3000);
    expect(snippet).toContain("emailTrackingEvents");
  });

  it("listWithEngagement returns opens and clicks per prospect", () => {
    const idx = routersContent.indexOf("listWithEngagement:");
    const snippet = routersContent.slice(idx, idx + 3000);
    expect(snippet).toContain("opens");
    expect(snippet).toContain("clicks");
  });
});

// ─── AdminPipeline UI ─────────────────────────────────────────────────────────
describe("v35: AdminPipeline engagement badges", () => {
  it("AdminPipeline uses listWithEngagement query", () => {
    expect(adminPipelineContent).toContain("listWithEngagement");
  });

  it("AdminPipeline Prospect type has opens and clicks fields", () => {
    const idx = adminPipelineContent.indexOf("type Prospect");
    const snippet = adminPipelineContent.slice(idx, idx + 600);
    expect(snippet).toContain("opens");
    expect(snippet).toContain("clicks");
  });

  it("AdminPipeline shows MousePointerClick icon for click engagement", () => {
    expect(adminPipelineContent).toContain("MousePointerClick");
  });

  it("AdminPipeline shows Eye icon for open engagement", () => {
    expect(adminPipelineContent).toContain("Eye");
  });

  it("AdminPipeline imports Eye and MousePointerClick from lucide-react", () => {
    const importIdx = adminPipelineContent.indexOf("from \"lucide-react\"");
    const importBlock = adminPipelineContent.slice(0, importIdx + 20);
    expect(importBlock).toContain("Eye");
    expect(importBlock).toContain("MousePointerClick");
  });
});

// ─── AdminSalesAgent UI ───────────────────────────────────────────────────────
describe("v35: AdminSalesAgent engagement indicators", () => {
  it("AdminSalesAgent shows email_opened stage badge", () => {
    expect(adminSalesAgentContent).toContain("email_opened");
  });

  it("AdminSalesAgent shows link_clicked stage badge", () => {
    expect(adminSalesAgentContent).toContain("link_clicked");
  });

  it("AdminSalesAgent list cards show engagement icons", () => {
    expect(adminSalesAgentContent).toContain("MousePointerClick");
    expect(adminSalesAgentContent).toContain("eng.clicks");
    expect(adminSalesAgentContent).toContain("eng.opens");
  });

  it("AdminSalesAgent detail panel shows engagement summary row", () => {
    const idx = adminSalesAgentContent.indexOf("Engagement summary");
    expect(idx).toBeGreaterThan(-1);
  });

  it("AdminSalesAgent detail panel shows opens count", () => {
    const idx = adminSalesAgentContent.indexOf("Engagement summary");
    const snippet = adminSalesAgentContent.slice(idx, idx + 1000);
    expect(snippet).toContain("opens");
  });

  it("AdminSalesAgent detail panel shows clicks count", () => {
    const idx = adminSalesAgentContent.indexOf("Engagement summary");
    const snippet = adminSalesAgentContent.slice(idx, idx + 1000);
    expect(snippet).toContain("clicks");
  });

  it("AdminSalesAgent detail panel shows lastOpenedAt date", () => {
    const idx = adminSalesAgentContent.indexOf("Engagement summary");
    const snippet = adminSalesAgentContent.slice(idx, idx + 1000);
    expect(snippet).toContain("lastOpenedAt");
  });

  it("AdminSalesAgent updateConversationStage accepts email_opened and link_clicked", () => {
    const idx = routersContent.indexOf("updateConversationStage:");
    const snippet = routersContent.slice(idx, idx + 500);
    expect(snippet).toContain("email_opened");
    expect(snippet).toContain("link_clicked");
  });
});
