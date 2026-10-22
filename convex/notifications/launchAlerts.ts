/**
 * Coming Soon category waitlist (ADR 0022): Customer sign-ups, the Administrator's list,
 * and the launch emails sent when the category goes Live.
 */
import { v } from "convex/values";
import { query } from "../_generated/server";
import { internalMutation, mutation } from "../lib/functions";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import { categoryValidator, getCategoryLaunches } from "../settings/launch";
import { generateUnsubscribeToken, isUnsubscribeToken } from "./unsubscribe";
import { enforceSignupRateLimit, normalizeContact, normalizeSignupName } from "./signups";

export { normalizeContact } from "./signups";

/** Email rows claimed per mutation; a full batch schedules the next one. */
export const LAUNCH_EMAIL_BATCH = 100;
const MAX_WAITLIST_LISTED = 1000;

export const subscribeToCategoryLaunch = mutation({
  args: {
    category: categoryValidator,
    contact: v.string(),
    channel: v.union(v.literal("whatsapp"), v.literal("email")),
    name: v.optional(v.string()),
    locale: v.union(v.literal("en"), v.literal("es")),
  },
  returns: v.object({ success: v.boolean(), alreadySubscribed: v.boolean(), id: v.id("drop_alerts") }),
  handler: async (ctx, args) => {
    const subject = (await ctx.auth.getUserIdentity())?.subject;
    await enforceSignupRateLimit(ctx, subject);
    const contact = normalizeContact(args.channel, args.contact);
    const name = normalizeSignupName(args.name);
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
      name,
      clerkUserId: subject,
      locale: args.locale,
      createdAt: Date.now(),
      unsubscribeToken: generateUnsubscribeToken(),
    });
    return { success: true, alreadySubscribed: false, id };
  },
});

/**
 * Stamps `notifiedAt` on a batch of the category's not-yet-notified, still-subscribed email
 * sign-ups, then queues their emails. Stamping first means a subscriber is emailed at most
 * once, even if the category goes Live again. A row without an unsubscribe token (signed up
 * before tokens existed) gets one here, so every launch email can be unsubscribed from.
 */
export const claimLaunchEmails = internalMutation({
  args: { category: categoryValidator },
  returns: v.null(),
  handler: async (ctx, { category }) => {
    const batch = await ctx.db
      .query("drop_alerts")
      .withIndex("by_category_and_channel_and_notifiedAt_and_unsubscribedAt", (q) =>
        q.eq("category", category).eq("channel", "email").eq("notifiedAt", undefined).eq("unsubscribedAt", undefined)
      )
      .take(LAUNCH_EMAIL_BATCH);
    if (batch.length === 0) return null;

    const now = Date.now();
    const recipients = [];
    for (const alert of batch) {
      const unsubscribeToken = alert.unsubscribeToken ?? generateUnsubscribeToken();
      await ctx.db.patch("drop_alerts", alert._id, { notifiedAt: now, unsubscribeToken });
      recipients.push({ id: alert._id, contact: alert.contact, locale: alert.locale, name: alert.name, unsubscribeToken });
    }
    await ctx.scheduler.runAfter(0, internal.notifications.launchEmails.sendLaunchEmails, { category, recipients });
    if (batch.length === LAUNCH_EMAIL_BATCH) {
      await ctx.scheduler.runAfter(0, internal.notifications.launchAlerts.claimLaunchEmails, { category });
    }
    return null;
  },
});

/** Rows of the same contact opted out together; far above anyone's real sign-up count. */
const MAX_ROWS_PER_CONTACT = 100;

const unsubscribeStatus = v.union(v.literal("unsubscribed"), v.literal("already_unsubscribed"), v.literal("not_found"));
type UnsubscribeStatus = typeof unsubscribeStatus.type;

/**
 * Opts the token's sign-up out of marketing email, along with every other sign-up of the same
 * contact on the same channel (CAN-SPAM: an opt-out covers all of the sender's marketing, not
 * one list). Idempotent. A later fresh sign-up is a new opt-in and is not affected.
 */
export async function unsubscribeByToken(ctx: MutationCtx, token: string): Promise<UnsubscribeStatus> {
  if (!isUnsubscribeToken(token)) return "not_found";
  const alert = await ctx.db
    .query("drop_alerts")
    .withIndex("by_unsubscribeToken", (q) => q.eq("unsubscribeToken", token))
    .unique();
  if (!alert) return "not_found";
  if (alert.unsubscribedAt !== undefined) return "already_unsubscribed";

  const now = Date.now();
  const sameContact = await ctx.db
    .query("drop_alerts")
    .withIndex("by_contact", (q) => q.eq("contact", alert.contact))
    .take(MAX_ROWS_PER_CONTACT);
  await ctx.db.patch("drop_alerts", alert._id, { unsubscribedAt: now });
  for (const row of sameContact) {
    if (row._id !== alert._id && row.channel === alert.channel && row.unsubscribedAt === undefined) {
      await ctx.db.patch("drop_alerts", row._id, { unsubscribedAt: now });
    }
  }
  return "unsubscribed";
}

/**
 * Public: the unsubscribe page and the one-click HTTP route. The token is the only credential;
 * the result says nothing about who it belongs to.
 */
export const unsubscribe = mutation({
  args: { token: v.string() },
  returns: v.object({ status: unsubscribeStatus }),
  handler: async (ctx, { token }) => ({ status: await unsubscribeByToken(ctx, token) }),
});

/** Rows read per backfill mutation; each full page schedules the next. */
export const UNSUBSCRIBE_BACKFILL_BATCH = 200;

/**
 * Gives every existing sign-up an unsubscribe token. Idempotent and batched: it patches only
 * rows without a token and schedules itself until the table is done. Run once per deployment
 * after the deploy that adds the field:
 *   npx convex run notifications/launchAlerts:backfillUnsubscribeTokens
 */
export const backfillUnsubscribeTokens = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({ patched: v.number(), isDone: v.boolean() }),
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db
      .query("drop_alerts")
      .paginate({ numItems: UNSUBSCRIBE_BACKFILL_BATCH, cursor: cursor ?? null });
    let patched = 0;
    for (const alert of page.page) {
      if (alert.unsubscribeToken !== undefined) continue;
      await ctx.db.patch("drop_alerts", alert._id, { unsubscribeToken: generateUnsubscribeToken() });
      patched++;
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.notifications.launchAlerts.backfillUnsubscribeTokens, {
        cursor: page.continueCursor,
      });
    }
    return { patched, isDone: page.isDone };
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
  unsubscribedAt: v.optional(v.number()),
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
      .map(({ _id, contact, channel, name, locale, createdAt, notifiedAt, unsubscribedAt }) => ({
        _id, contact, channel, name, locale, createdAt, notifiedAt, unsubscribedAt,
      }))
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
