import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

async function main() {
  const publicCapsDir = path.join(process.cwd(), "public", "caps");
  const anglesDir = path.join(publicCapsDir, "angles");

  await fs.mkdir(publicCapsDir, { recursive: true });
  await fs.mkdir(anglesDir, { recursive: true });

  const caps1Path = path.join(process.cwd(), "images", "caps1.png");
  const caps2Path = path.join(process.cwd(), "images", "caps2.png");

  // Grid dimensions
  const cellW = 313;
  const cellH = 313;

  // 1. Build a refined master silhouette mask from the highest contrast cap (Col 0: negro-rojo)
  console.log("Generating refined master silhouette mask...");
  const rawCaps1 = await sharp(caps1Path).raw().toBuffer({ resolveWithObject: true });

  const isBg = new Uint8Array(cellW * cellH);
  for (let y = 0; y < cellH; y++) {
    for (let x = 0; x < cellW; x++) {
      const idx = (y * rawCaps1.info.width + x) * rawCaps1.info.channels;
      const r = rawCaps1.data[idx];
      const g = rawCaps1.data[idx + 1];
      const b = rawCaps1.data[idx + 2];
      const diff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
      const avg = (r + g + b) / 3;

      // Bottom banner area: remove completely
      if (y >= 256) {
        isBg[y * cellW + x] = 1;
      }
      // Grid border lines (outer 3 pixels)
      else if (x <= 3 || x >= cellW - 4 || y <= 2) {
        isBg[y * cellW + x] = 1;
      }
      // Lateral floor shadows outside the cap brim
      else if (y >= 215 && (x <= 32 || x >= cellW - 33)) {
        isBg[y * cellW + x] = 1;
      }
      // Neutral studio gray background
      else if (diff <= 8 && avg >= 142 && avg <= 210) {
        isBg[y * cellW + x] = 1;
      }
    }
  }

  // Flood fill exterior background starting from outer perimeter
  const visited = new Uint8Array(cellW * cellH);
  const queue: [number, number][] = [];

  // Seed outer edges
  for (let x = 0; x < cellW; x++) {
    if (isBg[0 * cellW + x]) {
      queue.push([x, 0]);
      visited[0 * cellW + x] = 1;
    }
    if (isBg[(cellH - 1) * cellW + x]) {
      queue.push([x, cellH - 1]);
      visited[(cellH - 1) * cellW + x] = 1;
    }
  }
  for (let y = 0; y < cellH; y++) {
    if (isBg[y * cellW + 0]) {
      queue.push([0, y]);
      visited[y * cellW + 0] = 1;
    }
    if (isBg[y * cellW + (cellW - 1)]) {
      queue.push([cellW - 1, y]);
      visited[y * cellW + (cellW - 1)] = 1;
    }
  }

  let head = 0;
  while (head < queue.length) {
    const [cx, cy] = queue[head++];
    const neighbors: [number, number][] = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < cellW && ny >= 0 && ny < cellH) {
        const nIdx = ny * cellW + nx;
        if (!visited[nIdx] && isBg[nIdx]) {
          visited[nIdx] = 1;
          queue.push([nx, ny]);
        }
      }
    }
  }

  // Create alpha mask: unvisited = solid inside cap (255), visited = exterior background (0)
  const masterAlpha = new Uint8Array(cellW * cellH);
  for (let i = 0; i < cellW * cellH; i++) {
    masterAlpha[i] = visited[i] ? 0 : 255;
  }

  // 1-pixel soft anti-aliased edge
  const smoothAlpha = new Uint8Array(masterAlpha);
  for (let y = 1; y < cellH - 1; y++) {
    for (let x = 1; x < cellW - 1; x++) {
      const idx = y * cellW + x;
      if (masterAlpha[idx] === 255) {
        const isEdge =
          masterAlpha[(y - 1) * cellW + x] === 0 ||
          masterAlpha[(y + 1) * cellW + x] === 0 ||
          masterAlpha[y * cellW + (x - 1)] === 0 ||
          masterAlpha[y * cellW + (x + 1)] === 0;

        if (isEdge) {
          smoothAlpha[idx] = 140;
        }
      }
    }
  }

  const capVariants = [
    { id: "negro-rojo", row: 0, col: 0 },
    { id: "blanco-rojo", row: 0, col: 1 },
    { id: "azul-marino-rojo", row: 0, col: 2 },
    { id: "rojo-negro", row: 0, col: 3 },
    { id: "verde-rojo", row: 1, col: 0 },
    { id: "gris-rojo", row: 1, col: 1 },
    { id: "beige-rojo", row: 1, col: 2 },
    { id: "marron-rojo", row: 1, col: 3 },
    { id: "azul-rey-blanco", row: 2, col: 0 },
    { id: "rosa-blanco", row: 2, col: 1 },
    { id: "morado-blanco", row: 2, col: 2 },
    { id: "turquesa-blanco", row: 2, col: 3 },
    { id: "camuflaje-negro", row: 3, col: 0 },
    { id: "gris-negro-trucker", row: 3, col: 1 },
    { id: "blanco-negro-trucker", row: 3, col: 2 },
    { id: "camuflaje-gris-negro", row: 3, col: 3 },
  ];

  console.log("Applying transparent cutout to all 16 cap variants...");
  for (const cap of capVariants) {
    const left = Math.round(cap.col * 313.5);
    const top = Math.round(cap.row * 313.5);

    const cellBuf = await sharp(caps1Path)
      .extract({ left, top, width: cellW, height: cellH })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    for (let y = 0; y < cellH; y++) {
      for (let x = 0; x < cellW; x++) {
        const a = smoothAlpha[y * cellW + x];
        cellBuf.data[(y * cellW + x) * 4 + 3] = a;
      }
    }

    const outPath = path.join(publicCapsDir, `${cap.id}.png`);
    await sharp(cellBuf.data, {
      raw: { width: cellW, height: cellH, channels: 4 },
    })
      .png({ quality: 95 })
      .toFile(outPath);

    console.log(`Saved transparent ${cap.id}.png`);
  }

  // 2. Process multi-angle views from caps2.png
  console.log("Processing multi-angle views from caps2.png...");
  const caps2Meta = await sharp(caps2Path).metadata();
  const imgW = caps2Meta.width || 1254;
  const imgH = caps2Meta.height || 1254;
  const topH = 840;
  const bottomH = imgH - topH;
  const colW3 = Math.floor(imgW / 3);

  // Helper function to remove exterior gray background from an extracted buffer
  async function makeCutout(left: number, top: number, width: number, height: number, bannerCutoffY?: number) {
    const raw = await sharp(caps2Path)
      .extract({ left, top, width, height })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const px = raw.data;
    const isBgPx = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = px[idx];
        const g = px[idx + 1];
        const b = px[idx + 2];
        const diff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
        const avg = (r + g + b) / 3;

        if (bannerCutoffY && y >= bannerCutoffY) {
          isBgPx[y * width + x] = 1;
        } else if (diff <= 12 && avg >= 135 && avg <= 215) {
          isBgPx[y * width + x] = 1;
        }
      }
    }

    // Flood fill from borders
    const vis = new Uint8Array(width * height);
    const q: [number, number][] = [];

    for (let x = 0; x < width; x++) {
      if (isBgPx[0 * width + x]) {
        q.push([x, 0]);
        vis[0 * width + x] = 1;
      }
      if (isBgPx[(height - 1) * width + x]) {
        q.push([x, height - 1]);
        vis[(height - 1) * width + x] = 1;
      }
    }
    for (let y = 0; y < height; y++) {
      if (isBgPx[y * width + 0]) {
        q.push([0, y]);
        vis[y * width + 0] = 1;
      }
      if (isBgPx[y * width + (width - 1)]) {
        q.push([width - 1, y]);
        vis[y * width + (width - 1)] = 1;
      }
    }

    let h = 0;
    while (h < q.length) {
      const [cx, cy] = q[h++];
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = ny * width + nx;
          if (!vis[nIdx] && isBgPx[nIdx]) {
            vis[nIdx] = 1;
            q.push([nx, ny]);
          }
        }
      }
    }

    for (let i = 0; i < width * height; i++) {
      if (vis[i]) {
        px[i * 4 + 3] = 0;
      }
    }

    return sharp(px, { raw: { width, height, channels: 4 } }).png({ quality: 95 });
  }

  // Front view
  const frontImg = await makeCutout(0, 0, imgW, topH);
  await frontImg.toFile(path.join(anglesDir, "front.png"));
  console.log("Saved transparent angles/front.png");

  // Left view (remove bottom text label completely)
  const leftImg = await makeCutout(0, topH, colW3, bottomH, bottomH - 82);
  await leftImg.toFile(path.join(anglesDir, "left.png"));
  console.log("Saved transparent angles/left.png");

  // Back view (remove bottom text label completely)
  const backImg = await makeCutout(colW3, topH, colW3, bottomH, bottomH - 82);
  await backImg.toFile(path.join(anglesDir, "back.png"));
  console.log("Saved transparent angles/back.png");

  // Right view (remove bottom text label completely)
  const rightW = imgW - colW3 * 2;
  const rightImg = await makeCutout(colW3 * 2, topH, rightW, bottomH, bottomH - 82);
  await rightImg.toFile(path.join(anglesDir, "right.png"));
  console.log("Saved transparent angles/right.png");

  console.log("All cap transparent cutouts successfully generated!");
}

main().catch(console.error);
