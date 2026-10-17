import { describe, expect, it } from "vitest";
import { floodFillMask, measureTee, printBoxFor, type RawImage } from "./teeCalibration";

/** Dark street background with a light tee: a 60×80 torso and two sleeves, plus a dark head above. */
function synthetic(): RawImage & { seed: { x: number; y: number } } {
  const width = 120;
  const height = 140;
  const data = new Uint8Array(width * height * 3).fill(20);
  const paint = (x0: number, y0: number, x1: number, y1: number, v: number) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data.fill(v, (y * width + x) * 3, (y * width + x) * 3 + 3);
  };
  paint(45, 5, 75, 30, 120); // head / skin
  paint(30, 30, 90, 110, 230); // torso
  paint(15, 30, 30, 55, 230); // left sleeve
  paint(90, 30, 105, 55, 230); // right sleeve
  // soft fold: brightness dips 30 levels and recovers gradually, as a real crease does
  for (let y = 60; y < 80; y++) {
    const v = 230 - 3 * Math.min(y - 60, 80 - y);
    for (let x = 30; x < 90; x++) data.fill(v, (y * width + x) * 3, (y * width + x) * 3 + 3);
  }
  return { data, width, height, channels: 3, seed: { x: 60, y: 50 } };
}

describe("tee calibration", () => {
  it("fills the garment through soft folds but not into skin or background", () => {
    const img = synthetic();
    const mask = floodFillMask(img, img.seed, { step: 12, range: 70 });
    const at = (x: number, y: number) => mask[y * img.width + x];
    expect(at(60, 100)).toBe(1); // lower torso, past the fold
    expect(at(20, 40)).toBe(1); // sleeve
    expect(at(60, 10)).toBe(0); // head
    expect(at(5, 5)).toBe(0); // background
  });

  it("measures collar, hem and torso width below the sleeves", () => {
    const img = synthetic();
    const mask = floodFillMask(img, img.seed, { step: 12, range: 70 });
    const m = measureTee(mask, img.width, img.height, img.seed.x);
    expect(m.collarY).toBe(30);
    expect(m.hemY).toBe(109);
    expect(m.measureY).toBeGreaterThan(55); // below the sleeves
    expect([m.torsoLeft, m.torsoRight]).toEqual([30, 89]);
  });

  it("centres the print on the torso, larger on the back", () => {
    const m = { collarY: 30, hemY: 110, torsoLeft: 30, torsoRight: 90, measureY: 74 };
    const front = printBoxFor(m, "front");
    const back = printBoxFor(m, "back");
    expect(front.cx).toBe(60);
    expect(back.cx).toBe(60);
    expect(back.width).toBeGreaterThan(front.width);
    expect(back.top).toBeLessThanOrEqual(front.top);
    expect(front.top).toBeGreaterThan(m.collarY);
  });

  it("follows a body turned off-centre", () => {
    const box = printBoxFor({ collarY: 30, hemY: 110, torsoLeft: 50, torsoRight: 100, measureY: 74 }, "front");
    expect(box.cx).toBe(75);
  });
});
