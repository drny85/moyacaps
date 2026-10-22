import { describe, expect, it } from "vitest";
import { clampCart, isUnreleasedDrop, lineOverStock, lineStock, type CartStockLine, type CartStockVariant } from "./cartStock";
import { MAX_UNITS_PER_LINE } from "../../convex/payments/limits";

const NOW = 1_800_000_000_000;

const cap: CartStockVariant = { variantId: "oro-negro", stock: 3, isAvailable: true, skus: null };

/** A tee whose variant total (9) hides that black/M has only 1 unit. */
const tee: CartStockVariant = {
  variantId: "tee-1",
  stock: 9,
  isAvailable: true,
  skus: [
    { colorway: "black", size: "M", stock: 1 },
    { colorway: "black", size: "L", stock: 8 },
    { colorway: "white", size: "M", stock: 0 },
  ],
};

const capLine = (quantity: number): CartStockLine => ({ id: "oro-negro", variantId: "oro-negro", name: "Oro Negro", quantity });
const teeLine = (colorway: string | undefined, size: string | undefined, quantity: number): CartStockLine => ({
  id: `tee-1-${colorway}-${size}`,
  variantId: "tee-1",
  name: `Tee (${colorway} ${size})`,
  quantity,
  colorway,
  size,
});

describe("lineStock", () => {
  it("reads a cap's variant stock", () => {
    expect(lineStock({}, cap)).toBe(3);
  });

  it("reads a tee line's own SKU, not the variant total", () => {
    expect(lineStock({ colorway: "black", size: "M" }, tee)).toBe(1);
    expect(lineStock({ colorway: "black", size: "L" }, tee)).toBe(8);
  });

  it("is 0 for a tee line missing an option or naming a SKU the tee lacks", () => {
    expect(lineStock({ colorway: "black" }, tee)).toBe(0);
    expect(lineStock({ colorway: "red", size: "M" }, tee)).toBe(0);
  });

  it("never goes negative", () => {
    expect(lineStock({}, { ...cap, stock: -2 })).toBe(0);
  });
});

describe("clampCart", () => {
  it("caps a tee line at its SKU stock", () => {
    const result = clampCart([teeLine("black", "M", 3)], [tee], NOW);
    expect(result.cart).toEqual([{ ...teeLine("black", "M", 3), quantity: 1, maxStock: 1 }]);
    expect(result).toMatchObject({ adjusted: true, adjustedNames: ["Tee (black M)"] });
  });

  it("caps each tee line separately", () => {
    const result = clampCart([teeLine("black", "M", 1), teeLine("black", "L", 5)], [tee], NOW);
    expect(result.cart.map((l) => [l.quantity, l.maxStock])).toEqual([
      [1, 1],
      [5, MAX_UNITS_PER_LINE],
    ]);
    expect(result.adjusted).toBe(false);
  });

  it("caps a line at the checkout purchase limit even when more is in stock", () => {
    const result = clampCart([teeLine("black", "L", MAX_UNITS_PER_LINE + 2)], [tee], NOW);
    expect(result.cart[0]).toMatchObject({ quantity: MAX_UNITS_PER_LINE, maxStock: MAX_UNITS_PER_LINE });
    expect(result.adjusted).toBe(true);
  });

  it("removes a tee line whose SKU is sold out", () => {
    const result = clampCart([teeLine("white", "M", 1), teeLine("black", "L", 1)], [tee], NOW);
    expect(result.cart.map((l) => l.id)).toEqual(["tee-1-black-L"]);
    expect(result.adjustedNames).toEqual(["Tee (white M)"]);
  });

  it("caps a cap line at variant stock", () => {
    const result = clampCart([capLine(5)], [cap], NOW);
    expect(result.cart[0]).toMatchObject({ quantity: 3, maxStock: 3 });
    expect(result.adjusted).toBe(true);
  });

  it("removes unavailable products and unreleased drops", () => {
    const hidden = { ...cap, isAvailable: false };
    expect(clampCart([capLine(1)], [hidden], NOW)).toEqual({ cart: [], adjusted: true, adjustedNames: ["Oro Negro"] });
    const drop = { ...cap, isDrop: true, dropDate: NOW + 1, dropStatus: "scheduled" };
    expect(clampCart([capLine(1)], [drop], NOW).cart).toEqual([]);
  });

  it("keeps lines with no live row untouched", () => {
    const line = { ...capLine(7), maxStock: 7 };
    expect(clampCart([line], [], NOW)).toEqual({ cart: [line], adjusted: false, adjustedNames: [] });
  });
});

describe("lineOverStock", () => {
  it("flags a tee line over its SKU even when the variant total covers it", () => {
    expect(lineOverStock(teeLine("black", "M", 2), tee)).toBe(true);
    expect(lineOverStock(teeLine("black", "L", 2), tee)).toBe(false);
  });

  it("flags an unavailable product", () => {
    expect(lineOverStock(capLine(1), { ...cap, isAvailable: false })).toBe(true);
  });
});

describe("isUnreleasedDrop", () => {
  it("is true before the drop date and false once live", () => {
    expect(isUnreleasedDrop({ ...cap, isDrop: true, dropDate: NOW + 1 }, NOW)).toBe(true);
    expect(isUnreleasedDrop({ ...cap, isDrop: true, dropDate: NOW + 1, dropStatus: "live" }, NOW)).toBe(false);
    expect(isUnreleasedDrop({ ...cap, isDrop: true, dropDate: NOW - 1 }, NOW)).toBe(false);
  });
});
