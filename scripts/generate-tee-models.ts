/**
 * Generates on-model photos of invented models wearing a BLANK white tee, through Vercel AI
 * Gateway (billed to the Vercel team). The garment stays blank on purpose: image models
 * garble graphics, so the real artwork is printed afterwards by scripts/lib/printOnModel.ts.
 *
 *   bun --env-file=.env.vercel.local scripts/generate-tee-models.ts --only m01,m02,m03
 *
 * Cast, scenes, seeds and the model id live in scripts/data/teeModels.json. Raw outputs go to
 * public/shirts/models/raw/{id}.jpg; existing files are skipped unless --force is passed.
 */
import { generateImage } from "ai";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import config from "./data/teeModels.json";

const ROOT = path.resolve(import.meta.dir, "..");
const OUT = path.join(ROOT, "public", "shirts", "models", "raw");

type ModelSpec = (typeof config.models)[number];

export function promptFor(spec: Pick<ModelSpec, "look" | "bottoms" | "scene">): string {
  return config.base.replace("{look}", spec.look).replace("{bottoms}", spec.bottoms).replace("{scene}", spec.scene);
}

function parseArgs(argv: string[]) {
  const only = argv.find((a) => a.startsWith("--only"))?.split("=")[1] ?? argv[argv.indexOf("--only") + 1];
  return {
    only: only && !only.startsWith("--") ? new Set(only.split(",")) : null,
    force: argv.includes("--force"),
  };
}

async function exists(file: string) {
  return fs.access(file).then(() => true, () => false);
}

async function main() {
  if (!process.env.VERCEL_OIDC_TOKEN && !process.env.AI_GATEWAY_API_KEY) {
    throw new Error("No AI Gateway credentials: run `vercel env pull .env.vercel.local` and pass --env-file=.env.vercel.local");
  }
  const { only, force } = parseArgs(process.argv.slice(2));
  const specs = config.models.filter((m) => !only || only.has(m.id));
  await fs.mkdir(OUT, { recursive: true });

  for (const spec of specs) {
    const file = path.join(OUT, `${spec.id}.jpg`);
    if (!force && (await exists(file))) {
      console.log(`⏭️  ${spec.id} exists (use --force to regenerate)`);
      continue;
    }
    const started = Date.now();
    const { image, providerMetadata } = await generateImage({
      model: config.model,
      prompt: promptFor(spec),
      aspectRatio: config.aspectRatio as `${number}:${number}`,
      seed: spec.seed,
    });
    const meta = await sharp(image.uint8Array).metadata();
    await sharp(image.uint8Array).jpeg({ quality: 92, mozjpeg: true }).toFile(file);
    console.log(
      `✅ ${spec.id} (${spec.tee}) ${meta.width}×${meta.height} in ${((Date.now() - started) / 1000).toFixed(1)}s`,
      providerMetadata ? JSON.stringify(providerMetadata).slice(0, 160) : ""
    );
  }
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
