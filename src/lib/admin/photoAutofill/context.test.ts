import { describe, expect, it } from "vitest";
import { catalogContextFrom } from "./context";
import { blackColorway, row, teeRow, whiteColorway } from "./testRows";

describe("catalogContextFrom", () => {
  it("dedupes colorways by id and strips image paths", () => {
    const ctx = catalogContextFrom([teeRow(), teeRow({ variantId: "eagle-tee", colorways: teeRow().colorways!.slice(0, 1) })]);
    expect(ctx.colorways).toEqual([blackColorway, whiteColorway]);
  });

  it("takes at most 3 examples, newest first", () => {
    const rows = [1, 2, 3, 4].map((n) => row({ variantId: `cap-${n}`, _creationTime: n, descriptionEn: `d${n}` }));
    expect(catalogContextFrom(rows).examples.map((e) => e.descriptionEn)).toEqual(["d4", "d3", "d2"]);
  });

  it("skips archived rows and rows missing a description as examples", () => {
    const ctx = catalogContextFrom([
      row({ variantId: "a", archivedAt: 5 }),
      row({ variantId: "b", descriptionEs: undefined }),
      row({ variantId: "c", descriptionEn: "" }),
    ]);
    expect(ctx.examples).toEqual([]);
  });

  it("lists every slug as taken, archived included", () => {
    const ctx = catalogContextFrom([row({ variantId: "a", archivedAt: 5 }), teeRow()]);
    expect(ctx.takenSlugs).toEqual(["a", "skull-tee"]);
  });

  it("falls back to the silhouette for a row saved without a category", () => {
    const ctx = catalogContextFrom([teeRow({ category: undefined })]);
    expect(ctx.examples[0].category).toBe("apparel");
  });
});
