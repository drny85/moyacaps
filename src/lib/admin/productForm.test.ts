import { describe, expect, it } from "vitest";
import {
  storePath,
  emptyForm,
  formFromVariant,
  formToCreateArgs,
  formToPatch,
  isFormDirty,
  validateForm,
  withCategory,
  withNameEn,
} from "./productForm";
import type { ProductFormState, ResolvedVariant } from "./productForm";

const cap = {
  _id: "v1",
  _creationTime: 1,
  variantId: "moya-snap",
  nameEn: "Moya Snap",
  nameEs: "Moya Snap ES",
  silhouette: "snapback",
  category: "headwear",
  taxCode: "txcd_30060006",
  primaryHex: "#111111",
  secondaryHex: "#ffffff",
  image: "https://x/y.jpg",
  stock: 7,
  priceUsd: 45,
  isFeatured: false,
  isAvailable: true,
  descriptionEn: "Nice",
  subscribersCount: 0,
} as unknown as ResolvedVariant;

const colorway = (id: string) => ({
  id,
  nameEn: id,
  nameEs: id,
  hex: "#000000",
  borderHex: "#111111",
  lifestyleImage: "l",
  catalogShot: "c",
});

const tee = {
  ...cap,
  variantId: "moya-tee",
  silhouette: "tee",
  category: "apparel",
  taxCode: "txcd_30011000",
  stock: 12,
  sizes: ["S", "M"],
  defaultColorway: "black",
  colorways: [colorway("black"), colorway("bone")],
  fabricEn: "Cotton",
} as unknown as ResolvedVariant;

const validTee = (): ProductFormState => ({
  ...formFromVariant(tee),
});

describe("formFromVariant / formToPatch", () => {
  it("round trips to an empty patch", () => {
    expect(formToPatch(formFromVariant(cap), formFromVariant(cap))).toEqual({});
    expect(formToPatch(formFromVariant(tee), formFromVariant(tee))).toEqual({});
  });

  it("maps numbers to strings and strips shot paths from colorways", () => {
    const f = formFromVariant(tee);
    expect(f.priceUsd).toBe("45");
    expect(f.stock).toBe("12");
    expect(f.colorways[0]).toEqual({ id: "black", nameEn: "black", nameEs: "black", hex: "#000000", borderHex: "#111111" });
    expect(f.descriptionEn).toBe("Nice");
    expect(f.badgeTextEn).toBe("");
  });

  it("emits only the price when only the price changed", () => {
    const initial = formFromVariant(cap);
    expect(formToPatch(initial, { ...initial, priceUsd: "125" })).toEqual({ priceUsd: 125 });
  });

  it("clears an optional text with an empty string", () => {
    const initial = formFromVariant(cap);
    expect(formToPatch(initial, { ...initial, descriptionEn: "" })).toEqual({ descriptionEn: "" });
  });

  it("omits stock for apparel", () => {
    const initial = formFromVariant(tee);
    expect(formToPatch(initial, { ...initial, stock: "99" })).toEqual({});
  });

  it("compares colorways and sizes by value", () => {
    const initial = formFromVariant(tee);
    expect(formToPatch(initial, { ...initial, sizes: [...initial.sizes], colorways: initial.colorways.map((c) => ({ ...c })) })).toEqual({});
    expect(formToPatch(initial, { ...initial, sizes: ["S", "M", "L"] })).toEqual({ sizes: ["S", "M", "L"] });
    const colorways = [{ ...initial.colorways[0], hex: "#222222" }, initial.colorways[1]];
    expect(formToPatch(initial, { ...initial, colorways })).toEqual({ colorways });
  });

  it("re-points the default colorway when it was removed", () => {
    const initial = formFromVariant(tee);
    const current = { ...initial, colorways: [initial.colorways[1]] };
    expect(formToPatch(initial, current)).toEqual({ colorways: current.colorways, defaultColorway: "bone" });
  });

  it("sends a changed default colorway", () => {
    const initial = formFromVariant(tee);
    expect(formToPatch(initial, { ...initial, defaultColorway: "bone" })).toEqual({ defaultColorway: "bone" });
  });
});

describe("withCategory", () => {
  it("switching to apparel resets silhouette, tax code and seeds sizes", () => {
    const f = withCategory(emptyForm("headwear"), "apparel");
    expect(f.category).toBe("apparel");
    expect(f.silhouette).toBe("tee");
    expect(f.taxCode).toBe("txcd_30011000");
    expect(f.sizes).toEqual(["S", "M", "L", "XL", "2XL"]);
  });

  it("keeps a custom tax code and existing sizes", () => {
    const base = { ...emptyForm("headwear"), taxCode: "txcd_12345678" };
    expect(withCategory(base, "apparel").taxCode).toBe("txcd_12345678");
    const withSizes = { ...emptyForm("apparel"), sizes: ["M"] };
    expect(withCategory(withSizes, "apparel").sizes).toEqual(["M"]);
  });

  it("switching back to headwear resets silhouette", () => {
    const f = withCategory(emptyForm("apparel"), "headwear");
    expect(f.silhouette).toBe("snapback");
    expect(f.taxCode).toBe("txcd_30060006");
  });
});

describe("validateForm", () => {
  it("a valid tee has no errors", () => {
    expect(validateForm(validTee())).toEqual([]);
  });

  it("a tee with zero sizes gives a required error on sizes", () => {
    expect(validateForm({ ...validTee(), sizes: [] })).toContainEqual({ field: "sizes", code: "required" });
  });

  it("a tee with no colorways gives a required error", () => {
    expect(validateForm({ ...validTee(), colorways: [], defaultColorway: undefined })).toContainEqual({ field: "colorways", code: "required" });
  });

  it("flags duplicate colorway ids", () => {
    const f = validTee();
    const errors = validateForm({ ...f, colorways: [f.colorways[0], f.colorways[0]] });
    expect(errors).toContainEqual({ field: "colorways[1].id", code: "taken" });
  });

  it("empty and non-numeric price", () => {
    const f = formFromVariant(cap);
    expect(validateForm({ ...f, priceUsd: " " })).toContainEqual({ field: "priceUsd", code: "required" });
    expect(validateForm({ ...f, priceUsd: "abc" })).toContainEqual({ field: "priceUsd", code: "format" });
    expect(validateForm({ ...f, priceUsd: "0" })).toContainEqual({ field: "priceUsd", code: "range" });
    expect(validateForm({ ...f, priceUsd: "12.5" })).toEqual([]);
  });

  it("validates headwear stock but ignores it for apparel", () => {
    const f = formFromVariant(cap);
    expect(validateForm({ ...f, stock: "" })).toContainEqual({ field: "stock", code: "required" });
    expect(validateForm({ ...f, stock: "1.5" })).toContainEqual({ field: "stock", code: "range" });
    expect(validateForm({ ...validTee(), stock: "" })).toEqual([]);
  });

  it("accepts a removed default colorway (the patch re-points it)", () => {
    const f = validTee();
    expect(validateForm({ ...f, colorways: [f.colorways[1]] })).toEqual([]);
  });
});

describe("formToCreateArgs", () => {
  it("converts the string price", () => {
    const f = { ...emptyForm("headwear"), variantId: "new-cap", nameEn: "A", nameEs: "B", priceUsd: "12.5", stock: "3" };
    const args = formToCreateArgs(f);
    expect(args.priceUsd).toBe(12.5);
    expect(args.stock).toBe(3);
    expect(args.category).toBe("headwear");
    expect(args).not.toHaveProperty("colorways");
    expect(args).not.toHaveProperty("descriptionEn");
  });

  it("builds tee args without stock and defaults to the first colorway", () => {
    const f = { ...validTee(), defaultColorway: undefined };
    const args = formToCreateArgs(f);
    expect(args).not.toHaveProperty("stock");
    expect(args.defaultColorway).toBe("black");
    expect(args.sizes).toEqual(["S", "M"]);
    expect(args.fabricEn).toBe("Cotton");
    expect(args).not.toHaveProperty("fitEn");
  });
});

describe("withNameEn", () => {
  it("suggests the product id from the English name while it follows the name", () => {
    let form = withNameEn(emptyForm("headwear"), "Negro Oro", true);
    expect(form.variantId).toBe("negro-oro");
    form = withNameEn(form, "Negro Oro Flare", true);
    expect(form.variantId).toBe("negro-oro-flare");
  });

  it("keeps an id typed by hand", () => {
    const form = withNameEn({ ...emptyForm("headwear"), nameEn: "Negro", variantId: "custom-id" }, "Negro Oro", true);
    expect(form).toMatchObject({ nameEn: "Negro Oro", variantId: "custom-id" });
  });

  it("never suggests for a saved product", () => {
    const form = withNameEn({ ...emptyForm("headwear"), nameEn: "Negro", variantId: "negro" }, "Negro Oro", false);
    expect(form).toMatchObject({ nameEn: "Negro Oro", variantId: "negro" });
  });
});

describe("colorway list keys", () => {
  it("are never sent to the server", () => {
    const initial = validTee();
    const keyed = { ...initial, colorways: initial.colorways.map((c, i) => ({ ...c, uid: `c${i}` })) };
    expect(formToPatch(initial, keyed)).toEqual({});
    const edited = { ...keyed, colorways: [{ ...keyed.colorways[0], hex: "#222222" }, keyed.colorways[1]] };
    expect(formToPatch(initial, edited).colorways?.every((c) => !("uid" in c))).toBe(true);
    expect(formToCreateArgs({ ...edited, variantId: "new-tee" }).colorways?.every((c) => !("uid" in c))).toBe(true);
  });
});

describe("isFormDirty", () => {
  it("is false for an untouched form, list keys included", () => {
    const initial = validTee();
    expect(isFormDirty(initial, { ...initial, sizes: [...initial.sizes] })).toBe(false);
    expect(isFormDirty(initial, { ...initial, colorways: initial.colorways.map((c) => ({ ...c, uid: "k" })) })).toBe(false);
  });

  it("notices text, flag, size, colorway and default changes", () => {
    const initial = validTee();
    expect(isFormDirty(initial, { ...initial, priceUsd: "1" })).toBe(true);
    expect(isFormDirty(initial, { ...initial, isFeatured: !initial.isFeatured })).toBe(true);
    expect(isFormDirty(initial, { ...initial, sizes: ["S"] })).toBe(true);
    expect(isFormDirty(initial, { ...initial, colorways: [initial.colorways[0]] })).toBe(true);
    expect(isFormDirty(initial, { ...initial, defaultColorway: "bone" })).toBe(true);
  });
});

describe("a new Product", () => {
  it("starts hidden: images come after creation, and a visible Product needs a Catalog Shot", () => {
    expect(emptyForm("headwear").isAvailable).toBe(false);
    expect(emptyForm("apparel").isAvailable).toBe(false);
  });

  it("previews the store path from the slug", () => {
    expect(storePath("gothic-skull-tee")).toBe("/products/gothic-skull-tee");
    expect(storePath("")).toBe("/products/…");
  });
});

describe("default price", () => {
  it("starts a new Cap at 120 and a new Tee at 80", () => {
    expect(emptyForm("headwear").priceUsd).toBe("120");
    expect(emptyForm("apparel").priceUsd).toBe("80");
  });
  it("switches the price with the category while it is still the default", () => {
    expect(withCategory(emptyForm("headwear"), "apparel").priceUsd).toBe("80");
  });
  it("keeps a typed price across a category switch", () => {
    expect(withCategory({ ...emptyForm("headwear"), priceUsd: "95" }, "apparel").priceUsd).toBe("95");
  });
});
