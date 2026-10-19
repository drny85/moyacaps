/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError, type Value } from "convex/values";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";
import { DEFAULT_SHIPPING_SETTINGS } from "./model";

const modules = import.meta.glob("/convex/**/*.ts");

function setup() {
  const t = convexTest(schema, modules);
  const admin = t.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL });
  return { t, admin };
}

const rows = (t: ReturnType<typeof setup>["t"]) => t.run((ctx) => ctx.db.query("store_settings").take(5));
const events = (t: ReturnType<typeof setup>["t"]) =>
  t.run((ctx) => ctx.db.query("catalog_events").take(20));

async function whatsappLeadShippingFee(t: ReturnType<typeof setup>["t"], qty: number): Promise<number> {
  await t.run((ctx) =>
    ctx.db.insert("variants", {
      variantId: "V1",
      nameEn: "Cap V1",
      nameEs: "Gorra V1",
      silhouette: "snapback",
      primaryHex: "#000000",
      secondaryHex: "#ffffff",
      image: "/img.png",
      stock: 10,
      priceUsd: 100,
      isFeatured: false,
    }),
  );
  const lead = await t.mutation(internal.orders.whatsapp.createWhatsAppOrderLead, {
    items: [{ variantId: "V1", name: "Cap V1", quantity: qty, price: 100, image: "/img.png" }],
    currency: "USD",
    subtotal: qty * 100,
    shippingFee: 999, // ignored: the server recomputes
    total: 999,
    customerName: "Test Buyer",
    customerEmail: "buyer@test.com",
    clerkUserId: "user_cust",
  });
  await t.finishAllScheduledFunctions(() => {});
  return lead.shippingFee;
}

describe("store settings", () => {
  it("reads the defaults when no row exists", async () => {
    const { t } = setup();
    expect(await t.query(api.settings.functions.getStoreSettings, {})).toEqual(DEFAULT_SHIPPING_SETTINGS);
    expect(await t.query(internal.settings.functions.getStoreSettingsInternal, {})).toEqual(DEFAULT_SHIPPING_SETTINGS);
  });

  it("update without admin throws and writes nothing", async () => {
    const { t } = setup();
    await expect(
      t.mutation(api.settings.functions.updateStoreSettings, { flatShippingFeeUsd: 5, freeShippingThresholdUnits: 3 }),
    ).rejects.toThrow();
    await expect(
      t
        .withIdentity({ subject: "user_cust" })
        .mutation(api.settings.functions.updateStoreSettings, { flatShippingFeeUsd: 5, freeShippingThresholdUnits: 3 }),
    ).rejects.toThrow();
    expect(await rows(t)).toHaveLength(0);
  });

  it("upserts one row, round-trips, and logs a diff event", async () => {
    const { t, admin } = setup();
    await admin.mutation(api.settings.functions.updateStoreSettings, { flatShippingFeeUsd: 5, freeShippingThresholdUnits: 3 });
    await admin.mutation(api.settings.functions.updateStoreSettings, { flatShippingFeeUsd: 6, freeShippingThresholdUnits: 3 });
    expect(await t.query(api.settings.functions.getStoreSettings, {})).toEqual({
      flatShippingFeeUsd: 6,
      freeShippingThresholdUnits: 3,
    });
    expect(await rows(t)).toHaveLength(1);
    const log = await events(t);
    expect(log.map((e) => e.type)).toEqual(["settings_updated", "settings_updated"]);
    expect(JSON.parse(log[1].changes ?? "[]")).toEqual([{ field: "flatShippingFeeUsd", from: 5, to: 6 }]);
    expect(log[1].actor).toBe(PRIMARY_ADMIN_EMAIL);
  });

  it("a no-op update writes no row and no event", async () => {
    const { t, admin } = setup();
    await admin.mutation(api.settings.functions.updateStoreSettings, DEFAULT_SHIPPING_SETTINGS);
    expect(await rows(t)).toHaveLength(0);
    expect(await events(t)).toHaveLength(0);
  });

  it("rejects invalid values with a validation error", async () => {
    const { admin } = setup();
    try {
      await admin.mutation(api.settings.functions.updateStoreSettings, { flatShippingFeeUsd: -1, freeShippingThresholdUnits: 0 });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConvexError);
      expect((e as ConvexError<Value>).data).toEqual({
        kind: "validation",
        errors: [
          { field: "flatShippingFeeUsd", code: "range" },
          { field: "freeShippingThresholdUnits", code: "range" },
        ],
      });
    }
  });

  it("a WhatsApp order uses the stored fee and threshold", async () => {
    const { t, admin } = setup();
    await admin.mutation(api.settings.functions.updateStoreSettings, { flatShippingFeeUsd: 5, freeShippingThresholdUnits: 3 });
    expect(await whatsappLeadShippingFee(t, 2)).toBe(5);
  });

  it("a WhatsApp order falls back to the default $8 with no settings row", async () => {
    const { t } = setup();
    expect(await whatsappLeadShippingFee(t, 1)).toBe(8);
  });
});

describe("category launch", () => {
  it("setCategoryLaunch requires an Administrator", async () => {
    const { t } = setup();
    await expect(t.mutation(api.settings.functions.setCategoryLaunch, { category: "apparel", status: "hidden" })).rejects.toThrow();
  });

  it("setCategoryLaunch keeps shipping settings, trims headlines and records a catalog event", async () => {
    const { t, admin } = setup();
    await admin.mutation(api.settings.functions.updateStoreSettings, { flatShippingFeeUsd: 5, freeShippingThresholdUnits: 3 });

    await admin.mutation(api.settings.functions.setCategoryLaunch, {
      category: "apparel",
      status: "coming_soon",
      headlineEn: "  Tees are coming  ",
      headlineEs: "   ",
    });

    expect(await t.query(api.settings.functions.getStorefrontLaunch, {})).toEqual({
      headwear: { status: "live" },
      apparel: { status: "coming_soon", headlineEn: "Tees are coming" },
    });
    expect(await t.query(api.settings.functions.getStoreSettings, {})).toEqual({ flatShippingFeeUsd: 5, freeShippingThresholdUnits: 3 });
    expect((await events(t)).map((e) => e.type)).toContain("category_launch_set");
  });

  it("setCategoryLaunch creates the settings row with default shipping when none exists", async () => {
    const { t, admin } = setup();
    await admin.mutation(api.settings.functions.setCategoryLaunch, { category: "headwear", status: "hidden" });
    expect(await t.query(api.settings.functions.getStoreSettings, {})).toEqual(DEFAULT_SHIPPING_SETTINGS);
    expect((await t.query(api.settings.functions.getStorefrontLaunch, {})).headwear).toEqual({ status: "hidden" });
    expect(await rows(t)).toHaveLength(1);
  });

  it("setCategoryLaunch rejects invalid input with field errors", async () => {
    const { admin } = setup();
    await expect(
      admin.mutation(api.settings.functions.setCategoryLaunch, { category: "apparel", status: "live", launchAt: Date.now() + 60_000 }),
    ).rejects.toThrow(ConvexError);
  });
});
