/**
 * server/agents/salesAgentDiscovery.ts
 *
 * Sales Agent Discovery Handler
 * Runs nightly at 2am UTC via heartbeat cron.
 *
 * Pipeline (in order):
 *   1. For each show with an exhibitorListUrl: fetch the page, run structured HTML
 *      extraction (tables, lists, links), then fall back to raw text stripping.
 *   2. Follow pagination links (up to MAX_PAGES per show).
 *   3. LLM identifies robot companies from the extracted text/names.
 *   4. For shows without a URL (or if fetch fails): LLM web-knowledge fallback.
 *   5. All discovered prospects pass through the Logic Engine (junk filter →
 *      robot signal check → LLM real-company + ontology classification).
 *   6. Survivors are POST-ed to the ingest endpoint.
 *
 * Key design principle: We do NOT require confirmation that a company is attending
 * any specific conference. If they have robots and operate at scale, they will come
 * to Las Vegas for one of the many shows. We surmise attendance from robot ownership.
 */

import type { Request, Response } from "express";
import { getDb } from "../db.js";
import { salesAgentRuns, tradeShows } from "../../drizzle/schema.js";
import { eq, isNotNull } from "drizzle-orm";
import { invokeLLM } from "../_core/llm.js";
import { sdk } from "../_core/sdk.js";
import {
  filterAndClassify,
  extractCompanyNamesFromHtml,
  detectPaginationUrl,
  KNOWN_ECOSYSTEM_VENDORS,
  type RawProspect,
} from "./discoveryLogicEngine.js";

const INGEST_PATH = "/api/scheduled/sales-agent-ingest";
const FETCH_TIMEOUT_MS = 15_000;
const MAX_PAGE_CHARS = 14_000;  // Increased from 12k — more context for LLM
const MAX_PAGES = 3;             // Follow up to 3 pagination links per show

// ─── Shared HTML fetch + extraction ──────────────────────────────────────────

interface FetchedPage {
  rawText: string;
  structuredNames: string[];
  pagesFetched: number;
  success: boolean;
}

async function fetchExhibitorPage(url: string): Promise<FetchedPage> {
  const allRawText: string[] = [];
  const allStructuredNames: string[] = [];
  let pagesFetched = 0;
  let currentUrl: string | null = url;

  while (currentUrl && pagesFetched < MAX_PAGES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const pageRes = await fetch(currentUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; StageGate-Bot/1.0; +https://onstage.bot)",
          "Accept": "text/html,application/xhtml+xml",
        },
      });
      clearTimeout(timeoutId);

      if (!pageRes.ok) break;

      const html = await pageRes.text();
      pagesFetched++;

      // Structured extraction first (higher precision)
      const structuredNames = extractCompanyNamesFromHtml(html);
      allStructuredNames.push(...structuredNames);

      // Raw text extraction (higher recall)
      const rawText = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ")
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, " ")
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      allRawText.push(rawText);

      // Detect next page (only follow if we have budget)
      if (pagesFetched < MAX_PAGES) {
        const nextUrl = detectPaginationUrl(html, currentUrl);
        currentUrl = nextUrl !== currentUrl ? nextUrl : null;
      } else {
        currentUrl = null;
      }
    } catch (fetchErr) {
      console.warn(`[Discovery] Fetch failed for ${currentUrl}:`, String(fetchErr).slice(0, 100));
      break;
    }
  }

  const combinedText = allRawText.join(" ").slice(0, MAX_PAGE_CHARS);

  return {
    rawText: combinedText,
    structuredNames: Array.from(new Set(allStructuredNames)),
    pagesFetched,
    success: pagesFetched > 0 && combinedText.length > 200,
  };
}

// ─── LLM extraction from page content ────────────────────────────────────────

const DISCOVERY_SCHEMA = {
  type: "object",
  properties: {
    prospects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: { type: "string" },
          contactName: { type: "string" },
          contactEmail: { type: "string" },
          contactTitle: { type: "string" },
          website: { type: "string" },
          robotName: { type: "string" },
          robotType: { type: "string" },
          robotCategory: { type: "string" },
          shows: { type: "array", items: { type: "string" } },
          notes: { type: "string" },
          emailConfidence: { type: "string" },
        },
        required: [
          "company", "contactName", "contactEmail", "contactTitle",
          "website", "robotName", "robotType", "robotCategory",
          "shows", "notes", "emailConfidence",
        ],
        additionalProperties: false,
      },
    },
    shows: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          location: { type: "string" },
          venue: { type: "string" },
          city: { type: "string" },
          website: { type: "string" },
          description: { type: "string" },
          roboticsRelevance: { type: "number" },
        },
        required: ["name", "location", "venue", "city", "website", "description", "roboticsRelevance"],
        additionalProperties: false,
      },
    },
  },
  required: ["prospects", "shows"],
  additionalProperties: false,
} as const;

async function extractProspectsWithLLM(
  showContext: string,
  page: FetchedPage,
  showName: string,
  lvShowList?: string,
  topOtherShowList?: string,
): Promise<DiscoveredProspect[]> {
  let prompt: string;

  if (page.success) {
    // Build a richer prompt combining structured names + raw text
    const structuredSection = page.structuredNames.length > 0
      ? `\n\nStructured company names extracted from HTML:\n${page.structuredNames.slice(0, 50).join(", ")}`
      : "";

    prompt = `You are analyzing the exhibitor list for ${showContext} (${page.pagesFetched} page(s) fetched).
${structuredSection}

Raw page text (truncated):
${page.rawText}

From this content, identify up to 15 robot companies — companies that make robots, robotic systems, autonomous vehicles, drones, or robotic automation equipment.

For each company found, return:
- company: exact company name
- contactName: best guess for the event/marketing decision maker (VP Marketing, Head of Events, CEO for small companies)
- contactEmail: best outreach email. Prefer role inboxes in this order: sales@company-domain, events@company-domain, marketing@company-domain. Do not use partnerships@, info@, support@, or hello@ as outreach guesses.
- contactTitle: their likely title
- website: company website URL
- robotName: their flagship product name if known
- robotType: one of "humanoid", "quadruped", "wheeled_amr", "industrial_arm", "cobot", "mobile_manipulator", "drone", "service_robot", "surgical_robot", "exoskeleton", "other"
- robotCategory: "light" | "heavy_industrial" | "mixed"
- shows: ["${showName}"]
- notes: why they are a good StageGate prospect — prioritize: international companies with no US ops team, first-time US exhibitors, humanoids needing calibration, battery-powered robots with Li-ion shipping risk, medical/surgical robots needing precision handling, hospitality robots with customer-facing demo risk
- emailConfidence: "high" | "medium" | "low"

Return ONLY valid JSON with "prospects" array and empty "shows" array. No markdown.`;
  } else {
    // Fallback: LLM web knowledge — built from live DB show list
    const resolvedLvShows = lvShowList ?? "CES, NAB Show, Manifest, HIMSS, Ai4, FABTECH, PACK EXPO Las Vegas, G2E, MINExpo, AWS re:Invent";
    const resolvedOtherShows = topOtherShowList ?? "Automate 2026 (Chicago), MODEX 2026 (Atlanta), IMTS 2026 (Chicago), Humanoids 2026 (Santa Clara), RoboBusiness 2026 (Santa Clara)";

    prompt = `You are a research assistant for StageGate — robot operational infrastructure based in Las Vegas.

StageGate is NOT a logistics company. StageGate provides:
• Bonded warehouse receiving and storage for robots
• Safe power-up, diagnostics, and sensor/IMU recalibration after transit
• Battery charge cycle management (Li-ion, large format)
• On-site robot technicians during live demos
• Demo failure recovery and unit repair at show
• Return crating and outbound shipping

The companies that need StageGate MOST are those with the highest operational risk:
1. CES Eureka Park startups — tiny team, first US show, no support
2. Foreign humanoid robot companies — no US ops, calibration-intensive
3. Medical robot companies — precision-critical, regulatory-sensitive
4. Hospitality / service robots — customer-facing, public failure risk
5. Security robots — autonomous navigation, liability-sensitive
6. Warehouse AMR companies — fleet mapping, charging infrastructure
7. Chinese robot firms entering the US — no US team, language barrier, customs risk

Las Vegas shows (StageGate's home market — highest priority):
${resolvedLvShows}

Other major upcoming shows (secondary priority):
${resolvedOtherShows}

Find up to 20 robot companies that are likely to attend these shows.
Prioritize: Chinese humanoid companies, Korean exoskeleton companies, European robot OEMs, Eureka Park startups, medical robot companies, security robot companies.

Known high-value targets: Unitree Robotics, UBTECH, Agibot, Fourier Intelligence, WIRobotics, Realbotix, Geekplus, Hikrobot, Richtech Robotics, Figure AI, Agility Robotics, 1X Technologies, Apptronik, Sanctuary AI, Boston Dynamics, Ghost Robotics, Skydio, Knightscope, Cobalt Robotics, Bear Robotics, Keenon, Pudu Robotics, Savioke, Aethon, Universal Robots, Fanuc, KUKA, ABB Robotics, Rapyuta Robotics.

NOTE: We do NOT require confirmation of attendance at a specific show. If a company has robots and operates at scale, they will come to Las Vegas for one of the many shows.

Return ONLY valid JSON with "prospects" array and empty "shows" array. No markdown.`;
  }

  try {
    const result = await invokeLLM({
      messages: [
      {
        role: "system",
        content: `You are a research assistant identifying robot companies for StageGate's sales outreach.

StageGate is robot operational infrastructure — the only company in Las Vegas that can safely receive robots off the truck, power them up, run diagnostics, recalibrate sensors and IMUs after transit, manage battery cycles, staff qualified technicians on the show floor, and recover failed units during live demos.

Prioritize these 7 ICP types (highest need = highest score):
1. Foreign humanoid companies (Chinese, Korean, Japanese) — no US ops team, highest calibration risk
2. Eureka Park / CES startups — tiny team, first US show, zero support infrastructure
3. Medical / surgical robots — precision-critical, demo failure has regulatory consequences
4. Hospitality / service robots — customer-facing, public failure = brand damage
5. Security robots — autonomous navigation needs map recalibration after transit
6. Warehouse AMR companies — fleet mapping, charging infrastructure setup at new venue
7. Chinese robot firms entering US — language barrier + customs + no English-speaking support

Return ONLY valid JSON, no markdown.`,
      },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "discovery_results", strict: true, schema: DISCOVERY_SCHEMA },
      },
    });

    const rawContent = result.choices?.[0]?.message?.content;
    const parsed: { prospects: DiscoveredProspect[]; shows: DiscoveredShow[] } = JSON.parse(
      typeof rawContent === "string" ? rawContent : "{}"
    );
    return parsed.prospects ?? [];
  } catch (err) {
    console.error(`[Discovery] LLM extraction failed for ${showName}:`, String(err).slice(0, 200));
    return [];
  }
}

/** Discover show ecosystem partners — organizers, booth builders, AV, event cos. */
async function extractPartnerProspectsWithLLM(
  lvShowList: string,
): Promise<DiscoveredProspect[]> {
  const prompt = `You are researching Las Vegas trade show ecosystem companies for StageGate.

StageGate is the robotics logistics team in Las Vegas — warehouse, staging, power-up, and hands-on robot tech for exhibitors. We partner with (not compete against):

1. Show organizers & event management companies (CES/CTA, Informa, Emerald, RX/Reed, etc.)
2. General contractors & exhibit houses (Freeman, GES, mid-sized booth builders)
3. AV / electrical / production companies (Encore, PRG, Freeman AV, etc.)
4. Event agencies running large activations with robots

Las Vegas shows in our pipeline:
${lvShowList || "CES, NAB, Manifest, HIMSS, G2E, PACK EXPO Las Vegas, MINExpo, Ai4"}

Find up to 20 REAL companies in these categories that operate in or serve Las Vegas trade shows.
Do NOT repeat robot OEMs (Unitree, Boston Dynamics, etc.) — those are a separate list.

For each company return:
- company: exact legal or trade name
- contactName: ops / partnerships / robotics liaison if known
- contactEmail: partnerships@, events@, or sales@ on their domain — never info@ or support@
- contactTitle: likely title
- website: URL
- vendorType: one of exhibit_house | av_electrical | show_organizer | agency | venue | freight | other
- robotName: "" (empty for partners)
- robotType: "other"
- robotCategory: "light"
- shows: relevant Las Vegas show names
- notes: why they'd partner with a robotics staging team
- emailConfidence: high | medium | low

Return ONLY valid JSON with "prospects" array and empty "shows" array.`;

  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "Return ONLY valid JSON matching the schema. Focus on real Las Vegas show ecosystem companies — not robot manufacturers.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "partner_discovery", strict: true, schema: DISCOVERY_SCHEMA },
      },
    });

    const rawContent = result.choices?.[0]?.message?.content;
    const parsed: { prospects: DiscoveredProspect[] } = JSON.parse(
      typeof rawContent === "string" ? rawContent : "{}"
    );
    return (parsed.prospects ?? []).map((p) => {
      const key = p.company.toLowerCase().trim();
      const known = KNOWN_ECOSYSTEM_VENDORS[key];
      return {
        ...p,
        vendorType: known?.vendorType ?? inferPartnerVendorType(p.company, p.notes),
        outreachAngle: "partner" as const,
        isEcosystemVendor: true,
      };
    });
  } catch (err) {
    console.error("[Discovery] Partner LLM extraction failed:", String(err).slice(0, 200));
    return [];
  }
}

function inferPartnerVendorType(company: string, notes?: string): string {
  const text = `${company} ${notes ?? ""}`.toLowerCase();
  if (/freeman|ges|exhibit|booth|tradeshow/i.test(text)) return "exhibit_house";
  if (/encore|av|audio|visual|production|electrical|prg/i.test(text)) return "av_electrical";
  if (/informa|emerald|reed|rx global|organizer|association|cta/i.test(text)) return "show_organizer";
  if (/convention center|venetian|mandalay|caesars forum|lvcc/i.test(text)) return "venue";
  if (/dhl|fedex|freight|logistics|schenker/i.test(text)) return "freight";
  if (/agency|experiential|marketing/i.test(text)) return "agency";
  return "other";
}

function seedKnownEcosystemVendors(): DiscoveredProspect[] {
  return Object.entries(KNOWN_ECOSYSTEM_VENDORS).map(([key, meta]) => ({
    company: key.replace(/\b\w/g, (c) => c.toUpperCase()),
    contactEmail: "",
    contactName: "",
    contactTitle: "Partnerships",
    website: "",
    robotName: "",
    robotType: "other",
    robotCategory: "light",
    shows: ["CES", "NAB Show"],
    notes: meta.notes,
    emailConfidence: "low",
    vendorType: meta.vendorType,
    outreachAngle: "partner",
    isEcosystemVendor: true,
  }));
}

// ─── Discovery handler (cron-authenticated) ───────────────────────────────────

export async function salesAgentDiscoveryHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "db unavailable" });

    const [run] = await db
      .insert(salesAgentRuns)
      .values({ runType: "discovery", status: "running" })
      .returning({ id: salesAgentRuns.id });
    const runId = run?.id;

    const result = await runDiscoveryCore(db, 8, runId);

    if (runId) {
      await db.update(salesAgentRuns).set({
        prospectsFound: result.prospectsFound,
        prospectsCreated: result.prospectsCreated,
        showsFound: result.showsFound,
        status: "completed",
        completedAt: new Date(),
        details: result.details,
      }).where(eq(salesAgentRuns.id, runId));
    }

    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[SalesAgent discovery error]", err);
    res.status(500).json({ error: String(err), timestamp: new Date().toISOString() });
  }
}

// ─── Admin-triggered core (bypasses cron auth) ────────────────────────────────

export async function salesAgentDiscoveryCore(runId?: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const result = await runDiscoveryCore(db, 12, runId);

  if (runId) {
    await db.update(salesAgentRuns).set({
      prospectsFound: result.prospectsFound,
      prospectsCreated: result.prospectsCreated,
      showsFound: result.showsFound,
      status: "completed",
      completedAt: new Date(),
      details: { ...result.details, triggeredBy: "admin" },
    }).where(eq(salesAgentRuns.id, runId));
  }

  console.log(`[Discovery Core] Complete: ${result.prospectsFound} found, ${result.prospectsCreated} created`);
}

// ─── Shared core logic (DRY) ──────────────────────────────────────────────────

interface DiscoveryResult {
  prospectsFound: number;
  prospectsCreated: number;
  showsFound: number;
  ingestStatus: number;
  showsScraped: number;
  details: Record<string, unknown>;
}

async function runDiscoveryCore(
  db: Awaited<ReturnType<typeof getDb>>,
  showLimit: number,
  runId?: number
): Promise<DiscoveryResult> {
  if (!db) throw new Error("DB unavailable");

  // ── Get shows with exhibitorListUrl ──────────────────────────────────────
  const showsWithUrl = await db
    .select({
      id: tradeShows.id,
      name: tradeShows.name,
      city: tradeShows.city,
      venue: tradeShows.venue,
      exhibitorListUrl: tradeShows.exhibitorListUrl,
    })
    .from(tradeShows)
    .where(isNotNull(tradeShows.exhibitorListUrl))
    .limit(showLimit);

  // ── Get all upcoming shows for fallback context ──────────────────────────
  const allUpcomingShows = await db
    .select({ name: tradeShows.name, city: tradeShows.city, roboticsRelevance: tradeShows.roboticsRelevance })
    .from(tradeShows)
    .where(eq(tradeShows.status, "upcoming"))
    .limit(89);  // we have 89 upcoming shows — get them all

  // Sort: Las Vegas shows first (highest StageGate value), then by robotics relevance
  allUpcomingShows.sort((a, b) => {
    const aLV = /las vegas/i.test(a.city ?? "") ? 1 : 0;
    const bLV = /las vegas/i.test(b.city ?? "") ? 1 : 0;
    if (aLV !== bLV) return bLV - aLV;
    return (b.roboticsRelevance ?? 0) - (a.roboticsRelevance ?? 0);
  });

  // Build a structured show context string for the LLM fallback
  const lvShows = allUpcomingShows.filter(s => /las vegas/i.test(s.city ?? "")).map(s => s.name);
  const otherShows = allUpcomingShows.filter(s => !/las vegas/i.test(s.city ?? "")).map(s => `${s.name} (${s.city})`);
  const fallbackShowNames = allUpcomingShows.map(s => s.name).join(", ");

  let allRawProspects: DiscoveredProspect[] = [];
  const allNewShows: DiscoveredShow[] = [];
  const scrapeLog: Record<string, { pages: number; structuredNames: number; llmProspects: number }> = {};

  // ── Scrape exhibitor list pages ──────────────────────────────────────────
  for (const show of showsWithUrl) {
    if (!show.exhibitorListUrl) continue;

    const showContext = `${show.name} at ${show.venue ?? "Las Vegas"}, ${show.city ?? "NV"}`;
    const page = await fetchExhibitorPage(show.exhibitorListUrl);

    const prospects = await extractProspectsWithLLM(showContext, page, show.name, lvShows.slice(0, 20).join(", "), otherShows.slice(0, 15).join("; "));
    allRawProspects = allRawProspects.concat(prospects);

    scrapeLog[show.name] = {
      pages: page.pagesFetched,
      structuredNames: page.structuredNames.length,
      llmProspects: prospects.length,
    };

    console.log(
      `[Discovery] ${show.name}: ${page.pagesFetched}p scraped, ` +
      `${page.structuredNames.length} structured names, ${prospects.length} LLM prospects`
    );
  }

  // ── Fallback: LLM knowledge for shows without URL ────────────────────────
  if (allRawProspects.length < 10) {
    console.log(`[Discovery] Fallback triggered (only ${allRawProspects.length} prospects so far)`);
    const fallbackPage: FetchedPage = { rawText: "", structuredNames: [], pagesFetched: 0, success: false };
    const fallbackContext = `upcoming Las Vegas trade shows: ${fallbackShowNames || "CES, NAB Show, MODEX, Automate, ICRA, ROSCon"}`;
    const fallbackProspects = await extractProspectsWithLLM(fallbackContext, fallbackPage, "Las Vegas shows", lvShows.slice(0, 20).join(", "), otherShows.slice(0, 15).join("; "));
    allRawProspects = allRawProspects.concat(fallbackProspects);
    console.log(`[Discovery] Fallback: ${fallbackProspects.length} additional prospects`);
  }

  // ── Partner ecosystem pass (organizers, booth builders, AV, event cos) ───
  const partnerProspects = await extractPartnerProspectsWithLLM(lvShows.slice(0, 20).join(", "));
  allRawProspects = allRawProspects.concat(partnerProspects);
  allRawProspects = allRawProspects.concat(seedKnownEcosystemVendors());
  console.log(`[Discovery] Partner pass: ${partnerProspects.length} LLM + ecosystem seeds`);

  // ── Deduplicate by company name (case-insensitive) ───────────────────────
  const seen = new Set<string>();
  const uniqueRaw = allRawProspects.filter(p => {
    const key = p.company.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`[Discovery] ${uniqueRaw.length} unique raw prospects before logic engine`);

  // ── Logic Engine: junk filter + robot signal + LLM classification ────────
  const rawForEngine: RawProspect[] = uniqueRaw.map(p => ({
    company: p.company,
    website: p.website,
    contactName: p.contactName,
    contactEmail: p.contactEmail,
    contactTitle: p.contactTitle,
    robotName: p.robotName,
    robotType: p.robotType,
    shows: p.shows,
    notes: p.notes,
    emailConfidence: p.emailConfidence,
    vendorType: p.vendorType as RawProspect["vendorType"],
    outreachAngle: p.outreachAngle as RawProspect["outreachAngle"],
    isEcosystemVendor: p.isEcosystemVendor,
  }));

  const { accepted, rejected, stats } = await filterAndClassify(rawForEngine);

  console.log(
    `[Discovery] Logic Engine: ${stats.total} in → ` +
    `${stats.junkFiltered} junk, ${stats.noRobotSignal} no-signal, ` +
    `${stats.logicEngineRejected} LLM-rejected → ${stats.accepted} accepted`
  );

  // Merge logic engine enrichments back into prospect data
  const enrichedProspects: DiscoveredProspect[] = accepted.map(sp => ({
    company: sp.company,
    contactName: sp.contactName,
    contactEmail: sp.contactEmail,
    contactTitle: sp.contactTitle,
    website: sp.website,
    robotName: sp.robotName,
    robotType: sp.robotType,
    robotCategory: sp.robotCategory,
    shows: sp.shows,
    notes: sp.notes ?? sp.companyReason,
    emailConfidence: sp.emailConfidence,
    vendorType: sp.vendorType,
    outreachAngle: sp.outreachAngle,
  }));

  // ── POST to ingest endpoint ──────────────────────────────────────────────
  const baseUrl = (process.env.PUBLIC_BASE_URL ?? process.env.APP_BASE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")).replace(/\/+$/, "");
  const heartbeatSecret = process.env.BUILT_IN_FORGE_API_KEY ?? "";

  const ingestRes = await fetch(`${baseUrl}${INGEST_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${heartbeatSecret}`,
      "x-heartbeat-cron": "true",
    },
    body: JSON.stringify({
      newProspects: enrichedProspects,
      newShows: allNewShows,
      runId,
    }),
  });

  const ingestData = ingestRes.ok
    ? (await ingestRes.json() as { prospectsCreated?: number; showsCreated?: number })
    : null;

  return {
    prospectsFound: enrichedProspects.length,
    prospectsCreated: ingestData?.prospectsCreated ?? 0,
    showsFound: allNewShows.length,
    ingestStatus: ingestRes.status,
    showsScraped: showsWithUrl.length,
    details: {
      rawDiscovered: uniqueRaw.length,
      logicEngineStats: stats,
      logicEngineRejected: rejected.map(r => ({ company: r.company, reason: r.reason, tier: r.tier })),
      scrapeLog,
      usedFallback: allRawProspects.length < 10,
      ingestStatus: ingestRes.status,
    },
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiscoveredProspect {
  company: string;
  contactName?: string;
  contactEmail?: string;
  contactTitle?: string;
  website?: string;
  robotName?: string;
  robotType?: string;
  robotCategory?: string;
  shows?: string[];
  notes?: string;
  emailConfidence?: string;
  vendorType?: string;
  outreachAngle?: string;
  isEcosystemVendor?: boolean;
}

interface DiscoveredShow {
  name: string;
  location?: string;
  venue?: string;
  city?: string;
  website?: string;
  description?: string;
  roboticsRelevance?: number;
}
