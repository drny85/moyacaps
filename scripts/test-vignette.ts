import sharp from "sharp";
import path from "path";

async function testVignette() {
  const caps1Path = path.join(process.cwd(), "images", "caps1.png");

  const cellW = 1254 / 4; // 313.5
  const cellH = 1254 / 4; // 313.5

  for (const [col, name] of [[0, "negro-rojo"], [1, "blanco-rojo"]] as const) {
    const left = Math.round(col * cellW);
    const top = 0;
    const w = Math.round(cellW);
    // Crop above the banner: y=0 to y=256 (height 256px)
    const h = 258;

    const cellBuffer = await sharp(caps1Path)
      .extract({ left, top, width: w, height: h })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = cellBuffer.data;
    const width = cellBuffer.info.width;
    const height = cellBuffer.info.height;

    // We create a smooth elliptical alpha mask:
    // Center at (width/2, height*0.52)
    // Rx = width * 0.48, Ry = height * 0.48
    // Inside rx, ry -> full opacity (or fades out background only at the extreme perimeter)
    const cx = width / 2;
    const cy = height * 0.52;
    const rx = width * 0.48;
    const ry = height * 0.48;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;

        // Normalized distance from center in an ellipse
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 1.0) {
          pixels[idx + 3] = 0; // completely transparent outside
        } else if (dist > 0.82) {
          // Smooth fade out
          const factor = 1 - (dist - 0.82) / (1.0 - 0.82);
          pixels[idx + 3] = Math.round(pixels[idx + 3] * factor);
        }
      }
    }

    const outPath = path.join(process.cwd(), "public", "caps", `vignette-${name}.png`);
    await sharp(pixels, {
      raw: { width, height, channels: 4 },
    })
      .png()
      .toFile(outPath);

    console.log(`Saved vignette-${name}.png`);
  }
}

testVignette().catch(console.error);
