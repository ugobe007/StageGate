-- Address-level outreach suppression list (bounces/complaints from Resend).
-- Blocks future sends to known-bad addresses and feeds the bounce-rate breaker.
-- Idempotent so it is safe whether applied via drizzle-kit or the runtime
-- self-heal in server/outreachGate.ts (ensureSuppressionTable).
CREATE TABLE IF NOT EXISTS outreach_suppressions (
  id serial PRIMARY KEY,
  email text NOT NULL,
  reason text NOT NULL DEFAULT 'bounce',
  source text,
  prospect_id integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS outreach_suppressions_email_key
  ON outreach_suppressions (lower(email));
