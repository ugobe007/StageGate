/**
 * v40 migration: add missing columns to Postgres prospects table
 * Run: node scripts/migrate-prospects-v40.mjs
 */
import pg from "pg";

const connString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
if (!connString || !connString.startsWith("postgres")) {
  console.error("SUPABASE_DATABASE_URL must be a Postgres connection string");
  process.exit(1);
}

const client = new pg.Client({ connectionString: connString });
await client.connect();
console.log("Connected to Postgres");

const migrations = [
  `ALTER TABLE prospects ADD COLUMN IF NOT EXISTS "contactLinkedIn" VARCHAR(512)`,
  `ALTER TABLE prospects ADD COLUMN IF NOT EXISTS "emailConfidence" VARCHAR(20) DEFAULT 'low'`,
  `ALTER TABLE prospects ADD COLUMN IF NOT EXISTS "robotCategory" VARCHAR(30) DEFAULT 'light'`,
  `ALTER TABLE prospects ADD COLUMN IF NOT EXISTS "repliedAt" TIMESTAMPTZ`,
  `ALTER TABLE prospects ADD COLUMN IF NOT EXISTS "followUpDate" TIMESTAMPTZ`,
];

for (const sql of migrations) {
  try {
    await client.query(sql);
    const col = sql.match(/"(\w+)"/)?.[1] ?? "?";
    console.log(`✓ ${col}`);
  } catch (err) {
    console.error(`✗ Failed: ${sql}\n  ${err.message}`);
  }
}

await client.end();
console.log("Migration complete");
