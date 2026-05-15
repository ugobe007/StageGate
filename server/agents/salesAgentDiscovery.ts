/**
 * server/agents/salesAgentDiscovery.ts
 *
 * Sales Agent Discovery Handler
 * Runs nightly at 2am UTC via heartbeat cron.
 *
 * Strategy (in priority order):
 *   1. For each show with an exhibitorListUrl: fetch the page, extract HTML text,
 *      then use LLM to identify robot companies from the exhibitor list.
 *   2. For shows without a URL (or if fetch fails): fall back to LLM web knowledge
 *      to generate high-quality prospects based on known show names.
 *
 * Results are ingested via POST /api/scheduled/sales-agent-ingest.
 */
import type { Request, Response } from "express";
import { getDb } from "../db";
import { salesAgentRuns, tradeShows } from "../../drizzle/schema";
import { eq, isNotNull } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { sdk } from "../_core/sdk";

const INGEST_PATH = "/api/scheduled/sales-agent-ingest";
const FETCH_TIMEOUT_MS = 15_000;
const MAX_PAGE_CHARS = 12_000; // Trim large pages before sending to LLM

// ─── Discovery handler ────────────────────────────────────────────────────────

export async function salesAgentDiscoveryHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "db unavailable" });

    // Create a run record
    const [run] = await db
      .insert(salesAgentRuns)
      .values({ runType: "discovery", status: "running" })
      .returning({ id: salesAgentRuns.id });

    const runId = run?.id;

    // ── Step 1: Get shows with exhibitorListUrl (priority) ───────────────────
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
      .limit(5); // Process up to 5 shows per nightly run

    // ── Step 2: Get shows without URL for fallback ───────────────────────────
    const allUpcomingShows = await db
      .select({ name: tradeShows.name, city: tradeShows.city })
      .from(tradeShows)
      .where(eq(tradeShows.status, "upcoming"))
      .limit(20);

    const fallbackShowNames = allUpcomingShows.map(s => s.name).join(", ");

    let allProspects: DiscoveredProspect[] = [];
    let allNewShows: DiscoveredShow[] = [];

    // ── Step 3: Scrape exhibitor list pages ──────────────────────────────────
    for (const show of showsWithUrl) {
      if (!show.exhibitorListUrl) continue;

      let pageText = "";
      let scrapeSuccess = false;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        const pageRes = await fetch(show.exhibitorListUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; StageGate-Bot/1.0; +https://onstage.bot)",
            "Accept": "text/html,application/xhtml+xml",
          },
        });
        clearTimeout(timeoutId);

        if (pageRes.ok) {
          const html = await pageRes.text();
          // Strip HTML tags and collapse whitespace for LLM consumption
          pageText = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, MAX_PAGE_CHARS);
          scrapeSuccess = pageText.length > 200;
        }
      } catch (fetchErr) {
        console.warn(`[Discovery] Failed to fetch ${show.exhibitorListUrl}:`, String(fetchErr).slice(0, 100));
      }

      const showContext = `${show.name} at ${show.venue ?? "Las Vegas"}, ${show.city ?? "NV"}`;

      const prompt = scrapeSuccess
        ? `You are analyzing the exhibitor list page for ${showContext}.

Page content (truncated):
${pageText}

From this exhibitor list, identify up to 10 robot companies — companies that make robots, robotic systems, autonomous vehicles, drones, or robotic automation equipment.

For each company found, return:
- company: exact company name from the exhibitor list
- contactName: best guess for the event/marketing decision maker (VP Marketing, Head of Events, CEO for small companies)
- contactEmail: best guess email using common patterns (firstname@company.com, info@company.com)
- contactTitle: their likely title
- website: company website URL
- robotName: their flagship product name if known
- robotType: one of "humanoid", "quadruped", "wheeled AMR", "industrial arm", "drone", "service robot", "other"
- shows: ["${show.name}"]
- notes: why they are a good StageGate prospect (they need logistics, staging, warehouse support)
- emailConfidence: "high" | "medium" | "low"

Return ONLY valid JSON with a "prospects" array and empty "shows" array. No markdown.`
        : `You are a research assistant for StageGate, a robotics activation infrastructure company in Las Vegas.

Find up to 10 robot companies that exhibit at ${showContext}.

Focus on: humanoid robots, quadruped robots, wheeled AMRs, service robots, industrial arms, and drones.
Well-known exhibitors at this show include companies like Boston Dynamics, Agility Robotics, Figure AI, 1X Technologies, Unitree, UBTECH, Bear Robotics, Keenon, Aethon, Savioke, Apptronik, Sanctuary AI, Fourier Intelligence.

For each company return the same JSON structure as above.
Return ONLY valid JSON with "prospects" array and empty "shows" array. No markdown.`;

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
            json_schema: {
              name: "discovery_results",
              strict: true,
              schema: {
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
                        robotCategory: { type: "string" }, // light | heavy_industrial | mixed
                        shows: { type: "array", items: { type: "string" } },
                        notes: { type: "string" },
                        emailConfidence: { type: "string" },
                      },
                      required: ["company", "contactName", "contactEmail", "contactTitle", "website", "robotName", "robotType", "robotCategory", "shows", "notes", "emailConfidence"],
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
              },
            },
          },
        });

        const rawContent = result.choices?.[0]?.message?.content;
        const contentStr = typeof rawContent === "string" ? rawContent : "";

        try {
          const parsed: { prospects: DiscoveredProspect[]; shows: DiscoveredShow[] } = JSON.parse(contentStr);
          allProspects = allProspects.concat(parsed.prospects ?? []);
          allNewShows = allNewShows.concat(parsed.shows ?? []);
          console.log(`[Discovery] ${show.name}: found ${parsed.prospects?.length ?? 0} prospects (scrape: ${scrapeSuccess})`);
        } catch {
          console.error("[Discovery] Failed to parse LLM JSON for show:", show.name, contentStr.slice(0, 200));
        }
      } catch (llmErr) {
        console.error("[Discovery] LLM error for show:", show.name, String(llmErr).slice(0, 200));
      }
    }

    // ── Step 4: Fallback — LLM knowledge for shows without URL ───────────────
    // Only run if we didn't get many prospects from scraping
    if (allProspects.length < 5) {
      try {
        const fallbackResult = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a research assistant for StageGate, a robotics activation infrastructure company in Las Vegas.
Your job is to identify robot companies that exhibit at trade shows and conferences, especially in Las Vegas.
StageGate provides: warehouse receiving, unpacking, staging, calibration testing, booth delivery, show-floor support, and return shipping for robot companies.
Return ONLY valid JSON, no markdown.`,
            },
            {
              role: "user",
              content: `Current shows in our database: ${fallbackShowNames || "CES, NAB Show, CEDIA Expo"}

Find 15 high-quality robot company prospects that exhibit at these shows. Focus on:
1. Humanoid robot companies (Boston Dynamics, Agility Robotics, Figure AI, 1X Technologies, Apptronik, Sanctuary AI, Unitree, Fourier Intelligence, UBTECH, etc.)
2. Service/commercial robot companies (Bear Robotics, Keenon Robotics, Aethon, Savioke, etc.)
3. Industrial robot companies with trade show presence
4. Emerging robotics startups that have announced show appearances

Return 15 high-quality prospects with realistic contact info.`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "discovery_results",
              strict: true,
              schema: {
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
                        shows: { type: "array", items: { type: "string" } },
                        notes: { type: "string" },
                        emailConfidence: { type: "string" },
                      },
                      required: ["company", "contactName", "contactEmail", "contactTitle", "website", "robotName", "robotType", "shows", "notes", "emailConfidence"],
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
              },
            },
          },
        });

        const rawContent = fallbackResult.choices?.[0]?.message?.content;
        const contentStr = typeof rawContent === "string" ? rawContent : "";

        try {
          const parsed: { prospects: DiscoveredProspect[]; shows: DiscoveredShow[] } = JSON.parse(contentStr);
          allProspects = allProspects.concat(parsed.prospects ?? []);
          allNewShows = allNewShows.concat(parsed.shows ?? []);
          console.log(`[Discovery] Fallback LLM: found ${parsed.prospects?.length ?? 0} prospects`);
        } catch {
          console.error("[Discovery] Failed to parse fallback LLM JSON:", contentStr.slice(0, 200));
        }
      } catch (fallbackErr) {
        console.error("[Discovery] Fallback LLM error:", String(fallbackErr).slice(0, 200));
      }
    }

    // ── Step 5: Deduplicate by company name (case-insensitive) ───────────────
    const seen = new Set<string>();
    const uniqueProspects = allProspects.filter(p => {
      const key = p.company.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // ── Step 6: POST to ingest endpoint ──────────────────────────────────────
    const baseUrl = process.env.VITE_APP_ID
      ? `https://onstage.bot`
      : `http://localhost:${process.env.PORT ?? 3000}`;

    const ingestUrl = `${baseUrl}${INGEST_PATH}`;
    const heartbeatSecret = process.env.BUILT_IN_FORGE_API_KEY ?? "";

    const ingestRes = await fetch(ingestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${heartbeatSecret}`,
        "x-heartbeat-cron": "true",
      },
      body: JSON.stringify({
        newProspects: uniqueProspects,
        newShows: allNewShows,
        runId,
      }),
    });

    const ingestData = ingestRes.ok
      ? (await ingestRes.json() as { prospectsCreated?: number; showsCreated?: number })
      : null;

    // ── Step 7: Update run record ─────────────────────────────────────────────
    if (runId && db) {
      await db
        .update(salesAgentRuns)
        .set({
          prospectsFound: uniqueProspects.length,
          prospectsCreated: ingestData?.prospectsCreated ?? 0,
          showsFound: allNewShows.length,
          status: "completed",
          completedAt: new Date(),
          details: {
            ingestStatus: ingestRes.status,
            prospectsFound: uniqueProspects.length,
            showsFound: allNewShows.length,
            showsWithUrlScraped: showsWithUrl.length,
            usedFallback: allProspects.length < 5,
          },
        })
        .where(eq(salesAgentRuns.id, runId));
    }

    res.json({
      ok: true,
      prospectsFound: uniqueProspects.length,
      showsFound: allNewShows.length,
      ingestStatus: ingestRes.status,
      showsScraped: showsWithUrl.length,
    });
  } catch (err) {
    console.error("[SalesAgent discovery error]", err);
    res.status(500).json({ error: String(err), timestamp: new Date().toISOString() });
  }
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
  robotCategory?: string; // light | heavy_industrial | mixed
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
