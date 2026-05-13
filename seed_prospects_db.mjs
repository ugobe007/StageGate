#!/usr/bin/env node
import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync('/home/ubuntu/prospect_database.json', 'utf8'));
const conn = await createConnection({ uri: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

function mapAttends(v) {
  if (v === 'yes') return 'yes';
  if (v === 'no') return 'no';
  return 'unknown';
}

let inserted = 0;
for (const p of data) {
  if (!p.company) continue;
  const shows = JSON.stringify(p.shows || []);
  try {
    await conn.execute(
      `INSERT INTO prospects (company, robot_name, robot_type, hq_country, attends_las_vegas, contact_dept, website, shows, notes, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', NOW(), NOW())`,
      [p.company, p.robot || null, p.robot_type || null, p.hq_country || null, mapAttends(p.attends_las_vegas), p.contact_dept || null, p.website || null, shows, p.notes || null]
    );
    inserted++;
    process.stdout.write(`\r  Inserted ${inserted}/${data.length}: ${p.company.slice(0,40).padEnd(40)}`);
  } catch (err) {
    console.error(`\nFailed ${p.company}: ${err.message.slice(0,80)}`);
  }
}
await conn.end();
console.log(`\n✓ Done — ${inserted} prospects seeded.`);
