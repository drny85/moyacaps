import type { CapAngleKey } from "../data/capsManifest";
import type { CapVariant } from "../data/caps";

/** Turntable order: dragging right reveals the left flank first */
export const TURNTABLE_ANGLES: readonly CapAngleKey[] = ["front", "left", "back", "right"];

/**
 * Angle photos for a cap colorway (its `productImages` angle rows, ADR 0021), or null when it
 * has none: it then shows its single photo.
 */
export function getCapAngleImages(cap: CapVariant): Record<CapAngleKey, string> | null {
  return cap.angles ?? null;
}

/** The 4:5 Catalog Shot for a cap colorway, or null when it has none */
export function getCapCatalogShot(cap: CapVariant): string | null {
  return cap.catalogShot ?? null;
}

/**
 * The front angle used as the Try-On overlay (ADR 0019), or null when the cap has no angle
 * images: such a cap is left out of Try-On.
 */
export function getCapFrontOverlay(cap: CapVariant): string | null {
  return cap.angles?.front ?? null;
}
