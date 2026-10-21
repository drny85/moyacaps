/**
 * Moves the product images in assets/source/ (formerly public/) into Convex storage as `productImages` rows (ADR 0021).
 * Idempotent: re-running uploads nothing new, and never overwrites an Administrator's image.
 *
 *   bun run migrate:product-images --dev|--prod [--dry-run] [--variants-file <legacyImageFields.json>]
 *
 * --dry-run makes no network calls: it prints each source and its sha256. Without
 * --variants-file it assumes every product in catalogShots.json exists and has no extra
 * lifestyle images, so the list is a subset of a real run.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import catalogShots from "../src/data/catalogShots.json";
import { ALL_CAPS_MANIFEST_MAP } from "../src/data/capsManifest";
import { parseMigrateImagesArgs } from "./lib/migrateImagesArgs";
import { collectImageSources, type ImageSource, type VariantInput } from "./lib/productImageSources";

const PUBLIC_DIR = path.resolve(process.cwd(), "assets", "source");

const MIME: Record<string, string> = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

type Summary = { uploaded: number; imported: number; skipped: number; skippedSlotTaken: number; failed: number };

function setup() {
  const rest = process.argv.slice(2);
  const fileFlagAt = rest.indexOf("--variants-file");
  const variantsFile = fileFlagAt >= 0 ? rest[fileFlagAt + 1] : undefined;
  if (fileFlagAt >= 0) rest.splice(fileFlagAt, 2);
  const { prod, dryRun } = parseMigrateImagesArgs(rest);

  const convex = (fn: string, args: object = {}): unknown => {
    const out = execFileSync("bunx", ["convex", "run", fn, JSON.stringify(args), ...(prod ? ["--prod"] : [])], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "inherit"],
      maxBuffer: 64 * 1024 * 1024,
    }).trim();
    return out ? JSON.parse(out) : null;
  };

  const variants = loadVariants(dryRun, variantsFile, convex);
  const sources = collectImageSources(catalogShots, ALL_CAPS_MANIFEST_MAP, variants);
  console.log(`Target: ${prod ? "PROD" : "dev"}${dryRun ? " (dry run)" : ""}. ${sources.length} image sources from ${variants.length} products.\n`);

  return { prod, dryRun, sources, convex };
}

function loadVariants(dryRun: boolean, variantsFile: string | undefined, convex: (fn: string, args?: object) => unknown): VariantInput[] {
  if (variantsFile) return JSON.parse(fs.readFileSync(variantsFile, "utf-8")) as VariantInput[];
  // Raw stored fields of every product, archived included (the public getVariants overlays imported rows).
  if (!dryRun) return convex("catalog/images/migration:legacyImageFields") as VariantInput[];
  const ids = [...Object.keys(catalogShots.caps), ...Object.keys(catalogShots.tees)];
  return ids.map((variantId) => ({ variantId }));
}

const label = (s: ImageSource) =>
  [s.variantId, s.role, s.colorway, s.angle].filter(Boolean).join(" / ");

async function describeFile(s: ImageSource) {
  const filePath = path.join(PUBLIC_DIR, s.publicPath);
  const bytes = fs.readFileSync(filePath);
  const { width, height } = await sharp(bytes).metadata();
  if (!width || !height) throw new Error(`cannot read dimensions of ${s.publicPath}`);
  return { bytes, width, height, sha256: createHash("sha256").update(bytes).digest("hex"), ext: path.extname(filePath).toLowerCase() };
}

async function upload(convex: (fn: string, args?: object) => unknown, bytes: Buffer, ext: string): Promise<string> {
  const uploadUrl = convex("catalog/admin:generateUploadUrlInternal") as string;
  if (typeof uploadUrl !== "string" || !uploadUrl.startsWith("http")) throw new Error(`unexpected upload URL: ${String(uploadUrl)}`);
  const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": MIME[ext] ?? "application/octet-stream" }, body: bytes });
  if (!res.ok) throw new Error(`upload failed (${res.status}): ${await res.text()}`);
  const { storageId } = (await res.json()) as { storageId?: string };
  if (!storageId) throw new Error("no storageId in upload response");
  return storageId;
}

async function run() {
  const { dryRun, sources, convex } = setup();
  const summary: Summary = { uploaded: 0, imported: 0, skipped: 0, skippedSlotTaken: 0, failed: 0 };

  for (const [i, s] of sources.entries()) {
    const tag = `[${i + 1}/${sources.length}] ${label(s)} <- ${s.publicPath}`;
    try {
      const file = await describeFile(s);
      if (dryRun) {
        console.log(`${tag}\n    sha256 ${file.sha256}  ${file.width}x${file.height}`);
        continue;
      }
      const slot = { variantId: s.variantId, role: s.role, colorway: s.colorway, angle: s.angle };
      const status = convex("catalog/images/migration:slotStatus", { ...slot, sha256: file.sha256 });
      if (status !== "free") {
        if (status === "taken") summary.skippedSlotTaken += 1;
        summary.skipped += 1;
        console.log(`${tag}: skipped (${status === "taken" ? "slot already has a different image" : "already imported"})`);
        continue;
      }
      let storageId = convex("catalog/images/migration:findStorageBySha256", { sha256: file.sha256 }) as string | null;
      if (!storageId) {
        storageId = await upload(convex, file.bytes, file.ext);
        summary.uploaded += 1;
      }
      const result = convex("catalog/images/migration:importImage", {
        ...slot, storageId, sha256: file.sha256, width: file.width, height: file.height,
      }) as { skipped: boolean };
      if (result.skipped) summary.skipped += 1;
      else summary.imported += 1;
      console.log(`${tag}: ${result.skipped ? "skipped" : "imported"}`);
    } catch (err) {
      summary.failed += 1;
      console.error(`${tag}: FAILED`, err instanceof Error ? err.message : err);
    }
  }

  if (dryRun) {
    console.log(`\nDry run: ${sources.length} sources listed, nothing sent.`);
    return;
  }

  try {
    const legacy = convex("catalog/images/migration:importLegacyVariantImages") as { imported: number; skipped: number; failed: number };
    console.log(`\nLegacy variant images: ${JSON.stringify(legacy)}`);
    summary.failed += legacy.failed;
  } catch (err) {
    summary.failed += 1;
    console.error("Legacy variant import FAILED", err instanceof Error ? err.message : err);
  }

  console.log(`\n${JSON.stringify(summary)}`);
  if (summary.failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Migration error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
