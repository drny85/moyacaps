/**
 * Turns an upload or a camera frame into the Try-On Photo (ADR 0019): a square of at most
 * 1080 px, held as an object URL in memory and never written to storage.
 */
import { outputSide, squareCrop } from "@/lib/tryOn/photo";

export interface TryOnPhoto {
  /** Object URL of the square JPEG; revoke it when the photo is replaced */
  url: string;
  /** The same pixels, for face detection without decoding the JPEG again */
  canvas: HTMLCanvasElement;
}

function toSquare(source: CanvasImageSource, width: number, height: number, mirror: boolean): Promise<TryOnPhoto> {
  const crop = squareCrop(width, height);
  const side = outputSide(crop.width);
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas is not available"));
  if (mirror) {
    // A front camera preview is mirrored; keep the photo as the Customer saw it
    ctx.translate(side, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, side, side);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve({ url: URL.createObjectURL(blob), canvas }) : reject(new Error("Could not encode the photo"))),
      "image/jpeg",
      0.9
    )
  );
}

/** From an uploaded file, honouring its EXIF orientation */
export async function photoFromFile(file: File): Promise<TryOnPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    return await toSquare(bitmap, bitmap.width, bitmap.height, false);
  } finally {
    bitmap.close();
  }
}

/** From the current frame of a (mirrored) front-camera preview */
export function photoFromVideo(video: HTMLVideoElement): Promise<TryOnPhoto> {
  return toSquare(video, video.videoWidth, video.videoHeight, true);
}
