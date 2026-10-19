import { describe, expect, it } from "vitest";
import { buildSkuMatrix, formSkuMatrix, markBlocked } from "./skuMatrix";

const colorways = [
  { id: "black", name: "Black" },
  { id: "white", name: "White" },
];

describe("buildSkuMatrix", () => {
  it("lays colorways out as rows and sizes as columns", () => {
    const m = buildSkuMatrix(colorways, ["M", "L"], [
      { colorway: "black", size: "M", stock: 3 },
      { colorway: "black", size: "L", stock: 1 },
      { colorway: "white", size: "M", stock: 0 },
      { colorway: "white", size: "L", stock: 2 },
    ]);
    expect(m.sizes).toEqual(["M", "L"]);
    expect(m.rows.map((r) => [r.colorway, r.name, r.cells.map((c) => c.stock), r.total])).toEqual([
      ["black", "Black", [3, 1], 4],
      ["white", "White", [0, 2], 2],
    ]);
    expect(m.total).toBe(6);
  });

  it("shows a cell with no SKU yet as an unsaved 0", () => {
    const m = buildSkuMatrix(colorways, ["M", "XL"], [{ colorway: "black", size: "M", stock: 3 }]);
    expect(m.rows[0].cells).toEqual([
      { size: "M", stock: 3, saved: true, blocked: false, removed: false },
      { size: "XL", stock: 0, saved: false, blocked: false, removed: false },
    ]);
    expect(m.rows[1].cells.every((c) => !c.saved && c.stock === 0)).toBe(true);
  });
});

describe("colorway swatches", () => {
  it("carries each colorway's hex and border hex onto its row, removed rows included", () => {
    const m = formSkuMatrix(
      { colorways: [{ id: "black", name: "Black", hex: "#111111", borderHex: "#333333" }], sizes: ["M"] },
      { colorways: [{ id: "white", name: "White", hex: "#fafafa", borderHex: "#dddddd" }], sizes: ["M"] },
      []
    );
    expect(m.rows.map((r) => [r.colorway, r.hex, r.borderHex, r.removed])).toEqual([
      ["black", "#111111", "#333333", false],
      ["white", "#fafafa", "#dddddd", true],
    ]);
  });
});

describe("markBlocked", () => {
  it("flags the cells a sku_in_stock error names", () => {
    const m = markBlocked(buildSkuMatrix(colorways, ["M"], [{ colorway: "white", size: "M", stock: 2 }]), [{ colorway: "white", size: "M" }]);
    expect(m.rows[1].cells[0].blocked).toBe(true);
    expect(m.rows[0].cells[0].blocked).toBe(false);
  });

  it("ignores cells not on the matrix", () => {
    const m = buildSkuMatrix(colorways, ["M"], []);
    expect(markBlocked(m, [{ colorway: "lime", size: "M" }])).toEqual(m);
  });
});

describe("formSkuMatrix", () => {
  it("keeps colorways and sizes the form removed, marked removed, in size order", () => {
    const m = formSkuMatrix(
      { colorways: [colorways[0]], sizes: ["L", "XL"] },
      { colorways, sizes: ["M", "L"] },
      [{ colorway: "white", size: "M", stock: 2 }]
    );
    expect(m.sizes).toEqual(["M", "L", "XL"]);
    expect(m.removedSizes).toEqual(["M"]);
    expect(m.rows.map((r) => [r.colorway, r.removed])).toEqual([
      ["black", false],
      ["white", true],
    ]);
    expect(m.rows[0].cells.map((c) => c.removed)).toEqual([true, false, false]);
    expect(m.rows[1].cells[0]).toMatchObject({ stock: 2, saved: true, removed: true });
  });
});
