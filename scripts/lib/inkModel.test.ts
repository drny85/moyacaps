import { describe, expect, it } from "vitest";
import { lineArtInk, paperMask, paperTone, underbaseInk } from "./inkModel";

/**
 * Photo-like artwork on white paper, 100×100:
 *  - a 60×60 picture (x/y 20–80) filled with a mid-grey tone,
 *  - inside it a 3×3 white highlight (a sequin) and a 2-px-wide, 30-px-tall white counter slit
 *    enclosed by dark ink (like the inside of an "O"),
 *  - a light blue-grey block (tinted, not paper) in one corner of the picture.
 */
function artwork() {
  const width = 100;
  const height = 100;
  const data = new Uint8Array(width * height * 3).fill(255);
  const paint = (x0: number, y0: number, x1: number, y1: number, rgb: [number, number, number]) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data.set(rgb, (y * width + x) * 3);
  };
  paint(20, 20, 80, 80, [128, 128, 128]); // picture midtone
  paint(30, 30, 33, 33, [252, 252, 252]); // highlight
  paint(48, 35, 58, 70, [20, 20, 20]); // dark letter …
  paint(52, 38, 54, 68, [255, 255, 255]); // … with a narrow counter
  paint(65, 65, 80, 80, [190, 205, 225]); // tinted block
  return { data, width, height };
}

const at = (mask: Float32Array, x: number, y: number) => mask[y * 100 + x];

describe("paperTone", () => {
  it("is 1 for paper white, 0 for midtones and saturated colour", () => {
    expect(paperTone(255, 255, 255)).toBe(1);
    expect(paperTone(128, 128, 128)).toBe(0);
    expect(paperTone(255, 210, 40)).toBe(0); // yellow logo ink
    expect(paperTone(190, 205, 225)).toBe(0); // light blue block
  });
});

describe("paperMask", () => {
  const { data, width, height } = artwork();
  const mask = paperMask(data, width, height, { minEnclosedArea: 40, fringe: 1 });

  it("drops the paper around the artwork", () => {
    expect(at(mask, 5, 5)).toBe(1);
    expect(at(mask, 95, 50)).toBe(1);
  });

  it("keeps every tone of the picture as ink, including small highlights and tinted areas", () => {
    expect(at(mask, 25, 25)).toBe(0); // midtone
    expect(at(mask, 31, 31)).toBe(0); // enclosed highlight prints white
    expect(at(mask, 72, 72)).toBe(0); // light tinted block
  });

  it("drops sizeable enclosed white, such as a letter counter", () => {
    expect(at(mask, 52, 50)).toBe(1);
    expect(at(mask, 53, 60)).toBe(1);
  });
});

describe("underbaseInk", () => {
  it("prints the artwork's colour opaque on dark fabric, midtones and light tints included", () => {
    expect(underbaseInk(128, 128, 128, 0, true)).toEqual([128, 128, 128, 255]);
    expect(underbaseInk(190, 205, 225, 0, true)).toEqual([190, 205, 225, 255]);
    expect(underbaseInk(252, 252, 252, 0, true)).toEqual([252, 252, 252, 255]); // highlight in white ink
  });

  it("leaves out ink darker than the shirt on dark fabric, but not on light fabric", () => {
    expect(underbaseInk(10, 10, 10, 0, true)[3]).toBe(0);
    expect(underbaseInk(10, 10, 10, 0, false)[3]).toBe(255);
  });

  it("keeps deep saturated colour (dark red lettering) on dark fabric", () => {
    expect(underbaseInk(140, 20, 30, 0, true)[3]).toBe(255);
  });

  it("is transparent on paper", () => {
    expect(underbaseInk(255, 255, 255, 1, true)[3]).toBe(0);
    expect(underbaseInk(240, 240, 240, 0.5, false)[3]).toBe(128);
  });
});

describe("lineArtInk", () => {
  it("makes white paper transparent and keeps black ink on light fabric", () => {
    expect(lineArtInk(255, 255, 255, false, "invert")[3]).toBe(0);
    expect(lineArtInk(0, 0, 0, false, "invert")).toEqual([0, 0, 0, 255]);
  });

  it("prints black linework off-white (invert) or leaves it out (knockout) on dark fabric", () => {
    expect(lineArtInk(0, 0, 0, true, "invert")).toEqual([236, 236, 236, 255]);
    expect(lineArtInk(0, 0, 0, true, "knockout")[3]).toBe(0);
  });
});
