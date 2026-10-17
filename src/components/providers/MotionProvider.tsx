"use client";

import { MotionConfig } from "framer-motion";

/**
 * App-wide motion policy (ADR 0016): for visitors who prefer reduced motion, Framer Motion
 * skips transform and layout animations everywhere, including the first frame before
 * components know the preference (see useReducedMotionSafe).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
