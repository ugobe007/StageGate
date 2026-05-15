/**
 * scripts/seed-v43-shows.mjs
 * Seeds CES 2026/2027, NAB 2026, and MODEX 2026 into the trade_shows table
 * with exhibitorListUrl set so the discovery scraper can auto-run against them.
 *
 * Usage: node scripts/seed-v43-shows.mjs
 */

import pg from "pg";
const { Client } = pg;

const connString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
if (!connString) {
  console.error("No database connection string found in SUPABASE_DATABASE_URL or DATABASE_URL");
  process.exit(1);
}

const SHOWS = [
  // ─── CES ──────────────────────────────────────────────────────────────────
  {
    name: "CES 2026",
    location: "Las Vegas, NV",
    venue: "Las Vegas Convention Center",
    city: "Las Vegas",
    startDate: "2026-01-06",
    endDate: "2026-01-09",
    website: "https://www.ces.tech",
    // CES exhibitor search filtered to robotics/AI/automation
    exhibitorListUrl: "https://exhibitors.ces.tech/8_0/index.cfm?event=ces.exhibitorSearch&exhid=&sview=list&searchby=category&q=Robotics%2C+Drones+%26+Unmanned+Systems",
    status: "upcoming",
    description: "Consumer Electronics Show — largest tech trade show in the world. Robotics, AI, and automation companies are a major and growing segment.",
    roboticsRelevance: 5,
    estimatedExhibitors: 4500,
    roboticsExhibitors: 300,
  },
  {
    name: "CES 2027",
    location: "Las Vegas, NV",
    venue: "Las Vegas Convention Center",
    city: "Las Vegas",
    startDate: "2027-01-05",
    endDate: "2027-01-08",
    website: "https://www.ces.tech",
    exhibitorListUrl: "https://exhibitors.ces.tech/8_0/index.cfm?event=ces.exhibitorSearch&exhid=&sview=list&searchby=category&q=Robotics%2C+Drones+%26+Unmanned+Systems",
    status: "upcoming",
    description: "Consumer Electronics Show 2027 — robotics and AI segment expected to grow significantly.",
    roboticsRelevance: 5,
    estimatedExhibitors: 4800,
    roboticsExhibitors: 380,
  },
  // ─── NAB ──────────────────────────────────────────────────────────────────
  {
    name: "NAB Show 2026",
    location: "Las Vegas, NV",
    venue: "Las Vegas Convention Center",
    city: "Las Vegas",
    startDate: "2026-04-18",
    endDate: "2026-04-23",
    website: "https://www.nabshow.com",
    // NAB exhibitor directory — robotics/automation/AI category
    exhibitorListUrl: "https://nabshow.com/exhibitors/?category=Artificial+Intelligence+%26+Machine+Learning",
    status: "upcoming",
    description: "National Association of Broadcasters Show — media, broadcast, and production technology. Growing robotics presence: camera robots, autonomous broadcast systems, AI-driven production.",
    roboticsRelevance: 3,
    estimatedExhibitors: 1700,
    roboticsExhibitors: 80,
  },
  // ─── MODEX ────────────────────────────────────────────────────────────────
  {
    name: "MODEX 2026",
    location: "Atlanta, GA",
    venue: "Georgia World Congress Center",
    city: "Atlanta",
    startDate: "2026-03-09",
    endDate: "2026-03-12",
    website: "https://www.modexshow.com",
    // MODEX exhibitor list — warehouse automation, AMRs, industrial robots
    exhibitorListUrl: "https://www.modexshow.com/exhibitors/",
    status: "upcoming",
    description: "MODEX — supply chain and material handling trade show. Largest concentration of warehouse AMRs, autonomous forklifts, and industrial robots in North America.",
    roboticsRelevance: 5,
    estimatedExhibitors: 1000,
    roboticsExhibitors: 250,
  },
  // ─── Additional high-value Las Vegas shows ─────────────────────────────────
  {
    name: "NVIDIA GTC 2026",
    location: "San Jose, CA",
    venue: "San Jose McEnery Convention Center",
    city: "San Jose",
    startDate: "2026-03-17",
    endDate: "2026-03-20",
    website: "https://www.nvidia.com/gtc/",
    exhibitorListUrl: "https://www.nvidia.com/gtc/exhibitors/",
    status: "upcoming",
    description: "NVIDIA GPU Technology Conference — AI, robotics, and autonomous systems. Major platform for humanoid and autonomous robot companies using NVIDIA Isaac.",
    roboticsRelevance: 5,
    estimatedExhibitors: 400,
    roboticsExhibitors: 150,
  },
  {
    name: "AUTOMATE 2026",
    location: "Detroit, MI",
    venue: "Huntington Place",
    city: "Detroit",
    startDate: "2026-05-18",
    endDate: "2026-05-21",
    website: "https://www.automateshow.com",
    exhibitorListUrl: "https://www.automateshow.com/exhibitors/",
    status: "upcoming",
    description: "Automate Show — North America's largest robotics and automation trade show. Cobots, industrial arms, AMRs, and vision systems.",
    roboticsRelevance: 5,
    estimatedExhibitors: 800,
    roboticsExhibitors: 500,
  },
  {
    name: "IREX 2025",
    location: "Tokyo, Japan",
    venue: "Tokyo Big Sight",
    city: "Tokyo",
    startDate: "2025-12-03",
    endDate: "2025-12-06",
    website: "https://www.irex.jp/en/",
    exhibitorListUrl: "https://www.irex.jp/en/exhibitors/",
    status: "upcoming",
    description: "International Robot Exhibition — world's largest robotics trade show. Key for discovering Japanese robot OEMs (Fanuc, Yaskawa, Kawasaki, Unitree, etc.) before they exhibit in the US.",
    roboticsRelevance: 5,
    estimatedExhibitors: 600,
    roboticsExhibitors: 600,
  },
];

async function main() {
  const client = new Client({ connectionString: connString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log(`Seeding ${SHOWS.length} trade shows...`);

  let inserted = 0;
  let updated = 0;

  for (const show of SHOWS) {
    // Check if show already exists by name
    const existing = await client.query(
      'SELECT id FROM trade_shows WHERE name = $1',
      [show.name]
    );

    if (existing.rows.length > 0) {
      // Update exhibitorListUrl and metadata for existing shows
      await client.query(
        `UPDATE trade_shows SET 
          "exhibitorListUrl" = $1, 
          website = $2, 
          "startDate" = $3, 
          "endDate" = $4,
          "roboticsRelevance" = $5,
          "estimatedExhibitors" = $6,
          "roboticsExhibitors" = $7,
          description = $8
        WHERE name = $9`,
        [
          show.exhibitorListUrl,
          show.website,
          show.startDate,
          show.endDate,
          show.roboticsRelevance,
          show.estimatedExhibitors,
          show.roboticsExhibitors,
          show.description,
          show.name,
        ]
      );
      console.log(`  UPDATED: ${show.name} — exhibitorListUrl set`);
      updated++;
    } else {
      // Insert new show
      await client.query(
        `INSERT INTO trade_shows 
          (name, location, venue, city, "startDate", "endDate", website, "exhibitorListUrl", 
           status, description, "roboticsRelevance", "estimatedExhibitors", "roboticsExhibitors")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          show.name,
          show.location,
          show.venue,
          show.city,
          show.startDate,
          show.endDate,
          show.website,
          show.exhibitorListUrl,
          show.status,
          show.description,
          show.roboticsRelevance,
          show.estimatedExhibitors,
          show.roboticsExhibitors,
        ]
      );
      console.log(`  INSERTED: ${show.name} (${show.city}) — ${show.exhibitorListUrl}`);
      inserted++;
    }
  }

  await client.end();
  console.log(`\nDone. Inserted: ${inserted}, Updated: ${updated}`);
}

main().catch(e => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});
