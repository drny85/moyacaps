import { PHASE_PRODUCTION_BUILD } from "next/constants";
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

/**
 * Only the production build may swallow a failed catalog fetch. At runtime the error must
 * propagate so ISR keeps serving the last good page instead of caching an empty seed.
 */
export function shouldSwallowSeedError(phase: string | undefined): boolean {
  return phase === PHASE_PRODUCTION_BUILD;
}
