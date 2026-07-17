import { describe, it, expect } from "vitest";
import {
  applyPartnerMergeFields,
  buildCalPartnerEmail,
  getPartnerHook,
  isPartnerProspect,
  resolveGreetingName,
  isGenericInbox,
  normalizeCalEmailGreeting,
  greetingLine,
  PARTNER_SIGNUP_URL,
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
    greetingName: "Jane",
    needsContactName: false,
    isGenericInbox: false,
    researchContactName: null,
  };

  it("builds Cal partner email with signup link and LV Robotics signature", () => {
    const { subject, body, needsName } = buildCalPartnerEmail({
      company: "Freeman",
      contactName: "Jane Doe",
      vendorType: "exhibit_house",
    });
    expect(subject).toContain("Freeman");
    expect(body).toContain("Hi Jane");
    expect(body).toContain(PARTNER_SIGNUP_URL);
    expect(body).toContain("StageGate");
    expect(body).toContain("— Cal");
    expect(needsName).toBe(false);
  });

  it("flags missing contact name", () => {
    const { body, needsName } = buildCalPartnerEmail({
      company: "Freeman",
      contactEmail: "info@freeman.com",
    } as { company: string; contactEmail: string });
    expect(body).toContain("Hi Freeman team");
    expect(needsName).toBe(true);
  });

  it("detects generic inboxes", () => {
    expect(isGenericInbox("info@absoluteexhibits.com")).toBe(true);
    expect(isGenericInbox("sarah@freeman.com")).toBe(false);
  });

  it("resolves name from research", () => {
    const r = resolveGreetingName({
      company: "Acme",
      researchContactName: "Tom Wilson",
    });
    expect(r.greetingName).toBe("Tom");
    expect(r.needsName).toBe(false);
  });

  it("applies merge fields", () => {
    const out = applyPartnerMergeFields(
      "Hi {{contact_name}} at {{company}} — {{partner_hook}}",
      recipient,
    );
    expect(out).toContain("Jane");
    expect(out).toContain("Freeman");
    expect(out).toContain("exhibit teams");
  });

  it("normalizes impersonal Hey there opener", () => {
    const fixed = normalizeCalEmailGreeting(
      "Hey there,\n\nThis is Cal at StageGate.",
      "Hi Jane,",
    );
    expect(fixed).toBe("Hi Jane,\n\nThis is Cal at StageGate.");
    expect(fixed).not.toMatch(/Hey there/i);
  });

  it("uses company team greeting when no contact name", () => {
    expect(greetingLine(null, "Boston Dynamics")).toBe("Hi Boston Dynamics team,");
    expect(greetingLine(null)).toBe("Hello,");
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
