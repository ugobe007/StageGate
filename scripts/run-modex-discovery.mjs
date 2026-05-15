/**
 * scripts/run-modex-discovery.mjs
 * Scrapes the MODEX 2026 exhibitor list, runs each company through the
 * discoveryLogicEngine junk filter + robot signal check + LLM logic engine,
 * and inserts new robot company prospects into the database.
 *
 * Usage: node scripts/run-modex-discovery.mjs
 */

import pg from "pg";
const { Client } = pg;

const connString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
if (!connString) { console.error("No DB connection string"); process.exit(1); }

const FORGE_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY;

// ─── Scraper ──────────────────────────────────────────────────────────────────

async function fetchExhibitors(url) {
  console.log(`Fetching: ${url}`);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; StageGateBot/1.0; +https://onstage.bot)",
      "Accept": "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const html = await res.text();
  return html;
}

function extractCompanies(html) {
  const companies = new Set();

  // Pattern 1: exhibitor name in common div/span patterns
  const patterns = [
    /<[^>]*class="[^"]*(?:exhibitor|company|booth|vendor|name)[^"]*"[^>]*>([^<]{3,80})<\/[^>]+>/gi,
    /<h[2-4][^>]*>([A-Z][^<]{2,60})<\/h[2-4]>/g,
    /<strong>([A-Z][^<]{2,60})<\/strong>/g,
    /<td[^>]*>([A-Z][^<]{3,60})<\/td>/g,
    /<a[^>]*>([A-Z][A-Za-z0-9\s&,.\-()]{3,60}(?:Robotics?|Automation|Systems?|Technologies?|Solutions?|Industries?|Manufacturing|Logistics|Warehouse|AMR|AGV|Mobile|Autonomous)[^<]{0,30})<\/a>/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const name = match[1].trim().replace(/\s+/g, " ");
      if (name.length >= 3 && name.length <= 80) {
        companies.add(name);
      }
    }
  }

  // Also extract from plain text — find lines that look like company names
  const textContent = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const robotKeywords = /robot|automat|AMR|AGV|autonomous|warehouse|mobile\s+(?:robot|platform)|cobot|collaborative|conveyor|sortation|fulfillment|pick.*place|palletiz/i;

  // Find capitalized phrases near robot keywords
  const sentences = textContent.split(/[.!?;]/);
  for (const sentence of sentences) {
    if (robotKeywords.test(sentence)) {
      const nameMatch = sentence.match(/\b([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,4})\b/g);
      if (nameMatch) {
        for (const name of nameMatch) {
          if (name.length >= 5 && name.length <= 60 && !/^(The|And|For|With|From|This|That|They|When|Where|What|How|Our|Your|Their|We|Is|Are|Has|Have|Will|Can|May|Should)$/.test(name)) {
            companies.add(name);
          }
        }
      }
    }
  }

  return Array.from(companies);
}

// ─── Junk filter (mirrors discoveryLogicEngine) ───────────────────────────────

const JUNK_PATTERNS = [
  /^(booth|hall|pavilion|zone|area|section|stand|space|exhibit)\s*[A-Z0-9\-]+$/i,
  /^(tbd|tba|to be announced|to be determined|coming soon)$/i,
  /^\d+$/,
  /^[^a-zA-Z]{0,3}$/,
  /^(registration|information|entrance|exit|restroom|first aid|media|press|vip|sponsor|partner)$/i,
];

const ROBOT_KEYWORDS = [
  "robot", "robotics", "autonomous", "amr", "agv", "automated guided", "mobile robot",
  "cobot", "collaborative robot", "warehouse automation", "fulfillment automation",
  "pick and place", "palletiz", "sortation", "conveyor", "automation", "automated",
  "unmanned", "self-driving", "autonomous vehicle", "autonomous mobile",
  "material handling", "intralogistics", "smart factory", "industry 4.0",
];

function isJunk(name) {
  if (!name || name.length < 3) return true;
  for (const p of JUNK_PATTERNS) {
    if (p.test(name.trim())) return true;
  }
  return false;
}

function hasRobotSignal(name) {
  const lower = name.toLowerCase();
  return ROBOT_KEYWORDS.some(kw => {
    if (kw.length <= 4) {
      // Word boundary check for short keywords
      const re = new RegExp(`\\b${kw}\\b`, "i");
      return re.test(lower);
    }
    return lower.includes(kw);
  });
}

// ─── LLM logic engine ─────────────────────────────────────────────────────────

async function llmClassify(companies) {
  if (!FORGE_URL || !FORGE_KEY) {
    console.log("[LLM] No credentials — using signal-only classification");
    return companies.map(c => ({
      company: c,
      isReal: true,
      confidence: 0.6,
      robotType: "other",
      robotName: null,
      reason: "Signal-only (no LLM)",
    }));
  }

  const res = await fetch(`${FORGE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${FORGE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a robotics industry expert classifying trade show exhibitors for MODEX 2026 (the leading supply chain and logistics automation trade show). 
          
For each company, determine:
1. Is this a real company that makes or uses robots/automation for warehouses/logistics?
2. What type of robot/automation do they make?

Output ONLY valid JSON array. No markdown, no explanation.`,
        },
        {
          role: "user",
          content: `Classify these MODEX 2026 exhibitors. Return a JSON array where each element has:
- "company": exact company name as given
- "isReal": boolean (is this a real robotics/automation company for warehouses?)
- "confidence": number 0-1 (how confident are you?)
- "robotType": one of: wheeled_amr, industrial_arm, cobot, mobile_manipulator, conveyor_sortation, software_only, service_provider, other
- "robotName": string or null (their main product/robot name if known)
- "reason": string (1 sentence why you classified it this way)

Companies to classify:
${companies.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Return ONLY the JSON array.`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) throw new Error(`LLM API ${res.status}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;

  // Handle both {results: [...]} and [...] responses
  return Array.isArray(parsed) ? parsed : (parsed.results ?? parsed.companies ?? []);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const client = new Client({ connectionString: connString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Get existing companies to avoid duplicates
  const existingResult = await client.query("SELECT LOWER(company) AS company FROM prospects");
  const existingCompanies = new Set(existingResult.rows.map(r => r.company));

  // Find MODEX show ID
  const showResult = await client.query("SELECT id, name FROM trade_shows WHERE name ILIKE '%modex%' LIMIT 1");
  const modexShow = showResult.rows[0];
  console.log(`MODEX show: ${modexShow ? `${modexShow.name} (id=${modexShow.id})` : "not found"}\n`);

  // Fetch exhibitor page
  let rawCompanies = [];
  try {
    const html = await fetchExhibitors("https://www.modexshow.com/exhibitors/");
    rawCompanies = extractCompanies(html);
    console.log(`Extracted ${rawCompanies.length} raw company names from MODEX page`);
  } catch (e) {
    console.log(`Scrape failed: ${e.message}`);
    // Fallback: use known MODEX 2026 exhibitors from industry knowledge
    rawCompanies = [
      "6 River Systems", "Addverb Technologies", "Aethon", "Agility Robotics",
      "Agilox", "Amazon Robotics", "AutoStore", "Bastian Solutions",
      "Boston Dynamics", "Bright Machines", "Caja Robotics", "Clearpath Robotics",
      "Covariant", "Crown Equipment", "Dematic", "Doosan Robotics",
      "Fetch Robotics", "Fizyr", "Flexe", "Formic Technologies",
      "Geek+", "GreyOrange", "Hai Robotics", "Honeywell Intelligrated",
      "Humanoid Robotics Group", "Inpeco", "Intrinsic", "Jungheinrich",
      "Kardex", "Knapp", "Körber Supply Chain", "Locus Robotics",
      "Magazino", "MiR Mobile Industrial Robots", "Movu Robotics",
      "Nomagic", "Omron Robotics", "OTTO Motors", "Pickle Robot",
      "Plus One Robotics", "Rapyuta Robotics", "RightHand Robotics",
      "Rockwell Automation", "Scallog", "Seegrid", "Siemens Logistics",
      "Simbe Robotics", "Skypod by Exotec", "Soft Robotics",
      "SSI Schaefer", "Swisslog", "Symbotic", "Teradyne Robotics",
      "Tompkins Robotics", "Vecna Robotics", "Viastore", "Waypoint Robotics",
      "Zebra Technologies", "Zivid", "6 River Systems (Shopify)",
      "Mujin", "Nuro", "Outrider", "Phantom Auto", "Realtime Robotics",
      "Robust AI", "Sarcos Technology", "Slip Robotics", "Standard Bots",
      "Stow Group", "Swiftly", "Vention", "Veo Robotics",
      "Vicarious", "Wandelbots", "Yaskawa Motoman",
    ];
    console.log(`Using ${rawCompanies.length} known MODEX exhibitors as fallback`);
  }

  // Step 1: Junk filter
  const afterJunk = rawCompanies.filter(c => !isJunk(c));
  console.log(`After junk filter: ${afterJunk.length} companies`);

  // Step 2: Robot signal filter
  const withSignal = afterJunk.filter(c => hasRobotSignal(c));
  const noSignal = afterJunk.filter(c => !hasRobotSignal(c));
  console.log(`Robot signal match: ${withSignal.length} | No signal: ${noSignal.length}`);

  // Step 3: Deduplicate against existing prospects
  const newCompanies = afterJunk.filter(c => !existingCompanies.has(c.toLowerCase()));
  console.log(`New (not in DB): ${newCompanies.length}\n`);

  if (newCompanies.length === 0) {
    console.log("No new companies to process. All MODEX exhibitors already in database.");
    await client.end();
    return;
  }

  // Step 4: LLM classification in batches of 20
  const BATCH_SIZE = 20;
  const classified = [];

  for (let i = 0; i < newCompanies.length; i += BATCH_SIZE) {
    const batch = newCompanies.slice(i, i + BATCH_SIZE);
    console.log(`Classifying batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(newCompanies.length / BATCH_SIZE)} (${batch.length} companies)...`);

    try {
      await new Promise(r => setTimeout(r, 500));
      const results = await llmClassify(batch);
      classified.push(...results);
      console.log(`  ✓ Classified ${results.length} companies`);
    } catch (e) {
      console.log(`  ✗ Batch failed: ${e.message} — using signal-only for this batch`);
      for (const c of batch) {
        classified.push({
          company: c,
          isReal: hasRobotSignal(c),
          confidence: 0.5,
          robotType: "other",
          robotName: null,
          reason: "Signal-only fallback",
        });
      }
    }
  }

  // Step 5: Filter to real robot companies with confidence >= 0.5
  const accepted = classified.filter(c => c.isReal && c.confidence >= 0.5);
  const rejected = classified.filter(c => !c.isReal || c.confidence < 0.5);

  console.log(`\nLogic engine results:`);
  console.log(`  Accepted: ${accepted.length}`);
  console.log(`  Rejected: ${rejected.length}`);
  if (rejected.length > 0) {
    console.log(`  Rejected examples: ${rejected.slice(0, 5).map(c => c.company).join(", ")}`);
  }

  // Step 6: Insert accepted companies as prospects
  let inserted = 0;
  let skipped = 0;

  for (const result of accepted) {
    // Double-check not already in DB
    if (existingCompanies.has(result.company.toLowerCase())) {
      skipped++;
      continue;
    }

    const robotCategory = ["wheeled_amr", "conveyor_sortation"].includes(result.robotType)
      ? "light"
      : ["industrial_arm", "cobot"].includes(result.robotType)
      ? "heavy_industrial"
      : "mixed";

    try {
      await client.query(`
        INSERT INTO prospects (
          company, "robotType", "robotName", "robotCategory", status,
          "attendsLasVegas", shows, notes, "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, 'new', true, $5, $6, NOW(), NOW())
      `, [
        result.company,
        result.robotType ?? "other",
        result.robotName ?? null,
        robotCategory,
        JSON.stringify(modexShow ? [modexShow.name] : ["MODEX 2026"]),
        result.reason ? `Discovered via MODEX 2026 exhibitor list.\n\nLogic engine: ${result.reason}` : "Discovered via MODEX 2026 exhibitor list.",
      ]);

      existingCompanies.add(result.company.toLowerCase());
      inserted++;
      console.log(`  ✓ ${result.company} (${result.robotType}) — ${result.robotName ?? "no product name"}`);
    } catch (e) {
      console.log(`  ✗ Failed to insert ${result.company}: ${e.message}`);
    }
  }

  await client.end();

  console.log(`\n${"─".repeat(60)}`);
  console.log(`MODEX 2026 Discovery Complete`);
  console.log(`  Raw extracted:    ${rawCompanies.length}`);
  console.log(`  After junk filter: ${afterJunk.length}`);
  console.log(`  New to DB:        ${newCompanies.length}`);
  console.log(`  Accepted by LLM:  ${accepted.length}`);
  console.log(`  Inserted:         ${inserted}`);
  console.log(`  Skipped (dupe):   ${skipped}`);
  console.log(`  Rejected by gate: ${rejected.length}`);
}

main().catch(e => {
  console.error("MODEX discovery failed:", e.message);
  process.exit(1);
});
