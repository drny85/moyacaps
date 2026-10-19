/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";
import { TEE_STOCK_EDIT_ERROR } from "./model";

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
};

function setup() {
  const t = convexTest(schema, modules);
  const admin = t.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL });
  return { t, admin };
}
type Admin = ReturnType<typeof setup>["admin"];

async function errorData(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof ConvexError) return e.data;
    throw e;
  }
  throw new Error("expected the call to throw");
}

const history = (admin: Admin, variantId = cap.variantId) => admin.query(api.catalog.history.getVariantHistory, { variantId });
const row = async (t: ReturnType<typeof setup>["t"], variantId = cap.variantId) =>
  t.run((ctx) =>
    ctx.db
      .query("variants")
      .withIndex("by_variantId", (q) => q.eq("variantId", variantId))
      .unique()
  );

describe("createVariant", () => {
  it("creates the product and audits it", async () => {
    const { admin } = setup();
    const created = await admin.mutation(api.catalog.admin.createVariant, cap);
    expect(created.variantId).toBe(cap.variantId);
    const events = await history(admin);
    expect(events[0]).toMatchObject({ type: "created", actor: PRIMARY_ADMIN_EMAIL });
  });

  it("rejects a taken slug as a validation error on variantId", async () => {
    const { admin } = setup();
    await admin.mutation(api.catalog.admin.createVariant, cap);
    expect(await errorData(admin.mutation(api.catalog.admin.createVariant, cap))).toEqual({
      kind: "validation",
      errors: [{ field: "variantId", code: "taken" }],
    });
  });

  it("rejects a malformed slug instead of rewriting it", async () => {
    const { admin } = setup();
    expect(await errorData(admin.mutation(api.catalog.admin.createVariant, { ...cap, variantId: "Oro Negro" }))).toMatchObject({
      kind: "validation",
      errors: [{ field: "variantId", code: "format" }],
    });
  });

  it("defaults the tax code from the category", async () => {
    const { t, admin } = setup();
    await admin.mutation(api.catalog.admin.createVariant, { ...cap, variantId: "tee-one", category: "apparel", silhouette: "tee" });
    expect((await row(t, "tee-one"))?.taxCode).toBe("txcd_30011000");
  });

  it("hides a product that has no image, whatever isAvailable says", async () => {
    const { t, admin } = setup();
    await admin.mutation(api.catalog.admin.createVariant, { ...cap, image: undefined, isAvailable: true });
    const created = await row(t);
    expect(created?.isAvailable).toBe(false);
    expect(created?.image).toBe("");
  });

  it("requires an administrator", async () => {
    const { t } = setup();
    await expect(t.mutation(api.catalog.admin.createVariant, cap)).rejects.toThrow();
  });
});

describe("updateVariant", () => {
  async function created() {
    const ctx = setup();
    await ctx.admin.mutation(api.catalog.admin.createVariant, cap);
    const existing = await row(ctx.t);
    return { ...ctx, updatedAt: existing!.updatedAt! };
  }

  it("applies a patch with a fresh token and returns a newer updatedAt", async () => {
    const { t, admin, updatedAt } = await created();
    const result = await admin.mutation(api.catalog.admin.updateVariant, {
      variantId: cap.variantId,
      expectedUpdatedAt: updatedAt,
      patch: { nameEn: "Gold / Noir", priceUsd: 50 },
    });
    expect(result.updatedAt).toBeGreaterThan(updatedAt);
    expect(await row(t)).toMatchObject({ nameEn: "Gold / Noir", priceUsd: 50, updatedAt: result.updatedAt });
    expect((await history(admin))[0]).toMatchObject({
      type: "updated",
      changes: [
        { field: "nameEn", from: "Gold / Black", to: "Gold / Noir" },
        { field: "priceUsd", from: 45, to: 50 },
      ],
    });
  });

  it("rejects a second update that reuses the old token as stale", async () => {
    const { admin, updatedAt } = await created();
    await admin.mutation(api.catalog.admin.updateVariant, {
      variantId: cap.variantId,
      expectedUpdatedAt: updatedAt,
      patch: { priceUsd: 50 },
    });
    expect(
      await errorData(
        admin.mutation(api.catalog.admin.updateVariant, {
          variantId: cap.variantId,
          expectedUpdatedAt: updatedAt,
          patch: { priceUsd: 60 },
        })
      )
    ).toEqual({ kind: "stale" });
  });

  it("treats a single-field mutation as a concurrent edit", async () => {
    const { admin, updatedAt } = await created();
    await admin.mutation(api.catalog.admin.updateVariantPrice, { variantId: cap.variantId, priceUsd: 55 });
    expect(
      await errorData(
        admin.mutation(api.catalog.admin.updateVariant, { variantId: cap.variantId, expectedUpdatedAt: updatedAt, patch: { nameEn: "X" } })
      )
    ).toEqual({ kind: "stale" });
  });

  it("uses the creation time as the token for rows without updatedAt", async () => {
    const { t, admin } = setup();
    const creationTime = await t.run(async (ctx) => {
      const { updatedAt: _omit, ...legacy } = { ...cap, isAvailable: true, isDrop: false, updatedAt: 0 };
      const id = await ctx.db.insert("variants", { ...legacy, stock: 10 });
      return (await ctx.db.get(id))!._creationTime;
    });
    const result = await admin.mutation(api.catalog.admin.updateVariant, {
      variantId: cap.variantId,
      expectedUpdatedAt: creationTime,
      patch: { priceUsd: 46 },
    });
    expect(result.updatedAt).toBeGreaterThan(creationTime);
  });

  it("validates the merged result", async () => {
    const { admin, updatedAt } = await created();
    expect(
      await errorData(
        admin.mutation(api.catalog.admin.updateVariant, {
          variantId: cap.variantId,
          expectedUpdatedAt: updatedAt,
          patch: { category: "apparel" },
        })
      )
    ).toEqual({ kind: "validation", errors: [{ field: "silhouette", code: "mismatch" }] });
  });

  it("skips the write and the event when nothing changed", async () => {
    const { admin, updatedAt } = await created();
    const result = await admin.mutation(api.catalog.admin.updateVariant, {
      variantId: cap.variantId,
      expectedUpdatedAt: updatedAt,
      patch: { priceUsd: cap.priceUsd },
    });
    expect(result.updatedAt).toBe(updatedAt);
    expect(await history(admin)).toHaveLength(1);
  });

  it("never edits tee stock through the patch", async () => {
    const { t, admin } = setup();
    await t.run((ctx) =>
      ctx.db.insert("variants", {
        ...cap,
        variantId: "tee-sku",
        category: "apparel",
        silhouette: "tee",
        colorways: [
          {
            id: "black",
            nameEn: "Black",
            nameEs: "Negro",
            hex: "#000000",
            borderHex: "#111111",
            lifestyleImage: "/l.jpg",
            catalogShot: "/c.jpg",
          },
        ],
        sizes: ["M"],
        updatedAt: 1000,
      })
    );
    expect(
      await errorData(
        admin.mutation(api.catalog.admin.updateVariant, { variantId: "tee-sku", expectedUpdatedAt: 1000, patch: { stock: 5 } })
      )
    ).toBe(TEE_STOCK_EDIT_ERROR);
  });
});

describe("single-field mutations", () => {
  it("rejects a zero price as a validation error", async () => {
    const { admin } = setup();
    await admin.mutation(api.catalog.admin.createVariant, cap);
    expect(await errorData(admin.mutation(api.catalog.admin.updateVariantPrice, { variantId: cap.variantId, priceUsd: 0 }))).toEqual({
      kind: "validation",
      errors: [{ field: "priceUsd", code: "range" }],
    });
  });

  it("audits a stock adjustment with the before and after values", async () => {
    const { admin } = setup();
    await admin.mutation(api.catalog.admin.createVariant, { ...cap, stock: 1 });
    await admin.mutation(api.catalog.admin.adjustVariantStock, { variantId: cap.variantId, delta: 2 });
    expect((await history(admin))[0]).toMatchObject({ type: "stock_adjusted", changes: [{ field: "stock", from: 1, to: 3 }] });
  });

  it("audits price, featured and visibility changes", async () => {
    const { admin } = setup();
    await admin.mutation(api.catalog.admin.createVariant, cap);
    await admin.mutation(api.catalog.admin.updateVariantPrice, { variantId: cap.variantId, priceUsd: 50 });
    await admin.mutation(api.catalog.admin.toggleVariantFeatured, { variantId: cap.variantId });
    await admin.mutation(api.catalog.admin.toggleVariantAvailable, { variantId: cap.variantId, isAvailable: false });
    expect((await history(admin)).map((e) => e.type)).toEqual(["visibility_set", "featured_toggled", "price_set", "created"]);
  });

  it("audits drop changes and purges", async () => {
    const { admin } = setup();
    await admin.mutation(api.catalog.admin.createVariant, cap);
    await admin.mutation(api.catalog.drops.scheduleDrop, { variantId: cap.variantId, dropDate: 4_000_000_000_000 });
    expect((await history(admin))[0]).toMatchObject({ type: "drop_changed" });
    await admin.mutation(api.catalog.admin.deleteVariant, { variantId: cap.variantId });
    expect((await history(admin))[0]).toMatchObject({ type: "purged" });
  });
});
