/**
 * Pure read-model overlay (ADR 0021): the product's `productImages` rows, with their
 * URLs already resolved, replace the legacy string fields that have a row. A field with
 * no row keeps its legacy value, so products not yet migrated render unchanged.
 */
import type { Doc } from "../../_generated/dataModel";

export type ResolvedImageRow = {
  role: Doc<"productImages">["role"];
  colorway?: string;
  angle?: Doc<"productImages">["angle"];
  order: number;
  url: string;
};

export type CapAngles = { front: string; left: string; back: string; right: string };

type OverlayInput = {
  catalogShot?: string;
  images?: string[];
  colorways?: { id: string; lifestyleImage: string; catalogShot: string }[];
};

const ANGLES = ["front", "left", "back", "right"] as const;

/** Returns the variant with table images laid over its legacy fields; `angles` only when all four exist. */
export function overlayProductImages<T extends OverlayInput>(variant: T, rows: ResolvedImageRow[]): T & { angles?: CapAngles } {
  const sorted = [...rows].sort((a, b) => a.order - b.order);
  const urls = (role: ResolvedImageRow["role"], colorway: string | undefined) =>
    sorted.filter((r) => r.role === role && r.colorway === colorway).map((r) => r.url);

  const result: T & { angles?: CapAngles } = { ...variant };

  const catalogShot = urls("catalog", undefined)[0];
  if (catalogShot !== undefined) result.catalogShot = catalogShot;

  const lifestyle = urls("lifestyle", undefined);
  if (lifestyle.length > 0) result.images = lifestyle;

  if (variant.colorways) {
    result.colorways = variant.colorways.map((c) => ({
      ...c,
      catalogShot: urls("catalog", c.id)[0] ?? c.catalogShot,
      lifestyleImage: urls("lifestyle", c.id)[0] ?? c.lifestyleImage,
    }));
  }

  const angleUrls = ANGLES.map((angle) => sorted.find((r) => r.role === "angle" && r.angle === angle)?.url);
  if (angleUrls.every((u): u is string => u !== undefined)) {
    const [front, left, back, right] = angleUrls;
    result.angles = { front, left, back, right };
  }
  return result;
}
