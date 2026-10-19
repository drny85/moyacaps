import { describe, expect, it } from "vitest";
import { cropFrame } from "./cropFrame";

describe("cropFrame", () => {
  it("is the full image at exactly 4:5", () => {
    const f = cropFrame(800, 1000);
    expect(f.widthPct).toBeCloseTo(100);
    expect(f.heightPct).toBeCloseTo(100);
  });
  it("trims the sides of a square", () => {
    const f = cropFrame(1000, 1000);
    expect(f.widthPct).toBeCloseTo(80);
    expect(f.heightPct).toBeCloseTo(100);
  });
  it("trims the sides of a wide 16:9 image", () => {
    const f = cropFrame(1600, 900);
    expect(f.widthPct).toBeCloseTo((0.8 / (16 / 9)) * 100);
    expect(f.heightPct).toBeCloseTo(100);
  });
  it("trims top and bottom of a tall 9:16 image", () => {
    const f = cropFrame(900, 1600);
    expect(f.widthPct).toBeCloseTo(100);
    expect(f.heightPct).toBeCloseTo(((9 / 16) / 0.8) * 100);
  });
});
