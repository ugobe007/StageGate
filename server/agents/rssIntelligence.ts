/**
 * server/agents/rssIntelligence.ts
 *
 * RSS Intelligence Agent — fetches StageGate feed registry, filters for
 * robot OEM + show-ecosystem signals, extracts prospects via LLM, ingests.
 *
 * Runs daily at 4am UTC via heartbeat cron (rss-intelligence-daily).
 */
import type { Request, Response } from "express";
import { getDb } from "../db.js";
import { salesAgentRuns } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { invokeLLM } from "../_core/llm.js";
import { sdk } from "../_core/sdk.js";
import { RSS_FEED_TARGETS, type RssFeedCategory } from "../feeds/rssFeedTargets.js";
import { fetchRssFeed, type RssArticle } from "../feeds/rssParser.js";
import { filterAndClassify, type RawProspect } from "./discoveryLogicEngine.js";
import type { DiscoveredProspect, DiscoveredShow } from "./salesAgent.js";

const INGEST_PATH = "/api/scheduled/sales-agent-ingest";
const FEEDS_PER_RUN = 14;
const MAX_ARTICLES_PER_FEED = 12;
const MAX_ARTICLES_TO_LLM = 40;

const RELEVANCE_KEYWORDS = [
  "robot", "humanoid", "amr", "agv", "drone", "automat",
  "exhibitor", "booth", "trade show", "convention", "ces ", "automate",
  "modex", "nab show", "exhibit", "freeman", "ges ", "drayage",
  "freight", "rigging", "staging", "las vegas", "lvcc",
  "warehouse robot", "mobile manipulator", "cobot",
];

function isRelevant(article: RssArticle): boolean {
  const blob = `${article.title} ${article.description}`.toLowerCase();
  return RELEVANCE_KEYWORDS.some((kw) => blob.includes(kw));
}

function feedBatchForToday(): typeof RSS_FEED_TARGETS {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const start = (dayIndex * FEEDS_PER_RUN) % RSS_FEED_TARGETS.length;
  const batch = [];
  for (let i = 0; i < FEEDS_PER_RUN; i++) {
    batch.push(RSS_FEED_TARGETS[(start + i) % RSS_FEED_TARGETS.length]!);
  }
  return batch;
}

async function extractProspectsFromArticles(
  articles: RssArticle[],
  categories: Map<string, RssFeedCategory>,
): Promise<{ prospects: DiscoveredProspect[]; shows: DiscoveredShow[] }> {
  if (articles.length === 0) return { prospects: [], shows: [] };

  const articleBlock = articles
    .map((a, i) => {
      const cat = categories.get(a.source) ?? "oem_prospect";
      return `[${i + 1}] (${cat}) ${a.title}\n${a.description.slice(0, 400)}\nSource: ${a.link}`;
    })
    .join("\n\n");

  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You extract sales prospects for StageGate (robot trade show logistics in Las Vegas).

From RSS headlines, identify:
1. Robot OEM companies (build robots — humanoids, AMRs, drones, cobots)
2. Show ecosystem partners (exhibit houses, AV, rigging, freight/drayage, show organizers, event companies)

For each company return vendorType:
- robot_oem — builds robots
- exhibit_house — Freeman, GES, Shepard, etc.
- av_company — AV / power / booth tech
- freight_forwarder — freight, drayage, customs
- show_organizer — CES, Automate, TSNN-type orgs
- event_company — general event production

outreachAngle: "customer" for robot_oem, "partner" for ecosystem vendors.

Only include real companies with clear names. Skip generic news outlets.`,
      },
      {
        role: "user",
        content: `Extract prospects from these ${articles.length} RSS articles:\n\n${articleBlock}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "rss_prospects",
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
                  website: { type: "string" },
                  robotName: { type: "string" },
                  robotType: { type: "string" },
                  shows: { type: "array", items: { type: "string" } },
                  notes: { type: "string" },
                  vendorType: {
                    type: "string",
                    enum: [
                      "robot_oem",
                      "exhibit_house",
                      "av_company",
                      "freight_forwarder",
                      "show_organizer",
                      "event_company",
                    ],
                  },
                  outreachAngle: { type: "string", enum: ["customer", "partner"] },
                },
                required: [
                  "company",
                  "website",
                  "robotName",
                  "robotType",
                  "shows",
                  "notes",
                  "vendorType",
                  "outreachAngle",
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
                  city: { type: "string" },
                  venue: { type: "string" },
                  description: { type: "string" },
                  roboticsRelevance: { type: "number" },
                },
                required: ["name", "city", "venue", "description", "roboticsRelevance"],
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

  const raw = result.choices?.[0]?.message?.content;
  const str = typeof raw === "string" ? raw : "";
  try {
    const parsed = JSON.parse(str) as {
      prospects: DiscoveredProspect[];
      shows: DiscoveredShow[];
    };
    return {
      prospects: parsed.prospects ?? [],
      shows: parsed.shows ?? [],
    };
  } catch {
    return { prospects: [], shows: [] };
  }
}

async function postToIngest(
  newProspects: DiscoveredProspect[],
  newShows: DiscoveredShow[],
  runId: number,
): Promise<{ prospectsCreated: number; showsCreated: number; status: number }> {
  const baseUrl = (
    process.env.PUBLIC_BASE_URL ??
    process.env.APP_BASE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/+$/, "");
  const heartbeatSecret = process.env.BUILT_IN_FORGE_API_KEY ?? "";

  const ingestRes = await fetch(`${baseUrl}${INGEST_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${heartbeatSecret}`,
      "x-heartbeat-cron": "true",
    },
    body: JSON.stringify({ newProspects, newShows, runId }),
  });

  const data = ingestRes.ok
    ? ((await ingestRes.json()) as { prospectsCreated?: number; showsCreated?: number })
    : null;

  return {
    prospectsCreated: data?.prospectsCreated ?? 0,
    showsCreated: data?.showsCreated ?? 0,
    status: ingestRes.status,
  };
}

export async function runRssIntelligence(runId?: number) {
  const batch = feedBatchForToday();
  const categoryByUrl = new Map(batch.map((f) => [f.url, f.category]));

  const feedResults: { url: string; label: string; articles: number; relevant: number }[] = [];
  const allRelevant: RssArticle[] = [];

  for (const feed of batch) {
    const articles = await fetchRssFeed(feed.url);
    const relevant = articles.filter(isRelevant).slice(0, MAX_ARTICLES_PER_FEED);
    feedResults.push({
      url: feed.url,
      label: feed.label,
      articles: articles.length,
      relevant: relevant.length,
    });
    allRelevant.push(...relevant);
  }

  const articlesForLlm = allRelevant.slice(0, MAX_ARTICLES_TO_LLM);
  const { prospects: rawProspects, shows: rawShows } = await extractProspectsFromArticles(
    articlesForLlm,
    categoryByUrl,
  );

  const rawForEngine: RawProspect[] = rawProspects.map((p) => ({
    company: p.company,
    website: p.website,
    robotName: p.robotName,
    robotType: p.robotType,
    shows: p.shows,
    notes: p.notes ? `RSS: ${p.notes}` : "Discovered via RSS intelligence",
    vendorType: p.vendorType as RawProspect["vendorType"],
    outreachAngle: p.outreachAngle as RawProspect["outreachAngle"],
    isEcosystemVendor: p.outreachAngle === "partner",
  }));

  const { accepted, rejected, stats } = await filterAndClassify(rawForEngine);

  const enrichedProspects: DiscoveredProspect[] = accepted.map((sp) => ({
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

  let ingest = { prospectsCreated: 0, showsCreated: 0, status: 0 };
  if (runId && (enrichedProspects.length > 0 || rawShows.length > 0)) {
    ingest = await postToIngest(enrichedProspects, rawShows, runId);
  } else if (enrichedProspects.length > 0 || rawShows.length > 0) {
    ingest = await postToIngest(enrichedProspects, rawShows, 0);
  }

  return {
    feedsPolled: batch.length,
    totalFeeds: RSS_FEED_TARGETS.length,
    feedResults,
    articlesRelevant: allRelevant.length,
    articlesSentToLlm: articlesForLlm.length,
    rawProspects: rawProspects.length,
    logicEngineStats: stats,
    logicEngineRejected: rejected.map((r) => ({ company: r.company, reason: r.reason })),
    prospectsAccepted: enrichedProspects.length,
    prospectsCreated: ingest.prospectsCreated,
    showsFound: rawShows.length,
    showsCreated: ingest.showsCreated,
    ingestStatus: ingest.status,
  };
}

export async function rssIntelligenceHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron && user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "db unavailable" });

    const [run] = await db
      .insert(salesAgentRuns)
      .values({
        runType: "rss_intelligence",
        status: "running",
        startedAt: new Date(),
      })
      .returning({ id: salesAgentRuns.id });

    const runId = run?.id;
    const result = await runRssIntelligence(runId);

    if (runId) {
      await db
        .update(salesAgentRuns)
        .set({
          status: "completed",
          prospectsFound: result.prospectsAccepted,
          prospectsCreated: result.prospectsCreated,
          showsFound: result.showsFound,
          completedAt: new Date(),
          details: result,
        })
        .where(eq(salesAgentRuns.id, runId));
    }

    res.json({ ok: true, runId, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[rssIntelligence] Error:", msg);
    res.status(500).json({ ok: false, error: msg });
  }
}
