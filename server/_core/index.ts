import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { followupDigestHandler, nightlyResearchHandler } from "../scheduledHandlers";
import { resendWebhookHandler } from "../webhooks/resend";
import { resendInboundHandler } from "../webhooks/resend-inbound";
import {
  salesAgentIngestHandler,
  salesAgentOutreachHandler,
  salesAgentManualSendHandler,
  salesAgentPreviewHandler,
} from "../agents/salesAgent";
import { salesAgentDiscoveryHandler } from "../agents/salesAgentDiscovery";
import { vendorScraperHandler } from "../agents/vendorScraper";
import { runCheckpointPoller } from "../agents/checkpointPoller";
import { quoteFollowupHandler } from "../scheduled/quoteFollowup";
import { runCalendarReminderPoller } from "../agents/calendarReminderPoller";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Scheduled handlers — must be before Vite/static fallthrough
  app.post("/api/scheduled/followup-digest", followupDigestHandler);
  app.post("/api/scheduled/nightly-research", nightlyResearchHandler);

  // Sales Agent handlers
  app.post("/api/scheduled/sales-agent-discover", salesAgentDiscoveryHandler);
  app.post("/api/scheduled/sales-agent-ingest", salesAgentIngestHandler);
  app.post("/api/scheduled/sales-agent-outreach", salesAgentOutreachHandler);
  app.post("/api/scheduled/sales-agent-manual", salesAgentManualSendHandler);
  app.post("/api/scheduled/sales-agent-preview", salesAgentPreviewHandler);
  app.post("/api/scheduled/vendor-scraper", vendorScraperHandler);

  // Quote follow-up nudge — daily 09:00 UTC
  app.post("/api/scheduled/quote-followup", quoteFollowupHandler);

  // Calendar reminder poller — hourly, sends 24h-ahead reminder emails
  app.post("/api/scheduled/calendar-reminder", async (req, res) => {
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

  // Logistics checkpoint poller — daily
  app.post("/api/scheduled/logistics-checkpoint-poll", async (req, res) => {
    try {
      const result = await runCheckpointPoller();
      res.json({ ok: true, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[checkpointPoller] Error:", msg);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  // File upload endpoint — service request attachments (PDF, images, docs up to 16MB)
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

  // Resend email tracking webhook (outbound events: opened, clicked)
  app.post("/api/webhooks/resend", resendWebhookHandler);

  // Resend inbound email webhook (replies from prospects)
  app.post("/api/webhooks/resend-inbound", resendInboundHandler);

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
