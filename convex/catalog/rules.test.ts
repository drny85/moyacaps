import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import {
  normalizeSlug,
  resolveTaxCode,
  throwIfInvalid,
  validateProductFields,
  validateTeeOptions,
  type ProductFieldsInput,
} from "./rules";

const cap: ProductFieldsInput = {
  variantId: "black-gold",
  nameEn: "Black Gold",
  nameEs: "Negro Oro",
  category: "headwear",
  silhouette: "snapback",
  primaryHex: "#111111",
  secondaryHex: "#fc0",
  priceUsd: 35,
  stock: 10,
};
const tee: ProductFieldsInput = {
  ...cap,
  category: "apparel",
  silhouette: "tee",
  priceUsd: 25.5,
};

const errs = (over: Partial<ProductFieldsInput>) =>
  validateProductFields({ ...cap, ...over });

describe("validateProductFields", () => {
  it("accepts a valid cap and tee", () => {
    expect(validateProductFields(cap)).toEqual([]);
    expect(validateProductFields(tee)).toEqual([]);
  });

  it.each([0, -1, NaN, 10000.01, 12.345])("priceUsd %s is out of range", (priceUsd) => {
    expect(errs({ priceUsd })).toContainEqual({ field: "priceUsd", code: "range" });
  });

  it.each([1.5, -1, 100001])("stock %s is out of range", (stock) => {
    expect(errs({ stock })).toContainEqual({ field: "stock", code: "range" });
  });

  it("rejects bad hex", () => {
    expect(errs({ primaryHex: "red" })).toContainEqual({ field: "primaryHex", code: "format" });
  });

  it("rejects silhouette not matching category", () => {
    expect(errs({ silhouette: "tee" })).toContainEqual({ field: "silhouette", code: "mismatch" });
  });

  it("validates variantId only when present", () => {
    expect(errs({ variantId: undefined })).toEqual([]);
    expect(errs({ variantId: "Black Gold" })).toContainEqual({ field: "variantId", code: "format" });
    expect(errs({ variantId: "ab" })).toContainEqual({ field: "variantId", code: "format" });
  });

  it("flags empty and long names", () => {
    expect(errs({ nameEn: "   " })).toContainEqual({ field: "nameEn", code: "required" });
    expect(errs({ nameEs: "x".repeat(81) })).toContainEqual({ field: "nameEs", code: "too_long" });
  });

  it("flags long badge and description", () => {
    expect(errs({ badgeTextEn: "x".repeat(25) })).toContainEqual({ field: "badgeTextEn", code: "too_long" });
    expect(errs({ badgeTextEs: "x".repeat(24) })).toEqual([]);
    expect(errs({ descriptionEs: "x".repeat(1001) })).toContainEqual({ field: "descriptionEs", code: "too_long" });
  });

  it("validates taxCode only when present", () => {
    expect(errs({ taxCode: "txcd_30060006" })).toEqual([]);
    expect(errs({ taxCode: "bad" })).toContainEqual({ field: "taxCode", code: "format" });
  });
});

describe("normalizeSlug", () => {
  it("normalizes", () => {
    expect(normalizeSlug("  Black  Gold_ ")).toBe("black-gold");
  });
});

describe("resolveTaxCode", () => {
  it("defaults per category", () => {
    expect(resolveTaxCode("apparel")).toBe("txcd_30011000");
    expect(resolveTaxCode("headwear")).toBe("txcd_30060006");
    expect(resolveTaxCode("headwear", "txcd_12345678")).toBe("txcd_12345678");
  });
});

describe("throwIfInvalid", () => {
  it("no-ops on empty", () => {
    expect(() => throwIfInvalid([])).not.toThrow();
  });
  it("throws ConvexError with errors", () => {
    const errors = [{ field: "priceUsd", code: "range" as const }];
    try {
      throwIfInvalid(errors);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ConvexError);
      if (!(e instanceof ConvexError)) throw e;
      const data: unknown = e.data;
      expect(data).toEqual({ kind: "validation", errors });
    }
  });
});

describe("validateTeeOptions", () => {
  const cw = (id: string) => ({ id, nameEn: "Black", nameEs: "Negro", hex: "#000", borderHex: "#111111" });
  const ok = { colorways: [cw("black"), cw("lime")], sizes: ["S", "3XL"], defaultColorway: "lime" };

  it("accepts valid options", () => {
    expect(validateTeeOptions(ok)).toEqual([]);
  });

  it("flags empty, duplicate and malformed entries with indexed fields", () => {
    expect(validateTeeOptions({ colorways: [], sizes: [] })).toEqual([
      { field: "colorways", code: "required" },
      { field: "sizes", code: "required" },
    ]);
    const errors = validateTeeOptions({
      colorways: [cw("black"), cw("black"), { ...cw("Bad Id"), hex: "red", nameEn: " " }],
      sizes: ["S", "S", "XXL"],
      defaultColorway: "none",
      fitEn: "x".repeat(201),
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        { field: "colorways[1].id", code: "taken" },
        { field: "colorways[2].id", code: "format" },
        { field: "colorways[2].nameEn", code: "required" },
        { field: "colorways[2].hex", code: "format" },
        { field: "sizes[1]", code: "taken" },
        { field: "sizes[2]", code: "format" },
        { field: "defaultColorway", code: "mismatch" },
        { field: "fitEn", code: "too_long" },
      ])
    );
  });
});
