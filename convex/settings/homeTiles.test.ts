/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";
import { DEFAULT_HOME_TILES, validateHomeTilePick } from "./homeTilesModel";

const modules = import.meta.glob("/convex/**/*.ts");

const base = {
  nameEn: "X",
  nameEs: "X",
  primaryHex: "#000000",
  secondaryHex: "#ffffff",
  image: "",
  stock: 1,
  priceUsd: 120,
  isFeatured: false,
};

function setup() {
  const t = convexTest(schema, modules);
  const admin = t.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL, emailVerified: true });
  return { t, admin };
}

async function seed(t: ReturnType<typeof setup>["t"]) {
  await t.run(async (ctx) => {
    await ctx.db.insert("variants", { ...base, variantId: "red-snap", silhouette: "snapback", category: "headwear" });
    await ctx.db.insert("variants", { ...base, variantId: "old-snap", silhouette: "snapback", category: "headwear", archivedAt: 1 });
    await ctx.db.insert("variants", { ...base, variantId: "skull-tee", silhouette: "tee", category: "apparel" });
  });
}

describe("validateHomeTilePick", () => {
  const cap = { category: "headwear", silhouette: "snapback" };
  it("accepts a listed product of the tile's category", () => {
    expect(validateHomeTilePick("headwear", cap)).toEqual([]);
  });
  it("rejects a missing, archived or other-category product", () => {
    expect(validateHomeTilePick("headwear", null)).toEqual([{ field: "variantId", code: "required" }]);
    expect(validateHomeTilePick("headwear", { ...cap, archivedAt: 1 })).toEqual([{ field: "variantId", code: "range" }]);
    expect(validateHomeTilePick("apparel", cap)).toEqual([{ field: "variantId", code: "mismatch" }]);
  });
  it("reads a legacy row without a category from its silhouette", () => {
    expect(validateHomeTilePick("apparel", { silhouette: "tee" })).toEqual([]);
  });
});

describe("home tiles", () => {
  it("reads the built-in picks when none is stored", async () => {
    const { t } = setup();
    expect(await t.query(api.settings.homeTiles.getHomeTiles, {})).toEqual(DEFAULT_HOME_TILES);
  });

  it("stores one category's pick, keeps the other, and logs it", async () => {
    const { t, admin } = setup();
    await seed(t);
    await admin.mutation(api.settings.homeTiles.setHomeTile, { category: "headwear", variantId: "red-snap" });
    expect(await t.query(api.settings.homeTiles.getHomeTiles, {})).toEqual({ ...DEFAULT_HOME_TILES, headwear: "red-snap" });
    await admin.mutation(api.settings.homeTiles.setHomeTile, { category: "apparel", variantId: "skull-tee" });
    expect(await t.query(api.settings.homeTiles.getHomeTiles, {})).toEqual({ headwear: "red-snap", apparel: "skull-tee" });
    const log = await t.run((ctx) => ctx.db.query("catalog_events").take(5));
    expect(log.map((e) => e.type)).toEqual(["home_tile_set", "home_tile_set"]);
  });

  it("refuses a non-admin, an archived product and a product of the other category", async () => {
    const { t, admin } = setup();
    await seed(t);
    await expect(t.mutation(api.settings.homeTiles.setHomeTile, { category: "headwear", variantId: "red-snap" })).rejects.toThrow();
    await expect(admin.mutation(api.settings.homeTiles.setHomeTile, { category: "headwear", variantId: "old-snap" })).rejects.toThrow();
    await expect(admin.mutation(api.settings.homeTiles.setHomeTile, { category: "headwear", variantId: "skull-tee" })).rejects.toThrow();
    expect(await t.query(api.settings.homeTiles.getHomeTiles, {})).toEqual(DEFAULT_HOME_TILES);
  });
});
