#!/usr/bin/env node
/**
 * Rasterize StageGate brand SVGs to PNG favicons and social preview assets.
 * Run: node scripts/generate-brand-assets.mjs
 */
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../client/public");

async function fromSvg(name, outName, width, height = width) {
  const input = path.join(publicDir, name);
  const output = path.join(publicDir, outName);
  await sharp(input, { density: 300 })
    .resize(width, height, { fit: "contain", background: { r: 28, g: 30, b: 34, alpha: 1 } })
    .png()
    .toFile(output);
  console.log("wrote", outName);
}

async function faviconFromMark(outName, size) {
  const input = path.join(publicDir, "stagegate-mark.svg");
  const output = path.join(publicDir, outName);
  // Wide mark — fit inside square canvas on brand near-black
  await sharp(input, { density: 300 })
    .resize(Math.round(size * 0.72), Math.round(size * 0.32), { fit: "inside" })
    .extend({
      top: Math.round(size * 0.34),
      bottom: Math.round(size * 0.34),
      left: Math.round(size * 0.14),
      right: Math.round(size * 0.14),
      background: { r: 28, g: 30, b: 34, alpha: 1 },
    })
    .png()
    .toFile(output);
  console.log("wrote", outName);
}

async function main() {
  await faviconFromMark("favicon-16x16.png", 16);
  await faviconFromMark("favicon-32x32.png", 32);
  await fromSvg("stagegate-icon-square.svg", "apple-touch-icon.png", 180);
  await fromSvg("stagegate-icon-square.svg", "icon-192.png", 192);
  await fromSvg("stagegate-icon-square.svg", "icon-512.png", 512);
  await fromSvg("og-image.svg", "og-image.png", 1200, 630);

  // Multi-size ICO for legacy browsers — skip; PNG + SVG cover modern clients
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
