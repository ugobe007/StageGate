/**
 * Shared Resend / Svix webhook signature verification.
 * Must verify against the raw request body — never JSON.stringify(req.body).
 */
import type { Request } from "express";
import crypto from "crypto";

const TIMESTAMP_TOLERANCE_SEC = 5 * 60;

export function getRawBody(req: Request): string | null {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (rawBody?.length) return rawBody.toString("utf8");
  if (typeof req.body === "string") return req.body;
  return null;
}

export function verifyResendSignature(req: Request): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[Resend Webhook] RESEND_WEBHOOK_SECRET not set — skipping signature verification");
    return process.env.NODE_ENV !== "production";
  }

  const body = getRawBody(req);
  if (!body) {
    console.warn("[Resend Webhook] Missing raw body — cannot verify signature");
    return false;
  }

  const svixId = req.headers["svix-id"] as string | undefined;
  const svixTimestamp = req.headers["svix-timestamp"] as string | undefined;
  const svixSignature = req.headers["svix-signature"] as string | undefined;

  if (svixId && svixTimestamp && svixSignature) {
    const ts = Number(svixTimestamp);
    if (!Number.isFinite(ts)) return false;
    const age = Math.abs(Math.floor(Date.now() / 1000) - ts);
    if (age > TIMESTAMP_TOLERANCE_SEC) {
      console.warn("[Resend Webhook] Svix timestamp outside tolerance (%ss)", age);
      return false;
    }

    try {
      const rawSecret = secret.startsWith("whsec_")
        ? Buffer.from(secret.slice(6), "base64")
        : Buffer.from(secret, "base64");

      const toSign = `${svixId}.${svixTimestamp}.${body}`;
      const hmac = crypto.createHmac("sha256", rawSecret).update(toSign).digest("base64");

      return svixSignature.split(" ").some(sig => {
        const parts = sig.split(",");
        return parts.length === 2 && parts[0] === "v1" && parts[1] === hmac;
      });
    } catch {
      return false;
    }
  }

  const legacySig = req.headers["resend-signature"] as string | undefined;
  if (legacySig) {
    try {
      const parts = Object.fromEntries(legacySig.split(",").map(p => p.split("=")));
      const ts = parts["t"];
      const v1 = parts["v1"];
      if (!ts || !v1) return false;
      const toSign = `${ts}.${body}`;
      const hmac = crypto.createHmac("sha256", secret).update(toSign).digest("hex");
      return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(v1));
    } catch {
      return false;
    }
  }

  return false;
}

/** Parse JSON body from raw bytes after express.raw() middleware. */
export function parseWebhookJson(req: Request): void {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return;
  const raw = getRawBody(req) ?? (Buffer.isBuffer(req.body) ? req.body.toString("utf8") : null);
  if (raw) req.body = JSON.parse(raw);
}
