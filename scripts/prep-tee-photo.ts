/**
 * Prep step for a photographed printed tee (a real garment shot flat on a dark surface,
 * not a blank with digital artwork). Run once per delivered flat-lay, then review the
 * cut-out:
 *
 *   bun run scripts/prep-tee-photo.ts <photo> <name>
 *
 * Writes public/shirts/flatlay/{name}.png: the garment cut out to transparency and trimmed,
 * which is the colorway's `flatLayPhoto` that build-catalog-shots frames into the Catalog
 * Shot. Keep the original under shirts/ (outside public/) so the cut-out can be redone.
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { garmentMask, isLimeFabric, maskBounds } from "./lib/teePhoto";

const ROOT = path.resolve(import.meta.dir, "..");
/** Long side of the working image: plenty for a 1360 px Catalog Shot, quick to flood-fill */
const WORK_SIZE = 2400;

async function main() {
  const [photo, name] = process.argv.slice(2);
  if (!photo || !name || !/^[a-z0-9-]+$/.test(name)) {
    console.error("usage: bun run scripts/prep-tee-photo.ts <photo> <kebab-case-name>");
    process.exit(1);
  }

  const { data, info } = await sharp(photo)
    .rotate()
    .resize(WORK_SIZE, WORK_SIZE, { fit: "inside", withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  // Fabric test per colorway; only Acid Wash Lime is photographed so far
  const mask = garmentMask(data, width, height, 3, { isFabric: isLimeFabric, closeRadius: Math.round(width / 250) });
  const bounds = maskBounds(mask, width);
  if (!bounds) throw new Error("no garment found in the photo");
  // Feather the edge by a pixel so the cut-out does not look stencilled on the backdrop
  const alpha = await sharp(Buffer.from(mask.map((m) => m * 255)), { raw: { width, height, channels: 1 } })
    .blur(1.2)
    .extractChannel(0)
    .raw()
    .toBuffer();

  const flatlay = path.join(ROOT, "public", "shirts", "flatlay", `${name}.png`);
  await fs.mkdir(path.dirname(flatlay), { recursive: true });
  // Two passes: sharp applies extract before joinChannel within one pipeline
  const rgba = await sharp(data, { raw: { width, height, channels: 3 } })
    .joinChannel(alpha, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
  await sharp(rgba).extract(bounds).png({ compressionLevel: 9 }).toFile(flatlay);

  const kept = mask.reduce((n, m) => n + m, 0);
  console.log(`✅ ${path.relative(ROOT, flatlay)} (${bounds.width}×${bounds.height}, garment ${((kept / mask.length) * 100).toFixed(1)}% of frame)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
