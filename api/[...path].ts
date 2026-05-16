import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Express } from "express";
import { createStageGateApp } from "../server/_core/app";

let appPromise: Promise<Express> | null = null;

function getApp() {
  appPromise ??= createStageGateApp({ serveClient: false });
  return appPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await getApp();
  return app(req, res);
}
