import crypto from "crypto";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Request } from "express";
import { verifyResendSignature } from "./resendVerify";

const TEST_SECRET = "whsec_dGVzdHNlY3JldGtleTEyMzQ1Ng=="; // base64 "testsecretkey123456"

function makeReq(body: string, headers: Record<string, string>): Request {
  const rawBody = Buffer.from(body);
  return {
    body: JSON.parse(body),
    headers,
    rawBody,
  } as unknown as Request & { rawBody: Buffer };
}

function signSvix(body: string, secret: string, svixId: string, svixTimestamp: string): string {
  const rawSecret = Buffer.from(secret.slice(6), "base64");
  const hmac = crypto
    .createHmac("sha256", rawSecret)
    .update(`${svixId}.${svixTimestamp}.${body}`)
    .digest("base64");
  return `v1,${hmac}`;
}

describe("verifyResendSignature", () => {
  const origSecret = process.env.RESEND_WEBHOOK_SECRET;
  const origEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = TEST_SECRET;
    process.env.NODE_ENV = "production";
  });

  afterEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = origSecret;
    process.env.NODE_ENV = origEnv;
  });

  it("accepts valid Svix signature on raw body", () => {
    const body = JSON.stringify({ type: "email.opened", data: { email_id: "msg_1" } });
    const svixId = "msg_test123";
    const svixTimestamp = String(Math.floor(Date.now() / 1000));
    const sig = signSvix(body, TEST_SECRET, svixId, svixTimestamp);
    const req = makeReq(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": sig,
    });
    (req as Request & { rawBody: Buffer }).rawBody = Buffer.from(body);
    expect(verifyResendSignature(req)).toBe(true);
  });

  it("rejects when raw body is missing (JSON.stringify fallback not used)", () => {
    const body = JSON.stringify({ type: "email.opened", data: {} });
    const svixId = "msg_test123";
    const svixTimestamp = String(Math.floor(Date.now() / 1000));
    const sig = signSvix(body, TEST_SECRET, svixId, svixTimestamp);
    const req = {
      body: JSON.parse(body),
      headers: {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": sig,
      },
    } as unknown as Request;
    expect(verifyResendSignature(req)).toBe(false);
  });

  it("rejects re-serialized body (simulates Vercel pre-parse bug)", () => {
    const body = JSON.stringify({ type: "email.opened", data: { email_id: "msg_1" } });
    const svixId = "msg_test123";
    const svixTimestamp = String(Math.floor(Date.now() / 1000));
    const sig = signSvix(body, TEST_SECRET, svixId, svixTimestamp);
    const reSerialized = JSON.stringify(JSON.parse(body));
    const req = {
      body: JSON.parse(reSerialized),
      headers: {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": sig,
      },
    } as unknown as Request;
    expect(verifyResendSignature(req)).toBe(false);
  });
});
