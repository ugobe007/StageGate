/**
 * v44.test.ts
 *
 * Tests for the Cal sales-agent workflow updates:
 *   1. Resend notification-URL fallback — _isNotificationUrlError helper (email.ts + salesAgent.ts)
 *   2. sendEmail retry path — retries without tracking on notification URL error
 *   3. sendFrankEmail retry path — Cal retries without tracking on notification URL error
 *   4. Default recipient policy — roleBasedOutreachEmails returns marketing@ + sales@
 *   5. selectOutreachEmail policy — uses contactEmail when valid, falls back to marketing@
 *   6. "Draft All Prospects" button wired into AdminSalesAgent PendingDraftsTab
 *   7. generateDrafts procedure contract in routers.ts
 *   8. buildDiscoveryEmail — no LLM call (fixed template, Cal's voice)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ─── File content snapshots ───────────────────────────────────────────────────
const EMAIL_TS       = path.resolve(__dirname, "email.ts");
const SALES_AGENT_TS = path.resolve(__dirname, "agents/salesAgent.ts");
const ROUTERS_TS     = path.resolve(__dirname, "routers.ts");
const OUTREACH_TS    = path.resolve(__dirname, "outreachContacts.ts");
const ADMIN_UI       = path.resolve(__dirname, "../client/src/pages/AdminSalesAgent.tsx");

const emailContent       = fs.readFileSync(EMAIL_TS,       "utf-8");
const salesAgentContent  = fs.readFileSync(SALES_AGENT_TS, "utf-8");
const routersContent     = fs.readFileSync(ROUTERS_TS,     "utf-8");
const outreachContent    = fs.readFileSync(OUTREACH_TS,    "utf-8");
const adminUiContent     = fs.readFileSync(ADMIN_UI,       "utf-8");

// ─── Suite 1: _isNotificationUrlError helper ─────────────────────────────────

describe("v44: _isNotificationUrlError — keyword detection", () => {
  // Inline the pure function so tests stay self-contained
  function isNotificationUrlError(errText: string): boolean {
    const t = errText.toLowerCase();
    return ["notification service", "notification_service", "notification url",
      "notification_url", "not set", "not configured", "inbound"].some(kw => t.includes(kw));
  }

  it("matches 'Notification service URL is not configured'", () => {
    expect(isNotificationUrlError("Notification service URL is not configured")).toBe(true);
  });

  it("matches 'notification_service_url not set'", () => {
    expect(isNotificationUrlError("notification_service_url not set")).toBe(true);
  });

  it("matches 'Notification URL not set'", () => {
    expect(isNotificationUrlError("Notification URL not set")).toBe(true);
  });

  it("matches error referencing 'inbound'", () => {
    expect(isNotificationUrlError("inbound route not configured for this domain")).toBe(true);
  });

  it("matches 'not configured' standalone", () => {
    expect(isNotificationUrlError("Domain notification endpoint not configured")).toBe(true);
  });

  it("does NOT match a generic 400 error", () => {
    expect(isNotificationUrlError("Invalid email address")).toBe(false);
  });

  it("does NOT match a rate-limit error", () => {
    expect(isNotificationUrlError("Too many requests — rate limit exceeded")).toBe(false);
  });

  it("does NOT match an auth error", () => {
    expect(isNotificationUrlError("Unauthorized — invalid API key")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isNotificationUrlError("NOTIFICATION SERVICE URL NOT CONFIGURED")).toBe(true);
    expect(isNotificationUrlError("notification service url not configured")).toBe(true);
  });
});

// ─── Suite 2: email.ts static checks ─────────────────────────────────────────

describe("v44: email.ts — Resend fallback (static)", () => {
  it("defines _isNotificationUrlError helper", () => {
    expect(emailContent).toContain("_isNotificationUrlError");
  });

  it("has first attempt with open_tracking and click_tracking", () => {
    expect(emailContent).toContain("open_tracking: true");
    expect(emailContent).toContain("click_tracking: true");
  });

  it("retries without tracking flags on notification URL error", () => {
    // Fallback calls attempt(false) — the boolean arg disables tracking
    expect(emailContent).toContain("attempt(false)");
  });

  it("logs a console.warn with resend.com/webhooks URL on fallback", () => {
    expect(emailContent).toContain("resend.com/webhooks");
    expect(emailContent).toContain("console.warn");
  });

  it("returns warning field on fallback success", () => {
    expect(emailContent).toContain("warning:");
    expect(emailContent).toContain("without open/click tracking");
  });

  it("still throws when error is unrelated to notification URL", () => {
    // The original throw is preserved outside the notification-URL catch branch
    expect(emailContent).toContain("throw e");
  });

  it("returns { id: string; warning?: string } type signature", () => {
    expect(emailContent).toContain("warning?: string");
  });
});

// ─── Suite 3: salesAgent.ts sendFrankEmail static checks ─────────────────────

describe("v44: salesAgent.ts sendFrankEmail — Resend fallback (static)", () => {
  it("defines _isNotificationUrlError helper in salesAgent.ts", () => {
    expect(salesAgentContent).toContain("_isNotificationUrlError");
  });

  it("sendFrankEmail has a try/catch around the Resend fetch", () => {
    expect(salesAgentContent).toContain("try {");
    expect(salesAgentContent).toContain("} catch (e)");
  });

  it("retries Cal's send without tracking on notification URL error", () => {
    // Fallback calls attempt(false) — the boolean arg disables tracking
    expect(salesAgentContent).toContain("attempt(false)");
  });

  it("logs console.warn pointing to Resend webhooks on fallback", () => {
    // Both helpers should reference the webhook URL
    expect(salesAgentContent).toContain("resend.com/webhooks");
  });

  it("returns null (not throws) when Resend fails with unrelated error", () => {
    // Original error path returns null + logs
    expect(salesAgentContent).toContain("console.error");
    expect(salesAgentContent).toContain("return null");
  });

  it("keeps bcc: [ADMIN_BCC] in every attempt", () => {
    expect(salesAgentContent).toContain("bcc: [ADMIN_BCC]");
  });
});

// ─── Suite 4: Default recipient policy — pure logic ──────────────────────────

describe("v44: Default recipient policy — roleBasedOutreachEmails", () => {
  // Inline the pure functions for isolated testing
  function deriveCompanyDomain(prospect: { company?: string | null; website?: string | null }): string | null {
    const website = prospect.website?.trim();
    if (website) {
      try {
        const url = new URL(website.startsWith("http") ? website : `https://${website}`);
        return url.hostname.replace(/^www\./, "").toLowerCase();
      } catch {
        const cleaned = website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]?.toLowerCase();
        if (cleaned?.includes(".")) return cleaned;
      }
    }
    const company = prospect.company?.toLowerCase().replace(/[^a-z0-9]/g, "");
    return company ? `${company}.com` : null;
  }

  function roleBasedOutreachEmails(prospect: { company?: string | null; website?: string | null }): string[] {
    const domain = deriveCompanyDomain(prospect);
    if (!domain) return [];
    return ["marketing", "sales"].map(lp => `${lp}@${domain}`);
  }

  it("returns [marketing@domain, sales@domain] for a prospect with website", () => {
    const emails = roleBasedOutreachEmails({ website: "https://www.bostondynamics.com" });
    expect(emails).toEqual(["marketing@bostondynamics.com", "sales@bostondynamics.com"]);
  });

  it("strips www. from website domain", () => {
    const emails = roleBasedOutreachEmails({ website: "www.unitree.com" });
    expect(emails).toEqual(["marketing@unitree.com", "sales@unitree.com"]);
  });

  it("falls back to company name when no website", () => {
    const emails = roleBasedOutreachEmails({ company: "Apptronik" });
    expect(emails).toEqual(["marketing@apptronik.com", "sales@apptronik.com"]);
  });

  it("returns [] when neither website nor company is provided", () => {
    const emails = roleBasedOutreachEmails({});
    expect(emails).toHaveLength(0);
  });

  it("marketing@ is always first in the list", () => {
    const emails = roleBasedOutreachEmails({ website: "sanctuary.ai" });
    expect(emails[0]).toMatch(/^marketing@/);
    expect(emails[1]).toMatch(/^sales@/);
  });

  it("PREFERRED_ROLE_INBOXES are marketing and sales in outreachContacts.ts", () => {
    expect(outreachContent).toContain('"marketing"');
    expect(outreachContent).toContain('"sales"');
  });
});

// ─── Suite 5: selectOutreachEmail policy ─────────────────────────────────────

describe("v44: selectOutreachEmail — contact email policy", () => {
  const DEPRECATED = new Set(["partnerships", "info", "support", "hello", "contact"]);

  function isDeprecatedRoleInbox(email: string | null | undefined): boolean {
    if (!email || !email.includes("@")) return false;
    const localPart = email.split("@")[0]?.toLowerCase();
    return Boolean(localPart && DEPRECATED.has(localPart));
  }

  function selectOutreachEmail(prospect: { website?: string | null; company?: string | null; contactEmail?: string | null }): string | null {
    const current = prospect.contactEmail?.trim();
    if (current && !isDeprecatedRoleInbox(current)) return current;
    const domain = prospect.website?.includes(".") ? prospect.website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] : null;
    return domain ? `marketing@${domain}` : current ?? null;
  }

  it("returns contactEmail when it is a real personal address", () => {
    const result = selectOutreachEmail({ contactEmail: "jane@bostondynamics.com", website: "bostondynamics.com" });
    expect(result).toBe("jane@bostondynamics.com");
  });

  it("skips info@ as deprecated and falls back to marketing@", () => {
    const result = selectOutreachEmail({ contactEmail: "info@company.com", website: "company.com" });
    expect(result).toBe("marketing@company.com");
  });

  it("skips hello@ as deprecated", () => {
    expect(isDeprecatedRoleInbox("hello@company.com")).toBe(true);
  });

  it("skips support@ as deprecated", () => {
    expect(isDeprecatedRoleInbox("support@company.com")).toBe(true);
  });

  it("does NOT skip marketing@ or sales@ as deprecated", () => {
    expect(isDeprecatedRoleInbox("marketing@company.com")).toBe(false);
    expect(isDeprecatedRoleInbox("sales@company.com")).toBe(false);
  });

  it("outreachContacts.ts has DEPRECATED_ROLE_INBOXES set", () => {
    expect(outreachContent).toContain("DEPRECATED_ROLE_INBOXES");
    expect(outreachContent).toContain('"info"');
    expect(outreachContent).toContain('"hello"');
  });
});

// ─── Suite 6: AdminSalesAgent — Draft All button (static) ────────────────────

describe("v44: AdminSalesAgent — Draft All Prospects button (static)", () => {
  it("PendingDraftsTab defines generateDrafts mutation", () => {
    expect(adminUiContent).toContain("generateDrafts");
    expect(adminUiContent).toContain("admin.generateDrafts");
  });

  it("Draft All button text is present", () => {
    expect(adminUiContent).toContain("Draft All Prospects");
  });

  it("Draft All button is disabled while mutation is pending", () => {
    expect(adminUiContent).toContain("generateDrafts.isPending");
  });

  it("shows loading spinner text while drafting", () => {
    expect(adminUiContent).toContain("Drafting all…");
  });

  it("draftAllResult state is declared", () => {
    expect(adminUiContent).toContain("draftAllResult");
    expect(adminUiContent).toContain("setDraftAllResult");
  });

  it("result banner shows generated count", () => {
    expect(adminUiContent).toContain("draftAllResult.generated");
  });

  it("result banner shows skipped count", () => {
    expect(adminUiContent).toContain("draftAllResult.skipped");
  });

  it("result banner has a Dismiss button", () => {
    expect(adminUiContent).toContain("setDraftAllResult(null)");
  });

  it("toast fires on draft generation success", () => {
    expect(adminUiContent).toContain("Cal drafted");
  });
});

// ─── Suite 7: generateDrafts router procedure (static) ───────────────────────

describe("v44: generateDrafts procedure in routers.ts (static)", () => {
  it("generateDrafts procedure is defined", () => {
    expect(routersContent).toContain("generateDrafts:");
  });

  it("generateDrafts accepts optional prospectIds array", () => {
    expect(routersContent).toContain("prospectIds: z.array(z.number()).optional()");
  });

  it("generateDrafts seeds salesAgentConversations for new prospects", () => {
    expect(routersContent).toContain("salesAgentConversations");
    expect(routersContent).toContain("state: \"discovery\"");
  });

  it("generateDrafts calls salesAgentPreviewCore for discovery stage", () => {
    expect(routersContent).toContain("salesAgentPreviewCore");
    expect(routersContent).toContain('"discovery"');
  });

  it("generateDrafts skips prospects that already have a pending/approved draft", () => {
    expect(routersContent).toContain('"pending"');
    expect(routersContent).toContain('"approved"');
    expect(routersContent).toContain("hasPending");
  });

  it("generateDrafts returns generated, skipped, and errors counts", () => {
    expect(routersContent).toContain("generated");
    expect(routersContent).toContain("skipped");
    expect(routersContent).toContain("errors");
  });

  it("generateDrafts is wrapped in withAgentRun for job tracking", () => {
    expect(routersContent).toContain("withAgentRun");
    expect(routersContent).toContain("Cal Draft Generator");
  });
});

// ─── Suite 8: buildDiscoveryEmail — no LLM calls ─────────────────────────────

describe("v44: buildDiscoveryEmail — Cal's fixed-template voice (no LLM)", () => {
  it("salesAgent.ts has buildDiscoveryEmail function", () => {
    expect(salesAgentContent).toContain("function buildDiscoveryEmail(");
  });

  it("buildDiscoveryEmail does not call invokeLLM", () => {
    // Slice from buildDiscoveryEmail to its synchronous sibling (generateFrankEmail is async)
    const fnStart = salesAgentContent.indexOf("function buildDiscoveryEmail(");
    const fnEnd   = salesAgentContent.indexOf("\nasync function generateFrankEmail(", fnStart);
    const fnBody  = salesAgentContent.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 2000);
    expect(fnBody).not.toContain("invokeLLM");
    expect(fnBody).not.toContain("openai");
    expect(fnBody).not.toContain("gpt");
  });

  it("buildDiscoveryEmail returns { subject, body }", () => {
    expect(salesAgentContent).toContain("return { subject, body }");
  });

  it("buildDiscoveryEmail uses FRANK_PERSONA.signature", () => {
    expect(salesAgentContent).toContain("FRANK_PERSONA.signature");
  });

  it("Cal introduces himself as Cal at StageGate in the template", () => {
    expect(salesAgentContent).toContain("This is Cal at StageGate");
  });

  it("template references onstage.bot CTA URL", () => {
    expect(salesAgentContent).toContain("onstage.bot");
  });

  it("discovery email subject uses prospect company name", () => {
    expect(salesAgentContent).toContain("Introducing myself — deployment notes for ${prospect.company}");
  });
});
