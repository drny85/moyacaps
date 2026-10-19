/**
 * Site icons and brand mark from the logo source (assets/source/brand/goodluckcaps.svg).
 *
 * Writes:
 *   src/app/icon.svg              favicon for modern browsers (Next app/ file convention)
 *   src/app/favicon.ico           16/32/48 fallback, also answers bare /favicon.ico requests
 *   src/app/apple-icon.png        180×180, full-bleed (iOS applies its own mask)
 *   public/brand/mark.svg         mark shown beside the wordmark in the navbar, footer and admin
 *   public/brand/logo-512.png     organization logo (JSON-LD), full-bleed
 *
 * Run: bun run build-brand-icons
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { encodeIco, fullBleed } from "./lib/brandIcons";

const ROOT = path.resolve(import.meta.dir, "..");
const SOURCE = path.join(ROOT, "assets", "source", "brand", "goodluckcaps.svg");
const APP = path.join(ROOT, "src", "app");
const BRAND = path.join(ROOT, "public", "brand");

const ICO_SIZES = [16, 32, 48];

/** Renders an SVG at an exact square size; density keeps small sizes from blurring. */
function rasterize(svg: string, size: number) {
  return sharp(Buffer.from(svg), { density: Math.max(72, Math.ceil((72 * size) / 1024) * 4) })
    .resize(size, size)
    .png({ compressionLevel: 9, palette: size >= 180 });
}

async function main() {
  const svg = await fs.readFile(SOURCE, "utf8");
  const square = fullBleed(svg);
  await fs.mkdir(BRAND, { recursive: true });

  await fs.writeFile(path.join(APP, "icon.svg"), svg);
  await fs.writeFile(path.join(BRAND, "mark.svg"), svg);

  const frames = await Promise.all(
    ICO_SIZES.map(async (size) => ({ size, png: new Uint8Array(await rasterize(svg, size).toBuffer()) }))
  );
  await fs.writeFile(path.join(APP, "favicon.ico"), encodeIco(frames));

  await rasterize(square, 180).toFile(path.join(APP, "apple-icon.png"));
  await rasterize(square, 512).toFile(path.join(BRAND, "logo-512.png"));

  console.log("✅ brand icons: icon.svg, favicon.ico (16/32/48), apple-icon.png, brand/mark.svg, brand/logo-512.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
