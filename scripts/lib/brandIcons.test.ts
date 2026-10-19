import { describe, expect, it } from "vitest";
import { encodeIco, fullBleed } from "./brandIcons";

const png = (len: number, fill: number) => new Uint8Array(len).fill(fill);

describe("encodeIco", () => {
  it("writes the header, one directory entry per frame and the PNG bytes in order", () => {
    const ico = encodeIco([
      { size: 16, png: png(10, 1) },
      { size: 32, png: png(20, 2) },
      { size: 48, png: png(30, 3) },
    ]);
    const view = new DataView(ico.buffer);

    expect(view.getUint16(0, true)).toBe(0);
    expect(view.getUint16(2, true)).toBe(1);
    expect(view.getUint16(4, true)).toBe(3);
    expect(ico.byteLength).toBe(6 + 16 * 3 + 60);

    const entries = [0, 1, 2].map((i) => {
      const at = 6 + 16 * i;
      return {
        w: view.getUint8(at),
        h: view.getUint8(at + 1),
        bpp: view.getUint16(at + 6, true),
        bytes: view.getUint32(at + 8, true),
        offset: view.getUint32(at + 12, true),
      };
    });
    expect(entries).toEqual([
      { w: 16, h: 16, bpp: 32, bytes: 10, offset: 54 },
      { w: 32, h: 32, bpp: 32, bytes: 20, offset: 64 },
      { w: 48, h: 48, bpp: 32, bytes: 30, offset: 84 },
    ]);
    expect(ico[64]).toBe(2);
    expect(ico[ico.byteLength - 1]).toBe(3);
  });

  it("stores 256 as 0 in the directory", () => {
    const ico = encodeIco([{ size: 256, png: png(4, 9) }]);
    expect(ico[6]).toBe(0);
    expect(ico[7]).toBe(0);
  });

  it("rejects empty input and out-of-range sizes", () => {
    expect(() => encodeIco([])).toThrow();
    expect(() => encodeIco([{ size: 300, png: png(1, 0) }])).toThrow(/out of range/);
  });
});

describe("fullBleed", () => {
  it("drops the corner radius from the background rect only", () => {
    const svg = '<svg><rect width="10" height="10" rx="2" fill="#000"/><rect x="1" rx="5"/></svg>';
    expect(fullBleed(svg)).toBe('<svg><rect width="10" height="10" fill="#000"/><rect x="1" rx="5"/></svg>');
  });

  it("throws when there is no rounded rect to flatten", () => {
    expect(() => fullBleed('<svg><rect width="10"/></svg>')).toThrow();
  });
});
