import { describe, expect, it } from "vitest";
import { pickBestDomainEmail } from "./hunter.js";
import { extractEmailAddress } from "../outreachContacts.js";
import { prospectNeedsEnrichment, selectProspectsForEnrichment } from "../agents/prospectEnrichment.js";

describe("extractEmailAddress", () => {
  it("pulls bare address from Resend-style display names", () => {
    expect(extractEmailAddress("jacob mortensen <jm@uvd-robots.com>")).toBe("jm@uvd-robots.com");
    expect(extractEmailAddress("dana@acme.com")).toBe("dana@acme.com");
  });

  it("returns null for invalid strings", () => {
    expect(extractEmailAddress("not-an-email")).toBeNull();
    expect(extractEmailAddress("")).toBeNull();
  });
});

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

  it("returns null when only generic role inboxes exist", () => {
    expect(
      pickBestDomainEmail([{ value: "sales@acme.com", type: "generic", confidence: 90 }]),
    ).toBeNull();
  });

  it("rejects personal emails below minimum domain confidence", () => {
    expect(
      pickBestDomainEmail([
        { value: "live@acme.com", type: "personal", confidence: 60, verification: { status: "valid" } },
      ]),
    ).toBeNull();
  });

  it("drops invalid / disposable addresses", () => {
    const best = pickBestDomainEmail([
      { value: "dead@acme.com", type: "personal", confidence: 99, verification: { status: "invalid" } },
      { value: "live@acme.com", type: "personal", confidence: 85, verification: { status: "valid" } },
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
  const site = { website: "https://acme.com" };

  it("ignores prospects with no website (junk names)", () => {
    expect(prospectNeedsEnrichment({ contactEmail: null, emailConfidence: null, website: null })).toBe(false);
    expect(prospectNeedsEnrichment({ contactEmail: "dana@acme.com", emailConfidence: "low", website: "" })).toBe(false);
  });

  it("flags prospects with no email when website exists", () => {
    expect(prospectNeedsEnrichment({ ...site, contactEmail: null, emailConfidence: null })).toBe(true);
    expect(prospectNeedsEnrichment({ ...site, contactEmail: "", emailConfidence: "high" })).toBe(true);
  });

  it("flags guessed role inboxes even at high confidence", () => {
    expect(prospectNeedsEnrichment({ ...site, contactEmail: "marketing@acme.com", emailConfidence: "high" })).toBe(true);
    expect(prospectNeedsEnrichment({ ...site, contactEmail: "info@acme.com", emailConfidence: "medium" })).toBe(true);
  });

  it("flags low / unknown confidence emails", () => {
    expect(prospectNeedsEnrichment({ ...site, contactEmail: "dana@acme.com", emailConfidence: "low" })).toBe(true);
    expect(prospectNeedsEnrichment({ ...site, contactEmail: "dana@acme.com", emailConfidence: "" })).toBe(true);
  });

  it("keeps real, confident, person-level emails", () => {
    expect(prospectNeedsEnrichment({ ...site, contactEmail: "dana.lee@acme.com", emailConfidence: "high" })).toBe(false);
    expect(prospectNeedsEnrichment({ ...site, contactEmail: "dana@acme.com", emailConfidence: "medium" })).toBe(false);
  });
});

describe("selectProspectsForEnrichment", () => {
  const row = (partial: Record<string, unknown>) =>
    ({
      id: 1,
      company: "Acme",
      website: "https://acme.com",
      contactEmail: "marketing@acme.com",
      emailConfidence: "high",
      status: "new",
      ...partial,
    }) as Parameters<typeof selectProspectsForEnrichment>[0][number];

  it("includes generic role inboxes even at high confidence", () => {
    const picked = selectProspectsForEnrichment(
      [
        row({ id: 1, contactEmail: "marketing@acme.com", emailConfidence: "high" }),
        row({ id: 2, contactEmail: "dana@acme.com", emailConfidence: "high" }),
      ],
      10,
    );
    expect(picked.map((p) => p.id)).toEqual([1]);
  });

  it("skips prospects without a website (Hunter needs a domain)", () => {
    const picked = selectProspectsForEnrichment(
      [row({ id: 3, website: null, contactEmail: null, emailConfidence: "low" })],
      10,
    );
    expect(picked).toHaveLength(0);
  });
});
