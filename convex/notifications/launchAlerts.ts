/**
 * Coming Soon category waitlist (ADR 0022): Customer sign-ups, the Administrator's list,
 * and the launch emails sent when the category goes Live.
 */
import { v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import { categoryValidator, getCategoryLaunches } from "../settings/launch";

/** Email rows claimed per mutation; a full batch schedules the next one. */
export const LAUNCH_EMAIL_BATCH = 100;
const MAX_WAITLIST_LISTED = 1000;

export const subscribeToCategoryLaunch = mutation({
  args: {
    category: categoryValidator,
    contact: v.string(),
    channel: v.union(v.literal("whatsapp"), v.literal("email")),
    name: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
    locale: v.union(v.literal("en"), v.literal("es")),
  },
  returns: v.object({ success: v.boolean(), alreadySubscribed: v.boolean(), id: v.id("drop_alerts") }),
  handler: async (ctx, args) => {
    const contact = args.contact.trim().toLowerCase();
    if (!contact) throw new Error("Contact information is required");
    if ((await getCategoryLaunches(ctx))[args.category].status !== "coming_soon") {
      throw new Error("This category is not accepting sign-ups");
    }

    const existing = await ctx.db
      .query("drop_alerts")
      .withIndex("by_category_and_contact", (q) => q.eq("category", args.category).eq("contact", contact))
      .first();
    if (existing) return { success: true, alreadySubscribed: true, id: existing._id };

    const id = await ctx.db.insert("drop_alerts", {
      category: args.category,
      contact,
      channel: args.channel,
      name: args.name?.trim() || undefined,
      clerkUserId: args.clerkUserId,
      locale: args.locale,
      createdAt: Date.now(),
    });
    return { success: true, alreadySubscribed: false, id };
  },
});

/**
 * Stamps `notifiedAt` on a batch of the category's not-yet-notified email sign-ups, then
 * queues their emails. Stamping first means a subscriber is emailed at most once, even if the
 * category goes Live again.
 */
export const claimLaunchEmails = internalMutation({
  args: { category: categoryValidator },
  returns: v.null(),
  handler: async (ctx, { category }) => {
    const batch = await ctx.db
      .query("drop_alerts")
      .withIndex("by_category_and_channel_and_notifiedAt", (q) =>
        q.eq("category", category).eq("channel", "email").eq("notifiedAt", undefined)
      )
      .take(LAUNCH_EMAIL_BATCH);
    if (batch.length === 0) return null;

    const now = Date.now();
    for (const alert of batch) {
      await ctx.db.patch("drop_alerts", alert._id, { notifiedAt: now });
    }
    await ctx.scheduler.runAfter(0, internal.notifications.launchEmails.sendLaunchEmails, {
      category,
      recipients: batch.map((a) => ({ id: a._id, contact: a.contact, locale: a.locale, name: a.name })),
    });
    if (batch.length === LAUNCH_EMAIL_BATCH) {
      await ctx.scheduler.runAfter(0, internal.notifications.launchAlerts.claimLaunchEmails, { category });
    }
    return null;
  },
});

const waitlistRow = v.object({
  _id: v.id("drop_alerts"),
  contact: v.string(),
  channel: v.union(v.literal("whatsapp"), v.literal("email")),
  name: v.optional(v.string()),
  locale: v.union(v.literal("en"), v.literal("es")),
  createdAt: v.number(),
  notifiedAt: v.optional(v.number()),
});

export const getCategoryWaitlistAdmin = query({
  args: { category: categoryValidator },
  returns: v.array(waitlistRow),
  handler: async (ctx, { category }) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("drop_alerts")
      .withIndex("by_category_and_contact", (q) => q.eq("category", category))
      .take(MAX_WAITLIST_LISTED);
    return rows
      .map(({ _id, contact, channel, name, locale, createdAt, notifiedAt }) => ({ _id, contact, channel, name, locale, createdAt, notifiedAt }))
      .sort((a, b) => b.createdAt - a.createdAt || (a._id < b._id ? 1 : -1));
  },
});

export const markAlertNotified = mutation({
  args: { id: v.id("drop_alerts") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const alert = await ctx.db.get("drop_alerts", id);
    if (!alert) throw new Error("Sign-up not found");
    if (alert.notifiedAt === undefined) await ctx.db.patch("drop_alerts", id, { notifiedAt: Date.now() });
    return null;
  },
});
