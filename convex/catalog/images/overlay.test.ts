import { describe, expect, it } from "vitest";
import { overlayProductImages, type ResolvedImageRow } from "./overlay";

const cap = { catalogShot: "/legacy-catalog.png", images: ["/legacy-life.jpg"] };
const tee = {
  catalogShot: "/legacy-tee.png",
  colorways: [
    { id: "black", lifestyleImage: "/l-black.jpg", catalogShot: "/c-black.png" },
    { id: "white", lifestyleImage: "/l-white.jpg", catalogShot: "/c-white.png" },
  ],
};
const row = (r: Partial<ResolvedImageRow> & Pick<ResolvedImageRow, "role" | "url">): ResolvedImageRow => ({ order: 0, ...r });

describe("overlayProductImages", () => {
  it("uses the catalog row as catalogShot", () => {
    expect(overlayProductImages(cap, [row({ role: "catalog", url: "https://s/c" })]).catalogShot).toBe("https://s/c");
  });

  it("keeps legacy values when there are no rows", () => {
    const out = overlayProductImages(cap, []);
    expect(out).toEqual(cap);
    expect(out.angles).toBeUndefined();
  });

  it("puts lifestyle rows into images in order", () => {
    const out = overlayProductImages(cap, [
      row({ role: "lifestyle", url: "b", order: 1 }),
      row({ role: "lifestyle", url: "a", order: 0 }),
    ]);
    expect(out.images).toEqual(["a", "b"]);
  });

  it("overrides only the colorway that has rows", () => {
    const out = overlayProductImages(tee, [
      row({ role: "catalog", colorway: "white", url: "w-new" }),
      row({ role: "lifestyle", colorway: "white", url: "wl-new" }),
    ]);
    expect(out.colorways).toEqual([
      tee.colorways[0],
      { id: "white", lifestyleImage: "wl-new", catalogShot: "w-new" },
    ]);
    expect(out.catalogShot).toBe("/legacy-tee.png");
  });

  it("sets angles only when all four exist", () => {
    const angles = (list: string[]) => list.map((a, i) => row({ role: "angle", angle: a as "front", url: `u-${a}`, order: i }));
    expect(overlayProductImages(cap, angles(["front", "left", "back"])).angles).toBeUndefined();
    expect(overlayProductImages(cap, angles(["front", "left", "back", "right"])).angles).toEqual({
      front: "u-front",
      left: "u-left",
      back: "u-back",
      right: "u-right",
    });
  });
});
