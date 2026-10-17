import { describe, it, expect } from "vitest";
import {
  closeMask,
  colourMask,
  fillHoles,
  fitToFlatLayGuide,
  FLATLAY_GUIDE,
  garmentMask,
  isLimeFabric,
  keepLargest,
  maskBounds,
} from "./teePhoto";

// Colours sampled from the Crash Scene flat-lay on the car hood
const HOOD = [4, 7, 0];
const SKY = [40, 83, 138];
const CHROME = [49, 53, 56];
const TAG = [219, 233, 236];
const LIME = [180, 195, 154];
const BLEACHED = [177, 194, 178];
const RED_INK = [190, 40, 40];
const BLACK_INK = [10, 10, 10];

/** RGB image from a char grid: . hood, s sky reflection, c chrome, t tag, L lime, w bleached lime, r red ink, k black ink */
function image(rows: string[]) {
  const colours: Record<string, number[]> = {
    ".": HOOD, s: SKY, c: CHROME, t: TAG, L: LIME, w: BLEACHED, r: RED_INK, k: BLACK_INK,
  };
  const height = rows.length;
  const width = rows[0].length;
  const data = new Uint8Array(width * height * 3);
  rows.forEach((row, y) => [...row].forEach((ch, x) => data.set(colours[ch], (y * width + x) * 3)));
  return { data, width, height };
}

function grid(width: number, rows: string[]) {
  return Uint8Array.from(rows.join("").split("").map((c) => (c === "#" ? 1 : 0)));
}

function rowsOf(mask: Uint8Array, width: number) {
  const rows: string[] = [];
  for (let i = 0; i < mask.length; i += width) {
    rows.push([...mask.subarray(i, i + width)].map((m) => (m ? "#" : ".")).join(""));
  }
  return rows;
}

describe("isLimeFabric", () => {
  it("accepts saturated and bleached acid-wash lime", () => {
    expect(isLimeFabric(LIME[0], LIME[1], LIME[2])).toBe(true);
    expect(isLimeFabric(BLEACHED[0], BLEACHED[1], BLEACHED[2])).toBe(true);
  });

  it("rejects the hood, its reflections and the hang tag", () => {
    for (const [r, g, b] of [HOOD, SKY, CHROME, TAG]) expect(isLimeFabric(r, g, b)).toBe(false);
  });
});

describe("colourMask", () => {
  it("reads RGBA buffers", () => {
    const rgba = new Uint8Array([...HOOD, 255, ...LIME, 255, ...SKY, 255]);
    expect([...colourMask(rgba, 3, 1, 4, isLimeFabric)]).toEqual([0, 1, 0]);
  });
});

describe("closeMask", () => {
  it("bridges a one-pixel gap and leaves the outline alone", () => {
    const mask = grid(7, [".......", ".##.##.", ".#####.", "......."]);
    expect(rowsOf(closeMask(mask, 7, 4, 1), 7)).toEqual([".......", ".#####.", ".#####.", "......."]);
  });

  it("is a copy when the radius is 0", () => {
    const mask = new Uint8Array([1, 0]);
    const out = closeMask(mask, 2, 1, 0);
    expect([...out]).toEqual([1, 0]);
    expect(out).not.toBe(mask);
  });
});

describe("keepLargest", () => {
  it("drops specks that are not the garment", () => {
    const mask = grid(7, ["#......", "...###.", "...###.", "......."]);
    expect(rowsOf(keepLargest(mask, 7, 4), 7)).toEqual([".......", "...###.", "...###.", "......."]);
  });

  it("returns an empty mask when there is no garment", () => {
    expect([...keepLargest(new Uint8Array(3), 3, 1)]).toEqual([0, 0, 0]);
  });
});

describe("fillHoles", () => {
  it("fills regions the garment encloses but not border-connected surface", () => {
    const mask = grid(6, ["......", ".####.", ".#..#.", ".####.", "......"]);
    expect(rowsOf(fillHoles(mask, 6, 5), 6)).toEqual(["......", ".####.", ".####.", ".####.", "......"]);
  });
});

describe("garmentMask", () => {
  it("keeps fabric and print, drops hood, reflections, tag and stray specks", () => {
    const { data, width, height } = image([
      "s....t....c",
      ".LLLLLLLLL.",
      ".LLwrrrkLL.",
      ".LLrkkkrLL.",
      ".LLLLwLLLL.",
      "L.........c",
    ]);
    const mask = garmentMask(data, width, height, 3, { isFabric: isLimeFabric, closeRadius: 0 });
    expect(rowsOf(mask, width)).toEqual([
      "...........",
      ".#########.",
      ".#########.",
      ".#########.",
      ".#########.",
      "...........",
    ]);
  });
});

describe("maskBounds", () => {
  it("returns the garment's bounding box", () => {
    const mask = grid(5, [".....", "..#..", ".###.", "....."]);
    expect(maskBounds(mask, 5)).toEqual({ left: 1, top: 1, width: 3, height: 2 });
  });

  it("returns null for an empty mask", () => {
    expect(maskBounds(new Uint8Array(4), 2)).toBeNull();
  });
});

describe("fitToFlatLayGuide", () => {
  const size = 1000;
  const box = {
    width: (FLATLAY_GUIDE.right - FLATLAY_GUIDE.left) * size,
    height: (FLATLAY_GUIDE.bottom - FLATLAY_GUIDE.top) * size,
  };

  it("fills the guide height for a tall garment and centres it horizontally", () => {
    const fit = fitToFlatLayGuide(600, 800, size);
    expect(fit.height).toBe(Math.round(box.height));
    expect(fit.top).toBe(118);
    expect(fit.left + fit.width / 2).toBeCloseTo(size / 2, 0);
  });

  it("fills the guide width for a wide garment and centres it vertically in the box", () => {
    const fit = fitToFlatLayGuide(2000, 1000, size);
    expect(fit.width).toBe(Math.round(box.width));
    expect(fit.left).toBe(30);
    expect(fit.top + fit.height / 2).toBeCloseTo(((FLATLAY_GUIDE.top + FLATLAY_GUIDE.bottom) / 2) * size, 0);
  });

  it("keeps the garment's aspect ratio", () => {
    const fit = fitToFlatLayGuide(900, 1000, size);
    expect(fit.width / fit.height).toBeCloseTo(0.9, 2);
  });
});
