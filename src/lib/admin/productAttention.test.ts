import { describe, expect, it } from "vitest";
import { attentionReasons } from "./productAttention";
import { capRow, teeRow } from "./productFixtures";

describe("attentionReasons", () => {
  it("is empty for a complete product", () => {
    expect(attentionReasons(capRow())).toEqual([]);
    expect(attentionReasons(teeRow())).toEqual([]);
  });

  it("flags a cap without a Catalog Shot, blank or whitespace", () => {
    expect(attentionReasons(capRow({ catalogShot: undefined }))).toEqual(["no_catalog_shot"]);
    expect(attentionReasons(capRow({ catalogShot: "  " }))).toEqual(["no_catalog_shot"]);
  });

  it("flags a cap with incomplete Angle Shots", () => {
    expect(attentionReasons(capRow({ angles: undefined }))).toEqual(["angles_incomplete"]);
  });

  it("flags a tee colorway without a Catalog Shot", () => {
    const tee = teeRow();
    const colorways = [tee.colorways![0], { ...tee.colorways![1], catalogShot: "" }];
    expect(attentionReasons(teeRow({ colorways }))).toEqual(["colorway_missing_catalog_shot"]);
  });

  it("flags a tee with no Catalog Shot at all, and never angles", () => {
    const colorways = teeRow().colorways!.map((c) => ({ ...c, catalogShot: "" }));
    expect(attentionReasons(teeRow({ colorways, angles: undefined }))).toEqual(["no_catalog_shot"]);
  });

  it("flags a visible product with no stock, but not a hidden one", () => {
    expect(attentionReasons(capRow({ stock: 0 }))).toEqual(["visible_out_of_stock"]);
    expect(attentionReasons(capRow({ stock: 0, isAvailable: false }))).toEqual([]);
    expect(attentionReasons(teeRow({ skus: [{ colorway: "black", size: "M", stock: 0 }] }))).toEqual(["visible_out_of_stock"]);
  });

  it("reports nothing for an archived product", () => {
    expect(attentionReasons(capRow({ archivedAt: 1, catalogShot: undefined, stock: 0 }))).toEqual([]);
  });
});
