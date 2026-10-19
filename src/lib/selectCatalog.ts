import type { CapVariant } from "@/data/caps";

/**
 * Pick the catalog to render: the live Convex list once it has rows, otherwise the
 * list seeded by the server render. `isLive` is true only for a non-empty live list.
 */
export function selectCatalog(
  seed: CapVariant[],
  live: CapVariant[] | undefined
): { caps: CapVariant[]; isLive: boolean } {
  if (live && live.length > 0) return { caps: live, isLive: true };
  return { caps: seed, isLive: false };
}
