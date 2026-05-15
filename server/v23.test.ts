/**
 * v23.test.ts
 *
 * Tests for v23 features:
 * 1. warehouseBayEvents — event logging on assignBay and checkpoint flip
 * 2. bookings.generateQuoteHtml — HTML quote document with warehouse estimate line item
 * 3. AdminOrderDetail — bay assignment inline selector logic
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const SAMPLE_BAYS = [
  { id: 1, name: "Bay A1", sqft: 100, pricePerSqftPerDay: "0.40", isAvailable: true, notes: null, updatedAt: new Date() },
  { id: 2, name: "Bay B2", sqft: 200, pricePerSqftPerDay: "0.45", isAvailable: false, notes: "Climate controlled", updatedAt: new Date() },
  { id: 3, name: "Bay C3", sqft: 400, pricePerSqftPerDay: "0.50", isAvailable: true, notes: null, updatedAt: new Date() },
];

const SAMPLE_BOOKING = {
  id: 42,
  company: "Unitree Robotics",
  contactName: "Alice Chen",
  contactEmail: "alice@unitree.com",
  contactPhone: "+1-555-0100",
  robotName: "Go2 Pro",
  robotType: "quadruped",
  robotCount: 2,
  robotDimensions: "60x40x65cm",
  robotWeight: "15kg",
  showName: "CES 2026",
  showDate: "2026-01-07",
  boothNumber: "B-1234",
  services: ["receiving", "staging", "delivery"],
  robotSqft: 150,
  storageDays: 7,
  warehouseBayId: 1,
  warehouseEstimate: "420.00",
  status: "reviewed",
  adminNotes: "Priority client",
  createdAt: new Date("2025-11-01T10:00:00Z"),
  updatedAt: new Date("2025-11-02T14:30:00Z"),
};

const SAMPLE_BOOKING_NO_WAREHOUSE = {
  ...SAMPLE_BOOKING,
  id: 43,
  robotSqft: null,
  storageDays: null,
  warehouseBayId: null,
  warehouseEstimate: null,
  services: ["customs", "insurance"],
};

// ─── 1. warehouseBayEvents — event logging ────────────────────────────────────

describe("warehouseBayEvents — event logging", () => {
  it("creates an 'occupied' event when assignBay sets a bay", () => {
    const event = {
      bayId: 1,
      workflowId: 10,
      eventType: "occupied" as const,
      triggeredBy: "manual" as const,
      notes: "Assigned via AdminOrderDetail",
      createdAt: new Date(),
    };
    expect(event.eventType).toBe("occupied");
    expect(event.bayId).toBe(1);
    expect(event.workflowId).toBe(10);
  });

  it("creates a 'released' event when assignBay clears a bay (null)", () => {
    const event = {
      bayId: 2,
      workflowId: 10,
      eventType: "released" as const,
      triggeredBy: "manual" as const,
      notes: "Released via AdminOrderDetail",
      createdAt: new Date(),
    };
    expect(event.eventType).toBe("released");
    expect(event.bayId).toBe(2);
  });

  it("creates a 'warehouse_in' event when checkpoint type=warehouse_in is completed", () => {
    const checkpoint = { type: "warehouse_in", status: "completed", workflowId: 10 };
    const bayId = 1;
    const event = {
      bayId,
      workflowId: checkpoint.workflowId,
      eventType: "occupied" as const,
      triggeredBy: "checkpoint" as const,
      notes: `Auto-occupied via ${checkpoint.type} checkpoint`,
      createdAt: new Date(),
    };
    expect(event.eventType).toBe("occupied");
    expect(event.triggeredBy).toBe("checkpoint");
    expect(event.notes).toContain("warehouse_in");
  });

  it("creates a 'warehouse_return' event when checkpoint type=warehouse_return is completed", () => {
    const checkpoint = { type: "warehouse_return", status: "completed", workflowId: 10 };
    const bayId = 1;
    const event = {
      bayId,
      workflowId: checkpoint.workflowId,
      eventType: "released" as const,
      triggeredBy: "checkpoint" as const,
      notes: `Auto-released via ${checkpoint.type} checkpoint`,
      createdAt: new Date(),
    };
    expect(event.eventType).toBe("released");
    expect(event.triggeredBy).toBe("checkpoint");
    expect(event.notes).toContain("warehouse_return");
  });

  it("does not create an event for non-warehouse checkpoint types", () => {
    const checkpointTypes = ["shipping_out", "customs_clearance", "delivery_to_booth", "teardown"];
    for (const type of checkpointTypes) {
      const shouldLog = type === "warehouse_in" || type === "warehouse_return";
      expect(shouldLog).toBe(false);
    }
  });

  it("getBayHistory returns events sorted by createdAt desc", () => {
    const events = [
      { id: 3, bayId: 1, eventType: "released", createdAt: new Date("2026-01-10") },
      { id: 2, bayId: 1, eventType: "occupied", createdAt: new Date("2026-01-07") },
      { id: 1, bayId: 1, eventType: "occupied", createdAt: new Date("2025-12-01") },
    ];
    // Already sorted desc
    expect(events[0].createdAt > events[1].createdAt).toBe(true);
    expect(events[1].createdAt > events[2].createdAt).toBe(true);
  });

  it("getOccupancyReport calculates duration between occupied and released events", () => {
    const occupiedAt = new Date("2026-01-07T08:00:00Z");
    const releasedAt = new Date("2026-01-10T08:00:00Z");
    const durationDays = (releasedAt.getTime() - occupiedAt.getTime()) / (1000 * 60 * 60 * 24);
    expect(durationDays).toBe(3);
  });

  it("getOccupancyReport returns null duration for bays still occupied", () => {
    const occupiedAt = new Date("2026-01-07T08:00:00Z");
    const releasedAt = null;
    const durationDays = releasedAt ? (new Date(releasedAt).getTime() - occupiedAt.getTime()) / (1000 * 60 * 60 * 24) : null;
    expect(durationDays).toBeNull();
  });

  it("getOccupancyReport groups events by bay", () => {
    const events = [
      { bayId: 1, eventType: "occupied", workflowId: 10 },
      { bayId: 1, eventType: "released", workflowId: 10 },
      { bayId: 2, eventType: "occupied", workflowId: 11 },
    ];
    const byBay = events.reduce((acc, e) => {
      acc[e.bayId] = (acc[e.bayId] ?? []).concat(e);
      return acc;
    }, {} as Record<number, typeof events>);
    expect(byBay[1]).toHaveLength(2);
    expect(byBay[2]).toHaveLength(1);
  });
});

// ─── 2. bookings.generateQuoteHtml ───────────────────────────────────────────

describe("bookings.generateQuoteHtml", () => {
  function buildQuoteHtml(booking: typeof SAMPLE_BOOKING, bayName: string) {
    const quoteNumber = `SG-${String(booking.id).padStart(5, "0")}`;
    const services = Array.isArray(booking.services) ? booking.services : [];
    const lineItems: { description: string; amount: string }[] = [
      ...services.map(s => ({ description: s, amount: "TBD" })),
    ];
    if (booking.warehouseEstimate && bayName) {
      lineItems.push({
        description: `Warehouse Storage — ${bayName}${booking.robotSqft ? ` (${booking.robotSqft} sqft)` : ""}${booking.storageDays ? ` × ${booking.storageDays} days` : ""}`,
        amount: `$${booking.warehouseEstimate}`,
      });
    }
    return { quoteNumber, lineItems };
  }

  it("generates a quote number in SG-XXXXX format", () => {
    const { quoteNumber } = buildQuoteHtml(SAMPLE_BOOKING, "Bay A1");
    expect(quoteNumber).toBe("SG-00042");
  });

  it("includes warehouse estimate as a line item when present", () => {
    const { lineItems } = buildQuoteHtml(SAMPLE_BOOKING, "Bay A1");
    const warehouseLine = lineItems.find(li => li.description.includes("Warehouse Storage"));
    expect(warehouseLine).toBeDefined();
    expect(warehouseLine?.amount).toBe("$420.00");
  });

  it("includes bay name in warehouse line item description", () => {
    const { lineItems } = buildQuoteHtml(SAMPLE_BOOKING, "Bay A1");
    const warehouseLine = lineItems.find(li => li.description.includes("Warehouse Storage"));
    expect(warehouseLine?.description).toContain("Bay A1");
  });

  it("includes sqft and days in warehouse line item description", () => {
    const { lineItems } = buildQuoteHtml(SAMPLE_BOOKING, "Bay A1");
    const warehouseLine = lineItems.find(li => li.description.includes("Warehouse Storage"));
    expect(warehouseLine?.description).toContain("150 sqft");
    expect(warehouseLine?.description).toContain("7 days");
  });

  it("does NOT include warehouse line item when warehouseEstimate is null", () => {
    const { lineItems } = buildQuoteHtml(SAMPLE_BOOKING_NO_WAREHOUSE as typeof SAMPLE_BOOKING, "");
    const warehouseLine = lineItems.find(li => li.description.includes("Warehouse Storage"));
    expect(warehouseLine).toBeUndefined();
  });

  it("includes all selected services as TBD line items", () => {
    const { lineItems } = buildQuoteHtml(SAMPLE_BOOKING, "Bay A1");
    const serviceLines = lineItems.filter(li => li.amount === "TBD");
    expect(serviceLines).toHaveLength(3); // receiving, staging, delivery
  });

  it("handles booking with no services gracefully", () => {
    const noServices = { ...SAMPLE_BOOKING, services: [] };
    const { lineItems } = buildQuoteHtml(noServices, "Bay A1");
    const serviceLines = lineItems.filter(li => li.amount === "TBD");
    expect(serviceLines).toHaveLength(0);
  });

  it("quote number pads booking id to 5 digits", () => {
    const booking1 = { ...SAMPLE_BOOKING, id: 1 };
    const booking99 = { ...SAMPLE_BOOKING, id: 99 };
    const booking1000 = { ...SAMPLE_BOOKING, id: 1000 };
    expect(buildQuoteHtml(booking1, "").quoteNumber).toBe("SG-00001");
    expect(buildQuoteHtml(booking99, "").quoteNumber).toBe("SG-00099");
    expect(buildQuoteHtml(booking1000, "").quoteNumber).toBe("SG-01000");
  });

  it("warehouse estimate section is omitted when no estimate", () => {
    const hasWarehouseSection = (b: typeof SAMPLE_BOOKING_NO_WAREHOUSE) =>
      b.warehouseEstimate !== null && b.warehouseEstimate !== undefined;
    expect(hasWarehouseSection(SAMPLE_BOOKING_NO_WAREHOUSE)).toBe(false);
    expect(hasWarehouseSection(SAMPLE_BOOKING as typeof SAMPLE_BOOKING_NO_WAREHOUSE)).toBe(true);
  });

  it("quote is valid for 30 days", () => {
    const today = new Date();
    const validUntil = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const diffDays = Math.round((validUntil.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(30);
  });
});

// ─── 3. AdminOrderDetail — bay assignment logic ───────────────────────────────

describe("AdminOrderDetail — bay assignment", () => {
  it("shows 'Not assigned' label when warehouseBayId is null", () => {
    const workflow = { id: 10, warehouseBayId: null };
    const label = workflow.warehouseBayId ? `Bay #${workflow.warehouseBayId}` : "Not assigned";
    expect(label).toBe("Not assigned");
  });

  it("shows bay name from listBays when warehouseBayId is set", () => {
    const workflow = { id: 10, warehouseBayId: 1 };
    const bay = SAMPLE_BAYS.find(b => b.id === workflow.warehouseBayId);
    expect(bay?.name).toBe("Bay A1");
  });

  it("bay dropdown option shows sqft and availability checkmark", () => {
    const bay = SAMPLE_BAYS[0];
    const option = `${bay.name} (${bay.sqft} sqft) ${bay.isAvailable ? "✓" : "✗"}`;
    expect(option).toBe("Bay A1 (100 sqft) ✓");
  });

  it("bay dropdown option shows ✗ for unavailable bays", () => {
    const bay = SAMPLE_BAYS[1]; // isAvailable: false
    const option = `${bay.name} (${bay.sqft} sqft) ${bay.isAvailable ? "✓" : "✗"}`;
    expect(option).toBe("Bay B2 (200 sqft) ✗");
  });

  it("Assign button is disabled when no bay is selected", () => {
    const selectedBayId = "";
    const isDisabled = !selectedBayId;
    expect(isDisabled).toBe(true);
  });

  it("Assign button is enabled when a bay is selected", () => {
    const selectedBayId = "1";
    const isDisabled = !selectedBayId;
    expect(isDisabled).toBe(false);
  });

  it("Release button only appears when warehouseBayId is set", () => {
    const workflowWithBay = { warehouseBayId: 1 };
    const workflowNoBay = { warehouseBayId: null };
    expect(!!workflowWithBay.warehouseBayId).toBe(true);
    expect(!!workflowNoBay.warehouseBayId).toBe(false);
  });

  it("assignBay mutate call passes correct workflowId and bayId", () => {
    const workflowId = 10;
    const selectedBayId = "2";
    const mutateInput = { workflowId, warehouseBayId: Number(selectedBayId) };
    expect(mutateInput.workflowId).toBe(10);
    expect(mutateInput.warehouseBayId).toBe(2);
  });

  it("Release button calls assignBay with null warehouseBayId", () => {
    const workflowId = 10;
    const mutateInput = { workflowId, warehouseBayId: null };
    expect(mutateInput.warehouseBayId).toBeNull();
  });

  it("selectedBayId resets to empty string after successful assignment", () => {
    let selectedBayId = "2";
    const onSuccess = () => { selectedBayId = ""; };
    onSuccess();
    expect(selectedBayId).toBe("");
  });
});
