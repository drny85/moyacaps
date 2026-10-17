import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ANATOMY_STEPS } from "../data/anatomy";
import { calloutLayout, calloutSide, edgeFadeMask, fadeBands, labelCollisions, stepAt, stepRange } from "../lib/anatomy";
import en from "../messages/en.json";
import es from "../messages/es.json";

describe("stepAt / stepRange", () => {
  it("splits progress evenly and clamps the ends", () => {
    expect(stepRange(0, 4)).toEqual([0, 0.25]);
    expect(stepRange(3, 4)).toEqual([0.75, 1]);
    expect(stepAt(0, 4)).toBe(0);
    expect(stepAt(0.26, 4)).toBe(1);
    expect(stepAt(1, 4)).toBe(3);
    expect(stepAt(-0.1, 4)).toBe(0);
    expect(stepAt(0.5, 0)).toBe(0);
  });
});

describe("calloutLayout", () => {
  it("runs the leader line from the dot to the nearer label column", () => {
    expect(calloutSide({ x: 30 })).toBe("left");
    expect(calloutSide({ x: 50 })).toBe("right");
    expect(calloutLayout({ x: 30 })).toEqual({ side: "left", lineLeft: 4, lineWidth: 26 });
    expect(calloutLayout({ x: 70 })).toEqual({ side: "right", lineLeft: 70, lineWidth: 26 });
  });

  it("flags labels that would overlap on the same side", () => {
    const a = { x: 20, y: 40, label: "a" };
    const b = { x: 30, y: 45, label: "b" };
    const c = { x: 80, y: 44, label: "c" };
    expect(labelCollisions([a, b, c])).toEqual([[a, b]]);
    expect(labelCollisions([a, c])).toEqual([]);
  });
});

describe("ANATOMY_STEPS data", () => {
  const messages = { en, es } as const;

  it("uses each angle photo once and every photo exists", () => {
    const angles = ANATOMY_STEPS.map((s) => s.angle);
    expect(new Set(angles).size).toBe(ANATOMY_STEPS.length);
    for (const step of ANATOMY_STEPS) {
      expect(existsSync(join(process.cwd(), "public", step.image)), step.image).toBe(true);
    }
  });

  it("keeps callouts on the photo and their labels apart", () => {
    for (const step of ANATOMY_STEPS) {
      expect(step.callouts.length).toBeGreaterThanOrEqual(2);
      expect(step.callouts.length).toBeLessThanOrEqual(4);
      for (const c of step.callouts) {
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.x).toBeLessThanOrEqual(100);
        expect(c.y).toBeGreaterThanOrEqual(0);
        expect(c.y).toBeLessThanOrEqual(100);
      }
      expect(labelCollisions(step.callouts), step.key).toEqual([]);
    }
  });

  it("has copy in both languages for every row and callout", () => {
    for (const locale of ["en", "es"] as const) {
      const m = messages[locale].anatomy as Record<string, unknown>;
      const callouts = m.callouts as Record<string, string>;
      const steps = m.steps as Record<string, string>;
      for (const step of ANATOMY_STEPS) {
        for (const key of [step.title, step.desc, step.spec]) {
          expect(typeof m[key], `${locale}:${key}`).toBe("string");
        }
        expect(typeof steps[step.key], `${locale}:steps.${step.key}`).toBe("string");
        for (const c of step.callouts) {
          expect(typeof callouts[c.label], `${locale}:callouts.${c.label}`).toBe("string");
        }
      }
    }
  });
});

describe("edgeFadeMask", () => {
  it("leaves whole photos unmasked", () => {
    expect(edgeFadeMask(undefined)).toBeUndefined();
    expect(edgeFadeMask({})).toBeUndefined();
  });

  it("fades each cropped edge to clear by the cut", () => {
    expect(edgeFadeMask({ right: 95 })).toBe("linear-gradient(to right, #000 0%, #000 83%, transparent 95%)");
    expect(edgeFadeMask({ left: 5 })).toBe("linear-gradient(to right, transparent 5%, #000 17%, #000 100%)");
    expect(edgeFadeMask({ left: 5, right: 95 })).toBe(
      "linear-gradient(to right, transparent 5%, #000 17%, #000 83%, transparent 95%)"
    );
  });

  it("never fades a callout dot", () => {
    for (const step of ANATOMY_STEPS) {
      if (!step.cutEdges) continue;
      for (const [from, to] of fadeBands(step.cutEdges)) {
        for (const c of step.callouts) {
          expect(c.x < from || c.x > to, `${step.key}: ${c.label} at x=${c.x}`).toBe(true);
        }
      }
    }
  });
});
