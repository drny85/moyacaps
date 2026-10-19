import { PHASE_PRODUCTION_BUILD } from "next/constants";
import type { CapVariant } from "@/data/caps";

/**
 * Pick the catalog to render: the live Convex list once it has answered, otherwise the
 * list seeded by the server render. An empty live list is real: products are hidden or
 * their categories are not Live (ADR 0022), and a stale seed must not keep showing them.
 */
export function selectCatalog(
  seed: CapVariant[],
  live: CapVariant[] | undefined
): { caps: CapVariant[]; isLive: boolean } {
  if (live) return { caps: live, isLive: true };
  return { caps: seed, isLive: false };
}

/**
 * Only the production build may swallow a failed catalog fetch. At runtime the error must
 * propagate so ISR keeps serving the last good page instead of caching an empty seed.
 */
export function shouldSwallowSeedError(phase: string | undefined): boolean {
  return phase === PHASE_PRODUCTION_BUILD;
}
