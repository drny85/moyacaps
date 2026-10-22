/// <reference types="vite/client" />
/**
 * ADR 0024 split status, end to end: each axis staying independent through real settlement /
 * refund / dispute / label / carrier writes, and the admin desk filters.
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

type SeededOrder = Partial<Doc<"orders">> & Pick<Doc<"orders">, "orderNumber" | "paymentStatus" | "fulfillmentStatus">;

/** Insert an Order directly, bypassing checkout. */
async function seedOrder(tt: T, fields: SeededOrder): Promise<Id<"orders">> {
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

    const unpaid = await seedOrder(tt, { orderNumber: "GL-IND-UNPAID", paymentStatus: "awaiting_payment", fulfillmentStatus: "unfulfilled" });
    await expect(buyLabel(tt, unpaid, "9400UNPAID")).rejects.toThrow(/only change once the order is paid/);
    await drain(tt);
  });

  it("cancelling sets the marker and leaves both axes as they were", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const orderId = await settle(tt, "GL-IND-5");
    await admin(tt).mutation(internal.orders.desk.cancelOrderAdmin, { orderId, refundStripe: false, reason: "test" });
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
    await admin(tt).mutation(internal.orders.desk.cancelOrderAdmin, { orderId: cancelled, refundStripe: false });

    const list = async (status?: string) =>
      (await admin(tt).query(api.orders.desk.getAllOrdersAdmin, { clientTime: Date.now(), status }))
        .map((o) => o.orderNumber)
        .sort();

    expect(await list("needs_packing")).toEqual(["GL-DESK-PAID", "GL-DESK-PARTIAL"]);
    // The previous id still answers.
    expect(await list("needs_attention")).toEqual(["GL-DESK-PAID", "GL-DESK-PARTIAL"]);
    expect(await list("shipped")).toEqual([]);
    expect(await list("problems")).toEqual([]);
    // Delivered and refunded: counted once; the cancelled order is excluded.
    expect(await list("done")).toEqual(["GL-DESK-SHIPPED"]);
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

  it("All skips Expired Checkouts, so they never crowd out real Orders", async () => {
    const tt = t();
    await seedOrder(tt, { orderNumber: "GL-ALL-PAID", paymentStatus: "paid", fulfillmentStatus: "unfulfilled", createdAt: 1_000 });
    for (const [n, createdAt] of [["GL-ALL-EXP-1", 2_000], ["GL-ALL-EXP-2", 3_000]] as const) {
      await seedOrder(tt, {
        orderNumber: n,
        paymentStatus: "awaiting_payment",
        fulfillmentStatus: "unfulfilled",
        cancelledAt: createdAt,
        cancellationReason: "checkout_expired",
        createdAt,
      });
    }
    const list = async (status?: string) =>
      (await admin(tt).query(api.orders.desk.getAllOrdersAdmin, { clientTime: Date.now(), status, limit: 1 })).map((o) => o.orderNumber);

    expect(await list()).toEqual(["GL-ALL-PAID"]);
    expect(await list("cancelled")).toEqual(["GL-ALL-EXP-2"]);
  });

  it("a capped Done read keeps the newest refunded orders whatever their package status", async () => {
    const tt = t();
    for (const [n, fulfillmentStatus, createdAt] of [
      ["GL-CAP-OLD", "unfulfilled", 1_000],
      ["GL-CAP-MID", "returned", 2_000],
      ["GL-CAP-NEW", "in_transit", 3_000],
    ] as const) {
      await seedOrder(tt, { orderNumber: n, paymentStatus: "refunded", fulfillmentStatus, createdAt });
    }
    const list = await admin(tt).query(api.orders.desk.getAllOrdersAdmin, { clientTime: Date.now(), status: "done", limit: 2 });
    expect(list.map((o) => o.orderNumber)).toEqual(["GL-CAP-NEW", "GL-CAP-MID"]);
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
