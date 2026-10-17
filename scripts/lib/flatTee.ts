/**
 * Flat-lay Heavyweight Tee renderer for Catalog Shots.
 *
 * Interim: no flat-lay garment photos exist yet (only on-model shots), so the garment
 * is drawn as a boxy drop-shoulder silhouette with fabric shading and the real Graphic
 * Design artwork is printed onto it. When the blank flat-lay photos described in
 * docs/photography-spec.md land in public/shirts/flatlay/, they replace the drawing
 * and the same print box is used (the spec frames the photos to this geometry).
 */
import sharp from "sharp";

export type FabricId = "washed-black" | "crisp-white" | "heather-grey" | "butter-cream";
export type PrintSide = "front" | "back";
/**
 * How black linework prints on dark fabric:
 *  - "knockout": black ink is left out, the fabric shows through (fine detail, hatching)
 *  - "invert":   black ink is printed off-white (wordmarks and outlines that must stay legible)
 */
export type DarkInkMode = "knockout" | "invert";

/** Photographic fabric tones (the UI swatch hexes are brighter than real cotton) */
const FABRIC: Record<FabricId, { base: string; shade: string; light: string; dark: boolean; heather: number }> = {
  "washed-black": { base: "#2b2b2d", shade: "#18181a", light: "#38383b", dark: true, heather: 0.07 },
  "crisp-white": { base: "#f7f7f4", shade: "#dcdcd6", light: "#ffffff", dark: false, heather: 0.06 },
  "heather-grey": { base: "#a6a7aa", shade: "#88898c", light: "#b9babd", dark: false, heather: 0.3 },
  "butter-cream": { base: "#efe4c4", shade: "#d6caa6", light: "#f7eed4", dark: false, heather: 0.08 },
};

/** Tee in a 1000×1000 box: boxy body, dropped shoulders, short wide sleeves */
const BODY =
  "M 352 118 C 330 120 300 126 190 166 C 150 230 80 310 30 368 L 150 452 L 212 394 C 214 560 210 760 206 930 C 400 950 600 950 794 930 C 790 760 786 560 788 394 L 850 452 L 970 368 C 920 310 850 230 810 166 C 700 126 670 120 648 118 Z";
const NECK: Record<PrintSide, string> = {
  front: "M 352 118 C 396 200 604 200 648 118",
  back: "M 352 118 C 410 148 590 148 648 118",
};
/** Inside of the back collar, visible through the front neckline */
const NECK_INNER = "M 352 118 C 400 146 600 146 648 118 C 604 190 396 190 352 118 Z";

/** Print box per side, in the 1000-unit box. Shared with the flat-lay photo spec. */
export const PRINT_BOX: Record<PrintSide, { cx: number; top: number; width: number; height: number }> = {
  front: { cx: 500, top: 236, width: 330, height: 410 },
  back: { cx: 500, top: 196, width: 410, height: 540 },
};

/** Flat fabric colour with side-to-side body curvature */
function baseSvg(size: number, fabric: FabricId) {
  const f = FABRIC[fabric];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1000 1000">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${f.shade}"/>
      <stop offset="0.22" stop-color="${f.base}"/>
      <stop offset="0.5" stop-color="${f.light}"/>
      <stop offset="0.78" stop-color="${f.base}"/>
      <stop offset="1" stop-color="${f.shade}"/>
    </linearGradient>
  </defs>
  <path d="${BODY}" fill="url(#g)"/>
</svg>`;
}

/** Texture, drape, folds, seams and collar: laid over the ink so the print sits in the cotton */
function overlaySvg(size: number, fabric: FabricId, side: PrintSide) {
  const f = FABRIC[fabric];
  const hi = f.dark ? 0.05 : 0.35;
  const lo = f.dark ? 0.35 : 0.1;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1000 1000">
  <defs>
    <filter id="cotton" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="11"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0.9 -0.9 0 0 0"/>
      <feComponentTransfer><feFuncA type="linear" slope="${f.heather}"/></feComponentTransfer>
    </filter>
    <filter id="soft"><feGaussianBlur stdDeviation="22"/></filter>
    <filter id="softer"><feGaussianBlur stdDeviation="40"/></filter>
    <linearGradient id="drape" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="${hi * 0.5}"/>
      <stop offset="0.35" stop-color="#fff" stop-opacity="0"/>
      <stop offset="0.8" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="${lo * 0.6}"/>
    </linearGradient>
    <clipPath id="clip"><path d="${BODY}"/></clipPath>
  </defs>
  <g clip-path="url(#clip)">
    <rect width="1000" height="1000" filter="url(#cotton)"/>
    <rect width="1000" height="1000" fill="url(#drape)"/>
    <!-- broad soft folds: light ridge beside a shadow trough -->
    <g filter="url(#softer)">
      <path d="M 300 470 C 320 640 296 790 322 940" stroke="#000" stroke-opacity="${lo * 0.5}" stroke-width="60" fill="none"/>
      <path d="M 352 470 C 372 640 348 790 374 940" stroke="#fff" stroke-opacity="${hi * 0.6}" stroke-width="50" fill="none"/>
      <path d="M 700 450 C 676 620 708 780 680 940" stroke="#000" stroke-opacity="${lo * 0.45}" stroke-width="60" fill="none"/>
      <path d="M 646 450 C 622 620 654 780 626 940" stroke="#fff" stroke-opacity="${hi * 0.5}" stroke-width="50" fill="none"/>
    </g>
    <!-- underarm and sleeve shading -->
    <g filter="url(#soft)">
      <path d="M 212 394 L 150 452" stroke="#000" stroke-opacity="${lo}" stroke-width="40"/>
      <path d="M 788 394 L 850 452" stroke="#000" stroke-opacity="${lo}" stroke-width="40"/>
      <path d="M 200 200 L 222 400" stroke="#000" stroke-opacity="${lo * 0.6}" stroke-width="30"/>
      <path d="M 800 200 L 778 400" stroke="#000" stroke-opacity="${lo * 0.6}" stroke-width="30"/>
    </g>
    <!-- seams and hems -->
    <path d="M 212 394 C 208 320 198 240 190 166" stroke="#000" stroke-opacity="0.16" stroke-width="2.5" fill="none"/>
    <path d="M 788 394 C 792 320 802 240 810 166" stroke="#000" stroke-opacity="0.16" stroke-width="2.5" fill="none"/>
    <path d="M 207 914 C 400 934 600 934 793 914" stroke="#000" stroke-opacity="0.14" stroke-width="2.5" fill="none"/>
    <path d="M 46 382 L 156 438" stroke="#000" stroke-opacity="0.14" stroke-width="2.5" fill="none"/>
    <path d="M 954 382 L 844 438" stroke="#000" stroke-opacity="0.14" stroke-width="2.5" fill="none"/>
  </g>
  ${side === "front" ? `<path d="${NECK_INNER}" fill="${f.shade}"/><path d="${NECK_INNER}" fill="#000" fill-opacity="${f.dark ? 0.3 : 0.12}"/>` : ""}
  <path d="${NECK[side]}" stroke="${f.dark ? "#202022" : f.shade}" stroke-width="24" fill="none" stroke-linecap="round"/>
  <path d="${NECK[side]}" stroke="#000" stroke-opacity="0.2" stroke-width="2" fill="none" transform="translate(0 12)"/>
  <path d="${NECK[side]}" stroke="#fff" stroke-opacity="${hi * 0.5}" stroke-width="2" fill="none" transform="translate(0 -8)"/>
</svg>`;
}

/**
 * Turns artwork on a white background into an ink layer: white becomes transparent.
 * On dark fabric, near-black ink is knocked out or printed off-white (see DarkInkMode).
 */
async function inkLayer(artPath: string, width: number, height: number, darkFabric: boolean, darkInk: DarkInkMode) {
  const { data, info } = await sharp(artPath)
    .resize({ width, height, fit: "inside", kernel: "lanczos3" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];
    const min = Math.min(r, g, b), max = Math.max(r, g, b);
    // Whiteness → transparency, with a soft ramp so edges stay anti-aliased
    let alpha = Math.max(0, Math.min(255, (255 - min) * 2.2 - 40));
    if (darkFabric) {
      // Neutral darkness 0 (mid grey) … 1 (black)
      const darkness = max - min < 48 ? Math.max(0, Math.min(1, (130 - max) / 90)) : 0;
      if (darkInk === "invert") {
        const v = Math.round(236 * darkness + max * (1 - darkness));
        r = Math.round(r + (v - r) * darkness);
        g = Math.round(g + (v - g) * darkness);
        b = Math.round(b + (v - b) * darkness);
      } else {
        alpha = Math.round(alpha * (1 - darkness));
      }
    }
    out[j] = r; out[j + 1] = g; out[j + 2] = b;
    out[j + 3] = alpha;
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer({ resolveWithObject: true });
}

/** Printed tee as a transparent square PNG of `size` px. `blankPhoto` swaps the drawing for a real flat-lay. */
export async function renderFlatTee(opts: {
  size: number;
  fabric: FabricId;
  side: PrintSide;
  artPath: string;
  darkInk?: DarkInkMode;
  blankPhoto?: string;
}) {
  const { size, fabric, side, artPath, darkInk = "invert", blankPhoto } = opts;
  const unit = size / 1000;
  const box = PRINT_BOX[side];
  const dark = FABRIC[fabric].dark;
  const ink = await inkLayer(artPath, Math.round(box.width * unit), Math.round(box.height * unit), dark, darkInk);
  const inkPlacement = {
    input: ink.data,
    left: Math.round(box.cx * unit - ink.info.width / 2),
    top: Math.round(box.top * unit),
    blend: dark ? ("over" as const) : ("multiply" as const),
  };

  if (blankPhoto) {
    // Real flat-lay: already framed to the 1000-unit geometry on a transparent background
    const base = await sharp(blankPhoto).resize(size, size, { fit: "fill" }).ensureAlpha().png().toBuffer();
    return sharp(base).composite([inkPlacement]).png().toBuffer();
  }

  const base = await sharp(Buffer.from(baseSvg(size, fabric))).png().toBuffer();
  const overlay = await sharp(Buffer.from(overlaySvg(size, fabric, side))).png().toBuffer();
  return sharp(base)
    .composite([inkPlacement, { input: overlay }])
    .png()
    .toBuffer();
}
