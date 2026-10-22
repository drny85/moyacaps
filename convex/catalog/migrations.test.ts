/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";
import { SEED_VARIANTS } from "./data";
import type { Doc } from "../_generated/dataModel";

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
  const admin = t.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL, emailVerified: true });
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

describe("purgeHiddenTees", () => {
  const tee = (variantId: string, isAvailable: boolean) => ({
    ...cap,
    variantId,
    category: "apparel",
    silhouette: "tee",
    isAvailable,
    colorways: [{ id: "washed-black", nameEn: "Black", nameEs: "Negro", hex: "#111", borderHex: "#222", lifestyleImage: "", catalogShot: "" }],
    sizes: ["M"],
  });

  function order(orderNumber: string, variantId: string, image: string, patch: Partial<Doc<"orders">> = {}) {
    return {
      orderNumber,
      items: [{ variantId, name: variantId, quantity: 1, price: 80, image, colorway: "washed-black", size: "M" }],
      currency: "USD",
      total: 80,
      paymentStatus: "paid" as const,
      fulfillmentStatus: "unfulfilled" as const,
      paymentMethod: "stripe" as const,
      createdAt: 1,
      ...patch,
    };
  }

  /** Two hidden Tees (one bought, its photo linked from the Order), one visible Tee and one hidden Cap. */
  async function seed(t: ReturnType<typeof convexTest>) {
    return await t.run(async (ctx) => {
      for (const row of [tee("old-tee", false), tee("spare-tee", false), tee("live-tee", true), { ...cap, isAvailable: false }]) {
        await ctx.db.insert("variants", row);
        await ctx.db.insert("skus", { variantId: row.variantId, colorway: "washed-black", size: "M", stock: 3 });
      }
      const file = await ctx.storage.store(new Blob(["old-tee"]));
      await ctx.db.insert("productImages", { variantId: "old-tee", colorway: "washed-black", role: "catalog", order: 0, storageId: file, sha256: "o", width: 2000, height: 2500, createdAt: 1 });
      await ctx.db.insert("drop_alerts", { variantId: "old-tee", contact: "a@b.co", channel: "email", locale: "en", createdAt: 1 });
      const url = (await ctx.storage.getUrl(file))!;
      const orderId = await ctx.db.insert("orders", order("GL-OLD-1", "old-tee", url));
      await ctx.db.insert("orders", order("GL-OLD-2", "old-tee", "/shirts/old.jpg", { paymentStatus: "refunded" }));
      await ctx.db.insert("product_reviews", { variantId: "old-tee", clerkUserId: "user_1", orderId, rating: 5, locale: "en", displayName: "A", status: "published", createdAt: 1, updatedAt: 1, publishedAt: 1 });
      await ctx.db.insert("product_review_stats", { variantId: "old-tee", count: 1, ratingSum: 5 });
      return { file, orderId };
    });
  }

  const variantIds = (t: ReturnType<typeof convexTest>) =>
    t.run(async (ctx) => (await ctx.db.query("variants").take(10)).map((row) => row.variantId).sort());

  it("dry run lists every hidden Tee with what references it and deletes nothing", async () => {
    const { t } = setup();
    await seed(t);
    const result = await t.mutation(internal.catalog.migrations.purgeHiddenTees, { dryRun: true });
    expect(result).toMatchObject({ dryRun: true, count: 2, ordersTruncated: false });
    expect(result.tees.map((report) => report.variantId)).toEqual(["old-tee", "spare-tee"]);
    expect(result.tees[0]).toMatchObject({
      nameEn: "Old",
      archived: false,
      colorways: ["washed-black"],
      skus: 1,
      skuStock: 3,
      images: 1,
      hasLegacyStorageId: false,
      reviews: 1,
      dropAlerts: 1,
      orderNumbers: ["GL-OLD-2", "GL-OLD-1"],
      ordersLosingPhoto: ["GL-OLD-1"],
      openHolds: [],
    });
    expect(await variantIds(t)).toEqual(["live-tee", "old-cap", "old-tee", "spare-tee"]);
  });

  it("deletes exactly the listed Tees with their SKUs, alerts and images, and keeps Orders and reviews", async () => {
    vi.useFakeTimers();
    try {
      const { t } = setup();
      const { file, orderId } = await seed(t);
      const result = await t.mutation(internal.catalog.migrations.purgeHiddenTees, { variantIds: ["old-tee"] });
      expect(result).toMatchObject({ dryRun: false, count: 1 });
      await t.finishAllScheduledFunctions(vi.runAllTimers);

      expect(await variantIds(t)).toEqual(["live-tee", "old-cap", "spare-tee"]);
      await t.run(async (ctx) => {
        expect((await ctx.db.query("skus").take(10)).map((sku) => sku.variantId).sort()).toEqual(["live-tee", "old-cap", "spare-tee"]);
        expect(await ctx.db.query("productImages").take(5)).toEqual([]);
        expect(await ctx.db.query("drop_alerts").take(5)).toEqual([]);
        expect(await ctx.storage.get(file)).toBeNull();
        expect((await ctx.db.get("orders", orderId))?.items[0].variantId).toBe("old-tee");
        expect(await ctx.db.query("orders").take(5)).toHaveLength(2);
        expect(await ctx.db.query("product_reviews").take(5)).toHaveLength(1);
        expect(await ctx.db.query("product_review_stats").take(5)).toHaveLength(1);
      });
      const events = await t.run((ctx) => ctx.db.query("catalog_events").take(5));
      expect(events).toMatchObject([{ variantId: "old-tee", type: "purged", actor: "system:purge-hidden-tees" }]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses, deleting nothing, when any id is not a hidden Tee", async () => {
    const { t } = setup();
    await seed(t);
    for (const id of ["live-tee", "old-cap", "missing-tee"]) {
      await expect(t.mutation(internal.catalog.migrations.purgeHiddenTees, { variantIds: ["old-tee", id] })).rejects.toThrow(
        `${id}: not a hidden Tee`
      );
    }
    await expect(t.mutation(internal.catalog.migrations.purgeHiddenTees, {})).rejects.toThrow("variantIds is empty");
    expect(await variantIds(t)).toEqual(["live-tee", "old-cap", "old-tee", "spare-tee"]);
  });

  it("refuses a Tee held by an open Checkout Hold, and allows it once the hold is cancelled", async () => {
    const { t } = setup();
    await seed(t);
    const held = await t.run((ctx) =>
      ctx.db.insert("orders", order("GL-HOLD", "spare-tee", "/x.jpg", { paymentStatus: "awaiting_payment", checkoutHoldExpiresAt: 2 }))
    );
    await expect(t.mutation(internal.catalog.migrations.purgeHiddenTees, { variantIds: ["spare-tee"] })).rejects.toThrow(
      "spare-tee: held by an open Checkout Hold (GL-HOLD)"
    );
    await t.run((ctx) => ctx.db.patch("orders", held, { cancelledAt: 3, checkoutHoldReleasedAt: 3 }));
    expect(await t.mutation(internal.catalog.migrations.purgeHiddenTees, { variantIds: ["spare-tee"] })).toMatchObject({ count: 1 });
  });
});
