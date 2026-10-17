import { ALL_CAPS_MANIFEST_MAP, type CapAngleKey } from "@/data/capsManifest";
import catalogShots from "@/data/catalogShots.json";

/** Turntable order: dragging right reveals the left flank first */
export const TURNTABLE_ANGLES: readonly CapAngleKey[] = ["front", "left", "back", "right"];

type CapShots = Record<string, { catalog: string; angles?: Record<CapAngleKey, string> }>;

/**
 * Angle photos for a cap colorway, or null when the colorway has none (it then shows its single photo).
 * Prefers the scale-normalized angles from `bun run build-catalog-shots`, falling back to the raw processed photos.
 */
export function getCapAngleImages(capId: string): Record<CapAngleKey, string> | null {
  const normalized = (catalogShots.caps as CapShots)[capId]?.angles;
  if (normalized) return normalized;
  const item = (ALL_CAPS_MANIFEST_MAP as Record<string, { angles: Record<CapAngleKey, string> }>)[capId];
  return item ? item.angles : null;
}

/** The 4:5 Catalog Shot for a cap colorway, if one has been built */
export function getCapCatalogShot(capId: string): string | null {
  return (catalogShots.caps as CapShots)[capId]?.catalog ?? null;
}
