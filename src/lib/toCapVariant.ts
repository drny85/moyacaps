import type { Doc } from "@convex/_generated/dataModel";
import type { ApparelColorwayOption, CapVariant } from "@/data/caps";
import { nonBlank } from "./productCopy";

/** A Convex variant row (image already resolved by the query) in the client `CapVariant` shape. */
type ResolvedColorway = NonNullable<Doc<"variants">["colorways"]>[number] & { lifestyleImages?: string[] };

export function toCapVariant(
  v: Omit<Doc<"variants">, "colorways"> & { angles?: CapVariant["angles"]; colorways?: ResolvedColorway[] }
): CapVariant {
  return {
    id: v.variantId,
    nameEn: v.nameEn,
    nameEs: v.nameEs,
    silhouette: v.silhouette || (v.category === "apparel" ? "tee" : "snapback"),
    category: v.category || (v.silhouette === "tee" ? "apparel" : "headwear"),
    primaryHex: v.primaryHex,
    secondaryHex: v.secondaryHex,
    image: v.image,
    images: v.images,
    catalogShot: v.catalogShot,
    angles: v.angles,
    graphicImage: v.graphicImage,
    printPosition: v.printPosition,
    stock: v.stock,
    priceUsd: v.priceUsd,
    isFeatured: v.isFeatured,
    isAvailable: v.isAvailable !== false,
    tagEn: nonBlank(v.badgeTextEn),
    tagEs: nonBlank(v.badgeTextEs),
    descriptionEn: v.descriptionEn,
    descriptionEs: v.descriptionEs,
    isDrop: v.isDrop,
    dropDate: v.dropDate,
    dropBadgeTextEn: v.dropBadgeTextEn,
    dropBadgeTextEs: v.dropBadgeTextEs,
    dropStatus: v.dropStatus,
    createdAt: v._creationTime,
    fabricEn: v.fabricEn,
    fabricEs: v.fabricEs,
    fitEn: v.fitEn,
    fitEs: v.fitEs,
    defaultColorway: v.defaultColorway as CapVariant["defaultColorway"],
    sizes: v.sizes,
    colorways: v.colorways?.map((c) => ({
      id: c.id as ApparelColorwayOption["id"],
      nameEn: c.nameEn,
      nameEs: c.nameEs,
      hex: c.hex,
      borderHex: c.borderHex,
      modelImage: c.lifestyleImage,
      modelImages: c.lifestyleImages ?? (c.lifestyleImage ? [c.lifestyleImage] : []),
      catalogShot: c.catalogShot,
    })),
  };
}
