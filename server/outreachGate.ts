/**
 * Outreach send gate — the deliverability safety layer for Cal.
 *
 * Ports the ReadyForRobots protections into StageGate. Every cold-outreach send
 * must clear `screenRecipient` first; the nightly cron additionally consults
 * `shouldPauseNewIntros` (a trailing-bounce-rate circuit breaker) before sending
 * new intros. Bounces/complaints from Resend webhooks land in a suppression
 * store via `recordSuppression`, which both blocks future sends to that address
 * and feeds the breaker.
 *
 * Everything here fails OPEN on infrastructure errors (missing DB, DNS hiccups,
 * ZeroBounce outage) so a transient problem never silently drops legitimate
 * sends — but fails CLOSED on a definitive negative signal (dead domain, known
 * bounce), which is where reputation damage actually comes from.
 */

import { promises as dns } from "node:dns";
import { sql } from "drizzle-orm";
import type { getDb } from "./db.js";
import { extractEmailAddress, isGuessedRoleInbox, isPlausibleEmail } from "./outreachContacts.js";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

// ─── Config ──────────────────────────────────────────────────────────────────

const BOUNCE_THRESHOLD = clampNumber(process.env.OUTREACH_BOUNCE_THRESHOLD, 0.1, 0, 1);
const BOUNCE_WINDOW_DAYS = clampNumber(process.env.OUTREACH_BOUNCE_WINDOW_DAYS, 7, 1, 90);
const BOUNCE_MIN_SAMPLE = clampNumber(process.env.OUTREACH_BOUNCE_MIN_SAMPLE, 20, 1, 10_000);
const DNS_TIMEOUT_MS = 4000;

function clampNumber(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/** Hard kill switch — set OUTREACH_DISABLED=1 to stop all automated sends. */
export function outreachDisabled(): boolean {
  return ["1", "true", "yes"].includes((process.env.OUTREACH_DISABLED ?? "").trim().toLowerCase());
}

// ─── Suppression store (self-healing; no migration dependency) ───────────────

let _tableReady: Promise<void> | null = null;

/**
 * Create the suppression table if it does not exist. Cached so it runs at most
 * once per process. Kept idempotent so it is safe regardless of whether the
 * Drizzle migration has been applied yet on a given environment.
 */
async function ensureSuppressionTable(db: Db): Promise<void> {
  if (!_tableReady) {
    _tableReady = db
      .execute(sql`
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
      `)
      .then(() => undefined)
      .catch((err) => {
        // Reset so a later call can retry; treat as fail-open for this request.
        _tableReady = null;
        console.warn("[outreachGate] could not ensure suppression table:", String(err));
      });
  }
  return _tableReady ?? Promise.resolve();
}

/** Ensure the suppression table exists (safe to call before raw SQL joins). */
export async function ensureSuppressionStore(db: Db): Promise<void> {
  await ensureSuppressionTable(db);
}

/** True if we have ever recorded a bounce/complaint/suppression for this address. */
export async function isSuppressed(db: Db, email: string): Promise<boolean> {
  const normalized = extractEmailAddress(email) ?? email.trim().toLowerCase();
  if (!normalized) return false;
  try {
    await ensureSuppressionTable(db);
    const rows = await db.execute(sql`
      SELECT 1 FROM outreach_suppressions WHERE lower(email) = ${normalized} LIMIT 1
    `);
    return (rows.rows?.length ?? 0) > 0;
  } catch (err) {
    console.warn("[outreachGate] isSuppressed check failed (fail-open):", String(err));
    return false;
  }
}

/** Record a durable suppression. Idempotent per address. */
export async function recordSuppression(
  db: Db,
  email: string,
  reason: string,
  opts: { source?: string; prospectId?: number | null } = {},
): Promise<void> {
  const normalized = extractEmailAddress(email) ?? email.trim().toLowerCase();
  if (!normalized) return;
  try {
    await ensureSuppressionTable(db);
    await db.execute(sql`
      INSERT INTO outreach_suppressions (email, reason, source, prospect_id)
      VALUES (${normalized}, ${reason}, ${opts.source ?? null}, ${opts.prospectId ?? null})
      ON CONFLICT (lower(email)) DO NOTHING
    `);
  } catch (err) {
    console.warn("[outreachGate] recordSuppression failed:", String(err));
  }
}

/** Fix legacy rows stored as `Name <email@domain.com>` so joins and isSuppressed work. */
export async function normalizeSuppressionEmails(db: Db): Promise<number> {
  try {
    await ensureSuppressionTable(db);
    const rows = await db.execute(sql`
      SELECT id, email FROM outreach_suppressions WHERE email LIKE '%<%'
    `);
    let fixed = 0;
    for (const row of rows.rows ?? []) {
      const id = Number((row as { id?: number }).id);
      const raw = String((row as { email?: string }).email ?? "");
      const normalized = extractEmailAddress(raw);
      if (!id || !normalized || normalized === raw.trim().toLowerCase()) continue;
      await db.execute(sql`
        UPDATE outreach_suppressions SET email = ${normalized} WHERE id = ${id}
      `);
      fixed++;
    }
    return fixed;
  } catch (err) {
    console.warn("[outreachGate] normalizeSuppressionEmails failed:", String(err));
    return 0;
  }
}

// ─── DNS / mailbox verification ──────────────────────────────────────────────

type DnsClass = "ok" | "nxdomain" | "temporary";

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("dns_timeout")), ms)),
  ]);
}

/** Classify a domain's mail-hosting DNS: ok (has MX/A), nxdomain (dead), temporary. */
async function classifyDomain(domain: string): Promise<DnsClass> {
  try {
    const mx = await withTimeout(dns.resolveMx(domain), DNS_TIMEOUT_MS);
    if (mx.length > 0) return "ok";
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOTFOUND" || code === "ENODATA") {
      // No MX — fall through to an A/AAAA check; many small domains accept mail
      // on their apex without an explicit MX record.
    } else {
      return "temporary";
    }
  }
  try {
    await withTimeout(dns.resolve(domain), DNS_TIMEOUT_MS);
    return "ok";
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOTFOUND" || code === "ENODATA") return "nxdomain";
    return "temporary";
  }
}

// ─── ZeroBounce (optional, matches RFR) ──────────────────────────────────────

/** Optional mailbox verification. Fail-open when unset or on error. */
async function zeroBounceValid(email: string): Promise<boolean | null> {
  const key = process.env.ZEROBOUNCE_API_KEY?.trim();
  if (!key) return null;
  try {
    const url = new URL("https://api.zerobounce.net/v2/validate");
    url.searchParams.set("api_key", key);
    url.searchParams.set("email", email);
    const res = await withTimeout(fetch(url), 8000);
    if (!res.ok) return null;
    const data = (await res.json()) as { status?: string };
    const status = (data.status ?? "").toLowerCase();
    if (["invalid", "spamtrap", "abuse", "do_not_mail"].includes(status)) return false;
    // Catch-all domains accept at SMTP but often silently drop — reject by default
    // during deliverability recovery (matches ReadyForRobots).
    if (status === "catch-all") {
      const accept = ["1", "true", "yes"].includes(
        (process.env.ZERO_BOUNCE_ACCEPT_CATCH_ALL ?? "0").trim().toLowerCase(),
      );
      return accept ? true : false;
    }
    return true;
  } catch (err) {
    console.warn("[outreachGate] ZeroBounce check failed (fail-open):", String(err));
    return null;
  }
}

// ─── The gate ────────────────────────────────────────────────────────────────

export interface ScreenResult {
  ok: boolean;
  reason?: string;
}

/**
 * Screen a recipient immediately before send. Rejects: malformed addresses,
 * guessed role inboxes, suppressed (previously bounced/complained) addresses,
 * dead domains (NXDOMAIN / no mail DNS), and ZeroBounce-invalid mailboxes when
 * a key is configured. Fails open on transient DNS / API errors.
 */
export async function screenRecipient(db: Db | null, email: string): Promise<ScreenResult> {
  const addr = email.trim();
  if (!isPlausibleEmail(addr)) return { ok: false, reason: "invalid_format" };
  if (isGuessedRoleInbox(addr)) return { ok: false, reason: "guessed_role_inbox" };

  if (db && (await isSuppressed(db, addr))) {
    return { ok: false, reason: "suppressed" };
  }

  const domain = addr.split("@")[1]?.toLowerCase();
  if (!domain) return { ok: false, reason: "invalid_format" };

  const dnsClass = await classifyDomain(domain);
  if (dnsClass === "nxdomain") return { ok: false, reason: "dead_domain" };

  const zb = await zeroBounceValid(addr);
  if (zb === false) return { ok: false, reason: "zerobounce_invalid" };

  return { ok: true };
}

// ─── Circuit breaker ─────────────────────────────────────────────────────────

export interface BounceStats {
  windowDays: number;
  sent: number;
  bounced: number;
  rate: number;
  threshold: number;
  paused: boolean;
}

/**
 * Trailing bounce rate over the window. Denominator = outbound sends recorded in
 * email_threads; numerator = suppressions captured from Resend bounce/complaint
 * webhooks. Returns paused=true once the rate crosses the threshold with a
 * meaningful sample, which the cron uses to hold NEW intros (follow-ups to
 * already-engaged threads still run).
 */
export async function computeBounceStats(db: Db): Promise<BounceStats> {
  const base: BounceStats = {
    windowDays: BOUNCE_WINDOW_DAYS,
    sent: 0,
    bounced: 0,
    rate: 0,
    threshold: BOUNCE_THRESHOLD,
    paused: false,
  };
  try {
    const since = new Date(Date.now() - BOUNCE_WINDOW_DAYS * 86400000);
    const sentRows = await db.execute(sql`
      SELECT count(*)::int AS n FROM email_threads
      WHERE direction = 'outbound' AND "createdAt" >= ${since}
    `);
    const sent = Number((sentRows.rows?.[0] as { n?: number } | undefined)?.n ?? 0);

    let bounced = 0;
    try {
      await ensureSuppressionTable(db);
      const bouncedRows = await db.execute(sql`
        SELECT count(*)::int AS n FROM outreach_suppressions
        WHERE created_at >= ${since} AND reason IN ('bounce', 'complaint')
      `);
      bounced = Number((bouncedRows.rows?.[0] as { n?: number } | undefined)?.n ?? 0);
    } catch {
      bounced = 0;
    }

    const rate = sent > 0 ? bounced / sent : 0;
    const paused = sent >= BOUNCE_MIN_SAMPLE && rate >= BOUNCE_THRESHOLD;
    return { ...base, sent, bounced, rate, paused };
  } catch (err) {
    console.warn("[outreachGate] computeBounceStats failed (fail-open):", String(err));
    return base;
  }
}

/** True when NEW intros should be held this cycle to protect sender reputation. */
export async function shouldPauseNewIntros(db: Db): Promise<{ paused: boolean; stats: BounceStats }> {
  const stats = await computeBounceStats(db);
  return { paused: stats.paused, stats };
}
