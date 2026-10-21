"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useHomeTilesSeed } from "@/components/providers/CatalogProvider";
import type { HomeTiles } from "@convex/settings/homeTilesModel";

/** The Product each homepage tile shows. Starts with the server's value and follows the live one. */
export function useHomeTiles(): HomeTiles {
  const seed = useHomeTilesSeed();
  return useQuery(api.settings.homeTiles.getHomeTiles, {}) ?? seed;
}
