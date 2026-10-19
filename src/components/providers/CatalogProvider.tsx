"use client";

import { createContext, useContext } from "react";
import type { CapVariant } from "@/data/caps";
import { ALL_LIVE, type CategoryLaunches } from "@/lib/launch";

const CatalogSeedContext = createContext<CapVariant[]>([]);
const LaunchSeedContext = createContext<CategoryLaunches>(ALL_LIVE);

/** Carries the catalog and Category Status fetched on the server so the first render has real data. */
export function CatalogProvider({
  seed,
  launchSeed = ALL_LIVE,
  children,
}: {
  seed: CapVariant[];
  launchSeed?: CategoryLaunches;
  children: React.ReactNode;
}) {
  return (
    <CatalogSeedContext.Provider value={seed}>
      <LaunchSeedContext.Provider value={launchSeed}>{children}</LaunchSeedContext.Provider>
    </CatalogSeedContext.Provider>
  );
}

export function useCatalogSeed(): CapVariant[] {
  return useContext(CatalogSeedContext);
}

export function useLaunchSeed(): CategoryLaunches {
  return useContext(LaunchSeedContext);
}
