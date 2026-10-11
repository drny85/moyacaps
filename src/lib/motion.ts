/**
 * Shared motion tokens for the storefront.
 * Every homepage animation pulls its easing, duration and spring from here so
 * sections feel like one system instead of hand-tuned one-offs.
 */

export const EASE = {
  /** Fast out, soft landing — default for entrances */
  out: [0.16, 1, 0.3, 1] as const,
  /** Symmetric — crossfades and swaps */
  inOut: [0.65, 0, 0.35, 1] as const,
  /** Snappy pop for small UI elements */
  pop: [0.34, 1.56, 0.64, 1] as const,
};

export const DURATION = {
  fast: 0.25,
  base: 0.5,
  slow: 0.8,
  intro: 1.2,
};

export const SPRING = {
  /** Pointer-follow tilt */
  tilt: { stiffness: 220, damping: 22, mass: 0.6 },
  /** Scroll-linked smoothing */
  scroll: { stiffness: 140, damping: 28, restDelta: 0.0005 },
  /** Marquee velocity smoothing */
  velocity: { stiffness: 400, damping: 50 },
};

/** Stagger between siblings in a reveal group */
export const STAGGER = 0.06;
