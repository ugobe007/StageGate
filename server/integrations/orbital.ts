/**
 * Orbital AI proxy — the StageGate-first embed of the Orbital AI Cloud.
 *
 * The Orbital AI Cloud (FastAPI) owns fleet monitoring/control; StageGate embeds its
 * Fleet Management Dashboard. Rather than call Orbital cross-origin from the browser
 * (which would leak the cloud URL/key and fight CORS), the SPA calls this same-origin
 * proxy, and the server forwards to the cloud with the server-held credentials.
 *
 * Fail-safe: if ORBITAL_API_URL is unset the proxy returns 503 with a clear
 * `configured:false` marker so the dashboard renders a "not connected" state instead
 * of throwing.
 *
 * Env:
 *   ORBITAL_API_URL   Base URL of the Orbital AI Cloud (e.g. https://orbital.onstage.bot)
 *   ORBITAL_API_KEY   Optional bearer token forwarded as Authorization (future-proof)
 */
import express, { type Request, type Response, type Router } from "express";

const REQUEST_TIMEOUT_MS = 12_000;

export function orbitalBaseUrl(): string | null {
  const raw = (process.env.ORBITAL_API_URL || "").trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

function orbitalHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const key = (process.env.ORBITAL_API_KEY || "").trim();
  if (key) headers["authorization"] = `Bearer ${key}`;
  return headers;
}

/**
 * Forward a request to the Orbital cloud, preserving method/query/body. `upstreamPath`
 * is relative to the cloud origin (e.g. "/api/dashboard/fleet").
 */
async function forward(req: Request, res: Response, upstreamPath: string): Promise<void> {
  const base = orbitalBaseUrl();
  if (!base) {
    res.status(503).json({ configured: false, error: "Orbital AI is not connected (ORBITAL_API_URL unset)" });
    return;
  }

  const qs = req.originalUrl.includes("?") ? `?${req.originalUrl.split("?")[1]}` : "";
  const url = `${base}${upstreamPath}${qs}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const upstream = await fetch(url, {
      method: req.method,
      headers: orbitalHeaders(),
      body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
      signal: controller.signal,
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.set("content-type", upstream.headers.get("content-type") ?? "application/json");
    res.send(text);
  } catch (err: unknown) {
    const aborted = err instanceof Error && err.name === "AbortError";
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[orbital] proxy error for ${upstreamPath}:`, msg);
    res.status(aborted ? 504 : 502).json({
      configured: true,
      error: aborted ? "Orbital AI cloud timed out" : "Orbital AI cloud unreachable",
      detail: msg,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function createOrbitalRouter(): Router {
  const router = express.Router();

  // Local status — lets the SPA decide whether to show the dashboard or a setup hint
  // without a round-trip to the cloud.
  router.get("/status", (_req, res) => {
    const base = orbitalBaseUrl();
    res.json({ configured: Boolean(base), baseConfigured: Boolean(base) });
  });

  router.get("/health", (req, res) => void forward(req, res, "/health"));

  // Fleet Management Dashboard (Module 7) read surface.
  router.get("/fleet", (req, res) => void forward(req, res, "/api/dashboard/fleet"));
  router.get("/robot/:id", (req, res) => void forward(req, res, `/api/dashboard/robot/${encodeURIComponent(req.params.id)}`));
  router.get("/robot/:id/sensors", (req, res) => void forward(req, res, `/api/dashboard/robot/${encodeURIComponent(req.params.id)}/sensors`));
  router.get("/map", (req, res) => void forward(req, res, "/api/dashboard/map"));
  router.get("/alerts", (req, res) => void forward(req, res, "/api/dashboard/alerts"));
  router.get("/tasks", (req, res) => void forward(req, res, "/api/dashboard/tasks"));
  router.get("/benchmark", (req, res) => void forward(req, res, "/api/dashboard/benchmark"));
  router.get("/benchmark/:vendor", (req, res) => void forward(req, res, `/api/dashboard/benchmark/${encodeURIComponent(req.params.vendor)}`));

  // Autonomy layer (orchestrator) — supervisory status + on-demand pass.
  router.get("/orchestrator", (req, res) => void forward(req, res, "/api/dashboard/orchestrator"));
  router.post("/orchestrator/run", (req, res) => void forward(req, res, "/api/dashboard/orchestrator/run"));

  // Control surface — E-stop / resume / task dispatch / alert ack.
  router.post("/robot/:id/estop", (req, res) => void forward(req, res, `/api/dashboard/robot/${encodeURIComponent(req.params.id)}/estop`));
  router.post("/robot/:id/resume", (req, res) => void forward(req, res, `/api/dashboard/robot/${encodeURIComponent(req.params.id)}/resume`));
  router.post("/robot/:id/navigate", (req, res) => void forward(req, res, `/api/dashboard/robot/${encodeURIComponent(req.params.id)}/navigate`));
  router.post("/robot/:id/navigate/clear", (req, res) => void forward(req, res, `/api/dashboard/robot/${encodeURIComponent(req.params.id)}/navigate/clear`));
  router.post("/robot/:id/speed", (req, res) => void forward(req, res, `/api/dashboard/robot/${encodeURIComponent(req.params.id)}/speed`));
  router.post("/robot/:id/drive", (req, res) => void forward(req, res, `/api/dashboard/robot/${encodeURIComponent(req.params.id)}/drive`));
  router.post("/robot/:id/drive/stop", (req, res) => void forward(req, res, `/api/dashboard/robot/${encodeURIComponent(req.params.id)}/drive/stop`));
  router.post("/tasks", (req, res) => void forward(req, res, "/api/dashboard/tasks"));
  router.post("/alerts/:id/ack", (req, res) => void forward(req, res, `/api/dashboard/alerts/${encodeURIComponent(req.params.id)}/ack`));

  // OEM governance — list partners and manage their granted API scopes (operator surface).
  router.get("/oem-catalog", (req, res) => void forward(req, res, "/api/dashboard/oem-catalog"));
  router.get("/oems", (req, res) => void forward(req, res, "/api/dashboard/oems"));
  router.post("/oems", (req, res) => void forward(req, res, "/api/dashboard/oems"));
  router.get("/oems/:id", (req, res) => void forward(req, res, `/api/dashboard/oems/${encodeURIComponent(req.params.id)}`));
  router.delete("/oems/:id", (req, res) => void forward(req, res, `/api/dashboard/oems/${encodeURIComponent(req.params.id)}`));
  router.post("/oems/:id/grant", (req, res) => void forward(req, res, `/api/dashboard/oems/${encodeURIComponent(req.params.id)}/grant`));
  router.post("/oems/:id/revoke", (req, res) => void forward(req, res, `/api/dashboard/oems/${encodeURIComponent(req.params.id)}/revoke`));
  router.post("/oems/:id/policies", (req, res) => void forward(req, res, `/api/dashboard/oems/${encodeURIComponent(req.params.id)}/policies`));
  router.post("/oems/:id/suspend", (req, res) => void forward(req, res, `/api/dashboard/oems/${encodeURIComponent(req.params.id)}/suspend`));
  router.post("/oems/:id/reactivate", (req, res) => void forward(req, res, `/api/dashboard/oems/${encodeURIComponent(req.params.id)}/reactivate`));

  return router;
}
