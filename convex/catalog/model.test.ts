import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import {
  computedDropStatus,
  distributeStock,
  filterCatalogVariants,
  hasDropHistory,
  isPurchaseBlockedByDrop,
  isUpcomingDrop,
  blankImageWhileVisible,
  buildNewVariant,
  buildVariantPatch,
  nextUpdatedAt,
  validateMerged,
  versionOf,
  nextAvailability,
  renamedLifestyleShot,
  teeFieldsPatch,
  variantCategory,
  type NewVariantInput,
} from "./model";

const NOW = 1_800_000_000_000;
const HOUR = 60 * 60 * 1000;

function variant(overrides: Partial<Doc<"variants">> = {}): Doc<"variants"> {
  return {
    _id: "v1" as Id<"variants">,
    _creationTime: 0,
    variantId: "negro-rojo",
    nameEn: "Black / Red",
    nameEs: "Negro / Rojo",
    silhouette: "snapback",
    primaryHex: "#000",
    secondaryHex: "#f00",
    image: "/caps/negro-rojo.png",
    stock: 5,
    priceUsd: 120,
    isFeatured: false,
    ...overrides,
  };
}

const input = (overrides: Partial<NewVariantInput> = {}): NewVariantInput => ({
  variantId: "negro-rojo",
  nameEn: "Black / Red v2",
  nameEs: "Negro / Rojo v2",
  category: "headwear",
  silhouette: "snapback",
  primaryHex: "#111111",
  secondaryHex: "#ee0000",
  image: "/caps/new.png",
  stock: 9,
  priceUsd: 130,
  isFeatured: true,
  ...overrides,
});

describe("variantCategory", () => {
  it("uses the stored category when present", () => {
    expect(variantCategory({ category: "apparel", silhouette: "snapback" })).toBe("apparel");
  });

  it("derives apparel for tees and headwear for legacy caps", () => {
    expect(variantCategory({ silhouette: "tee" })).toBe("apparel");
    expect(variantCategory({ silhouette: "trucker" })).toBe("headwear");
  });
});

describe("filterCatalogVariants", () => {
  const cap = variant({ variantId: "cap" });
  const hidden = variant({ variantId: "hidden", isAvailable: false });
  const soldOut = variant({ variantId: "sold-out", stock: 0 });
  const tee = variant({ variantId: "tee", silhouette: "tee" });
  const all = [cap, hidden, soldOut, tee];
  const ids = (vs: Doc<"variants">[]) => vs.map((v) => v.variantId);

  it("hides unavailable products unless asked to include them", () => {
    expect(ids(filterCatalogVariants(all, {}))).toEqual(["cap", "sold-out", "tee"]);
    expect(ids(filterCatalogVariants(all, { includeUnavailable: true }))).toEqual(["cap", "hidden", "sold-out", "tee"]);
  });

  it("treats 'all' as no silhouette or category filter", () => {
    expect(ids(filterCatalogVariants(all, { silhouette: "all", category: "all" }))).toEqual(["cap", "sold-out", "tee"]);
  });

  it("filters by silhouette, derived category and stock", () => {
    expect(ids(filterCatalogVariants(all, { silhouette: "tee" }))).toEqual(["tee"]);
    expect(ids(filterCatalogVariants(all, { category: "headwear" }))).toEqual(["cap", "sold-out"]);
    expect(ids(filterCatalogVariants(all, { inStock: true }))).toEqual(["cap", "tee"]);
  });
});

describe("drop rules", () => {
  const scheduled = { isDrop: true, dropDate: NOW + HOUR, dropStatus: "scheduled" as const };

  it("isUpcomingDrop: visible, future and not live", () => {
    expect(isUpcomingDrop(scheduled, NOW)).toBe(true);
    expect(isUpcomingDrop({ ...scheduled, isAvailable: false }, NOW)).toBe(false);
    expect(isUpcomingDrop({ ...scheduled, dropStatus: "live" }, NOW)).toBe(false);
    expect(isUpcomingDrop({ ...scheduled, dropDate: NOW - 1 }, NOW)).toBe(false);
    expect(isUpcomingDrop({ isDrop: false, dropDate: NOW + HOUR }, NOW)).toBe(false);
  });

  it("hasDropHistory: any drop attribute counts", () => {
    expect(hasDropHistory({})).toBe(false);
    expect(hasDropHistory({ dropStatus: "archived" })).toBe(true);
    expect(hasDropHistory({ dropDate: NOW })).toBe(true);
  });

  it("computedDropStatus: live once released, scheduled before, else archived", () => {
    expect(computedDropStatus(scheduled, NOW)).toBe("scheduled");
    expect(computedDropStatus({ ...scheduled, dropDate: NOW - 1 }, NOW)).toBe("live");
    expect(computedDropStatus({ dropStatus: "live" }, NOW)).toBe("live");
    expect(computedDropStatus({ isDrop: false, dropStatus: "archived" }, NOW)).toBe("archived");
  });

  it("isPurchaseBlockedByDrop: blocks scheduled and future drops, never live ones", () => {
    expect(isPurchaseBlockedByDrop(scheduled, NOW)).toBe(true);
    // Scheduled status blocks even after the date passes, until an Administrator releases it.
    expect(isPurchaseBlockedByDrop({ ...scheduled, dropDate: NOW - HOUR }, NOW)).toBe(true);
    expect(isPurchaseBlockedByDrop({ isDrop: true, dropDate: NOW + HOUR }, NOW)).toBe(true);
    expect(isPurchaseBlockedByDrop({ ...scheduled, dropStatus: "live" }, NOW)).toBe(false);
    expect(isPurchaseBlockedByDrop({ isDrop: true, dropDate: NOW - HOUR }, NOW)).toBe(false);
    expect(isPurchaseBlockedByDrop({}, NOW)).toBe(false);
  });
});

describe("nextAvailability", () => {
  it("toggles when no value is given; legacy rows without the flag count as visible", () => {
    expect(nextAvailability(undefined, undefined)).toBe(false);
    expect(nextAvailability(false, undefined)).toBe(true);
    expect(nextAvailability(true, undefined)).toBe(false);
  });

  it("sets the requested value outright", () => {
    expect(nextAvailability(false, false)).toBe(false);
    expect(nextAvailability(true, true)).toBe(true);
  });
});

describe("versionOf / nextUpdatedAt", () => {
  it("falls back to the creation time for rows without updatedAt", () => {
    expect(versionOf(variant({ _creationTime: 500 }))).toBe(500);
    expect(versionOf(variant({ _creationTime: 500, updatedAt: 900 }))).toBe(900);
  });

  it("always moves past the current version, even on a stalled clock", () => {
    expect(nextUpdatedAt(variant({ updatedAt: 900 }), 100)).toBe(901);
    expect(nextUpdatedAt(variant({ updatedAt: 900 }), 2000)).toBe(2000);
  });
});

describe("buildVariantPatch", () => {
  it("carries only the fields sent, stamped with now", () => {
    expect(buildVariantPatch(variant(), { nameEn: "Renamed", isDrop: undefined }, NOW)).toEqual({ nameEn: "Renamed", updatedAt: NOW });
  });

  it("resets the tax code when the category changes without one", () => {
    const patch = buildVariantPatch(variant({ category: "headwear", taxCode: "txcd_30060006" }), { category: "apparel" }, NOW);
    expect(patch).toMatchObject({ category: "apparel", taxCode: "txcd_30011000" });
  });

  it("keeps a sent tax code and leaves the code alone when the category is unchanged", () => {
    const existing = variant({ category: "headwear" });
    expect(buildVariantPatch(existing, { category: "apparel", taxCode: "txcd_99999999" }, NOW).taxCode).toBe("txcd_99999999");
    expect(buildVariantPatch(existing, { category: "headwear" }, NOW)).not.toHaveProperty("taxCode");
  });
});

describe("buildNewVariant", () => {
  it("defaults to visible, not a drop, with the category's tax code and a stamp", () => {
    const doc = buildNewVariant(input(), NOW);
    expect(doc).toMatchObject({ isAvailable: true, isDrop: false, image: "/caps/new.png", taxCode: "txcd_30060006", updatedAt: NOW });
  });

  it("keeps a sent tax code", () => {
    expect(buildNewVariant(input({ category: "apparel", silhouette: "tee", taxCode: "txcd_11111111" }), NOW).taxCode).toBe("txcd_11111111");
  });

  it("saves a product with no image hidden, whatever isAvailable says", () => {
    expect(buildNewVariant(input({ image: undefined, isAvailable: true }), NOW)).toMatchObject({ image: "", isAvailable: false });
    expect(buildNewVariant(input({ image: "   ", isAvailable: true }), NOW)).toMatchObject({ image: "", isAvailable: false });
  });
});

describe("blankImageWhileVisible", () => {
  it("flags a visible product left without an image or upload", () => {
    expect(blankImageWhileVisible(variant(), { image: " " })).toBe(true);
    expect(blankImageWhileVisible(variant(), { image: "", isAvailable: false })).toBe(false);
    expect(blankImageWhileVisible(variant({ storageId: "s1" as Id<"_storage"> }), { image: "" })).toBe(false);
    expect(blankImageWhileVisible(variant(), { priceUsd: 5 })).toBe(false);
  });
});

describe("validateMerged", () => {
  it("validates the stored row with the patch applied", () => {
    expect(validateMerged(variant(), { priceUsd: 0 })).toEqual([{ field: "priceUsd", code: "range" }]);
    expect(validateMerged(variant(), { priceUsd: 99.5 })).toEqual([]);
  });

  it("checks the silhouette against the patched category", () => {
    expect(validateMerged(variant(), { category: "apparel" })).toEqual([{ field: "silhouette", code: "mismatch" }]);
  });

  it("limits errors to the fields a single-field mutation touches", () => {
    expect(validateMerged(variant({ primaryHex: "bad" }), { priceUsd: 10 }, ["priceUsd"])).toEqual([]);
  });
});

describe("renamedLifestyleShot", () => {
  it("maps old Lifestyle Shot paths and leaves others alone", () => {
    expect(renamedLifestyleShot("/shirts/gothic-angel-white.jpg")).toBe("/shirts/angel-clover-white.jpg");
    expect(renamedLifestyleShot("/shirts/other.jpg")).toBe("/shirts/other.jpg");
  });
});

describe("distributeStock", () => {
  it("keeps the total and covers every colorway × size", () => {
    const cells = distributeStock(23, ["black", "white"], "white");
    expect(cells).toHaveLength(10);
    expect(cells.reduce((sum, c) => sum + c.stock, 0)).toBe(23);
  });

  it("gives the remainder to the default colorway in the most common sizes first", () => {
    const cells = distributeStock(3, ["black", "white"], "white");
    expect(cells.filter((c) => c.stock > 0)).toEqual([
      { colorway: "white", size: "L", stock: 1 },
      { colorway: "black", size: "L", stock: 1 },
      { colorway: "white", size: "M", stock: 1 },
    ]);
  });
});

describe("teeFieldsPatch (catalog migration on an existing tee)", () => {
  const row = {
    image: "/uploads/admin-photo.jpg",
    images: ["/uploads/admin-photo.jpg"],
    colorways: undefined,
    fitEn: "Admin copy",
    printPosition: "back",
    graphicImage: "/shirts/graphics/old.jpg",
  };

  it("fills missing fields and never overwrites admin-editable ones", () => {
    const patch = teeFieldsPatch(row, { fitEn: "Seed copy", sizes: ["S", "M"], image: "/shirts/seed.jpg" });
    expect(patch).toEqual({ sizes: ["S", "M"] });
  });

  it("keeps data-owned fields in sync with the catalog data", () => {
    const patch = teeFieldsPatch(row, { printPosition: "front", graphicImage: "/shirts/graphics/new.jpg" });
    expect(patch).toEqual({ printPosition: "front", graphicImage: "/shirts/graphics/new.jpg" });
  });

  it("renames only Lifestyle Shot paths still on old file names", () => {
    const patch = teeFieldsPatch(
      {
        image: "/shirts/eagle-clover-black.png",
        images: ["/shirts/eagle-clover-black.png", "/shirts/graphics/eagle.jpg"],
        colorways: [{ id: "crisp-white", nameEn: "", nameEs: "", hex: "", borderHex: "", lifestyleImage: "/shirts/gothic-angel-white.jpg", catalogShot: "" }],
      },
      {}
    );
    expect(patch.image).toBe("/shirts/eagle-clover-black.jpg");
    expect(patch.images).toEqual(["/shirts/eagle-clover-black.jpg", "/shirts/graphics/eagle.jpg"]);
    expect((patch.colorways as Array<{ lifestyleImage: string }>)[0].lifestyleImage).toBe("/shirts/angel-clover-white.jpg");
  });

  it("returns an empty patch when nothing changes (re-runs are no-ops)", () => {
    expect(teeFieldsPatch(row, { fitEn: "Seed copy", printPosition: "back" })).toEqual({});
  });
});

