/// <reference types="vite/client" />
/**
 * ADR 0024 split status, end to end: the backfill from the legacy single `status`, each axis
 * staying independent through real settlement / refund / dispute / label / carrier writes,
 * the read fallback for Orders the backfill has not reached, and the admin desk filters.
 */
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import schema from "../schema";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";

const modules = import.meta.glob("/convex/**/*.ts");
const t = () => convexTest(schema, modules);
type T = ReturnType<typeof t>;

const admin = (tt: T) => tt.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL });

async function drain(tt: T) {
  await tt.finishAllScheduledFunctions(() => {});
}

async function seedVariant(tt: T, variantId: string, stock: number) {
  await tt.run(async (ctx) => {
    await ctx.db.insert("variants", {
      variantId,
      isAvailable: true,
      nameEn: `Cap ${variantId}`,
      nameEs: `Gorra ${variantId}`,
      silhouette: "snapback",
      primaryHex: "#000000",
      secondaryHex: "#ffffff",
      image: "/img.png",
      stock,
      priceUsd: 100,
      isFeatured: false,
    });
  });
}

async function getStock(tt: T, variantId: string): Promise<number> {
  return await tt.run(async (ctx) => {
    const v = await ctx.db
      .query("variants")
      .withIndex("by_variantId", (q) => q.eq("variantId", variantId))
      .first();
    return v?.stock ?? -1;
  });
}

async function getOrder(tt: T, orderNumber: string) {
  return await tt.run(async (ctx) =>
    ctx.db
      .query("orders")
      .withIndex("by_orderNumber", (q) => q.eq("orderNumber", orderNumber))
      .first()
  );
}

function lifecycle(order: Doc<"orders"> | null | undefined) {
  return {
    payment: order?.paymentStatus,
    fulfillment: order?.fulfillmentStatus,
    cancelled: order?.cancelledAt !== undefined,
  };
}

type LegacyOrder = Partial<Doc<"orders">> & { orderNumber: string; status: NonNullable<Doc<"orders">["status"]> };

/** Insert an Order the way the single-status code stored it: no axes. */
async function seedLegacy(tt: T, fields: LegacyOrder): Promise<Id<"orders">> {
  return await tt.run(async (ctx) =>
    ctx.db.insert("orders", {
      items: [{ variantId: "V1", name: "Cap V1", quantity: 1, price: 100, image: "/img.png" }],
      currency: "USD",
      total: 100,
      paymentMethod: "stripe",
      createdAt: 1_000,
      updatedAt: 2_000,
      ...fields,
    })
  );
}

async function auditEvent(tt: T, orderId: Id<"orders">, orderNumber: string, type: string, createdAt: number) {
  await tt.run(async (ctx) => {
    await ctx.db.insert("payment_events", { orderId, orderNumber, type, createdAt });
  });
}

async function settle(tt: T, orderNumber: string, total = 100) {
  return await tt.mutation(internal.orders.settlement.createOrUpdateStripeOrder, {
    stripeSessionId: `cs_${orderNumber}`,
    orderNumber,
    customerEmail: "buyer@test.com",
    items: [{ variantId: "V1", name: "Cap V1", quantity: 1, price: total, image: "/img.png" }],
    currency: "USD",
    subtotal: total,
    shippingFee: 0,
    total,
    webhookEventId: `evt_settle_${orderNumber}`,
  });
}

async function refund(tt: T, orderId: Id<"orders">, orderNumber: string, amount: number, full: boolean, eventId: string) {
  return await tt.mutation(internal.orders.settlement.recordStripeRefundInternal, {
    orderId,
    orderNumber,
    refundedAmount: amount,
    isFullRefund: full,
    webhookEventId: eventId,
  });
}

async function buyLabel(tt: T, orderId: Id<"orders">, trackingNumber: string) {
  return await tt.mutation(internal.orders.fulfillment.attachShippingLabelInternal, {
    orderId,
    carrier: "USPS",
    trackingNumber,
    shippingLabelUrl: `https://labels.example/${trackingNumber}.pdf`,
  });
}

async function scan(tt: T, trackingNumber: string, status: string) {
  return await tt.mutation(internal.orders.fulfillment.handleTrackingWebhookInternal, { trackingNumber, status });
}

async function dispute(tt: T, orderId: Id<"orders">, orderNumber: string, action: "opened" | "closed", eventId: string) {
  await tt.mutation(internal.orders.settlement.recordStripeDisputeInternal, {
    orderId,
    orderNumber,
    disputeId: "dp_1",
    status: action === "opened" ? "needs_response" : "won",
    amount: 100,
    currency: "USD",
    webhookEventId: eventId,
    action,
  });
}

describe("backfillOrderStatusAxes", () => {
  it("maps every legacy status, batching and re-scheduling itself", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 10);
    await seedLegacy(tt, { orderNumber: "L-PENDING", status: "pending" });
    await seedLegacy(tt, { orderNumber: "L-PAID", status: "paid", trackingNumber: "GL-TRK-111111" });
    await seedLegacy(tt, { orderNumber: "L-PAID-LABEL", status: "paid", shippingLabelUrl: "https://l" });
    await seedLegacy(tt, { orderNumber: "L-DISPATCHED", status: "dispatched" });
    await seedLegacy(tt, { orderNumber: "L-DELIVERED", status: "delivered", trackingDeliveredAt: 1_500 });
    await seedLegacy(tt, { orderNumber: "L-REFUNDED-DELIV", status: "refunded", refundedAmount: 100, trackingDeliveredAt: 1_500 });
    await seedLegacy(tt, { orderNumber: "L-PARTIAL-TRK", status: "partially_refunded", refundedAmount: 10, trackingNumber: "9400111" });
    await seedLegacy(tt, { orderNumber: "L-DISPUTED", status: "paid", disputed: true });
    await seedLegacy(tt, { orderNumber: "L-CANCEL-UNPAID", status: "cancelled" });
    await seedLegacy(tt, { orderNumber: "L-HOLD-RELEASED", status: "cancelled", checkoutHoldReleasedAt: 1_800 });
    const zelle = await seedLegacy(tt, { orderNumber: "L-CANCEL-ZELLE", status: "cancelled", paymentMethod: "whatsapp" });
    await auditEvent(tt, zelle, "L-CANCEL-ZELLE", "zelle_settled", 1_100);
    const overwritten = await seedLegacy(tt, { orderNumber: "L-CANCEL-REFUND", status: "refunded", refundedAmount: 100 });
    await auditEvent(tt, overwritten, "L-CANCEL-REFUND", "cancelled", 1_700);
    await seedLegacy(tt, { orderNumber: "L-WHATSAPP", status: "whatsapp_initiated", paymentMethod: "whatsapp" });
    // Already split (e.g. created after the deploy): left alone.
    await tt.run(async (ctx) => {
      await ctx.db.insert("orders", {
        orderNumber: "NEW-1",
        items: [],
        currency: "USD",
        total: 1,
        paymentStatus: "refunded",
        fulfillmentStatus: "returned",
        paymentMethod: "stripe",
        createdAt: 3_000,
      });
    });
    expect(await tt.query(internal.orders.migrations.countOrdersMissingStatusAxes, {})).toEqual({ missing: 13, scanned: 14 });

    const first = await tt.mutation(internal.orders.migrations.backfillOrderStatusAxes, { batchSize: 4 });
    expect(first).toEqual({ scanned: 4, updated: 4, done: false });
    await drain(tt);
    expect(await tt.query(internal.orders.migrations.countOrdersMissingStatusAxes, {})).toEqual({ missing: 0, scanned: 14 });

    const expected: Record<string, ReturnType<typeof lifecycle>> = {
      "L-PENDING": { payment: "awaiting_payment", fulfillment: "unfulfilled", cancelled: false },
      "L-PAID": { payment: "paid", fulfillment: "unfulfilled", cancelled: false },
      "L-PAID-LABEL": { payment: "paid", fulfillment: "label_purchased", cancelled: false },
      "L-DISPATCHED": { payment: "paid", fulfillment: "in_transit", cancelled: false },
      "L-DELIVERED": { payment: "paid", fulfillment: "delivered", cancelled: false },
      "L-REFUNDED-DELIV": { payment: "refunded", fulfillment: "delivered", cancelled: false },
      "L-PARTIAL-TRK": { payment: "partially_refunded", fulfillment: "in_transit", cancelled: false },
      "L-DISPUTED": { payment: "disputed", fulfillment: "unfulfilled", cancelled: false },
      "L-CANCEL-UNPAID": { payment: "awaiting_payment", fulfillment: "unfulfilled", cancelled: true },
      "L-HOLD-RELEASED": { payment: "awaiting_payment", fulfillment: "unfulfilled", cancelled: true },
      "L-CANCEL-ZELLE": { payment: "paid", fulfillment: "unfulfilled", cancelled: true },
      "L-CANCEL-REFUND": { payment: "refunded", fulfillment: "unfulfilled", cancelled: true },
      "L-WHATSAPP": { payment: "awaiting_payment", fulfillment: "unfulfilled", cancelled: true },
      "NEW-1": { payment: "refunded", fulfillment: "returned", cancelled: false },
    };
    for (const [orderNumber, axes] of Object.entries(expected)) {
      expect([orderNumber, lifecycle(await getOrder(tt, orderNumber))]).toEqual([orderNumber, axes]);
    }

    // The cancelled marker keeps when it happened, and the legacy field stays for the narrow PR.
    const cancelled = await getOrder(tt, "L-CANCEL-UNPAID");
    expect(cancelled).toMatchObject({ cancelledAt: 2_000, cancellationReason: "legacy", status: "cancelled" });
    expect((await getOrder(tt, "L-HOLD-RELEASED"))?.cancellationReason).toBe("checkout_expired");
    expect((await getOrder(tt, "L-CANCEL-REFUND"))?.cancelledAt).toBe(1_700);
    // A leftover WhatsApp reservation is retired as ADR 0023 does: its unit comes back.
    expect((await getOrder(tt, "L-WHATSAPP"))?.cancellationReason).toBe("whatsapp_retired");
    expect(await getStock(tt, "V1")).toBe(11);
  });

  it("is safe to run twice", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 10);
    await seedLegacy(tt, { orderNumber: "L-1", status: "dispatched" });
    await seedLegacy(tt, { orderNumber: "L-2", status: "whatsapp_initiated", paymentMethod: "whatsapp" });

    expect(await tt.mutation(internal.orders.migrations.backfillOrderStatusAxes, {})).toEqual({ scanned: 2, updated: 2, done: true });
    const once = await getOrder(tt, "L-1");
    expect(await tt.mutation(internal.orders.migrations.backfillOrderStatusAxes, {})).toEqual({ scanned: 2, updated: 0, done: true });
    expect(await getOrder(tt, "L-1")).toEqual(once);
    expect(await getStock(tt, "V1")).toBe(11);
    await drain(tt);
  });
});

describe("Orders the backfill has not reached yet", () => {
  it("settle, ship and show through the legacy status", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const orderId = await seedLegacy(tt, { orderNumber: "GL-OLD-1", status: "pending" });

    await settle(tt, "GL-OLD-1");
    expect(lifecycle(await getOrder(tt, "GL-OLD-1"))).toEqual({ payment: "paid", fulfillment: "unfulfilled", cancelled: false });
    // A legacy order awaiting payment held no units, so settling deducts them.
    expect(await getStock(tt, "V1")).toBe(4);

    const shipped = await seedLegacy(tt, { orderNumber: "GL-OLD-2", status: "dispatched", trackingNumber: "9400OLD" });
    const detail = await admin(tt).query(api.orders.desk.getOrderDetailAdmin, { orderNumber: "GL-OLD-2" });
    expect(detail).toMatchObject({ paymentStatus: "paid", fulfillmentStatus: "in_transit" });
    await scan(tt, "9400OLD", "DELIVERED");
    expect(lifecycle(await getOrder(tt, "GL-OLD-2"))).toEqual({ payment: "paid", fulfillment: "delivered", cancelled: false });

    const view = await tt.query(api.orders.functions.getOrderByOrderNumberAndEmail, { orderNumber: "GL-OLD-2" });
    expect(view).toMatchObject({ paymentStatus: "paid", fulfillmentStatus: "delivered" });
    expect(view).not.toHaveProperty("status");
    expect(orderId).toBeDefined();
    expect(shipped).toBeDefined();
    await drain(tt);
  });

  it("a refund on a cancelled legacy order keeps the cancelled marker", async () => {
    const tt = t();
    const orderId = await seedLegacy(tt, { orderNumber: "GL-OLD-C", status: "cancelled", stripeInvoiceId: "in_1" });
    await refund(tt, orderId, "GL-OLD-C", 100, true, "evt_r");
    const order = await getOrder(tt, "GL-OLD-C");
    expect(lifecycle(order)).toEqual({ payment: "refunded", fulfillment: "unfulfilled", cancelled: true });
    expect(order?.cancelledAt).toBe(2_000);
    await drain(tt);
  });
});

describe("each axis stays independent", () => {
  it("a delivered order that gets partially refunded stays delivered", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const orderId = await settle(tt, "GL-IND-1");
    await buyLabel(tt, orderId, "9400IND1");
    await scan(tt, "9400IND1", "TRANSIT");
    expect((await getOrder(tt, "GL-IND-1"))?.fulfillmentStatus).toBe("in_transit");
    await scan(tt, "9400IND1", "DELIVERED");

    await refund(tt, orderId, "GL-IND-1", 30, false, "evt_partial");
    expect(lifecycle(await getOrder(tt, "GL-IND-1"))).toEqual({
      payment: "partially_refunded",
      fulfillment: "delivered",
      cancelled: false,
    });

    await refund(tt, orderId, "GL-IND-1", 100, true, "evt_full");
    expect(lifecycle(await getOrder(tt, "GL-IND-1"))).toEqual({ payment: "refunded", fulfillment: "delivered", cancelled: false });
    await drain(tt);
  });

  it("carrier scans on a refunded order move only the package", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const orderId = await settle(tt, "GL-IND-2");
    await buyLabel(tt, orderId, "9400IND2");
    await refund(tt, orderId, "GL-IND-2", 100, true, "evt_full2");
    expect(lifecycle(await getOrder(tt, "GL-IND-2"))).toEqual({ payment: "refunded", fulfillment: "label_purchased", cancelled: false });

    await scan(tt, "9400IND2", "RETURNED");
    expect(lifecycle(await getOrder(tt, "GL-IND-2"))).toEqual({ payment: "refunded", fulfillment: "returned", cancelled: false });
    await drain(tt);
  });

  it("a dispute changes only Payment Status, and closing it restores what the refunds say", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const orderId = await settle(tt, "GL-IND-3");
    await buyLabel(tt, orderId, "9400IND3");
    await refund(tt, orderId, "GL-IND-3", 20, false, "evt_partial3");

    await dispute(tt, orderId, "GL-IND-3", "opened", "evt_dp_open");
    expect(lifecycle(await getOrder(tt, "GL-IND-3"))).toEqual({ payment: "disputed", fulfillment: "label_purchased", cancelled: false });
    await scan(tt, "9400IND3", "DELIVERED");
    expect(lifecycle(await getOrder(tt, "GL-IND-3"))).toEqual({ payment: "disputed", fulfillment: "delivered", cancelled: false });

    await dispute(tt, orderId, "GL-IND-3", "closed", "evt_dp_close");
    expect(lifecycle(await getOrder(tt, "GL-IND-3"))).toEqual({
      payment: "partially_refunded",
      fulfillment: "delivered",
      cancelled: false,
    });
    await drain(tt);
  });

  it("buying a label never moves stock or Payment Status, and needs a paid order", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const orderId = await settle(tt, "GL-IND-4");
    expect(await getStock(tt, "V1")).toBe(4);
    await refund(tt, orderId, "GL-IND-4", 10, false, "evt_partial4");
    await buyLabel(tt, orderId, "9400IND4");
    expect(lifecycle(await getOrder(tt, "GL-IND-4"))).toEqual({
      payment: "partially_refunded",
      fulfillment: "label_purchased",
      cancelled: false,
    });
    expect(await getStock(tt, "V1")).toBe(4);

    const unpaid = await seedLegacy(tt, { orderNumber: "GL-IND-UNPAID", status: "pending" });
    await expect(buyLabel(tt, unpaid, "9400UNPAID")).rejects.toThrow(/only change once the order is paid/);
    await drain(tt);
  });

  it("cancelling sets the marker and leaves both axes as they were", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const orderId = await settle(tt, "GL-IND-5");
    await admin(tt).mutation(internal.orders.desk.cancelOrderAdmin, { orderId, reason: "test" });
    const order = await getOrder(tt, "GL-IND-5");
    expect(lifecycle(order)).toEqual({ payment: "paid", fulfillment: "unfulfilled", cancelled: true });
    expect(order?.cancellationReason).toBe("administrator");
    expect(await getStock(tt, "V1")).toBe(5);

    // The refund that follows records itself without clearing the marker.
    await refund(tt, orderId, "GL-IND-5", 100, true, "evt_cancel_refund");
    expect(lifecycle(await getOrder(tt, "GL-IND-5"))).toEqual({ payment: "refunded", fulfillment: "unfulfilled", cancelled: true });
    await drain(tt);
  });
});

describe("admin desk on the two axes", () => {
  it("lists each tab and counts partially refunded orders in the packing queue", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 20);
    await settle(tt, "GL-DESK-PAID");
    const partial = await settle(tt, "GL-DESK-PARTIAL");
    await refund(tt, partial, "GL-DESK-PARTIAL", 10, false, "evt_desk_partial");
    const shipped = await settle(tt, "GL-DESK-SHIPPED");
    await buyLabel(tt, shipped, "9400DESK");
    await scan(tt, "9400DESK", "DELIVERED");
    await refund(tt, shipped, "GL-DESK-SHIPPED", 100, true, "evt_desk_full");
    const cancelled = await settle(tt, "GL-DESK-CANCELLED");
    await admin(tt).mutation(internal.orders.desk.cancelOrderAdmin, { orderId: cancelled });

    const list = async (status?: string) =>
      (await admin(tt).query(api.orders.desk.getAllOrdersAdmin, { clientTime: Date.now(), status }))
        .map((o) => o.orderNumber)
        .sort();

    expect(await list("needs_attention")).toEqual(["GL-DESK-PAID", "GL-DESK-PARTIAL"]);
    expect(await list("delivered")).toEqual(["GL-DESK-SHIPPED"]);
    expect(await list("refunded")).toEqual(["GL-DESK-SHIPPED"]);
    expect(await list("cancelled")).toEqual(["GL-DESK-CANCELLED"]);
    // The single-status desk's "paid" tab still answers, as the packing queue.
    expect(await list("paid")).toEqual(["GL-DESK-PAID", "GL-DESK-PARTIAL"]);
    expect(await list()).toHaveLength(4);

    const stats = await admin(tt).query(api.orders.desk.getOrdersAttentionStats, { clientTime: Date.now() });
    expect(stats?.unfulfilledPaid).toBe(2);
    await drain(tt);
  });

  it("an Administrator confirming delivery locks out carrier overwrites", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const orderId = await settle(tt, "GL-DESK-MANUAL");
    await buyLabel(tt, orderId, "9400MANUAL");
    await admin(tt).mutation(api.orders.desk.updateFulfillmentStatusAdmin, { orderId, fulfillmentStatus: "delivered" });
    const order = await getOrder(tt, "GL-DESK-MANUAL");
    expect(order).toMatchObject({ fulfillmentStatus: "delivered", paymentStatus: "paid", manualStatusOverride: true });

    await scan(tt, "9400MANUAL", "RETURNED");
    expect((await getOrder(tt, "GL-DESK-MANUAL"))?.fulfillmentStatus).toBe("delivered");
    await drain(tt);
  });
});
