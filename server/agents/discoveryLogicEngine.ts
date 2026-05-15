/**
 * server/agents/discoveryLogicEngine.ts
 *
 * Discovery Logic Engine — pre-ingest gate for the sales agent discovery pipeline.
 *
 * Pipeline:
 *   Raw scraped company names / LLM-discovered prospects
 *     → Tier 1: Junk Filter (synchronous, no LLM)
 *     → Tier 2: Robot Signal Check (synchronous keyword ontology)
 *     → Tier 3: LLM Logic Engine (is this a real company? what is the robot?)
 *     → Scored & enriched ScoredProspect[]
 *
 * Key questions answered per company:
 *   1. Is this a real company? (not a booth number, not a generic term, not a duplicate)
 *   2. What is the robot? (type, name, category)
 *   3. How relevant are they to Las Vegas trade shows?
 *
 * Design principle: We do NOT require confirmation that a company is attending any
 * specific conference. If they have robots and operate at scale, they will come to
 * Las Vegas for one of the many shows. We surmise attendance from robot ownership.
 */

import { invokeLLM } from "../_core/llm.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RobotType =
  | "humanoid"
  | "quadruped"
  | "wheeled_amr"
  | "industrial_arm"
  | "cobot"
  | "mobile_manipulator"
  | "drone"
  | "service_robot"
  | "surgical_robot"
  | "exoskeleton"
  | "other";

export type RobotCategory = "light" | "heavy_industrial" | "mixed";

export interface RawProspect {
  company: string;
  website?: string;
  contactName?: string;
  contactEmail?: string;
  contactTitle?: string;
  robotName?: string;
  robotType?: string;
  shows?: string[];
  notes?: string;
  emailConfidence?: string;
  contactTitle_?: string;
}

export interface ScoredProspect extends RawProspect {
  // Logic engine outputs
  isRealCompany: boolean;
  companyConfidence: number;       // 0.0–1.0
  companyReason: string;           // why accepted or rejected
  robotType: RobotType;
  robotCategory: RobotCategory;
  robotName: string;
  robotDescription: string;
  showRelevance: number;           // 0.0–1.0 — likelihood of Las Vegas show attendance
  junkFilterPassed: boolean;
  robotSignalPassed: boolean;
  logicEnginePassed: boolean;
  // Enriched contact fields (may be updated by logic engine)
  contactName: string;
  contactEmail: string;
  contactTitle: string;
  emailConfidence: "high" | "medium" | "low";
}

// ─── Tier 1: Junk Filter (synchronous) ───────────────────────────────────────

// Terms that indicate the "company name" is actually a booth label, section header,
// generic exhibitor category, or non-company entity.
const JUNK_PATTERNS: RegExp[] = [
  /^booth\s*#?\d+/i,
  /^exhibitor\s*\d+/i,
  /^(hall|pavilion|section|aisle|row)\s*[a-z0-9]/i,
  /^(new\s+exhibitor|first.time|returning)/i,
  /^\d{1,4}[a-z]?\s*$/i,           // Pure booth number: "312B"
  /^(tbd|tba|n\/a|unknown|pending)$/i,
  /^(the\s+)?(company|corporation|inc|llc|ltd|group)$/i,
  /^[^a-zA-Z]+$/,                   // No letters at all
];

// Minimum signals that suggest a real company name
const MIN_COMPANY_NAME_LENGTH = 3;
const MAX_COMPANY_NAME_LENGTH = 120;

export function passesJunkFilter(company: string, website?: string): boolean {
  if (!company || typeof company !== "string") return false;

  const trimmed = company.trim();

  // Length bounds
  if (trimmed.length < MIN_COMPANY_NAME_LENGTH) return false;
  if (trimmed.length > MAX_COMPANY_NAME_LENGTH) return false;

  // Junk patterns
  for (const pattern of JUNK_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }

  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(trimmed)) return false;

  // If website is provided, it must look like a real domain
  if (website) {
    const cleanWebsite = website.trim().toLowerCase();
    if (cleanWebsite && !/^https?:\/\//.test(cleanWebsite) && !cleanWebsite.includes(".")) {
      return false; // Malformed website
    }
  }

  return true;
}

// ─── Tier 2: Robot Signal Check (synchronous keyword ontology) ───────────────

// Ontological keyword map: robot signals → robot type classification
// This is the "what is the robot?" layer without LLM cost.
const ROBOT_ONTOLOGY: Record<RobotType, string[]> = {
  humanoid: [
    "humanoid", "bipedal", "biped", "android",
    "atlas humanoid", "atlas robot", "boston dynamics atlas",
    "digit robot", "figure ai", "figure 01", "figure 02",
    "optimus robot", "agility robotics", "apptronik", "sanctuary ai", "1x technologies",
    "fourier intelligence", "ubtech robotics", "nao robot", "pepper robot", "ameca robot",
    "engineered arts",
  ],
  quadruped: [
    "quadruped", "quadrupedal", "four-legged", "legged robot",
    "spot robot", "spot dog", "boston dynamics spot",
    "anymal", "unitree go1", "unitree go2", "unitree b1", "unitree b2", "laikago", "aliengo",
    "ghost robotics", "ghost vision", "mini cheetah", "cheetah robot",
  ],
  wheeled_amr: [
    "amr", "autonomous mobile robot", "agv", "automated guided vehicle",
    "mobile robot", "delivery robot", "last mile", "warehouse robot",
    "logistics robot", "bear robotics", "keenon", "aethon", "savioke",
    "servi robot", "pudu robotics", "richtech robotics", "ottonomy", "starship technologies",
    "kiwibot", "nuro", "serve robotics", "amazon scout", "wheeled robot",
  ],
  industrial_arm: [
    "industrial arm", "robotic arm", "articulated arm", "6-axis", "6 axis",
    "fanuc", "yaskawa", "kuka", "abb robotics", "universal robots", "ur3",
    "ur5", "ur10", "omron", "epson robots", "denso", "mitsubishi robot",
    "staubli", "kawasaki robot", "nachi", "cobra", "scara", "delta robot",
    "pick and place", "palletizing", "welding robot", "painting robot",
  ],
  cobot: [
    "cobot", "collaborative robot", "human-robot collaboration", "hrc",
    "universal robots", "ur series", "techman", "tm robot", "dobot",
    "aubo", "elite robots", "franka", "panda robot", "rethink robotics",
    "sawyer", "baxter", "kassow", "neura robotics",
  ],
  mobile_manipulator: [
    "mobile manipulator", "manipulation", "fetch robotics", "hello robot",
    "stretch robot", "kinova", "clearpath", "ridgeback", "husky robot",
    "mobile arm", "arm on wheels",
  ],
  drone: [
    "drone", "uav", "unmanned aerial", "quadcopter", "multirotor",
    "fixed wing", "dji", "parrot", "skydio", "zipline", "wing aviation",
    "amazon prime air", "aerial robot", "autonomous flight", "vtol",
    "eVTOL", "urban air mobility", "uam",
  ],
  service_robot: [
    "service robot", "hospitality robot", "hotel robot", "restaurant robot",
    "cleaning robot", "disinfection robot", "uvc robot", "floor cleaning",
    "autonomous cleaning", "lawnmower robot", "pool robot", "window cleaning",
    "social robot", "reception robot", "concierge robot",
  ],
  surgical_robot: [
    "surgical robot", "medical robot", "da vinci", "intuitive surgical",
    "robotic surgery", "minimally invasive", "laparoscopic robot",
    "orthopedic robot", "mako", "stryker robot", "medtronic robot",
  ],
  exoskeleton: [
    "exoskeleton", "exosuit", "powered suit", "wearable robot",
    "ekso", "sarcos", "suitx", "hyundai exoskeleton", "cyberdyne",
    "rewalk", "indego", "ekso bionics",
  ],
  other: [
    "robot", "robotics", "automation", "autonomous", "mechatronics",
    "actuator", "servo", "end effector", "gripper", "lidar", "slam",
    "ros", "robot operating system", "embedded", "computer vision",
    "machine learning robot", "ai robot", "intelligent machine",
    // Well-known robot companies (catch-all for company name matching)
    "boston dynamics", "unitree robotics", "clearpath robotics",
  ],
};

// Flat set of all robot keywords for quick signal check
// Note: short/ambiguous keywords (< 5 chars) use word-boundary matching in hasRobotSignal
const ALL_ROBOT_KEYWORDS = new Set(
  Object.values(ROBOT_ONTOLOGY).flat().map(k => k.toLowerCase())
);

// Short keywords that need word-boundary matching to avoid false positives
const WORD_BOUNDARY_KEYWORDS = new Set([
  "amr", "agv", "uav", "ros", "hrc", "uam", "slam",
]);

export function hasRobotSignal(
  company: string,
  robotName?: string,
  notes?: string,
  website?: string
): boolean {
  const haystack = [company, robotName, notes, website]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Direct keyword match (word-boundary for short/ambiguous terms)
  for (const keyword of Array.from(ALL_ROBOT_KEYWORDS)) {
    if (WORD_BOUNDARY_KEYWORDS.has(keyword)) {
      // Use word boundary to avoid false positives (e.g. "amr" in "pharmacy")
      const wordBoundaryRegex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i');
      if (wordBoundaryRegex.test(haystack)) return true;
    } else if (haystack.includes(keyword)) {
      return true;
    }
  }

  // Suffix patterns common in robotics companies
  if (/robotics?|automati(on|cs)|mechatronics|autonomous/i.test(haystack)) return true;

  return false;
}

export function inferRobotType(
  company: string,
  robotName?: string,
  notes?: string
): RobotType {
  const haystack = [company, robotName, notes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Check in priority order (most specific first)
  const priority: RobotType[] = [
    "humanoid", "quadruped", "surgical_robot", "exoskeleton",
    "mobile_manipulator", "cobot", "industrial_arm",
    "drone", "service_robot", "wheeled_amr", "other",
  ];

  for (const type of priority) {
    const keywords = ROBOT_ONTOLOGY[type];
    for (const kw of keywords) {
      if (haystack.includes(kw.toLowerCase())) return type;
    }
  }

  return "other";
}

export function inferRobotCategory(robotType: RobotType): RobotCategory {
  const heavy: RobotType[] = ["industrial_arm", "cobot", "mobile_manipulator"];
  const mixed: RobotType[] = ["wheeled_amr", "drone"];
  if (heavy.includes(robotType)) return "heavy_industrial";
  if (mixed.includes(robotType)) return "mixed";
  return "light";
}

// ─── Tier 3: LLM Logic Engine ─────────────────────────────────────────────────

interface LogicEngineResult {
  isRealCompany: boolean;
  confidence: number;
  reason: string;
  robotType: RobotType;
  robotName: string;
  robotDescription: string;
  showRelevance: number;
  contactName: string;
  contactEmail: string;
  contactTitle: string;
  emailConfidence: "high" | "medium" | "low";
}

const LLM_LOGIC_ENGINE_SCHEMA = {
  type: "object",
  properties: {
    isRealCompany: { type: "boolean" },
    confidence: { type: "number" },
    reason: { type: "string" },
    robotType: { type: "string" },
    robotName: { type: "string" },
    robotDescription: { type: "string" },
    showRelevance: { type: "number" },
    contactName: { type: "string" },
    contactEmail: { type: "string" },
    contactTitle: { type: "string" },
    emailConfidence: { type: "string" },
  },
  required: [
    "isRealCompany", "confidence", "reason", "robotType", "robotName",
    "robotDescription", "showRelevance", "contactName", "contactEmail",
    "contactTitle", "emailConfidence",
  ],
  additionalProperties: false,
} as const;

const VALID_ROBOT_TYPES = new Set<string>([
  "humanoid", "quadruped", "wheeled_amr", "industrial_arm", "cobot",
  "mobile_manipulator", "drone", "service_robot", "surgical_robot",
  "exoskeleton", "other",
]);

const VALID_EMAIL_CONFIDENCE = new Set<string>(["high", "medium", "low"]);

async function runLLMLogicEngine(
  prospect: RawProspect
): Promise<LogicEngineResult> {
  const prompt = `You are a robotics industry analyst for StageGate, a Las Vegas robotics activation company.

Evaluate this company for our outreach pipeline:

Company: ${prospect.company}
Website: ${prospect.website ?? "unknown"}
Robot Name: ${prospect.robotName ?? "unknown"}
Robot Type (initial guess): ${prospect.robotType ?? "unknown"}
Notes: ${prospect.notes ?? "none"}
Contact: ${prospect.contactName ?? "unknown"} (${prospect.contactTitle ?? "unknown"})

Answer these questions:

1. Is this a real robotics company? (not a generic term, not a booth label, not a non-robot company)
   - confidence: 0.0–1.0
   - reason: brief explanation

2. What is their robot?
   - robotType: one of humanoid | quadruped | wheeled_amr | industrial_arm | cobot | mobile_manipulator | drone | service_robot | surgical_robot | exoskeleton | other
   - robotName: their flagship product name (or "unknown")
   - robotDescription: 1-sentence description of what their robot does

3. Show relevance: 0.0–1.0 — how likely is this company to attend Las Vegas trade shows?
   - Key shows: CES, NAB, CEDIA, MODEX, ProMat, ICRA, ROSCon, Automate, MHI, PACK EXPO
   - Consider: company size, robot type, industry vertical, trade show history
   - NOTE: We do NOT require confirmation of attendance. If they have robots and operate at scale, we assume they will come to Las Vegas.

4. Best contact person for StageGate outreach:
   - contactName: full name (or best guess)
   - contactEmail: best guess email (firstname@company.com, info@company.com, etc.)
   - contactTitle: their likely title (VP Marketing, Head of Events, CEO for small companies)
   - emailConfidence: high | medium | low

Return ONLY valid JSON matching the schema. No markdown.`;

  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a robotics industry analyst. You know every major robot company, their products, and their trade show presence. Return ONLY valid JSON, no markdown.`,
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "logic_engine_result",
          strict: true,
          schema: LLM_LOGIC_ENGINE_SCHEMA,
        },
      },
    });

    const raw = result.choices?.[0]?.message?.content;
    const parsed = JSON.parse(typeof raw === "string" ? raw : "{}") as LogicEngineResult;

    // Sanitize outputs
    return {
      isRealCompany: Boolean(parsed.isRealCompany),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      reason: String(parsed.reason || ""),
      robotType: VALID_ROBOT_TYPES.has(parsed.robotType) ? parsed.robotType as RobotType : "other",
      robotName: String(parsed.robotName || prospect.robotName || "unknown"),
      robotDescription: String(parsed.robotDescription || ""),
      showRelevance: Math.max(0, Math.min(1, Number(parsed.showRelevance) || 0.5)),
      contactName: String(parsed.contactName || prospect.contactName || ""),
      contactEmail: String(parsed.contactEmail || prospect.contactEmail || ""),
      contactTitle: String(parsed.contactTitle || prospect.contactTitle || ""),
      emailConfidence: VALID_EMAIL_CONFIDENCE.has(parsed.emailConfidence)
        ? parsed.emailConfidence as "high" | "medium" | "low"
        : "low",
    };
  } catch (err) {
    console.warn(`[LogicEngine] LLM failed for ${prospect.company}:`, String(err).slice(0, 100));
    // Graceful fallback: use tier-1/2 results
    return {
      isRealCompany: true, // Benefit of the doubt if LLM fails
      confidence: 0.5,
      reason: "LLM unavailable — accepted by keyword signal",
      robotType: inferRobotType(prospect.company, prospect.robotName, prospect.notes),
      robotName: prospect.robotName ?? "unknown",
      robotDescription: "",
      showRelevance: 0.5,
      contactName: prospect.contactName ?? "",
      contactEmail: prospect.contactEmail ?? "",
      contactTitle: prospect.contactTitle ?? "",
      emailConfidence: (prospect.emailConfidence as "high" | "medium" | "low") ?? "low",
    };
  }
}

// ─── Main Export: filterAndClassify ──────────────────────────────────────────

export interface FilterAndClassifyOptions {
  skipLLM?: boolean;           // For testing — use only tier-1/2
  minShowRelevance?: number;   // Default 0.3 — filter out very low relevance
  minConfidence?: number;      // Default 0.4 — filter out low-confidence companies
  batchSize?: number;          // LLM batch size (default 5 concurrent)
}

export interface FilterResult {
  accepted: ScoredProspect[];
  rejected: RejectedProspect[];
  stats: FilterStats;
}

export interface RejectedProspect {
  company: string;
  reason: string;
  tier: "junk_filter" | "robot_signal" | "logic_engine";
}

export interface FilterStats {
  total: number;
  junkFiltered: number;
  noRobotSignal: number;
  logicEngineRejected: number;
  accepted: number;
}

export async function filterAndClassify(
  raw: RawProspect[],
  options: FilterAndClassifyOptions = {}
): Promise<FilterResult> {
  const {
    skipLLM = false,
    minShowRelevance = 0.3,
    minConfidence = 0.4,
  } = options;

  const accepted: ScoredProspect[] = [];
  const rejected: RejectedProspect[] = [];
  const stats: FilterStats = {
    total: raw.length,
    junkFiltered: 0,
    noRobotSignal: 0,
    logicEngineRejected: 0,
    accepted: 0,
  };

  // Tier 1 + 2: synchronous pre-filter
  const tier2Passed: RawProspect[] = [];

  for (const prospect of raw) {
    // Tier 1: Junk filter
    if (!passesJunkFilter(prospect.company, prospect.website)) {
      stats.junkFiltered++;
      rejected.push({
        company: prospect.company,
        reason: `Junk filter: invalid company name "${prospect.company}"`,
        tier: "junk_filter",
      });
      continue;
    }

    // Tier 2: Robot signal check
    if (!hasRobotSignal(prospect.company, prospect.robotName, prospect.notes, prospect.website)) {
      stats.noRobotSignal++;
      rejected.push({
        company: prospect.company,
        reason: `No robot signal found in company name, robot name, or notes`,
        tier: "robot_signal",
      });
      continue;
    }

    tier2Passed.push(prospect);
  }

  // Tier 3: LLM logic engine (batched)
  if (skipLLM) {
    // Test mode: accept all tier-2 passers with inferred values
    for (const prospect of tier2Passed) {
      const robotType = inferRobotType(prospect.company, prospect.robotName, prospect.notes);
      accepted.push({
        ...prospect,
        isRealCompany: true,
        companyConfidence: 0.8,
        companyReason: "Accepted by keyword signal (LLM skipped)",
        robotType,
        robotCategory: inferRobotCategory(robotType),
        robotName: prospect.robotName ?? "unknown",
        robotDescription: "",
        showRelevance: 0.7,
        junkFilterPassed: true,
        robotSignalPassed: true,
        logicEnginePassed: true,
        contactName: prospect.contactName ?? "",
        contactEmail: prospect.contactEmail ?? "",
        contactTitle: prospect.contactTitle ?? "",
        emailConfidence: (prospect.emailConfidence as "high" | "medium" | "low") ?? "low",
      });
    }
    stats.accepted = accepted.length;
    return { accepted, rejected, stats };
  }

  // Process in small batches to avoid rate limits
  const BATCH_SIZE = options.batchSize ?? 5;
  for (let i = 0; i < tier2Passed.length; i += BATCH_SIZE) {
    const batch = tier2Passed.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(p => runLLMLogicEngine(p))
    );

    for (let j = 0; j < batch.length; j++) {
      const prospect = batch[j];
      const result = results[j];

      if (result.status === "rejected") {
        // LLM error — accept with fallback values
        const robotType = inferRobotType(prospect.company, prospect.robotName, prospect.notes);
        accepted.push({
          ...prospect,
          isRealCompany: true,
          companyConfidence: 0.5,
          companyReason: "LLM error — accepted by keyword signal",
          robotType,
          robotCategory: inferRobotCategory(robotType),
          robotName: prospect.robotName ?? "unknown",
          robotDescription: "",
          showRelevance: 0.5,
          junkFilterPassed: true,
          robotSignalPassed: true,
          logicEnginePassed: true,
          contactName: prospect.contactName ?? "",
          contactEmail: prospect.contactEmail ?? "",
          contactTitle: prospect.contactTitle ?? "",
          emailConfidence: (prospect.emailConfidence as "high" | "medium" | "low") ?? "low",
        });
        continue;
      }

      const llm = result.value;

      // Apply logic engine thresholds
      if (!llm.isRealCompany || llm.confidence < minConfidence) {
        stats.logicEngineRejected++;
        rejected.push({
          company: prospect.company,
          reason: `Logic engine rejected: ${llm.reason} (confidence: ${llm.confidence.toFixed(2)})`,
          tier: "logic_engine",
        });
        continue;
      }

      if (llm.showRelevance < minShowRelevance) {
        stats.logicEngineRejected++;
        rejected.push({
          company: prospect.company,
          reason: `Low show relevance: ${llm.showRelevance.toFixed(2)} < ${minShowRelevance} threshold`,
          tier: "logic_engine",
        });
        continue;
      }

      const robotType = VALID_ROBOT_TYPES.has(llm.robotType) ? llm.robotType : inferRobotType(prospect.company, prospect.robotName, prospect.notes);

      accepted.push({
        ...prospect,
        isRealCompany: true,
        companyConfidence: llm.confidence,
        companyReason: llm.reason,
        robotType,
        robotCategory: inferRobotCategory(robotType),
        robotName: llm.robotName,
        robotDescription: llm.robotDescription,
        showRelevance: llm.showRelevance,
        junkFilterPassed: true,
        robotSignalPassed: true,
        logicEnginePassed: true,
        contactName: llm.contactName || prospect.contactName || "",
        contactEmail: llm.contactEmail || prospect.contactEmail || "",
        contactTitle: llm.contactTitle || prospect.contactTitle || "",
        emailConfidence: llm.emailConfidence,
      });
    }
  }

  stats.accepted = accepted.length;
  return { accepted, rejected, stats };
}

// ─── HTML Extraction Helpers ──────────────────────────────────────────────────
// Used by salesAgentDiscovery.ts for structured extraction before raw text fallback.

/**
 * Extract company names from structured HTML exhibitor list patterns.
 * Handles: <table>, <ul>, <dl>, common exhibitor list div patterns.
 * Returns an array of raw company name strings.
 */
export function extractCompanyNamesFromHtml(html: string): string[] {
  const companies = new Set<string>();

  // Pattern 1: Table cells with company names (common in trade show exhibitor lists)
  const tableCellPattern = /<t[dh][^>]*>([^<]{3,80})<\/t[dh]>/gi;
  let match: RegExpExecArray | null;
  while ((match = tableCellPattern.exec(html)) !== null) {
    const text = match[1].trim();
    if (looksLikeCompanyName(text)) companies.add(text);
  }

  // Pattern 2: List items
  const listItemPattern = /<li[^>]*>(?:<[^>]+>)*([^<]{3,80})(?:<[^>]+>)*<\/li>/gi;
  while ((match = listItemPattern.exec(html)) !== null) {
    const text = match[1].trim();
    if (looksLikeCompanyName(text)) companies.add(text);
  }

  // Pattern 3: Links with company-like text (exhibitor name links)
  const linkPattern = /<a[^>]*>([^<]{3,80})<\/a>/gi;
  while ((match = linkPattern.exec(html)) !== null) {
    const text = match[1].trim();
    if (looksLikeCompanyName(text)) companies.add(text);
  }

  // Pattern 4: Definition list terms
  const dtPattern = /<dt[^>]*>([^<]{3,80})<\/dt>/gi;
  while ((match = dtPattern.exec(html)) !== null) {
    const text = match[1].trim();
    if (looksLikeCompanyName(text)) companies.add(text);
  }

  // Pattern 5: Common exhibitor div class patterns
  const divPattern = /<div[^>]*class="[^"]*(?:exhibitor|company|booth|vendor|member)[^"]*"[^>]*>(?:<[^>]+>)*([^<]{3,80})/gi;
  while ((match = divPattern.exec(html)) !== null) {
    const text = match[1].trim();
    if (looksLikeCompanyName(text)) companies.add(text);
  }

  return Array.from(companies);
}

/**
 * Heuristic: does this string look like a company name?
 * Rejects: pure numbers, very short strings, HTML artifacts, navigation text.
 */
function looksLikeCompanyName(text: string): boolean {
  if (!text || text.length < 3 || text.length > 100) return false;
  if (!/[a-zA-Z]/.test(text)) return false;  // Must have letters
  if (/^(home|about|contact|search|login|register|next|prev|back|more|view|all|show|hide|click|here|menu|nav)$/i.test(text)) return false;
  if (/^\d+$/.test(text)) return false;  // Pure number
  if (/^(booth|hall|pavilion|row|aisle)\s*\d/i.test(text)) return false;
  if (text.includes("<") || text.includes(">")) return false;  // HTML artifact
  return true;
}

/**
 * Detect pagination links in HTML.
 * Returns the URL of the next page if found, otherwise null.
 */
export function detectPaginationUrl(html: string, baseUrl: string): string | null {
  // Pattern 1: rel="next" link
  const relNextPattern = /<a[^>]*rel="next"[^>]*href="([^"]+)"/i;
  let match = relNextPattern.exec(html);
  if (match) return resolveUrl(match[1], baseUrl);

  // Pattern 2: "Next" or "Next Page" link text
  const nextTextPattern = /<a[^>]*href="([^"#][^"]*)"[^>]*>(?:<[^>]+>)*\s*(?:next|next\s*page|›|»|&rsaquo;|&raquo;)\s*(?:<[^>]+>)*<\/a>/i;
  match = nextTextPattern.exec(html);
  if (match) return resolveUrl(match[1], baseUrl);

  // Pattern 3: page=N+1 pattern in URL
  const pageParamPattern = /<a[^>]*href="([^"]*[?&]page=(\d+)[^"]*)"[^>]*>/gi;
  let maxPage = 0;
  let maxPageUrl = "";
  let pageMatch: RegExpExecArray | null;
  while ((pageMatch = pageParamPattern.exec(html)) !== null) {
    const pageNum = parseInt(pageMatch[2], 10);
    if (pageNum > maxPage) {
      maxPage = pageNum;
      maxPageUrl = pageMatch[1];
    }
  }
  if (maxPageUrl) return resolveUrl(maxPageUrl, baseUrl);

  return null;
}

function resolveUrl(href: string, baseUrl: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) {
    try {
      const base = new URL(baseUrl);
      return `${base.protocol}//${base.host}${href}`;
    } catch {
      return href;
    }
  }
  return `${baseUrl.replace(/\/[^/]*$/, "")}/${href}`;
}
