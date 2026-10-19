/**
 * Limited drops: scheduling and release (Administrator), the storefront Drop Radar,
 * and drop-alert subscribers (waitlist).
 */
import { query, mutation, internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import schema from "../schema";
import { requireAdmin } from "../lib/auth";
import { computedDropStatus, hasDropHistory, isUpcomingDrop } from "./model";
import { actorEmail } from "./audit";
import { countDropAlerts, listCatalogVariants, patchVariantAudited, requireActiveVariant, requireVariant, resolveProduct } from "./shared";
import { adminDropRow, dropStatusValidator, dropSubscriberRow, variantWithSubscribers } from "./validators";

/**
 * Most recent subscribers an admin list returns. Lists clamp at this size; export through
 * a paginated query before a waitlist gets close.
 */
const MAX_SUBSCRIBERS_LISTED = 1000;

/** Drop alerts deleted per mutation; larger waitlists continue in a scheduled batch. */
const ALERT_DELETE_BATCH = 500;

/** Delete one batch of a variant's alerts; true when more may remain. */
export async function deleteAlertBatch(ctx: MutationCtx, variantId: string): Promise<boolean> {
  const alerts = await ctx.db
    .query("drop_alerts")
    .withIndex("by_variantId", (q) => q.eq("variantId", variantId))
    .take(ALERT_DELETE_BATCH);
  for (const alert of alerts) {
    await ctx.db.delete(alert._id);
  }
  return alerts.length === ALERT_DELETE_BATCH;
}

/**
 * Storefront Drop Radar. `clientTime` is supplied by the caller (minute granularity):
 * queries must not read the wall clock, or the result would never move past a release.
 */
export const getUpcomingDrops = query({
  args: { clientTime: v.number() },
  returns: v.array(variantWithSubscribers),
  handler: async (ctx, args) => {
    const rawVariants = await listCatalogVariants(ctx);
    const dropVariants = rawVariants.filter((v) => v.archivedAt === undefined && isUpcomingDrop(v, args.clientTime));

    // Sort by earliest dropDate
    dropVariants.sort((a, b) => (a.dropDate || 0) - (b.dropDate || 0));

    return await Promise.all(
      dropVariants.map(async (v) => {
        const withUrl = await resolveProduct(ctx, v);
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
  returns: v.object({ success: v.boolean(), alreadySubscribed: v.boolean(), id: v.id("drop_alerts") }),
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
  returns: v.object({ success: v.boolean(), variantId: v.string(), isDrop: v.boolean(), dropStatus: dropStatusValidator }),
  handler: async (ctx, args) => {
    const actor = actorEmail(await requireAdmin(ctx));
    const variant = await requireActiveVariant(ctx, args.variantId);

    const nextStatus: "scheduled" | "live" | "archived" = args.dropStatus || (args.isDrop ? "scheduled" : "archived");

    await patchVariantAudited(
      ctx,
      variant,
      {
        isDrop: args.isDrop,
        dropDate: args.isDrop ? (args.dropDate || Date.now() + 86400000 * 2) : undefined,
        dropBadgeTextEn: args.dropBadgeTextEn,
        dropBadgeTextEs: args.dropBadgeTextEs,
        dropStatus: nextStatus,
      },
      "drop_changed",
      actor
    );

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
  returns: v.object({ success: v.boolean(), variantId: v.string(), dropDate: v.number(), dropStatus: v.literal("scheduled") }),
  handler: async (ctx, args) => {
    const actor = actorEmail(await requireAdmin(ctx));
    const variant = await requireActiveVariant(ctx, args.variantId);

    await patchVariantAudited(
      ctx,
      variant,
      {
        isDrop: true,
        dropDate: args.dropDate,
        dropBadgeTextEn: args.dropBadgeTextEn?.trim() || "VIP Exclusive Drop",
        dropBadgeTextEs: args.dropBadgeTextEs?.trim() || "Drop Exclusivo VIP",
        dropStatus: "scheduled",
      },
      "drop_changed",
      actor
    );

    return { success: true, variantId: args.variantId, dropDate: args.dropDate, dropStatus: "scheduled" as const };
  },
});

export const releaseDropNow = mutation({
  args: {
    variantId: v.string(),
    keepBadge: v.optional(v.boolean()),
  },
  returns: v.object({ success: v.boolean(), variantId: v.string(), dropStatus: v.literal("live") }),
  handler: async (ctx, args) => {
    const actor = actorEmail(await requireAdmin(ctx));
    const variant = await requireActiveVariant(ctx, args.variantId);

    await patchVariantAudited(
      ctx,
      variant,
      {
        dropDate: Date.now() - 1000,
        dropStatus: "live",
        dropBadgeTextEn: args.keepBadge ? variant.dropBadgeTextEn : "Released Drop",
        dropBadgeTextEs: args.keepBadge ? variant.dropBadgeTextEs : "Drop Lanzado",
      },
      "drop_changed",
      actor
    );

    return { success: true, variantId: args.variantId, dropStatus: "live" as const };
  },
});

export const postponeDrop = mutation({
  args: {
    variantId: v.string(),
    newDropDate: v.number(),
  },
  returns: v.object({ success: v.boolean(), variantId: v.string(), dropDate: v.number() }),
  handler: async (ctx, args) => {
    const actor = actorEmail(await requireAdmin(ctx));
    const variant = await requireActiveVariant(ctx, args.variantId);

    await patchVariantAudited(
      ctx,
      variant,
      {
        dropDate: args.newDropDate,
        dropStatus: "scheduled",
      },
      "drop_changed",
      actor
    );

    return { success: true, variantId: args.variantId, dropDate: args.newDropDate };
  },
});

export const cancelDrop = mutation({
  args: {
    variantId: v.string(),
  },
  returns: v.object({ success: v.boolean(), variantId: v.string() }),
  handler: async (ctx, args) => {
    const actor = actorEmail(await requireAdmin(ctx));
    const variant = await requireVariant(ctx, args.variantId);

    await patchVariantAudited(
      ctx,
      variant,
      {
        isDrop: false,
        dropDate: undefined,
        dropBadgeTextEn: undefined,
        dropBadgeTextEs: undefined,
        dropStatus: "archived",
      },
      "drop_changed",
      actor
    );

    return { success: true, variantId: args.variantId };
  },
});

export const deleteDrop = mutation({
  args: {
    variantId: v.string(),
    deleteSubscribers: v.optional(v.boolean()),
  },
  returns: v.object({ success: v.boolean(), variantId: v.string() }),
  handler: async (ctx, args) => {
    const actor = actorEmail(await requireAdmin(ctx));
    const variant = await requireVariant(ctx, args.variantId);

    // Completely clear all drop attributes from the variant
    await patchVariantAudited(
      ctx,
      variant,
      {
        isDrop: false,
        dropDate: undefined,
        dropBadgeTextEn: undefined,
        dropBadgeTextEs: undefined,
        dropStatus: undefined,
      },
      "drop_changed",
      actor
    );

    // Delete any registered drop alerts/waitlist entries for this variant
    if (args.deleteSubscribers !== false && (await deleteAlertBatch(ctx, args.variantId))) {
      await ctx.scheduler.runAfter(0, internal.catalog.drops.deleteDropAlertsBatch, { variantId: args.variantId });
    }

    return { success: true, variantId: args.variantId };
  },
});

/** INTERNAL: continue deleting a large waitlist in batches (scheduled by deleteDrop). */
export const deleteDropAlertsBatch = internalMutation({
  args: { variantId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (await deleteAlertBatch(ctx, args.variantId)) {
      await ctx.scheduler.runAfter(0, internal.catalog.drops.deleteDropAlertsBatch, { variantId: args.variantId });
    }
    return null;
  },
});

/** Admin drop desk. `clientTime` is supplied by the caller (see getUpcomingDrops). */
export const getAllDropsAdmin = query({
  args: { clientTime: v.number() },
  returns: v.array(adminDropRow),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rawVariants = await listCatalogVariants(ctx);
    const dropVariants = rawVariants.filter((row) => row.archivedAt === undefined && hasDropHistory(row));

    // Sort by dropDate or variantId
    dropVariants.sort((a, b) => (b.dropDate || 0) - (a.dropDate || 0));

    return await Promise.all(
      dropVariants.map(async (v) => {
        const withUrl = await resolveProduct(ctx, v);
        return {
          ...withUrl,
          subscribersCount: await countDropAlerts(ctx, v.variantId),
          computedStatus: computedDropStatus(v, args.clientTime),
        };
      })
    );
  },
});

export const getDropSubscribers = query({
  args: {
    variantId: v.optional(v.string()),
  },
  returns: v.array(schema.doc("drop_alerts")),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (args.variantId) {
      return await ctx.db
        .query("drop_alerts")
        .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId!))
        .take(MAX_SUBSCRIBERS_LISTED);
    }
    return await ctx.db.query("drop_alerts").withIndex("by_createdAt").order("desc").take(MAX_SUBSCRIBERS_LISTED);
  },
});

export const getDropSubscribersList = query({
  args: {
    variantId: v.optional(v.string()),
  },
  returns: v.array(dropSubscriberRow),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    let alerts;
    if (args.variantId && args.variantId !== "all") {
      alerts = await ctx.db
        .query("drop_alerts")
        .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId!))
        .order("desc")
        .take(MAX_SUBSCRIBERS_LISTED);
    } else {
      alerts = await ctx.db.query("drop_alerts").withIndex("by_createdAt").order("desc").take(MAX_SUBSCRIBERS_LISTED);
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
