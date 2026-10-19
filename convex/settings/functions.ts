import { v } from "convex/values";
import { internalQuery, mutation, query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { actorEmail, diffFields, recordCatalogEvent } from "../catalog/audit";
import { throwIfInvalid } from "../catalog/rules";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { Category } from "../catalog/rules";
import { DEFAULT_SHIPPING_SETTINGS, getShippingSettings, validateShippingSettings } from "./model";
import {
  DEFAULT_CATEGORY_LAUNCHES,
  categoryLaunchesValidator,
  categoryStatusValidator,
  categoryValidator,
  getCategoryLaunches,
  getSettingsRow,
  normalizeCategoryLaunch,
  validateCategoryLaunch,
  type CategoryLaunch,
} from "./launch";

const shippingSettingsValidator = v.object({
  flatShippingFeeUsd: v.number(),
  freeShippingThresholdUnits: v.number(),
});

/** Storefront read: the cart and checkout show these; the server re-derives them at checkout. */
export const getStoreSettings = query({
  args: {},
  returns: shippingSettingsValidator,
  handler: (ctx) => getShippingSettings(ctx),
});

export const getStoreSettingsInternal = internalQuery({
  args: {},
  returns: shippingSettingsValidator,
  handler: (ctx) => getShippingSettings(ctx),
});

export const updateStoreSettings = mutation({
  args: shippingSettingsValidator.fields,
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    throwIfInvalid(validateShippingSettings(args));

    const before = await getShippingSettings(ctx);
    const changes = diffFields(before, args);
    if (changes.length === 0) return null;

    const row = await ctx.db
      .query("store_settings")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .unique();
    const next = { ...args, updatedAt: Date.now() };
    if (row) {
      await ctx.db.patch("store_settings", row._id, next);
    } else {
      await ctx.db.insert("store_settings", { key: "default", ...next });
    }
    await recordCatalogEvent(ctx, { type: "settings_updated", actor: actorEmail(identity), changes });
    return null;
  },
});

/** Storefront read: each category's status, launch date and teaser headline. */
export const getStorefrontLaunch = query({
  args: {},
  returns: categoryLaunchesValidator,
  handler: (ctx) => getCategoryLaunches(ctx),
});

type StoredLaunch = CategoryLaunch & { launchJobId?: Id<"_scheduled_functions"> };

/** Replace one category's stored launch, creating the settings row with default shipping if needed. */
export async function writeCategoryLaunch(ctx: MutationCtx, category: Category, next: StoredLaunch): Promise<void> {
  const row = await getSettingsRow(ctx);
  const current = row?.categoryLaunch ?? DEFAULT_CATEGORY_LAUNCHES;
  const categoryLaunch = { ...current, [category]: next };
  const updatedAt = Date.now();
  if (row) {
    await ctx.db.patch("store_settings", row._id, { categoryLaunch, updatedAt });
  } else {
    await ctx.db.insert("store_settings", { key: "default", ...DEFAULT_SHIPPING_SETTINGS, categoryLaunch, updatedAt });
  }
}

export const setCategoryLaunch = mutation({
  args: {
    category: categoryValidator,
    status: categoryStatusValidator,
    launchAt: v.optional(v.number()),
    headlineEn: v.optional(v.string()),
    headlineEs: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { category, ...input }) => {
    const identity = await requireAdmin(ctx);
    throwIfInvalid(validateCategoryLaunch(input, Date.now()));
    const next = normalizeCategoryLaunch(input);
    const before = (await getCategoryLaunches(ctx))[category];

    await writeCategoryLaunch(ctx, category, next);
    const changes = diffFields(before, next).map((c) => ({ ...c, field: `${category}.${c.field}` }));
    await recordCatalogEvent(ctx, { type: "category_launch_set", actor: actorEmail(identity), changes });
    return null;
  },
});
