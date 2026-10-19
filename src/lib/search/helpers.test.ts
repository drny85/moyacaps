import { describe, expect, it } from "vitest";
import { parseRecent, pushRecent } from "./recent";
import { isSearchShortcut } from "./shortcut";
import { shopHrefForQuery, shopStateForQuery } from "./shopLink";

describe("shopStateForQuery", () => {
  it("turns category, color and Silhouette words into Shop filters", () => {
    expect(shopHrefForQuery("gorra negra")).toBe("/products?category=caps&color=black");
    expect(shopHrefForQuery("white tee")).toBe("/products?category=tees&color=white");
    expect(shopHrefForQuery("trucker")).toBe("/products?category=caps&silhouette=trucker");
    expect(shopHrefForQuery("skull")).toBe("/products");
  });

  it("keeps every category when the query names both", () => {
    expect(shopStateForQuery("cap or tee").category).toBe("all");
    expect(shopStateForQuery("trucker shirt").silhouettes).toEqual([]);
  });
});

describe("pushRecent", () => {
  it("moves the query to the front without duplicates", () => {
    expect(pushRecent(["skull", "eagle"], "Eagle ")).toEqual(["Eagle", "skull"]);
    expect(pushRecent(["calavera"], "Calavéra")).toEqual(["Calavéra"]);
  });

  it("ignores blank queries and keeps the limit", () => {
    expect(pushRecent(["a"], "  ")).toEqual(["a"]);
    expect(pushRecent(["1", "2", "3"], "4", 3)).toEqual(["4", "1", "2"]);
  });

  it("reads stored values defensively", () => {
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent("not json")).toEqual([]);
    expect(parseRecent('{"a":1}')).toEqual([]);
    expect(parseRecent('["skull", 3, "eagle"]')).toEqual(["skull", "eagle"]);
  });
});

describe("isSearchShortcut", () => {
  const key = (over: Partial<Parameters<typeof isSearchShortcut>[0]>) =>
    isSearchShortcut({ key: "/", metaKey: false, ctrlKey: false, altKey: false, typing: false, ...over });

  it("opens on / unless the Customer is typing", () => {
    expect(key({})).toBe(true);
    expect(key({ typing: true })).toBe(false);
  });

  it("opens on Cmd+K and Ctrl+K even while typing", () => {
    expect(key({ key: "k", metaKey: true, typing: true })).toBe(true);
    expect(key({ key: "K", ctrlKey: true })).toBe(true);
    expect(key({ key: "k" })).toBe(false);
    expect(key({ key: "k", metaKey: true, altKey: true })).toBe(false);
  });
});
