/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
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
