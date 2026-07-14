import { describe, expect, it } from "vitest";
import {
  buildCalChapterEmail,
  listCalChapterIds,
  pickCalChapter,
} from "./calChapters.js";

describe("pickCalChapter", () => {
  it("returns different chapters per stage for the same company", () => {
    const ctx = { companyName: "Acme Robotics", seed: "Acme Robotics" };
    const a = pickCalChapter(ctx, "discovery");
    const b = pickCalChapter(ctx, "intro_sent");
    const c = pickCalChapter(ctx, "followup_1");
    expect(a.id).not.toBe(b.id);
    expect(b.id).not.toBe(c.id);
  });

  it("is deterministic for the same company and stage", () => {
    const ctx = { companyName: "Robust AI", seed: "Robust AI" };
    expect(pickCalChapter(ctx, "discovery").id).toBe(pickCalChapter(ctx, "discovery").id);
  });
});

describe("buildCalChapterEmail", () => {
  it("opens with insight, not a Cal self-intro", () => {
    const { body, subject } = buildCalChapterEmail(
      { company: "UPS Supply Chain Solutions", contactEmail: "ops@ups.com" },
      "discovery",
    );
    expect(body).not.toMatch(/This is Cal/i);
    expect(body).not.toMatch(/I wanted to introduce myself/i);
    expect(body).toMatch(/One thing I've learned|Here's something|Most warehouse|After hundreds|Humanoids get|One question predicts|One pattern I see/i);
    expect(subject).not.toMatch(/Introducing myself/i);
  });

  it("includes observation, lesson, and conversation question", () => {
    const { body } = buildCalChapterEmail(
      { company: "Vention", contactName: "Mathieu Desmarais" },
      "discovery",
    );
    expect(body).toContain("Hi Mathieu,");
    expect(body).toMatch(/I'm curious|How is|What's the|Does |If you had|Is /);
    expect(body).toContain("Vention");
    expect(body).toContain("StageGate");
  });

  it("covers multiple chapter themes", () => {
    expect(listCalChapterIds().length).toBeGreaterThanOrEqual(6);
  });
});
