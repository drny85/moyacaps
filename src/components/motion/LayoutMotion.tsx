"use client";

import { LazyMotion } from "framer-motion";

const loadDomMax = () => import("./domMaxFeatures").then((mod) => mod.default);

/**
 * Adds Framer Motion's layout animation features (`layout`, `layoutId`) under this
 * subtree, loaded as a separate chunk after first paint (ADR 0018). Until it arrives
 * elements render in place without the layout transition.
 */
export function LayoutMotion({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={loadDomMax}>{children}</LazyMotion>;
}
