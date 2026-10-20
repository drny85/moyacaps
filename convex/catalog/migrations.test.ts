/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";
import { SEED_VARIANTS } from "./data";

const modules = import.meta.glob("/convex/**/*.ts");

const cap = {
  variantId: "old-cap",
  nameEn: "Old",
  nameEs: "Vieja",
  category: "headwear",
  silhouette: "snapback",
  primaryHex: "#111111",
  secondaryHex: "#d4af37",
  priceUsd: 45,
  stock: 10,
  image: "/caps/old.png",
  isFeatured: false,
};

function setup() {
  const t = convexTest(schema, modules);
  const admin = t.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL });
  return { t, admin };
}

describe("seedAll", () => {
  it("wipes variants, SKUs, product images and catalog events, and deletes their now-unreferenced files", async () => {
    const { t, admin } = setup();
    const files = await t.run(async (ctx) => {
      const legacy = await ctx.storage.store(new Blob(["legacy"]));
      const row = await ctx.storage.store(new Blob(["row"]));
      await ctx.db.insert("variants", { ...cap, storageId: legacy });
      await ctx.db.insert("skus", { variantId: cap.variantId, colorway: "black", size: "M", stock: 1 });
      await ctx.db.insert("productImages", { variantId: cap.variantId, role: "catalog", order: 0, storageId: row, sha256: "r", width: 2000, height: 2500, createdAt: 1 });
      // The migration may point a row at the legacy file itself.
      await ctx.db.insert("productImages", { variantId: cap.variantId, role: "lifestyle", order: 0, storageId: legacy, sha256: "l", width: 2000, height: 2500, createdAt: 1 });
      await ctx.db.insert("catalog_events", { variantId: cap.variantId, type: "created", actor: "a", createdAt: 1 });
      return { legacy, row };
    });

    expect(await admin.mutation(api.catalog.migrations.seedAll, {})).toEqual({ success: true, count: SEED_VARIANTS.length });

    const counts = await t.run(async (ctx) => ({
      variants: (await ctx.db.query("variants").take(1000)).length,
      old: await ctx.db.query("variants").withIndex("by_variantId", (q) => q.eq("variantId", cap.variantId)).first(),
      skus: (await ctx.db.query("skus").take(10)).length,
      images: (await ctx.db.query("productImages").take(10)).length,
      events: (await ctx.db.query("catalog_events").take(10)).length,
      legacy: await ctx.storage.get(files.legacy),
      row: await ctx.storage.get(files.row),
    }));
    expect(counts).toEqual({ variants: SEED_VARIANTS.length, old: null, skus: 0, images: 0, events: 0, legacy: null, row: null });
  });

  it("requires an administrator", async () => {
    const { t } = setup();
    await expect(t.mutation(api.catalog.migrations.seedAll, {})).rejects.toThrow();
  });
});

describe("backfillBadges", () => {
  it("fills a featured product with no badge, and keeps a badge the Administrator cleared", async () => {
    const { t } = setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("variants", { ...cap, variantId: "never-set", isFeatured: true });
      await ctx.db.insert("variants", { ...cap, variantId: "cleared", isFeatured: true, badgeTextEn: "", badgeTextEs: "" });
      await ctx.db.insert("variants", { ...cap, variantId: "custom", isFeatured: true, badgeTextEn: "Mine", badgeTextEs: "Mía" });
      await ctx.db.insert("variants", { ...cap, variantId: "plain" });
    });
    expect(await t.mutation(internal.catalog.migrations.backfillBadges, {})).toEqual({ updated: 1 });
    const badges = await t.run(async (ctx) =>
      Object.fromEntries((await ctx.db.query("variants").take(10)).map((v) => [v.variantId, [v.badgeTextEn ?? null, v.badgeTextEs ?? null]]))
    );
    expect(badges).toEqual({
      "never-set": ["Signature Edition", "Edición Insignia"],
      cleared: ["", ""],
      custom: ["Mine", "Mía"],
      plain: [null, null],
    });
  });
});

describe("backfillAvailability", () => {
  it("sets a missing isAvailable to true and leaves explicit values", async () => {
    const { t } = setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("variants", { ...cap, variantId: "unset" });
      await ctx.db.insert("variants", { ...cap, variantId: "hidden", isAvailable: false });
      await ctx.db.insert("variants", { ...cap, variantId: "shown", isAvailable: true });
    });

    const result = await t.mutation(internal.catalog.migrations.backfillAvailability, {});

    expect(result).toEqual({ patched: 1, isDone: true });
    const rows = await t.run((ctx) => ctx.db.query("variants").collect());
    const byId = Object.fromEntries(rows.map((r) => [r.variantId, r.isAvailable]));
    expect(byId).toEqual({ unset: true, hidden: false, shown: true });
  });
});

describe("backfillTaxCodes (plan 0008 PR 4)", () => {
  it("fills missing categories and tax codes, keeps stored ones, and lists unknown categories", async () => {
    const { t } = setup();
    const { category: _category, ...legacy } = cap;
    await t.run(async (ctx) => {
      await ctx.db.insert("variants", { ...legacy, variantId: "legacy-cap" });
      await ctx.db.insert("variants", { ...legacy, variantId: "legacy-tee", silhouette: "tee" });
      await ctx.db.insert("variants", { ...cap, variantId: "custom", taxCode: "txcd_99999999" });
      await ctx.db.insert("variants", { ...cap, variantId: "hoodie", category: "hoodies" });
    });

    const first = await t.mutation(internal.catalog.migrations.backfillTaxCodes, {});
    expect(first).toEqual({ patched: 2, needsReview: ["hoodie"], isDone: true });
    const rows = await t.run((ctx) => ctx.db.query("variants").collect());
    const byId = Object.fromEntries(rows.map((r) => [r.variantId, [r.category, r.taxCode]]));
    expect(byId).toEqual({
      "legacy-cap": ["headwear", "txcd_30060006"],
      "legacy-tee": ["apparel", "txcd_30011000"],
      custom: ["headwear", "txcd_99999999"],
      hoodie: ["hoodies", undefined],
    });

    expect(await t.mutation(internal.catalog.migrations.backfillTaxCodes, {})).toEqual({
      patched: 0,
      needsReview: ["hoodie"],
      isDone: true,
    });
  });

  it("seedAll gives every product a category and tax code", async () => {
    const { t, admin } = setup();
    await admin.mutation(api.catalog.migrations.seedAll, {});
    const rows = await t.run((ctx) => ctx.db.query("variants").take(500));
    for (const row of rows) {
      expect(row.taxCode).toBe(row.category === "apparel" ? "txcd_30011000" : "txcd_30060006");
    }
  });
});

describe("seedAll visibility (ADR 0022)", () => {
  it("seeds visible products unless the seed row hides them", async () => {
    const { t, admin } = setup();
    await admin.mutation(api.catalog.migrations.seedAll, {});
    const rows = await t.run((ctx) => ctx.db.query("variants").take(500));
    for (const row of rows) {
      const seed: { isAvailable?: boolean; variantId: string } = SEED_VARIANTS.find((s) => s.variantId === row.variantId)!;
      expect(row.isAvailable).toBe(seed.isAvailable ?? true);
    }
  });
});
