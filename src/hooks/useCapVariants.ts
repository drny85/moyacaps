"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { CAP_VARIANTS, type CapVariant } from "@/data/caps";
import { toCapVariant } from "@/lib/toCapVariant";

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
        caps: convexVariants.map(toCapVariant),
      };
    }
    return { isLive: false, caps: CAP_VARIANTS };
  }, [convexVariants]);
}
