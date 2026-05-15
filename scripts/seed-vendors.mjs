/**
 * seed-vendors.mjs
 *
 * Seeds the vendors table with known Las Vegas trade show logistics vendors.
 * Run once after deployment: node scripts/seed-vendors.mjs
 */
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;

const VENDORS = [
  // ─── Official Show Services (General Contractors) ─────────────────────────
  {
    name: "Freeman",
    type: "freight",
    website: "https://www.freeman.com",
    contact_name: "Exhibitor Support",
    contact_email: "exhibitorservices@freeman.com",
    contact_phone: "888-508-5054",
    address: "6555 W Sunset Rd",
    city: "Las Vegas",
    state: "NV",
    country: "US",
    notes: "Official general contractor for most Las Vegas shows including CES. Handles drayage, rigging, electrical, and freight. Required for LVCC rigging over 200 lbs.",
    rating: 4,
    is_active: true,
  },
  {
    name: "GES (Global Experience Specialists)",
    type: "freight",
    website: "https://www.ges.com",
    contact_name: "Las Vegas HQ",
    contact_email: "info@ges.com",
    contact_phone: "702-515-5500",
    address: "7000 S Lindell Rd",
    city: "Las Vegas",
    state: "NV",
    country: "US",
    notes: "Global trade show management company headquartered in Las Vegas since 1992. Full-service: exhibit design, drayage, rigging, electrical, labor.",
    rating: 4,
    is_active: true,
  },
  {
    name: "Shepard Exposition Services",
    type: "freight",
    website: "https://www.shepardes.com",
    contact_name: "Las Vegas Office",
    contact_email: "info@shepardes.com",
    contact_phone: "702-507-5278",
    address: "6165 S Valley View Blvd",
    city: "Las Vegas",
    state: "NV",
    country: "US",
    notes: "Third major general contractor. Handles drayage, rigging, electrical, and exhibit services at major Las Vegas venues.",
    rating: 4,
    is_active: true,
  },

  // ─── Freight & Shipping ───────────────────────────────────────────────────
  {
    name: "Phoenix Logistics",
    type: "freight",
    website: "https://phoenixlogistics.com",
    contact_name: "Las Vegas Office",
    contact_email: "lasvegas@phoenixlogistics.com",
    contact_phone: "702-800-0000",
    address: "Las Vegas, NV",
    city: "Las Vegas",
    state: "NV",
    country: "US",
    notes: "Trade show freight specialists with Las Vegas office. 24/7 availability, staffs major shows. Good for oversized robot shipments.",
    rating: 4,
    is_active: true,
  },
  {
    name: "Viper Trade Show Logistics",
    type: "freight",
    website: "https://www.vipertradeshow.com",
    contact_name: "Sales",
    contact_email: "info@vipertradeshow.com",
    contact_phone: "847-426-3100",
    city: "Las Vegas",
    state: "NV",
    country: "US",
    notes: "Specialized trade show logistics and shipping for Las Vegas events.",
    rating: 3,
    is_active: true,
  },
  {
    name: "VIP Transport",
    type: "freight",
    website: "https://viptransport.com",
    contact_name: "Trade Show Division",
    contact_email: "tradeshows@viptransport.com",
    contact_phone: "800-000-0000",
    city: "Las Vegas",
    state: "NV",
    country: "US",
    notes: "Custom crating, GPS tracking, advance warehouse coordination. Good for high-value robot equipment.",
    rating: 4,
    is_active: true,
  },
  {
    name: "Navis Pack & Ship Las Vegas",
    type: "freight",
    website: "https://www.gonavis.com",
    contact_name: "Las Vegas Store",
    contact_email: "lasvegas@gonavis.com",
    contact_phone: "702-000-0000",
    city: "Las Vegas",
    state: "NV",
    country: "US",
    notes: "Specializes in trade show shipping, packing, crating for exhibitors. Good for smaller robot components.",
    rating: 3,
    is_active: true,
  },
  {
    name: "TCB 3PL Las Vegas",
    type: "warehouse",
    website: "https://tcb3pl.com",
    contact_name: "Operations",
    contact_email: "info@tcb3pl.com",
    contact_phone: "702-000-0000",
    city: "Las Vegas",
    state: "NV",
    country: "US",
    notes: "Third-party logistics with Las Vegas trade show focus. Shipping, delivery, and event support.",
    rating: 3,
    is_active: true,
  },
  {
    name: "Brick Dynamics Nevada",
    type: "warehouse",
    website: "https://brickdynamics.com",
    contact_name: "Nevada Operations",
    contact_email: "nevada@brickdynamics.com",
    contact_phone: "702-000-0000",
    city: "Las Vegas",
    state: "NV",
    country: "US",
    notes: "Secure storage between shows, kitting & prep, nationwide booth shipping. Good for recurring robot show clients.",
    rating: 3,
    is_active: true,
  },
  {
    name: "Skyline Moving Service",
    type: "transport",
    website: "https://skylinemovingservice.com",
    contact_name: "Trade Show Division",
    contact_email: "tradeshows@skylinemovingservice.com",
    contact_phone: "702-000-0000",
    city: "Las Vegas",
    state: "NV",
    country: "US",
    notes: "Convention delivery, storage, and yard coordination. Handles booth delivery start to finish.",
    rating: 3,
    is_active: true,
  },

  // ─── Warehouse ────────────────────────────────────────────────────────────
  {
    name: "GES Warehouse Las Vegas",
    type: "warehouse",
    website: "https://ordering.ges.com",
    contact_name: "Sandra Gonzalez",
    contact_email: "warehouse.lv@ges.com",
    contact_phone: "702-515-5751",
    address: "7000 S Lindell Rd",
    city: "Las Vegas",
    state: "NV",
    country: "US",
    notes: "GES warehouse storage facility in Las Vegas. Advance warehouse for show deliveries. Contact Sandra Gonzalez directly.",
    rating: 4,
    is_active: true,
  },

  // ─── Rigging ─────────────────────────────────────────────────────────────
  {
    name: "Freeman Rigging (LVCC)",
    type: "rigging",
    website: "https://www.freeman.com",
    contact_name: "Rigging Department",
    contact_email: "rigging@freeman.com",
    contact_phone: "888-508-5054",
    address: "3150 Paradise Rd (LVCC)",
    city: "Las Vegas",
    state: "NV",
    country: "US",
    notes: "Required for all rigging over 200 lbs at LVCC. Permanent rig points rated at 2,000 lbs per point. Must submit plans in advance.",
    rating: 4,
    is_active: true,
  },
  {
    name: "Rigging Technologies",
    type: "rigging",
    website: "https://riggingtechnologies.com",
    contact_name: "Operations",
    contact_email: "info@riggingtechnologies.com",
    contact_phone: "702-000-0000",
    city: "Las Vegas",
    state: "NV",
    country: "US",
    notes: "Technical directing, production rigging, and rigging labor. Good for complex robot display installations.",
    rating: 3,
    is_active: true,
  },

  // ─── AV / Production ─────────────────────────────────────────────────────
  {
    name: "Exhibit Experience Las Vegas",
    type: "av",
    website: "https://exhibitexperience.com",
    contact_name: "Las Vegas Team",
    contact_email: "lasvegas@exhibitexperience.com",
    contact_phone: "702-000-0000",
    city: "Las Vegas",
    state: "NV",
    country: "US",
    notes: "Exhibit logistics, freight, drayage, and on-site services. Coordinates full exhibit experience including AV.",
    rating: 3,
    is_active: true,
  },
  {
    name: "Pyramid Logistics",
    type: "transport",
    website: "https://pyramid-logistics.com",
    contact_name: "Trade Show Division",
    contact_email: "tradeshows@pyramid-logistics.com",
    contact_phone: "800-000-0000",
    city: "Las Vegas",
    state: "NV",
    country: "US",
    notes: "Full-service trade show transportation. Simple and cost-effective for displays, exhibits, and supplies.",
    rating: 3,
    is_active: true,
  },

  // ─── Customs / International ──────────────────────────────────────────────
  {
    name: "Circle Exhibit Union Labor LV",
    type: "other",
    website: "https://www.circleexhibit.com",
    contact_name: "Las Vegas Operations",
    contact_email: "lasvegas@circleexhibit.com",
    contact_phone: "702-000-0000",
    city: "Las Vegas",
    state: "NV",
    country: "US",
    notes: "Union labor coordination and trade show installation. LVCC move-in logistics, drayage sequencing. Critical for union labor compliance.",
    rating: 3,
    is_active: true,
  },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log(`Seeding ${VENDORS.length} vendors...`);

    for (const v of VENDORS) {
      await pool.query(
        `INSERT INTO vendors (name, type, website, contact_name, contact_email, contact_phone, address, city, state, country, notes, rating, is_active, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
         ON CONFLICT DO NOTHING`,
        [v.name, v.type, v.website ?? null, v.contact_name ?? null, v.contact_email ?? null,
         v.contact_phone ?? null, v.address ?? null, v.city, v.state, v.country,
         v.notes ?? null, v.rating ?? null, v.is_active]
      );
      console.log(`  ✓ ${v.name} (${v.type})`);
    }

    console.log(`\nDone — ${VENDORS.length} vendors seeded.`);
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
