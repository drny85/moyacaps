/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";

const modules = import.meta.glob("/convex/**/*.ts");

const SIZES = ["S", "M", "L", "XL", "2XL"];
const cw = (id: string) => ({ id, nameEn: id, nameEs: id, hex: "#111111", borderHex: "#222222" });
const tee = {
  variantId: "angel-tee",
  nameEn: "Angel Tee",
  nameEs: "Camiseta Angel",
  category: "apparel" as const,
  silhouette: "tee",
  primaryHex: "#111111",
  secondaryHex: "#ffffff",
  priceUsd: 80,
  stock: 99,
  isFeatured: false,
  colorways: [cw("black"), cw("lime")],
  sizes: SIZES,
};

function setup() {
  const t = convexTest(schema, modules);
  const admin = t.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL });
  return { t, admin };
}

async function errorData(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof ConvexError) return e.data;
    throw e;
  }
  throw new Error("expected the call to throw");
}

const skusOf = (t: ReturnType<typeof setup>["t"]) => t.run((ctx) => ctx.db.query("skus").take(200));
const rowOf = (t: ReturnType<typeof setup>["t"]) =>
  t.run((ctx) => ctx.db.query("variants").withIndex("by_variantId", (q) => q.eq("variantId", tee.variantId)).unique());

async function createdTee() {
  const ctx = setup();
  await ctx.admin.mutation(api.catalog.admin.createVariant, tee);
  return { ...ctx, updatedAt: (await rowOf(ctx.t))!.updatedAt! };
}

describe("createVariant for a tee", () => {
  it("inserts one zero-stock SKU per colorway x size and ignores stock", async () => {
    const { t } = await createdTee();
    const skus = await skusOf(t);
    expect(skus).toHaveLength(10);
    expect(skus.every((s) => s.stock === 0)).toBe(true);
    const row = await rowOf(t);
    expect(row?.stock).toBe(0);
    expect(row?.defaultColorway).toBe("black");
    expect(row?.colorways?.[0]).toMatchObject({ id: "black", lifestyleImage: "", catalogShot: "" });
  });

  it("rejects a tee without colorways or sizes, and a bad colorway hex", async () => {
    const { admin } = setup();
    const data = (await errorData(
      admin.mutation(api.catalog.admin.createVariant, { ...tee, colorways: [{ ...cw("black"), hex: "nope" }], sizes: [] })
    )) as { errors: { field: string; code: string }[] };
    expect(data.errors).toEqual(
      expect.arrayContaining([
        { field: "colorways[0].hex", code: "format" },
        { field: "sizes", code: "required" },
      ])
    );
  });

  it("rejects tee fields on a headwear product", async () => {
    const { admin } = setup();
    const data = (await errorData(
      admin.mutation(api.catalog.admin.createVariant, {
        ...tee,
        category: "headwear",
        silhouette: "snapback",
      })
    )) as { errors: { field: string; code: string }[] };
    expect(data.errors).toEqual(
      expect.arrayContaining([
        { field: "colorways", code: "mismatch" },
        { field: "sizes", code: "mismatch" },
      ])
    );
  });
});

describe("updateVariant tee options", () => {
  it("adding a size adds one SKU per colorway", async () => {
    const { t, admin, updatedAt } = await createdTee();
    await admin.mutation(api.catalog.admin.updateVariant, {
      variantId: tee.variantId,
      expectedUpdatedAt: updatedAt,
      patch: { sizes: [...SIZES, "3XL"] },
    });
    const skus = await skusOf(t);
    expect(skus).toHaveLength(12);
    expect(skus.filter((s) => s.size === "3XL").map((s) => s.colorway).sort()).toEqual(["black", "lime"]);
  });

  it("removing an empty colorway deletes its SKUs and image rows, and keeps kept shots", async () => {
    const { t, admin, updatedAt } = await createdTee();
    await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["x"]));
      await ctx.db.insert("productImages", {
        variantId: tee.variantId,
        colorway: "lime",
        role: "catalog",
        order: 0,
        storageId,
        sha256: "a",
        width: 1,
        height: 1,
        createdAt: 1,
      });
    });
    await admin.mutation(api.catalog.admin.updateVariant, {
      variantId: tee.variantId,
      expectedUpdatedAt: updatedAt,
      patch: { colorways: [cw("black")] },
    });
    expect(await skusOf(t)).toHaveLength(5);
    expect(await t.run((ctx) => ctx.db.query("productImages").take(10))).toHaveLength(0);
    expect((await rowOf(t))?.colorways).toHaveLength(1);
  });

  it("throws sku_in_stock for a stocked colorway and leaves rows untouched", async () => {
    const { t, admin, updatedAt } = await createdTee();
    await admin.mutation(api.catalog.admin.setTeeSkuStock, { variantId: tee.variantId, colorway: "lime", size: "M", stock: 2 });
    const before = await rowOf(t);
    const data = await errorData(
      admin.mutation(api.catalog.admin.updateVariant, {
        variantId: tee.variantId,
        expectedUpdatedAt: before!.updatedAt!,
        patch: { colorways: [cw("black")] },
      })
    );
    expect(data).toEqual({ kind: "sku_in_stock", cells: [{ colorway: "lime", size: "M", stock: 2 }] });
    expect(await skusOf(t)).toHaveLength(10);
    expect(await rowOf(t)).toEqual(before);
    expect(updatedAt).toBeLessThanOrEqual(before!.updatedAt!);
  });

  it("rejects a default colorway that is not offered", async () => {
    const { admin, updatedAt } = await createdTee();
    const data = (await errorData(
      admin.mutation(api.catalog.admin.updateVariant, {
        variantId: tee.variantId,
        expectedUpdatedAt: updatedAt,
        patch: { defaultColorway: "nope" },
      })
    )) as { errors: { field: string; code: string }[] };
    expect(data.errors).toContainEqual({ field: "defaultColorway", code: "mismatch" });
  });
});

describe("backfillBadges", () => {
  it("fills featured rows without badges, once", async () => {
    const { t } = setup();
    const base = { nameEn: "n", nameEs: "n", primaryHex: "#111111", secondaryHex: "#222222", image: "/a.png", stock: 1, priceUsd: 10, taxCode: "txcd_30060006" };
    await t.run(async (ctx) => {
      await ctx.db.insert("variants", { ...base, variantId: "cap-a", silhouette: "snapback", isFeatured: true });
      await ctx.db.insert("variants", { ...base, variantId: "tee-a", silhouette: "tee", category: "apparel", isFeatured: true });
      await ctx.db.insert("variants", { ...base, variantId: "cap-b", silhouette: "snapback", isFeatured: true, badgeTextEn: "Custom" });
      await ctx.db.insert("variants", { ...base, variantId: "cap-c", silhouette: "snapback", isFeatured: false });
    });
    expect(await t.mutation(internal.catalog.migrations.backfillBadges, {})).toEqual({ updated: 2 });
    expect(await t.mutation(internal.catalog.migrations.backfillBadges, {})).toEqual({ updated: 0 });
    const get = (id: string) => t.run((ctx) => ctx.db.query("variants").withIndex("by_variantId", (q) => q.eq("variantId", id)).unique());
    expect(await get("cap-a")).toMatchObject({ badgeTextEn: "Signature Edition", badgeTextEs: "Edición Insignia" });
    expect(await get("tee-a")).toMatchObject({ badgeTextEn: "Heavyweight Drop", badgeTextEs: "Drop Heavyweight" });
    expect((await get("cap-b"))?.badgeTextEs).toBeUndefined();
    expect((await get("cap-c"))?.badgeTextEn).toBeUndefined();
  });
});
