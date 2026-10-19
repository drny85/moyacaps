/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";

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

/** A visible cap, a hidden draft and an archived product. */
async function setup() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("variants", cap);
    await ctx.db.insert("variants", { ...cap, variantId: "draft", isAvailable: false, descriptionEn: "Secret copy" });
    await ctx.db.insert("variants", { ...cap, variantId: "gone", isAvailable: false, archivedAt: 1 });
  });
  return t;
}

const ids = (rows: { variantId: string }[]) => rows.map((r) => r.variantId).sort();

describe("getVariants", () => {
  it("never returns hidden products to an anonymous caller, even with includeUnavailable", async () => {
    const t = await setup();
    expect(ids(await t.query(api.catalog.queries.getVariants, { includeUnavailable: true }))).toEqual(["oro-negro"]);
  });

  it("never returns hidden products to a signed-in customer", async () => {
    const t = await setup();
    const user = t.withIdentity({ subject: "user_x", email: "x@example.com" });
    expect(ids(await user.query(api.catalog.queries.getVariants, { includeUnavailable: true }))).toEqual(["oro-negro"]);
  });

  it("returns hidden products to an Administrator who asks for them", async () => {
    const t = await setup();
    const admin = t.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL });
    expect(ids(await admin.query(api.catalog.queries.getVariants, { includeUnavailable: true }))).toEqual(["draft", "oro-negro"]);
    expect(ids(await admin.query(api.catalog.queries.getVariants, {}))).toEqual(["oro-negro"]);
  });
});

describe("getCartVariants", () => {
  it("returns only the requested ids, hidden ones included so the cart can show them unavailable", async () => {
    const t = await setup();
    await t.run((ctx) => ctx.db.insert("variants", { ...cap, variantId: "other" }));
    const rows = await t.query(api.catalog.queries.getCartVariants, { variantIds: ["draft", "oro-negro", "draft", "missing"] });
    expect(ids(rows)).toEqual(["draft", "oro-negro"]);
    expect(rows.find((r) => r.variantId === "draft")?.isAvailable).toBe(false);
  });

  it("omits archived products", async () => {
    const t = await setup();
    expect(await t.query(api.catalog.queries.getCartVariants, { variantIds: ["gone"] })).toEqual([]);
  });

  it("reads at most 50 ids", async () => {
    const t = await setup();
    const many = [...Array.from({ length: 50 }, (_, i) => `x-${i}`), "oro-negro"];
    expect(await t.query(api.catalog.queries.getCartVariants, { variantIds: many })).toEqual([]);
  });
});

/** Sets one category's status on the settings row (ADR 0022). */
async function setStatus(t: Awaited<ReturnType<typeof setup>>, category: "headwear" | "apparel", status: "live" | "coming_soon" | "hidden") {
  await t.run(async (ctx) => {
    const categoryLaunch = { headwear: { status: "live" as const }, apparel: { status: "live" as const }, [category]: { status } };
    await ctx.db.insert("store_settings", { key: "default", flatShippingFeeUsd: 8, freeShippingThresholdUnits: 2, updatedAt: 1, categoryLaunch });
  });
}

describe("category launch gating (ADR 0022)", () => {
  async function withTee() {
    const t = await setup();
    await t.run((ctx) => ctx.db.insert("variants", { ...cap, variantId: "tee", category: "apparel", silhouette: "tee" }));
    return t;
  }
  const asAdmin = (t: Awaited<ReturnType<typeof setup>>) => t.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL });

  it("hides a product whose isAvailable was never set", async () => {
    const t = await setup();
    await t.run((ctx) => ctx.db.insert("variants", { ...cap, variantId: "unset", isAvailable: undefined }));
    expect(ids(await t.query(api.catalog.queries.getVariants, {}))).toEqual(["oro-negro"]);
  });

  it("getVariants omits products of a coming_soon category", async () => {
    const t = await withTee();
    expect(ids(await t.query(api.catalog.queries.getVariants, {}))).toEqual(["oro-negro", "tee"]);
    await setStatus(t, "apparel", "coming_soon");
    expect(ids(await t.query(api.catalog.queries.getVariants, {}))).toEqual(["oro-negro"]);
  });

  it("getVariants with includeUnavailable as admin still lists them", async () => {
    const t = await withTee();
    await setStatus(t, "apparel", "hidden");
    expect(ids(await asAdmin(t).query(api.catalog.queries.getVariants, { includeUnavailable: true }))).toEqual(["draft", "oro-negro", "tee"]);
  });

  it("getProductBySlug and getVariantById return null for a customer and the product for an admin with allowUnavailable", async () => {
    const t = await withTee();
    await setStatus(t, "apparel", "coming_soon");
    expect(await t.query(api.catalog.queries.getProductBySlug, { slug: "tee" })).toBeNull();
    expect(await t.query(api.catalog.queries.getProductBySlug, { slug: "tee", allowUnavailable: true })).toBeNull();
    expect(await t.query(api.catalog.queries.getVariantById, { variantId: "tee" })).toBeNull();
    expect((await asAdmin(t).query(api.catalog.queries.getProductBySlug, { slug: "tee", allowUnavailable: true }))?.variantId).toBe("tee");
    expect((await asAdmin(t).query(api.catalog.queries.getVariantById, { variantId: "tee", allowUnavailable: true }))?.variantId).toBe("tee");
  });

  it("getCartVariants returns a gated tee with isAvailable false", async () => {
    const t = await withTee();
    await setStatus(t, "apparel", "coming_soon");
    const rows = await t.query(api.catalog.queries.getCartVariants, { variantIds: ["tee", "oro-negro"] });
    expect(Object.fromEntries(rows.map((r) => [r.variantId, r.isAvailable]))).toEqual({ tee: false, "oro-negro": true });
  });

  it("checkStock rejects a product in a non-live category", async () => {
    const t = await setup();
    await setStatus(t, "headwear", "coming_soon");
    expect(await t.query(internal.catalog.queries.getLineStock, { variantId: "oro-negro" })).toEqual({ ok: false, reason: "unavailable" });
  });

  it("getUpcomingDrops omits drops in a non-live category", async () => {
    const t = await setup();
    const now = 1_800_000_000_000;
    await t.run((ctx) =>
      ctx.db.insert("variants", { ...cap, variantId: "drop", isDrop: true, dropDate: now + 1000, dropStatus: "scheduled" })
    );
    expect(ids(await t.query(api.catalog.drops.getUpcomingDrops, { clientTime: now }))).toEqual(["drop"]);
    await setStatus(t, "headwear", "coming_soon");
    expect(await t.query(api.catalog.drops.getUpcomingDrops, { clientTime: now })).toEqual([]);
  });
});
