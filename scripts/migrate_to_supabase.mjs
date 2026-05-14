/**
 * MySQL (TiDB Cloud) → Supabase Postgres migration script.
 * Run with: node scripts/migrate_to_supabase.mjs
 * Safe to re-run: uses ON CONFLICT DO NOTHING for idempotency.
 */
import mysql from "mysql2/promise";
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const MYSQL_URL = process.env.DATABASE_URL;
const PG_URL = process.env.SUPABASE_DATABASE_URL;

if (!MYSQL_URL || !PG_URL) {
  console.error("Missing DATABASE_URL or SUPABASE_DATABASE_URL");
  process.exit(1);
}

const jdump = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") {
    try { JSON.parse(val); return val; } catch { return JSON.stringify(val); }
  }
  return JSON.stringify(val);
};

const ts = (val) => (val instanceof Date ? val : val ? new Date(val) : null);
const now = () => new Date();

console.log("Connecting to MySQL (TiDB Cloud)...");
const my = await mysql.createConnection({ uri: MYSQL_URL, ssl: { rejectUnauthorized: false } });

console.log("Connecting to Supabase Postgres...");
const pool = new pg.Pool({ connectionString: PG_URL, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const migrated = {};

try {
  await client.query("BEGIN");

  // ─── users ─────────────────────────────────────────────────────────────────
  const [users] = await my.execute("SELECT * FROM users");
  if (users.length) {
    for (const r of users) {
      await client.query(`
        INSERT INTO users (id, "openId", name, email, "loginMethod", role, "createdAt", "updatedAt", "lastSignedIn")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT ("openId") DO UPDATE SET
          name=EXCLUDED.name, email=EXCLUDED.email, role=EXCLUDED.role,
          "lastSignedIn"=EXCLUDED."lastSignedIn", "updatedAt"=EXCLUDED."updatedAt"
      `, [r.id, r.openId, r.name, r.email, r.loginMethod, r.role||'user',
          ts(r.createdAt)||now(), ts(r.updatedAt)||now(), ts(r.lastSignedIn)||now()]);
    }
    await client.query(`SELECT setval(pg_get_serial_sequence('users','id'), MAX(id)) FROM users`);
    migrated.users = users.length;
    console.log(`  ✓ users: ${users.length}`);
  }

  // ─── trade_shows ───────────────────────────────────────────────────────────
  const [shows] = await my.execute("SELECT * FROM trade_shows");
  if (shows.length) {
    for (const r of shows) {
      await client.query(`
        INSERT INTO trade_shows (id, name, location, venue, city, "startDate", "endDate", website,
          "exhibitorListUrl", status, description, "roboticsRelevance", "estimatedExhibitors",
          "roboticsExhibitors", "createdAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (id) DO NOTHING
      `, [r.id, r.name, r.location, r.venue, r.city, ts(r.startDate), ts(r.endDate),
          r.website, r.exhibitorListUrl, r.status||'upcoming', r.description,
          r.roboticsRelevance||3, r.estimatedExhibitors, r.roboticsExhibitors,
          ts(r.createdAt)||now()]);
    }
    await client.query(`SELECT setval(pg_get_serial_sequence('trade_shows','id'), MAX(id)) FROM trade_shows`);
    migrated.trade_shows = shows.length;
    console.log(`  ✓ trade_shows: ${shows.length}`);
  }

  // ─── services ──────────────────────────────────────────────────────────────
  const [services] = await my.execute("SELECT * FROM services");
  if (services.length) {
    for (const r of services) {
      await client.query(`
        INSERT INTO services (id, slug, name, brand, category, description, "basePrice", "priceUnit",
          "pricingTiers", phase, "isActive", "sortOrder")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (id) DO NOTHING
      `, [r.id, r.slug, r.name, r.brand||'stagegate', r.category||'', r.description,
          r.basePrice, r.priceUnit, r.pricingTiers, r.phase||'phase1',
          Boolean(r.isActive), r.sortOrder||0]);
    }
    await client.query(`SELECT setval(pg_get_serial_sequence('services','id'), MAX(id)) FROM services`);
    migrated.services = services.length;
    console.log(`  ✓ services: ${services.length}`);
  }

  // ─── logistics_partners ────────────────────────────────────────────────────
  const [partners] = await my.execute("SELECT * FROM logistics_partners");
  if (partners.length) {
    for (const r of partners) {
      await client.query(`
        INSERT INTO logistics_partners (id, name, "serviceType", "contactName", "contactEmail",
          "contactPhone", website, city, notes, "isActive", "createdAt", "updatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (id) DO NOTHING
      `, [r.id, r.name, r.serviceType||'', r.contactName, r.contactEmail,
          r.contactPhone, r.website, r.city, r.notes, Boolean(r.isActive),
          ts(r.createdAt)||now(), ts(r.updatedAt)||now()]);
    }
    await client.query(`SELECT setval(pg_get_serial_sequence('logistics_partners','id'), MAX(id)) FROM logistics_partners`);
    migrated.logistics_partners = partners.length;
    console.log(`  ✓ logistics_partners: ${partners.length}`);
  }

  // ─── prospects ─────────────────────────────────────────────────────────────
  const [prospects] = await my.execute("SELECT * FROM prospects");
  if (prospects.length) {
    for (const r of prospects) {
      await client.query(`
        INSERT INTO prospects (id, company, "robotName", "robotType", "hqCountry", "attendsLasVegas",
          "contactName", "contactEmail", "contactTitle", "contactDept", website, shows, notes,
          status, "videoMessageUrl", "scheduledCallAt", "contactLinkedIn", "emailConfidence",
          "repliedAt", "followUpDate", "createdAt", "updatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
        ON CONFLICT (id) DO NOTHING
      `, [r.id, r.company, r.robotName, r.robotType, r.hqCountry,
          r.attendsLasVegas||'unknown', r.contactName, r.contactEmail,
          r.contactTitle, r.contactDept, r.website, jdump(r.shows)||'[]',
          r.notes, r.status||'new', r.videoMessageUrl, ts(r.scheduledCallAt),
          r.contactLinkedIn, r.emailConfidence||'low', ts(r.repliedAt),
          ts(r.followUpDate), ts(r.createdAt)||now(), ts(r.updatedAt)||now()]);
    }
    await client.query(`SELECT setval(pg_get_serial_sequence('prospects','id'), MAX(id)) FROM prospects`);
    migrated.prospects = prospects.length;
    console.log(`  ✓ prospects: ${prospects.length}`);
  }

  // ─── xbot_projects ─────────────────────────────────────────────────────────
  const [xbots] = await my.execute("SELECT * FROM xbot_projects");
  if (xbots.length) {
    for (const r of xbots) {
      await client.query(`
        INSERT INTO xbot_projects (id, "sessionToken", "userId", "robotMake", "robotModel",
          "robotDimensions", "robotWeight", "powerRequirements", "specialHandling",
          "originCountry", "originCity", "shippingMethod", "flightVesselNumber", eta,
          "portOfEntry", "hsCode", "ataCarnet", "customsBroker", "customsBrokerName",
          "showId", "boothNumber", "setupDate", "teardownDate", "selectedServices",
          "groundTransportProvider", contacts, "currentStep", status, "createdAt", "updatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24::jsonb,$25,$26::jsonb,$27,$28,$29,$30)
        ON CONFLICT (id) DO NOTHING
      `, [r.id, r.sessionToken, r.userId, r.robotMake, r.robotModel,
          r.robotDimensions, r.robotWeight, r.powerRequirements, r.specialHandling,
          r.originCountry, r.originCity, r.shippingMethod, r.flightVesselNumber,
          ts(r.eta), r.portOfEntry, r.hsCode, Boolean(r.ataCarnet),
          r.customsBroker||'tbd', r.customsBrokerName, r.showId, r.boothNumber,
          ts(r.setupDate), ts(r.teardownDate), jdump(r.selectedServices),
          r.groundTransportProvider, jdump(r.contacts),
          r.currentStep||1, r.status||'draft',
          ts(r.createdAt)||now(), ts(r.updatedAt)||now()]);
    }
    await client.query(`SELECT setval(pg_get_serial_sequence('xbot_projects','id'), MAX(id)) FROM xbot_projects`);
    migrated.xbot_projects = xbots.length;
    console.log(`  ✓ xbot_projects: ${xbots.length}`);
  }

  await client.query("COMMIT");
  console.log("\n✅ Migration committed!");
  console.log("Migrated:", migrated);

  // Verify
  console.log("\nSupabase verification:");
  for (const t of ['users','trade_shows','services','logistics_partners','prospects','xbot_projects']) {
    const res = await client.query(`SELECT COUNT(*) FROM "${t}"`);
    console.log(`  ${t}: ${res.rows[0].count}`);
  }

} catch (err) {
  await client.query("ROLLBACK");
  console.error("Migration failed, rolled back:", err.message);
  console.error(err.stack);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
  await my.end();
}
