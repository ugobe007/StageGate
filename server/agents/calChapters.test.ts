import { describe, expect, it } from "vitest";
import { CAL_CHARACTER, FRANK_PERSONA } from "./frankPlaybook.js";
import {
  buildCalChapterEmail,
  calChapterAudience,
  isRobotOemProspect,
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

describe("isRobotOemProspect", () => {
  it("classifies Fanuc as robot OEM", () => {
    expect(isRobotOemProspect({ company: "Fanuc", robotType: "industrial_arm" })).toBe(true);
    expect(calChapterAudience({ company: "Fanuc", robotType: "industrial_arm" })).toBe("robot_oem");
  });

  it("does not classify exhibit houses as OEM", () => {
    expect(isRobotOemProspect({ company: "Freeman", vendorType: "exhibit_house" })).toBe(false);
  });
});

describe("pickCalChapter", () => {
  it("returns different notes per stage for the same company", () => {
    const ctx = { companyName: "Acme Robotics", seed: "Acme Robotics", robotType: "wheeled_amr" };
    expect(pickCalChapter(ctx, "discovery").id).not.toBe(pickCalChapter(ctx, "intro_sent").id);
  });

  it("uses OEM library for robot manufacturers", () => {
    const ctx = { companyName: "Fanuc", seed: "Fanuc", robotType: "industrial_arm" };
    const note = pickCalChapter(ctx, "discovery");
    expect(note.body.join(" ")).toMatch(/customer|deployment|demo|OEM|integrator|show/i);
    expect(note.body.join(" ")).not.toMatch(/forklift|picker productivity|warehouse floor that everyone avoids/i);
  });
});

describe("buildCalChapterEmail", () => {
  it("reads as an observation, not outreach", () => {
    const { body, subject } = buildCalChapterEmail(
      { company: "UPS Supply Chain Solutions", contactEmail: "ops@ups.com" },
      "discovery",
    );
    expect(body).not.toMatch(/Field Note #\d+/);
    expect(body).not.toMatch(/This is Cal|Physical AI Deployment Advisor|onstage\.bot/i);
    expect(body).not.toMatch(/would you like to meet|schedule a call|book a demo/i);
    expect(body).toContain("— Cal");
    expect(FRANK_PERSONA.signature).toBe("— Cal");
    expect(subject).not.toMatch(/Introducing myself|quick question/i);
  });

  it("focuses on work and flow for operators, not robot specs", () => {
    const { body } = buildCalChapterEmail(
      { company: "Vention", contactName: "Mathieu Desmarais" },
      "discovery",
    );
    expect(body).toMatch(/people|flow|work|walk|wait|handoff|warehouse|operation/i);
    expect(body).toMatch(/I'm curious|Does that|Have you|What's the|If you/i);
  });

  it("writes about customer deployments for OEMs like Fanuc", () => {
    const { body, subject, audience } = buildCalChapterEmail(
      { company: "Fanuc", contactEmail: "team@fanuc.com", robotType: "industrial_arm" },
      "discovery",
    );
    expect(audience).toBe("robot_oem");
    expect(body).not.toMatch(/Field Note #\d+/);
    expect(body).not.toMatch(/task on your floor that everyone avoids/i);
    expect(body).toMatch(/customer|deployment|demo|power|integrator|show/i);
    expect(subject).not.toMatch(/slowest machine/i);
  });

  it("has a library of distinct field notes", () => {
    expect(listCalChapterIds().length).toBeGreaterThanOrEqual(12);
  });
});
