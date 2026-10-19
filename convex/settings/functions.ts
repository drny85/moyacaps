import { v } from "convex/values";
import { internalQuery, mutation, query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { actorEmail, diffFields, recordCatalogEvent } from "../catalog/audit";
import { throwIfInvalid } from "../catalog/rules";
import { getShippingSettings, validateShippingSettings } from "./model";

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
