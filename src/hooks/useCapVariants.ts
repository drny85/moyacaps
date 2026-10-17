"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { CAP_VARIANTS, type CapVariant } from "@/data/caps";

/**
 * Live catalog variants from Convex, mapped to the client `CapVariant` shape.
 * Falls back to the static catalog until Convex responds (or when it is empty).
 */
export function useCapVariants(): { caps: CapVariant[]; isLive: boolean } {
  const convexVariants = useQuery(api.products.getVariants, {});

  return useMemo(() => {
    if (convexVariants && convexVariants.length > 0) {
      return {
        isLive: true,
        caps: convexVariants.map((v) => ({
          id: v.variantId,
          nameEn: v.nameEn,
          nameEs: v.nameEs,
          silhouette: v.silhouette || (v.category === "apparel" ? "tee" : "snapback"),
          category: v.category || (v.silhouette === "tee" ? "apparel" : "headwear"),
          primaryHex: v.primaryHex,
          secondaryHex: v.secondaryHex,
          image: v.image,
          images: v.images,
          graphicImage: (v as any).graphicImage,
          printPosition: (v as any).printPosition,
          stock: v.stock,
          priceUsd: v.priceUsd,
          isFeatured: v.isFeatured,
          tagEn: v.isFeatured ? (v.silhouette === "tee" ? "Heavyweight Drop" : "Signature Edition") : undefined,
          tagEs: v.isFeatured ? (v.silhouette === "tee" ? "Drop Heavyweight" : "Edición Insignia") : undefined,
          isDrop: v.isDrop,
          dropDate: v.dropDate,
          dropBadgeTextEn: v.dropBadgeTextEn,
          dropBadgeTextEs: v.dropBadgeTextEs,
          dropStatus: v.dropStatus,
          fabricEn: (v as any).fabricEn,
          fabricEs: (v as any).fabricEs,
          fitEn: (v as any).fitEn,
          fitEs: (v as any).fitEs,
        })),
      };
    }
    return { isLive: false, caps: CAP_VARIANTS };
  }, [convexVariants]);
}
