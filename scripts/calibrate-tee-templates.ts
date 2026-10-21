/**
 * Measures where prints go on each on-model tee template and saves it as data.
 *
 *   bun run calibrate-tee-templates
 *
 * Writes scripts/data/teeTemplates.json (print box per template) and a review sheet at
 * scripts/data/teeTemplates-review.jpg (garment mask in green, print box in red).
 * Re-run only when templates change, and look at the review sheet before committing.
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { floodFillMask, measureTee, printBoxFor, type PrintBox, type TeeMeasure } from "./lib/teeCalibration";

const ROOT = path.resolve(import.meta.dir, "..");
const TEMPLATES = path.join(ROOT, "assets", "source", "shirts", "templates");
const OUT_DIR = path.join(ROOT, "scripts", "data");

type Side = "front" | "back";
const COLORS = ["white", "black", "grey", "cream"] as const;

/**
 * Templates whose own mask is unreliable (strong side light on dark or heathered cotton)
 * reuse the measurement of a template shot in the identical pose.
 */
const MEASURE_FROM: Record<string, string> = {
  "back-black": "back-white",
  "back-grey": "back-white",
};

/** Flood-fill tolerances: washed black has little contrast with the trousers */
const FILL = { dark: { step: 9, range: 38 }, light: { step: 12, range: 70 } };

export interface TeeTemplate {
  file: string;
  side: Side;
  color: (typeof COLORS)[number];
  width: number;
  height: number;
  measure: TeeMeasure;
  box: PrintBox;
  measuredFrom?: string;
}

async function measure(name: string) {
  const file = path.join(TEMPLATES, `${name}.jpg`);
  const { data, info } = await sharp(file).blur(1.2).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const seed = { x: Math.round(info.width / 2), y: Math.round(info.height * 0.36) };
  const mask = floodFillMask({ data, width: info.width, height: info.height, channels: 3 }, seed, name.endsWith("black") ? FILL.dark : FILL.light);
  return { file, info, seed, mask, measure: measureTee(mask, info.width, info.height, seed.x) };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const measured: Record<string, Awaited<ReturnType<typeof measure>>> = {};
  for (const side of ["front", "back"] as Side[]) for (const color of COLORS) measured[`${side}-${color}`] = await measure(`${side}-${color}`);

  const templates: Record<string, TeeTemplate> = {};
  const tiles: Buffer[] = [];
  for (const [name, m] of Object.entries(measured)) {
    const [side, color] = name.split("-") as [Side, TeeTemplate["color"]];
    const source = MEASURE_FROM[name] ? measured[MEASURE_FROM[name]] : m;
    const box = printBoxFor(source.measure, side);
    templates[name] = {
      file: `/shirts/templates/${name}.jpg`,
      side,
      color,
      width: m.info.width,
      height: m.info.height,
      measure: source.measure,
      box,
      ...(MEASURE_FROM[name] ? { measuredFrom: MEASURE_FROM[name] } : {}),
    };

    // Review tile: this template's own mask, the box it will actually use
    const { width, height } = m.info;
    const overlay = Buffer.alloc(width * height * 4);
    for (let i = 0; i < m.mask.length; i++) if (m.mask[i]) { overlay[i * 4 + 1] = 255; overlay[i * 4 + 3] = 80; }
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x="${box.cx - box.width / 2}" y="${box.top}" width="${box.width}" height="${box.height}" fill="none" stroke="red" stroke-width="5"/></svg>`
    );
    const full = await sharp(m.file).composite([{ input: overlay, raw: { width, height, channels: 4 } }, { input: svg }]).png().toBuffer();
    tiles.push(await sharp(full).resize(300, 420, { fit: "fill" }).jpeg().toBuffer());
  }

  await fs.writeFile(path.join(OUT_DIR, "teeTemplates.json"), JSON.stringify(templates, null, 2) + "\n");
  await sharp({ create: { width: 1200, height: 840, channels: 3, background: "#000" } })
    .composite(tiles.map((t, i) => ({ input: t, left: (i % 4) * 300, top: Math.floor(i / 4) * 420 })))
    .jpeg({ quality: 80 })
    .toFile(path.join(OUT_DIR, "teeTemplates-review.jpg"));
  console.log(`📝 scripts/data/teeTemplates.json (${Object.keys(templates).length} templates) + review sheet`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
