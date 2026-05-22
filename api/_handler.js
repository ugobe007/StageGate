import { createStageGateApp } from "../dist/app.js";

// Vercel pre-parses JSON by default, which breaks Resend/Stripe HMAC verification.
export const config = {
  api: {
    bodyParser: false,
  },
};

let appPromise = null;

function getApp() {
  appPromise ??= createStageGateApp();
  return appPromise;
}

export default async function handler(req, res) {
  const app = await getApp();
  return app(req, res);
}
