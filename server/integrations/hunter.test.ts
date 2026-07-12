import { describe, expect, it } from "vitest";
import { pickBestDomainEmail } from "./hunter.js";
import { prospectNeedsEnrichment } from "../agents/prospectEnrichment.js";

describe("pickBestDomainEmail", () => {
  it("prefers personal emails over generic role inboxes", () => {
    const best = pickBestDomainEmail([
      { value: "info@acme.com", type: "generic", confidence: 99 },
      { value: "dana@acme.com", type: "personal", confidence: 80, department: "sales" },
    ]);
    expect(best?.value).toBe("dana@acme.com");
  });

  it("ranks by relevant department before confidence", () => {
    const best = pickBestDomainEmail([
      { value: "eng@acme.com", type: "personal", confidence: 95, department: "it" },
      { value: "ceo@acme.com", type: "personal", confidence: 85, department: "executive" },
    ]);
    expect(best?.value).toBe("ceo@acme.com");
  });

  it("falls back to generic when no personal email exists", () => {
    const best = pickBestDomainEmail([
      { value: "sales@acme.com", type: "generic", confidence: 70 },
    ]);
    expect(best?.value).toBe("sales@acme.com");
  });

  it("drops invalid / disposable addresses", () => {
    const best = pickBestDomainEmail([
      { value: "dead@acme.com", type: "personal", confidence: 99, verification: { status: "invalid" } },
      { value: "live@acme.com", type: "personal", confidence: 60, verification: { status: "valid" } },
    ]);
    expect(best?.value).toBe("live@acme.com");
  });

  it("returns null when nothing is usable", () => {
    expect(pickBestDomainEmail([])).toBeNull();
    expect(
      pickBestDomainEmail([
        { value: "x@acme.com", type: "personal", confidence: 90, verification: { status: "disposable" } },
      ])
    ).toBeNull();
  });
});

describe("prospectNeedsEnrichment", () => {
  it("flags prospects with no email", () => {
    expect(prospectNeedsEnrichment({ contactEmail: null, emailConfidence: null })).toBe(true);
    expect(prospectNeedsEnrichment({ contactEmail: "", emailConfidence: "high" })).toBe(true);
  });

  it("flags guessed role inboxes even at high confidence", () => {
    expect(prospectNeedsEnrichment({ contactEmail: "marketing@acme.com", emailConfidence: "high" })).toBe(true);
    expect(prospectNeedsEnrichment({ contactEmail: "info@acme.com", emailConfidence: "medium" })).toBe(true);
  });

  it("flags low / unknown confidence emails", () => {
    expect(prospectNeedsEnrichment({ contactEmail: "dana@acme.com", emailConfidence: "low" })).toBe(true);
    expect(prospectNeedsEnrichment({ contactEmail: "dana@acme.com", emailConfidence: "" })).toBe(true);
  });

  it("keeps real, confident, person-level emails", () => {
    expect(prospectNeedsEnrichment({ contactEmail: "dana.lee@acme.com", emailConfidence: "high" })).toBe(false);
    expect(prospectNeedsEnrichment({ contactEmail: "dana@acme.com", emailConfidence: "medium" })).toBe(false);
  });
});
