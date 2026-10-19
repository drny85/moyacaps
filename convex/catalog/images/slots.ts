import type { CapAngle, ImageRole } from "./rules";

export type ImageSlot = { role: ImageRole; colorway?: string; angle?: CapAngle };

/**
 * Whether an image slot fits the product. `colorwayIds` is the product's colorway ids
 * (empty for headwear); only apparel with colorways takes a `colorway`, and only
 * headwear takes the `angle` role (which needs an `angle`).
 */
export function isValidSlot(slot: ImageSlot, colorwayIds: readonly string[]): boolean {
  const hasColorways = colorwayIds.length > 0;
  if (slot.colorway !== undefined && !colorwayIds.includes(slot.colorway)) return false;
  if (slot.role === "angle") return !hasColorways && slot.angle !== undefined && slot.colorway === undefined;
  return slot.angle === undefined;
}

export function sameSlot(a: ImageSlot, b: ImageSlot): boolean {
  return a.role === b.role && a.colorway === b.colorway && a.angle === b.angle;
}
