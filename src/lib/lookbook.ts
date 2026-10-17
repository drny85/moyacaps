/**
 * Turns lookbook hotspots into shoppable cards from the live catalog (pure, tested).
 * A hotspot whose product is missing or hidden is dropped, so a photo never links to
 * something that cannot be bought.
 */
import type { CapVariant } from "../data/caps";
import type { LookbookHotspot } from "../data/lookbook";

export interface ShoppableHotspot extends LookbookHotspot {
  product: CapVariant;
  /** Catalog Shot for the card: the photographed colorway when sold, else the default */
  image: string;
  href: string;
  /** The photo shows a colour the store sells (the link opens on it) */
  shownColorSold: boolean;
}

export function shoppableHotspots(hotspots: LookbookHotspot[], products: CapVariant[]): ShoppableHotspot[] {
  const out: ShoppableHotspot[] = [];
  for (const h of hotspots) {
    const product = products.find((p) => p.id === h.productId);
    if (!product || product.isAvailable === false) continue;
    const sold = h.colorway ? product.colorways?.find((c) => c.id === h.colorway) : undefined;
    const fallback = product.colorways?.find((c) => c.id === product.defaultColorway) ?? product.colorways?.[0];
    const cw = sold ?? fallback;
    out.push({
      ...h,
      product,
      image: cw?.catalogShot ?? product.catalogShot ?? product.image,
      href: `/products/${product.id}${sold ? `?colorway=${sold.id}` : ""}`,
      shownColorSold: Boolean(sold),
    });
  }
  return out;
}

export interface SceneKeyframes {
  /** Scroll progress offsets, strictly increasing within [0, 1] */
  input: number[];
  /** Opacity at each offset */
  opacity: number[];
  /** Vertical shift (px) at each offset, for text sliding in and out */
  y: number[];
}

/**
 * Crossfade keyframes for scene `index` of `count` in a scroll-pinned story. Each scene owns
 * an equal slice of progress with a short fade on each side; the first scene starts visible
 * and the last stays visible, and every offset stays inside [0, 1] (browser-native scroll
 * animations reject anything else).
 */
export function sceneKeyframes(index: number, count: number, slide = 60): SceneKeyframes {
  const span = 1 / count;
  const fade = span * 0.18;
  const start = index * span;
  const end = (index + 1) * span;
  const first = index === 0;
  const last = index === count - 1;
  if (count === 1) return { input: [0, 1], opacity: [1, 1], y: [0, 0] };
  if (first) return { input: [0, end - fade, end + fade], opacity: [1, 1, 0], y: [0, 0, -slide] };
  if (last) return { input: [start - fade, start + fade, 1], opacity: [0, 1, 1], y: [slide, 0, 0] };
  return {
    input: [start - fade, start + fade, end - fade, end + fade],
    opacity: [0, 1, 1, 0],
    y: [slide, 0, 0, -slide],
  };
}

/** Piecewise-linear value at progress `p` (clamped to the first/last keyframe). */
export function valueAt(p: number, input: number[], output: number[]): number {
  if (p <= input[0]) return output[0];
  for (let i = 1; i < input.length; i++) {
    if (p <= input[i]) {
      const t = (p - input[i - 1]) / (input[i] - input[i - 1]);
      return output[i - 1] + (output[i] - output[i - 1]) * t;
    }
  }
  return output[output.length - 1];
}

