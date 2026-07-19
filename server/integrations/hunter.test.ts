import { describe, expect, it } from "vitest";
import {
  HUNTER_MIN_DOMAIN_CONFIDENCE,
  pickBestDomainEmail,
  sanitizeContactNameForHunter,
} from "./hunter.js";
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

describe("sanitizeContactNameForHunter", () => {
  it("accepts real person names", () => {
    expect(sanitizeContactNameForHunter("Ryan Permeh")).toEqual({ first: "Ryan", last: "Permeh" });
    expect(sanitizeContactNameForHunter("Dana Lee")).toEqual({ first: "Dana", last: "Lee" });
  });

  it("rejects junk and role-only labels", () => {
    expect(sanitizeContactNameForHunter("[Best Guess: Name not provided]")).toEqual({});
    expect(sanitizeContactNameForHunter("Unknown")).toEqual({});
    expect(sanitizeContactNameForHunter("Marketing Team")).toEqual({});
    expect(sanitizeContactNameForHunter("Marketing Director")).toEqual({});
    expect(sanitizeContactNameForHunter("sales")).toEqual({});
  });
});

describe("pickBestDomainEmail", () => {
  it("prefers personal emails over generic role inboxes", () => {
    const best = pickBestDomainEmail([
      { value: "info@acme.com", type: "generic", confidence: 99 },
      { value: "dana@acme.com", type: "personal", confidence: 92, department: "sales" },
    ]);
    expect(best?.value).toBe("dana@acme.com");
  });

  it("ranks by relevant department before confidence", () => {
    const best = pickBestDomainEmail([
      { value: "eng@acme.com", type: "personal", confidence: 95, department: "it" },
      { value: "ceo@acme.com", type: "personal", confidence: 91, department: "executive" },
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

  it("accepts personal emails at typical Hunter scores (>=80 default)", () => {
    expect(HUNTER_MIN_DOMAIN_CONFIDENCE).toBeLessThanOrEqual(80);
    const best = pickBestDomainEmail([
      { value: "ceo@acme.com", type: "personal", confidence: 85, department: "executive", verification: { status: "accept_all" } },
    ]);
    expect(best?.value).toBe("ceo@acme.com");
  });

  it("drops invalid / disposable addresses", () => {
    const best = pickBestDomainEmail([
      { value: "dead@acme.com", type: "personal", confidence: 99, verification: { status: "invalid" } },
      { value: "live@acme.com", type: "personal", confidence: 92, verification: { status: "valid" } },
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

  it("keeps real high-confidence person-level emails", () => {
    expect(prospectNeedsEnrichment({ ...site, contactEmail: "dana.lee@acme.com", emailConfidence: "high" })).toBe(false);
    expect(prospectNeedsEnrichment({ ...site, contactEmail: "dana@acme.com", emailConfidence: "verified" })).toBe(false);
  });

  it("flags medium confidence until OUTREACH_ALLOW_MEDIUM_CONFIDENCE=1", () => {
    expect(prospectNeedsEnrichment({ ...site, contactEmail: "dana@acme.com", emailConfidence: "medium" })).toBe(true);
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
