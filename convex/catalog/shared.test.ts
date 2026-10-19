/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import { validateCartLines } from "../payments/checkoutModel";
import schema from "../schema";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";
import { ConvexError } from "convex/values";
import { requireVariant, resolveProduct } from "./shared";

const modules = import.meta.glob("/convex/**/*.ts");

const cap = {
  variantId: "oro-negro",
  nameEn: "Gold / Black",
  nameEs: "Oro / Negro",
  category: "headwear" as const,
  silhouette: "snapback",
  primaryHex: "#111111",
  secondaryHex: "#d4af37",
  priceUsd: 45,
  stock: 10,
  image: "/caps/oro-negro.png",
  isFeatured: false,
  isAvailable: true,
};

async function setup() {
  const t = convexTest(schema, modules);
  await t.run((ctx) => ctx.db.insert("variants", cap));
  return t;
}

const resolve = (t: Awaited<ReturnType<typeof setup>>) =>
  t.run(async (ctx) => {
    const variant = await ctx.db.query("variants").withIndex("by_variantId", (q) => q.eq("variantId", cap.variantId)).unique();
    return await resolveProduct(ctx, variant!);
  });

describe("resolveProduct", () => {
  it("keeps legacy fields when the product has no rows", async () => {
    const t = await setup();
    const out = await resolve(t);
    expect(out).toMatchObject({ image: cap.image, isAvailable: true });
    expect(out.catalogShot).toBeUndefined();
    expect(out.angles).toBeUndefined();
  });

  it("reads catalogShot from the catalog row and ignores rows whose file is gone", async () => {
    const t = await setup();
    await t.run(async (ctx) => {
      const keep = await ctx.storage.store(new Blob(["a"]));
      const gone = await ctx.storage.store(new Blob(["b"]));
      await ctx.storage.delete(gone);
      const base = { variantId: cap.variantId, sha256: "x", width: 2000, height: 2500, createdAt: 1 };
      await ctx.db.insert("productImages", { ...base, role: "catalog", order: 0, storageId: keep });
      await ctx.db.insert("productImages", { ...base, role: "lifestyle", order: 0, storageId: gone });
    });
    const out = await resolve(t);
    expect(out.catalogShot).toMatch(/^https?:\/\//);
    expect(out.images).toBeUndefined();
  });
});

describe("derived product image", () => {
  /** A product created without an image, then given a Catalog Shot row and shown. */
  async function productWithCatalogRow() {
    const t = convexTest(schema, modules);
    const admin = t.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL });
    const { image: _image, ...editorPayload } = cap;
    await admin.mutation(api.catalog.admin.createVariant, editorPayload);
    const url = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["c"]));
      await ctx.db.insert("productImages", {
        variantId: cap.variantId,
        role: "catalog",
        order: 0,
        storageId,
        sha256: "x",
        width: 2000,
        height: 2500,
        createdAt: 1,
      });
      return (await ctx.storage.getUrl(storageId))!;
    });
    await admin.mutation(api.catalog.admin.toggleVariantAvailable, { variantId: cap.variantId, isAvailable: true });
    return { t, url };
  }

  it("prices a cart line with the catalog row URL", async () => {
    const { t, url } = await productWithCatalogRow();
    const variant = await t.query(api.catalog.queries.getVariantById, { variantId: cap.variantId });
    expect(variant?.image).toBe(url);
    const { validatedItems } = validateCartLines([{ variantId: cap.variantId, quantity: 1 }], [variant], [{ ok: true, available: 10 }], {
      locale: "en",
      flow: "checkout",
      now: 0,
    });
    expect(validatedItems[0].image).toBe(url);
    expect(validatedItems[0].image).not.toBe("");
  });

});

describe("requireVariant", () => {
  it("throws a structured not_found error for an unknown product", async () => {
    const t = convexTest(schema, modules);
    const data = await t.run(async (ctx) => {
      try {
        await requireVariant(ctx, "missing");
      } catch (e) {
        return e instanceof ConvexError ? e.data : "not a ConvexError";
      }
      return "did not throw";
    });
    expect(data).toEqual({ kind: "not_found", variantId: "missing" });
  });

  it("surfaces through admin mutations", async () => {
    const t = convexTest(schema, modules);
    const admin = t.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL });
    await expect(admin.mutation(api.catalog.admin.archiveVariant, { variantId: "missing" })).rejects.toThrow(/not_found/);
  });
});
