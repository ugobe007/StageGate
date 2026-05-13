#!/usr/bin/env node
// Apply only migration 0007 (prospects + outreach_campaigns tables)
// by first recording migrations 0001-0006 as applied in __drizzle_migrations,
// then running drizzle migrate which will only execute 0007.
import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { resolve } from 'path';

const conn = await createConnection({ uri: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Read the journal to get all migration entries
const journal = JSON.parse(readFileSync('/home/ubuntu/stagegate/drizzle/meta/_journal.json', 'utf8'));

// Check which migrations are already recorded
const [applied] = await conn.execute('SELECT hash FROM __drizzle_migrations');
const appliedHashes = new Set(applied.map(r => r.hash));
console.log('Already applied hashes:', appliedHashes.size);

// For each migration 0001-0006, compute its hash and insert if not present
// Drizzle uses SHA-256 of the SQL content as the hash
for (const entry of journal.entries) {
  if (entry.idx === 0) continue; // already applied
  if (entry.idx === 7) continue; // this is the one we want to actually run

  const sqlFile = `/home/ubuntu/stagegate/drizzle/${entry.tag}.sql`;
  let sql;
  try {
    sql = readFileSync(sqlFile, 'utf8');
  } catch {
    console.log(`  Skipping ${entry.tag} — file not found`);
    continue;
  }

  const hash = createHash('sha256').update(sql).digest('hex');
  if (appliedHashes.has(hash)) {
    console.log(`  ${entry.tag} — already recorded`);
    continue;
  }

  await conn.execute(
    'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
    [hash, entry.when]
  );
  console.log(`  Recorded ${entry.tag} (hash: ${hash.slice(0, 16)}...)`);
}

// Now apply migration 0007 directly
const sql0007 = readFileSync('/home/ubuntu/stagegate/drizzle/0007_motionless_gravity.sql', 'utf8');
const hash0007 = createHash('sha256').update(sql0007).digest('hex');

if (appliedHashes.has(hash0007)) {
  console.log('Migration 0007 already applied.');
} else {
  console.log('Applying migration 0007...');
  // Split on --> statement-breakpoint
  const statements = sql0007.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    try {
      await conn.execute(stmt);
      console.log(`  ✓ ${stmt.slice(0, 60).replace(/\n/g, ' ')}...`);
    } catch (err) {
      if (err.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log(`  ⚠ Table already exists, skipping: ${err.sqlMessage}`);
      } else {
        throw err;
      }
    }
  }
  await conn.execute(
    'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
    [hash0007, Date.now()]
  );
  console.log('✓ Migration 0007 applied and recorded.');
}

await conn.end();
console.log('Done.');
