/**
 * Review invite (ADR 0028, plan 0011): one email per delivered Order, seven days after
 * delivery, asking the Customer to review what they bought. Guests (no clerkUserId at
 * delivery) get none. The invite is skipped, with the reason recorded, when it would be
 * pointless: already sent, Order no longer delivered, email opted out, or nothing left to review.
 * A failed send is recorded as "send_failed" and not retried.
 */
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction, internalQuery, type MutationCtx } from "../_generated/server";
import { internalMutation } from "../lib/functions";
import { generateUnsubscribeToken, isUnsubscribeToken } from "../notifications/unsubscribe";
import { REVIEW_INVITE_DELAY_MS, reviewableLines } from "./model";
import { loadRefunds } from "./shared";

export type InviteSkipReason =
  | "already_sent"
  | "order_not_delivered"
  | "opted_out"
  | "nothing_to_review"
  | "send_failed";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Schedules the invite for a freshly delivered Order. Idempotent: one row per Order. */
export async function scheduleReviewInvite(ctx: MutationCtx, order: Doc<"orders">, now: number): Promise<void> {
  const email = order.customerEmail ? normalizeEmail(order.customerEmail) : "";
  if (!email.includes("@") || !order.clerkUserId) return;
  const existing = await ctx.db
    .query("review_invites")
    .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
    .first();
  if (existing) return;

  const sendAt = now + REVIEW_INVITE_DELAY_MS;
  const inviteId = await ctx.db.insert("review_invites", {
    orderId: order._id,
    email,
    sendAt,
    unsubscribeToken: generateUnsubscribeToken(),
  });
  const jobId = await ctx.scheduler.runAt(sendAt, internal.reviews.invites.sendReviewInvite, { inviteId });
  await ctx.db.patch(inviteId, { jobId });
}

const inviteContext = v.union(
  v.null(),
  v.object({
    sentAt: v.optional(v.number()),
    email: v.string(),
    unsubscribeToken: v.string(),
    orderNumber: v.string(),
    customerName: v.optional(v.string()),
    delivered: v.boolean(),
    optedOut: v.boolean(),
    reviewableNames: v.array(v.string()),
  })
);

/** Everything the send decision needs, read in one transaction. */
export const loadInviteContext = internalQuery({
  args: { inviteId: v.id("review_invites") },
  returns: inviteContext,
  handler: async (ctx, { inviteId }) => {
    const invite = await ctx.db.get(inviteId);
    if (!invite) return null;
    const order = await ctx.db.get(invite.orderId);
    if (!order) return null;
    const optout = await ctx.db
      .query("email_optouts")
      .withIndex("by_email_and_kind", (q) => q.eq("email", invite.email).eq("kind", "review_invite"))
      .first();

    const delivered = order.fulfillmentStatus === "delivered" && !order.cancelledAt;
    const reviewableNames: string[] = [];
    if (delivered && !optout && order.clerkUserId) {
      const refunds = await loadRefunds(ctx, order._id);
      const owner = order.clerkUserId;
      const seen = new Set<string>();
      for (const item of order.items) {
        if (!item.variantId || seen.has(item.variantId)) continue;
        seen.add(item.variantId);
        const variantId = item.variantId;
        if (reviewableLines(order, refunds, variantId).length === 0) continue;
        const reviewed = await ctx.db
          .query("product_reviews")
          .withIndex("by_clerkUserId_and_variantId", (q) => q.eq("clerkUserId", owner).eq("variantId", variantId))
          .first();
        if (!reviewed) reviewableNames.push(item.name);
      }
    }
    return {
      sentAt: invite.sentAt,
      email: invite.email,
      unsubscribeToken: invite.unsubscribeToken,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      delivered,
      optedOut: optout !== null,
      reviewableNames,
    };
  },
});

export const markInvite = internalMutation({
  args: {
    inviteId: v.id("review_invites"),
    sentAt: v.optional(v.number()),
    skippedReason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { inviteId, sentAt, skippedReason }) => {
    await ctx.db.patch(inviteId, { ...(sentAt !== undefined ? { sentAt } : {}), ...(skippedReason ? { skippedReason } : {}) });
    return null;
  },
});

/** Runs at `sendAt`: skips with a recorded reason, or emails the invite and stamps `sentAt`. */
export const sendReviewInvite = internalAction({
  args: { inviteId: v.id("review_invites") },
  returns: v.null(),
  handler: async (ctx, { inviteId }) => {
    const info = await ctx.runQuery(internal.reviews.invites.loadInviteContext, { inviteId });
    if (!info) return null;

    const skip = async (skippedReason: InviteSkipReason) => {
      await ctx.runMutation(internal.reviews.invites.markInvite, { inviteId, skippedReason });
      return null;
    };
    if (info.sentAt !== undefined) return await skip("already_sent");
    if (!info.delivered) return await skip("order_not_delivered");
    if (info.optedOut) return await skip("opted_out");
    if (info.reviewableNames.length === 0) return await skip("nothing_to_review");

    const result = await ctx.runAction(internal.notifications.emails.sendReviewInviteEmail, {
      orderNumber: info.orderNumber,
      customerName: info.customerName,
      customerEmail: info.email,
      unsubscribeToken: info.unsubscribeToken,
      itemNames: info.reviewableNames,
    });
    if (!result.success) return await skip("send_failed");
    await ctx.runMutation(internal.reviews.invites.markInvite, { inviteId, sentAt: Date.now() });
    return null;
  },
});

/** One-click opt-out. Unknown or malformed tokens change nothing; one row per email. */
export const optOutByToken = internalMutation({
  args: { token: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { token }) => {
    if (!isUnsubscribeToken(token)) return false;
    const invite = await ctx.db
      .query("review_invites")
      .withIndex("by_unsubscribeToken", (q) => q.eq("unsubscribeToken", token))
      .unique();
    if (!invite) return false;
    const existing = await ctx.db
      .query("email_optouts")
      .withIndex("by_email_and_kind", (q) => q.eq("email", invite.email).eq("kind", "review_invite"))
      .first();
    if (!existing) {
      await ctx.db.insert("email_optouts", { email: invite.email, kind: "review_invite", createdAt: Date.now() });
    }
    return true;
  },
});
