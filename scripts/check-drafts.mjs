import pg from "pg";
const { Client } = pg;
const client = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const r = await client.query("SELECT COUNT(*) FROM draft_emails");
const r2 = await client.query("SELECT COUNT(*) FROM draft_emails WHERE status = 'pending'");
console.log("Total drafts:", r.rows[0].count, "| Pending:", r2.rows[0].count);
const r3 = await client.query(`
  SELECT p.company, d.subject, d.status 
  FROM draft_emails d 
  JOIN prospects p ON p.id = d."prospectId" 
  ORDER BY d."createdAt" DESC LIMIT 10
`);
r3.rows.forEach(row => console.log(" -", row.company, "|", (row.subject ?? "").slice(0,60), "|", row.status));
await client.end();
