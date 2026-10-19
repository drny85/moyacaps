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

describe("scheduled category launch", () => {
  const jobs = (t: ReturnType<typeof setup>["t"]) => t.run((ctx) => ctx.db.system.query("_scheduled_functions").take(20));
  const goLiveJobs = async (t: ReturnType<typeof setup>["t"]) =>
    (await jobs(t)).filter((j) => j.name.endsWith("goLive"));

  it("setCategoryLaunch with launchAt schedules goLive at that time and cancels the previous job", async () => {
    const { t, admin } = setup();
    const first = Date.now() + 60_000;
    const second = Date.now() + 120_000;
    await admin.mutation(api.settings.functions.setCategoryLaunch, { category: "apparel", status: "coming_soon", launchAt: first });
    await admin.mutation(api.settings.functions.setCategoryLaunch, { category: "apparel", status: "coming_soon", launchAt: second });

    const scheduled = await goLiveJobs(t);
    expect(scheduled.map((j) => [j.scheduledTime, j.state.kind])).toEqual([
      [first, "canceled"],
      [second, "pending"],
    ]);
    expect(scheduled[1].args[0]).toEqual({ category: "apparel", launchAt: second });
  });

  it("clearing launchAt cancels the job", async () => {
    const { t, admin } = setup();
    await admin.mutation(api.settings.functions.setCategoryLaunch, { category: "apparel", status: "coming_soon", launchAt: Date.now() + 60_000 });
    await admin.mutation(api.settings.functions.setCategoryLaunch, { category: "apparel", status: "coming_soon" });
    expect((await goLiveJobs(t)).map((j) => j.state.kind)).toEqual(["canceled"]);
  });

  it("goLive ignores a stale launchAt", async () => {
    const { t, admin } = setup();
    const launchAt = Date.now() + 60_000;
    await admin.mutation(api.settings.functions.setCategoryLaunch, { category: "apparel", status: "coming_soon", launchAt });
    await t.mutation(internal.settings.functions.goLive, { category: "apparel", launchAt: launchAt - 1 });
    expect((await t.query(api.settings.functions.getStorefrontLaunch, {})).apparel).toEqual({ status: "coming_soon", launchAt });
  });

  it("goLive sets live, keeps no date and schedules revalidateStorefront", async () => {
    const { t, admin } = setup();
    const launchAt = Date.now() + 60_000;
    await admin.mutation(api.settings.functions.setCategoryLaunch, { category: "apparel", status: "coming_soon", launchAt, headlineEn: "Soon" });
    await t.mutation(internal.settings.functions.goLive, { category: "apparel", launchAt });

    expect((await t.query(api.settings.functions.getStorefrontLaunch, {})).apparel).toEqual({ status: "live", headlineEn: "Soon" });
    expect((await jobs(t)).filter((j) => j.name.endsWith("revalidateStorefront")).length).toBeGreaterThanOrEqual(2);
    expect((await events(t)).map((e) => e.type)).toEqual(["category_launch_set", "category_launch_set"]);
  });

  it("every manual change schedules a storefront refresh", async () => {
    const { t, admin } = setup();
    await admin.mutation(api.settings.functions.setCategoryLaunch, { category: "headwear", status: "hidden" });
    expect((await jobs(t)).filter((j) => j.name.endsWith("revalidateStorefront"))).toHaveLength(1);
  });

  it("getStorefrontLaunch never returns launchJobId", async () => {
    const { t, admin } = setup();
    await admin.mutation(api.settings.functions.setCategoryLaunch, { category: "apparel", status: "coming_soon", launchAt: Date.now() + 60_000 });
    expect(Object.keys((await t.query(api.settings.functions.getStorefrontLaunch, {})).apparel).sort()).toEqual(["launchAt", "status"]);
  });
});
