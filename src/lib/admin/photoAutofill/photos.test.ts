import { describe, expect, it } from "vitest";
import { checkPhotos, fitWithin, paintForJpeg } from "./photos";

const jpeg = { type: "image/jpeg" };

describe("fitWithin", () => {
  it("shrinks a landscape phone photo to a 1568 px long side", () => {
    expect(fitWithin(4032, 3024, 1568)).toEqual({ width: 1568, height: 1176 });
  });
  it("shrinks a portrait phone photo to a 1568 px long side", () => {
    expect(fitWithin(3024, 4032, 1568)).toEqual({ width: 1176, height: 1568 });
  });
  it("never upscales a small photo", () => {
    expect(fitWithin(800, 600, 1568)).toEqual({ width: 800, height: 600 });
  });
});

describe("checkPhotos", () => {
  it("needs at least one photo", () => {
    expect(checkPhotos([])).toEqual({ ok: false, reason: "none" });
  });
  it("allows at most four photos", () => {
    expect(checkPhotos([jpeg, jpeg, jpeg, jpeg])).toEqual({ ok: true });
    expect(checkPhotos([jpeg, jpeg, jpeg, jpeg, jpeg])).toEqual({ ok: false, reason: "too_many" });
  });
  it("rejects a file that is not an image", () => {
    expect(checkPhotos([jpeg, { type: "application/pdf" }])).toEqual({ ok: false, reason: "not_image" });
  });
  it("accepts HEIC and leaves decoding to the browser", () => {
    expect(checkPhotos([{ type: "image/heic" }])).toEqual({ ok: true });
  });
});

describe("paintForJpeg", () => {
  it("paints a white background before the photo so transparent cutouts are not read as black", () => {
    const calls: string[] = [];
    const ctx = {
      set fillStyle(v: string) {
        calls.push(`fill:${v}`);
      },
      fillRect: (...a: number[]) => calls.push(`rect:${a.join(",")}`),
      drawImage: (_img: unknown, ...a: number[]) => calls.push(`draw:${a.join(",")}`),
    };
    paintForJpeg(ctx, {} as CanvasImageSource, 100, 80);
    expect(calls).toEqual(["fill:#ffffff", "rect:0,0,100,80", "draw:0,0,100,80"]);
  });
});
