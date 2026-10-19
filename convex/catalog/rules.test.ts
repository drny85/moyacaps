import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import {
  normalizeSlug,
  resolveTaxCode,
  throwIfInvalid,
  validateProductFields,
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
      expect((e as ConvexError<unknown>).data).toEqual({ kind: "validation", errors });
    }
  });
});
