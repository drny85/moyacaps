import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import es from "../messages/es.json";
import { PRIMARY_NAV, activeNavKey } from "../lib/navigation";

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
