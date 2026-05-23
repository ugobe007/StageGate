import { describe, it, expect } from "vitest";
import {
  applyPartnerMergeFields,
  buildCalPartnerEmail,
  getPartnerHook,
  isPartnerProspect,
} from "./partnerEmail";

describe("partnerEmail", () => {
  const recipient = {
    key: "vendor:1",
    source: "vendor" as const,
    id: 1,
    company: "Freeman",
    contactName: "Jane Doe",
    contactEmail: "jane@freeman.com",
    contactPhone: null,
    partnerType: "exhibit_house",
    partnerTypeLabel: "Exhibit House",
    city: "Las Vegas",
    website: null,
    notes: null,
  };

  it("builds Cal partner email with subject", () => {
    const { subject, body } = buildCalPartnerEmail({
      company: "Freeman",
      contactName: "Jane Doe",
      vendorType: "exhibit_house",
    });
    expect(subject).toContain("Freeman");
    expect(body).toContain("Hi Jane");
    expect(body).toContain("StageGate");
  });

  it("applies merge fields", () => {
    const out = applyPartnerMergeFields(
      "Hi {{contact_name}} at {{company}} — {{partner_hook}}",
      recipient,
    );
    expect(out).toContain("Jane Doe");
    expect(out).toContain("Freeman");
    expect(out).toContain("exhibit teams");
  });

  it("identifies partner prospects", () => {
    expect(isPartnerProspect({ outreachAngle: "partner" })).toBe(true);
    expect(isPartnerProspect({ vendorType: "exhibit_house" })).toBe(true);
    expect(isPartnerProspect({ vendorType: "robot_oem" })).toBe(false);
  });

  it("returns partner hooks by type", () => {
    expect(getPartnerHook("exhibit_house")).toContain("exhibit teams");
    expect(getPartnerHook("freight")).toContain("drayage");
  });
});
