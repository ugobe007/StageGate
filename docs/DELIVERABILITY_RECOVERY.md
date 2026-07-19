# Cal deliverability recovery (ReadyForRobots-style)

**Trigger:** Circuit breaker paused new intros — trailing 7d bounce ≥ 10%.  
**Example:** 38/172 sends bounced (22.1%), 72 delivered in window.

## What the breaker does

- **Paused:** new discovery intros are held.
- **Still runs:** follow-ups on already-engaged threads.
- **Resumes:** automatically when trailing bounce rate &lt; `OUTREACH_BOUNCE_THRESHOLD` (default `0.1`) with sample ≥ `OUTREACH_BOUNCE_MIN_SAMPLE` (default `20`).

Code: `server/outreachGate.ts` → `shouldPauseNewIntros` / `computeBounceStats`.

## Root causes we fixed

1. **Apollo “find email” wrote guessed addresses** (`first@domain`, role inboxes) as `medium` confidence → cleared the send gate.
2. **CSV / discovery ingest** labeled unverified emails `medium`.
3. **`medium` was cold-sendable** by default.

## Code changes (this recovery)

| Change | Effect |
|--------|--------|
| Apollo persists **verified only** | Guesses stay as UI suggestions, never `contactEmail` |
| Import / discovery → `emailConfidence: low` | Hunter must raise before send |
| Cold-send requires `high` / `verified` | `OUTREACH_ALLOW_MEDIUM_CONFIDENCE` defaults **off** |
| Hunter mins → 90 / 90 / 80 (recovery) | Fewer marginal Hunter hits |
| Breaker open + ZeroBounce key | Fail-closed if verify unavailable |

## Railway / env checklist

```bash
# Already used by breaker (defaults shown)
OUTREACH_BOUNCE_THRESHOLD=0.1
OUTREACH_BOUNCE_WINDOW_DAYS=7
OUTREACH_BOUNCE_MIN_SAMPLE=20

# Keep OFF until bounce rate is healthy for 7+ days
OUTREACH_ALLOW_MEDIUM_CONFIDENCE=0

# Recommended during recovery
HUNTER_MIN_FINDER_SCORE=90
HUNTER_MIN_DOMAIN_CONFIDENCE=90
HUNTER_MIN_RECOVERY_CONFIDENCE=80
HUNTER_API_KEY=…          # required for enrichment
ZEROBOUNCE_API_KEY=…      # strongly recommended; fail-closed while breaker open
ZERO_BOUNCE_ACCEPT_CATCH_ALL=0

# Nuclear option
OUTREACH_DISABLED=1
```

## Ops steps while paused

1. Confirm Resend webhook → `outreach_suppressions` (bounce/complaint).
2. Run Hunter enrichment cron (`/api/scheduled/enrich-contacts`) so `medium`/`low` get real addresses or stay unsendable.
3. Run quarantine recovery (Cal / Relay operator) to clear bounced addresses off prospects.
4. Watch admin bounce stats (`computeBounceStats` via Relay health) until rate &lt; 10%.
5. Do **not** set `OUTREACH_ALLOW_MEDIUM_CONFIDENCE=1` until then.

## Sending domains (Resend)

Verified domains on the account include `readyforrobots.com`, `onstage.bot`, `pythh.ai`, `orbital-ai.io`. Prefer the domain with the healthiest reputation for Cal intros; avoid mixing cold volume across new domains.
