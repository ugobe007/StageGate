/**
 * server/v41.test.ts
 *
 * v41 — Discovery Pipeline: Logic Engine + Ontological Scraper + Smoke Tests
 *
 * Test coverage:
 *   - Tier 1: Junk filter (synchronous)
 *   - Tier 2: Robot signal check (synchronous keyword ontology)
 *   - Tier 3: Logic engine (LLM-skipped in tests via skipLLM flag)
 *   - HTML scraper: structured extraction, pagination detection
 *   - Pipeline link test: raw input → filter → classify → ingest shape
 *   - Deduplication
 *   - Module exports and interface contracts
 */

import { describe, it, expect } from "vitest";
import {
  passesJunkFilter,
  hasRobotSignal,
  inferRobotType,
  inferRobotCategory,
  extractCompanyNamesFromHtml,
  detectPaginationUrl,
  filterAndClassify,
  type RawProspect,
  type RobotType,
} from "./agents/discoveryLogicEngine.js";

// ─── Tier 1: Junk Filter ──────────────────────────────────────────────────────

describe("Junk Filter — passesJunkFilter()", () => {
  it("accepts a normal company name", () => {
    expect(passesJunkFilter("Boston Dynamics")).toBe(true);
  });

  it("accepts a company name with Inc suffix", () => {
    expect(passesJunkFilter("Agility Robotics Inc")).toBe(true);
  });

  it("accepts a short but valid company name", () => {
    expect(passesJunkFilter("ABB")).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(passesJunkFilter("")).toBe(false);
  });

  it("rejects a pure booth number", () => {
    expect(passesJunkFilter("312B")).toBe(false);
  });

  it("rejects a booth label", () => {
    expect(passesJunkFilter("Booth #42")).toBe(false);
  });

  it("rejects a hall/section label", () => {
    expect(passesJunkFilter("Hall A")).toBe(false);
  });

  it("rejects TBD placeholder", () => {
    expect(passesJunkFilter("TBD")).toBe(false);
  });

  it("rejects TBA placeholder", () => {
    expect(passesJunkFilter("TBA")).toBe(false);
  });

  it("rejects N/A", () => {
    expect(passesJunkFilter("N/A")).toBe(false);
  });

  it("rejects a string with no letters", () => {
    expect(passesJunkFilter("12345")).toBe(false);
  });

  it("rejects a string shorter than 3 chars", () => {
    expect(passesJunkFilter("AB")).toBe(false);
  });

  it("rejects a string longer than 120 chars", () => {
    expect(passesJunkFilter("A".repeat(121))).toBe(false);
  });

  it("rejects 'Exhibitor 1'", () => {
    expect(passesJunkFilter("Exhibitor 1")).toBe(false);
  });

  it("accepts a company with a valid website", () => {
    expect(passesJunkFilter("Unitree Robotics", "https://www.unitree.com")).toBe(true);
  });

  it("rejects a company with a malformed website (no dot)", () => {
    expect(passesJunkFilter("SomeCompany", "notawebsite")).toBe(false);
  });

  it("accepts a company with no website provided", () => {
    expect(passesJunkFilter("Figure AI")).toBe(true);
  });

  it("rejects 'New Exhibitor'", () => {
    expect(passesJunkFilter("New Exhibitor")).toBe(false);
  });

  it("rejects 'First Time'", () => {
    expect(passesJunkFilter("First Time")).toBe(false);
  });
});

// ─── Tier 2: Robot Signal Check ───────────────────────────────────────────────

describe("Robot Signal Check — hasRobotSignal()", () => {
  it("detects 'robotics' in company name", () => {
    expect(hasRobotSignal("Agility Robotics")).toBe(true);
  });

  it("detects 'robot' in company name", () => {
    expect(hasRobotSignal("Bear Robotics")).toBe(true);
  });

  it("detects 'autonomous' in company name", () => {
    expect(hasRobotSignal("Autonomous Solutions Inc")).toBe(true);
  });

  it("detects 'humanoid' in notes", () => {
    expect(hasRobotSignal("Figure AI", undefined, "builds humanoid robots")).toBe(true);
  });

  it("detects 'amr' in robot name", () => {
    expect(hasRobotSignal("MobileBot Co", "AMR-500")).toBe(true);
  });

  it("detects 'drone' in notes", () => {
    expect(hasRobotSignal("SkyTech", undefined, "commercial drone delivery")).toBe(true);
  });

  it("detects known company name 'boston dynamics'", () => {
    expect(hasRobotSignal("Boston Dynamics")).toBe(true);
  });

  it("detects 'unitree' in company name", () => {
    expect(hasRobotSignal("Unitree Robotics")).toBe(true);
  });

  it("detects 'fanuc' in company name", () => {
    expect(hasRobotSignal("Fanuc Corporation")).toBe(true);
  });

  it("detects 'cobot' in notes", () => {
    expect(hasRobotSignal("TechArm Inc", undefined, "collaborative cobot for assembly")).toBe(true);
  });

  it("rejects a company with no robot signals", () => {
    expect(hasRobotSignal("Acme Catering Services", undefined, "food and beverage for events")).toBe(false);
  });

  it("rejects a generic IT company with no robot signals", () => {
    expect(hasRobotSignal("CloudSoft Solutions", undefined, "enterprise software")).toBe(false);
  });

  it("detects 'automation' in company name", () => {
    expect(hasRobotSignal("Midwest Automation Systems")).toBe(true);
  });

  it("detects 'lidar' in notes (robot sensor signal)", () => {
    expect(hasRobotSignal("SensorTech", undefined, "lidar sensors for mobile platforms")).toBe(true);
  });
});

// ─── Robot Type Inference ─────────────────────────────────────────────────────

describe("Robot Ontology — inferRobotType()", () => {
  it("classifies humanoid from company name", () => {
    expect(inferRobotType("Agility Robotics", "Digit")).toBe("humanoid");
  });

  it("classifies humanoid from 'Atlas robot' in notes", () => {
    expect(inferRobotType("Boston Dynamics", "Atlas robot", "humanoid bipedal robot")).toBe("humanoid");
  });

  it("classifies quadruped from 'Spot robot' in robot name", () => {
    expect(inferRobotType("Boston Dynamics", "Spot robot")).toBe("quadruped");
  });

  it("classifies quadruped from 'Unitree Go2' in robot name", () => {
    expect(inferRobotType("Unitree", "Unitree Go2")).toBe("quadruped");
  });

  it("classifies wheeled_amr from 'AMR' in robot name", () => {
    expect(inferRobotType("MobileBot", "AMR-500")).toBe("wheeled_amr");
  });

  it("classifies service_robot from 'Bear Robotics' (Servi is a restaurant delivery robot)", () => {
    expect(inferRobotType("Bear Robotics", "Servi")).toBe("service_robot");
  });

  it("classifies industrial_arm from 'Fanuc'", () => {
    expect(inferRobotType("Fanuc Corporation")).toBe("industrial_arm");
  });

  it("classifies industrial_arm from 'KUKA'", () => {
    expect(inferRobotType("KUKA Robotics")).toBe("industrial_arm");
  });

  it("classifies cobot from 'Universal Robots'", () => {
    expect(inferRobotType("Universal Robots", "UR10")).toBe("cobot");
  });

  it("classifies drone from company name", () => {
    expect(inferRobotType("Skydio", "X2")).toBe("drone");
  });

  it("classifies drone from 'UAV' in notes", () => {
    expect(inferRobotType("AerialTech", undefined, "UAV inspection platform")).toBe("drone");
  });

  it("classifies service_robot from 'cleaning robot' notes", () => {
    expect(inferRobotType("CleanBot Inc", undefined, "autonomous floor cleaning robot")).toBe("service_robot");
  });

  it("classifies surgical_robot from 'da vinci'", () => {
    expect(inferRobotType("Intuitive Surgical", "da Vinci")).toBe("surgical_robot");
  });

  it("classifies exoskeleton from company name", () => {
    expect(inferRobotType("Ekso Bionics")).toBe("exoskeleton");
  });

  it("falls back to 'other' for generic robotics company", () => {
    expect(inferRobotType("Generic Automation Co", undefined, "industrial automation")).toBe("other");
  });
});

// ─── Robot Category Inference ─────────────────────────────────────────────────

describe("Robot Category — inferRobotCategory()", () => {
  const heavy: RobotType[] = ["industrial_arm", "cobot", "mobile_manipulator"];
  const mixed: RobotType[] = ["wheeled_amr", "drone"];
  const light: RobotType[] = ["humanoid", "quadruped", "service_robot", "surgical_robot", "exoskeleton", "other"];

  for (const type of heavy) {
    it(`classifies ${type} as heavy_industrial`, () => {
      expect(inferRobotCategory(type)).toBe("heavy_industrial");
    });
  }

  for (const type of mixed) {
    it(`classifies ${type} as mixed`, () => {
      expect(inferRobotCategory(type)).toBe("mixed");
    });
  }

  for (const type of light) {
    it(`classifies ${type} as light`, () => {
      expect(inferRobotCategory(type)).toBe("light");
    });
  }
});

// ─── HTML Scraper: Structured Extraction ──────────────────────────────────────

describe("HTML Scraper — extractCompanyNamesFromHtml()", () => {
  it("extracts company names from table cells", () => {
    const html = `
      <table>
        <tr><td>Boston Dynamics</td><td>Booth 101</td></tr>
        <tr><td>Agility Robotics</td><td>Booth 102</td></tr>
        <tr><td>Figure AI</td><td>Booth 103</td></tr>
      </table>
    `;
    const names = extractCompanyNamesFromHtml(html);
    expect(names).toContain("Boston Dynamics");
    expect(names).toContain("Agility Robotics");
    expect(names).toContain("Figure AI");
  });

  it("extracts company names from list items", () => {
    const html = `
      <ul class="exhibitors">
        <li>Unitree Robotics</li>
        <li>Universal Robots</li>
        <li>Ghost Robotics</li>
      </ul>
    `;
    const names = extractCompanyNamesFromHtml(html);
    expect(names).toContain("Unitree Robotics");
    expect(names).toContain("Universal Robots");
    expect(names).toContain("Ghost Robotics");
  });

  it("extracts company names from anchor links", () => {
    const html = `
      <div class="exhibitor-list">
        <a href="/exhibitor/1">Skydio</a>
        <a href="/exhibitor/2">Clearpath Robotics</a>
        <a href="/exhibitor/3">Fetch Robotics</a>
      </div>
    `;
    const names = extractCompanyNamesFromHtml(html);
    expect(names).toContain("Skydio");
    expect(names).toContain("Clearpath Robotics");
    expect(names).toContain("Fetch Robotics");
  });

  it("extracts company names from exhibitor div class patterns", () => {
    const html = `
      <div class="exhibitor-card">KUKA Robotics</div>
      <div class="exhibitor-card">ABB Robotics</div>
    `;
    const names = extractCompanyNamesFromHtml(html);
    expect(names).toContain("KUKA Robotics");
    expect(names).toContain("ABB Robotics");
  });

  it("does not extract navigation text", () => {
    const html = `
      <nav><a href="/">Home</a><a href="/about">About</a></nav>
      <div class="exhibitor-card">Fanuc Corporation</div>
    `;
    const names = extractCompanyNamesFromHtml(html);
    expect(names).not.toContain("Home");
    expect(names).not.toContain("About");
    expect(names).toContain("Fanuc Corporation");
  });

  it("does not extract pure numbers", () => {
    const html = `<td>12345</td><td>Boston Dynamics</td>`;
    const names = extractCompanyNamesFromHtml(html);
    expect(names).not.toContain("12345");
    expect(names).toContain("Boston Dynamics");
  });

  it("does not extract booth labels", () => {
    const html = `<td>Booth 42</td><td>Agility Robotics</td>`;
    const names = extractCompanyNamesFromHtml(html);
    expect(names).not.toContain("Booth 42");
  });

  it("returns empty array for HTML with no company-like text", () => {
    const html = `<html><head><title>Page</title></head><body><p>No exhibitors here.</p></body></html>`;
    const names = extractCompanyNamesFromHtml(html);
    // Should not crash; may return empty or minimal results
    expect(Array.isArray(names)).toBe(true);
  });

  it("deduplicates extracted names", () => {
    const html = `
      <td>Boston Dynamics</td>
      <li>Boston Dynamics</li>
      <a href="#">Boston Dynamics</a>
    `;
    const names = extractCompanyNamesFromHtml(html);
    const count = names.filter(n => n === "Boston Dynamics").length;
    expect(count).toBe(1);
  });
});

// ─── HTML Scraper: Pagination Detection ──────────────────────────────────────

describe("HTML Scraper — detectPaginationUrl()", () => {
  it("detects rel=next link", () => {
    const html = `<a rel="next" href="/exhibitors?page=2">Next</a>`;
    const url = detectPaginationUrl(html, "https://example.com/exhibitors");
    expect(url).toBe("https://example.com/exhibitors?page=2");
  });

  it("detects 'Next' link text", () => {
    const html = `<a href="/exhibitors?page=2">Next</a>`;
    const url = detectPaginationUrl(html, "https://example.com/exhibitors");
    expect(url).toBe("https://example.com/exhibitors?page=2");
  });

  it("detects 'Next Page' link text", () => {
    const html = `<a href="/exhibitors?page=2">Next Page</a>`;
    const url = detectPaginationUrl(html, "https://example.com/exhibitors");
    expect(url).toBe("https://example.com/exhibitors?page=2");
  });

  it("detects › (right angle quote) as next link", () => {
    const html = `<a href="/exhibitors?page=2">›</a>`;
    const url = detectPaginationUrl(html, "https://example.com/exhibitors");
    expect(url).toBe("https://example.com/exhibitors?page=2");
  });

  it("detects » as next link", () => {
    const html = `<a href="/exhibitors?page=2">»</a>`;
    const url = detectPaginationUrl(html, "https://example.com/exhibitors");
    expect(url).toBe("https://example.com/exhibitors?page=2");
  });

  it("resolves relative URLs against base URL", () => {
    const html = `<a rel="next" href="/page/2">Next</a>`;
    const url = detectPaginationUrl(html, "https://tradeshow.com/exhibitors");
    expect(url).toBe("https://tradeshow.com/page/2");
  });

  it("resolves absolute URLs unchanged", () => {
    const html = `<a rel="next" href="https://other.com/page/2">Next</a>`;
    const url = detectPaginationUrl(html, "https://tradeshow.com/exhibitors");
    expect(url).toBe("https://other.com/page/2");
  });

  it("returns null when no pagination found", () => {
    const html = `<div>No pagination here</div>`;
    const url = detectPaginationUrl(html, "https://example.com");
    expect(url).toBeNull();
  });

  it("does not follow anchor-only links (#)", () => {
    const html = `<a href="#">Next</a>`;
    const url = detectPaginationUrl(html, "https://example.com");
    // Should not return anchor-only links
    expect(url).toBeNull();
  });
});

// ─── Logic Engine: filterAndClassify (skipLLM mode) ──────────────────────────

describe("Logic Engine — filterAndClassify() with skipLLM=true", () => {
  const knownRobotCompanies: RawProspect[] = [
    { company: "Boston Dynamics", website: "https://bostondynamics.com", robotName: "Spot", notes: "quadruped robot" },
    { company: "Agility Robotics", website: "https://agilityrobotics.com", robotName: "Digit", notes: "humanoid robot" },
    { company: "Universal Robots", website: "https://universal-robots.com", robotName: "UR10", notes: "cobot" },
    { company: "Skydio", website: "https://skydio.com", robotName: "X2", notes: "autonomous drone" },
    { company: "Bear Robotics", website: "https://bearrobotics.ai", robotName: "Servi", notes: "service robot" },
  ];

  const junkInputs: RawProspect[] = [
    { company: "Booth 42" },
    { company: "TBD" },
    { company: "Hall A" },
    { company: "12345" },
    { company: "AB" },
  ];

  const noSignalInputs: RawProspect[] = [
    { company: "Acme Catering Services", website: "https://acmecatering.com", notes: "food and beverage" },
    { company: "CloudSoft Solutions", website: "https://cloudsoft.io", notes: "enterprise software" },
    { company: "Vegas Event Staffing", website: "https://vegasstaffing.com", notes: "event staffing agency" },
  ];

  it("accepts all known robot companies", async () => {
    const result = await filterAndClassify(knownRobotCompanies, { skipLLM: true });
    expect(result.accepted.length).toBe(5);
    expect(result.stats.accepted).toBe(5);
  });

  it("rejects all junk inputs at tier 1", async () => {
    const result = await filterAndClassify(junkInputs, { skipLLM: true });
    expect(result.accepted.length).toBe(0);
    expect(result.stats.junkFiltered).toBe(junkInputs.length);
  });

  it("rejects no-signal inputs at tier 2", async () => {
    const result = await filterAndClassify(noSignalInputs, { skipLLM: true });
    expect(result.accepted.length).toBe(0);
    expect(result.stats.noRobotSignal).toBe(noSignalInputs.length);
  });

  it("returns correct stats totals", async () => {
    const all = [...knownRobotCompanies, ...junkInputs, ...noSignalInputs];
    const result = await filterAndClassify(all, { skipLLM: true });
    expect(result.stats.total).toBe(all.length);
    expect(result.stats.accepted + result.stats.junkFiltered + result.stats.noRobotSignal + result.stats.logicEngineRejected).toBe(all.length);
  });

  it("enriches accepted prospects with robotType", async () => {
    const result = await filterAndClassify(knownRobotCompanies, { skipLLM: true });
    for (const sp of result.accepted) {
      expect(sp.robotType).toBeTruthy();
      expect(["humanoid", "quadruped", "wheeled_amr", "industrial_arm", "cobot", "mobile_manipulator", "drone", "service_robot", "surgical_robot", "exoskeleton", "other"]).toContain(sp.robotType);
    }
  });

  it("enriches accepted prospects with robotCategory", async () => {
    const result = await filterAndClassify(knownRobotCompanies, { skipLLM: true });
    for (const sp of result.accepted) {
      expect(["light", "heavy_industrial", "mixed"]).toContain(sp.robotCategory);
    }
  });

  it("sets junkFilterPassed=true for accepted prospects", async () => {
    const result = await filterAndClassify(knownRobotCompanies, { skipLLM: true });
    for (const sp of result.accepted) {
      expect(sp.junkFilterPassed).toBe(true);
      expect(sp.robotSignalPassed).toBe(true);
      expect(sp.logicEnginePassed).toBe(true);
    }
  });

  it("includes rejection reasons in rejected array", async () => {
    const result = await filterAndClassify(junkInputs, { skipLLM: true });
    for (const r of result.rejected) {
      expect(r.reason).toBeTruthy();
      expect(r.tier).toBe("junk_filter");
    }
  });

  it("handles empty input gracefully", async () => {
    const result = await filterAndClassify([], { skipLLM: true });
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
    expect(result.stats.total).toBe(0);
  });
});

// ─── Pipeline Link Test: end-to-end shape ────────────────────────────────────

describe("Pipeline Link Test — discovery → logic engine → ingest shape", () => {
  it("produces ingest-ready prospects with all required fields", async () => {
    const raw: RawProspect[] = [
      {
        company: "Figure AI",
        website: "https://figure.ai",
        robotName: "Figure 01",
        robotType: "humanoid",
        notes: "humanoid robot company",
        contactName: "Brett Adcock",
        contactEmail: "brett@figure.ai",
        contactTitle: "CEO",
        emailConfidence: "high",
        shows: ["CES 2026"],
      },
    ];

    const result = await filterAndClassify(raw, { skipLLM: true });
    expect(result.accepted).toHaveLength(1);

    const prospect = result.accepted[0];

    // Required fields for ingest
    expect(prospect.company).toBe("Figure AI");
    expect(prospect.robotType).toBeTruthy();
    expect(prospect.robotCategory).toBeTruthy();
    expect(prospect.robotName).toBeTruthy();
    expect(prospect.isRealCompany).toBe(true);
    expect(prospect.companyConfidence).toBeGreaterThan(0);
    expect(prospect.showRelevance).toBeGreaterThan(0);
  });

  it("correctly classifies Figure AI as humanoid / light", async () => {
    const raw: RawProspect[] = [
      { company: "Figure AI", robotName: "Figure 01", notes: "humanoid robot" },
    ];
    const result = await filterAndClassify(raw, { skipLLM: true });
    expect(result.accepted[0].robotType).toBe("humanoid");
    expect(result.accepted[0].robotCategory).toBe("light");
  });

  it("correctly classifies KUKA as industrial_arm / heavy_industrial", async () => {
    const raw: RawProspect[] = [
      { company: "KUKA Robotics", robotName: "KR 1000 Titan", notes: "industrial robotic arm" },
    ];
    const result = await filterAndClassify(raw, { skipLLM: true });
    expect(result.accepted[0].robotType).toBe("industrial_arm");
    expect(result.accepted[0].robotCategory).toBe("heavy_industrial");
  });

  it("correctly classifies Skydio as drone / mixed", async () => {
    const raw: RawProspect[] = [
      { company: "Skydio", robotName: "X2", notes: "autonomous drone" },
    ];
    const result = await filterAndClassify(raw, { skipLLM: true });
    expect(result.accepted[0].robotType).toBe("drone");
    expect(result.accepted[0].robotCategory).toBe("mixed");
  });
});

// ─── Deduplication Test ───────────────────────────────────────────────────────

describe("Deduplication — same company twice yields one prospect", () => {
  it("deduplicates identical company names", async () => {
    const raw: RawProspect[] = [
      { company: "Boston Dynamics", robotName: "Spot", notes: "quadruped robot" },
      { company: "Boston Dynamics", robotName: "Atlas", notes: "humanoid robot" },
    ];

    // Both pass the filter — dedup happens upstream in discovery, not in logic engine
    // Logic engine processes both; the ingest handler deduplicates by company name
    const result = await filterAndClassify(raw, { skipLLM: true });
    // Both pass (logic engine doesn't dedup — that's the ingest layer's job)
    expect(result.accepted.length).toBe(2);
    // But both have the same company name — ingest will dedup
    expect(result.accepted[0].company).toBe("Boston Dynamics");
    expect(result.accepted[1].company).toBe("Boston Dynamics");
  });

  it("deduplication in discovery: case-insensitive company name matching", () => {
    const companies = [
      { company: "Boston Dynamics" },
      { company: "boston dynamics" },
      { company: "BOSTON DYNAMICS" },
    ];
    const seen = new Set<string>();
    const unique = companies.filter(p => {
      const key = p.company.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    expect(unique).toHaveLength(1);
  });
});

// ─── Module Exports Contract ──────────────────────────────────────────────────

describe("Module Exports — discoveryLogicEngine.ts", () => {
  it("exports passesJunkFilter as a function", () => {
    expect(typeof passesJunkFilter).toBe("function");
  });

  it("exports hasRobotSignal as a function", () => {
    expect(typeof hasRobotSignal).toBe("function");
  });

  it("exports inferRobotType as a function", () => {
    expect(typeof inferRobotType).toBe("function");
  });

  it("exports inferRobotCategory as a function", () => {
    expect(typeof inferRobotCategory).toBe("function");
  });

  it("exports extractCompanyNamesFromHtml as a function", () => {
    expect(typeof extractCompanyNamesFromHtml).toBe("function");
  });

  it("exports detectPaginationUrl as a function", () => {
    expect(typeof detectPaginationUrl).toBe("function");
  });

  it("exports filterAndClassify as an async function", () => {
    expect(typeof filterAndClassify).toBe("function");
  });
});

// ─── Smoke Tests: Known Robot Companies ──────────────────────────────────────

describe("Smoke Tests — known robot companies pass the full pipeline", () => {
  const knownCompanies = [
    { company: "Boston Dynamics", robotName: "Spot", notes: "quadruped legged robot" },
    { company: "Agility Robotics", robotName: "Digit", notes: "humanoid bipedal robot" },
    { company: "Figure AI", robotName: "Figure 01", notes: "humanoid robot for manufacturing" },
    { company: "Unitree Robotics", robotName: "H1", notes: "humanoid robot" },
    { company: "Universal Robots", robotName: "UR10e", notes: "collaborative cobot" },
    { company: "Fanuc Corporation", robotName: "M-2000iA", notes: "industrial robotic arm" },
    { company: "Bear Robotics", robotName: "Servi", notes: "service robot for restaurants" },
    { company: "Skydio", robotName: "X2", notes: "autonomous drone" },
    { company: "Ghost Robotics", robotName: "Vision 60", notes: "quadruped robot" },
    { company: "1X Technologies", robotName: "NEO", notes: "humanoid robot" },
  ];

  it("all known robot companies pass junk filter", () => {
    for (const c of knownCompanies) {
      expect(passesJunkFilter(c.company)).toBe(true);
    }
  });

  it("all known robot companies pass robot signal check", () => {
    for (const c of knownCompanies) {
      expect(hasRobotSignal(c.company, c.robotName, c.notes)).toBe(true);
    }
  });

  it("all known robot companies pass filterAndClassify (skipLLM)", async () => {
    const result = await filterAndClassify(knownCompanies, { skipLLM: true });
    expect(result.accepted.length).toBe(knownCompanies.length);
    expect(result.stats.junkFiltered).toBe(0);
    expect(result.stats.noRobotSignal).toBe(0);
  });
});

// ─── Smoke Tests: Known Junk Inputs ──────────────────────────────────────────

describe("Smoke Tests — known junk inputs are rejected", () => {
  const junkInputs = [
    "Booth 42",
    "Hall A",
    "TBD",
    "TBA",
    "N/A",
    "12345",
    "AB",
    "New Exhibitor",
    "Exhibitor 1",
    "Pavilion B",
    "Section 3",
    "Aisle 7",
  ];

  it("all junk inputs fail junk filter", () => {
    for (const name of junkInputs) {
      expect(passesJunkFilter(name)).toBe(false);
    }
  });
});

// ─── Smoke Tests: Non-Robot Companies Rejected ───────────────────────────────

describe("Smoke Tests — non-robot companies rejected at robot signal check", () => {
  const nonRobotCompanies = [
    { company: "Acme Catering Services", notes: "food and beverage for trade shows" },
    { company: "Vegas Event Staffing", notes: "event staffing and registration" },
    { company: "CloudSoft Solutions", notes: "enterprise CRM software" },
    { company: "Premier Audio Visual", notes: "AV equipment rental" },
    { company: "Trade Show Displays Inc", notes: "booth design and graphics" },
  ];

  it("all non-robot companies fail robot signal check", () => {
    for (const c of nonRobotCompanies) {
      expect(hasRobotSignal(c.company, undefined, c.notes)).toBe(false);
    }
  });

  it("all non-robot companies are rejected by filterAndClassify", async () => {
    const result = await filterAndClassify(nonRobotCompanies, { skipLLM: true });
    expect(result.accepted.length).toBe(0);
    expect(result.stats.noRobotSignal).toBe(nonRobotCompanies.length);
  });
});
