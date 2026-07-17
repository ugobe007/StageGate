import "dotenv/config";
import express, { type Express, type Request, type Response } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { followupDigestHandler, nightlyResearchHandler } from "../scheduledHandlers";
import { resendWebhookHandler } from "../webhooks/resend";
import { resendInboundHandler } from "../webhooks/resend-inbound";
import { mountWebhookRoute } from "../webhooks/webhookRawBody";
import { stripeWebhookHandler, createCheckoutSession, stripeConfigured } from "./stripe";
import {
  salesAgentIngestHandler,
  salesAgentOutreachHandler,
  salesAgentManualSendHandler,
  salesAgentPreviewHandler,
  calWeeklyDraftsHandler,
} from "../agents/salesAgent";
import { salesAgentDiscoveryHandler } from "../agents/salesAgentDiscovery";
import { enrichContactsHandler } from "../agents/prospectEnrichment";
import { calOperatorHandler } from "../agents/calOperator";
import { relayLoopHandler } from "../agents/relayOperator";
import { vendorScraperHandler } from "../agents/vendorScraper";
import { rssIntelligenceHandler } from "../agents/rssIntelligence";
import { runCheckpointPoller } from "../agents/checkpointPoller";
import { quoteFollowupHandler } from "../scheduled/quoteFollowup";
import { runCalendarReminderPoller } from "../agents/calendarReminderPoller";
import { createOrbitalRouter } from "../integrations/orbital";

export async function createStageGateApp(): Promise<Express> {
  const app = express();

  // Webhooks require raw body for HMAC verification — mount before express.json()
  mountWebhookRoute(app, "/api/webhooks/resend", resendWebhookHandler);
  mountWebhookRoute(app, "/api/webhooks/resend-inbound", resendInboundHandler);
  mountWebhookRoute(app, "/api/webhooks/stripe", stripeWebhookHandler);

  const rawJsonBody = express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    },
  });
  app.use(rawJsonBody);
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // Orbital AI fleet monitor/control — proxied same-origin so the SPA never sees the
  // cloud URL/key. Returns 503 configured:false when ORBITAL_API_URL is unset.
  app.use("/api/orbital", createOrbitalRouter());

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  app.post("/api/scheduled/followup-digest", followupDigestHandler);
  app.post("/api/scheduled/nightly-research", nightlyResearchHandler);
  app.post("/api/scheduled/sales-agent-discover", salesAgentDiscoveryHandler);
  app.post("/api/scheduled/sales-agent-ingest", salesAgentIngestHandler);
  app.post("/api/scheduled/sales-agent-outreach", salesAgentOutreachHandler);
  app.post("/api/scheduled/sales-agent-manual", salesAgentManualSendHandler);
  app.post("/api/scheduled/sales-agent-preview", salesAgentPreviewHandler);
  app.post("/api/scheduled/enrich-contacts", enrichContactsHandler);
  app.post("/api/scheduled/cal-operator", calOperatorHandler);
  app.post("/api/scheduled/relay-loop", relayLoopHandler);
  app.post("/api/scheduled/cal-weekly-drafts", calWeeklyDraftsHandler);
  app.post("/api/scheduled/vendor-scraper", vendorScraperHandler);
  app.post("/api/scheduled/rss-intelligence", rssIntelligenceHandler);
  app.post("/api/scheduled/quote-followup", quoteFollowupHandler);

  app.post("/api/scheduled/calendar-reminder", async (req: Request, res: Response) => {
    try {
      const { sdk } = await import("../_core/sdk");
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) return res.status(403).json({ error: "cron-only" });
      const result = await runCalendarReminderPoller();
      res.json({ ok: true, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[calendarReminder] Error:", msg);
      res.status(500).json({ ok: false, error: msg, timestamp: new Date().toISOString() });
    }
  });

  app.post("/api/scheduled/logistics-checkpoint-poll", async (req: Request, res: Response) => {
    try {
      const { sdk } = await import("../_core/sdk");
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) return res.status(403).json({ error: "cron-only" });
      const result = await runCheckpointPoller();
      res.json({ ok: true, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[checkpointPoller] Error:", msg);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  const multer = (await import("multer")).default;
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });
  app.post("/api/upload/service-request-attachment", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
      const { storagePut } = await import("../storage");
      const ext = req.file.originalname.split(".").pop() ?? "bin";
      const key = `service-requests/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url } = await storagePut(key, req.file.buffer, req.file.mimetype);
      res.json({ url, key, name: req.file.originalname });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[upload] Error:", msg);
      res.status(500).json({ error: msg });
    }
  });
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
      const { storagePut } = await import("../storage");
      const ext = req.file.originalname.split(".").pop() ?? "bin";
      const key = `video-intake/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url } = await storagePut(key, req.file.buffer, req.file.mimetype);
      res.json({ url, key, name: req.file.originalname });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[videoUpload] Error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  // Stripe checkout session — called from the client with an orderId
  app.post("/api/payments/checkout", async (req: Request, res: Response) => {
    try {
      if (!stripeConfigured()) {
        return res.status(503).json({ error: "Payments are not configured yet" });
      }
      const { orderId } = req.body as { orderId?: number };
      if (!orderId) return res.status(400).json({ error: "orderId is required" });

      const origin = `${req.headers["x-forwarded-proto"]?.toString().split(",")[0] ?? req.protocol}://${req.get("host")}`;
      const url = await createCheckoutSession(
        orderId,
        `${origin}/orders/${orderId}`,
        `${origin}/orders/${orderId}`
      );
      res.json({ url });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[payments/checkout] Error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true, service: "stagegate" });
  });

  return app;
}
