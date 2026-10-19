/**
 * Scroll choreography for the homepage hero (ADR 0016 budget: transform and opacity only,
 * nothing under reduced motion). `progress` is 0 while the hero sits at the top of the page
 * and 1 once it has scrolled fully out of the viewport, so every layer starts at its natural
 * position and nothing jumps at hydration.
 */

export type Range = readonly [number, number];

/** Travel of each hero layer from rest (progress 0) to fully scrolled past (progress 1), in px / deg / factor */
export const HERO_LAYERS = {
  /** Giant outlined "0880" behind everything: slowest, so it reads as the far background */
  ghost: { y: [0, 190] as Range, rotate: [-8, 3] as Range, scale: [1, 1.14] as Range, opacity: [1, 0.2] as Range },
  /** Colorway glow: slow and swelling */
  glow: { y: [0, 150] as Range, scale: [1, 1.4] as Range },
  /** Headline line 1 sits behind the cap and slides under it */
  line1: { y: [0, 76] as Range, x: [0, -18] as Range },
  /** The cap: near the page speed, shrinking and tipping as it leaves */
  cap: { y: [0, 34] as Range, scale: [1, 0.9] as Range, rotate: [0, -5] as Range },
  /** Headline line 2 is the foreground: faster than the page, rising off the brim */
  line2: { y: [0, -48] as Range, x: [0, 18] as Range },
} as const;

/** Scroll window across which the cap turns through its angle photos: closes while the cap is still clear of the sticky navbar on a phone */
export const CAP_TURN_WINDOW: Range = [0.03, 0.32];

/** Past this progress the drag hint is gone: the scroll has already shown the cap turning */
export const HINT_HIDE_PROGRESS = 0.08;

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Hero scroll progress: page scroll measured in hero heights (0 at the top, 1 once one hero
 * height has scrolled by). Rests at 0 until the hero has a measured height.
 */
export function heroScrollProgress(scrollY: number, heroHeight: number): number {
  return heroHeight > 0 ? scrollY / heroHeight : 0;
}

/** Linear scrub of a value across the full scroll of the hero. Disabled returns the rest value. */
export function scrub(progress: number, [from, to]: Range, enabled = true): number {
  if (!enabled) return from;
  return from + (to - from) * clamp01(progress);
}

/**
 * Which angle photo the scroll has turned the cap to. Frame 0 until the window opens, the last
 * frame once it closes, stepping evenly in between; never out of range.
 */
export function frameIndexForProgress(progress: number, frameCount: number, window: Range = CAP_TURN_WINDOW): number {
  if (frameCount <= 1) return 0;
  const [open, close] = window;
  const t = close > open ? clamp01((progress - open) / (close - open)) : progress >= open ? 1 : 0;
  return Math.min(frameCount - 1, Math.floor(t * frameCount));
}

/** Rotation of the platter under the cap so the marked tick follows the angle on show */
export function platterAngle(index: number, frameCount: number): number {
  if (frameCount <= 0) return 0;
  return (index / frameCount) * 360;
}

/**
 * Scroll travel for the poster hero (no cap on show, ADR 0022): the outlined "0880" sinks
 * slowest at the back, the two headline lines split sideways, the copy rises and fades first.
 */
export const POSTER_LAYERS = {
  ghost: { y: [0, 240] as Range, rotate: [-6, 4] as Range, scale: [1, 1.2] as Range, opacity: [1, 0.15] as Range },
  glow: { y: [0, 160] as Range, scale: [1, 1.5] as Range },
  line1: { y: [0, 120] as Range, x: [0, -70] as Range },
  line2: { y: [0, 60] as Range, x: [0, 70] as Range },
  copy: { y: [0, -40] as Range, opacity: [1, 0] as Range },
} as const;

/** How far each poster layer follows the pointer, in px at the box edge: the back moves least. */
export const POSTER_POINTER = { ghost: 14, glow: 40, line1: 10, line2: 22 } as const;

/** The pointer's position in a box as x and y in [-1, 1] (0 at the centre); 0 for an unmeasured box. */
export function pointerOffset(
  clientX: number,
  clientY: number,
  box: { left: number; top: number; width: number; height: number }
): { x: number; y: number } {
  if (box.width <= 0 || box.height <= 0) return { x: 0, y: 0 };
  const axis = (pos: number, start: number, size: number) => Math.max(-1, Math.min(1, ((pos - start) / size) * 2 - 1));
  return { x: axis(clientX, box.left, box.width), y: axis(clientY, box.top, box.height) };
}
