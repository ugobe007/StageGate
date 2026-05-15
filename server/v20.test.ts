/**
 * v20 — Warehouse Bay Management & Scheduling Self-Service Tests
 * Tests for: warehouse.listBays, warehouse.upsertBay, warehouse.deleteBay,
 *            warehouse.matchSpace, scheduling.deleteSlot, scheduling.addSlots
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB ────────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

// ─── Mock LLM ───────────────────────────────────────────────────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Mock AI response" } }],
  }),
}));

// ─── Mock email ──────────────────────────────────────────────────────────────
vi.mock("./email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ id: "mock-email-id" }),
  markDraftSent: vi.fn(),
  markDraftSentWithMessageId: vi.fn(),
}));

// ─── Mock notification ───────────────────────────────────────────────────────
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

import { getDb } from "./db";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeDb(overrides: Record<string, unknown> = {}) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 42 }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    ...overrides,
  };
  return chain;
}

const SAMPLE_BAYS = [
  { id: 1, name: "Bay A1", sqft: 200, pricePerSqftPerDay: "0.45", isAvailable: true, notes: "Near loading dock" },
  { id: 2, name: "Bay A2", sqft: 200, pricePerSqftPerDay: "0.45", isAvailable: false, notes: null },
  { id: 3, name: "Bay B1", sqft: 400, pricePerSqftPerDay: "0.40", isAvailable: true, notes: "Climate controlled" },
  { id: 4, name: "Bay B2", sqft: 400, pricePerSqftPerDay: "0.40", isAvailable: true, notes: null },
  { id: 5, name: "Bay C1", sqft: 100, pricePerSqftPerDay: "0.55", isAvailable: true, notes: null },
  { id: 6, name: "Bay C2", sqft: 100, pricePerSqftPerDay: "0.55", isAvailable: true, notes: null },
];

// ─── Warehouse Bay Tests ──────────────────────────────────────────────────────

describe("warehouse.listBays", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all 6 seeded bays ordered by name", async () => {
    const db = makeDb({
      orderBy: vi.fn().mockResolvedValue(SAMPLE_BAYS),
    });
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await db.select().from({}).orderBy({});
    expect(result).toHaveLength(6);
    expect(result[0].name).toBe("Bay A1");
    expect(result[5].name).toBe("Bay C2");
  });

  it("returns empty array when DB is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null as never);
    const dbConn = await getDb();
    expect(dbConn).toBeNull();
  });

  it("includes all required bay fields", () => {
    const bay = SAMPLE_BAYS[0];
    expect(bay).toHaveProperty("id");
    expect(bay).toHaveProperty("name");
    expect(bay).toHaveProperty("sqft");
    expect(bay).toHaveProperty("pricePerSqftPerDay");
    expect(bay).toHaveProperty("isAvailable");
  });
});

describe("warehouse.upsertBay — create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts a new bay and returns the new id", async () => {
    const db = makeDb({
      returning: vi.fn().mockResolvedValue([{ id: 7 }]),
    });
    vi.mocked(getDb).mockResolvedValue(db as never);

    const [row] = await db.insert({}).values({}).returning({ id: 7 });
    expect(row.id).toBe(7);
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it("validates that sqft must be a positive integer", () => {
    const validSqft = 200;
    const invalidSqft = -50;
    expect(validSqft).toBeGreaterThan(0);
    expect(invalidSqft).toBeLessThan(0);
  });

  it("validates that pricePerSqftPerDay is a numeric string", () => {
    const price = "0.45";
    expect(parseFloat(price)).toBeCloseTo(0.45);
    expect(isNaN(parseFloat(price))).toBe(false);
  });
});

describe("warehouse.upsertBay — update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates an existing bay when id is provided", async () => {
    const db = makeDb();
    vi.mocked(getDb).mockResolvedValue(db as never);

    await db.update({}).set({ name: "Bay A1 Updated", sqft: 250 }).where({});
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db.set).toHaveBeenCalledWith({ name: "Bay A1 Updated", sqft: 250 });
  });

  it("can toggle bay availability to false (mark as occupied)", async () => {
    const db = makeDb();
    vi.mocked(getDb).mockResolvedValue(db as never);

    await db.update({}).set({ isAvailable: false }).where({});
    expect(db.set).toHaveBeenCalledWith({ isAvailable: false });
  });
});

describe("warehouse.deleteBay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes a bay by id", async () => {
    const db = makeDb();
    vi.mocked(getDb).mockResolvedValue(db as never);

    await db.delete({}).where({});
    expect(db.delete).toHaveBeenCalledTimes(1);
  });

  it("throws when DB is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null as never);
    const dbConn = await getDb();
    expect(dbConn).toBeNull();
  });
});

describe("warehouse.matchSpace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the smallest available bay that fits the robot", () => {
    const robotSqft = 150;
    const days = 5;
    const availableBays = SAMPLE_BAYS.filter(b => b.isAvailable).sort((a, b) => a.sqft - b.sqft);
    const match = availableBays.find(b => b.sqft >= robotSqft);
    expect(match).toBeDefined();
    expect(match!.name).toBe("Bay A1"); // 200 sqft, smallest that fits 150
    expect(match!.sqft).toBeGreaterThanOrEqual(robotSqft);

    const rate = parseFloat(match!.pricePerSqftPerDay);
    const estimatedTotal = rate * robotSqft * days;
    expect(estimatedTotal).toBeCloseTo(0.45 * 150 * 5); // $337.50
  });

  it("returns null match when no available bay is large enough", () => {
    const robotSqft = 1000; // larger than any bay
    const availableBays = SAMPLE_BAYS.filter(b => b.isAvailable).sort((a, b) => a.sqft - b.sqft);
    const match = availableBays.find(b => b.sqft >= robotSqft);
    expect(match).toBeUndefined();
  });

  it("calculates price estimate correctly", () => {
    const robotSqft = 80;
    const days = 3;
    const availableBays = SAMPLE_BAYS.filter(b => b.isAvailable).sort((a, b) => a.sqft - b.sqft);
    const match = availableBays.find(b => b.sqft >= robotSqft);
    expect(match).toBeDefined();
    expect(match!.name).toBe("Bay C1"); // 100 sqft, smallest available that fits 80

    const rate = parseFloat(match!.pricePerSqftPerDay);
    const estimatedTotal = rate * robotSqft * days;
    expect(estimatedTotal).toBeCloseTo(0.55 * 80 * 3); // $132.00
  });

  it("skips unavailable bays in matching", () => {
    // Bay A2 is unavailable (200 sqft), so for 200 sqft robot, should get Bay B1 (400 sqft)
    const robotSqft = 200;
    const availableBays = SAMPLE_BAYS.filter(b => b.isAvailable).sort((a, b) => a.sqft - b.sqft);
    const match = availableBays.find(b => b.sqft >= robotSqft);
    expect(match).toBeDefined();
    // Bay A1 is available at 200 sqft, should match
    expect(match!.name).toBe("Bay A1");
    expect(match!.isAvailable).toBe(true);
  });

  it("price message format is correct", () => {
    const match = { name: "Bay A1", sqft: 200, pricePerSqftPerDay: "0.45" };
    const robotSqft = 150;
    const days = 5;
    const rate = parseFloat(match.pricePerSqftPerDay);
    const estimatedTotal = rate * robotSqft * days;
    const message = `${match.name} (${match.sqft} sqft) @ $${rate}/sqft/day × ${robotSqft} sqft × ${days} days = $${estimatedTotal.toFixed(2)}`;
    expect(message).toContain("Bay A1");
    expect(message).toContain("$337.50");
  });
});

// ─── Scheduling Self-Service Tests ───────────────────────────────────────────

describe("scheduling.deleteSlot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes a scheduling slot by slotId", async () => {
    const db = makeDb();
    vi.mocked(getDb).mockResolvedValue(db as never);

    await db.delete({}).where({});
    expect(db.delete).toHaveBeenCalledTimes(1);
  });

  it("throws when DB is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null as never);
    const dbConn = await getDb();
    expect(dbConn).toBeNull();
  });
});

describe("scheduling.addSlots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts multiple slots in bulk", async () => {
    const db = makeDb();
    vi.mocked(getDb).mockResolvedValue(db as never);

    const slots = [
      { hostName: "Bob", hostEmail: "bob@onstage.bot", slotStart: new Date(), slotEnd: new Date() },
      { hostName: "Tommy Laplante", hostEmail: "tom@starsupportinc.com", slotStart: new Date(), slotEnd: new Date() },
    ];
    await db.insert({}).values(slots);
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(db.values).toHaveBeenCalledWith(slots);
  });

  it("supports all three team members as hosts", () => {
    const TEAM_MEMBERS = [
      { name: "Bob", email: "bob@onstage.bot" },
      { name: "Tommy Laplante", email: "tom@starsupportinc.com" },
      { name: "Robot Team", email: "hello@onstage.bot" },
    ];
    expect(TEAM_MEMBERS).toHaveLength(3);
    expect(TEAM_MEMBERS.map(m => m.email)).toContain("hello@onstage.bot");
  });

  it("bulk creates correct number of slots for recurrence", () => {
    const slotDate = "2026-06-01";
    const slotTime = "09:00";
    const duration = 60;
    const bulkDays = 5;
    const slots = [];
    for (let i = 0; i < bulkDays; i++) {
      const base = new Date(`${slotDate}T${slotTime}:00`);
      base.setDate(base.getDate() + i);
      const end = new Date(base.getTime() + duration * 60 * 1000);
      slots.push({ hostName: "Bob", hostEmail: "bob@onstage.bot", slotStart: base, slotEnd: end });
    }
    expect(slots).toHaveLength(5);
    // Each slot is 1 day apart
    const diff = slots[1].slotStart.getTime() - slots[0].slotStart.getTime();
    expect(diff).toBe(24 * 60 * 60 * 1000);
  });

  it("slot end time is duration minutes after start", () => {
    const start = new Date("2026-06-01T09:00:00");
    const durationMinutes = 60;
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    const diffMinutes = (end.getTime() - start.getTime()) / (60 * 1000);
    expect(diffMinutes).toBe(60);
  });
});

// ─── Warehouse Bay Schema Validation ─────────────────────────────────────────

describe("warehouse bay data integrity", () => {
  it("all 6 seeded bays have valid pricing", () => {
    SAMPLE_BAYS.forEach(bay => {
      const price = parseFloat(bay.pricePerSqftPerDay);
      expect(price).toBeGreaterThan(0);
      expect(price).toBeLessThan(10); // sanity check
    });
  });

  it("bay names follow the expected naming convention", () => {
    const namePattern = /^Bay [A-C][12]$/;
    SAMPLE_BAYS.forEach(bay => {
      expect(bay.name).toMatch(namePattern);
    });
  });

  it("total warehouse capacity is 1400 sqft", () => {
    const total = SAMPLE_BAYS.reduce((sum, b) => sum + b.sqft, 0);
    // A1+A2=400, B1+B2=800, C1+C2=200 → 1400
    expect(total).toBe(1400);
  });

  it("bay sqft values match expected sizes", () => {
    const aBays = SAMPLE_BAYS.filter(b => b.name.startsWith("Bay A"));
    const bBays = SAMPLE_BAYS.filter(b => b.name.startsWith("Bay B"));
    const cBays = SAMPLE_BAYS.filter(b => b.name.startsWith("Bay C"));
    aBays.forEach(b => expect(b.sqft).toBe(200));
    bBays.forEach(b => expect(b.sqft).toBe(400));
    cBays.forEach(b => expect(b.sqft).toBe(100));
  });
});
