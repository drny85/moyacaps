import { describe, expect, it } from "vitest";
import { checkImageUpload, MAX_IMAGE_BYTES, MIN_SHORT_SIDE } from "./rules";

const MB = 1024 * 1024;
const jpeg = (width: number, height: number) => ({ format: "jpeg" as const, width, height, hasAlpha: false });
const png = (width: number, height: number, hasAlpha: boolean) => ({ format: "png" as const, width, height, hasAlpha });

describe("checkImageUpload", () => {
  it("exposes limits", () => {
    expect(MAX_IMAGE_BYTES).toBe(10 * MB);
    expect(MIN_SHORT_SIDE).toBe(800);
  });
  it("accepts a 9 MB 2000x2500 JPEG catalog shot", () => {
    expect(checkImageUpload({ role: "catalog", bytes: 9 * MB, header: jpeg(2000, 2500) })).toBeNull();
  });
  it("rejects over 10 MB using the passed byte count", () => {
    expect(checkImageUpload({ role: "catalog", bytes: 11 * MB, header: jpeg(2000, 2500) })).toBe("too_large");
    expect(checkImageUpload({ role: "catalog", bytes: MAX_IMAGE_BYTES, header: jpeg(2000, 2500) })).toBeNull();
  });
  it("rejects small catalog and lifestyle shots", () => {
    expect(checkImageUpload({ role: "catalog", bytes: MB, header: jpeg(700, 875) })).toBe("too_small");
    expect(checkImageUpload({ role: "lifestyle", bytes: MB, header: jpeg(2000, 799) })).toBe("too_small");
    expect(checkImageUpload({ role: "lifestyle", bytes: MB, header: jpeg(800, 800) })).toBeNull();
    // The store's existing exported Catalog Shots are 896×1120.
    expect(checkImageUpload({ role: "catalog", bytes: MB, header: jpeg(896, 1120) })).toBeNull();
  });
  it("angle needs alpha and skips short-side rule", () => {
    expect(checkImageUpload({ role: "angle", bytes: MB, header: png(800, 800, false) })).toBe("needs_transparency");
    expect(checkImageUpload({ role: "angle", bytes: MB, header: jpeg(3000, 3000) })).toBe("needs_transparency");
    expect(checkImageUpload({ role: "angle", bytes: MB, header: png(400, 400, true) })).toBeNull();
  });
  it("rejects unsupported format first", () => {
    expect(checkImageUpload({ role: "catalog", bytes: 50 * MB, header: null })).toBe("unsupported_format");
  });
});
