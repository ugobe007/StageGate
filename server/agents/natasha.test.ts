import { describe, expect, it } from "vitest";
import { NATASHA_PERSONA, NATASHA_REPORT_TITLE } from "./natashaPlaybook.js";
import { formatNatashaReport, type NatashaOperatorResult } from "./natashaOperator.js";

describe("Natasha playbook", () => {
  it("defines marketing persona", () => {
    expect(NATASHA_PERSONA.name).toBe("Natasha");
    expect(NATASHA_PERSONA.role).toBe("Marketing");
    expect(NATASHA_REPORT_TITLE).toMatch(/Growth/);
  });
});

describe("formatNatashaReport", () => {
  it("includes funnel and growth sections", () => {
    const result: NatashaOperatorResult = {
      funnel: {
        usersLast7d: 3,
        usersTotal: 50,
        newsletterLast7d: 2,
        newsletterTotal: 20,
        companyProfilesLast7d: 1,
        demosLast7d: 1,
        demosPending: 0,
        quotesLast7d: 0,
        quotesPending: 1,
      },
      brief: {
        socialPosts: ["Watch the floor before the robot"],
        newsletterHooks: ["Signup friction hides in the second click"],
        whitepaperTopics: ["Why demos stall after the booth"],
        uiExperiments: ["Move Register CTA into hero on mobile"],
        signupNudges: ["Shorten company profile form to 4 fields"],
      },
      errors: [],
    };

    const report = formatNatashaReport(result);
    expect(report).toContain(NATASHA_REPORT_TITLE);
    expect(report).toMatch(/Users \+3/);
    expect(report).toMatch(/Newsletter \+2/);
    expect(report).toMatch(/UI experiments/);
    expect(report).toMatch(/Signup nudges/);
    expect(report).toContain(NATASHA_PERSONA.signature);
  });
});
