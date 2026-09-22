import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

/**
 * Nightly reconciliation pass over WhatsApp reservation invariants:
 *  - any `whatsapp_initiated` order whose reservation window has elapsed gets the expire
 *    treatment (stock release + cancel), covering scheduled jobs lost to deploys or races;
 *  - bounded batched scan via the by_reservationExpiresAt index.
 */
export const reconcileReservations = internalAction({
  args: {},
  handler: async (ctx): Promise<{ checked: number; expired: number }> => {
    const now = Date.now();
    const BATCH = 500;

    const stale = await ctx.runQuery(internal.orders.getExpiredWhatsAppReservationsInternal, {
      now,
      limit: BATCH,
    });

    let expired = 0;
    for (const order of stale) {
      // expireWhatsAppOrderLead self-vetoes when the hold was extended and still valid,
      // and only acts on orders still awaiting payment — safe to call unconditionally.
      await ctx.runMutation(internal.orders.expireWhatsAppOrderLead, {
        orderId: order._id,
      });
      expired += 1;
    }

    if (stale.length > 0) {
      console.log(`[reconciliation] Released ${stale.length} expired WhatsApp reservations.`);
    }
    return { checked: stale.length, expired };
  },
});

/**
 * INTERNAL query for reservation reconciliation now lives in orders.ts
 * (internal.orders.getExpiredWhatsAppReservationsInternal).
 */

const crons = cronJobs();

crons.interval(
  "whatsapp-reservation-reconciliation",
  { hours: 24 },
  internal.crons.reconcileReservations,
  {}
);

export default crons;
