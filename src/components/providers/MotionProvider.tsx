"use client";

import { LazyMotion, MotionConfig } from "framer-motion";

const loadDomAnimation = () => import("@/components/motion/domAnimationFeatures").then((mod) => mod.default);

/**
 * App-wide motion policy (ADR 0016): for visitors who prefer reduced motion, Framer Motion
 * skips transform and layout animations everywhere, including the first frame before
 * components know the preference (see useReducedMotionSafe).
 *
 * Bundle (ADR 0018): components use the lightweight `m` component; its animation features
 * (`domAnimation`: animate, exit, hover/tap/focus, in-view) arrive as a separate chunk
 * after first paint. Server HTML already carries each element's initial styles, so first
 * paint is unchanged; animations start once the chunk lands. `strict` makes a stray full
 * `motion` component throw in development. Routes that need layout animations load
 * `domMax` themselves (see LayoutMotion).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadDomAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
