/**
 * Pure pixel model of screen-print ink, for artwork drawn on a white background
 * (no image I/O here; ink.ts feeds it pixels).
 *
 * Two kinds of artwork print differently on dark fabric:
 *  - Line art (black linework, flat colour): "knockout" leaves the black out, "invert" prints it
 *    off-white. Whiteness becomes transparency, so distressing shows the shirt.
 *  - Photographic art (halftone portraits, photo collages): "underbase" prints every tone in
 *    full colour on a white underbase. Only the paper around the artwork is dropped; whites
 *    inside the picture are printed white, and ink darker than the shirt is left out.
 *
 * Why not whiteness → transparency for photos: a photo's light tones are image, not paper.
 * Making them see-through lets the dark shirt swallow every midtone, and inverting its
 * shadows turns the picture into a grey negative.
 */

export type InkMode = "knockout" | "invert" | "underbase";
export type Rgba = [number, number, number, number];

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Line art ink: whiteness becomes transparency; near-black is knocked out or inverted on dark fabric. */
export function lineArtInk(r: number, g: number, b: number, darkFabric: boolean, mode: "knockout" | "invert"): Rgba {
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  // Whiteness → transparency, with a soft ramp so edges stay anti-aliased
  let alpha = clamp((255 - min) * 2.2 - 40, 0, 255);
  if (darkFabric) {
    // Neutral darkness 0 (mid grey) … 1 (black)
    const darkness = max - min < 48 ? clamp((130 - max) / 90, 0, 1) : 0;
    if (mode === "invert") {
      const v = Math.round(236 * darkness + max * (1 - darkness));
      r = Math.round(r + (v - r) * darkness);
      g = Math.round(g + (v - g) * darkness);
      b = Math.round(b + (v - b) * darkness);
    } else {
      alpha = Math.round(alpha * (1 - darkness));
    }
  }
  return [r, g, b, alpha];
}

/** Paper tone: how close a pixel is to the bare white background (0 ink … 1 paper). */
export function paperTone(r: number, g: number, b: number) {
  const min = Math.min(r, g, b);
  const chroma = Math.max(r, g, b) - min;
  return smoothstep(200, 242, min) * (1 - smoothstep(16, 40, chroma));
}

/** Pixels at or above this paper tone count as bare paper when tracing the background */
const PAPER_SOLID = 0.9;
/** Ink with every channel at or below this is darker than washed-black cotton: the shirt shows instead */
const DARK_INK = { from: 24, to: 64 };

export interface PaperMaskOptions {
  /** White areas enclosed by the artwork and smaller than this (px) are image (highlights, sequins) and print white. Default: 0.02% of the artwork */
  minEnclosedArea?: number;
  /** Soft fringe (px) around the paper, so anti-aliased edges fade instead of printing a white halo. Default: 0.2% of the short side */
  fringe?: number;
}

/** Grows a mask by r px (square window), via a summed-area table */
function dilate(mask: Uint8Array, width: number, height: number, r: number) {
  const W = width + 1;
  const sat = new Int32Array(W * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += mask[y * width + x];
      sat[(y + 1) * W + x + 1] = sat[y * W + x + 1] + row;
    }
  }
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(height, y + r + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(width, x + r + 1);
      out[y * width + x] = sat[y1 * W + x1] - sat[y0 * W + x1] - sat[y1 * W + x0] + sat[y0 * W + x0] > 0 ? 1 : 0;
    }
  }
  return out;
}

/**
 * Solid paper regions (4-connected) that are background: they touch the artwork's border, or
 * they are at least minArea px (letter counters, gaps between elements).
 */
function backgroundRegions(solid: Uint8Array, width: number, height: number, minArea: number) {
  const n = width * height;
  const out = new Uint8Array(n);
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  const region = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (!solid[s] || seen[s]) continue;
    let top = 0;
    let size = 0;
    let border = false;
    seen[s] = 1;
    stack[top++] = s;
    while (top > 0) {
      const i = stack[--top];
      region[size++] = i;
      const x = i % width;
      const y = (i - x) / width;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) border = true;
      if (x > 0 && solid[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; stack[top++] = i - 1; }
      if (x < width - 1 && solid[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; stack[top++] = i + 1; }
      if (y > 0 && solid[i - width] && !seen[i - width]) { seen[i - width] = 1; stack[top++] = i - width; }
      if (y < height - 1 && solid[i + width] && !seen[i + width]) { seen[i + width] = 1; stack[top++] = i + width; }
    }
    if (border || size >= minArea) for (let k = 0; k < size; k++) out[region[k]] = 1;
  }
  return out;
}

/**
 * Where the artwork is bare paper (1) rather than image (0), for photographic art.
 * Paper is the white background around the artwork plus any sizeable white area inside it,
 * such as letter counters. Small whites inside the picture (sequins, catchlights, highlights)
 * are image and stay ink.
 */
export function paperMask(rgb: Uint8Array, width: number, height: number, opts: PaperMaskOptions = {}) {
  const n = width * height;
  const minEnclosedArea = opts.minEnclosedArea ?? Math.max(4, Math.round(n * 0.0002));
  const fringe = opts.fringe ?? Math.max(1, Math.round(Math.min(width, height) * 0.002));

  const tone = new Float32Array(n);
  const solid = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 3) {
    tone[i] = paperTone(rgb[j], rgb[j + 1], rgb[j + 2]);
    solid[i] = tone[i] >= PAPER_SOLID ? 1 : 0;
  }

  const zone = dilate(backgroundRegions(solid, width, height, minEnclosedArea), width, height, fringe);
  const mask = new Float32Array(n);
  for (let i = 0; i < n; i++) mask[i] = zone[i] ? tone[i] : 0;
  return mask;
}

/**
 * Photographic ink on a white underbase: the artwork's own colour wherever it is not paper.
 * On dark fabric, ink darker than the cotton is left out so the shirt (and its texture) shows.
 */
export function underbaseInk(r: number, g: number, b: number, paper: number, darkFabric: boolean): Rgba {
  let alpha = 1 - paper;
  if (darkFabric) alpha *= smoothstep(DARK_INK.from, DARK_INK.to, Math.max(r, g, b));
  return [r, g, b, Math.round(alpha * 255)];
}
