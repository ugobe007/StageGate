import { describe, expect, it } from "vitest";
import { buildCalChapterEmail } from "./calChapters.js";
import { isLegacyFrankDraft } from "./calDraftQuality.js";

const VEO_LEGACY = {
  subject: "MODEX 2026: Veo Robotics FreeMove",
  body: `Saw you're bringing FreeMove to MODEX 2026. We handle end-to-end robotics logistics, staging, and activation here in Las Vegas.

Industrial arms like FreeMove demand precise rigging, 480V power drops, and meticulous calibration. We ensure your units are flashed, fully tested, and 100% field-ready, eliminating any demo day surprises.

Our team manages all the heavy lifting and on-site troubleshooting, so your sales team can focus on closing deals. Worth a quick call to discuss your MODEX deployment?

Frank
StageGate — Robotics Activation Infrastructure
onstage.bot`,
};

describe("isLegacyFrankDraft", () => {
  it("flags old Frank MODEX sales copy", () => {
    expect(isLegacyFrankDraft(VEO_LEGACY.body, VEO_LEGACY.subject)).toBe(true);
  });

  it("does not flag Cal field notes", () => {
    const { body, subject } = buildCalChapterEmail(
      { company: "Veo Robotics", contactName: "Alex", robotType: "FreeMove" },
      "discovery",
    );
    expect(isLegacyFrankDraft(body, subject)).toBe(false);
    expect(body).toMatch(/Field Note #|Deployment Diary/);
    expect(body).toContain("— Cal");
    expect(subject).not.toMatch(/^MODEX 2026:/);
  });
});
