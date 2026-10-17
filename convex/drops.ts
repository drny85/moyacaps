/**
 * Limited drops: scheduling and release (Administrator), the storefront Drop Radar,
 * and drop-alert subscribers (waitlist).
 */
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./auth";
import { computedDropStatus, hasDropHistory, isUpcomingDrop } from "./catalogModel";
import { countDropAlerts, listCatalogVariants, requireVariant, resolveVariantWithStorageUrl } from "./catalogShared";

const dropStatusValidator = v.union(v.literal("scheduled"), v.literal("live"), v.literal("archived"));

export const getUpcomingDrops = query({
  args: {},
  handler: async (ctx) => {
    const rawVariants = await listCatalogVariants(ctx);
    const now = Date.now();
    const dropVariants = rawVariants.filter((v) => isUpcomingDrop(v, now));

    // Sort by earliest dropDate
    dropVariants.sort((a, b) => (a.dropDate || 0) - (b.dropDate || 0));

    return await Promise.all(
      dropVariants.map(async (v) => {
        const withUrl = await resolveVariantWithStorageUrl(ctx, v);
        return {
          ...withUrl,
          subscribersCount: await countDropAlerts(ctx, v.variantId),
        };
      })
    );
  },
});

export const subscribeToDropAlert = mutation({
  args: {
    variantId: v.string(),
    contact: v.string(),
    channel: v.union(v.literal("whatsapp"), v.literal("email")),
    name: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
    locale: v.union(v.literal("en"), v.literal("es")),
  },
  handler: async (ctx, args) => {
    const cleanContact = args.contact.trim().toLowerCase();
    if (!cleanContact) {
      throw new Error("Contact information is required");
    }

    await requireVariant(ctx, args.variantId);

    // Check duplicate
    const existing = await ctx.db
      .query("drop_alerts")
      .withIndex("by_variant_contact", (q) =>
        q.eq("variantId", args.variantId).eq("contact", cleanContact)
      )
      .first();

    if (existing) {
      return { success: true, alreadySubscribed: true, id: existing._id };
    }

    const id = await ctx.db.insert("drop_alerts", {
      variantId: args.variantId,
      contact: cleanContact,
      channel: args.channel,
      name: args.name?.trim(),
      clerkUserId: args.clerkUserId,
      locale: args.locale,
      createdAt: Date.now(),
    });

    return { success: true, alreadySubscribed: false, id };
  },
});

export const updateVariantDropStatus = mutation({
  args: {
    variantId: v.string(),
    isDrop: v.boolean(),
    dropDate: v.optional(v.number()),
    dropBadgeTextEn: v.optional(v.string()),
    dropBadgeTextEs: v.optional(v.string()),
    dropStatus: v.optional(dropStatusValidator),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await requireVariant(ctx, args.variantId);

    const nextStatus: "scheduled" | "live" | "archived" = args.dropStatus || (args.isDrop ? "scheduled" : "archived");

    await ctx.db.patch(variant._id, {
      isDrop: args.isDrop,
      dropDate: args.isDrop ? (args.dropDate || Date.now() + 86400000 * 2) : undefined,
      dropBadgeTextEn: args.dropBadgeTextEn,
      dropBadgeTextEs: args.dropBadgeTextEs,
      dropStatus: nextStatus,
    });

    return { success: true, variantId: args.variantId, isDrop: args.isDrop, dropStatus: nextStatus };
  },
});

export const scheduleDrop = mutation({
  args: {
    variantId: v.string(),
    dropDate: v.number(),
    dropBadgeTextEn: v.optional(v.string()),
    dropBadgeTextEs: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await requireVariant(ctx, args.variantId);

    await ctx.db.patch(variant._id, {
      isDrop: true,
      dropDate: args.dropDate,
      dropBadgeTextEn: args.dropBadgeTextEn?.trim() || "VIP Exclusive Drop",
      dropBadgeTextEs: args.dropBadgeTextEs?.trim() || "Drop Exclusivo VIP",
      dropStatus: "scheduled",
    });

    return { success: true, variantId: args.variantId, dropDate: args.dropDate, dropStatus: "scheduled" };
  },
});

export const releaseDropNow = mutation({
  args: {
    variantId: v.string(),
    keepBadge: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await requireVariant(ctx, args.variantId);

    await ctx.db.patch(variant._id, {
      dropDate: Date.now() - 1000,
      dropStatus: "live",
      dropBadgeTextEn: args.keepBadge ? variant.dropBadgeTextEn : "Released Drop",
      dropBadgeTextEs: args.keepBadge ? variant.dropBadgeTextEs : "Drop Lanzado",
    });

    return { success: true, variantId: args.variantId, dropStatus: "live" };
  },
});

export const postponeDrop = mutation({
  args: {
    variantId: v.string(),
    newDropDate: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await requireVariant(ctx, args.variantId);

    await ctx.db.patch(variant._id, {
      dropDate: args.newDropDate,
      dropStatus: "scheduled",
    });

    return { success: true, variantId: args.variantId, dropDate: args.newDropDate };
  },
});

export const cancelDrop = mutation({
  args: {
    variantId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await requireVariant(ctx, args.variantId);

    await ctx.db.patch(variant._id, {
      isDrop: false,
      dropDate: undefined,
      dropBadgeTextEn: undefined,
      dropBadgeTextEs: undefined,
      dropStatus: "archived",
    });

    return { success: true, variantId: args.variantId };
  },
});

export const deleteDrop = mutation({
  args: {
    variantId: v.string(),
    deleteSubscribers: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await requireVariant(ctx, args.variantId);

    // Completely clear all drop attributes from the variant
    await ctx.db.patch(variant._id, {
      isDrop: false,
      dropDate: undefined,
      dropBadgeTextEn: undefined,
      dropBadgeTextEs: undefined,
      dropStatus: undefined,
    });

    // Delete any registered drop alerts/waitlist entries for this variant
    if (args.deleteSubscribers !== false) {
      const alerts = await ctx.db
        .query("drop_alerts")
        .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId))
        .collect();
      for (const alert of alerts) {
        await ctx.db.delete(alert._id);
      }
    }

    return { success: true, variantId: args.variantId };
  },
});

export const getAllDropsAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rawVariants = await listCatalogVariants(ctx);
    const dropVariants = rawVariants.filter(hasDropHistory);

    // Sort by dropDate or variantId
    dropVariants.sort((a, b) => (b.dropDate || 0) - (a.dropDate || 0));

    const now = Date.now();
    return await Promise.all(
      dropVariants.map(async (v) => {
        const withUrl = await resolveVariantWithStorageUrl(ctx, v);
        return {
          ...withUrl,
          subscribersCount: await countDropAlerts(ctx, v.variantId),
          computedStatus: computedDropStatus(v, now),
        };
      })
    );
  },
});

export const getDropSubscribers = query({
  args: {
    variantId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (args.variantId) {
      return await ctx.db
        .query("drop_alerts")
        .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId!))
        .collect();
    }
    return await ctx.db.query("drop_alerts").collect();
  },
});

export const getDropSubscribersList = query({
  args: {
    variantId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    let alerts;
    if (args.variantId && args.variantId !== "all") {
      alerts = await ctx.db
        .query("drop_alerts")
        .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId!))
        .collect();
    } else {
      alerts = await ctx.db.query("drop_alerts").collect();
    }

    const variants = await listCatalogVariants(ctx);
    const variantMap = new Map(variants.map((v) => [v.variantId, v]));

    return alerts
      .map((a) => {
        const v = variantMap.get(a.variantId);
        return {
          _id: a._id,
          variantId: a.variantId,
          contact: a.contact,
          channel: a.channel,
          name: a.name,
          locale: a.locale,
          createdAt: a.createdAt,
          notifiedAt: a.notifiedAt,
          variantNameEn: v?.nameEn || a.variantId,
          variantNameEs: v?.nameEs || a.variantId,
          silhouette: v?.silhouette,
          dropDate: v?.dropDate,
          primaryHex: v?.primaryHex,
          image: v?.image,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});
