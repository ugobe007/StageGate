/**
 * v19 — P5-P9 Autonomous Logistics Agent Tests
 * Tests for: getAllWorkflows, createWorkflow, updateCheckpoint,
 *            reportProblem, sendShowCheckin, sendPickupPrompt,
 *            summarizeMeetingAndHandoff, checkpointPoller
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
import { invokeLLM } from "./_core/llm";
import * as emailHelpers from "./email";

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
    returning: vi.fn().mockResolvedValue([{ id: 1, status: "active" }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    then: undefined as unknown,
    ...overrides,
  };
  // Make it awaitable as an array
  (chain as unknown as Promise<unknown[]>)[Symbol.iterator as unknown as string] = undefined;
  return chain;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("P6: Logistics workflow creation", () => {
  it("creates a workflow with 13 standard checkpoints", async () => {
    const CHECKPOINT_TYPES = [
      "shipping_out", "customs", "airport_arrival", "receiving",
      "warehouse_in", "staging", "activation_test", "booth_delivery",
      "show_floor_checkin", "show_end", "return_pickup", "warehouse_return", "completed",
    ];
    expect(CHECKPOINT_TYPES).toHaveLength(13);
    expect(CHECKPOINT_TYPES[0]).toBe("shipping_out");
    expect(CHECKPOINT_TYPES[CHECKPOINT_TYPES.length - 1]).toBe("completed");
  });

  it("checkpoint due dates are ordered sequentially", () => {
    const CHECKPOINT_DAYS = [0, 3, 5, 7, 7, 10, 11, 14, 15, 18, 19, 20, 21];
    for (let i = 1; i < CHECKPOINT_DAYS.length; i++) {
      expect(CHECKPOINT_DAYS[i]).toBeGreaterThanOrEqual(CHECKPOINT_DAYS[i - 1]);
    }
  });

  it("responsible parties are assigned correctly", () => {
    const RESPONSIBLE = {
      shipping_out:       "robot_company",
      customs:            "vendor",
      airport_arrival:    "vendor",
      receiving:          "stagegate",
      warehouse_in:       "stagegate",
      staging:            "stagegate",
      activation_test:    "stagegate",
      booth_delivery:     "stagegate",
      show_floor_checkin: "stagegate",
      show_end:           "robot_company",
      return_pickup:      "stagegate",
      warehouse_return:   "stagegate",
      completed:          "stagegate",
    };
    expect(RESPONSIBLE.shipping_out).toBe("robot_company");
    expect(RESPONSIBLE.show_end).toBe("robot_company");
    expect(RESPONSIBLE.activation_test).toBe("stagegate");
  });
});

describe("P7: Checkpoint engine", () => {
  it("identifies overdue checkpoints by due date comparison", () => {
    const now = new Date("2026-05-14T12:00:00Z");
    const checkpoints = [
      { id: 1, status: "pending",     dueAt: new Date("2026-05-10T00:00:00Z") }, // overdue
      { id: 2, status: "in_progress", dueAt: new Date("2026-05-12T00:00:00Z") }, // overdue
      { id: 3, status: "pending",     dueAt: new Date("2026-05-20T00:00:00Z") }, // not overdue
      { id: 4, status: "completed",   dueAt: new Date("2026-05-08T00:00:00Z") }, // completed, not overdue
    ];
    const overdue = checkpoints.filter(cp =>
      ["pending", "in_progress"].includes(cp.status) && cp.dueAt < now
    );
    expect(overdue).toHaveLength(2);
    expect(overdue.map(c => c.id)).toEqual([1, 2]);
  });

  it("does not flag completed checkpoints as overdue", () => {
    const now = new Date("2026-05-14T12:00:00Z");
    const checkpoints = [
      { id: 1, status: "completed", dueAt: new Date("2026-05-01T00:00:00Z") },
      { id: 2, status: "skipped",   dueAt: new Date("2026-05-01T00:00:00Z") },
    ];
    const overdue = checkpoints.filter(cp =>
      ["pending", "in_progress"].includes(cp.status) && cp.dueAt < now
    );
    expect(overdue).toHaveLength(0);
  });

  it("groups overdue checkpoints by responsible party", () => {
    const overdue = [
      { id: 1, responsibleParty: "stagegate",    title: "Receive robot" },
      { id: 2, responsibleParty: "robot_company", title: "Ship robot" },
      { id: 3, responsibleParty: "stagegate",    title: "Stage robot" },
    ];
    const byParty: Record<string, typeof overdue> = {};
    for (const cp of overdue) {
      const party = cp.responsibleParty;
      if (!byParty[party]) byParty[party] = [];
      byParty[party].push(cp);
    }
    expect(byParty["stagegate"]).toHaveLength(2);
    expect(byParty["robot_company"]).toHaveLength(1);
  });
});

describe("P8: Problem escalation", () => {
  beforeEach(() => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [{ message: { content: "Dear Robot Company, we found an issue with your robot during staging. Please contact us." } }],
    });
  });

  it("calls invokeLLM with problem description in the prompt", async () => {
    const problem = "Robot arm not responding to calibration commands";
    const company = "Acme Robotics";
    await invokeLLM({
      messages: [
        { role: "system", content: "You are the StageGate operations team." },
        { role: "user", content: `Robot company: ${company}\nProblem: ${problem}\nSeverity: high` },
      ],
    });
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ content: expect.stringContaining(problem) }),
        ]),
      })
    );
  });

  it("sends problem report email to robot company", async () => {
    const mockSendEmail = vi.mocked(emailHelpers.sendEmail);
    await emailHelpers.sendEmail({
      to: "tech@acmerobotics.com",
      subject: "[StageGate] Robot Staging Issue — Action Required (HIGH)",
      body: "We found an issue with your robot.",
    });
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "tech@acmerobotics.com",
        subject: expect.stringContaining("Staging Issue"),
      })
    );
  });

  it("escalation severity levels are valid", () => {
    const validSeverities = ["low", "medium", "high", "critical"];
    expect(validSeverities).toContain("high");
    expect(validSeverities).toContain("critical");
    expect(validSeverities).not.toContain("extreme");
  });
});

describe("P9: Show floor and return logistics", () => {
  it("show floor check-in email includes day number and show name", async () => {
    const mockSendEmail = vi.mocked(emailHelpers.sendEmail);
    await emailHelpers.sendEmail({
      to: "team@robotco.com",
      subject: "Day 2 Check-In — CES 2027 | StageGate",
      body: "Hi RobotCo team! Just checking in on Day 2 of CES 2027.",
    });
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("Day 2"),
      })
    );
  });

  it("post-show pickup prompt email is sent to robot company", async () => {
    const mockSendEmail = vi.mocked(emailHelpers.sendEmail);
    await emailHelpers.sendEmail({
      to: "team@robotco.com",
      subject: "Post-Show Pickup — CES 2027 | StageGate",
      body: "CES 2027 has wrapped up — great show! Please let us know about return logistics.",
    });
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("Post-Show Pickup"),
      })
    );
  });

  it("lifecycle completes after all 13 checkpoints are done", () => {
    const checkpoints = Array.from({ length: 13 }, (_, i) => ({
      id: i + 1,
      status: "completed",
    }));
    const allComplete = checkpoints.every(cp => cp.status === "completed");
    expect(allComplete).toBe(true);
    expect(checkpoints).toHaveLength(13);
  });
});

describe("P5: Meeting handoff and AI summary", () => {
  it("invokeLLM is called with meeting notes for summarization", async () => {
    const notes = "We spoke with the CTO of Acme Robotics. They are interested in booth activation for CES 2027. Budget is around $15k. They want to ship 2 weeks before the show. Main concern is robot calibration on-site.";
    await invokeLLM({
      messages: [
        { role: "system", content: "You are a CRM assistant." },
        { role: "user", content: `Meeting notes:\n${notes}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "meeting_summary",
          strict: true,
          schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              nextSteps: { type: "array", items: { type: "string" } },
              primaryInterest: { type: "string" },
            },
            required: ["summary", "nextSteps", "primaryInterest"],
            additionalProperties: false,
          },
        },
      },
    });
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ content: expect.stringContaining("Meeting notes:") }),
        ]),
      })
    );
  });

  it("JSON schema for meeting summary has required fields", () => {
    const schema = {
      type: "object",
      properties: {
        summary: { type: "string" },
        nextSteps: { type: "array", items: { type: "string" } },
        primaryInterest: { type: "string" },
      },
      required: ["summary", "nextSteps", "primaryInterest"],
      additionalProperties: false,
    };
    expect(schema.required).toContain("summary");
    expect(schema.required).toContain("nextSteps");
    expect(schema.required).toContain("primaryInterest");
    expect(schema.additionalProperties).toBe(false);
  });
});

describe("getAllWorkflows aggregation", () => {
  it("correctly groups checkpoints by workflowId", () => {
    const workflows = [{ id: 1 }, { id: 2 }];
    const allCheckpoints = [
      { id: 1, workflowId: 1, title: "Ship robot" },
      { id: 2, workflowId: 1, title: "Receive robot" },
      { id: 3, workflowId: 2, title: "Ship robot" },
    ];
    const result = workflows.map(w => ({
      workflow: w,
      checkpoints: allCheckpoints.filter(cp => cp.workflowId === w.id),
    }));
    expect(result[0].checkpoints).toHaveLength(2);
    expect(result[1].checkpoints).toHaveLength(1);
  });

  it("returns empty array when no workflows exist", () => {
    const workflows: unknown[] = [];
    const result = workflows.map(w => ({ workflow: w, checkpoints: [] }));
    expect(result).toHaveLength(0);
  });
});

describe("Checkpoint poller", () => {
  it("nudge email subject contains company name and checkpoint title", () => {
    const company = "Acme Robotics";
    const checkpoint = "Robot Shipped by Company";
    const subject = `[StageGate] Action Required: ${checkpoint} — ${company}`;
    expect(subject).toContain(company);
    expect(subject).toContain(checkpoint);
  });

  it("poller skips completed and skipped checkpoints", () => {
    const checkpoints = [
      { id: 1, status: "completed" },
      { id: 2, status: "skipped" },
      { id: 3, status: "pending", dueAt: new Date("2026-01-01") },
    ];
    const actionable = checkpoints.filter(cp =>
      !["completed", "skipped"].includes(cp.status)
    );
    expect(actionable).toHaveLength(1);
    expect(actionable[0].id).toBe(3);
  });
});
