"use client";

import { useEffect, useState, type RefObject } from "react";
import { useScroll, useTransform, type MotionValue } from "framer-motion";
import { useReducedMotionSafe } from "@/hooks/useMotionPrefs";

/**
 * Vertical parallax for an element as its container crosses the viewport (ADR 0016 budget:
 * transform only, nothing under reduced motion). `distance` is the total travel in px: the
 * element moves from +distance/2 to -distance/2, so positive values drift up as you scroll.
 * It is 0 on the server and the first client render (no offset to jump at hydration),
 * then follows the scroll.
 */
export function useParallax(target: RefObject<HTMLElement | null>, distance: number): MotionValue<number> {
  const reduceMotion = useReducedMotionSafe();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { scrollYProgress } = useScroll({ target, offset: ["start end", "end start"] });
  const travel = mounted && !reduceMotion ? distance : 0;
  return useTransform(scrollYProgress, (p) => travel * (0.5 - p));
}
