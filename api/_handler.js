import { createStageGateApp } from "../dist/app.js";

let appPromise = null;

function getApp() {
  appPromise ??= createStageGateApp();
  return appPromise;
}

export default async function handler(req, res) {
  const app = await getApp();
  return app(req, res);
}
