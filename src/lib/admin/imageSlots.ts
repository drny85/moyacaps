import type { CapAngle, ImageRole } from "../../../convex/catalog/images/rules";
import type { Category } from "../../../convex/catalog/rules";

/** What the image manager shows (D8): Catalog and Lifestyle Shots per colorway, and a Cap's Angle Shots. */

export const CAP_ANGLES: readonly CapAngle[] = ["front", "left", "back", "right"];

type ImageLike = { _id: string; role: ImageRole; colorway?: string; angle?: CapAngle; order: number };

export type ImageGroup<T> = { colorway?: string; catalog?: T; lifestyle: T[]; missingCatalog: boolean };

export type ImageSlotsVM<T> = {
  /** One per Apparel Colorway for a tee; a single group without colorway for a Cap. */
  groups: ImageGroup<T>[];
  /** A Cap's four Angle Shot slots; empty for a tee. */
  angles: { angle: CapAngle; image?: T }[];
  anglesComplete: boolean;
};

export function buildImageSlots<T extends ImageLike>(category: Category, colorwayIds: string[], images: T[]): ImageSlotsVM<T> {
  const sorted = [...images].sort((a, b) => a.order - b.order);
  const group = (colorway: string | undefined): ImageGroup<T> => {
    const mine = sorted.filter((i) => i.colorway === colorway);
    const catalog = mine.find((i) => i.role === "catalog");
    return { colorway, catalog, lifestyle: mine.filter((i) => i.role === "lifestyle"), missingCatalog: catalog === undefined };
  };
  const isTee = category === "apparel" && colorwayIds.length > 0;
  const angles = isTee ? [] : CAP_ANGLES.map((angle) => ({ angle, image: sorted.find((i) => i.role === "angle" && i.angle === angle) }));
  return {
    groups: isTee ? colorwayIds.map(group) : [group(undefined)],
    angles,
    anglesComplete: angles.length > 0 && angles.every((a) => a.image !== undefined),
  };
}

/** Move the item at `from` to `to`; out-of-range indexes return an unchanged copy. */
export function moveImage<T>(ids: readonly T[], from: number, to: number): T[] {
  const next = [...ids];
  if (from < 0 || from >= ids.length || to < 0 || to >= ids.length) return next;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
