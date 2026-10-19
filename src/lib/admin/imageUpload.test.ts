import { describe, expect, it } from "vitest";
import { imageErrorCode, preflightImage, preflightSummary } from "./imageUpload";

const u32be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

function pngHeader(w: number, h: number, colourType: number) {
  const ihdr = [...u32be(13), ...ascii("IHDR"), ...u32be(w), ...u32be(h), 8, colourType, 0, 0, 0, 0, 0, 0, 0];
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...ihdr]);
}

function jpegSOF(w: number, h: number) {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46,
    0xff, 0xc0, 0x00, 0x11, 8, (h >> 8) & 255, h & 255, (w >> 8) & 255, w & 255, 3,
  ]);
}

const file = (bytes: Uint8Array, name = "x.png") => new File([bytes as BlobPart], name);

describe("preflightImage", () => {
  it("accepts a large JPEG catalog shot", async () => {
    expect(await preflightImage(file(jpegSOF(2000, 2500), "a.jpg"), "catalog")).toBeNull();
  });
  it("rejects garbage as unsupported_format", async () => {
    expect(await preflightImage(file(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9])), "catalog")).toBe("unsupported_format");
  });
  it("rejects a small photo as too_small", async () => {
    expect(await preflightImage(file(jpegSOF(600, 750)), "lifestyle")).toBe("too_small");
  });
  it("uses the file size, not the slice, for too_large", async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set(jpegSOF(2000, 2500));
    expect(await preflightImage(file(big), "catalog")).toBe("too_large");
  });
  it("requires transparency for angles", async () => {
    expect(await preflightImage(file(pngHeader(500, 500, 2)), "angle")).toBe("needs_transparency");
    expect(await preflightImage(file(pngHeader(500, 500, 6)), "angle")).toBeNull();
  });
});

describe("imageErrorCode", () => {
  it("maps server image_rule and archived payloads", () => {
    expect(imageErrorCode({ kind: "image_rule", code: "too_many" })).toBe("too_many");
    expect(imageErrorCode({ kind: "archived" })).toBe("archived");
  });
  it("maps the needs_image refusal of removing a visible product's last Catalog Shot", () => {
    expect(imageErrorCode({ kind: "needs_image" })).toBe("needs_image");
  });
  it("falls back to unknown", () => {
    expect(imageErrorCode({ kind: "image_rule", code: "nope" })).toBe("unknown");
    expect(imageErrorCode("boom")).toBe("unknown");
    expect(imageErrorCode(undefined)).toBe("unknown");
  });
});

describe("preflightSummary", () => {
  const header = (width: number, height: number, hasAlpha = false) => ({ format: "png" as const, width, height, hasAlpha });
  const ids = (checks: { id: string; pass: boolean }[]) => checks.map((c) => `${c.id}:${c.pass ? "pass" : "fail"}`);

  it("checks type, size and short side for a Catalog Shot", () => {
    expect(ids(preflightSummary({ role: "catalog", bytes: 1000, header: header(2000, 2500) }))).toEqual(["type:pass", "size:pass", "shortSide:pass"]);
    expect(ids(preflightSummary({ role: "lifestyle", bytes: 11 * 1024 * 1024, header: header(700, 2500) }))).toEqual(["type:pass", "size:fail", "shortSide:fail"]);
  });

  it("checks transparency instead of the short side for an Angle Shot", () => {
    expect(ids(preflightSummary({ role: "angle", bytes: 1000, header: header(500, 500, true) }))).toEqual(["type:pass", "size:pass", "alpha:pass"]);
    expect(ids(preflightSummary({ role: "angle", bytes: 1000, header: header(500, 500) }))).toEqual(["type:pass", "size:pass", "alpha:fail"]);
  });

  it("fails everything that needs a header when the type is unknown", () => {
    expect(ids(preflightSummary({ role: "catalog", bytes: 1000, header: null }))).toEqual(["type:fail", "size:pass", "shortSide:fail"]);
  });
});
