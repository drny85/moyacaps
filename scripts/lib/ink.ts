/**
 * Screen-print ink from artwork drawn on a white background (shared by the flat-lay renderer
 * and the on-model compositor).
 */
import sharp from "sharp";

/**
 * How black linework prints on dark fabric:
 *  - "knockout": black ink is left out, the fabric shows through (fine detail, hatching)
 *  - "invert":   black ink is printed off-white (wordmarks and outlines that must stay legible)
 */
export type DarkInkMode = "knockout" | "invert";

/**
 * Turns artwork on a white background into an ink layer: white becomes transparent.
 * On dark fabric, near-black ink is knocked out or printed off-white (see DarkInkMode).
 */
export async function inkLayerRaw(artPath: string, width: number, height: number, darkFabric: boolean, darkInk: DarkInkMode) {
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
  return { data: out, info: { width: info.width, height: info.height } };
}

/** The same ink as a PNG, ready to composite with sharp. */
export async function inkLayer(artPath: string, width: number, height: number, darkFabric: boolean, darkInk: DarkInkMode) {
  const raw = await inkLayerRaw(artPath, width, height, darkFabric, darkInk);
  return sharp(raw.data, { raw: { ...raw.info, channels: 4 } }).png().toBuffer({ resolveWithObject: true });
}

