/** Photo Autofill photos: at most four, shrunk in the browser before upload (ADR 0027). */

export const AUTOFILL_MAX_PHOTOS = 4;
/** Long side in px: the model gains no accuracy above it, and four photos stay far under the body limit. */
export const AUTOFILL_LONG_SIDE = 1568;
/** Re-encode at the next quality while a photo is over the upload cap. */
export const jpegQualities = [0.85, 0.7, 0.55] as const;
/** Per photo after downscaling; the server enforces the same cap. Four stay under the 4.5 MB body limit. */
export const AUTOFILL_MAX_UPLOAD_BYTES = 1024 * 1024;
/** Above this a file is a full-resolution photo worth decoding at reduced size. */
const LARGE_FILE_BYTES = 2 * 1024 * 1024;

export type PhotoCheck = { ok: true } | { ok: false; reason: "not_image" | "too_many" | "none" };

/** Some drag sources and Windows give HEIC and other photos no MIME type; fall back to the extension. */
const IMAGE_EXTENSION = /\.(?:jpe?g|png|webp|gif|heic|heif|avif|bmp|tiff?)$/i;

function isImage(file: { type: string; name?: string }): boolean {
  return file.type === "" ? IMAGE_EXTENSION.test(file.name ?? "") : file.type.startsWith("image/");
}

export function checkPhotos(files: { type: string; name?: string }[]): PhotoCheck {
  if (files.length === 0) return { ok: false, reason: "none" };
  if (files.length > AUTOFILL_MAX_PHOTOS) return { ok: false, reason: "too_many" };
  if (!files.every(isImage)) return { ok: false, reason: "not_image" };
  return { ok: true };
}

/**
 * A large file is decoded already shrunk, so a 48–100 MP photo never sits in memory at full
 * size; a small one is decoded as is so it is never upscaled. A portrait result is still
 * taller than the long side, which `fitWithin` then trims.
 */
export function decodeOptions(fileBytes: number): ImageBitmapOptions | undefined {
  return fileBytes > LARGE_FILE_BYTES ? { resizeWidth: AUTOFILL_LONG_SIDE, resizeQuality: "high" } : undefined;
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
  const options = decodeOptions(file.size);
  const bitmap = options ? await createImageBitmap(file, options) : await createImageBitmap(file);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, AUTOFILL_LONG_SIDE);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d canvas unavailable");
    paintForJpeg(ctx, bitmap, width, height);
    let blob = await canvas.convertToBlob({ type: "image/jpeg", quality: jpegQualities[0] });
    for (const quality of jpegQualities.slice(1)) {
      if (blob.size <= AUTOFILL_MAX_UPLOAD_BYTES) break;
      blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    }
    return blob;
  } finally {
    bitmap.close();
  }
}
