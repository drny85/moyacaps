"use client";

import { useEffect, useState } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const FINE_POINTER = "(hover: hover) and (pointer: fine)";
const DESKTOP = "(min-width: 1024px)";

/**
 * A media query result that is `false` on the server and on the first client render, then
 * follows the real value. Using framer's `useReducedMotion` directly renders different
 * initial styles on server and client for reduced-motion visitors and breaks hydration.
 */
function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/**
 * Hydration-safe reduced-motion preference. Before mount it is `false`; transform
 * animations that run in that first frame are still skipped for these visitors by the
 * app-wide `<MotionConfig reducedMotion="user">` (see MotionProvider).
 */
export function useReducedMotionSafe(): boolean {
  return useMedia(REDUCED_MOTION);
}

/**
 * Motion budget gates (ADR 0016): reduced motion turns everything off; scroll-pinned
 * scenes need a mouse/trackpad on a desktop-width screen; touch gets lighter effects.
 */
export function useMotionPrefs() {
  const reduceMotion = useReducedMotionSafe();
  const finePointer = useMedia(FINE_POINTER);
  const desktop = useMedia(DESKTOP);
  return {
    reduceMotion,
    finePointer,
    desktop,
    /** Pinned, scroll-scrubbed scenes are allowed */
    allowPinned: !reduceMotion && finePointer && desktop,
  };
}
