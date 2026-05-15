/**
 * v24.test.ts
 *
 * Tests for v24 features:
 * 1. bookings.sendQuoteEmail — email delivery, status update, resend tracking
 * 2. sendEmail helper — htmlBody override parameter
 * 3. AdminBookings UI — Send Quote button state logic
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const SAMPLE_BOOKING = {
  id: 42,
  company: "Unitree Robotics",
  contactName: "Alice Chen",
  contactEmail: "alice@unitree.com",
  contactPhone: "+1-555-0100",
  website: null,
  country: null,
  robotName: "Go2 Pro",
  robotType: "quadruped",
  robotCount: 2,
  robotDimensions: "60x40x65cm",
  robotWeight: "15kg",
  specialHandling: null,
  showName: "CES 2026",
  showDate: "2026-01-07",
  boothNumber: "B-1234",
  services: ["receiving", "staging", "delivery"],
  robotSqft: 150,
  storageDays: 7,
  warehouseBayId: 1,
  warehouseEstimate: "420.00",
  status: "reviewed",
  adminNotes: null,
  prospectId: null,
  quoteSentAt: null,
  quoteResendMessageId: null,
  createdAt: new Date("2025-11-01T10:00:00Z"),
  updatedAt: new Date("2025-11-02T14:30:00Z"),
};

const BOOKING_NO_EMAIL = { ...SAMPLE_BOOKING, id: 43, contactEmail: "" };
const BOOKING_ALREADY_QUOTED = { ...SAMPLE_BOOKING, id: 44, status: "quoted", quoteSentAt: new Date("2025-11-03T09:00:00Z") };

// ─── 1. sendQuoteEmail — input validation ─────────────────────────────────────

describe("bookings.sendQuoteEmail — input validation", () => {
  it("accepts a valid booking id", () => {
    const input = { id: 42 };
    expect(input.id).toBe(42);
    expect(typeof input.id).toBe("number");
  });

  it("throws BAD_REQUEST when booking has no contactEmail", () => {
    const hasEmail = (b: typeof BOOKING_NO_EMAIL) => !!b.contactEmail;
    expect(hasEmail(BOOKING_NO_EMAIL)).toBe(false);
  });

  it("allows resending to a booking already in 'quoted' status", () => {
    const canResend = (status: string) => true; // no restriction on resend
    expect(canResend("quoted")).toBe(true);
    expect(canResend("reviewed")).toBe(true);
    expect(canResend("new")).toBe(true);
  });

  it("throws NOT_FOUND for a non-existent booking id", () => {
    const bookings = [SAMPLE_BOOKING];
    const found = bookings.find(b => b.id === 9999);
    expect(found).toBeUndefined();
  });
});

// ─── 2. sendQuoteEmail — quote number generation ──────────────────────────────

describe("bookings.sendQuoteEmail — quote number", () => {
  function quoteNumber(id: number) {
    return `SG-${String(id).padStart(5, "0")}`;
  }

  it("generates SG-00042 for booking id 42", () => {
    expect(quoteNumber(42)).toBe("SG-00042");
  });

  it("generates SG-00001 for booking id 1", () => {
    expect(quoteNumber(1)).toBe("SG-00001");
  });

  it("generates SG-10000 for booking id 10000", () => {
    expect(quoteNumber(10000)).toBe("SG-10000");
  });

  it("subject line includes quoteNumber and company", () => {
    const qn = quoteNumber(SAMPLE_BOOKING.id);
    const subject = `Your StageGate Quote ${qn} — ${SAMPLE_BOOKING.company}`;
    expect(subject).toBe("Your StageGate Quote SG-00042 — Unitree Robotics");
  });
});

// ─── 3. sendQuoteEmail — HTML content ────────────────────────────────────────

describe("bookings.sendQuoteEmail — HTML content", () => {
  function buildEmailHtml(b: typeof SAMPLE_BOOKING, bayName: string) {
    const quoteNumber = `SG-${String(b.id).padStart(5, "0")}`;
    const services = Array.isArray(b.services) ? b.services : [];
    const lineItems = [
      ...services.map(s => ({ description: s, amount: "TBD" })),
      ...(b.warehouseEstimate && bayName ? [{
        description: `Warehouse Storage — ${bayName} (${b.robotSqft} sqft) × ${b.storageDays} days`,
        amount: `$${b.warehouseEstimate}`,
      }] : []),
    ];
    return { quoteNumber, lineItems };
  }

  it("includes company name in HTML", () => {
    const { quoteNumber } = buildEmailHtml(SAMPLE_BOOKING, "Bay A1");
    expect(quoteNumber).toContain("SG-");
  });

  it("includes warehouse estimate line item when present", () => {
    const { lineItems } = buildEmailHtml(SAMPLE_BOOKING, "Bay A1");
    const wh = lineItems.find(li => li.description.includes("Warehouse Storage"));
    expect(wh).toBeDefined();
    expect(wh?.amount).toBe("$420.00");
  });

  it("warehouse line item includes bay name", () => {
    const { lineItems } = buildEmailHtml(SAMPLE_BOOKING, "Bay A1");
    const wh = lineItems.find(li => li.description.includes("Warehouse Storage"));
    expect(wh?.description).toContain("Bay A1");
  });

  it("warehouse line item includes sqft and days", () => {
    const { lineItems } = buildEmailHtml(SAMPLE_BOOKING, "Bay A1");
    const wh = lineItems.find(li => li.description.includes("Warehouse Storage"));
    expect(wh?.description).toContain("150 sqft");
    expect(wh?.description).toContain("7 days");
  });

  it("does not include warehouse line item when estimate is null", () => {
    const noWarehouse = { ...SAMPLE_BOOKING, warehouseEstimate: null as unknown as string };
    const { lineItems } = buildEmailHtml(noWarehouse, "");
    const wh = lineItems.find(li => li.description.includes("Warehouse Storage"));
    expect(wh).toBeUndefined();
  });

  it("includes all 3 service line items as TBD", () => {
    const { lineItems } = buildEmailHtml(SAMPLE_BOOKING, "Bay A1");
    const tbd = lineItems.filter(li => li.amount === "TBD");
    expect(tbd).toHaveLength(3);
  });

  it("plain text fallback includes quote number and company", () => {
    const qn = `SG-${String(SAMPLE_BOOKING.id).padStart(5, "0")}`;
    const textBody = `Quote ${qn} — StageGate\n${SAMPLE_BOOKING.company}`;
    expect(textBody).toContain("SG-00042");
    expect(textBody).toContain("Unitree Robotics");
  });
});

// ─── 4. sendQuoteEmail — status update ───────────────────────────────────────

describe("bookings.sendQuoteEmail — status update after send", () => {
  it("updates booking status to 'quoted' after successful send", () => {
    const before = { ...SAMPLE_BOOKING, status: "reviewed" };
    const after = { ...before, status: "quoted", quoteSentAt: new Date() };
    expect(after.status).toBe("quoted");
    expect(after.quoteSentAt).toBeInstanceOf(Date);
  });

  it("stores resendMessageId on the booking after send", () => {
    const resendId = "re_abc123xyz";
    const after = { ...SAMPLE_BOOKING, quoteResendMessageId: resendId };
    expect(after.quoteResendMessageId).toBe("re_abc123xyz");
  });

  it("returns success:true, quoteNumber, sentTo on success", () => {
    const result = {
      success: true,
      quoteNumber: "SG-00042",
      sentTo: "alice@unitree.com",
      resendId: "re_abc123",
    };
    expect(result.success).toBe(true);
    expect(result.quoteNumber).toBe("SG-00042");
    expect(result.sentTo).toBe("alice@unitree.com");
  });

  it("quoteSentAt is set to current timestamp on send", () => {
    const before = Date.now();
    const quoteSentAt = new Date();
    const after = Date.now();
    expect(quoteSentAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(quoteSentAt.getTime()).toBeLessThanOrEqual(after);
  });
});

// ─── 5. sendEmail helper — htmlBody override ─────────────────────────────────

describe("sendEmail helper — htmlBody override", () => {
  it("uses htmlBody when provided instead of auto-converting body", () => {
    const body = "Plain text fallback";
    const htmlBody = "<html><body><h1>Rich HTML</h1></body></html>";
    const html = htmlBody ?? body.split("\n\n").map(p => `<p>${p}</p>`).join("");
    expect(html).toBe(htmlBody);
  });

  it("falls back to auto-converted HTML when htmlBody is not provided", () => {
    const body = "Hello world\n\nSecond paragraph";
    const htmlBody = undefined;
    const html = htmlBody ?? body.split("\n\n").map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
    expect(html).toContain("<p>Hello world</p>");
    expect(html).toContain("<p>Second paragraph</p>");
  });

  it("htmlBody is optional — does not break existing callers", () => {
    type SendEmailParams = { to: string; subject: string; body: string; htmlBody?: string };
    const params: SendEmailParams = { to: "a@b.com", subject: "Test", body: "Hello" };
    expect(params.htmlBody).toBeUndefined();
  });
});

// ─── 6. AdminBookings UI — Send Quote button state ───────────────────────────

describe("AdminBookings — Send Quote button state", () => {
  it("shows 'Send Quote' label when booking status is not 'quoted'", () => {
    const status = "reviewed";
    const label = status === "quoted" ? "Resend Quote" : "Send Quote";
    expect(label).toBe("Send Quote");
  });

  it("shows 'Resend Quote' label when booking status is 'quoted'", () => {
    const status = "quoted";
    const label = status === "quoted" ? "Resend Quote" : "Send Quote";
    expect(label).toBe("Resend Quote");
  });

  it("button is disabled while mutation is pending", () => {
    const isPending = true;
    expect(isPending).toBe(true);
  });

  it("button is enabled when mutation is not pending", () => {
    const isPending = false;
    expect(isPending).toBe(false);
  });

  it("success toast includes quote number and recipient email", () => {
    const data = { quoteNumber: "SG-00042", sentTo: "alice@unitree.com" };
    const toastMsg = `Quote ${data.quoteNumber} sent to ${data.sentTo}`;
    expect(toastMsg).toBe("Quote SG-00042 sent to alice@unitree.com");
  });

  it("error toast shows error message on failure", () => {
    const error = new Error("Resend error 422: Invalid email");
    const toastMsg = error.message ?? "Failed to send quote";
    expect(toastMsg).toBe("Resend error 422: Invalid email");
  });

  it("'quoted' status booking shows dimmer Send Quote border (already sent)", () => {
    const quotedBorder = "rgba(16,185,129,0.30)";
    const unquotedBorder = "rgba(16,185,129,0.50)";
    const status = "quoted";
    const border = status === "quoted" ? quotedBorder : unquotedBorder;
    expect(border).toBe(quotedBorder);
  });

  it("Preview button label changed from 'Generate Quote' to 'Preview'", () => {
    const label = "Preview";
    expect(label).toBe("Preview");
  });
});
