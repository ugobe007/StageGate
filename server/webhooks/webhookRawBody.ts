import type { Express, Request, Response } from "express";
import express from "express";

type WebhookHandler = (req: Request, res: Response) => void | Promise<void>;

export function captureRawBody(req: Request, _res: Response, buf: Buffer): void {
  (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
}

/** Mount a webhook route with raw JSON body capture (required for HMAC verification). */
export function mountWebhookRoute(app: Express, path: string, handler: WebhookHandler): void {
  app.post(
    path,
    express.raw({ type: "application/json", limit: "10mb", verify: captureRawBody }),
    async (req, res) => {
      try {
        if (Buffer.isBuffer(req.body)) {
          (req as Request & { rawBody?: Buffer }).rawBody ??= Buffer.from(req.body);
          req.body = JSON.parse(req.body.toString("utf8"));
        }
      } catch {
        res.status(400).json({ error: "Invalid JSON" });
        return;
      }
      await handler(req, res);
    }
  );
}
