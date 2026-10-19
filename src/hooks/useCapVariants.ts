"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { CapVariant } from "@/data/caps";
import { toCapVariant } from "@/lib/toCapVariant";
import { selectCatalog } from "@/lib/selectCatalog";
import { useCatalogSeed } from "@/components/providers/CatalogProvider";

/**
 * Catalog variants in the client `CapVariant` shape. Starts with the list the server
 * rendered (CatalogProvider) and switches to the live Convex list once it responds.
 */
export function useCapVariants(): { caps: CapVariant[]; isLive: boolean } {
  const seed = useCatalogSeed();
  const convexVariants = useQuery(api.catalog.queries.getVariants, {});

  return useMemo(
    () => selectCatalog(seed, convexVariants?.map(toCapVariant)),
    [seed, convexVariants]
  );
}
