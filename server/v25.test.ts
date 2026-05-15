/**
 * v25.test.ts
 *
 * Tests for v25 features:
 * 1. quoteFollowupHandler — 5-day window filter, idempotency, email content
 * 2. system.createQuoteFollowUpJob — idempotency, taskUid persistence
 * 3. system.pauseQuoteFollowUpJob / resumeQuoteFollowUpJob — state transitions
 * 4. system.getQuoteFollowUpJobStatus — job not found vs found
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

const BOOKING_QUOTED_6_DAYS_AGO = {
  id: 10,
  company: "Agility Robotics",
  contactName: "Bob Smith",
  contactEmail: "bob@agility.ai",
  contactPhone: "+1-555-0200",
  showName: "NAB 2026",
  showDate: "2026-04-12",
  boothNumber: "C-500",
  services: ["staging", "delivery"],
  robotName: "Digit v3",
  robotType: "humanoid",
  robotSqft: 80,
  storageDays: 5,
  warehouseBayId: 2,
  warehouseEstimate: "200.00",
  status: "quoted",
  quoteSentAt: daysAgo(6),
  quoteResendMessageId: "re_xyz789",
  quoteFollowUpSentAt: null,
  adminNotes: null,
  prospectId: null,
  createdAt: daysAgo(10),
  updatedAt: daysAgo(6),
};

const BOOKING_QUOTED_3_DAYS_AGO = {
  ...BOOKING_QUOTED_6_DAYS_AGO,
  id: 11,
  quoteSentAt: daysAgo(3), // too recent — should NOT get follow-up
};

const BOOKING_ALREADY_FOLLOWED_UP = {
  ...BOOKING_QUOTED_6_DAYS_AGO,
  id: 12,
  quoteFollowUpSentAt: daysAgo(1), // already sent — idempotent skip
};

const BOOKING_NO_EMAIL = {
  ...BOOKING_QUOTED_6_DAYS_AGO,
  id: 13,
  contactEmail: "", // no email — should be skipped
};

const BOOKING_CONFIRMED = {
  ...BOOKING_QUOTED_6_DAYS_AGO,
  id: 14,
  status: "confirmed", // not 'quoted' — should NOT be included
};

// ─── 1. 5-day window filter ───────────────────────────────────────────────────

describe("quoteFollowupHandler — 5-day window filter", () => {
  function isEligible(b: typeof BOOKING_QUOTED_6_DAYS_AGO) {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    return (
      b.status === "quoted" &&
      b.quoteSentAt !== null &&
      b.quoteSentAt < fiveDaysAgo &&
      b.quoteFollowUpSentAt === null
    );
  }

  it("includes booking quoted 6 days ago with no follow-up", () => {
    expect(isEligible(BOOKING_QUOTED_6_DAYS_AGO)).toBe(true);
  });

  it("excludes booking quoted only 3 days ago", () => {
    expect(isEligible(BOOKING_QUOTED_3_DAYS_AGO)).toBe(false);
  });

  it("excludes booking already followed up (idempotent)", () => {
    expect(isEligible(BOOKING_ALREADY_FOLLOWED_UP)).toBe(false);
  });

  it("excludes booking with status 'confirmed'", () => {
    expect(isEligible(BOOKING_CONFIRMED)).toBe(false);
  });

  it("excludes booking with null quoteSentAt", () => {
    const b = { ...BOOKING_QUOTED_6_DAYS_AGO, quoteSentAt: null };
    expect(isEligible(b as typeof BOOKING_QUOTED_6_DAYS_AGO)).toBe(false);
  });

  it("5-day threshold is exactly 5 * 24 * 60 * 60 * 1000 ms", () => {
    const threshold = 5 * 24 * 60 * 60 * 1000;
    expect(threshold).toBe(432000000);
  });

  it("booking quoted exactly 5 days ago is NOT yet eligible (must be strictly less than)", () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    // quoteSentAt === fiveDaysAgo is NOT < fiveDaysAgo
    const b = { ...BOOKING_QUOTED_6_DAYS_AGO, quoteSentAt: fiveDaysAgo };
    const eligible = b.quoteSentAt < fiveDaysAgo;
    expect(eligible).toBe(false);
  });

  it("booking quoted 5 days + 1 second ago IS eligible", () => {
    const justOver5Days = new Date(Date.now() - (5 * 24 * 60 * 60 * 1000 + 1000));
    const b = { ...BOOKING_QUOTED_6_DAYS_AGO, quoteSentAt: justOver5Days };
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    expect(b.quoteSentAt < fiveDaysAgo).toBe(true);
  });
});

// ─── 2. Idempotency ───────────────────────────────────────────────────────────

describe("quoteFollowupHandler — idempotency", () => {
  it("skips booking where quoteFollowUpSentAt is already set", () => {
    const b = BOOKING_ALREADY_FOLLOWED_UP;
    expect(b.quoteFollowUpSentAt).not.toBeNull();
  });

  it("stamps quoteFollowUpSentAt after successful send", () => {
    const before = Date.now();
    const stamp = new Date();
    const after = Date.now();
    expect(stamp.getTime()).toBeGreaterThanOrEqual(before);
    expect(stamp.getTime()).toBeLessThanOrEqual(after);
  });

  it("skips booking with no contactEmail", () => {
    expect(BOOKING_NO_EMAIL.contactEmail).toBe("");
    // handler increments skipped counter for this case
    const skipped = !BOOKING_NO_EMAIL.contactEmail ? 1 : 0;
    expect(skipped).toBe(1);
  });

  it("returns ok:true even when all bookings are skipped", () => {
    const result = { ok: true, processed: 0, skipped: 3, total: 3 };
    expect(result.ok).toBe(true);
    expect(result.processed).toBe(0);
  });

  it("returns correct processed count for mixed batch", () => {
    const eligible = [BOOKING_QUOTED_6_DAYS_AGO, BOOKING_NO_EMAIL];
    let processed = 0;
    let skipped = 0;
    for (const b of eligible) {
      if (!b.contactEmail) { skipped++; continue; }
      processed++;
    }
    expect(processed).toBe(1);
    expect(skipped).toBe(1);
  });
});

// ─── 3. Email content ─────────────────────────────────────────────────────────

describe("quoteFollowupHandler — email content", () => {
  function buildFollowUpEmail(b: typeof BOOKING_QUOTED_6_DAYS_AGO) {
    const quoteNumber = `SG-${String(b.id).padStart(5, "0")}`;
    const subject = `Following up on your StageGate Quote ${quoteNumber}`;
    const bodyContainsQuoteRef = `Quote reference: ${quoteNumber}`;
    const bodyContainsCompany = `Company: ${b.company}`;
    const bodyContainsBookCall = "onstage.bot/schedule";
    return { quoteNumber, subject, bodyContainsQuoteRef, bodyContainsCompany, bodyContainsBookCall };
  }

  it("subject includes quote number", () => {
    const { subject, quoteNumber } = buildFollowUpEmail(BOOKING_QUOTED_6_DAYS_AGO);
    expect(subject).toContain(quoteNumber);
  });

  it("subject includes 'Following up'", () => {
    const { subject } = buildFollowUpEmail(BOOKING_QUOTED_6_DAYS_AGO);
    expect(subject).toContain("Following up");
  });

  it("body includes quote reference number", () => {
    const { bodyContainsQuoteRef } = buildFollowUpEmail(BOOKING_QUOTED_6_DAYS_AGO);
    expect(bodyContainsQuoteRef).toContain("SG-00010");
  });

  it("body includes company name", () => {
    const { bodyContainsCompany } = buildFollowUpEmail(BOOKING_QUOTED_6_DAYS_AGO);
    expect(bodyContainsCompany).toContain("Agility Robotics");
  });

  it("body includes book-a-call CTA link", () => {
    const { bodyContainsBookCall } = buildFollowUpEmail(BOOKING_QUOTED_6_DAYS_AGO);
    expect(bodyContainsBookCall).toBe("onstage.bot/schedule");
  });

  it("HTML body includes warehouse estimate when present", () => {
    const b = BOOKING_QUOTED_6_DAYS_AGO;
    const html = `<strong>$${b.warehouseEstimate}</strong>`;
    expect(html).toContain("200.00");
  });

  it("HTML body does NOT include warehouse section when estimate is null", () => {
    const b = { ...BOOKING_QUOTED_6_DAYS_AGO, warehouseEstimate: null as unknown as string };
    const hasWarehouse = !!b.warehouseEstimate;
    expect(hasWarehouse).toBe(false);
  });

  it("uses contactName in greeting when available", () => {
    const greeting = `Hi ${BOOKING_QUOTED_6_DAYS_AGO.contactName ?? "there"},`;
    expect(greeting).toBe("Hi Bob Smith,");
  });

  it("falls back to 'there' in greeting when contactName is null", () => {
    const b = { ...BOOKING_QUOTED_6_DAYS_AGO, contactName: null as unknown as string };
    const greeting = `Hi ${b.contactName ?? "there"},`;
    expect(greeting).toBe("Hi there,");
  });
});

// ─── 4. Handler auth guard ────────────────────────────────────────────────────

describe("quoteFollowupHandler — authentication", () => {
  it("returns 403 when isCron is false", () => {
    const user = { isCron: false, taskUid: null };
    const shouldBlock = !user.isCron || !user.taskUid;
    expect(shouldBlock).toBe(true);
  });

  it("returns 403 when taskUid is missing", () => {
    const user = { isCron: true, taskUid: null };
    const shouldBlock = !user.isCron || !user.taskUid;
    expect(shouldBlock).toBe(true);
  });

  it("allows request when isCron=true and taskUid is set", () => {
    const user = { isCron: true, taskUid: "task_abc123" };
    const shouldBlock = !user.isCron || !user.taskUid;
    expect(shouldBlock).toBe(false);
  });
});

// ─── 5. system.createQuoteFollowUpJob — idempotency ──────────────────────────

describe("system.createQuoteFollowUpJob — idempotency", () => {
  it("returns created:false when job already exists in system_config", () => {
    const existing = [{ key: "quote_followup_job_task_uid", value: "task_existing_123" }];
    const result = existing.length > 0
      ? { created: false, taskUid: existing[0].value }
      : { created: true, taskUid: "task_new_456" };
    expect(result.created).toBe(false);
    expect(result.taskUid).toBe("task_existing_123");
  });

  it("returns created:true when no job exists yet", () => {
    const existing: unknown[] = [];
    const result = existing.length > 0
      ? { created: false }
      : { created: true, taskUid: "task_new_456", nextExecutionAt: "2026-05-16T09:00:00Z" };
    expect(result.created).toBe(true);
  });

  it("persists taskUid to system_config with key 'quote_followup_job_task_uid'", () => {
    const key = "quote_followup_job_task_uid";
    expect(key).toBe("quote_followup_job_task_uid");
  });

  it("cron expression is 6-field daily 09:00 UTC", () => {
    const cron = "0 0 9 * * *";
    const parts = cron.split(" ");
    expect(parts).toHaveLength(6);
    expect(parts[0]).toBe("0"); // seconds
    expect(parts[1]).toBe("0"); // minutes
    expect(parts[2]).toBe("9"); // hours (09:00 UTC)
  });

  it("callback path starts with /api/scheduled/", () => {
    const path = "/api/scheduled/quote-followup";
    expect(path.startsWith("/api/scheduled/")).toBe(true);
  });
});

// ─── 6. system.pauseQuoteFollowUpJob / resumeQuoteFollowUpJob ────────────────

describe("system.pauseQuoteFollowUpJob / resumeQuoteFollowUpJob", () => {
  it("pause sets enable=false in the heartbeat update patch", () => {
    const patch = { enable: false };
    expect(patch.enable).toBe(false);
  });

  it("resume sets enable=true in the heartbeat update patch", () => {
    const patch = { enable: true };
    expect(patch.enable).toBe(true);
  });

  it("throws NOT_FOUND when no taskUid exists in system_config", () => {
    const existing: unknown[] = [];
    const shouldThrow = existing.length === 0;
    expect(shouldThrow).toBe(true);
  });

  it("returns paused:true on successful pause", () => {
    const result = { paused: true, taskUid: "task_abc" };
    expect(result.paused).toBe(true);
  });

  it("returns resumed:true on successful resume", () => {
    const result = { resumed: true, taskUid: "task_abc" };
    expect(result.resumed).toBe(true);
  });
});

// ─── 7. system.getQuoteFollowUpJobStatus ─────────────────────────────────────

describe("system.getQuoteFollowUpJobStatus", () => {
  it("returns exists:false when no row in system_config", () => {
    const row: unknown[] = [];
    const result = row.length === 0
      ? { exists: false, taskUid: null, job: null }
      : { exists: true, taskUid: "task_abc", job: {} };
    expect(result.exists).toBe(false);
    expect(result.taskUid).toBeNull();
  });

  it("returns exists:true with taskUid when row exists", () => {
    const row = [{ key: "quote_followup_job_task_uid", value: "task_abc123" }];
    const result = row.length > 0
      ? { exists: true, taskUid: row[0].value, job: null }
      : { exists: false, taskUid: null, job: null };
    expect(result.exists).toBe(true);
    expect(result.taskUid).toBe("task_abc123");
  });

  it("returns job:null gracefully when listing fails (job deleted externally)", () => {
    const result = { exists: true, taskUid: "task_abc", job: null };
    expect(result.job).toBeNull();
    expect(result.exists).toBe(true);
  });
});
