import { categoryOf } from "./productForm";
import type { AdminProduct } from "./productSearch";
import { totalStock } from "./stockLevel";

/** Why a Product shows under "Needs attention" (D13). */
export type AttentionReason = "no_catalog_shot" | "colorway_missing_catalog_shot" | "angles_incomplete" | "visible_out_of_stock";

const present = (url: string | undefined) => url !== undefined && url.trim() !== "";

/** In this order; an archived Product needs nothing. */
export function attentionReasons(p: AdminProduct): AttentionReason[] {
  if (p.archivedAt !== undefined) return [];
  const reasons: AttentionReason[] = [];
  if (categoryOf(p) === "apparel") {
    const shots = (p.colorways ?? []).map((c) => present(c.catalogShot));
    if (!shots.some(Boolean)) reasons.push("no_catalog_shot");
    else if (!shots.every(Boolean)) reasons.push("colorway_missing_catalog_shot");
  } else {
    if (!present(p.catalogShot)) reasons.push("no_catalog_shot");
    if (p.angles === undefined) reasons.push("angles_incomplete");
  }
  if (p.isAvailable && totalStock(p) === 0) reasons.push("visible_out_of_stock");
  return reasons;
}
