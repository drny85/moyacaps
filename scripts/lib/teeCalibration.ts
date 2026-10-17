/**
 * Finds the tee on an on-model template photo and derives where a print belongs.
 * Pure functions over raw RGB buffers, so they can be unit-tested with synthetic images.
 */

export interface RawImage {
  data: Uint8Array | Buffer;
  width: number;
  height: number;
  /** 3 (RGB) or 4 (RGBA) */
  channels: number;
}

export interface TeeMeasure {
  /** First tee row under the collar, at the seed column */
  collarY: number;
  /** Last tee row (hem), at the seed column */
  hemY: number;
  /** Torso edges at the measuring row (below the sleeves) */
  torsoLeft: number;
  torsoRight: number;
  measureY: number;
}

export interface PrintBox {
  /** Centre x of the print */
  cx: number;
  /** Top edge of the print */
  top: number;
  /** Maximum print width and height; artwork is fitted inside, keeping its proportions */
  width: number;
  height: number;
}

const idx = (img: RawImage, x: number, y: number) => (y * img.width + x) * img.channels;

function colorAt(img: RawImage, x: number, y: number): [number, number, number] {
  const i = idx(img, x, y);
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Flood fill from a seed on the garment. A pixel joins when it is close to its neighbour
 * (`step`, follows soft shading and folds) and not too far from the seed colour (`range`,
 * stops at skin, background and trousers). Returns a 0/1 mask.
 */
export function floodFillMask(
  img: RawImage,
  seed: { x: number; y: number },
  opts: { step: number; range: number }
): Uint8Array {
  const { width, height } = img;
  const mask = new Uint8Array(width * height);
  // Seed colour: mean of a 9×9 patch so one noisy pixel does not decide it
  let sum = [0, 0, 0];
  let n = 0;
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const c = colorAt(img, seed.x + dx, seed.y + dy);
      sum = [sum[0] + c[0], sum[1] + c[1], sum[2] + c[2]];
      n++;
    }
  }
  const seedColor = sum.map((v) => v / n);

  const stack = [seed.y * width + seed.x];
  mask[seed.y * width + seed.x] = 1;
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % width;
    const y = (p - x) / width;
    const here = colorAt(img, x, y);
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const q = ny * width + nx;
      if (mask[q]) continue;
      const c = colorAt(img, nx, ny);
      if (dist(c, here) <= opts.step && dist(c, seedColor) <= opts.range) {
        mask[q] = 1;
        stack.push(q);
      }
    }
  }
  return mask;
}

/** Collar, hem and torso edges from a garment mask, measured around the seed column. */
export function measureTee(mask: Uint8Array, width: number, height: number, seedX: number): TeeMeasure {
  // Use a 21px column band so a stray hole (logo, fold shadow) does not break the scan
  const rowHasTee = (y: number) => {
    let hits = 0;
    for (let x = seedX - 10; x <= seedX + 10; x++) hits += mask[y * width + x] ? 1 : 0;
    return hits >= 11;
  };
  let collarY = 0;
  while (collarY < height && !rowHasTee(collarY)) collarY++;
  let hemY = height - 1;
  while (hemY > collarY && !rowHasTee(hemY)) hemY--;

  // Torso width: scan rows between 45% and 75% of the length (below the sleeves, above the
  // hands) and keep the median-width row: a patchy row (strong light, a fold shadow) cannot
  // shrink the print, and a row still catching long sleeves cannot widen it.
  const span = (y: number) => {
    let l = seedX;
    while (l > 0 && mask[y * width + l - 1]) l--;
    let r = seedX;
    while (r < width - 1 && mask[y * width + r + 1]) r++;
    return { y, l, r, w: mask[y * width + seedX] ? r - l : 0 };
  };
  const rows = [];
  for (let y = Math.round(collarY + (hemY - collarY) * 0.45); y <= Math.round(collarY + (hemY - collarY) * 0.75); y++) {
    rows.push(span(y));
  }
  rows.sort((a, b) => a.w - b.w);
  const pick = rows[Math.floor(rows.length / 2)] ?? span(Math.round((collarY + hemY) / 2));
  const measureY = pick.y;
  const torsoLeft = pick.l;
  const torsoRight = pick.r;
  return { collarY, hemY, torsoLeft, torsoRight, measureY };
}

/**
 * Where a print sits on that tee: centred on the torso (which also follows a 3/4-turned
 * body), a fixed share of the torso width, a set distance under the collar. Back prints
 * are larger and start higher, as on the real garments.
 */
export function printBoxFor(m: TeeMeasure, side: "front" | "back"): PrintBox {
  const torsoWidth = m.torsoRight - m.torsoLeft;
  const torsoLength = m.hemY - m.collarY;
  // Calibrated against the real shoot photos (eagle-clover back, angel-clover front):
  // oversized streetwear prints span most of the torso width.
  const share = side === "back" ? { width: 1.0, top: 0.06, height: 0.74 } : { width: 0.95, top: 0.09, height: 0.68 };
  return {
    cx: Math.round((m.torsoLeft + m.torsoRight) / 2),
    top: Math.round(m.collarY + torsoLength * share.top),
    width: Math.round(torsoWidth * share.width),
    height: Math.round(torsoLength * share.height),
  };
}
