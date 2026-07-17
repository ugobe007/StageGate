import { describe, expect, it } from "vitest";
import { isPartnerProspect } from "./partnerEmail";

describe("partner outreach routing", () => {
  it("routes exhibit houses to partner track, not OEM", () => {
    expect(isPartnerProspect({ vendorType: "exhibit_house" })).toBe(true);
    expect(isPartnerProspect({ vendorType: "robot_oem" })).toBe(false);
    expect(isPartnerProspect({ outreachAngle: "partner" })).toBe(true);
  });
});
