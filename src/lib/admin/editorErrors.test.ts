import { describe, expect, it } from "vitest";
import { editorFeedback, editorFieldKey, fieldErrorFor, formatSkuCells, isEditorField, splitFieldErrors } from "./editorErrors";

describe("editorFieldKey", () => {
  it("folds per-size errors onto the sizes input", () => {
    expect(editorFieldKey("sizes[2]")).toBe("sizes");
    expect(editorFieldKey("colorways[1].hex")).toBe("colorways[1].hex");
    expect(editorFieldKey("nameEn")).toBe("nameEn");
  });
});

describe("isEditorField", () => {
  it("knows the inputs the editor shows", () => {
    for (const field of ["variantId", "taxCode", "sizes", "defaultColorway", "colorways", "colorways[0].borderHex", "fitEs"]) {
      expect(isEditorField(field)).toBe(true);
    }
  });

  it("rejects fields without an input", () => {
    for (const field of ["image", "images", "dropDate", "colorways[0].catalogShot", "colorways[x].id"]) {
      expect(isEditorField(field)).toBe(false);
    }
  });
});

describe("splitFieldErrors", () => {
  it("keeps field errors under inputs and the rest at form level", () => {
    const feedback = splitFieldErrors([
      { field: "nameEn", code: "required" },
      { field: "sizes[1]", code: "format" },
      { field: "image", code: "required" },
    ]);
    expect(feedback.fieldErrors).toEqual([
      { field: "nameEn", code: "required" },
      { field: "sizes", code: "format" },
    ]);
    expect(feedback.formErrors).toEqual([{ field: "image", code: "required" }]);
    expect(feedback.banner).toBeNull();
  });
});

describe("editorFeedback", () => {
  it("maps validation errors, tee fields included", () => {
    const feedback = editorFeedback({
      kind: "validation",
      errors: [
        { field: "colorways[1].hex", code: "format" },
        { field: "defaultColorway", code: "mismatch" },
        { field: "dropBadgeTextEn", code: "too_long" },
      ],
    });
    expect(feedback.fieldErrors).toEqual([
      { field: "colorways[1].hex", code: "format" },
      { field: "defaultColorway", code: "mismatch" },
    ]);
    expect(feedback.formErrors).toEqual([{ field: "dropBadgeTextEn", code: "too_long" }]);
    expect(feedback.banner).toBeNull();
  });

  it("treats a validation payload without errors as no field errors", () => {
    expect(editorFeedback({ kind: "validation" })).toEqual({ fieldErrors: [], formErrors: [], banner: null });
  });

  it("maps stale to the reload banner", () => {
    expect(editorFeedback({ kind: "stale" }).banner).toEqual({ kind: "stale" });
  });

  it("keeps the blocked SKU cells", () => {
    const cells = [
      { colorway: "black", size: "M", stock: 3 },
      { colorway: "black", size: "L", stock: 1 },
    ];
    expect(editorFeedback({ kind: "sku_in_stock", cells }).banner).toEqual({ kind: "sku_in_stock", cells });
  });

  it("drops malformed SKU cells", () => {
    const banner = editorFeedback({ kind: "sku_in_stock", cells: [{ colorway: "black" }, { colorway: "white", size: "S", stock: 2 }] }).banner;
    expect(banner).toEqual({ kind: "sku_in_stock", cells: [{ colorway: "white", size: "S", stock: 2 }] });
  });

  it("maps needs_image and archived", () => {
    expect(editorFeedback({ kind: "needs_image" }).banner).toEqual({ kind: "needs_image" });
    expect(editorFeedback({ kind: "archived" }).banner).toEqual({ kind: "archived" });
  });

  it("maps an image rule code", () => {
    expect(editorFeedback({ kind: "image_rule", code: "too_small" }).banner).toEqual({ kind: "image_rule", code: "too_small" });
    expect(editorFeedback({ kind: "image_rule", code: "bogus" }).banner).toEqual({ kind: "image_rule", code: "unknown" });
  });

  it("passes a plain string message through", () => {
    expect(editorFeedback("Tee stock is edited per SKU").banner).toEqual({ kind: "message", text: "Tee stock is edited per SKU" });
  });

  it("falls back to unknown", () => {
    expect(editorFeedback(undefined).banner).toEqual({ kind: "unknown" });
    expect(editorFeedback({ kind: "something_else" }).banner).toEqual({ kind: "unknown" });
    expect(editorFeedback(42).banner).toEqual({ kind: "unknown" });
  });
});

describe("fieldErrorFor", () => {
  it("finds the first error for a field", () => {
    const feedback = splitFieldErrors([
      { field: "nameEn", code: "required" },
      { field: "nameEn", code: "too_long" },
    ]);
    expect(fieldErrorFor(feedback, "nameEn")).toEqual({ field: "nameEn", code: "required" });
    expect(fieldErrorFor(feedback, "nameEs")).toBeUndefined();
  });
});

describe("formatSkuCells", () => {
  it("names each blocked cell with its stock", () => {
    const cells = [
      { colorway: "black", size: "M", stock: 3 },
      { colorway: "sand", size: "XL", stock: 1 },
    ];
    expect(formatSkuCells(cells)).toBe("black / M (3), sand / XL (1)");
    expect(formatSkuCells(cells, (id) => (id === "black" ? "Black" : id))).toBe("Black / M (3), sand / XL (1)");
  });
});
