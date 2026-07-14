import { describe, expect, it } from "vitest";
import { CAL_CHARACTER, FRANK_PERSONA } from "./frankPlaybook.js";
import {
  buildCalChapterEmail,
  listCalChapterIds,
  pickCalChapter,
} from "./calChapters.js";

describe("CAL_CHARACTER", () => {
  it("defines Cal as Studious Observer, not a robot expert", () => {
    expect(CAL_CHARACTER.archetype).toBe("Studious Observer");
    expect(CAL_CHARACTER.lens).toMatch(/flow/i);
    expect(CAL_CHARACTER.never.join(" ")).toMatch(/sales/i);
  });
});

describe("pickCalChapter", () => {
  it("returns different field notes per stage for the same company", () => {
    const ctx = { companyName: "Acme Robotics", seed: "Acme Robotics" };
    expect(pickCalChapter(ctx, "discovery").id).not.toBe(pickCalChapter(ctx, "intro_sent").id);
  });
});

describe("buildCalChapterEmail", () => {
  it("reads as a field note, not outreach", () => {
    const { body, subject } = buildCalChapterEmail(
      { company: "UPS Supply Chain Solutions", contactEmail: "ops@ups.com" },
      "discovery",
    );
    expect(body).toMatch(/Field Note #|Deployment Diary/);
    expect(body).not.toMatch(/This is Cal|Physical AI Deployment Advisor|onstage\.bot/i);
    expect(body).not.toMatch(/would you like to meet|schedule a call|book a demo/i);
    expect(body).toContain("— Cal");
    expect(FRANK_PERSONA.signature).toBe("— Cal");
    expect(subject).not.toMatch(/Introducing myself|quick question/i);
  });

  it("focuses on work and flow, not robot specs", () => {
    const { body } = buildCalChapterEmail(
      { company: "Vention", contactName: "Mathieu Desmarais" },
      "discovery",
    );
    expect(body).toMatch(/people|flow|work|walk|wait|handoff|warehouse|operation/i);
    expect(body).toMatch(/I'm curious|Does that|Have you|What's the|If you/i);
  });

  it("has a library of distinct field notes", () => {
    expect(listCalChapterIds().length).toBeGreaterThanOrEqual(8);
  });
});
