import { createStageGateApp } from "../server/_core/app.ts";

let appPromise = null;

function getApp() {
  appPromise ??= createStageGateApp({ serveClient: false });
  return appPromise;
}

export default async function handler(req, res) {
  const app = await getApp();
  return app(req, res);
}
