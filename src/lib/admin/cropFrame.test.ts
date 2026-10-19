import { describe, expect, it } from "vitest";
import { fitCropBox } from "./cropFrame";

describe("fitCropBox", () => {
  it("is the whole image at exactly 4:5", () => {
    expect(fitCropBox(1600, 2000)).toEqual({ x: 0, y: 0, width: 1600, height: 2000 });
  });
  it("centres a full-height box in a landscape image", () => {
    expect(fitCropBox(3000, 2000)).toEqual({ x: 700, y: 0, width: 1600, height: 2000 });
  });
  it("centres a full-width box in a tall image", () => {
    expect(fitCropBox(1600, 3000)).toEqual({ x: 0, y: 500, width: 1600, height: 2000 });
  });
  it("takes another aspect", () => {
    expect(fitCropBox(2000, 1000, 1)).toEqual({ x: 500, y: 0, width: 1000, height: 1000 });
  });
});
