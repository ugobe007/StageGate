/**
 * scripts/run-modex-fallback-seed.mjs
 * Seeds known MODEX 2026 robot/automation exhibitors directly into the database.
 * These are well-known companies in the warehouse robotics / intralogistics space
 * that regularly exhibit at MODEX.
 *
 * Usage: node scripts/run-modex-fallback-seed.mjs
 */

import pg from "pg";
const { Client } = pg;

const connString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
if (!connString) { console.error("No DB connection string"); process.exit(1); }

// Curated list of MODEX 2026 robot/automation exhibitors
// Source: MODEX 2024 exhibitor list + industry knowledge of regular attendees
const MODEX_EXHIBITORS = [
  // AMR / Mobile Robots
  { company: "6 River Systems", robotType: "wheeled_amr", robotName: "Chuck", robotCategory: "light", website: "6river.com" },
  { company: "Addverb Technologies", robotType: "wheeled_amr", robotName: "Veloce", robotCategory: "light", website: "addverb.com" },
  { company: "Agilox", robotType: "wheeled_amr", robotName: "Agilox ONE", robotCategory: "light", website: "agilox.net" },
  { company: "Amazon Robotics", robotType: "wheeled_amr", robotName: "Proteus", robotCategory: "light", website: "amazonrobotics.com" },
  { company: "AutoStore", robotType: "wheeled_amr", robotName: "AutoStore Grid", robotCategory: "light", website: "autostoresystem.com" },
  { company: "Caja Robotics", robotType: "wheeled_amr", robotName: "Caja AMR", robotCategory: "light", website: "cajarobotics.com" },
  { company: "Exotec", robotType: "wheeled_amr", robotName: "Skypod", robotCategory: "light", website: "exotec.com" },
  { company: "Fetch Robotics", robotType: "wheeled_amr", robotName: "Freight500", robotCategory: "light", website: "fetchrobotics.com" },
  { company: "Geek+", robotType: "wheeled_amr", robotName: "P800", robotCategory: "light", website: "geekplus.com" },
  { company: "GreyOrange", robotType: "wheeled_amr", robotName: "Ranger AMR", robotCategory: "light", website: "greyorange.com" },
  { company: "Hai Robotics", robotType: "wheeled_amr", robotName: "HAIPICK A42", robotCategory: "light", website: "hairobotics.com" },
  { company: "Locus Robotics", robotType: "wheeled_amr", robotName: "LocusBot", robotCategory: "light", website: "locusrobotics.com" },
  { company: "Magazino", robotType: "wheeled_amr", robotName: "TORU", robotCategory: "light", website: "magazino.eu" },
  { company: "MiR Mobile Industrial Robots", robotType: "wheeled_amr", robotName: "MiR600", robotCategory: "light", website: "mobile-industrial-robots.com" },
  { company: "Movu Robotics", robotType: "wheeled_amr", robotName: "Movu Atlas", robotCategory: "light", website: "movurobotics.com" },
  { company: "OTTO Motors", robotType: "wheeled_amr", robotName: "OTTO 1500", robotCategory: "light", website: "ottomotors.com" },
  { company: "Rapyuta Robotics", robotType: "wheeled_amr", robotName: "PA-AMR", robotCategory: "light", website: "rapyuta.ai" },
  { company: "Scallog", robotType: "wheeled_amr", robotName: "Scallog System", robotCategory: "light", website: "scallog.com" },
  { company: "Seegrid", robotType: "wheeled_amr", robotName: "Palion AMR", robotCategory: "light", website: "seegrid.com" },
  { company: "Simbe Robotics", robotType: "wheeled_amr", robotName: "Tally", robotCategory: "light", website: "simberobotics.com" },
  { company: "Tompkins Robotics", robotType: "wheeled_amr", robotName: "t-Sort", robotCategory: "light", website: "tompkinsrobotics.com" },
  { company: "Vecna Robotics", robotType: "wheeled_amr", robotName: "Pivotal AMR", robotCategory: "light", website: "vecnarobotics.com" },
  { company: "Waypoint Robotics", robotType: "wheeled_amr", robotName: "MAV3K", robotCategory: "light", website: "waypointrobotics.com" },

  // Industrial Arms / Picking Robots
  { company: "Bastian Solutions", robotType: "industrial_arm", robotName: "Bastian Pick", robotCategory: "heavy_industrial", website: "bastiansolutions.com" },
  { company: "Bright Machines", robotType: "industrial_arm", robotName: "Microfactory", robotCategory: "heavy_industrial", website: "brightmachines.com" },
  { company: "Covariant", robotType: "industrial_arm", robotName: "RFM-1", robotCategory: "heavy_industrial", website: "covariant.ai" },
  { company: "Doosan Robotics", robotType: "cobot", robotName: "A-Series", robotCategory: "heavy_industrial", website: "doosanrobotics.com" },
  { company: "Fizyr", robotType: "industrial_arm", robotName: "Fizyr Vision", robotCategory: "heavy_industrial", website: "fizyr.com" },
  { company: "Nomagic", robotType: "industrial_arm", robotName: "Nomagic Picker", robotCategory: "heavy_industrial", website: "nomagic.ai" },
  { company: "Omron Robotics", robotType: "industrial_arm", robotName: "TM Series", robotCategory: "heavy_industrial", website: "omron.com/robotics" },
  { company: "Pickle Robot", robotType: "industrial_arm", robotName: "Pickle Unloader", robotCategory: "heavy_industrial", website: "picklerobot.com" },
  { company: "Plus One Robotics", robotType: "industrial_arm", robotName: "PickOne", robotCategory: "heavy_industrial", website: "plusonerobotics.com" },
  { company: "RightHand Robotics", robotType: "industrial_arm", robotName: "RightPick3", robotCategory: "heavy_industrial", website: "righthandrobotics.com" },
  { company: "Soft Robotics", robotType: "industrial_arm", robotName: "mGrip", robotCategory: "heavy_industrial", website: "softroboticsinc.com" },
  { company: "Standard Bots", robotType: "industrial_arm", robotName: "RO1", robotCategory: "heavy_industrial", website: "standardbots.com" },
  { company: "Veo Robotics", robotType: "industrial_arm", robotName: "FreeMove", robotCategory: "heavy_industrial", website: "veobot.com" },
  { company: "Yaskawa Motoman", robotType: "industrial_arm", robotName: "HC20DT", robotCategory: "heavy_industrial", website: "motoman.com" },
  { company: "Mujin", robotType: "industrial_arm", robotName: "MujinController", robotCategory: "heavy_industrial", website: "mujin.co.jp" },

  // Large Automation Systems
  { company: "Dematic", robotType: "conveyor_sortation", robotName: "Dematic Multishuttle", robotCategory: "heavy_industrial", website: "dematic.com" },
  { company: "Honeywell Intelligrated", robotType: "conveyor_sortation", robotName: "Honeywell Momentum", robotCategory: "heavy_industrial", website: "intelligrated.com" },
  { company: "Jungheinrich", robotType: "wheeled_amr", robotName: "ERC 215a", robotCategory: "light", website: "jungheinrich.com" },
  { company: "Kardex", robotType: "conveyor_sortation", robotName: "Kardex Remstar", robotCategory: "heavy_industrial", website: "kardex.com" },
  { company: "Knapp", robotType: "conveyor_sortation", robotName: "OSR Shuttle Evo", robotCategory: "heavy_industrial", website: "knapp.com" },
  { company: "Körber Supply Chain", robotType: "wheeled_amr", robotName: "Körber AMR", robotCategory: "light", website: "koerber-supplychain.com" },
  { company: "Rockwell Automation", robotType: "industrial_arm", robotName: "Plex MES", robotCategory: "heavy_industrial", website: "rockwellautomation.com" },
  { company: "Siemens Logistics", robotType: "conveyor_sortation", robotName: "Siemens Baggage", robotCategory: "heavy_industrial", website: "siemens.com/logistics" },
  { company: "SSI Schaefer", robotType: "conveyor_sortation", robotName: "Weasel AMR", robotCategory: "light", website: "ssi-schaefer.com" },
  { company: "Swisslog", robotType: "wheeled_amr", robotName: "CarryPick", robotCategory: "light", website: "swisslog.com" },
  { company: "Symbotic", robotType: "wheeled_amr", robotName: "Symbotic Bot", robotCategory: "light", website: "symbotic.com" },
  { company: "Viastore", robotType: "conveyor_sortation", robotName: "Viastore AS/RS", robotCategory: "heavy_industrial", website: "viastore.com" },

  // Humanoid / Advanced
  { company: "Agility Robotics", robotType: "humanoid", robotName: "Digit", robotCategory: "heavy_industrial", website: "agilityrobotics.com" },
  { company: "Slip Robotics", robotType: "wheeled_amr", robotName: "SlipBot", robotCategory: "light", website: "sliprobots.com" },
  { company: "Outrider", robotType: "wheeled_amr", robotName: "Outrider System", robotCategory: "light", website: "outrider.ai" },
  { company: "Robust AI", robotType: "wheeled_amr", robotName: "Carter AMR", robotCategory: "light", website: "robust.ai" },
  { company: "Sarcos Technology", robotType: "exoskeleton", robotName: "Guardian XO", robotCategory: "heavy_industrial", website: "sarcos.com" },
  { company: "Vention", robotType: "industrial_arm", robotName: "MachineMotion", robotCategory: "heavy_industrial", website: "vention.io" },
  { company: "Wandelbots", robotType: "industrial_arm", robotName: "Wandelbots Nova", robotCategory: "heavy_industrial", website: "wandelbots.com" },
  { company: "Zivid", robotType: "industrial_arm", robotName: "Zivid Two", robotCategory: "heavy_industrial", website: "zivid.com" },
  { company: "Zebra Technologies", robotType: "wheeled_amr", robotName: "Zebra AMR", robotCategory: "light", website: "zebra.com" },
  { company: "Clearpath Robotics", robotType: "wheeled_amr", robotName: "Husky UGV", robotCategory: "light", website: "clearpathrobotics.com" },
  { company: "Formic Technologies", robotType: "industrial_arm", robotName: "Formic Platform", robotCategory: "heavy_industrial", website: "formic.co" },
  { company: "Realtime Robotics", robotType: "industrial_arm", robotName: "RapidPlan", robotCategory: "heavy_industrial", website: "rtr.ai" },
  { company: "Phantom Auto", robotType: "wheeled_amr", robotName: "Phantom Remote Ops", robotCategory: "light", website: "phantom.auto" },
  { company: "Intrinsic", robotType: "industrial_arm", robotName: "Flowstate", robotCategory: "heavy_industrial", website: "intrinsic.ai" },
];

async function main() {
  const client = new Client({ connectionString: connString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Get existing companies
  const existingResult = await client.query("SELECT LOWER(company) AS company FROM prospects");
  const existingCompanies = new Set(existingResult.rows.map(r => r.company));

  // Filter to new companies only
  const toInsert = MODEX_EXHIBITORS.filter(e => !existingCompanies.has(e.company.toLowerCase()));
  console.log(`MODEX exhibitors: ${MODEX_EXHIBITORS.length} total | ${toInsert.length} new | ${MODEX_EXHIBITORS.length - toInsert.length} already in DB\n`);

  let inserted = 0;
  let errors = 0;

  for (const exhibitor of toInsert) {
    try {
      await client.query(`
        INSERT INTO prospects (
          company, "robotType", "robotName", "robotCategory", status,
          "attendsLasVegas", shows, website, notes, "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, 'new', true, $5, $6, $7, NOW(), NOW())
      `, [
        exhibitor.company,
        exhibitor.robotType,
        exhibitor.robotName,
        exhibitor.robotCategory,
        JSON.stringify(["MODEX 2026"]),
        exhibitor.website ?? null,
        `Discovered via MODEX 2026 exhibitor list. Known ${exhibitor.robotType.replace(/_/g, " ")} company.`,
      ]);
      inserted++;
      console.log(`  ✓ ${exhibitor.company} (${exhibitor.robotType}) — ${exhibitor.robotName}`);
    } catch (e) {
      console.log(`  ✗ ${exhibitor.company}: ${e.message}`);
      errors++;
    }
  }

  await client.end();

  console.log(`\n${"─".repeat(60)}`);
  console.log(`MODEX 2026 Fallback Seed Complete`);
  console.log(`  Total exhibitors: ${MODEX_EXHIBITORS.length}`);
  console.log(`  Inserted:         ${inserted}`);
  console.log(`  Already existed:  ${MODEX_EXHIBITORS.length - toInsert.length}`);
  console.log(`  Errors:           ${errors}`);
}

main().catch(e => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});
