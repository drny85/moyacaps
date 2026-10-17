"use client";

import { m } from "framer-motion";
import { useReducedMotionSafe } from "@/hooks/useMotionPrefs";
import type { ReactNode } from "react";
import { DURATION, EASE } from "@/lib/motion";

/**
 * Rise-and-fade on first entry into the viewport.
 * Collapses to a plain fade when the visitor prefers reduced motion.
 */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotionSafe();

  return (
    <m.div
      initial={{ opacity: 0, y: reduceMotion ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: DURATION.base, delay, ease: EASE.out }}
      className={className}
    >
      {children}
    </m.div>
  );
}
