/**
 * One-off order migrations. Run from the CLI after the deploy that ships them, e.g.
 * `npx convex run orders/migrations:backfillOrderStatusAxes --prod`.
 */
import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { appendNote } from "./model";
import { releaseStock, scheduleSessionExpiry } from "./shared";
import { legacyStatusAxes, statusPatch, type LegacyEvidence } from "./status";

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

    for (const order of open) {
      await retireWhatsAppReservation(ctx, order);
    }

    const done = open.length < BATCH;
    if (!done) {
      await ctx.scheduler.runAfter(0, internal.orders.migrations.cancelOpenWhatsAppReservations, {});
    }
    return { cancelled: open.length, done };
  },
});

/**
 * Cancel one open WhatsApp reservation (ADR 0023): give its units back, write the cancelled
 * marker and both status axes (ADR 0024), and expire any payment link.
 */
async function retireWhatsAppReservation(ctx: MutationCtx, order: Doc<"orders">) {
  const now = Date.now();
  await releaseStock(ctx, order.items);
  await ctx.db.patch(order._id, {
    ...statusPatch(
      { paymentStatus: "awaiting_payment", fulfillmentStatus: "unfulfilled" },
      { cancelledAt: now, cancellationReason: "whatsapp_retired" }
    ),
    // Keeps cancelOpenWhatsAppReservations (which finds rows by legacy status) idempotent.
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

/** Payment events that prove an Order was paid (ADR 0006, ADR 0023). */
const SETTLEMENT_EVENTS = new Set(["stripe_settled", "zelle_settled"]);

/** What the audit log says about an Order the single status cannot: was it ever paid, and when was it cancelled. */
async function legacyEvidence(ctx: MutationCtx, order: Doc<"orders">): Promise<LegacyEvidence> {
  const evidence: LegacyEvidence = { settled: false };
  for await (const event of ctx.db.query("payment_events").withIndex("by_order", (q) => q.eq("orderId", order._id))) {
    if (SETTLEMENT_EVENTS.has(event.type)) evidence.settled = true;
    if (event.type === "cancelled" && evidence.cancelledAt === undefined) evidence.cancelledAt = event.createdAt;
  }
  return evidence;
}

/**
 * ADR 0024 backfill: give every Order its Payment Status, Fulfillment Status and cancelled
 * marker from the legacy single `status` (mapping in orders/status.ts `legacyStatusAxes`).
 * Walks the whole table in batches and re-schedules itself until done. Orders that already
 * carry both axes are skipped, so it is safe to run twice. Leaves `status` in place; a later
 * PR removes it. Any still-open WhatsApp reservation is retired as ADR 0023 does.
 */
export const backfillOrderStatusAxes = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({ scanned: v.number(), updated: v.number(), done: v.boolean() }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? BATCH;
    const page = await ctx.db.query("orders").paginate({ numItems: batchSize, cursor: args.cursor ?? null });

    let updated = 0;
    for (const order of page.page) {
      if (order.paymentStatus && order.fulfillmentStatus) continue;
      if (order.status === "whatsapp_initiated") {
        await retireWhatsAppReservation(ctx, order);
      } else {
        const axes = legacyStatusAxes(order, await legacyEvidence(ctx, order));
        await ctx.db.patch(order._id, statusPatch(axes, {}));
      }
      updated += 1;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.orders.migrations.backfillOrderStatusAxes, {
        cursor: page.continueCursor,
        batchSize,
      });
    }
    return { scanned: page.page.length, updated, done: page.isDone };
  },
});

/** Orders still missing an axis (bounded scan): 0 once the backfill has finished. */
export const countOrdersMissingStatusAxes = internalQuery({
  args: {},
  returns: v.object({ missing: v.number(), scanned: v.number() }),
  handler: async (ctx) => {
    const SCAN = 5000;
    const orders = await ctx.db.query("orders").take(SCAN);
    const missing = orders.filter((o) => !o.paymentStatus || !o.fulfillmentStatus).length;
    return { missing, scanned: orders.length };
  },
});
