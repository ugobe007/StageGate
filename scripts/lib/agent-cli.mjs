/**
 * Shared helpers for agent-facing CLI scripts.
 * Keep every batch job bounded: --limit, fetch timeouts, wall-clock exit.
 */

/**
 * @param {string[]} argv
 * @param {{ defaultLimit?: number, maxLimit?: number, defaultWallMs?: number }} [opts]
 */
export function parseAgentArgs(argv = process.argv.slice(2), opts = {}) {
  const defaultLimit = opts.defaultLimit ?? 25;
  const maxLimit = opts.maxLimit ?? 100;
  const defaultWallMs = opts.defaultWallMs ?? 10 * 60 * 1000;

  let limit = defaultLimit;
  let wallMs = Number(process.env.AGENT_WALL_MS) || defaultWallMs;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit" || a === "-n") {
      limit = Number(argv[++i]);
    } else if (a.startsWith("--limit=")) {
      limit = Number(a.slice("--limit=".length));
    } else if (a === "--timeout-ms") {
      wallMs = Number(argv[++i]);
    } else if (a.startsWith("--timeout-ms=")) {
      wallMs = Number(a.slice("--timeout-ms=".length));
    } else if (/^\d+$/.test(a) && limit === defaultLimit) {
      limit = Number(a);
    }
  }

  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
  limit = Math.min(Math.max(Math.floor(limit), 1), maxLimit);
  if (!Number.isFinite(wallMs) || wallMs < 5_000) wallMs = defaultWallMs;

  return { limit, wallMs };
}

/** @param {number} ms */
export function fetchTimeout(ms = 30_000) {
  return AbortSignal.timeout(ms);
}

/**
 * Kill the process if wall clock expires. Call once at start of main.
 * @param {number} wallMs
 * @param {string} [label]
 */
export function armWallClock(wallMs, label = "script") {
  const timer = setTimeout(() => {
    console.error(`[agent-cli] ${label} hit wall-clock limit (${wallMs}ms) — exiting`);
    process.exit(124);
  }, wallMs);
  timer.unref?.();
  return () => clearTimeout(timer);
}

/**
 * @param {string} url
 * @param {RequestInit & { timeoutMs?: number }} [init]
 */
export async function fetchWithTimeout(url, init = {}) {
  const { timeoutMs = 30_000, signal, ...rest } = init;
  const timeout = fetchTimeout(timeoutMs);
  const combined =
    signal && typeof AbortSignal.any === "function"
      ? AbortSignal.any([signal, timeout])
      : timeout;
  return fetch(url, { ...rest, signal: combined });
}
