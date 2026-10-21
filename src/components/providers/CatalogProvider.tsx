"use client";

import { createContext, useContext } from "react";
import type { CapVariant } from "@/data/caps";
import { ALL_LIVE, type CategoryLaunches } from "@/lib/launch";
import { DEFAULT_HOME_TILES, type HomeTiles } from "@convex/settings/homeTilesModel";

const CatalogSeedContext = createContext<CapVariant[]>([]);
const LaunchSeedContext = createContext<CategoryLaunches>(ALL_LIVE);
const HomeTilesSeedContext = createContext<HomeTiles>(DEFAULT_HOME_TILES);

/** Carries the catalog, Category Status and homepage tile picks fetched on the server so the first render has real data. */
export function CatalogProvider({
  seed,
  launchSeed = ALL_LIVE,
  homeTilesSeed = DEFAULT_HOME_TILES,
  children,
}: {
  seed: CapVariant[];
  launchSeed?: CategoryLaunches;
  homeTilesSeed?: HomeTiles;
  children: React.ReactNode;
}) {
  return (
    <CatalogSeedContext.Provider value={seed}>
      <LaunchSeedContext.Provider value={launchSeed}>
        <HomeTilesSeedContext.Provider value={homeTilesSeed}>{children}</HomeTilesSeedContext.Provider>
      </LaunchSeedContext.Provider>
    </CatalogSeedContext.Provider>
  );
}

export function useCatalogSeed(): CapVariant[] {
  return useContext(CatalogSeedContext);
}

export function useLaunchSeed(): CategoryLaunches {
  return useContext(LaunchSeedContext);
}

export function useHomeTilesSeed(): HomeTiles {
  return useContext(HomeTilesSeedContext);
}
