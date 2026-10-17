/**
 * Try-On Photo and share-card layout (ADR 0019), pure and tested. The photo is cropped
 * to a square and downscaled once on import; the card puts that square above a caption.
 */

/** Longest side of the Try-On Photo after import */
export const PHOTO_MAX = 1080;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The square to keep from a photo. Portrait photos keep more of the top, where the head
 * is; landscape photos are cropped at the centre.
 */
export function squareCrop(width: number, height: number): Rect {
  const side = Math.min(width, height);
  const x = (width - side) / 2;
  const y = height > width ? (height - side) * 0.25 : (height - side) / 2;
  return { x: Math.round(x), y: Math.round(y), width: side, height: side };
}

/** Output side for a cropped square: never upscaled, at most PHOTO_MAX */
export function outputSide(cropSide: number): number {
  return Math.max(1, Math.min(PHOTO_MAX, Math.round(cropSide)));
}

export interface CardLayout {
  width: number;
  height: number;
  photo: Rect;
  /** Baselines and left edge for the caption text */
  caption: { x: number; brandY: number; nameY: number; priceY: number; right: number };
}

/** The 4:5 share card: the square photo on top, brand, cap name and price below */
export function cardLayout(width = 1080): CardLayout {
  const height = Math.round(width * 1.25);
  const pad = Math.round(width * 0.06);
  return {
    width,
    height,
    photo: { x: 0, y: 0, width, height: width },
    caption: {
      x: pad,
      right: width - pad,
      brandY: width + Math.round(width * 0.075),
      nameY: width + Math.round(width * 0.15),
      priceY: width + Math.round(width * 0.15),
    },
  };
}

/** File name for a saved card */
export function cardFileName(capId: string): string {
  return `goodluck-try-on-${capId.replace(/[^a-z0-9-]/gi, "").toLowerCase() || "cap"}.jpg`;
}
