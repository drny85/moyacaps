import { describe, expect, it } from "vitest";
import type { Doc, Id } from "./_generated/dataModel";
import {
  computedDropStatus,
  distributeStock,
  filterCatalogVariants,
  hasDropHistory,
  isPurchaseBlockedByDrop,
  isUpcomingDrop,
  mergeVariantUpdate,
  newVariantDoc,
  nextAvailability,
  renamedLifestyleShot,
  teeFieldsPatch,
  variantCategory,
  type VariantInput,
} from "./catalogModel";

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

const input = (overrides: Partial<VariantInput> = {}): VariantInput => ({
  variantId: "negro-rojo",
  nameEn: "Black / Red v2",
  nameEs: "Negro / Rojo v2",
  silhouette: "snapback",
  primaryHex: "#111",
  secondaryHex: "#e00",
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

describe("mergeVariantUpdate", () => {
  it("keeps stored optional fields the editor omitted", () => {
    const existing = variant({ category: "headwear", taxCode: "txcd_30060006", isDrop: true, dropDate: NOW, images: ["/a.png"] });
    const patch = mergeVariantUpdate(existing, input(), "/caps/new.png", false);
    expect(patch).toMatchObject({
      nameEn: "Black / Red v2",
      category: "headwear",
      taxCode: "txcd_30060006",
      images: ["/a.png"],
      isDrop: true,
      dropDate: NOW,
      stock: 9,
      priceUsd: 130,
      isAvailable: true,
    });
  });

  it("applies provided optional fields", () => {
    const patch = mergeVariantUpdate(variant({ category: "headwear" }), input({ category: "apparel", isAvailable: false }), "/x", false);
    expect(patch.category).toBe("apparel");
    expect(patch.isAvailable).toBe(false);
  });

  it("never overwrites a tee's SKU aggregate stock from the editor", () => {
    const patch = mergeVariantUpdate(variant({ stock: 40 }), input({ stock: 3 }), "/x", true);
    expect(patch.stock).toBe(40);
  });

  it("keeps a hidden product hidden when the editor omits isAvailable", () => {
    expect(mergeVariantUpdate(variant({ isAvailable: false }), input(), "/x", false).isAvailable).toBe(false);
  });
});

describe("newVariantDoc", () => {
  it("defaults new products to visible and not a drop", () => {
    const doc = newVariantDoc(input(), "/caps/new.png");
    expect(doc.isAvailable).toBe(true);
    expect(doc.isDrop).toBe(false);
    expect(doc.image).toBe("/caps/new.png");
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

