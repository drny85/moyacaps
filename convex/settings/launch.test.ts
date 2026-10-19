/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../schema";
import { DEFAULT_CATEGORY_LAUNCHES, getCategoryLaunches, validateCategoryLaunch } from "./launch";

const modules = import.meta.glob("/convex/**/*.ts");
const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

const errors = (input: Parameters<typeof validateCategoryLaunch>[0]) =>
  validateCategoryLaunch(input, NOW).map((e) => `${e.field}:${e.code}`);

describe("getCategoryLaunches", () => {
  it("defaults to live when the row is missing", async () => {
    const t = convexTest(schema, modules);
    expect(await t.run((ctx) => getCategoryLaunches(ctx))).toEqual(DEFAULT_CATEGORY_LAUNCHES);
    expect(DEFAULT_CATEGORY_LAUNCHES).toEqual({ headwear: { status: "live" }, apparel: { status: "live" } });
  });

  it("defaults to live when the row has no launch field, and reads a stored one", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("store_settings", { key: "default", flatShippingFeeUsd: 8, freeShippingThresholdUnits: 2, updatedAt: 1 });
    });
    expect(await t.run((ctx) => getCategoryLaunches(ctx))).toEqual(DEFAULT_CATEGORY_LAUNCHES);

    await t.run(async (ctx) => {
      const row = (await ctx.db.query("store_settings").first())!;
      await ctx.db.patch("store_settings", row._id, {
        categoryLaunch: { headwear: { status: "live" }, apparel: { status: "coming_soon", launchAt: NOW, headlineEn: "Soon" } },
      });
    });
    expect(await t.run((ctx) => getCategoryLaunches(ctx))).toEqual({
      headwear: { status: "live" },
      apparel: { status: "coming_soon", launchAt: NOW, headlineEn: "Soon" },
    });
  });
});

describe("validateCategoryLaunch", () => {
  it("accepts every status without extras", () => {
    for (const status of ["live", "coming_soon", "hidden"] as const) expect(errors({ status })).toEqual([]);
  });

  it("allows a launch date only with coming_soon", () => {
    expect(errors({ status: "live", launchAt: NOW + DAY })).toEqual(["launchAt:mismatch"]);
    expect(errors({ status: "hidden", launchAt: NOW + DAY })).toEqual(["launchAt:mismatch"]);
    expect(errors({ status: "coming_soon", launchAt: NOW + DAY })).toEqual([]);
  });

  it("rejects past dates and dates more than 365 days ahead", () => {
    expect(errors({ status: "coming_soon", launchAt: NOW })).toEqual(["launchAt:range"]);
    expect(errors({ status: "coming_soon", launchAt: NOW + 366 * DAY })).toEqual(["launchAt:range"]);
    expect(errors({ status: "coming_soon", launchAt: NOW + 365 * DAY })).toEqual([]);
  });

  it("rejects headlines over 80 characters after trimming", () => {
    expect(errors({ status: "coming_soon", headlineEn: ` ${"a".repeat(80)} ` })).toEqual([]);
    expect(errors({ status: "coming_soon", headlineEn: "a".repeat(81), headlineEs: "b".repeat(81) })).toEqual([
      "headlineEn:too_long",
      "headlineEs:too_long",
    ]);
  });
});
