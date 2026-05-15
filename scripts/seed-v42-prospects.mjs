/**
 * seed-v42-prospects.mjs
 *
 * Seeds the prospects table with:
 * 1. Expanded robot OEM list (MiR, Locus, OTTO, Pudu, Keenon, Apptronik, etc.)
 * 2. Trade show ecosystem vendors (Freeman, GES, GPJ, Encore, DHL, venues, etc.)
 *
 * Run: node scripts/seed-v42-prospects.mjs
 */

import pg from "pg";
const { Client } = pg;

const DB_URL = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
if (!DB_URL) throw new Error("No DATABASE_URL found");

// ─── Robot OEM Prospects (customer angle) ─────────────────────────────────────
const ROBOT_OEMS = [
  // Wheeled AMR / Logistics Robots
  {
    company: "MiR (Mobile Industrial Robots)",
    website: "https://www.mobile-industrial-robots.com",
    contactTitle: "VP of Sales",
    contactEmail: "info@mobile-industrial-robots.com",
    robotName: "MiR250",
    robotType: "wheeled_amr",
    robotCategory: "mixed",
    hqCountry: "Denmark",
    notes: "Danish AMR company, strong in warehouse and manufacturing. Acquired by Teradyne. Active at MODEX, ProMat, Automate.",
    shows: JSON.stringify(["MODEX", "ProMat", "Automate", "CES"]),
    vendorType: "robot_oem",
    outreachAngle: "customer",
    emailConfidence: "medium",
  },
  {
    company: "Locus Robotics",
    website: "https://www.locusrobotics.com",
    contactTitle: "VP of Marketing",
    contactEmail: "info@locusrobotics.com",
    robotName: "LocusBot",
    robotType: "wheeled_amr",
    robotCategory: "mixed",
    hqCountry: "USA",
    notes: "Warehouse AMR company. Active at MODEX, ProMat. Backed by Tiger Global.",
    shows: JSON.stringify(["MODEX", "ProMat", "PACK EXPO"]),
    vendorType: "robot_oem",
    outreachAngle: "customer",
    emailConfidence: "medium",
  },
  {
    company: "OTTO Motors",
    website: "https://www.ottomotors.com",
    contactTitle: "Head of Events",
    contactEmail: "info@ottomotors.com",
    robotName: "OTTO 1500",
    robotType: "wheeled_amr",
    robotCategory: "mixed",
    hqCountry: "Canada",
    notes: "Heavy-duty AMR for manufacturing. Subsidiary of Rockwell Automation. Active at Automate, MODEX.",
    shows: JSON.stringify(["Automate", "MODEX", "ProMat"]),
    vendorType: "robot_oem",
    outreachAngle: "customer",
    emailConfidence: "medium",
  },
  // Service Robots
  {
    company: "Pudu Robotics",
    website: "https://www.pudurobotics.com",
    contactTitle: "VP of Business Development",
    contactEmail: "info@pudurobotics.com",
    robotName: "BellaBot",
    robotType: "service_robot",
    robotCategory: "light",
    hqCountry: "China",
    notes: "Leading restaurant and hospitality robot company. BellaBot, KettyBot, FlashBot. Very active at CES, NAB.",
    shows: JSON.stringify(["CES", "NAB", "NRA Show", "HITEC"]),
    vendorType: "robot_oem",
    outreachAngle: "customer",
    emailConfidence: "medium",
  },
  {
    company: "Keenon Robotics",
    website: "https://www.keenonrobot.com",
    contactTitle: "VP of Sales",
    contactEmail: "info@keenonrobot.com",
    robotName: "DINERBOT T9",
    robotType: "service_robot",
    robotCategory: "light",
    hqCountry: "China",
    notes: "Restaurant and hotel delivery robots. Strong U.S. expansion. Active at CES, NRA Show.",
    shows: JSON.stringify(["CES", "NRA Show", "HITEC"]),
    vendorType: "robot_oem",
    outreachAngle: "customer",
    emailConfidence: "medium",
  },
  // Humanoids
  {
    company: "Apptronik",
    website: "https://apptronik.com",
    contactTitle: "VP of Marketing",
    contactEmail: "info@apptronik.com",
    robotName: "Apollo",
    robotType: "humanoid",
    robotCategory: "light",
    hqCountry: "USA",
    notes: "Austin-based humanoid company. Apollo robot. Backed by Google. Very likely at CES 2027.",
    shows: JSON.stringify(["CES", "Automate", "ICRA"]),
    vendorType: "robot_oem",
    outreachAngle: "customer",
    emailConfidence: "medium",
  },
  {
    company: "Sanctuary AI",
    website: "https://sanctuary.ai",
    contactTitle: "Head of Events",
    contactEmail: "info@sanctuary.ai",
    robotName: "Phoenix",
    robotType: "humanoid",
    robotCategory: "light",
    hqCountry: "Canada",
    notes: "Canadian humanoid company. Phoenix robot. Focused on general-purpose humanoid AI.",
    shows: JSON.stringify(["CES", "ICRA", "Automate"]),
    vendorType: "robot_oem",
    outreachAngle: "customer",
    emailConfidence: "medium",
  },
  {
    company: "1X Technologies",
    website: "https://www.1x.tech",
    contactTitle: "VP of Marketing",
    contactEmail: "info@1x.tech",
    robotName: "NEO",
    robotType: "humanoid",
    robotCategory: "light",
    hqCountry: "Norway",
    notes: "Norwegian humanoid company backed by OpenAI. NEO robot for home and commercial use.",
    shows: JSON.stringify(["CES", "ICRA"]),
    vendorType: "robot_oem",
    outreachAngle: "customer",
    emailConfidence: "medium",
  },
  {
    company: "Fourier Intelligence",
    website: "https://www.fourierintelligence.com",
    contactTitle: "VP of Business Development",
    contactEmail: "info@fourierintelligence.com",
    robotName: "GR-1",
    robotType: "humanoid",
    robotCategory: "light",
    hqCountry: "China",
    notes: "Chinese humanoid company. GR-1 robot. Strong rehabilitation and industrial focus. Active at CES.",
    shows: JSON.stringify(["CES", "ICRA", "Automate"]),
    vendorType: "robot_oem",
    outreachAngle: "customer",
    emailConfidence: "medium",
  },
  {
    company: "UBTECH Robotics",
    website: "https://www.ubtrobot.com",
    contactTitle: "VP of Marketing",
    contactEmail: "info@ubtrobot.com",
    robotName: "Walker X",
    robotType: "humanoid",
    robotCategory: "light",
    hqCountry: "China",
    notes: "Chinese humanoid and consumer robot company. Walker X humanoid. Very active at CES.",
    shows: JSON.stringify(["CES", "NAB", "ICRA"]),
    vendorType: "robot_oem",
    outreachAngle: "customer",
    emailConfidence: "medium",
  },
];

// ─── Trade Show Ecosystem Vendors (partner angle) ─────────────────────────────
const ECOSYSTEM_VENDORS = [
  // Tier 1 — Exhibit Houses / General Contractors
  {
    company: "Freeman",
    website: "https://www.freeman.com",
    contactTitle: "VP of Innovation",
    contactEmail: "info@freeman.com",
    notes: "Largest U.S. trade show contractor. GC at CES and many Las Vegas shows. Booth fabrication, logistics, electrical, labor, rigging. KEY PARTNER — pitch: robotics technical operations layer inside their workflow.",
    shows: JSON.stringify(["CES", "NAB", "MODEX", "Automate"]),
    vendorType: "exhibit_house",
    outreachAngle: "partner",
    emailConfidence: "medium",
    robotType: "other",
    robotCategory: "light",
  },
  {
    company: "GES Global Experience Specialists",
    website: "https://www.ges.com",
    contactTitle: "VP of Operations",
    contactEmail: "info@ges.com",
    notes: "Major exhibit operations and event contractor for large conventions. GC at many Las Vegas shows. KEY PARTNER.",
    shows: JSON.stringify(["CES", "NAB", "CEDIA"]),
    vendorType: "exhibit_house",
    outreachAngle: "partner",
    emailConfidence: "medium",
    robotType: "other",
    robotCategory: "light",
  },
  {
    company: "George P. Johnson (GPJ)",
    website: "https://www.gpj.com",
    contactTitle: "VP of Technology",
    contactEmail: "info@gpj.com",
    notes: "Enterprise experiential design and large custom activations. Subcontracts physical builds. Robot companies use GPJ for major show activations.",
    shows: JSON.stringify(["CES", "NAB", "Automate"]),
    vendorType: "agency",
    outreachAngle: "partner",
    emailConfidence: "medium",
    robotType: "other",
    robotCategory: "light",
  },
  {
    company: "MC2 Experience",
    website: "https://www.mc-2.com",
    contactTitle: "VP of Technology",
    contactEmail: "info@mc-2.com",
    notes: "Custom exhibit environments and experiential marketing. Handles large robot company booth builds.",
    shows: JSON.stringify(["CES", "NAB"]),
    vendorType: "exhibit_house",
    outreachAngle: "partner",
    emailConfidence: "medium",
    robotType: "other",
    robotCategory: "light",
  },
  {
    company: "Momentum Worldwide",
    website: "https://www.momentumww.com",
    contactTitle: "VP of Innovation",
    contactEmail: "info@momentumww.com",
    notes: "Interactive brand activations and event experiences. Increasingly integrating robots into activations.",
    shows: JSON.stringify(["CES", "NAB"]),
    vendorType: "agency",
    outreachAngle: "partner",
    emailConfidence: "medium",
    robotType: "other",
    robotCategory: "light",
  },
  // Tier 2 — Mid-Sized Exhibit Houses
  {
    company: "Absolute Exhibits",
    website: "https://www.absoluteexhibits.com",
    contactTitle: "VP of Operations",
    contactEmail: "info@absoluteexhibits.com",
    notes: "Mid-sized exhibit house. Faster adoption of new services than Freeman/GES. Good early partner target.",
    shows: JSON.stringify(["CES", "NAB", "CEDIA"]),
    vendorType: "exhibit_house",
    outreachAngle: "partner",
    emailConfidence: "medium",
    robotType: "other",
    robotCategory: "light",
  },
  {
    company: "Blueprint Exhibits",
    website: "https://www.blueprintexhibits.com",
    contactTitle: "VP of Operations",
    contactEmail: "info@blueprintexhibits.com",
    notes: "Custom exhibit builds and installation/dismantle support. Las Vegas focused.",
    shows: JSON.stringify(["CES", "NAB"]),
    vendorType: "exhibit_house",
    outreachAngle: "partner",
    emailConfidence: "medium",
    robotType: "other",
    robotCategory: "light",
  },
  {
    company: "Pure Exhibits",
    website: "https://www.pureexhibits.com",
    contactTitle: "VP of Operations",
    contactEmail: "info@pureexhibits.com",
    notes: "Turnkey booth rentals and modular systems. Good early partner for robot company referrals.",
    shows: JSON.stringify(["CES", "NAB"]),
    vendorType: "exhibit_house",
    outreachAngle: "partner",
    emailConfidence: "medium",
    robotType: "other",
    robotCategory: "light",
  },
  {
    company: "Exhibit Pros",
    website: "https://www.exhibitpros.com",
    contactTitle: "VP of Operations",
    contactEmail: "info@exhibitpros.com",
    notes: "Turnkey booth rentals, AV rentals, installation, project management.",
    shows: JSON.stringify(["CES", "NAB"]),
    vendorType: "exhibit_house",
    outreachAngle: "partner",
    emailConfidence: "medium",
    robotType: "other",
    robotCategory: "light",
  },
  {
    company: "Nimlok Las Vegas",
    website: "https://www.nimlok.com",
    contactTitle: "VP of Operations",
    contactEmail: "info@nimlok.com",
    notes: "Modular and custom exhibit systems. Strong Las Vegas presence.",
    shows: JSON.stringify(["CES", "NAB", "CEDIA"]),
    vendorType: "exhibit_house",
    outreachAngle: "partner",
    emailConfidence: "medium",
    robotType: "other",
    robotCategory: "light",
  },
  {
    company: "The Trade Group",
    website: "https://www.thetradegroup.com",
    contactTitle: "VP of Operations",
    contactEmail: "info@thetradegroup.com",
    notes: "Large custom trade show exhibits and experiential booths.",
    shows: JSON.stringify(["CES", "NAB"]),
    vendorType: "exhibit_house",
    outreachAngle: "partner",
    emailConfidence: "medium",
    robotType: "other",
    robotCategory: "light",
  },
  // AV / Electrical / Event Technology
  {
    company: "Encore (PSAV)",
    website: "https://www.encoreglobal.com",
    contactTitle: "VP of Technology",
    contactEmail: "info@encoreglobal.com",
    notes: "PSAV Encore — AV, power, networking, event technology. Controls electrical at many Las Vegas venues. Critical partner for robot charging infrastructure.",
    shows: JSON.stringify(["CES", "NAB", "CEDIA"]),
    vendorType: "av_electrical",
    outreachAngle: "partner",
    emailConfidence: "medium",
    robotType: "other",
    robotCategory: "light",
  },
  {
    company: "PRG",
    website: "https://www.prg.com",
    contactTitle: "VP of Technology",
    contactEmail: "info@prg.com",
    notes: "PRG — staging, AV systems, technical integration for large events. Increasingly integrating robots into stage productions.",
    shows: JSON.stringify(["CES", "NAB"]),
    vendorType: "av_electrical",
    outreachAngle: "partner",
    emailConfidence: "medium",
    robotType: "other",
    robotCategory: "light",
  },
  {
    company: "AVI-SPL",
    website: "https://www.avispl.com",
    contactTitle: "VP of Technology",
    contactEmail: "info@avispl.com",
    notes: "Enterprise AV and technical systems integration. Handles large convention center AV infrastructure.",
    shows: JSON.stringify(["CES", "NAB"]),
    vendorType: "av_electrical",
    outreachAngle: "partner",
    emailConfidence: "medium",
    robotType: "other",
    robotCategory: "light",
  },
  // Freight / Logistics
  {
    company: "DHL Express",
    website: "https://www.dhl.com",
    contactTitle: "VP of Special Services",
    contactEmail: "info@dhl.com",
    notes: "International freight — robots frequently damaged in transit. White glove robotics handling opportunity. Battery-safe transport and customs support.",
    shows: JSON.stringify(["CES", "Automate", "MODEX"]),
    vendorType: "freight",
    outreachAngle: "partner",
    emailConfidence: "medium",
    robotType: "other",
    robotCategory: "light",
  },
  {
    company: "FedEx Custom Critical",
    website: "https://www.fedexcustomcritical.com",
    contactTitle: "VP of Special Services",
    contactEmail: "info@fedexcustomcritical.com",
    notes: "High-value freight — ideal for robot shipments requiring powered storage and battery-safe transport.",
    shows: JSON.stringify(["CES", "Automate"]),
    vendorType: "freight",
    outreachAngle: "partner",
    emailConfidence: "medium",
    robotType: "other",
    robotCategory: "light",
  },
  {
    company: "UPS Supply Chain Solutions",
    website: "https://www.ups.com",
    contactTitle: "VP of Special Services",
    contactEmail: "info@ups.com",
    notes: "Supply chain logistics — customs support and unpack/activation services for international robot shipments.",
    shows: JSON.stringify(["CES", "Automate", "MODEX"]),
    vendorType: "freight",
    outreachAngle: "partner",
    emailConfidence: "medium",
    robotType: "other",
    robotCategory: "light",
  },
  {
    company: "DB Schenker",
    website: "https://www.dbschenker.com",
    contactTitle: "VP of Special Services",
    contactEmail: "info@dbschenker.com",
    notes: "Global freight and logistics — strong in trade show drayage and international robot shipments from Germany/Asia.",
    shows: JSON.stringify(["CES", "Automate"]),
    vendorType: "freight",
    outreachAngle: "partner",
    emailConfidence: "medium",
    robotType: "other",
    robotCategory: "light",
  },
  // Las Vegas Venues
  {
    company: "Las Vegas Convention Center",
    website: "https://www.lvcva.com",
    contactTitle: "Director of Operations",
    contactEmail: "info@lvcva.com",
    notes: "Primary CES venue. Approved vendor status here is critical for StageGate. Target: become preferred robotics logistics vendor and emergency technical support.",
    shows: JSON.stringify(["CES", "NAB", "CEDIA"]),
    vendorType: "venue",
    outreachAngle: "partner",
    emailConfidence: "medium",
    robotType: "other",
    robotCategory: "light",
  },
  {
    company: "The Venetian Expo",
    website: "https://www.venetianexpo.com",
    contactTitle: "Director of Operations",
    contactEmail: "info@venetianexpo.com",
    notes: "Major Las Vegas convention venue. Host to many tech and robotics adjacent shows.",
    shows: JSON.stringify(["CES", "NAB"]),
    vendorType: "venue",
    outreachAngle: "partner",
    emailConfidence: "medium",
    robotType: "other",
    robotCategory: "light",
  },
  {
    company: "Mandalay Bay Convention Center",
    website: "https://www.mandalaybay.com",
    contactTitle: "Director of Operations",
    contactEmail: "info@mandalaybay.com",
    notes: "Major Las Vegas convention venue. Host to CEDIA Expo and other tech shows.",
    shows: JSON.stringify(["CEDIA", "CES"]),
    vendorType: "venue",
    outreachAngle: "partner",
    emailConfidence: "medium",
    robotType: "other",
    robotCategory: "light",
  },
  {
    company: "Caesars Forum",
    website: "https://www.caesarsforum.com",
    contactTitle: "Director of Operations",
    contactEmail: "info@caesarsforum.com",
    notes: "Caesars Forum convention center — major Las Vegas event venue. Growing tech event presence.",
    shows: JSON.stringify(["CES"]),
    vendorType: "venue",
    outreachAngle: "partner",
    emailConfidence: "medium",
    robotType: "other",
    robotCategory: "light",
  },
];

const ALL_PROSPECTS = [...ROBOT_OEMS, ...ECOSYSTEM_VENDORS];

async function seed() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log(`Seeding ${ALL_PROSPECTS.length} prospects...`);
  let inserted = 0;
  let skipped = 0;

  for (const p of ALL_PROSPECTS) {
    // Check if already exists
    const existing = await client.query(
      'SELECT id FROM prospects WHERE company = $1 LIMIT 1',
      [p.company]
    );
    if (existing.rows.length > 0) {
      // Update vendorType and outreachAngle for existing records
    await client.query(
      'UPDATE prospects SET "vendorType" = $1, "outreachAngle" = $2 WHERE company = $3',
      [p.vendorType, p.outreachAngle, p.company]
    );
      console.log(`  UPDATED: ${p.company} (${p.vendorType})`);
      skipped++;
      continue;
    }

    await client.query(
      `INSERT INTO prospects 
        (company, website, "contactTitle", "contactEmail", "robotName", "robotType", "robotCategory", 
         "hqCountry", notes, shows, status, "vendorType", "outreachAngle", "emailConfidence", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'new', $11, $12, $13, NOW(), NOW())`,
      [
        p.company,
        p.website || null,
        p.contactTitle || null,
        p.contactEmail || null,
        p.robotName || null,
        p.robotType || "other",
        p.robotCategory || "light",
        p.hqCountry || null,
        p.notes || null,
        p.shows || "[]",
        p.vendorType,
        p.outreachAngle,
        p.emailConfidence || "medium",
      ]
    );
    console.log(`  INSERTED: ${p.company} (${p.vendorType} / ${p.outreachAngle})`);
    inserted++;
  }

  await client.end();
  console.log(`\nDone. Inserted: ${inserted}, Updated: ${skipped}`);
}

seed().catch(err => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
