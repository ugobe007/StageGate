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
  showName: string
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
- notes: why they are a good StageGate prospect (logistics, staging, warehouse support needs)
- emailConfidence: "high" | "medium" | "low"

Return ONLY valid JSON with "prospects" array and empty "shows" array. No markdown.`;
  } else {
    // Fallback: LLM web knowledge
    prompt = `You are a research assistant for StageGate, a robotics activation infrastructure company in Las Vegas.

Find up to 15 robot companies that exhibit at ${showContext}.

Focus on: humanoid robots, quadruped robots, wheeled AMRs, service robots, industrial arms, cobots, and drones.
Well-known exhibitors include: Boston Dynamics, Agility Robotics, Figure AI, 1X Technologies, Unitree, UBTECH, Bear Robotics, Keenon, Aethon, Savioke, Apptronik, Sanctuary AI, Fourier Intelligence, Universal Robots, Fanuc, KUKA, ABB Robotics, Fetch Robotics, Clearpath, Ghost Robotics, Skydio.

NOTE: We do NOT require confirmation of attendance at this specific show. If a company has robots and operates at scale, we assume they will come to Las Vegas for one of the many shows (CES, NAB, MODEX, Automate, ICRA, ROSCon, PACK EXPO, etc.).

Return ONLY valid JSON with "prospects" array and empty "shows" array. No markdown.`;
  }

  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a research assistant identifying robot companies for StageGate's sales outreach. StageGate provides warehouse receiving, unpacking, staging, calibration, booth delivery, show-floor support, and return shipping for robot companies at trade shows. Return ONLY valid JSON, no markdown.`,
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

    const result = await runDiscoveryCore(db, 5, runId);

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

  const result = await runDiscoveryCore(db, 8, runId);

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
    .select({ name: tradeShows.name, city: tradeShows.city })
    .from(tradeShows)
    .where(eq(tradeShows.status, "upcoming"))
    .limit(25);

  const fallbackShowNames = allUpcomingShows.map(s => s.name).join(", ");

  let allRawProspects: DiscoveredProspect[] = [];
  const allNewShows: DiscoveredShow[] = [];
  const scrapeLog: Record<string, { pages: number; structuredNames: number; llmProspects: number }> = {};

  // ── Scrape exhibitor list pages ──────────────────────────────────────────
  for (const show of showsWithUrl) {
    if (!show.exhibitorListUrl) continue;

    const showContext = `${show.name} at ${show.venue ?? "Las Vegas"}, ${show.city ?? "NV"}`;
    const page = await fetchExhibitorPage(show.exhibitorListUrl);

    const prospects = await extractProspectsWithLLM(showContext, page, show.name);
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
    const fallbackProspects = await extractProspectsWithLLM(fallbackContext, fallbackPage, "Las Vegas shows");
    allRawProspects = allRawProspects.concat(fallbackProspects);
    console.log(`[Discovery] Fallback: ${fallbackProspects.length} additional prospects`);
  }

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
  }));

  // ── POST to ingest endpoint ──────────────────────────────────────────────
  const baseUrl = process.env.VITE_APP_ID
    ? `https://onstage.bot`
    : `http://localhost:${process.env.PORT ?? 3000}`;
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
