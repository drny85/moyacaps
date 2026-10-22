/**
 * Limited drops: scheduling and release (Administrator), the storefront Drop Radar,
 * and drop-alert subscribers (waitlist).
 */
import { query } from "../_generated/server";
import { mutation, internalMutation } from "../lib/functions";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import schema from "../schema";
import { requireAdmin } from "../lib/auth";
import { computedDropStatus, dropReleasePatch, hasDropHistory, isCustomerVisible, isOverdueScheduledDrop, isReleaseJobCurrent, isUpcomingDrop } from "./model";
import { getCategoryLaunches } from "../settings/launch";
import { generateUnsubscribeToken } from "../notifications/unsubscribe";
import { actorEmail } from "./audit";
import { getVariant } from "./inventory";
import { countDropAlerts, listCatalogVariants, patchVariantAudited, requireActiveVariant, requireVariant, requireVersion, resolveProduct } from "./shared";
import { adminDropRow, dropStatusValidator, dropSubscriberRow, variantWithSubscribers } from "./validators";
import { enforceSignupRateLimit, normalizeContact, normalizeSignupName } from "../notifications/signups";

/**
 * Most recent subscribers an admin list returns. Lists clamp at this size; export through
 * a paginated query before a waitlist gets close.
 */
const MAX_SUBSCRIBERS_LISTED = 1000;

/** Drop alerts deleted per mutation; larger waitlists continue in a scheduled batch. */
const ALERT_DELETE_BATCH = 500;

/** Actor recorded on the audit event of a release the scheduler performed. */
export const SCHEDULER_ACTOR = "system:drop-scheduler";

/**
 * Release job lifecycle. A drop scheduled for `dropDate` carries one `_scheduled_functions`
 * job (`dropReleaseJobId`) that runs `releaseScheduledDrop` at that instant. Any change to the
 * drop (reschedule, release now, cancel, delete) cancels the job first; rescheduling makes a
 * new one. The job also re-checks the row when it runs (`isReleaseJobCurrent`), so a job that
 * slipped past a cancel is still a no-op. `dropReleaseJobId` is bookkeeping, patched outside
 * the audit trail: it never appears in the product history.
 */
async function cancelReleaseJob(ctx: MutationCtx, variant: Doc<"variants">, runningJobId?: Id<"_scheduled_functions">): Promise<void> {
  if (variant.dropReleaseJobId === undefined) return;
  // The release job itself is already running: forget it, never cancel it.
  if (variant.dropReleaseJobId !== runningJobId) await ctx.scheduler.cancel(variant.dropReleaseJobId);
  await ctx.db.patch("variants", variant._id, { dropReleaseJobId: undefined });
}

/** Replace the variant's release job with one firing at `dropDate`. */
async function scheduleReleaseJob(ctx: MutationCtx, variant: Doc<"variants">, dropDate: number): Promise<void> {
  await cancelReleaseJob(ctx, variant);
  const jobId = await ctx.scheduler.runAt(dropDate, internal.catalog.drops.releaseScheduledDrop, {
    variantId: variant.variantId,
    dropDate,
  });
  await ctx.db.patch("variants", variant._id, { dropReleaseJobId: jobId });
}

/**
 * Put a drop on sale: the admin's Release now and the scheduled release both come here, so
 * both write the same fields and the same `drop_changed` event. Any pending job is cancelled.
 */
async function releaseDrop(
  ctx: MutationCtx,
  variant: Doc<"variants">,
  keepBadge: boolean,
  actor: string,
  runningJobId?: Id<"_scheduled_functions">
): Promise<void> {
  await cancelReleaseJob(ctx, variant, runningJobId);
  await patchVariantAudited(ctx, variant, dropReleasePatch(variant, Date.now(), keepBadge), "drop_changed", actor);
}

/**
 * Release every scheduled drop in `variants` whose date has passed (catalog/migrations.ts
 * backfill). Returns the released variant ids. Keeps the badge, like the scheduled release.
 */
export async function releaseOverdue(ctx: MutationCtx, variants: Doc<"variants">[], now: number, actor: string): Promise<string[]> {
  const released: string[] = [];
  for (const variant of variants) {
    if (!isOverdueScheduledDrop(variant, now)) continue;
    await releaseDrop(ctx, variant, true, actor);
    released.push(variant.variantId);
  }
  return released;
}

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
    const launches = await getCategoryLaunches(ctx);
    const dropVariants = rawVariants.filter((v) => isCustomerVisible(v, launches) && isUpcomingDrop(v, args.clientTime));

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
    // Deprecated and ignored: the sign-up's account comes from the auth token only.
    clerkUserId: v.optional(v.string()),
    locale: v.union(v.literal("en"), v.literal("es")),
  },
  returns: v.object({ success: v.boolean(), alreadySubscribed: v.boolean(), id: v.id("drop_alerts") }),
  handler: async (ctx, args) => {
    const subject = (await ctx.auth.getUserIdentity())?.subject;
    await enforceSignupRateLimit(ctx, subject);
    const cleanContact = normalizeContact(args.channel, args.contact);
    const name = normalizeSignupName(args.name);

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
      name,
      clerkUserId: subject,
      locale: args.locale,
      createdAt: Date.now(),
      unsubscribeToken: generateUnsubscribeToken(),
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
    /** The editor's row version; when given, a newer row is rejected as `stale`. */
    expectedUpdatedAt: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    variantId: v.string(),
    isDrop: v.boolean(),
    dropStatus: dropStatusValidator,
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const actor = actorEmail(await requireAdmin(ctx));
    const variant = await requireActiveVariant(ctx, args.variantId);
    if (args.expectedUpdatedAt !== undefined) requireVersion(variant, args.expectedUpdatedAt);

    const nextStatus: "scheduled" | "live" | "archived" = args.dropStatus || (args.isDrop ? "scheduled" : "archived");
    const dropDate = args.isDrop ? (args.dropDate || Date.now() + 86400000 * 2) : undefined;

    if (args.isDrop && nextStatus === "scheduled" && dropDate !== undefined) {
      await scheduleReleaseJob(ctx, variant, dropDate);
    } else {
      await cancelReleaseJob(ctx, variant);
    }
    const updatedAt = await patchVariantAudited(
      ctx,
      variant,
      {
        isDrop: args.isDrop,
        dropDate,
        dropBadgeTextEn: args.dropBadgeTextEn,
        dropBadgeTextEs: args.dropBadgeTextEs,
        dropStatus: nextStatus,
      },
      "drop_changed",
      actor
    );

    return { success: true, variantId: args.variantId, isDrop: args.isDrop, dropStatus: nextStatus, updatedAt };
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

    await scheduleReleaseJob(ctx, variant, args.dropDate);
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

    await releaseDrop(ctx, variant, args.keepBadge === true, actor);

    return { success: true, variantId: args.variantId, dropStatus: "live" as const };
  },
});

/**
 * INTERNAL: the release job (scheduled by scheduleDrop / postponeDrop / updateVariantDropStatus).
 * Releases the drop only while it is still scheduled for this job's `dropDate`; a job left
 * over from a reschedule, a cancel or a deleted product does nothing. Keeps the badge copy
 * the Administrator wrote (the admin button's `keepBadge`): the automatic release is the
 * planned one, so the badge still fits.
 */
export const releaseScheduledDrop = internalMutation({
  args: { variantId: v.string(), dropDate: v.number() },
  returns: v.object({ released: v.boolean() }),
  handler: async (ctx, args) => {
    const variant = await getVariant(ctx, args.variantId);
    if (!variant || variant.archivedAt !== undefined || !isReleaseJobCurrent(variant, args.dropDate)) {
      return { released: false };
    }
    await releaseDrop(ctx, variant, true, SCHEDULER_ACTOR, variant.dropReleaseJobId);
    return { released: true };
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

    await scheduleReleaseJob(ctx, variant, args.newDropDate);
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

    await cancelReleaseJob(ctx, variant);
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
    await cancelReleaseJob(ctx, variant);
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
    const alerts = await ctx.db.query("drop_alerts").withIndex("by_createdAt").order("desc").take(MAX_SUBSCRIBERS_LISTED);
    // Category waitlists (ADR 0022) have no product and are listed on their own.
    return alerts.filter((a) => a.variantId !== undefined);
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
    // Category waitlists (ADR 0022) have no product and are listed on their own.
    const productAlerts = alerts.flatMap((a) => (a.variantId === undefined ? [] : [{ ...a, variantId: a.variantId }]));

    const variants = await listCatalogVariants(ctx);
    const variantMap = new Map(variants.map((v) => [v.variantId, v]));

    return productAlerts
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
