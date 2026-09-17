import sharp from "sharp";
import path from "path";

async function testExtraction() {
  const caps1Path = path.join(process.cwd(), "images", "caps1.png");
  const img = sharp(caps1Path);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });

  const cellW = 1254 / 4; // 313.5
  const cellH = 1254 / 4; // 313.5

  // Let's test on cell 0 (negro-rojo) and cell 1 (blanco-rojo)
  for (const [col, name] of [[0, "negro-rojo"], [1, "blanco-rojo"]] as const) {
    const left = Math.round(col * cellW);
    const top = 0;
    const w = Math.round(cellW);
    const h = Math.round(cellH);

    // Extract cell buffer as RGBA
    const cellBuffer = await sharp(caps1Path)
      .extract({ left, top, width: w, height: h })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = cellBuffer.data;
    const width = cellBuffer.info.width;
    const height = cellBuffer.info.height;

    // We will do a flood fill starting from all 4 outer edges:
    // Any pixel connected to the border that is background will be marked transparent (alpha = 0).
    // The background in caps1.png is a neutral studio gray:
    // |R - G| <= 14, |G - B| <= 14, |R - B| <= 14
    // and luminance between 140 and 215.
    // Also, anything in the bottom banner area (y > 255) that is outside the cap or banner can be cleared.
    const visited = new Uint8Array(width * height);
    const queue: [number, number][] = [];

    function isBackground(x: number, y: number): boolean {
      if (x < 0 || x >= width || y < 0 || y >= height) return false;
      const idx = (y * width + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      // If in the bottom label region (y >= 265), it is the black banner and floor, remove it
      if (y >= 262) return true;

      // Check saturation (background is neutral gray)
      const diffRG = Math.abs(r - g);
      const diffGB = Math.abs(g - b);
      const diffRB = Math.abs(r - b);
      const maxDiff = Math.max(diffRG, diffGB, diffRB);

      // Background gray is low saturation (neutral gray) and brightness between 130 and 218
      const avg = (r + g + b) / 3;

      if (maxDiff <= 16 && avg >= 135 && avg <= 220) {
        return true;
      }

      // Slightly darker gray shadows near the bottom corners:
      if (y >= 235 && (x < 50 || x > width - 50) && maxDiff <= 18 && avg >= 90) {
        return true;
      }

      return false;
    }

    // Seed outer border pixels
    for (let x = 0; x < width; x++) {
      if (isBackground(x, 0)) {
        queue.push([x, 0]);
        visited[0 * width + x] = 1;
      }
      if (isBackground(x, height - 1)) {
        queue.push([x, height - 1]);
        visited[(height - 1) * width + x] = 1;
      }
    }
    for (let y = 0; y < height; y++) {
      if (isBackground(0, y)) {
        queue.push([0, y]);
        visited[y * width + 0] = 1;
      }
      if (isBackground(width - 1, y)) {
        queue.push([width - 1, y]);
        visited[y * width + (width - 1)] = 1;
      }
    }

    // BFS Flood Fill
    let head = 0;
    while (head < queue.length) {
      const [cx, cy] = queue[head++];
      const idx = (cy * width + cx) * 4;
      pixels[idx + 3] = 0; // set Alpha to 0

      // 4-neighborhood
      const neighbors = [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1],
      ];

      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = ny * width + nx;
          if (!visited[nIdx] && isBackground(nx, ny)) {
            visited[nIdx] = 1;
            queue.push([nx, ny]);
          }
        }
      }
    }

    // Feather / soften the edge by 1px so it doesn't have harsh aliasing:
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        if (pixels[idx + 3] > 0) {
          // Check if adjacent to transparent pixel
          const adjacentTransparent =
            pixels[((y - 1) * width + x) * 4 + 3] === 0 ||
            pixels[((y + 1) * width + x) * 4 + 3] === 0 ||
            pixels[(y * width + (x - 1)) * 4 + 3] === 0 ||
            pixels[(y * width + (x + 1)) * 4 + 3] === 0;

          if (adjacentTransparent) {
            // Check if this border pixel is close to background gray
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            const diff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
            const avg = (r + g + b) / 3;
            if (diff < 20 && avg > 120) {
              pixels[idx + 3] = 120; // soft edge
            }
          }
        }
      }
    }

    const outPath = path.join(process.cwd(), "public", "caps", `test-${name}.png`);
    await sharp(pixels, {
      raw: { width, height, channels: 4 },
    })
      .png()
      .toFile(outPath);

    console.log(`Saved test-${name}.png`);
  }
}

testExtraction().catch(console.error);
