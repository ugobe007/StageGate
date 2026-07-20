# Cal deliverability recovery (ReadyForRobots-style)

**Trigger:** Circuit breaker paused new intros — trailing 7d bounce ≥ 10%.  
**Status (2026-07-19):** OPEN — ~26 suppressions / ~133 outbound threads ≈ **19.5%** (admin alert showed 23/144 = 16%). Delivered in window was healthy enough that the issue is address quality, not total volume collapse.

## What the breaker does

- **Paused:** new discovery intros are held.
- **Still runs:** follow-ups on already-engaged threads.
- **Resumes:** automatically when trailing bounce rate &lt; `OUTREACH_BOUNCE_THRESHOLD` (default `0.1`) with sample ≥ `OUTREACH_BOUNCE_MIN_SAMPLE` (default `20`).

Code: `server/outreachGate.ts` → `shouldPauseNewIntros` / `computeBounceStats`.

## Root causes (this episode)

1. **Guessed / thin personal addresses labeled `high`** — e.g. `firstname@company`, `pitch@vc`, `pr@…` cleared the confidence gate without ZeroBounce proof.
2. **ZeroBounce fail-open** — when the API blipped or returned unknown, `screenRecipient` still allowed the send.
3. **Hunter floor at 80** — accepted scores that never mapped to sendable `high` (≥90), while older/high-labeled guesses remained in the pipeline.
4. Quarantine **worked** — bounced addresses are no longer on prospect rows (0 still holding).

## Code changes (Jul 19 recovery)

| Change | Effect |
|--------|--------|
| ZeroBounce **fail-closed** when key set | Invalid *or* unavailable → block send |
| Hunter defaults **90 / 90 / 85** | Only scores that become `high` persist |
| Extra role locals (`pitch`, `pr`, `ceo`, …) | Never cold-send targets |
| Stale-draft discard includes medium/low + role inboxes | Clears review queue while paused |

## Railway / env checklist

```bash
OUTREACH_BOUNCE_THRESHOLD=0.1
OUTREACH_BOUNCE_WINDOW_DAYS=7
OUTREACH_BOUNCE_MIN_SAMPLE=20

# Keep OFF until bounce rate is healthy for 7+ days
OUTREACH_ALLOW_MEDIUM_CONFIDENCE=0

# Match code defaults during recovery (override if Railway still has 80)
HUNTER_MIN_FINDER_SCORE=90
HUNTER_MIN_DOMAIN_CONFIDENCE=90
HUNTER_MIN_RECOVERY_CONFIDENCE=85
HUNTER_API_KEY=…
ZEROBOUNCE_API_KEY=…          # required — fail-closed while key present
ZERO_BOUNCE_ACCEPT_CATCH_ALL=0
```

## Ops steps while paused

1. Confirm Resend webhook → `outreach_suppressions` (already sourcing `resend_webhook`).
2. Set Railway Hunter mins to **90/90/85** if still at 80.
3. Confirm `ZEROBOUNCE_API_KEY` on Railway Stage-Gate service.
4. Let Relay discard stale medium/role drafts; run enrich only for websites with real names.
5. Watch Ted / Relay health until rate &lt; 10% with sample ≥ 20.
6. Do **not** set `OUTREACH_ALLOW_MEDIUM_CONFIDENCE=1` until then.

## Sending domains (Resend)

Prefer the domain with the healthiest reputation for Cal intros; avoid mixing cold volume across new domains.
