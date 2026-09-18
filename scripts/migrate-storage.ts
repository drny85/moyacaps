import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const CAPS_DIR = path.resolve(process.cwd(), "public/caps");

async function main() {
  console.log("==================================================");
  console.log("MoyaCaps: Migrating Cap Images to Convex Storage");
  console.log("==================================================\n");

  if (!fs.existsSync(CAPS_DIR)) {
    console.error(`Directory not found: ${CAPS_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(CAPS_DIR)
    .filter((file) => file.endsWith(".png") && !fs.statSync(path.join(CAPS_DIR, file)).isDirectory());

  console.log(`Found ${files.length} cap variant images to migrate in ${CAPS_DIR}:\n`);

  let successCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const variantId = path.basename(file, ".png");
    const filePath = path.join(CAPS_DIR, file);

    console.log(`[${i + 1}/${files.length}] Processing variant "${variantId}" (${file})...`);

    try {
      // 1. Generate upload URL from Convex
      const uploadUrlOutput = execSync("bunx convex run products:generateUploadUrlInternal", {
        encoding: "utf-8",
      }).trim();

      // Clean quotation marks if returned as a quoted string
      const uploadUrl = uploadUrlOutput.replace(/^["']|["']$/g, "");

      if (!uploadUrl.startsWith("http")) {
        throw new Error(`Unexpected upload URL returned: ${uploadUrlOutput}`);
      }

      // 2. Read image buffer
      const fileBuffer = fs.readFileSync(filePath);

      // 3. Upload file to Convex Storage
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": "image/png",
        },
        body: fileBuffer,
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload failed with status ${uploadRes.status}: ${await uploadRes.text()}`);
      }

      const { storageId } = (await uploadRes.json()) as { storageId: string };
      if (!storageId) {
        throw new Error("No storageId received in upload response");
      }

      // 4. Associate storageId with variant in Convex
      const setPayload = JSON.stringify({ variantId, storageId });
      const setResult = execSync(`bunx convex run products:setVariantStorageId '${setPayload}'`, {
        encoding: "utf-8",
      }).trim();

      console.log(`   ✓ Uploaded & Linked: storageId = ${storageId}`);
      successCount++;
    } catch (err: any) {
      console.error(`   ✗ Failed processing "${variantId}":`, err?.message || err);
    }
  }

  console.log("\n==================================================");
  console.log(`Migration Complete: ${successCount}/${files.length} variants updated in Convex.`);
  console.log("==================================================\n");

  // Query live variants to verify
  console.log("Verifying live variants from Convex:");
  const variantsRaw = execSync("bunx convex run products:getVariants", { encoding: "utf-8" });
  console.log(variantsRaw);
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
