/** The storefront's card aspect (width / height). */
const TARGET = 4 / 5;

export type Rect = { x: number; y: number; width: number; height: number };

/** The centred `aspect` (width / height) cover box of an image, in its natural pixels. Advice only: nothing is cropped. */
export function fitCropBox(width: number, height: number, aspect = TARGET): Rect {
  if (width / height > aspect) {
    const w = Math.round(height * aspect);
    return { x: Math.round((width - w) / 2), y: 0, width: w, height };
  }
  const h = Math.round(width / aspect);
  return { x: 0, y: Math.round((height - h) / 2), width, height: h };
}
