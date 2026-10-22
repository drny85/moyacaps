/**
 * Guest Order claims (ADR 0026): a signed-in Customer with a verified email takes ownership of
 * the guest Orders placed with that email, so they show in their account history. Called from
 * the user sync paths (users/functions.ts); the rules live in guestClaimModel.ts.
 */
import { v } from "convex/values";
import { type MutationCtx } from "../_generated/server";
import { internalMutation } from "../lib/functions";
import { isClaimable, MAX_ORDERS_CLAIMED, normalizeEmail } from "./guestClaimModel";

/**
 * Attach every guest Order placed with `email` to `clerkUserId`. `email` must already be a
 * verified address from Clerk (guestClaimModel.claimableEmail); callers never pass one a
 * client sent. Returns how many Orders were claimed.
 */
export async function claimGuestOrders(ctx: MutationCtx, clerkUserId: string, email: string): Promise<number> {
  const orders = await ctx.db
    .query("orders")
    .withIndex("by_customerEmail", (q) => q.eq("customerEmail", email))
    .take(MAX_ORDERS_CLAIMED);

  const now = Date.now();
  let claimed = 0;
  for (const order of orders) {
    if (!isClaimable(order)) continue;
    await ctx.db.patch("orders", order._id, { clerkUserId, updatedAt: now });
    claimed++;
  }
  return claimed;
}

/** Orders one backfill page reads. */
const EMAIL_BACKFILL_PAGE = 200;

/**
 * ADR 0026: claims match `customerEmail` exactly through its index, so stored emails must be
 * normalized. Lowercases and trims every Order's email, one page per call. Idempotent; run on
 * each deployment, passing `continueCursor` back until `isDone`:
 *   npx convex run orders/guestClaim:normalizeOrderEmails
 */
export const normalizeOrderEmails = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({ patched: v.number(), isDone: v.boolean(), continueCursor: v.string() }),
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query("orders").paginate({ numItems: EMAIL_BACKFILL_PAGE, cursor: cursor ?? null });
    let patched = 0;
    for (const order of page.page) {
      const normalized = normalizeEmail(order.customerEmail);
      if (order.customerEmail === undefined || normalized === order.customerEmail) continue;
      await ctx.db.patch("orders", order._id, { customerEmail: normalized });
      patched++;
    }
    return { patched, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});
