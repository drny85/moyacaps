import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import { actorEmail, recordCatalogEvent } from "../catalog/audit";
import { throwIfInvalid } from "../catalog/rules";
import { DEFAULT_SHIPPING_SETTINGS } from "./model";
import { DEFAULT_HOME_TILES, validateHomeTilePick } from "./homeTilesModel";
import { categoryValidator, getSettingsRow } from "./launch";

/** Storefront read: the picked Product per tile. A pick that is later hidden falls back to featured on the client. */
const homeTilesValidator = v.object({ headwear: v.string(), apparel: v.string() });

export const getHomeTiles = query({
  args: {},
  returns: homeTilesValidator,
  handler: async (ctx) => ({ ...DEFAULT_HOME_TILES, ...(await getSettingsRow(ctx))?.homeTiles }),
});

export const setHomeTile = mutation({
  args: { category: categoryValidator, variantId: v.string() },
  returns: v.null(),
  handler: async (ctx, { category, variantId }) => {
    const identity = await requireAdmin(ctx);
    const variant = await ctx.db
      .query("variants")
      .withIndex("by_variantId", (q) => q.eq("variantId", variantId))
      .unique();
    throwIfInvalid(validateHomeTilePick(category, variant));

    const row = await getSettingsRow(ctx);
    const before = { ...DEFAULT_HOME_TILES, ...row?.homeTiles }[category];
    if (before === variantId) return null;
    const homeTiles = { ...row?.homeTiles, [category]: variantId };
    const updatedAt = Date.now();
    if (row) await ctx.db.patch("store_settings", row._id, { homeTiles, updatedAt });
    else await ctx.db.insert("store_settings", { key: "default", ...DEFAULT_SHIPPING_SETTINGS, homeTiles, updatedAt });

    await recordCatalogEvent(ctx, {
      variantId,
      type: "home_tile_set",
      actor: actorEmail(identity),
      changes: [{ field: `homeTiles.${category}`, from: before, to: variantId }],
    });
    // The homepage is statically rendered (ADR 0020): refresh it so the new tile shows now.
    await ctx.scheduler.runAfter(0, internal.settings.revalidate.revalidateStorefront, {});
    return null;
  },
});
