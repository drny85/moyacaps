/** Photo Autofill photos: at most four, shrunk in the browser before upload (ADR 0027). */

export const AUTOFILL_MAX_PHOTOS = 4;
/** Long side in px: the model gains no accuracy above it, and four photos stay far under the body limit. */
export const AUTOFILL_LONG_SIDE = 1568;
export const AUTOFILL_JPEG_QUALITY = 0.85;

export type PhotoCheck = { ok: true } | { ok: false; reason: "not_image" | "too_many" | "none" };

export function checkPhotos(files: { type: string }[]): PhotoCheck {
  if (files.length === 0) return { ok: false, reason: "none" };
  if (files.length > AUTOFILL_MAX_PHOTOS) return { ok: false, reason: "too_many" };
  if (files.some((f) => !f.type.startsWith("image/"))) return { ok: false, reason: "not_image" };
  return { ok: true };
}

/** Scale (w, h) so the long side is at most `longSide`, keeping the aspect ratio; never upscales. */
export function fitWithin(w: number, h: number, longSide: number): { width: number; height: number } {
  const scale = Math.min(1, longSide / Math.max(w, h));
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

type PaintTarget = Pick<CanvasRenderingContext2D, "fillRect"> & {
  fillStyle: string | CanvasGradient | CanvasPattern;
  drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
};

/** JPEG has no alpha: paint white first so a transparent product cutout keeps its colors. */
export function paintForJpeg(ctx: PaintTarget, image: CanvasImageSource, width: number, height: number): void {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
}

/** Browser only: decode, shrink and re-encode one photo as JPEG. Rejects when the browser cannot decode it. */
export async function downscalePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, AUTOFILL_LONG_SIDE);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d canvas unavailable");
    paintForJpeg(ctx, bitmap, width, height);
    return await canvas.convertToBlob({ type: "image/jpeg", quality: AUTOFILL_JPEG_QUALITY });
  } finally {
    bitmap.close();
  }
}
