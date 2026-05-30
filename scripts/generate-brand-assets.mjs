#!/usr/bin/env node
/**
 * Rasterize StageGate brand SVGs to PNG favicons and social preview assets.
 * Uses the same [S/G] icon mark as StageGateLogo (72×32) on brand near-black.
 * Run: node scripts/generate-brand-assets.mjs
 */
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../client/public");

const NEAR_BLACK = { r: 28, g: 30, b: 34, alpha: 1 };

async function fromSvg(name, outName, width, height = width, background = NEAR_BLACK) {
  const input = path.join(publicDir, name);
  const output = path.join(publicDir, outName);
  await sharp(input, { density: 300 })
    .resize(width, height, { fit: "contain", background })
    .png()
    .toFile(output);
  console.log("wrote", outName);
}

async function faviconFromSvg(outName, size) {
  const input = path.join(publicDir, "favicon.svg");
  const output = path.join(publicDir, outName);
  await sharp(input, { density: 300 })
    .resize(size, size, { fit: "cover" })
    .png()
    .toFile(output);
  console.log("wrote", outName);
}

async function main() {
  await faviconFromSvg("favicon-16x16.png", 16);
  await faviconFromSvg("favicon-32x32.png", 32);
  await fromSvg("stagegate-icon-square.svg", "apple-touch-icon.png", 180);
  await fromSvg("stagegate-icon-square.svg", "icon-192.png", 192);
  await fromSvg("stagegate-icon-square.svg", "icon-512.png", 512);
  await fromSvg("og-image.svg", "og-image.png", 1200, 630);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
