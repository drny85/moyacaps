import { describe, expect, it } from "vitest";
import { readImageHeader } from "./header";

const u32be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const u24le = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255];

function pngHeader(w: number, h: number, colourType: number, chunks: number[][] = []) {
  const ihdr = [...u32be(13), ...ascii("IHDR"), ...u32be(w), ...u32be(h), 8, colourType, 0, 0, 0, 0, 0, 0, 0];
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...ihdr, ...chunks.flat()]);
}
const pngChunk = (type: string, data: number[]) => [...u32be(data.length), ...ascii(type), ...data, 0, 0, 0, 0];

function jpegSOF(w: number, h: number, marker = 0xc0) {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, // APP0, length 4 (covers length bytes + 2 payload)
    0xff, marker, 0x00, 0x11, 8, (h >> 8) & 255, h & 255, (w >> 8) & 255, w & 255, 3,
  ]);
}

const riff = (chunk: number[]) => [...ascii("RIFF"), ...u32be(0), ...ascii("WEBP"), ...chunk];
function webpVP8X(w: number, h: number, alpha: boolean) {
  const data = [alpha ? 0x10 : 0, 0, 0, 0, ...u24le(w - 1), ...u24le(h - 1)];
  return new Uint8Array(riff([...ascii("VP8X"), 10, 0, 0, 0, ...data]));
}
function webpVP8(w: number, h: number) {
  const data = [0, 0, 0, 0x9d, 0x01, 0x2a, w & 255, (w >> 8) & 0x3f, h & 255, (h >> 8) & 0x3f];
  return new Uint8Array(riff([...ascii("VP8 "), 10, 0, 0, 0, ...data]));
}
function webpVP8L(w: number, h: number, alpha: boolean) {
  const v = ((w - 1) | ((h - 1) << 14) | ((alpha ? 1 : 0) << 28)) >>> 0;
  const data = [0x2f, v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  return new Uint8Array(riff([...ascii("VP8L"), 5, 0, 0, 0, ...data]));
}

describe("readImageHeader", () => {
  it("reads PNG dimensions and alpha from colour type", () => {
    expect(readImageHeader(pngHeader(800, 600, 6))).toEqual({ format: "png", width: 800, height: 600, hasAlpha: true });
    expect(readImageHeader(pngHeader(10, 20, 4))?.hasAlpha).toBe(true);
    expect(readImageHeader(pngHeader(10, 20, 2))?.hasAlpha).toBe(false);
  });
  it("detects PNG tRNS before IDAT only", () => {
    const trns = pngChunk("tRNS", [0, 0]);
    const idat = pngChunk("IDAT", [1, 2]);
    expect(readImageHeader(pngHeader(10, 10, 3, [trns, idat]))?.hasAlpha).toBe(true);
    expect(readImageHeader(pngHeader(10, 10, 3, [idat, trns]))?.hasAlpha).toBe(false);
  });
  it("reads JPEG SOF0/1/2, never alpha", () => {
    for (const m of [0xc0, 0xc1, 0xc2]) {
      expect(readImageHeader(jpegSOF(2000, 2500, m))).toEqual({ format: "jpeg", width: 2000, height: 2500, hasAlpha: false });
    }
  });
  it("returns null for JPEG with SOS before SOF", () => {
    expect(readImageHeader(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 4, 0, 0]))).toBeNull();
  });
  it("reads WebP VP8X, VP8 and VP8L", () => {
    expect(readImageHeader(webpVP8X(1700, 1800, true))).toEqual({ format: "webp", width: 1700, height: 1800, hasAlpha: true });
    expect(readImageHeader(webpVP8X(5, 6, false))?.hasAlpha).toBe(false);
    expect(readImageHeader(webpVP8(640, 480))).toEqual({ format: "webp", width: 640, height: 480, hasAlpha: false });
    expect(readImageHeader(webpVP8L(1600, 1601, true))).toEqual({ format: "webp", width: 1600, height: 1601, hasAlpha: true });
    expect(readImageHeader(webpVP8L(3, 4, false))?.hasAlpha).toBe(false);
  });
  it("returns null for GIF, garbage, empty, truncated, zero dimensions", () => {
    expect(readImageHeader(new Uint8Array(ascii("GIF89a\x01\x00\x01\x00")))).toBeNull();
    expect(readImageHeader(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).toBeNull();
    expect(readImageHeader(new Uint8Array())).toBeNull();
    expect(readImageHeader(pngHeader(10, 10, 6).slice(0, 20))).toBeNull();
    expect(readImageHeader(jpegSOF(10, 10).slice(0, 12))).toBeNull();
    expect(readImageHeader(pngHeader(0, 10, 6))).toBeNull();
    expect(readImageHeader(jpegSOF(10, 0))).toBeNull();
  });
});
