import { ALL_CAPS_MANIFEST_MAP, type CapAngleKey } from "../data/capsManifest";
import type { CapVariant } from "../data/caps";
import catalogShots from "../data/catalogShots.json";

/** Turntable order: dragging right reveals the left flank first */
export const TURNTABLE_ANGLES: readonly CapAngleKey[] = ["front", "left", "back", "right"];

type CapShots = Record<string, { catalog: string; angles?: Record<CapAngleKey, string> }>;

/**
 * Angle photos for a cap colorway, or null when the colorway has none (it then shows its single photo).
 * Prefers the uploaded angles (ADR 0021), then the scale-normalized ones from `bun run build-catalog-shots`,
 * falling back to the raw processed photos.
 */
export function getCapAngleImages(cap: CapVariant): Record<CapAngleKey, string> | null {
  if (cap.angles) return cap.angles;
  const normalized = (catalogShots.caps as CapShots)[cap.id]?.angles;
  if (normalized) return normalized;
  const item = (ALL_CAPS_MANIFEST_MAP as Record<string, { angles: Record<CapAngleKey, string> }>)[cap.id];
  return item ? item.angles : null;
}

/** The 4:5 Catalog Shot for a cap colorway: the uploaded one, else one built by the shots script, else null */
export function getCapCatalogShot(cap: CapVariant): string | null {
  return cap.catalogShot ?? (catalogShots.caps as CapShots)[cap.id]?.catalog ?? null;
}

/**
 * The front angle used as the Try-On overlay (ADR 0019): the uploaded one, else the scale-normalised one,
 * or null when the cap has neither: the raw photos have a different framing the fit math does not know.
 */
export function getCapFrontOverlay(cap: CapVariant): string | null {
  return cap.angles?.front ?? (catalogShots.caps as CapShots)[cap.id]?.angles?.front ?? null;
}
