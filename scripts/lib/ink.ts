/**
 * Screen-print ink from artwork drawn on a white background (shared by the flat-lay renderer
 * and the on-model compositor). The pixel model lives in inkModel.ts.
 */
import sharp from "sharp";
import { lineArtInk, paperMask, underbaseInk, type InkMode } from "./inkModel";

export type { InkMode } from "./inkModel";

/**
 * Turns artwork on a white background into an RGBA ink layer that fits inside width × height.
 *  - "knockout" / "invert" (line art): white becomes transparent; on dark fabric near-black
 *    ink is knocked out or printed off-white.
 *  - "underbase" (photographic art): full colour and tone; only the paper is dropped.
 */
export async function inkLayerRaw(artPath: string, width: number, height: number, darkFabric: boolean, mode: InkMode) {
  if (mode === "underbase") return underbaseLayerRaw(artPath, width, height, darkFabric);

  const { data, info } = await sharp(artPath)
    .resize({ width, height, fit: "inside", kernel: "lanczos3" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const [r, g, b, a] = lineArtInk(data[i], data[i + 1], data[i + 2], darkFabric, mode);
    out[j] = r; out[j + 1] = g; out[j + 2] = b; out[j + 3] = a;
  }
  return { data: out, info: { width: info.width, height: info.height } };
}

/** The paper is traced at the artwork's full resolution, where highlights and letter counters are distinct, then scaled down */
async function underbaseLayerRaw(artPath: string, width: number, height: number, darkFabric: boolean) {
  const art = await sharp(artPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = art.info;
  const paper = paperMask(art.data, w, h);
  const full = Buffer.alloc(w * h * 4);
  for (let p = 0, i = 0, j = 0; p < paper.length; p++, i += 3, j += 4) {
    const [r, g, b, a] = underbaseInk(art.data[i], art.data[i + 1], art.data[i + 2], paper[p], darkFabric);
    full[j] = r; full[j + 1] = g; full[j + 2] = b; full[j + 3] = a;
  }
  const { data, info } = await sharp(full, { raw: { width: w, height: h, channels: 4 } })
    .resize({ width, height, fit: "inside", kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, info: { width: info.width, height: info.height } };
}

/** The same ink as a PNG, ready to composite with sharp. */
export async function inkLayer(artPath: string, width: number, height: number, darkFabric: boolean, mode: InkMode) {
  const raw = await inkLayerRaw(artPath, width, height, darkFabric, mode);
  return sharp(raw.data, { raw: { ...raw.info, channels: 4 } }).png().toBuffer({ resolveWithObject: true });
}
