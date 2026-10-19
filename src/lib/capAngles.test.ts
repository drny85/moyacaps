import { describe, expect, it } from "vitest";
import type { CapVariant } from "../data/caps";
import { getCapAngleImages, getCapCatalogShot, getCapFrontOverlay } from "./capAngles";

const cap = (over: Partial<CapVariant> = {}): CapVariant => ({
  id: "no-such-cap",
  nameEn: "x",
  nameEs: "x",
  silhouette: "snapback",
  primaryHex: "#000",
  secondaryHex: "#fff",
  image: "/x.png",
  stock: 1,
  priceUsd: 10,
  ...over,
});
const angles = { front: "u", left: "l", back: "b", right: "r" };

describe("capAngles", () => {
  it("prefers the uploaded angles", () => {
    expect(getCapFrontOverlay(cap({ angles }))).toBe("u");
    expect(getCapAngleImages(cap({ angles }))).toEqual(angles);
  });

  it("returns null when the cap has no uploaded or fallback angles", () => {
    expect(getCapFrontOverlay(cap())).toBeNull();
    expect(getCapAngleImages(cap())).toBeNull();
  });

  it("prefers the uploaded catalog shot", () => {
    expect(getCapCatalogShot(cap({ catalogShot: "c" }))).toBe("c");
    expect(getCapCatalogShot(cap())).toBeNull();
  });
});
