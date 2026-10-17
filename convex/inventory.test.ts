/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { PRIMARY_ADMIN_EMAIL } from "./auth";

const modules = import.meta.glob("./**/*.ts");

const t = () => convexTest(schema, modules);
type T = ReturnType<typeof t>;

const admin = (tt: T) => tt.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL });

async function drain(tt: T) {
  await tt.finishAllScheduledFunctions(() => {});
}

const COLORWAY = (id: string) => ({
  id,
  nameEn: id,
  nameEs: id,
  hex: "#000000",
  borderHex: "#000000",
  lifestyleImage: `/shirts/${id}.jpg`,
  catalogShot: `/catalog/tees/T1/${id}.webp`,
});

/** A tee with two colorways × two sizes and explicit SKU stock; aggregate = sum. */
async function seedTee(tt: T, skus: Record<string, number>) {
  await tt.run(async (ctx) => {
    const total = Object.values(skus).reduce((a, b) => a + b, 0);
    await ctx.db.insert("variants", {
      variantId: "T1",
      nameEn: "Tee T1",
      nameEs: "Playera T1",
      silhouette: "tee",
      category: "apparel",
      primaryHex: "#000000",
      secondaryHex: "#ffffff",
      image: "/shirts/t1.jpg",
      stock: total,
      priceUsd: 160,
      isFeatured: false,
      colorways: [COLORWAY("washed-black"), COLORWAY("crisp-white")],
      sizes: ["M", "L"],
    });
    for (const [key, stock] of Object.entries(skus)) {
      const [colorway, size] = key.split("/");
      await ctx.db.insert("skus", { variantId: "T1", colorway, size, stock });
    }
  });
}

async function skuStock(tt: T, colorway: string, size: string) {
  return await tt.run(async (ctx) => {
    const sku = await ctx.db
      .query("skus")
      .withIndex("by_variantId_and_colorway_and_size", (q) =>
        q.eq("variantId", "T1").eq("colorway", colorway).eq("size", size)
      )
      .unique();
    return sku?.stock ?? -1;
  });
}

async function teeStock(tt: T) {
  return await tt.run(async (ctx) => {
    const v = await ctx.db
      .query("variants")
      .withIndex("by_variantId", (q) => q.eq("variantId", "T1"))
      .first();
    return v?.stock ?? -1;
  });
}

function teeLead(tt: T, line: { quantity?: number; colorway?: string; size?: string }) {
  const qty = line.quantity ?? 1;
  return tt.mutation(internal.orders.createWhatsAppOrderLead, {
    items: [
      {
        variantId: "T1",
        name: "Tee T1 (Size: L) • washed-black",
        quantity: qty,
        price: 160,
        image: "/shirts/t1.jpg",
        ...(line.colorway ? { colorway: line.colorway } : {}),
        ...(line.size ? { size: line.size } : {}),
      },
    ],
    currency: "USD",
    subtotal: 160 * qty,
    shippingFee: 0,
    total: 160 * qty,
    customerName: "Test Buyer",
    customerEmail: "buyer@test.com",
    clerkUserId: "user_cust",
  });
}

describe("Tee SKU inventory (ADR 0015)", () => {
  it("a reservation deducts only its SKU and keeps the tee aggregate equal to the SKU sum", async () => {
    const tt = t();
    await seedTee(tt, { "washed-black/L": 3, "washed-black/M": 2, "crisp-white/L": 4, "crisp-white/M": 1 });

    await teeLead(tt, { colorway: "washed-black", size: "L", quantity: 2 });

    expect(await skuStock(tt, "washed-black", "L")).toBe(1);
    expect(await skuStock(tt, "crisp-white", "L")).toBe(4);
    expect(await teeStock(tt)).toBe(8);
    await drain(tt);
  });

  it("refuses to oversell a SKU even when the tee aggregate has enough units", async () => {
    const tt = t();
    await seedTee(tt, { "washed-black/L": 1, "washed-black/M": 0, "crisp-white/L": 9, "crisp-white/M": 9 });

    await expect(teeLead(tt, { colorway: "washed-black", size: "L", quantity: 2 })).rejects.toThrow(
      /Insufficient stock/
    );
    await expect(teeLead(tt, { colorway: "washed-black", size: "M" })).rejects.toThrow(/sold out/);
    expect(await teeStock(tt)).toBe(19);
  });

  it("requires a colorway and size the tee actually offers", async () => {
    const tt = t();
    await seedTee(tt, { "washed-black/L": 5, "washed-black/M": 5, "crisp-white/L": 5, "crisp-white/M": 5 });

    await expect(teeLead(tt, {})).rejects.toThrow(/valid colorway and size/);
    await expect(teeLead(tt, { colorway: "washed-black", size: "XXXL" })).rejects.toThrow(
      /valid colorway and size/
    );
    await expect(teeLead(tt, { colorway: "heather-grey", size: "L" })).rejects.toThrow(
      /valid colorway and size/
    );
  });

  it("an expired reservation releases units back to the same SKU", async () => {
    const tt = t();
    await seedTee(tt, { "washed-black/L": 3, "washed-black/M": 0, "crisp-white/L": 0, "crisp-white/M": 0 });
    const lead = await teeLead(tt, { colorway: "washed-black", size: "L", quantity: 2 });

    await tt.run(async (ctx) => {
      await ctx.db.patch(lead.orderId, { reservationExpiresAt: Date.now() - 1000 });
    });
    await tt.mutation(internal.orders.expireWhatsAppOrderLead, { orderId: lead.orderId });

    expect(await skuStock(tt, "washed-black", "L")).toBe(3);
    expect(await teeStock(tt)).toBe(3);
    await drain(tt);
  });

  it("a direct Stripe settlement deducts the purchased SKU", async () => {
    const tt = t();
    await seedTee(tt, { "washed-black/L": 0, "washed-black/M": 0, "crisp-white/L": 0, "crisp-white/M": 4 });
    await tt.mutation(internal.orders.createOrUpdateStripeOrder, {
      stripeSessionId: "cs_tee1",
      orderNumber: "GL-TEE-1",
      customerEmail: "buyer@test.com",
      items: [
        {
          variantId: "T1",
          name: "Tee T1 (Size: M) • crisp-white",
          quantity: 3,
          price: 160,
          image: "/shirts/t1.jpg",
          colorway: "crisp-white",
          size: "M",
        },
      ],
      currency: "USD",
      subtotal: 480,
      shippingFee: 0,
      total: 480,
      webhookEventId: "evt_tee1",
      isWhatsAppOrder: false,
    });
    expect(await skuStock(tt, "crisp-white", "M")).toBe(1);
    expect(await teeStock(tt)).toBe(1);
    await drain(tt);
  });

  it("checkout's line stock check reports SKU stock and option errors", async () => {
    const tt = t();
    await seedTee(tt, { "washed-black/L": 7, "washed-black/M": 0, "crisp-white/L": 0, "crisp-white/M": 0 });

    expect(
      await tt.query(internal.products.getLineStock, { variantId: "T1", colorway: "washed-black", size: "L" })
    ).toEqual({ ok: true, available: 7 });
    expect(await tt.query(internal.products.getLineStock, { variantId: "T1" })).toEqual({
      ok: false,
      reason: "option_required",
    });
    expect(await tt.query(internal.products.getLineStock, { variantId: "nope" })).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("admins edit tee stock per SKU, never on the aggregate", async () => {
    const tt = t();
    await seedTee(tt, { "washed-black/L": 1, "washed-black/M": 1, "crisp-white/L": 1, "crisp-white/M": 1 });

    await expect(
      admin(tt).mutation(api.products.updateVariantStock, { variantId: "T1", stock: 50 })
    ).rejects.toThrow(/per colorway and size/);
    await expect(
      admin(tt).mutation(api.products.adjustVariantStock, { variantId: "T1", delta: 5 })
    ).rejects.toThrow(/per colorway and size/);

    await admin(tt).mutation(api.products.setTeeSkuStock, {
      variantId: "T1",
      colorway: "crisp-white",
      size: "L",
      stock: 10,
    });
    expect(await skuStock(tt, "crisp-white", "L")).toBe(10);
    expect(await teeStock(tt)).toBe(13);

    await expect(
      admin(tt).mutation(api.products.setTeeSkuStock, { variantId: "T1", colorway: "crisp-white", size: "S", stock: 1 })
    ).rejects.toThrow(/not offered/);
  });
});

describe("migrateUnifiedCatalog", () => {
  it("seeds SKUs from current tee stock without changing the total, and is idempotent", async () => {
    const tt = t();
    await tt.run(async (ctx) => {
      await ctx.db.insert("variants", {
        variantId: "boxing-gloves-tee",
        nameEn: "Boxing Gloves Tee",
        nameEs: "Playera Boxing Gloves",
        silhouette: "tee",
        category: "apparel",
        primaryHex: "#18181b",
        secondaryHex: "#ef4444",
        image: "/shirts/boxing-gloves-black.jpg",
        stock: 18,
        priceUsd: 160,
        isFeatured: true,
      });
      await ctx.db.insert("variants", {
        variantId: "eagle-clover-tee",
        nameEn: "Eagle Tee",
        nameEs: "Playera Eagle",
        silhouette: "tee",
        primaryHex: "#000000",
        secondaryHex: "#ffffff",
        image: "/shirts/eagle-clover-black.png",
        stock: 3,
        priceUsd: 160,
        isFeatured: false,
      });
    });

    const first = await tt.mutation(internal.products.migrateUnifiedCatalog, {});
    const second = await tt.mutation(internal.products.migrateUnifiedCatalog, {});
    expect(second.skusSeeded).toBe(0);
    expect(first.teesInserted).toBeGreaterThan(0); // tees missing from this DB are created

    const result = await tt.run(async (ctx) => {
      const boxing = await ctx.db
        .query("variants")
        .withIndex("by_variantId", (q) => q.eq("variantId", "boxing-gloves-tee"))
        .first();
      const skus = await ctx.db
        .query("skus")
        .withIndex("by_variantId_and_colorway_and_size", (q) => q.eq("variantId", "boxing-gloves-tee"))
        .collect();
      const eagle = await ctx.db
        .query("variants")
        .withIndex("by_variantId", (q) => q.eq("variantId", "eagle-clover-tee"))
        .first();
      return { boxing, skus, eagle };
    });

    expect(result.skus).toHaveLength(20); // 4 colorways × 5 sizes
    expect(result.skus.reduce((sum, s) => sum + s.stock, 0)).toBe(18);
    expect(result.boxing?.stock).toBe(18);
    expect(result.boxing?.colorways?.[0].catalogShot).toMatch(/^\/catalog\/tees\/boxing-gloves-tee\//);
    expect(result.eagle?.image).toBe("/shirts/eagle-clover-black.jpg"); // Lifestyle Shot renamed
  });
});
