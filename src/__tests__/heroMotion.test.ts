import { describe, expect, it } from "vitest";
import {
  CAP_TURN_WINDOW,
  HERO_LAYERS,
  clamp01,
  frameIndexForProgress,
  heroScrollProgress,
  platterAngle,
  scrub, POSTER_LAYERS, pointerOffset } from "../lib/heroMotion";

describe("clamp01", () => {
  it("keeps values inside 0..1 and treats NaN as 0", () => {
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(7)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
  });
});

describe("heroScrollProgress", () => {
  it("is the page scroll in hero heights", () => {
    expect(heroScrollProgress(0, 600)).toBe(0);
    expect(heroScrollProgress(150, 600)).toBe(0.25);
    expect(heroScrollProgress(1200, 600)).toBe(2);
  });

  it("rests at 0 until the hero has been measured", () => {
    expect(heroScrollProgress(300, 0)).toBe(0);
    expect(heroScrollProgress(300, -10)).toBe(0);
    expect(heroScrollProgress(300, Number.NaN)).toBe(0);
  });
});

describe("scrub", () => {
  it("rests at the start value and reaches the end value", () => {
    expect(scrub(0, [0, 100])).toBe(0);
    expect(scrub(1, [0, 100])).toBe(100);
    expect(scrub(0.25, [1, 0.9])).toBeCloseTo(0.975);
  });

  it("clamps progress outside the hero", () => {
    expect(scrub(-1, [0, 100])).toBe(0);
    expect(scrub(3, [-8, 3])).toBe(3);
  });

  it("returns the rest value when disabled (reduced motion / before mount)", () => {
    expect(scrub(0.8, [0, 190], false)).toBe(0);
    expect(scrub(0.8, [1, 1.4], false)).toBe(1);
  });

  it("every layer rests in place so nothing jumps at hydration (the ghost's tilt is its rest pose)", () => {
    for (const [name, layer] of Object.entries(HERO_LAYERS)) {
      for (const [key, range] of Object.entries(layer)) {
        if (key === "rotate") continue;
        const rest = key === "scale" || key === "opacity" ? 1 : 0;
        expect(range[0], `${name}.${key} rest`).toBe(rest);
      }
    }
    expect(HERO_LAYERS.cap.rotate[0]).toBe(0);
  });
});

describe("frameIndexForProgress", () => {
  it("shows the front photo before the window opens", () => {
    expect(frameIndexForProgress(0, 4)).toBe(0);
    expect(frameIndexForProgress(CAP_TURN_WINDOW[0] - 0.001, 4)).toBe(0);
  });

  it("ends on the last photo once the window closes and stays there", () => {
    expect(frameIndexForProgress(CAP_TURN_WINDOW[1], 4)).toBe(3);
    expect(frameIndexForProgress(1, 4)).toBe(3);
    expect(frameIndexForProgress(5, 4)).toBe(3);
  });

  it("steps evenly through every frame, never skipping or going backwards", () => {
    const seen: number[] = [];
    for (let p = 0; p <= 1.0001; p += 0.005) {
      const i = frameIndexForProgress(p, 4);
      expect(i).toBeGreaterThanOrEqual(seen.at(-1) ?? 0);
      expect(i).toBeLessThan(4);
      if (i !== seen.at(-1)) seen.push(i);
    }
    expect(seen).toEqual([0, 1, 2, 3]);
  });

  it("is frame 0 for a single photo and respects a custom window", () => {
    expect(frameIndexForProgress(0.9, 1)).toBe(0);
    expect(frameIndexForProgress(0.9, 0)).toBe(0);
    expect(frameIndexForProgress(0.5, 2, [0.4, 0.6])).toBe(1);
    expect(frameIndexForProgress(0.3, 2, [0.4, 0.6])).toBe(0);
  });

  it("survives a degenerate window", () => {
    expect(frameIndexForProgress(0.5, 4, [0.5, 0.5])).toBe(3);
    expect(frameIndexForProgress(0.4, 4, [0.5, 0.5])).toBe(0);
  });
});

describe("platterAngle", () => {
  it("spreads the frames around a full turn", () => {
    expect(platterAngle(0, 4)).toBe(0);
    expect(platterAngle(1, 4)).toBe(90);
    expect(platterAngle(3, 4)).toBe(270);
    expect(platterAngle(0, 0)).toBe(0);
  });
});

describe("poster hero parallax", () => {
  it("every layer rests at identity before any scroll", () => {
    expect(scrub(0, POSTER_LAYERS.ghost.y)).toBe(0);
    expect(scrub(0, POSTER_LAYERS.ghost.scale)).toBe(1);
    expect(scrub(0, POSTER_LAYERS.copy.opacity)).toBe(1);
    for (const layer of [POSTER_LAYERS.line1, POSTER_LAYERS.line2]) {
      expect(scrub(0, layer.x)).toBe(0);
      expect(scrub(0, layer.y)).toBe(0);
    }
  });

  it("the headline lines split apart and the ghost sinks as the page scrolls", () => {
    expect(scrub(1, POSTER_LAYERS.line1.x)).toBeLessThan(0);
    expect(scrub(1, POSTER_LAYERS.line2.x)).toBeGreaterThan(0);
    expect(scrub(1, POSTER_LAYERS.ghost.y)).toBeGreaterThan(scrub(1, POSTER_LAYERS.line1.y));
    expect(scrub(1, POSTER_LAYERS.copy.opacity)).toBe(0);
  });

  it("pointerOffset maps the pointer to [-1, 1] from the box centre", () => {
    const box = { left: 100, top: 50, width: 200, height: 100 };
    expect(pointerOffset(200, 100, box)).toEqual({ x: 0, y: 0 });
    expect(pointerOffset(300, 150, box)).toEqual({ x: 1, y: 1 });
    expect(pointerOffset(100, 50, box)).toEqual({ x: -1, y: -1 });
    expect(pointerOffset(10_000, -10_000, box)).toEqual({ x: 1, y: -1 });
    expect(pointerOffset(5, 5, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
  });
});
