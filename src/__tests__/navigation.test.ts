import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import es from "../messages/es.json";
import { PRIMARY_NAV, activeNavKey, launchNav } from "../lib/navigation";

describe("activeNavKey", () => {
  it("marks Shop on the Shop page and on product pages", () => {
    expect(activeNavKey(PRIMARY_NAV, "/products", "")).toBe("shop");
    expect(activeNavKey(PRIMARY_NAV, "/products/eight-ball-tee", "?colorway=washed-black")).toBe("shop");
  });

  it("prefers the category item when the Shop is filtered to it", () => {
    expect(activeNavKey(PRIMARY_NAV, "/products", "?category=caps")).toBe("caps");
    expect(activeNavKey(PRIMARY_NAV, "/products", "category=tees&sort=price")).toBe("tees");
  });

  it("falls back to Shop for categories that have no item of their own", () => {
    expect(activeNavKey(PRIMARY_NAV, "/products", "?category=beanies")).toBe("shop");
  });

  it("covers nested pages and ignores look-alike prefixes", () => {
    expect(activeNavKey(PRIMARY_NAV, "/track/GL-1234", "")).toBe("track");
    expect(activeNavKey(PRIMARY_NAV, "/trackers", "")).toBeNull();
  });

  it("never marks an in-page anchor or an unrelated page", () => {
    expect(activeNavKey(PRIMARY_NAV, "/", "")).toBeNull();
    expect(activeNavKey(PRIMARY_NAV, "/account/orders", "")).toBeNull();
  });
});

describe("PRIMARY_NAV", () => {
  it("has a label in both locales for every item", () => {
    for (const { key } of PRIMARY_NAV) {
      expect(en.nav[key as keyof typeof en.nav], `en ${key}`).toBeTruthy();
      expect(es.nav[key as keyof typeof es.nav], `es ${key}`).toBeTruthy();
    }
  });
});

describe("launchNav (ADR 0022)", () => {
  const live = { headwear: { status: "live" as const }, apparel: { status: "live" as const } };

  it("keeps every item when both categories are live", () => {
    expect(launchNav(PRIMARY_NAV, live).map((i) => [i.key, i.soon])).toEqual(PRIMARY_NAV.map((i) => [i.key, false]));
  });

  it("removes a hidden category and flags a coming_soon one as soon", () => {
    const nav = launchNav(PRIMARY_NAV, { headwear: { status: "coming_soon" }, apparel: { status: "hidden" } });
    expect(nav.map((i) => i.key)).not.toContain("tees");
    expect(nav.find((i) => i.key === "caps")?.soon).toBe(true);
    expect(nav.find((i) => i.key === "shop")?.soon).toBe(false);
  });

  it("removes Try-On unless Caps are live", () => {
    expect(launchNav(PRIMARY_NAV, { ...live, headwear: { status: "hidden" } }).map((i) => i.key)).not.toContain("tryOn");
    expect(launchNav(PRIMARY_NAV, { ...live, headwear: { status: "coming_soon" } }).map((i) => i.key)).not.toContain("tryOn");
    expect(launchNav(PRIMARY_NAV, live).find((i) => i.key === "tryOn")?.soon).toBe(false);
  });
});
