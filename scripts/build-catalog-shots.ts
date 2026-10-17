/**
 * Builds Catalog Shots (ADR 0016): every Product alone on the shared studio
 * backdrop, 4:5, same scale and centering, plus scale-normalized turntable angles.
 *
 *   bun run build-catalog-shots
 *
 * Outputs
 *   public/catalog/caps/{id}.webp            1600×2000 Catalog Shot on #ECEAE6
 *   public/catalog/caps/{id}/{angle}.webp    1200×1200 transparent turntable angle
 *   src/data/catalogShots.json               manifest of everything written
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { ALL_CAPS_MANIFEST_MAP, type CapAngleKey } from "../src/data/capsManifest";

const ROOT = path.resolve(import.meta.dir, "..");
const PUBLIC = path.join(ROOT, "public");
const OUT = path.join(PUBLIC, "catalog");

export const BACKDROP = "#ECEAE6";
const SHOT = { width: 1600, height: 2000 };
/** Product box inside the shot: caps are wide, so width governs */
const CAP_BOX = { width: SHOT.width * 0.8, height: SHOT.height * 0.5 };
/** Vertical center of the product, as a fraction of shot height (slightly above middle reads as resting) */
const CAP_CENTER_Y = 0.47;

const ANGLE_SIZE = 1200;
/** Every angle is scaled to the same crown-to-brim height so the turntable never "breathes" */
const ANGLE_HEIGHT = ANGLE_SIZE * 0.56;
const ANGLE_MAX_WIDTH = ANGLE_SIZE * 0.92;
const ANGLES: CapAngleKey[] = ["front", "left", "back", "right"];

const WEBP = { quality: 88, effort: 5 } as const;

/** Trim transparent margins so scale is measured on the product itself */
async function trimmed(file: string) {
  const { data, info } = await sharp(file).ensureAlpha().trim({ threshold: 8 }).png().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Soft elliptical contact shadow, blurred, sized to the product footprint */
async function groundShadow(width: number) {
  const w = Math.round(width * 0.9);
  const h = Math.round(Math.max(40, width * 0.07));
  const pad = 80;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w + pad * 2}" height="${h + pad * 2}">
    <ellipse cx="${w / 2 + pad}" cy="${h / 2 + pad}" rx="${w / 2}" ry="${h / 2}" fill="#000" fill-opacity="0.22"/>
  </svg>`;
  const buf = await sharp(Buffer.from(svg)).blur(28).png().toBuffer();
  return { buf, width: w + pad * 2, height: h + pad * 2 };
}

async function capCatalogShot(id: string, source: string) {
  const product = await trimmed(source);
  const scale = Math.min(CAP_BOX.width / product.width, CAP_BOX.height / product.height);
  const w = Math.round(product.width * scale);
  const h = Math.round(product.height * scale);
  const resized = await sharp(product.data).resize(w, h, { kernel: "lanczos3" }).png().toBuffer();

  const left = Math.round((SHOT.width - w) / 2);
  const top = Math.round(SHOT.height * CAP_CENTER_Y - h / 2);
  const shadow = await groundShadow(w);

  const out = path.join(OUT, "caps", `${id}.webp`);
  await sharp({ create: { width: SHOT.width, height: SHOT.height, channels: 3, background: BACKDROP } })
    .composite([
      {
        input: shadow.buf,
        left: Math.round((SHOT.width - shadow.width) / 2),
        top: Math.round(top + h - shadow.height / 2 - h * 0.02),
      },
      { input: resized, left, top },
    ])
    .webp(WEBP)
    .toFile(out);
  return `/catalog/caps/${id}.webp`;
}

async function capAngle(id: string, angle: CapAngleKey, source: string) {
  const product = await trimmed(source);
  const scale = Math.min(ANGLE_HEIGHT / product.height, ANGLE_MAX_WIDTH / product.width);
  const w = Math.round(product.width * scale);
  const h = Math.round(product.height * scale);
  const resized = await sharp(product.data).resize(w, h, { kernel: "lanczos3" }).png().toBuffer();

  const out = path.join(OUT, "caps", id, `${angle}.webp`);
  await sharp({ create: { width: ANGLE_SIZE, height: ANGLE_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, left: Math.round((ANGLE_SIZE - w) / 2), top: Math.round((ANGLE_SIZE - h) / 2) }])
    .webp({ ...WEBP, alphaQuality: 100 })
    .toFile(out);
  return `/catalog/caps/${id}/${angle}.webp`;
}

async function exists(file: string) {
  return fs.access(file).then(() => true, () => false);
}

async function buildCaps() {
  const manifest = ALL_CAPS_MANIFEST_MAP as Record<string, { angles: Record<CapAngleKey, string> }>;
  const capFiles = (await fs.readdir(path.join(PUBLIC, "caps"))).filter((f) => f.endsWith(".png") && !/^hq\d/.test(f));
  const ids = [...new Set([...Object.keys(manifest), ...capFiles.map((f) => f.replace(/\.png$/, ""))])].sort();

  const result: Record<string, { catalog: string; angles?: Record<CapAngleKey, string> }> = {};
  for (const id of ids) {
    const angleSrc = manifest[id]?.angles;
    const front = angleSrc ? path.join(PUBLIC, angleSrc.front) : path.join(PUBLIC, "caps", `${id}.png`);
    if (!(await exists(front))) {
      console.warn(`⚠️  ${id}: no source photo, skipped`);
      continue;
    }
    await fs.mkdir(path.join(OUT, "caps", id), { recursive: true });
    const entry: (typeof result)[string] = { catalog: await capCatalogShot(id, front) };

    if (angleSrc) {
      const angles = {} as Record<CapAngleKey, string>;
      for (const angle of ANGLES) {
        const src = path.join(PUBLIC, angleSrc[angle]);
        if (!(await exists(src))) throw new Error(`${id}: missing ${angle} angle at ${angleSrc[angle]}`);
        angles[angle] = await capAngle(id, angle, src);
      }
      entry.angles = angles;
    }
    result[id] = entry;
    console.log(`✅ ${id}${entry.angles ? " (+4 angles)" : ""}`);
  }
  return result;
}

async function main() {
  await fs.mkdir(path.join(OUT, "caps"), { recursive: true });
  const caps = await buildCaps();
  const manifestPath = path.join(ROOT, "src", "data", "catalogShots.json");
  await fs.writeFile(manifestPath, JSON.stringify({ backdrop: BACKDROP, caps }, null, 2) + "\n");
  console.log(`📝 ${path.relative(ROOT, manifestPath)}: ${Object.keys(caps).length} caps`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
