/**
 * One-off order migrations. Run from the CLI after the deploy that ships them, e.g.
 * `npx convex run orders/migrations:cancelOpenWhatsAppReservations --prod`.
 */
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { appendNote } from "./model";
import { releaseStock, scheduleSessionExpiry } from "./shared";

const BATCH = 100;

/**
 * ADR 0023 cutover: cancel every still-open WhatsApp reservation (`whatsapp_initiated`),
 * give its held units back and expire its Stripe payment links so none can be paid
 * afterwards. Paid WhatsApp orders are history and are left alone. Re-schedules itself
 * until no open reservation is left, so it is safe to run more than once.
 */
export const cancelOpenWhatsAppReservations = internalMutation({
  args: {},
  returns: v.object({ cancelled: v.number(), done: v.boolean() }),
  handler: async (ctx) => {
    const open = await ctx.db
      .query("orders")
      .withIndex("by_status", (q) => q.eq("status", "whatsapp_initiated"))
      .take(BATCH);

    const now = Date.now();
    for (const order of open) {
      await releaseStock(ctx, order.items);
      await ctx.db.patch(order._id, {
        status: "cancelled",
        reservationExpiresAt: undefined,
        adminNotes: appendNote(order.adminNotes, "Cancelled: WhatsApp ordering retired (ADR 0023). Stock released."),
        updatedAt: now,
      });
      await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: "cancelled",
        actor: "migration",
        details: "WhatsApp ordering retired (ADR 0023); reservation cancelled and stock released.",
      });
      await scheduleSessionExpiry(ctx, order._id);
    }

    const done = open.length < BATCH;
    if (!done) {
      await ctx.scheduler.runAfter(0, internal.orders.migrations.cancelOpenWhatsAppReservations, {});
    }
    return { cancelled: open.length, done };
  },
});
