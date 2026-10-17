"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { CAP_VARIANTS, type CapVariant } from "@/data/caps";
import { toCapVariant } from "@/lib/toCapVariant";
import catalogShots from "@/data/catalogShots.json";

type Shots = {
  caps: Record<string, { catalog: string }>;
  tees: Record<string, { colorways: Record<string, string> }>;
};

/**
 * The static catalog with the same Catalog Shots the live rows carry, so the first
 * render (server and client) shows the final images instead of swapping them in.
 */
const STATIC_CATALOG: CapVariant[] = CAP_VARIANTS.map((p) => {
  const shots = catalogShots as Shots;
  const teeShots = shots.tees[p.id]?.colorways;
  if (teeShots) {
    return {
      ...p,
      catalogShot: teeShots[p.defaultColorway ?? ""] ?? Object.values(teeShots)[0],
      colorways: p.colorways?.map((c) => ({ ...c, catalogShot: teeShots[c.id] })),
    };
  }
  return { ...p, catalogShot: shots.caps[p.id]?.catalog };
});

/**
 * Live catalog variants from Convex, mapped to the client `CapVariant` shape.
 * Falls back to the static catalog until Convex responds (or when it is empty).
 */
export function useCapVariants(): { caps: CapVariant[]; isLive: boolean } {
  const convexVariants = useQuery(api.catalog.getVariants, {});

  return useMemo(() => {
    if (convexVariants && convexVariants.length > 0) {
      return {
        isLive: true,
        caps: convexVariants.map(toCapVariant),
      };
    }
    return { isLive: false, caps: STATIC_CATALOG };
  }, [convexVariants]);
}
