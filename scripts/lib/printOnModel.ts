/**
 * Prints a Graphic Design onto a blank tee in an on-model template photo, so it reads as
 * screen-printed rather than pasted:
 *  - fitted and centred in the template's calibrated print box (see teeCalibration.ts);
 *  - warped slightly along the fabric's folds (displacement from the photo's own shading);
 *  - lit by the photo: the ink darkens in fold shadows and keeps the cotton's fine texture.
 */
import sharp from "sharp";
import { inkLayerRaw, type InkMode } from "./ink";
import type { PrintBox } from "./teeCalibration";

export interface PrintOnModelOptions {
  templatePath: string;
  artPath: string;
  box: PrintBox;
  darkFabric: boolean;
  /** How the artwork prints (see inkModel.ts): "underbase" for photographic art, "invert" for line art */
  ink?: InkMode;
  /** Max px the ink shifts across a fold (0 disables warping) */
  warp?: number;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

async function luminance(path: string, blur: number) {
  const pipeline = sharp(path).removeAlpha().greyscale();
  const { data, info } = await (blur > 0 ? pipeline.blur(blur) : pipeline).raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width };
}

/** JPEG of the template with the design printed on the tee. */
export async function printOnModel(opts: PrintOnModelOptions): Promise<Buffer> {
  const { templatePath, artPath, box, darkFabric, ink: inkMode = "invert", warp = 5 } = opts;

  const base = await sharp(templatePath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = base.info.width;
  const H = base.info.height;
  const shading = await luminance(templatePath, 7); // broad light and folds
  const detail = await luminance(templatePath, 0); // weave and fine wrinkles

  const ink = await inkLayerRaw(artPath, box.width, box.height, darkFabric, inkMode);
  const iw = ink.info.width;
  const ih = ink.info.height;
  const left = Math.round(box.cx - iw / 2);
  const top = box.top;

  // Reference brightness of the fabric under the print, so shading is relative to the shirt
  const samples: number[] = [];
  for (let y = 0; y < ih; y += 4) {
    for (let x = 0; x < iw; x += 4) {
      const gx = left + x;
      const gy = top + y;
      if (gx >= 0 && gy >= 0 && gx < W && gy < H) samples.push(shading.data[gy * W + gx]);
    }
  }
  samples.sort((a, b) => a - b);
  const ref = Math.max(1, samples[Math.floor(samples.length / 2)] ?? 128);
  // Dark cotton has little brightness range: lift both sides so folds still shade the ink
  const lift = darkFabric ? 24 : 0;

  const out = Buffer.from(base.data);
  const L = (x: number, y: number) => shading.data[clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)];

  for (let y = 0; y < ih; y++) {
    const gy = top + y;
    if (gy < 0 || gy >= H) continue;
    for (let x = 0; x < iw; x++) {
      const gx = left + x;
      if (gx < 0 || gx >= W) continue;

      // Folds bend the print: sample the ink a little against the shading gradient
      const dx = ((L(gx + 3, gy) - L(gx - 3, gy)) / 255) * warp * 2;
      const dy = ((L(gx, gy + 3) - L(gx, gy - 3)) / 255) * warp * 2;
      const sx = Math.round(clamp(x - dx, 0, iw - 1));
      const sy = Math.round(clamp(y - dy, 0, ih - 1));
      const ii = (sy * iw + sx) * 4;
      const a = (ink.data[ii + 3] / 255) * 0.95; // a hint of fabric shows through the ink
      if (a <= 0.01) continue;

      const shade = clamp((L(gx, gy) + lift) / (ref + lift), 0.55, 1.2);
      const texture = (detail.data[gy * W + gx] - L(gx, gy)) * 0.55;
      const oi = (gy * W + gx) * 3;
      for (let c = 0; c < 3; c++) {
        const inkC = clamp(ink.data[ii + c] * shade + texture, 0, 255);
        out[oi + c] = Math.round(inkC * a + base.data[oi + c] * (1 - a));
      }
    }
  }

  return sharp(out, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}
