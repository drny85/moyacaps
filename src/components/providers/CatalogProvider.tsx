"use client";

import { createContext, useContext } from "react";
import type { CapVariant } from "@/data/caps";

const CatalogSeedContext = createContext<CapVariant[]>([]);

/** Carries the catalog fetched on the server so the first render has real data and images. */
export function CatalogProvider({
  seed,
  children,
}: {
  seed: CapVariant[];
  children: React.ReactNode;
}) {
  return <CatalogSeedContext.Provider value={seed}>{children}</CatalogSeedContext.Provider>;
}

export function useCatalogSeed(): CapVariant[] {
  return useContext(CatalogSeedContext);
}
