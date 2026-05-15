/**
 * v39 Test Suite
 * Covers: Expandable full reply body in activity timeline
 *
 * Tests:
 * 1. Static: inbound webhook stores full reply body in metadata.replyBody
 * 2. Static: inbound webhook uses trimmedBody variable (not bodyText.trim() twice)
 * 3. Static: inbound webhook still truncates description to 300 chars
 * 4. Static: AdminSalesAgent has expandedActivities state (Set<number>)
 * 5. Static: AdminSalesAgent has toggleActivityExpand function
 * 6. Static: AdminSalesAgent reads metadata.replyBody from activity
 * 7. Static: AdminSalesAgent renders "View full reply" toggle button
 * 8. Static: AdminSalesAgent renders "Collapse" toggle when expanded
 * 9. Static: AdminSalesAgent renders scrollable pre block for full body
 * 10. Static: AdminSalesAgent uses max-h-48 overflow-y-auto for the body container
 * 11. Static: expandable section is only shown for email_replied type
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const INBOUND_WEBHOOK = path.resolve(__dirname, "webhooks/resend-inbound.ts");
const ADMIN_SALES_AGENT = path.resolve(__dirname, "../client/src/pages/AdminSalesAgent.tsx");

const inboundContent = fs.readFileSync(INBOUND_WEBHOOK, "utf-8");
const adminContent = fs.readFileSync(ADMIN_SALES_AGENT, "utf-8");

describe("v39: Expandable full reply body — static analysis", () => {
  describe("resend-inbound.ts — full reply body in metadata", () => {
    it("stores full reply body in metadata.replyBody", () => {
      expect(inboundContent).toContain("replyBody");
      // Should be in the metadata object
      const idx = inboundContent.indexOf("metadata:");
      const snippet = inboundContent.slice(idx, idx + 200);
      expect(snippet).toContain("replyBody");
    });

    it("uses trimmedBody variable for both snippet and metadata", () => {
      expect(inboundContent).toContain("trimmedBody");
      // trimmedBody should be used for the 300-char slice
      expect(inboundContent).toContain("trimmedBody.slice(0, 300)");
      // trimmedBody should be stored in metadata.replyBody
      expect(inboundContent).toContain("replyBody: trimmedBody");
    });

    it("still truncates description to 300 characters", () => {
      expect(inboundContent).toContain("slice(0, 300)");
    });

    it("stores null in replyBody when body is empty", () => {
      const idx = inboundContent.indexOf("replyBody:");
      const snippet = inboundContent.slice(idx, idx + 60);
      expect(snippet).toContain("null");
    });
  });

  describe("AdminSalesAgent.tsx — expandable state", () => {
    it("has expandedActivities state as Set<number>", () => {
      expect(adminContent).toContain("expandedActivities");
      expect(adminContent).toContain("Set<number>");
    });

    it("has toggleActivityExpand function", () => {
      expect(adminContent).toContain("toggleActivityExpand");
    });

    it("toggles the activity id in the Set", () => {
      const idx = adminContent.indexOf("toggleActivityExpand");
      const snippet = adminContent.slice(idx, idx + 300);
      expect(snippet).toContain("next.has(id)");
      expect(snippet).toContain("next.delete(id)");
      expect(snippet).toContain("next.add(id)");
    });
  });

  describe("AdminSalesAgent.tsx — expandable UI", () => {
    it("reads metadata.replyBody from activity", () => {
      expect(adminContent).toContain("metadata?.replyBody");
    });

    it("renders 'View full reply' toggle button", () => {
      expect(adminContent).toContain("View full reply");
    });

    it("renders 'Collapse' toggle when expanded", () => {
      expect(adminContent).toContain("Collapse");
    });

    it("uses max-h-48 overflow-y-auto for the scrollable body container", () => {
      expect(adminContent).toContain("max-h-48");
      expect(adminContent).toContain("overflow-y-auto");
    });

    it("renders full body in a pre element with whitespace-pre-wrap", () => {
      expect(adminContent).toContain("whitespace-pre-wrap");
      expect(adminContent).toContain("break-words");
    });

    it("only shows the expandable section for email_replied type", () => {
      // fullReplyBody is only set when act.type === "email_replied"
      const idx = adminContent.indexOf("fullReplyBody");
      const snippet = adminContent.slice(idx, idx + 200);
      expect(snippet).toContain("email_replied");
    });

    it("calls toggleActivityExpand with the activity id on button click", () => {
      // Search from the onClick call site (not the definition)
      expect(adminContent).toContain("toggleActivityExpand(act.id)");
    });

    it("uses expandedActivities.has(act.id) to determine expanded state", () => {
      // isExpanded is set from expandedActivities.has(act.id)
      expect(adminContent).toContain("expandedActivities.has(act.id)");
    });
  });
});
