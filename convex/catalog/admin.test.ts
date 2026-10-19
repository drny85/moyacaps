/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
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
  isFeatured: false,
};

function setup() {
  const t = convexTest(schema, modules);
  const admin = t.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL });
  /** Create the cap, then give it an image and show it, as an Administrator would after attaching its Catalog Shot. */
  const createShown = async () => {
    await admin.mutation(api.catalog.admin.createVariant, cap);
    await t.run(async (ctx) => {
      const created = await ctx.db.query("variants").withIndex("by_variantId", (q) => q.eq("variantId", cap.variantId)).unique();
      await ctx.db.patch("variants", created!._id, { image: "/caps/oro-negro.png", isAvailable: true });
    });
  };
  return { t, admin, createShown };
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
    await admin.mutation(api.catalog.admin.createVariant, {
      ...cap,
      variantId: "tee-one",
      category: "apparel",
      silhouette: "tee",
      colorways: [{ id: "black", nameEn: "Black", nameEs: "Negro", hex: "#000000", borderHex: "#111111" }],
      sizes: ["M"],
    });
    expect((await row(t, "tee-one"))?.taxCode).toBe("txcd_30011000");
  });

  it("hides a product that has no image, whatever isAvailable says", async () => {
    const { t, admin } = setup();
    await admin.mutation(api.catalog.admin.createVariant, { ...cap, isAvailable: true });
    const created = await row(t);
    expect(created?.isAvailable).toBe(false);
    expect(created?.image).toBe("");
  });

  it("requires an administrator", async () => {
    const { t } = setup();
    expect(await errorData(t.mutation(api.catalog.admin.createVariant, cap))).toMatch(/^Unauthorized/);
    const outsider = t.withIdentity({ subject: "user_x", email: "nobody@example.com" });
    expect(await errorData(outsider.mutation(api.catalog.admin.createVariant, cap))).toMatch(/^Forbidden/);
  });
});

describe("updateVariant", () => {
  async function created() {
    const ctx = setup();
    await ctx.createShown();
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
      const { updatedAt: _omit, ...legacy } = { ...cap, image: "/caps/oro-negro.png", isAvailable: true, isDrop: false, updatedAt: 0 };
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
    ).toEqual({ kind: "validation", errors: expect.arrayContaining([{ field: "silhouette", code: "mismatch" }]) });
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

  it("no longer accepts the legacy image fields", async () => {
    const { t, admin, updatedAt } = await created();
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
    for (const patch of [{ image: "" }, { storageId }, { images: ["/a.jpg"] }]) {
      await expect(
        admin.mutation(api.catalog.admin.updateVariant, { variantId: cap.variantId, expectedUpdatedAt: updatedAt, patch: patch as never })
      ).rejects.toThrow(/Validator error/);
    }
    await expect(admin.mutation(api.catalog.admin.createVariant, { ...cap, variantId: "other", image: "/x.png" } as never)).rejects.toThrow(
      /Validator error/
    );
    expect((await row(t))?.image).toBe("/caps/oro-negro.png");
  });

  it("never edits tee stock through the patch", async () => {
    const { t, admin } = setup();
    await t.run((ctx) =>
      ctx.db.insert("variants", {
        ...cap, image: "/caps/oro-negro.png",
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
    const { admin, createShown } = setup();
    await createShown();
    await admin.mutation(api.catalog.admin.updateVariantPrice, { variantId: cap.variantId, priceUsd: 50 });
    await admin.mutation(api.catalog.admin.toggleVariantFeatured, { variantId: cap.variantId });
    await admin.mutation(api.catalog.admin.toggleVariantAvailable, { variantId: cap.variantId, isAvailable: false });
    expect((await history(admin)).map((e) => e.type)).toEqual(["visibility_set", "featured_toggled", "price_set", "created"]);
  });

  it("audits drop changes and purges", async () => {
    const { t, admin } = setup();
    await admin.mutation(api.catalog.admin.createVariant, cap);
    await admin.mutation(api.catalog.drops.scheduleDrop, { variantId: cap.variantId, dropDate: 4_000_000_000_000 });
    expect((await history(admin))[0]).toMatchObject({ type: "drop_changed" });
    await t.mutation(internal.catalog.admin.purgeVariant, { variantId: cap.variantId });
    expect((await history(admin))[0]).toMatchObject({ type: "purged" });
  });
});

describe("updateVariantDropStatus with expectedUpdatedAt", () => {
  async function created() {
    const ctx = setup();
    await ctx.createShown();
    const existing = await row(ctx.t);
    return { ...ctx, updatedAt: existing!.updatedAt! };
  }

  it("returns the new updatedAt, which a following updateVariant accepts", async () => {
    const { t, admin, updatedAt } = await created();
    const result = await admin.mutation(api.catalog.drops.updateVariantDropStatus, {
      variantId: cap.variantId,
      isDrop: true,
      dropDate: 4_000_000_000_000,
      expectedUpdatedAt: updatedAt,
    });
    expect(result.updatedAt).toBeGreaterThan(updatedAt);
    expect((await row(t))!.updatedAt).toBe(result.updatedAt);
    await admin.mutation(api.catalog.admin.updateVariant, {
      variantId: cap.variantId,
      expectedUpdatedAt: result.updatedAt,
      patch: { priceUsd: 50 },
    });
    expect(await row(t)).toMatchObject({ priceUsd: 50, isDrop: true });
  });

  it("rejects a stale version and leaves the row alone", async () => {
    const { t, admin, updatedAt } = await created();
    await admin.mutation(api.catalog.admin.updateVariantPrice, { variantId: cap.variantId, priceUsd: 55 });
    expect(
      await errorData(
        admin.mutation(api.catalog.drops.updateVariantDropStatus, {
          variantId: cap.variantId,
          isDrop: true,
          dropDate: 4_000_000_000_000,
          expectedUpdatedAt: updatedAt,
        })
      )
    ).toEqual({ kind: "stale" });
    expect(await row(t)).toMatchObject({ priceUsd: 55, isDrop: false });
  });

  it("skips the check when no version is given", async () => {
    const { admin } = await created();
    await admin.mutation(api.catalog.admin.updateVariantPrice, { variantId: cap.variantId, priceUsd: 55 });
    const result = await admin.mutation(api.catalog.drops.updateVariantDropStatus, { variantId: cap.variantId, isDrop: false });
    expect(result).toMatchObject({ success: true, isDrop: false });
  });
});

describe("catalog image rows count as an image", () => {
  const blankCap = cap;
  const addCatalogRow = (t: ReturnType<typeof setup>["t"]) =>
    t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["x"]));
      await ctx.db.insert("productImages", { variantId: cap.variantId, role: "catalog", order: 0, storageId, sha256: "a", width: 2000, height: 2500, createdAt: 1 });
    });

  it("updateVariant allows a visible product whose only image is a row", async () => {
    const { t, admin } = setup();
    await admin.mutation(api.catalog.admin.createVariant, blankCap);
    const hidden = await row(t);
    expect(hidden?.isAvailable).toBe(false);
    const update = { variantId: cap.variantId, expectedUpdatedAt: hidden!.updatedAt!, patch: { isAvailable: true } };
    expect(await errorData(admin.mutation(api.catalog.admin.updateVariant, update))).toEqual({ kind: "needs_image" });
    await addCatalogRow(t);
    await admin.mutation(api.catalog.admin.updateVariant, update);
    expect((await row(t))?.isAvailable).toBe(true);
  });

  it("toggleVariantAvailable refuses to show a product with no image, allows one with a row", async () => {
    const { t, admin } = setup();
    await admin.mutation(api.catalog.admin.createVariant, blankCap);
    const show = { variantId: cap.variantId, isAvailable: true };
    expect(await errorData(admin.mutation(api.catalog.admin.toggleVariantAvailable, show))).toEqual({ kind: "needs_image" });
    await addCatalogRow(t);
    expect((await admin.mutation(api.catalog.admin.toggleVariantAvailable, show)).isAvailable).toBe(true);
  });

  const colorway = (id: string) => ({ id, nameEn: id, nameEs: id, hex: "#000000", borderHex: "#111111" });
  const createTee = (admin: ReturnType<typeof setup>["admin"]) =>
    admin.mutation(api.catalog.admin.createVariant, {
      ...blankCap,
      stock: undefined,
      category: "apparel",
      silhouette: "tee",
      colorways: [colorway("black"), colorway("white")],
      sizes: ["M"],
      defaultColorway: "black",
    });
  const addColorwayShot = (t: ReturnType<typeof setup>["t"], id: string) =>
    t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob([id]));
      return await ctx.db.insert("productImages", { variantId: cap.variantId, colorway: id, role: "catalog", order: 0, storageId, sha256: id, width: 2000, height: 2500, createdAt: 1 });
    });

  it("a tee whose only Catalog Shot is on a non-default colorway cannot be shown", async () => {
    const { t, admin } = setup();
    await createTee(admin);
    await addColorwayShot(t, "white");
    const show = { variantId: cap.variantId, isAvailable: true };
    expect(await errorData(admin.mutation(api.catalog.admin.toggleVariantAvailable, show))).toEqual({ kind: "needs_image" });
    const hidden = await row(t);
    const update = { variantId: cap.variantId, expectedUpdatedAt: hidden!.updatedAt!, patch: { isAvailable: true } };
    expect(await errorData(admin.mutation(api.catalog.admin.updateVariant, update))).toEqual({ kind: "needs_image" });
    await addColorwayShot(t, "black");
    expect((await admin.mutation(api.catalog.admin.toggleVariantAvailable, show)).isAvailable).toBe(true);
  });

  it("a visible tee cannot move its default to a colorway without a Catalog Shot", async () => {
    const { t, admin } = setup();
    await createTee(admin);
    await addColorwayShot(t, "black");
    await admin.mutation(api.catalog.admin.toggleVariantAvailable, { variantId: cap.variantId, isAvailable: true });
    const shown = await row(t);
    const update = { variantId: cap.variantId, expectedUpdatedAt: shown!.updatedAt!, patch: { defaultColorway: "white" } };
    expect(await errorData(admin.mutation(api.catalog.admin.updateVariant, update))).toEqual({ kind: "needs_image" });
    await addColorwayShot(t, "white");
    await admin.mutation(api.catalog.admin.updateVariant, update);
    expect((await row(t))?.defaultColorway).toBe("white");
  });

  it("updateVariant refuses to remove the default colorway holding a visible tee's Catalog Shot", async () => {
    const { t, admin } = setup();
    await createTee(admin);
    await addColorwayShot(t, "black");
    await admin.mutation(api.catalog.admin.toggleVariantAvailable, { variantId: cap.variantId, isAvailable: true });
    const shown = await row(t);
    const update = {
      variantId: cap.variantId,
      expectedUpdatedAt: shown!.updatedAt!,
      patch: { colorways: [colorway("white")], defaultColorway: "white" },
    };
    expect(await errorData(admin.mutation(api.catalog.admin.updateVariant, update))).toEqual({ kind: "needs_image" });
    expect(await t.run((ctx) => ctx.db.query("productImages").take(10))).toHaveLength(1);
    // Hiding it in the same save is allowed.
    await admin.mutation(api.catalog.admin.updateVariant, { ...update, patch: { ...update.patch, isAvailable: false } });
    expect((await row(t))?.colorways?.map((c) => c.id)).toEqual(["white"]);
  });

  it("removeImage keeps a visible tee's default-colorway Catalog Shot even when another colorway has one", async () => {
    const { t, admin } = setup();
    await createTee(admin);
    const black = await addColorwayShot(t, "black");
    const white = await addColorwayShot(t, "white");
    await admin.mutation(api.catalog.admin.toggleVariantAvailable, { variantId: cap.variantId, isAvailable: true });
    expect(await errorData(admin.mutation(api.catalog.images.functions.removeImage, { imageId: black }))).toEqual({ kind: "needs_image" });
    await admin.mutation(api.catalog.images.functions.removeImage, { imageId: white });
  });
});

describe("stock mutations", () => {
  it("updateVariantStock validates and audits", async () => {
    const { admin } = setup();
    await admin.mutation(api.catalog.admin.createVariant, cap);
    expect(await errorData(admin.mutation(api.catalog.admin.updateVariantStock, { variantId: cap.variantId, stock: -1 }))).toEqual({
      kind: "validation",
      errors: [{ field: "stock", code: "range" }],
    });
    await admin.mutation(api.catalog.admin.updateVariantStock, { variantId: cap.variantId, stock: 4 });
    expect((await history(admin))[0]).toMatchObject({ type: "stock_adjusted", changes: [{ field: "stock", from: 10, to: 4 }] });
  });

  it("a no-change single-field write adds no event and keeps updatedAt", async () => {
    const { t, admin } = setup();
    await admin.mutation(api.catalog.admin.createVariant, cap);
    const before = await row(t);
    await admin.mutation(api.catalog.admin.updateVariantPrice, { variantId: cap.variantId, priceUsd: cap.priceUsd });
    expect((await row(t))?.updatedAt).toBe(before?.updatedAt);
    expect(await history(admin)).toHaveLength(1);
  });

  it("setTeeSkuStock validates, audits the SKU change and stamps the tee", async () => {
    const { t, admin } = setup();
    await t.run((ctx) =>
      ctx.db.insert("variants", {
        ...cap, image: "/caps/oro-negro.png",
        variantId: "tee-sku",
        category: "apparel",
        silhouette: "tee",
        colorways: [{ id: "black", nameEn: "Black", nameEs: "Negro", hex: "#000000", borderHex: "#111111", lifestyleImage: "/l.jpg", catalogShot: "/c.jpg" }],
        sizes: ["M"],
        updatedAt: 1000,
      })
    );
    const args = { variantId: "tee-sku", colorway: "black", size: "M" };
    expect(await errorData(admin.mutation(api.catalog.admin.setTeeSkuStock, { ...args, stock: 1.5 }))).toEqual({
      kind: "validation",
      errors: [{ field: "stock", code: "range" }],
    });
    await admin.mutation(api.catalog.admin.setTeeSkuStock, { ...args, stock: 7 });
    expect((await history(admin, "tee-sku"))[0]).toMatchObject({ type: "sku_stock_set", changes: [{ field: "stock:black/M", from: 0, to: 7 }] });
    const tee = await row(t, "tee-sku");
    expect(tee?.updatedAt).toBeGreaterThan(1000);
    expect(tee?.stock).toBe(7);
  });
});

describe("archive, restore and purge", () => {
  const archive = (admin: Admin) => admin.mutation(api.catalog.admin.archiveVariant, { variantId: cap.variantId });
  const adminList = (admin: Admin, includeArchived?: boolean) =>
    admin.query(api.catalog.admin.getAllProductsAdmin, includeArchived === undefined ? {} : { includeArchived });

  it("archive hides the product and marks it unavailable", async () => {
    const { t, admin, createShown } = setup();
    await createShown();
    expect(await archive(admin)).toEqual({ success: true });
    const stored = await row(t);
    expect(stored?.archivedAt).toBeTypeOf("number");
    expect(stored?.isAvailable).toBe(false);
    expect((await history(admin))[0]).toMatchObject({ type: "archived" });
  });

  it("archived products leave every storefront and admin read", async () => {
    const { t, admin, createShown } = setup();
    await createShown();
    await archive(admin);
    expect(await admin.query(api.catalog.queries.getVariants, { includeUnavailable: true })).toEqual([]);
    expect(await admin.query(api.catalog.queries.getProductBySlug, { slug: cap.variantId, allowUnavailable: true })).toBeNull();
    expect(await admin.query(api.catalog.queries.getVariantById, { variantId: cap.variantId, allowUnavailable: true })).toBeNull();
    expect((await adminList(admin)).variants).toEqual([]);
    expect((await adminList(admin, true)).variants.map((x) => x.variantId)).toEqual([cap.variantId]);
    expect(await t.query(api.catalog.drops.getUpcomingDrops, { clientTime: 1 })).toEqual([]);
  });

  it("an archived upcoming drop is not on the Drop Radar", async () => {
    const { t, admin } = setup();
    await admin.mutation(api.catalog.admin.createVariant, cap);
    await admin.mutation(api.catalog.drops.scheduleDrop, { variantId: cap.variantId, dropDate: 4_000_000_000_000 });
    await archive(admin);
    // Force the row visible: the archive flag alone must keep it off the radar.
    await t.run(async (ctx) => {
      const stored = await ctx.db.query("variants").first();
      if (stored) await ctx.db.patch("variants", stored._id, { isAvailable: true });
    });
    expect(await t.query(api.catalog.drops.getUpcomingDrops, { clientTime: 1 })).toEqual([]);
  });

  it("restore brings it back to the admin list, still hidden", async () => {
    const { t, admin } = setup();
    await admin.mutation(api.catalog.admin.createVariant, cap);
    await archive(admin);
    expect(await admin.mutation(api.catalog.admin.restoreVariant, { variantId: cap.variantId })).toEqual({ success: true });
    const stored = await row(t);
    expect(stored && "archivedAt" in stored).toBe(false);
    expect(stored?.isAvailable).toBe(false);
    expect((await adminList(admin)).variants).toMatchObject([{ variantId: cap.variantId, isAvailable: false }]);
    expect((await history(admin))[0]).toMatchObject({ type: "restored" });
  });

  it("archiving twice or restoring a live product adds no audit event", async () => {
    const { admin } = setup();
    await admin.mutation(api.catalog.admin.createVariant, cap);
    await admin.mutation(api.catalog.admin.restoreVariant, { variantId: cap.variantId });
    await archive(admin);
    await archive(admin);
    expect((await history(admin)).map((e) => e.type)).toEqual(["archived", "created"]);
  });

  it("keeps the slug reserved while archived", async () => {
    const { admin } = setup();
    await admin.mutation(api.catalog.admin.createVariant, cap);
    await archive(admin);
    expect(await errorData(admin.mutation(api.catalog.admin.createVariant, cap))).toMatchObject({
      kind: "validation",
      errors: [{ field: "variantId", code: "taken" }],
    });
  });

  it("checkout stock check refuses an archived product and leaves stock unchanged", async () => {
    const { t, admin, createShown } = setup();
    await createShown();
    await archive(admin);
    expect(await t.query(internal.catalog.queries.getLineStock, { variantId: cap.variantId })).toEqual({ ok: false, reason: "unavailable" });
    expect((await row(t))?.stock).toBe(cap.stock);
  });

  it("purge removes the row, its SKUs and its drop alerts", async () => {
    const { t, admin } = setup();
    await admin.mutation(api.catalog.admin.createVariant, cap);
    await t.run(async (ctx) => {
      await ctx.db.insert("skus", { variantId: cap.variantId, colorway: "black", size: "M", stock: 3 });
      await ctx.db.insert("drop_alerts", { variantId: cap.variantId, contact: "a@b.co", channel: "email", locale: "en", createdAt: 1 });
      const storageId = await ctx.storage.store(new Blob(["x"]));
      await ctx.db.insert("productImages", { variantId: cap.variantId, role: "catalog", order: 0, storageId, sha256: "a", width: 2000, height: 2500, createdAt: 1 });
    });
    await t.mutation(internal.catalog.admin.purgeVariant, { variantId: cap.variantId });
    expect(await row(t)).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("skus").take(5))).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("drop_alerts").take(5))).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("productImages").take(5))).toEqual([]);
    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").take(10));
    expect(scheduled.filter((f) => f.name.endsWith("deleteStorageFile"))).toHaveLength(1);
    expect((await history(admin))[0]).toMatchObject({ type: "purged" });
  });

  it("purge leaves a legacy upload that another product's image row still uses", async () => {
    vi.useFakeTimers();
    try {
      const { t, admin } = setup();
      await admin.mutation(api.catalog.admin.createVariant, cap);
      await admin.mutation(api.catalog.admin.createVariant, { ...cap, variantId: "solo-cap" });
      const files = await t.run(async (ctx) => {
        const shared = await ctx.storage.store(new Blob(["shared"]));
        const solo = await ctx.storage.store(new Blob(["solo"]));
        const byId = (id: string) => ctx.db.query("variants").withIndex("by_variantId", (q) => q.eq("variantId", id)).unique();
        await ctx.db.patch("variants", (await byId(cap.variantId))!._id, { storageId: shared });
        await ctx.db.patch("variants", (await byId("solo-cap"))!._id, { storageId: solo });
        await ctx.db.insert("productImages", { variantId: "other-cap", role: "catalog", order: 0, storageId: shared, sha256: "s", width: 2000, height: 2500, createdAt: 1 });
        return { shared, solo };
      });
      await t.mutation(internal.catalog.admin.purgeVariant, { variantId: cap.variantId });
      await t.mutation(internal.catalog.admin.purgeVariant, { variantId: "solo-cap" });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const exists = (id: typeof files.shared) => t.run(async (ctx) => (await ctx.storage.get(id)) !== null);
      expect(await exists(files.shared)).toBe(true);
      expect(await exists(files.solo)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("blocks edits and drop releases on an archived product", async () => {
    const { admin } = setup();
    await admin.mutation(api.catalog.admin.createVariant, cap);
    await archive(admin);
    const archived = { kind: "archived" };
    expect(await errorData(admin.mutation(api.catalog.admin.toggleVariantAvailable, { variantId: cap.variantId, isAvailable: true }))).toEqual(archived);
    expect(await errorData(admin.mutation(api.catalog.drops.releaseDropNow, { variantId: cap.variantId }))).toEqual(archived);
    expect(await errorData(admin.mutation(api.catalog.admin.updateVariantPrice, { variantId: cap.variantId, priceUsd: 50 }))).toEqual(archived);
  });

  it("the drops desk omits an archived drop", async () => {
    const { admin } = setup();
    await admin.mutation(api.catalog.admin.createVariant, cap);
    await admin.mutation(api.catalog.drops.scheduleDrop, { variantId: cap.variantId, dropDate: 4_000_000_000_000 });
    expect(await admin.query(api.catalog.drops.getAllDropsAdmin, { clientTime: 1 })).toHaveLength(1);
    await archive(admin);
    expect(await admin.query(api.catalog.drops.getAllDropsAdmin, { clientTime: 1 })).toEqual([]);
  });
});
