import { describe, expect, it } from "vitest";
import { collectImageSources, type ImageSource } from "./productImageSources";

const angles = (id: string) => ({
  front: `/catalog/caps/${id}/front.webp`,
  left: `/catalog/caps/${id}/left.webp`,
  back: `/catalog/caps/${id}/back.webp`,
  right: `/catalog/caps/${id}/right.webp`,
});

const shots = {
  caps: {
    "cap-a": { catalog: "/catalog/caps/cap-a.webp", angles: angles("cap-a") },
    "cap-b": { catalog: "/catalog/caps/cap-b.webp", angles: angles("cap-b") },
    "cap-gone": { catalog: "/catalog/caps/cap-gone.webp", angles: angles("cap-gone") },
  },
  tees: {
    "tee-x": { colorways: { black: "/catalog/tees/tee-x/black.webp", white: "/catalog/tees/tee-x/white.webp" } },
  },
};

const manifest = {
  "cap-c": {
    angles: {
      front: "/images/caps/processed/cap-c/front.png",
      right: "/images/caps/processed/cap-c/right.png",
      back: "/images/caps/processed/cap-c/back.png",
      left: "/images/caps/processed/cap-c/left.png",
    },
  },
};

const variants = [
  { variantId: "cap-a", image: "/caps/cap-a.png", images: ["/caps/cap-a.png", "/lifestyle/cap-a-1.jpg", "https://cdn.example/x.jpg"] },
  { variantId: "cap-b", image: "https://convex.cloud/api/storage/abc" },
  { variantId: "cap-c", image: "/caps/cap-c.png" },
  {
    variantId: "tee-x",
    image: "/tees/tee-x.png",
    colorways: [
      { id: "black", lifestyleImage: "/lifestyle/tee-x-black.jpg" },
      { id: "white", lifestyleImage: "https://convex.cloud/api/storage/def" },
    ],
  },
];

const at = (list: ImageSource[], variantId: string) => list.filter((s) => s.variantId === variantId);

describe("collectImageSources", () => {
  const out = collectImageSources(shots, manifest, variants);

  it("maps a cap to a catalog source, four angles and its lifestyle images", () => {
    expect(at(out, "cap-a")).toEqual([
      { variantId: "cap-a", role: "catalog", publicPath: "/catalog/caps/cap-a.webp" },
      { variantId: "cap-a", role: "angle", angle: "front", publicPath: "/catalog/caps/cap-a/front.webp" },
      { variantId: "cap-a", role: "angle", angle: "left", publicPath: "/catalog/caps/cap-a/left.webp" },
      { variantId: "cap-a", role: "angle", angle: "back", publicPath: "/catalog/caps/cap-a/back.webp" },
      { variantId: "cap-a", role: "angle", angle: "right", publicPath: "/catalog/caps/cap-a/right.webp" },
      { variantId: "cap-a", role: "lifestyle", publicPath: "/lifestyle/cap-a-1.jpg" },
    ]);
  });

  it("skips absolute URLs (already resolved from Convex)", () => {
    expect(out.some((s) => s.publicPath.startsWith("http"))).toBe(false);
    expect(at(out, "cap-b")).toHaveLength(5);
  });

  it("maps a tee to per-colorway catalog and lifestyle sources", () => {
    expect(at(out, "tee-x")).toEqual([
      { variantId: "tee-x", role: "catalog", colorway: "black", publicPath: "/catalog/tees/tee-x/black.webp" },
      { variantId: "tee-x", role: "catalog", colorway: "white", publicPath: "/catalog/tees/tee-x/white.webp" },
      { variantId: "tee-x", role: "lifestyle", colorway: "black", publicPath: "/lifestyle/tee-x-black.jpg" },
    ]);
  });

  it("falls back to the cap manifest for angles when the shots file has none", () => {
    expect(at(out, "cap-c").map((s) => s.angle)).toEqual(["front", "left", "back", "right"]);
    expect(at(out, "cap-c")[0].publicPath).toBe("/images/caps/processed/cap-c/front.png");
  });

  it("ignores products that are not in the variants list", () => {
    expect(at(out, "cap-gone")).toEqual([]);
  });

  it("dedupes repeated paths", () => {
    const dup = collectImageSources(
      { caps: {}, tees: {} },
      {},
      [{ variantId: "v", image: "/a.png", images: ["/b.jpg", "/b.jpg", "/a.png"] }],
    );
    expect(dup).toEqual([{ variantId: "v", role: "lifestyle", publicPath: "/b.jpg" }]);
  });

  it("skips tee JSON colorways the variant does not offer", () => {
    const only = collectImageSources(shots, manifest, [{ variantId: "tee-x", colorways: [{ id: "black" }] }]);
    expect(only.map((s) => s.colorway)).toEqual(["black"]);
  });
});
