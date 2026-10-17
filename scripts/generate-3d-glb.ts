import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import {
  CAPS_MANIFEST,
  BASE_CAP_GLB_PATH,
  type CapAngleKey,
} from "../src/data/capsManifest";
import { applyCapColorwayToScene } from "../src/lib/cap3dMaterials";

export { applyCapColorwayToScene };

const ORDERED_MULTIVIEW_ANGLES: readonly CapAngleKey[] = [
  "front",
  "left",
  "back",
  "right",
] as const;

type ProviderType = "tripo3d" | "meshy";

function detectProvider(apiKey: string): ProviderType {
  const explicit = process.env.THREE_D_PROVIDER?.toLowerCase();
  if (explicit === "meshy") return "meshy";
  if (explicit === "tripo3d" || explicit === "tripo") return "tripo3d";
  if (apiKey.startsWith("msy_")) return "meshy";
  return "tripo3d";
}

/**
 * Upload an image buffer to Tripo3D and return its file_token
 */
async function uploadToTripo3D(
  apiKey: string,
  angle: CapAngleKey,
  buffer: Buffer
): Promise<string> {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([buffer], { type: "image/png" }),
    `${angle}.png`
  );

  const res = await fetch("https://api.tripo3d.ai/v2/openapi/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Tripo3D upload failed (${res.status}): ${errText}`);
  }

  const json = (await res.json()) as {
    code: number;
    data?: { image_token?: string };
  };
  const token = json.data?.image_token;
  if (!token) {
    throw new Error(`Tripo3D upload response missing image_token: ${JSON.stringify(json)}`);
  }
  return token;
}

/**
 * Generate a 3D .GLB via Tripo3D Multi-View API using [front, left, back, right]
 */
async function generateViaTripo3D(
  apiKey: string,
  angleBuffers: Record<CapAngleKey, Buffer>
): Promise<Buffer> {
  console.log("☁️  Uploading [front, left, back, right] views to Tripo3D...");
  const filesPayload = [];

  for (const angle of ORDERED_MULTIVIEW_ANGLES) {
    const token = await uploadToTripo3D(apiKey, angle, angleBuffers[angle]);
    filesPayload.push({
      type: "png",
      file_token: token,
    });
    console.log(`   ✔ Uploaded ${angle}.png -> token: ${token.slice(0, 12)}...`);
  }

  console.log("🔨 Creating Tripo3D multiview_to_model task...");
  const createRes = await fetch("https://api.tripo3d.ai/v2/openapi/task", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "multiview_to_model",
      files: filesPayload,
      model_version: "v2.5-20250123",
      texture: true,
      pbr: true,
      texture_alignment: "original_image",
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Tripo3D task creation failed (${createRes.status}): ${errText}`);
  }

  const createJson = (await createRes.json()) as {
    code: number;
    data?: { task_id?: string };
  };
  const taskId = createJson.data?.task_id;
  if (!taskId) {
    throw new Error(`Tripo3D task creation missing task_id: ${JSON.stringify(createJson)}`);
  }

  console.log(`⏳ Polling Tripo3D task ${taskId}...`);
  for (let attempt = 1; attempt <= 120; attempt++) {
    await new Promise((r) => setTimeout(r, 5000));
    const statusRes = await fetch(
      `https://api.tripo3d.ai/v2/openapi/task/${taskId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );
    if (!statusRes.ok) continue;

    const statusJson = (await statusRes.json()) as {
      data?: {
        status?: string;
        progress?: number;
        output?: { pbr_model?: string; model?: string };
      };
    };

    const status = statusJson.data?.status;
    const progress = statusJson.data?.progress ?? 0;
    console.log(`   [${attempt}] status=${status} progress=${progress}%`);

    if (status === "success") {
      const glbUrl =
        statusJson.data?.output?.pbr_model || statusJson.data?.output?.model;
      if (!glbUrl) {
        throw new Error("Tripo3D task succeeded but no GLB URL returned");
      }
      console.log(`⬇️  Downloading generated GLB from ${glbUrl}...`);
      const glbRes = await fetch(glbUrl);
      if (!glbRes.ok) {
        throw new Error(`Failed to download GLB (${glbRes.status})`);
      }
      return Buffer.from(await glbRes.arrayBuffer());
    }

    if (status === "failed" || status === "cancelled" || status === "banned") {
      throw new Error(`Tripo3D task terminated with status: ${status}`);
    }
  }

  throw new Error("Timed out waiting for Tripo3D multiview_to_model task");
}

/**
 * Generate a 3D .GLB via Meshy Multi-Image-to-3D API using [front, left, back, right]
 */
async function generateViaMeshy(
  apiKey: string,
  angleBuffers: Record<CapAngleKey, Buffer>
): Promise<Buffer> {
  console.log("☁️  Encoding [front, left, back, right] views as Data URIs for Meshy Multi-View API...");
  const imageUrls = ORDERED_MULTIVIEW_ANGLES.map((angle) => {
    const b64 = angleBuffers[angle].toString("base64");
    return `data:image/png;base64,${b64}`;
  });

  console.log("🔨 Creating Meshy multi-image-to-3d task...");
  const createRes = await fetch(
    "https://api.meshy.ai/openapi/v1/multi-image-to-3d",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_urls: imageUrls,
        should_remesh: true,
        should_texture: true,
        enable_pbr: true,
        topology: "triangle",
        target_polycount: 30000,
      }),
    }
  );

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Meshy task creation failed (${createRes.status}): ${errText}`);
  }

  const createJson = (await createRes.json()) as { result?: string };
  const taskId = createJson.result;
  if (!taskId) {
    throw new Error(`Meshy response missing task ID: ${JSON.stringify(createJson)}`);
  }

  console.log(`⏳ Polling Meshy task ${taskId}...`);
  for (let attempt = 1; attempt <= 120; attempt++) {
    await new Promise((r) => setTimeout(r, 5000));
    const statusRes = await fetch(
      `https://api.meshy.ai/openapi/v1/multi-image-to-3d/${taskId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );
    if (!statusRes.ok) continue;

    const statusJson = (await statusRes.json()) as {
      status?: string;
      progress?: number;
      model_urls?: { glb?: string };
    };

    const status = statusJson.status;
    const progress = statusJson.progress ?? 0;
    console.log(`   [${attempt}] status=${status} progress=${progress}%`);

    if (status === "SUCCEEDED") {
      const glbUrl = statusJson.model_urls?.glb;
      if (!glbUrl) {
        throw new Error("Meshy task succeeded but model_urls.glb is missing");
      }
      console.log(`⬇️  Downloading generated GLB from ${glbUrl}...`);
      const glbRes = await fetch(glbUrl);
      if (!glbRes.ok) {
        throw new Error(`Failed to download GLB (${glbRes.status})`);
      }
      return Buffer.from(await glbRes.arrayBuffer());
    }

    if (status === "FAILED" || status === "CANCELED") {
      throw new Error(`Meshy task terminated with status: ${status}`);
    }
  }

  throw new Error("Timed out waiting for Meshy multi-image-to-3d task");
}

async function main() {
  console.log("🧊 Starting 4-View to 3D .GLB Generation Script (scripts/generate-3d-glb.ts)...");

  const rootDir = process.cwd();
  const anglesDir = path.join(rootDir, "public", "caps", "angles");
  const outGlbPath = path.join(rootDir, "public", BASE_CAP_GLB_PATH);

  await fs.mkdir(path.dirname(outGlbPath), { recursive: true });

  // 1. Load & verify all 4 cardinal views [front, left, back, right]
  const angleBuffers = {} as Record<CapAngleKey, Buffer>;
  for (const angle of ORDERED_MULTIVIEW_ANGLES) {
    const filePath = path.join(anglesDir, `${angle}.png`);
    const buf = await fs.readFile(filePath);
    const meta = await sharp(buf).metadata();
    angleBuffers[angle] = buf;
    console.log(
      `   ✔ Verified ${angle}.png (${meta.width}x${meta.height}, channels=${meta.channels})`
    );
  }

  console.log(
    `🎨 Configured dynamic Three.js material swapping across ${CAPS_MANIFEST.length} colorways:`
  );
  for (const cw of CAPS_MANIFEST) {
    console.log(
      `   • ${cw.id.padEnd(22)} primary=${cw.primaryHex} secondary=${cw.secondaryHex} trucker=${cw.isTruckerMesh} camo=${cw.camoPattern ?? "none"}`
    );
  }

  const apiKey = process.env.THREE_D_API_KEY?.trim();
  if (!apiKey) {
    console.log(
      "\nℹ️  THREE_D_API_KEY is not set in the environment. Skipping live Multi-View API call."
    );
    console.log(
      "   To generate /public/models/caps/base-cap.glb via Tripo3D or Meshy Multi-View API, run:"
    );
    console.log(
      "   THREE_D_API_KEY=your_key bun run scripts/generate-3d-glb.ts"
    );
    console.log(
      "   Until /public/models/caps/base-cap.glb is present, Cap3DViewer automatically runs in Mode A (Immediate 3D Spatial Multi-Angle Rotator)."
    );
    return;
  }

  const provider = detectProvider(apiKey);
  console.log(`🌐 Selected Multi-View 3D Provider: ${provider.toUpperCase()}`);

  const glbBuffer =
    provider === "meshy"
      ? await generateViaMeshy(apiKey, angleBuffers)
      : await generateViaTripo3D(apiKey, angleBuffers);

  await fs.writeFile(outGlbPath, glbBuffer);
  console.log(
    `✅ Saved generated 3D model (${(glbBuffer.length / 1024).toFixed(1)} KB) to ${outGlbPath}`
  );
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("❌ Error in generate-3d-glb:", err);
    process.exit(1);
  });
}
