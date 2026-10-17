/**
 * Builds Catalog Shots (ADR 0016): every Product alone on the shared studio
 * backdrop, 4:5, same scale and centering, plus scale-normalized turntable angles.
 *
 *   bun run build-catalog-shots
 *
 * Outputs
 *   public/catalog/caps/{id}.webp            1600×2000 Catalog Shot on #ECEAE6
 *   public/catalog/caps/{id}/{angle}.webp    1200×1200 transparent turntable angle
 *   public/catalog/tees/{id}/{colorway}.webp 800×1000 Catalog Shot (on-model crop; flat-lay when photographed)
 *                                            or 1600×2000 from a printed tee's `flatLayPhoto` cut-out
 *   public/shirts/{design}-{color}.jpg       on-model Lifestyle Shots printed from the templates
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
import { renderFlatTee, type FabricId, type InkMode, type PrintSide } from "./lib/flatTee";
import { printOnModel } from "./lib/printOnModel";
import type { PrintBox, TeeMeasure } from "./lib/teeCalibration";
import { fitToFlatLayGuide } from "./lib/teePhoto";
import teeTemplates from "./data/teeTemplates.json";

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

/** Template colour name for each Apparel Colorway (public/shirts/templates/{side}-{color}.jpg) */
const TEMPLATE_COLOR: Record<FabricId, string> = {
  "washed-black": "black",
  "crisp-white": "white",
  "heather-grey": "grey",
  "butter-cream": "cream",
};

/**
 * Lifestyle Shots from a real photo shoot (printed garments, see docs/photography-spec.md §1).
 * They are never regenerated and get a proportional grid crop; every other on-model shot is
 * printed from the blank templates by printOnModel. Add each delivered shoot photo here.
 */
// (The eagle-clover black/grey shoot photos show a back print; every design is front-only now.)
const SHOOT_PHOTOS = new Set(["/shirts/angel-clover-white.jpg"]);

/**
 * Graphic Designs drawn as photographs or tonal renders. They print full-colour on a white
 * underbase, so a dark tee keeps their midtones and colour. Every other design is line art,
 * whose black ink prints off-white on dark fabric (scripts/lib/inkModel.ts).
 */
const UNDERBASE_PRINTS = new Set([
  "/shirts/graphics/retro-soul.jpg",
  "/shirts/graphics/vintage-f1.jpg",
  "/shirts/graphics/muscle-car.jpg",
  "/shirts/graphics/angel-clover.jpg",
  "/shirts/graphics/snake-horseshoe.jpg",
]);

type TeeTemplates = Record<string, { file: string; measure: TeeMeasure; box: PrintBox; width: number; height: number }>;
const TEE_TEMPLATES = teeTemplates as TeeTemplates;

/** Tee Catalog Shot size: the on-model sources are ~900 px wide, so 800×1000 keeps them sharp */
const TEE_SHOT = { width: 800, height: 1000 };

/**
 * 4:5 crop of an on-model photo around the tee: the print centred, chin to knees, so the
 * garment fills the frame while staying a real photograph.
 */
async function onModelCatalogShot(lifestyleFile: string, template: TeeTemplates[string] | null, out: string) {
  const meta = await sharp(lifestyleFile).metadata();
  const W = meta.width!;
  const H = meta.height!;
  let cropH: number;
  let top: number;
  let centerX: number;
  if (template) {
    // Composited shot: frame from the template's measured collar and hem
    const torso = template.measure.hemY - template.measure.collarY;
    cropH = Math.round(torso * 1.75);
    top = Math.round(template.measure.collarY - torso * 0.3);
    centerX = template.box.cx;
  } else {
    // Real shoot photo, framed head to mid-shin and centred (photography spec §1)
    cropH = Math.round(H * 0.78);
    top = Math.round(H * 0.08);
    centerX = W / 2;
  }
  cropH = Math.min(H, cropH);
  const cropW = Math.min(W, Math.round(cropH * 0.8));
  top = Math.max(0, Math.min(H - cropH, top));
  const left = Math.max(0, Math.min(W - cropW, Math.round(centerX - cropW / 2)));
  await sharp(lifestyleFile)
    .extract({ left, top, width: cropW, height: cropH })
    .resize(TEE_SHOT.width, TEE_SHOT.height, { kernel: "lanczos3" })
    .sharpen({ sigma: 0.6 })
    .webp(WEBP)
    .toFile(out);
}

/** A TEE_SIZE square flat-lay (transparent PNG) laid on the backdrop with its lift shadow */
async function composeFlatLay(tee: Buffer, out: string) {
  const shadow = await liftShadow(tee, TEE_SIZE);
  const left = Math.round((SHOT.width - TEE_SIZE) / 2);
  const top = Math.round(SHOT.height * TEE_CENTER_Y - TEE_SIZE * TEE_BODY_CENTER);
  await sharp({ create: { width: SHOT.width, height: SHOT.height, channels: 3, background: BACKDROP } })
    .composite([
      { input: shadow, left, top: top + 24 },
      { input: tee, left, top },
    ])
    .webp(WEBP)
    .toFile(out);
}

/** The illustrated flat-lay (or a real blank flat-lay photo when one exists), on the backdrop. */
async function flatLayCatalogShot(colorway: FabricId, side: PrintSide, artPath: string, ink: InkMode, out: string) {
  const blank = path.join(FLATLAY_DIR, `${side}-${colorway}.png`);
  const blankPhoto = (await exists(blank)) ? blank : undefined;
  const tee = await renderFlatTee({ size: TEE_SIZE, fabric: colorway, side, artPath, ink, blankPhoto });
  await composeFlatLay(tee, out);
  return blankPhoto ? "flat-lay photo" : "illustrated";
}

/**
 * A photographed printed tee (cut out by scripts/prep-tee-photo.ts), framed to the flat-lay
 * guide so it matches the scale and centre of every other tee flat-lay.
 */
async function printedFlatLayCatalogShot(cutout: string, out: string) {
  const garment = await trimmed(cutout);
  const fit = fitToFlatLayGuide(garment.width, garment.height, TEE_SIZE);
  const resized = await sharp(garment.data).resize(fit.width, fit.height, { kernel: "lanczos3" }).png().toBuffer();
  const tee = await sharp({ create: { width: TEE_SIZE, height: TEE_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, left: fit.left, top: fit.top }])
    .png()
    .toBuffer();
  await composeFlatLay(tee, out);
}

/**
 * One tee colorway: the on-model Lifestyle Shot (printed from the template unless it is a
 * shoot photo) and its Catalog Shot. Catalog source, best first: real blank flat-lay photo →
 * crop of the on-model photo → illustrated flat-lay.
 */
async function buildTeeColorway(teeId: string, colorway: FabricId, side: PrintSide, artPath: string, ink: InkMode, lifestyle: string) {
  const out = path.join(OUT, "tees", teeId, `${colorway}.webp`);
  await fs.mkdir(path.dirname(out), { recursive: true });
  const template = TEE_TEMPLATES[`${side}-${TEMPLATE_COLOR[colorway]}`];
  const lifestyleFile = path.join(PUBLIC, lifestyle);

  if (template && !SHOOT_PHOTOS.has(lifestyle)) {
    const jpg = await printOnModel({
      templatePath: path.join(PUBLIC, template.file),
      artPath,
      box: template.box,
      darkFabric: colorway === "washed-black",
      ink,
    });
    await fs.writeFile(lifestyleFile, jpg);
  }

  const blank = path.join(FLATLAY_DIR, `${side}-${colorway}.png`);
  let source: string;
  if (!(await exists(blank)) && template && (await exists(lifestyleFile))) {
    const shoot = SHOOT_PHOTOS.has(lifestyle);
    await onModelCatalogShot(lifestyleFile, shoot ? null : template, out);
    source = shoot ? "shoot photo" : "on-model";
  } else {
    source = await flatLayCatalogShot(colorway, side, artPath, ink, out);
  }
  return { path: `/catalog/tees/${teeId}/${colorway}.webp`, source };
}

async function buildTees() {
  const result: Record<string, { printPosition: PrintSide; colorways: Record<string, string> }> = {};
  for (const tee of SHIRT_VARIANTS) {
    const photographed = tee.colorways?.length && tee.colorways.every((cw) => cw.flatLayPhoto);
    if ((!tee.graphicImage && !photographed) || !tee.colorways?.length) {
      console.warn(`⚠️  ${tee.id}: no artwork or colorways, skipped`);
      continue;
    }
    const side: PrintSide = tee.printPosition === "back" ? "back" : "front";
    const art = tee.graphicImage ? path.join(PUBLIC, tee.graphicImage) : "";
    const ink: InkMode = tee.graphicImage && UNDERBASE_PRINTS.has(tee.graphicImage) ? "underbase" : "invert";
    const colorways: Record<string, string> = {};
    const sources = new Set<string>();
    for (const cw of tee.colorways) {
      if (cw.flatLayPhoto) {
        // Real printed garment: its photo is the Catalog Shot source, nothing is printed digitally
        const out = path.join(OUT, "tees", tee.id, `${cw.id}.webp`);
        await fs.mkdir(path.dirname(out), { recursive: true });
        await printedFlatLayCatalogShot(path.join(PUBLIC, cw.flatLayPhoto), out);
        colorways[cw.id] = `/catalog/tees/${tee.id}/${cw.id}.webp`;
        sources.add("printed flat-lay photo");
        continue;
      }
      const shot = await buildTeeColorway(tee.id, cw.id as FabricId, side, art, ink, cw.modelImage);
      colorways[cw.id] = shot.path;
      sources.add(shot.source);
    }
    result[tee.id] = { printPosition: side, colorways };
    console.log(`✅ ${tee.id} (${Object.keys(colorways).length} colorways: ${[...sources].join(" + ")})`);
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
