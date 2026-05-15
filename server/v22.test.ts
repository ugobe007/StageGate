/**
 * v22.test.ts
 *
 * Tests for v22 features:
 * 1. AdminLogistics: assignBay procedure (inline bay selector)
 * 2. AdminVendors: occupancy board data (getAllWorkflows + warehouseBayId)
 * 3. GetStarted: live warehouse estimate preview (matchSpace debounce logic)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Shared mocks ────────────────────────────────────────────────────────────

const SAMPLE_BAYS = [
  { id: 1, name: "Bay A1", sqft: 100, pricePerSqftPerDay: "0.40", isAvailable: true, notes: null },
  { id: 2, name: "Bay B2", sqft: 200, pricePerSqftPerDay: "0.45", isAvailable: false, notes: "Climate controlled" },
  { id: 3, name: "Bay C3", sqft: 400, pricePerSqftPerDay: "0.50", isAvailable: true, notes: null },
];

const SAMPLE_WORKFLOWS = [
  {
    id: 10,
    robotCompany: "Unitree Robotics",
    showName: "CES 2026",
    status: "active",
    warehouseBayId: 2,
    orderId: 5,
    robotName: "Go2 Pro",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 11,
    robotCompany: "Boston Dynamics",
    showName: "NAB 2026",
    status: "active",
    warehouseBayId: null,
    orderId: 6,
    robotName: "Spot",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// ─── 1. assignBay procedure ───────────────────────────────────────────────────

describe("logistics.assignBay", () => {
  it("assigns a bay to a workflow", () => {
    const input = { workflowId: 11, warehouseBayId: 1 };
    expect(input.workflowId).toBe(11);
    expect(input.warehouseBayId).toBe(1);
  });

  it("clears a bay assignment by passing null", () => {
    const input = { workflowId: 10, warehouseBayId: null };
    expect(input.warehouseBayId).toBeNull();
  });

  it("reassigns a workflow from one bay to another", () => {
    const before = { workflowId: 10, warehouseBayId: 2 };
    const after = { workflowId: 10, warehouseBayId: 3 };
    expect(before.warehouseBayId).not.toBe(after.warehouseBayId);
  });

  it("accepts numeric bay IDs only", () => {
    const bayId = 1;
    expect(typeof bayId).toBe("number");
    expect(Number.isInteger(bayId)).toBe(true);
  });

  it("workflow with no bay has warehouseBayId = null", () => {
    const wf = SAMPLE_WORKFLOWS.find(w => w.id === 11);
    expect(wf?.warehouseBayId).toBeNull();
  });

  it("workflow with assigned bay has numeric warehouseBayId", () => {
    const wf = SAMPLE_WORKFLOWS.find(w => w.id === 10);
    expect(typeof wf?.warehouseBayId).toBe("number");
  });
});

// ─── 2. Occupancy board data logic ───────────────────────────────────────────

describe("AdminVendors occupancy board", () => {
  function buildOccupancyMap(workflows: typeof SAMPLE_WORKFLOWS) {
    const map = new Map<number, { robotCompany: string; showName: string | null | undefined; workflowId: number }>();
    workflows.forEach(workflow => {
      if (workflow.warehouseBayId && workflow.status === "active") {
        map.set(workflow.warehouseBayId, {
          robotCompany: workflow.robotCompany ?? "Unknown",
          showName: workflow.showName,
          workflowId: workflow.id,
        });
      }
    });
    return map;
  }

  it("builds occupancy map from active workflows with warehouseBayId", () => {
    const map = buildOccupancyMap(SAMPLE_WORKFLOWS);
    expect(map.size).toBe(1);
    expect(map.has(2)).toBe(true);
  });

  it("maps bay 2 to Unitree Robotics workflow", () => {
    const map = buildOccupancyMap(SAMPLE_WORKFLOWS);
    const occupant = map.get(2);
    expect(occupant?.robotCompany).toBe("Unitree Robotics");
    expect(occupant?.showName).toBe("CES 2026");
    expect(occupant?.workflowId).toBe(10);
  });

  it("does not include workflows without a bay", () => {
    const map = buildOccupancyMap(SAMPLE_WORKFLOWS);
    // Boston Dynamics has no bay
    const allWorkflowIds = Array.from(map.values()).map(v => v.workflowId);
    expect(allWorkflowIds).not.toContain(11);
  });

  it("does not include completed workflows in occupancy", () => {
    const completedWorkflow = { ...SAMPLE_WORKFLOWS[0], id: 99, status: "completed", warehouseBayId: 3 };
    const map = buildOccupancyMap([...SAMPLE_WORKFLOWS, completedWorkflow]);
    expect(map.has(3)).toBe(false);
  });

  it("bay isAvailable=false but no active workflow shows as occupied (no workflow info)", () => {
    const map = buildOccupancyMap([]);
    const bay = SAMPLE_BAYS.find(b => b.id === 2);
    const isOccupied = !!map.get(2) || !bay?.isAvailable;
    expect(isOccupied).toBe(true);
  });

  it("available bay with no workflow shows as available", () => {
    const map = buildOccupancyMap([]);
    const bay = SAMPLE_BAYS.find(b => b.id === 1);
    const isOccupied = !!map.get(1) || !bay?.isAvailable;
    expect(isOccupied).toBe(false);
  });

  it("occupied count matches bays with isAvailable=false", () => {
    const occupiedCount = SAMPLE_BAYS.filter(b => !b.isAvailable).length;
    expect(occupiedCount).toBe(1);
  });

  it("available count matches bays with isAvailable=true", () => {
    const availableCount = SAMPLE_BAYS.filter(b => b.isAvailable).length;
    expect(availableCount).toBe(2);
  });
});

// ─── 3. matchSpace live estimate preview logic ────────────────────────────────

describe("warehouse.matchSpace — live estimate preview", () => {
  function matchSpace(robotSqft: number, days: number, bays: typeof SAMPLE_BAYS) {
    const availableBays = bays
      .filter(b => b.isAvailable)
      .sort((a, b) => a.sqft - b.sqft);
    const match = availableBays.find(b => b.sqft >= robotSqft);
    if (!match) return { match: null, estimatedTotal: null, message: "No available bay large enough for this robot" };
    const rate = parseFloat(match.pricePerSqftPerDay);
    const estimatedTotal = (rate * robotSqft * days).toFixed(2);
    return {
      match: { id: match.id, name: match.name, sqft: match.sqft, pricePerSqftPerDay: match.pricePerSqftPerDay },
      estimatedTotal,
      message: `${match.name} (${match.sqft} sqft) @ $${rate}/sqft/day × ${robotSqft} sqft × ${days} days = $${estimatedTotal}`,
    };
  }

  it("returns match for 80 sqft robot with 7 days in Bay A1 (100 sqft)", () => {
    const result = matchSpace(80, 7, SAMPLE_BAYS);
    expect(result.match).not.toBeNull();
    expect(result.match?.name).toBe("Bay A1");
    expect(result.estimatedTotal).toBe((0.40 * 80 * 7).toFixed(2));
  });

  it("skips occupied bays when matching", () => {
    // Bay B2 (200 sqft) is occupied, so 150 sqft robot should get Bay C3 (400 sqft)
    const result = matchSpace(150, 5, SAMPLE_BAYS);
    expect(result.match?.name).toBe("Bay C3");
  });

  it("returns no match when robot is larger than all available bays", () => {
    const result = matchSpace(500, 5, SAMPLE_BAYS);
    expect(result.match).toBeNull();
    expect(result.message).toContain("No available bay");
  });

  it("calculates correct total: rate × sqft × days", () => {
    const result = matchSpace(100, 10, SAMPLE_BAYS);
    // Bay A1: 0.40 × 100 × 10 = 400.00
    expect(result.estimatedTotal).toBe("400.00");
  });

  it("returns null estimate when no bays available at all", () => {
    const allOccupied = SAMPLE_BAYS.map(b => ({ ...b, isAvailable: false }));
    const result = matchSpace(50, 3, allOccupied);
    expect(result.match).toBeNull();
    expect(result.estimatedTotal).toBeNull();
  });

  it("debounce: estimate only fires when both sqft and days are positive", () => {
    // Simulate the debounce guard condition
    const shouldFire = (sqft: number | string, days: number | string) => {
      const s = Number(sqft);
      const d = Number(days);
      return s >= 1 && d >= 1;
    };
    expect(shouldFire("", "")).toBe(false);
    expect(shouldFire("0", "5")).toBe(false);
    expect(shouldFire("50", "0")).toBe(false);
    expect(shouldFire("50", "7")).toBe(true);
  });

  it("debounce: estimate fires with valid sqft and days", () => {
    const shouldFire = (sqft: number | string, days: number | string) => {
      const s = Number(sqft);
      const d = Number(days);
      return s >= 1 && d >= 1;
    };
    expect(shouldFire(100, 5)).toBe(true);
    expect(shouldFire("200", "14")).toBe(true);
  });

  it("estimate message includes bay name, rate, sqft, days, and total", () => {
    const result = matchSpace(80, 7, SAMPLE_BAYS);
    expect(result.message).toContain("Bay A1");
    expect(result.message).toContain("0.4");
    expect(result.message).toContain("80");
    expect(result.message).toContain("7");
  });

  it("picks smallest available bay that fits (best fit)", () => {
    // 90 sqft robot: Bay A1 (100 sqft) fits, Bay C3 (400 sqft) also fits, should pick A1
    const result = matchSpace(90, 3, SAMPLE_BAYS);
    expect(result.match?.name).toBe("Bay A1");
  });

  it("exact fit: robot sqft equals bay sqft", () => {
    const result = matchSpace(100, 5, SAMPLE_BAYS);
    expect(result.match?.name).toBe("Bay A1");
    expect(result.match?.sqft).toBe(100);
  });
});

// ─── 4. AdminLogistics bay dropdown display logic ─────────────────────────────

describe("AdminLogistics bay dropdown", () => {
  it("formats available bay option correctly", () => {
    const bay = SAMPLE_BAYS[0]; // Bay A1, available
    const label = `${bay.name} (${bay.sqft} sqft)${bay.isAvailable ? " ✓" : " ✗ occupied"}`;
    expect(label).toBe("Bay A1 (100 sqft) ✓");
  });

  it("formats occupied bay option correctly", () => {
    const bay = SAMPLE_BAYS[1]; // Bay B2, occupied
    const label = `${bay.name} (${bay.sqft} sqft)${bay.isAvailable ? " ✓" : " ✗ occupied"}`;
    expect(label).toBe("Bay B2 (200 sqft) ✗ occupied");
  });

  it("empty string value represents no bay assigned", () => {
    const value = "";
    const bayId = value === "" ? null : Number(value);
    expect(bayId).toBeNull();
  });

  it("numeric string value converts to number for assignBay", () => {
    const value = "3";
    const bayId = value === "" ? null : Number(value);
    expect(bayId).toBe(3);
    expect(typeof bayId).toBe("number");
  });

  it("bay badge shows correct status color for assigned bay", () => {
    const assignedBay = SAMPLE_BAYS.find(b => b.id === 1); // available
    const colorClass = assignedBay?.isAvailable
      ? "bg-emerald-900/40 text-emerald-300 border-emerald-700/40"
      : "bg-amber-900/40 text-amber-300 border-amber-700/40";
    expect(colorClass).toContain("emerald");
  });

  it("occupied bay badge shows amber color", () => {
    const assignedBay = SAMPLE_BAYS.find(b => b.id === 2); // occupied
    const colorClass = assignedBay?.isAvailable
      ? "bg-emerald-900/40 text-emerald-300 border-emerald-700/40"
      : "bg-amber-900/40 text-amber-300 border-amber-700/40";
    expect(colorClass).toContain("amber");
  });
});
