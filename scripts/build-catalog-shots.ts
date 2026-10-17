/**
 * Builds Catalog Shots (ADR 0016): every Product alone on the shared studio
 * backdrop, 4:5, same scale and centering, plus scale-normalized turntable angles.
 *
 *   bun run build-catalog-shots
 *
 * Outputs
 *   public/catalog/caps/{id}.webp            1600×2000 Catalog Shot on #ECEAE6
 *   public/catalog/caps/{id}/{angle}.webp    1200×1200 transparent turntable angle
 *   public/catalog/tees/{id}/{colorway}.webp 1600×2000 Catalog Shot on #ECEAE6
 *   src/data/catalogShots.json               manifest of everything written
 *   src/app/icon.png, src/app/apple-icon.png site icons (Next app/ file convention)
 *   public/brand/logo-512.png                organization logo (JSON-LD)
 *   public/og/home.jpg                       1200×630 share image
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { ALL_CAPS_MANIFEST_MAP, type CapAngleKey } from "../src/data/capsManifest";
import { SHIRT_VARIANTS } from "../src/data/caps";
import { renderFlatTee, type FabricId, type PrintSide } from "./lib/flatTee";

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

/** Tee square render width inside the shot, and its vertical centre (tee body spans y 118–950 of 1000) */
const TEE_SIZE = 1360;
const TEE_BODY_CENTER = 0.534;
const TEE_CENTER_Y = 0.47;
/** Real blank flat-lays, when shot to docs/photography-spec.md: {side}-{colorway}.png */
const FLATLAY_DIR = path.join(PUBLIC, "shirts", "flatlay");

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

/** Shadow cast by a garment lying on the backdrop: its own alpha, darkened, blurred and offset down */
async function liftShadow(product: Buffer, size: number) {
  const alpha = await sharp(product).extractChannel("alpha").toColourspace("b-w").linear(0.22, 0).blur(24).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 3, background: "#000" } }).joinChannel(alpha).png().toBuffer();
}

async function teeCatalogShot(id: string, colorway: FabricId, side: PrintSide, artPath: string) {
  const blank = path.join(FLATLAY_DIR, `${side}-${colorway}.png`);
  const blankPhoto = (await exists(blank)) ? blank : undefined;
  const tee = await renderFlatTee({ size: TEE_SIZE, fabric: colorway, side, artPath, blankPhoto });
  const shadow = await liftShadow(tee, TEE_SIZE);
  const left = Math.round((SHOT.width - TEE_SIZE) / 2);
  const top = Math.round(SHOT.height * TEE_CENTER_Y - TEE_SIZE * TEE_BODY_CENTER);

  await fs.mkdir(path.join(OUT, "tees", id), { recursive: true });
  await sharp({ create: { width: SHOT.width, height: SHOT.height, channels: 3, background: BACKDROP } })
    .composite([
      { input: shadow, left, top: top + 24 },
      { input: tee, left, top },
    ])
    .webp(WEBP)
    .toFile(path.join(OUT, "tees", id, `${colorway}.webp`));
  return { path: `/catalog/tees/${id}/${colorway}.webp`, source: blankPhoto ? "photo" : "illustrated" };
}

async function buildTees() {
  const result: Record<string, { printPosition: PrintSide; colorways: Record<string, string> }> = {};
  for (const tee of SHIRT_VARIANTS) {
    if (!tee.graphicImage || !tee.colorways?.length) {
      console.warn(`⚠️  ${tee.id}: no artwork or colorways, skipped`);
      continue;
    }
    const side: PrintSide = tee.printPosition === "back" ? "back" : "front";
    const art = path.join(PUBLIC, tee.graphicImage);
    const colorways: Record<string, string> = {};
    const sources = new Set<string>();
    for (const cw of tee.colorways) {
      const shot = await teeCatalogShot(tee.id, cw.id as FabricId, side, art);
      colorways[cw.id] = shot.path;
      sources.add(shot.source);
    }
    result[tee.id] = { printPosition: side, colorways };
    console.log(`✅ ${tee.id} (${Object.keys(colorways).length} colorways, ${[...sources].join("+")})`);
  }
  return result;
}

/**
 * Brand images from the flagship cap: small site icons (the full photo was a 389 KB favicon
 * fetched at high priority on every page), the JSON-LD logo and the 1200×630 share image.
 */
async function buildBrandImages() {
  const flagship = path.join(OUT, "caps", "negro-rojo", "front.webp");
  const cap = await trimmed(flagship);
  const square = async (size: number, pad: number, background: sharp.Color) => {
    const inner = Math.round(size * (1 - pad * 2));
    const resized = await sharp(cap.data).resize(inner, inner, { fit: "inside" }).png().toBuffer({ resolveWithObject: true });
    return sharp({ create: { width: size, height: size, channels: 4, background } })
      .composite([{ input: resized.data, left: Math.round((size - resized.info.width) / 2), top: Math.round((size - resized.info.height) / 2) }])
      .png();
  };
  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
  await (await square(64, 0.04, transparent)).toFile(path.join(ROOT, "src", "app", "icon.png"));
  await (await square(180, 0.1, BACKDROP)).toFile(path.join(ROOT, "src", "app", "apple-icon.png"));
  await fs.mkdir(path.join(PUBLIC, "brand"), { recursive: true });
  await (await square(512, 0.08, BACKDROP)).toFile(path.join(PUBLIC, "brand", "logo-512.png"));

  const og = { width: 1200, height: 630 };
  const capH = Math.round(og.height * 0.62);
  const ogCap = await sharp(cap.data).resize({ height: capH }).png().toBuffer({ resolveWithObject: true });
  const shadow = await groundShadow(ogCap.info.width);
  await fs.mkdir(path.join(PUBLIC, "og"), { recursive: true });
  await sharp({ create: { ...og, channels: 3, background: BACKDROP } })
    .composite([
      { input: shadow.buf, left: Math.round((og.width - shadow.width) / 2), top: Math.round(og.height * 0.2 + capH - shadow.height / 2) },
      { input: ogCap.data, left: Math.round((og.width - ogCap.info.width) / 2), top: Math.round(og.height * 0.2) },
    ])
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(path.join(PUBLIC, "og", "home.jpg"));
  console.log("✅ brand images: icon, apple-icon, logo-512, og/home.jpg");
}

async function main() {
  await fs.mkdir(path.join(OUT, "caps"), { recursive: true });
  const caps = await buildCaps();
  const tees = await buildTees();
  await buildBrandImages();
  const manifestPath = path.join(ROOT, "src", "data", "catalogShots.json");
  await fs.writeFile(manifestPath, JSON.stringify({ backdrop: BACKDROP, caps, tees }, null, 2) + "\n");
  console.log(`📝 ${path.relative(ROOT, manifestPath)}: ${Object.keys(caps).length} caps, ${Object.keys(tees).length} tees`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
