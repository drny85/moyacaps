import { ALL_CAPS_MANIFEST_MAP, type CapAngleKey } from "@/data/capsManifest";

/** Turntable order: dragging right reveals the left flank first */
export const TURNTABLE_ANGLES: readonly CapAngleKey[] = ["front", "left", "back", "right"];

/** Angle photos for a cap colorway, or null when the colorway has none (it then shows its single photo). */
export function getCapAngleImages(capId: string): Record<CapAngleKey, string> | null {
  const item = (ALL_CAPS_MANIFEST_MAP as Record<string, { angles: Record<CapAngleKey, string> }>)[capId];
  return item ? item.angles : null;
}
