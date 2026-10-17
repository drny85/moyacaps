/**
 * Pure helpers for photographed printed tees (a real garment shot flat, not a blank with
 * digitally printed artwork): separating the garment from the surface it was shot on and
 * framing it to the flat-lay guide (docs/photography-spec.md §2) so it sits at the same
 * scale as every other tee Catalog Shot. No I/O: callers pass raw pixel buffers.
 *
 * Masks are Uint8Array with one entry per pixel: 1 garment, 0 surface.
 */

export type PixelTest = (r: number, g: number, b: number) => boolean;

/**
 * Fabric test for the Acid Wash Lime colorway. The wash bleaches much of the fabric to a
 * near-grey, so saturation is useless; what holds everywhere on the garment is green at
 * least as strong as blue and red, and a lit surface. A black car hood fails on brightness,
 * its sky reflections and the hang tag fail on blue, and chrome reflections are neutral.
 */
export function isLimeFabric(r: number, g: number, b: number): boolean {
  return g >= 90 && g - b >= 10 && g >= r - 4;
}

/** 1 where `test` passes for the pixel */
export function colourMask(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  channels: number,
  test: PixelTest
): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    const o = i * channels;
    mask[i] = test(data[o], data[o + 1], data[o + 2]) ? 1 : 0;
  }
  return mask;
}

/** Square-kernel dilation (`grow`) or erosion of a mask, separable so it stays linear-ish */
function morph(mask: Uint8Array, width: number, height: number, radius: number, grow: boolean): Uint8Array {
  const hit = grow ? 1 : 0;
  const pass = (src: Uint8Array, horizontal: boolean) => {
    const out = new Uint8Array(src.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let v = grow ? 0 : 1;
        for (let d = -radius; d <= radius && v !== hit; d++) {
          const nx = horizontal ? x + d : x;
          const ny = horizontal ? y : y + d;
          // Outside the frame counts as surface for both operations
          const s = nx < 0 || ny < 0 || nx >= width || ny >= height ? 0 : src[ny * width + nx];
          if (s === hit) v = hit;
        }
        out[y * width + x] = v;
      }
    }
    return out;
  };
  return pass(pass(mask, true), false);
}

/** Morphological closing: bridges gaps narrower than ~2×radius (bleached wash spots, seams) */
export function closeMask(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius <= 0) return mask.slice();
  return morph(morph(mask, width, height, radius, true), width, height, radius, false);
}

/** Keeps only the largest 4-connected garment region; every other speck becomes surface */
export function keepLargest(mask: Uint8Array, width: number, height: number): Uint8Array {
  const label = new Int32Array(mask.length);
  let best = 0;
  let bestSize = 0;
  let next = 0;
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || label[start]) continue;
    next++;
    let size = 0;
    label[start] = next;
    stack.push(start);
    while (stack.length > 0) {
      const i = stack.pop()!;
      size++;
      const x = i % width;
      const neighbours = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width];
      for (const n of neighbours) {
        if (n >= 0 && n < mask.length && mask[n] && !label[n]) {
          label[n] = next;
          stack.push(n);
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = next;
    }
  }
  const out = new Uint8Array(mask.length);
  if (best > 0) for (let i = 0; i < mask.length; i++) out[i] = label[i] === best ? 1 : 0;
  return out;
}

/**
 * Fills every surface region the garment encloses (the print: red, blue, black ink), so only
 * surface reachable from the frame border stays surface.
 */
export function fillHoles(mask: Uint8Array, width: number, height: number): Uint8Array {
  const outside = new Uint8Array(mask.length);
  const stack: number[] = [];
  const seed = (i: number) => {
    if (!mask[i] && !outside[i]) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < width; x++) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    seed(y * width);
    seed(y * width + width - 1);
  }
  while (stack.length > 0) {
    const i = stack.pop()!;
    const x = i % width;
    if (x > 0) seed(i - 1);
    if (x < width - 1) seed(i + 1);
    if (i >= width) seed(i - width);
    if (i < width * (height - 1)) seed(i + width);
  }
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) out[i] = outside[i] ? 0 : 1;
  return out;
}

/**
 * The garment in a photo: pixels that look like its fabric, closed over small bleached
 * spots, reduced to the largest region (dropping reflections of the tee in the paint), with
 * the print filled in.
 */
export function garmentMask(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  channels: number,
  opts: { isFabric: PixelTest; closeRadius: number }
): Uint8Array {
  const fabric = colourMask(data, width, height, channels, opts.isFabric);
  const closed = closeMask(fabric, width, height, opts.closeRadius);
  return fillHoles(keepLargest(closed, width, height), width, height);
}

/** Bounding box of the garment pixels, or null when the mask is empty */
export function maskBounds(mask: Uint8Array, width: number) {
  let left = Infinity;
  let top = Infinity;
  let right = -1;
  let bottom = -1;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = i % width;
    const y = (i - x) / width;
    if (x < left) left = x;
    if (x > right) right = x;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
  }
  return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/**
 * Flat-lay guide (docs/photography-spec.md §2) as fractions of the square frame: collar top
 * at 11.8%, hem at 95%, sleeve tips at 3% and 97%.
 */
export const FLATLAY_GUIDE = { top: 0.118, bottom: 0.95, left: 0.03, right: 0.97 } as const;

/**
 * Where a trimmed garment of `width`×`height` goes inside a `size` square frame: scaled to
 * fit the guide box without distortion, centred in it, so its scale and centre match the
 * other tee flat-lays.
 */
export function fitToFlatLayGuide(width: number, height: number, size: number) {
  const boxW = (FLATLAY_GUIDE.right - FLATLAY_GUIDE.left) * size;
  const boxH = (FLATLAY_GUIDE.bottom - FLATLAY_GUIDE.top) * size;
  const scale = Math.min(boxW / width, boxH / height);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  return {
    width: w,
    height: h,
    left: Math.round(FLATLAY_GUIDE.left * size + (boxW - w) / 2),
    top: Math.round(FLATLAY_GUIDE.top * size + (boxH - h) / 2),
  };
}
