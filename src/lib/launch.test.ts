import { describe, expect, it } from "vitest";
import { isTryOnAvailable, liveShopCategories, statusFor, SHOP_TO_CATEGORY, teaserHeadline, teaserShopCategories } from "./launch";

const live = { headwear: { status: "live" as const }, apparel: { status: "live" as const } };

describe("launch", () => {
  it("statusFor maps caps/tees to headwear/apparel", () => {
    expect(SHOP_TO_CATEGORY).toEqual({ caps: "headwear", tees: "apparel" });
    const teesSoon = { ...live, apparel: { status: "coming_soon" as const } };
    expect(statusFor(teesSoon, "tees")).toBe("coming_soon");
    expect(statusFor(teesSoon, "caps")).toBe("live");
  });

  it("liveShopCategories and teaserShopCategories split by status", () => {
    const mixed = { headwear: { status: "hidden" as const }, apparel: { status: "coming_soon" as const } };
    expect(liveShopCategories(live)).toEqual(["caps", "tees"]);
    expect(liveShopCategories(mixed)).toEqual([]);
    expect(teaserShopCategories(mixed)).toEqual(["tees"]);
    expect(teaserShopCategories(live)).toEqual([]);
  });

  it("teaserHeadline uses the override for the locale, else the fallback", () => {
    const launch = { status: "coming_soon" as const, headlineEn: "Tees land Friday" };
    expect(teaserHeadline(launch, "en", "Default")).toBe("Tees land Friday");
    expect(teaserHeadline(launch, "es", "Por defecto")).toBe("Por defecto");
    expect(teaserHeadline({ status: "coming_soon", headlineEs: "  " }, "es", "Por defecto")).toBe("Por defecto");
  });
});

describe("isTryOnAvailable", () => {
  it("is true only while Caps are live (Try-On is caps only)", () => {
    expect(isTryOnAvailable(live)).toBe(true);
    expect(isTryOnAvailable({ ...live, headwear: { status: "hidden" } })).toBe(false);
    expect(isTryOnAvailable({ ...live, headwear: { status: "coming_soon" } })).toBe(false);
    expect(isTryOnAvailable({ ...live, apparel: { status: "hidden" } })).toBe(true);
  });
});
