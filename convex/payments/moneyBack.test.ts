/// <reference types="vite/client" />
/**
 * Plan 0008 PR 5, end to end through Convex: label gating and Reship with label history, no
 * placeholder tracking numbers, the refund ledger (line refunds, Returns, Goodwill Refunds,
 * Restock), Customer Cancellation and Administrator cancellation. The Stripe call itself lives
 * in the payments/refunds.ts actions; these tests drive the ledger mutations either side of it.
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

const OWNER = "user_owner";
const admin = (tt: T) => tt.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL, emailVerified: true });
const owner = (tt: T) => tt.withIdentity({ subject: OWNER });
const stranger = (tt: T) => tt.withIdentity({ subject: "user_stranger" });

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
      priceUsd: 50,
      isFeatured: false,
    });
  });
}

async function stockOf(tt: T, variantId: string): Promise<number> {
  return await tt.run(async (ctx) => {
    const v = await ctx.db
      .query("variants")
      .withIndex("by_variantId", (q) => q.eq("variantId", variantId))
      .first();
    return v?.stock ?? -1;
  });
}

async function orderOf(tt: T, orderId: Id<"orders">): Promise<Doc<"orders">> {
  return (await tt.run(async (ctx) => ctx.db.get(orderId)))!;
}

async function ledgerOf(tt: T, orderId: Id<"orders">) {
  return await tt.run(async (ctx) =>
    ctx.db
      .query("order_refunds")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .collect()
  );
}

async function eventTypes(tt: T, orderId: Id<"orders">) {
  const events = await tt.run(async (ctx) =>
    ctx.db
      .query("payment_events")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .collect()
  );
  return events.map((e) => e.type);
}

async function scheduledNames(tt: T): Promise<string[]> {
  return await tt.run(async (ctx) => (await ctx.db.system.query("_scheduled_functions").collect()).map((f) => f.name));
}

/** A paid Order: 2 × Cap V1 at $50 for the signed-in owner, $8 shipping, $9.68 tax = $117.68. */
async function settle(tt: T, orderNumber: string, opts: { owner?: string | null } = {}) {
  return await tt.mutation(internal.orders.settlement.createOrUpdateStripeOrder, {
    stripeSessionId: `cs_test_${orderNumber}`,
    orderNumber,
    customerEmail: "buyer@test.com",
    customerName: "Ana Buyer",
    ...(opts.owner !== null && { clerkUserId: opts.owner ?? OWNER }),
    items: [{ variantId: "V1", name: "Cap V1", quantity: 2, price: 50, image: "/img.png" }],
    currency: "USD",
    subtotal: 100,
    shippingFee: 8,
    tax: 9.68,
    total: 117.68,
    webhookEventId: `evt_settle_${orderNumber}`,
  });
}

async function buyLabel(tt: T, orderId: Id<"orders">, trackingNumber: string, reship?: boolean) {
  return await tt.mutation(internal.orders.fulfillment.attachShippingLabelInternal, {
    orderId,
    carrier: "USPS",
    trackingNumber,
    shippingLabelUrl: `https://labels.example/${trackingNumber}.pdf`,
    shippingTransactionId: `tx_${trackingNumber}`,
    ...(reship !== undefined && { reship }),
  });
}

async function scan(tt: T, trackingNumber: string, status: string) {
  return await tt.mutation(internal.orders.fulfillment.handleTrackingWebhookInternal, {
    trackingNumber,
    carrier: "USPS",
    status,
    statusDetails: `${status} scan`,
  });
}

async function chargeRefunded(tt: T, orderId: Id<"orders">, orderNumber: string, refundedAmount: number, eventId: string) {
  return await tt.mutation(internal.orders.settlement.recordStripeRefundInternal, {
    orderId,
    orderNumber,
    refundedAmount,
    isFullRefund: refundedAmount >= 117.68,
    webhookEventId: eventId,
  });
}

type AdminRequest =
  | { kind: "line"; lines: { lineIndex: number; quantity: number; restock: boolean }[]; includeShipping: boolean }
  | {
      kind: "return";
      lines: { lineIndex: number; quantity: number; restock: boolean }[];
      reason: "unwanted" | "defective" | "wrong_item";
      unwornWithTags: boolean;
    }
  | { kind: "goodwill"; amountCents: number; reason: string };

async function reserve(tt: T, orderId: Id<"orders">, requestId: string, request: AdminRequest) {
  return await tt.mutation(internal.payments.refundLedger.reserveAdminRefund, {
    orderId,
    requestId,
    actor: "user_admin",
    request,
  });
}

describe("label gating", () => {
  it("buying a label never moves stock, and records the label in the history", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 10);
    const orderId = await settle(tt, "GL-LBL-1");
    expect(await stockOf(tt, "V1")).toBe(8);

    await buyLabel(tt, orderId, "9400LBL1");
    const order = await orderOf(tt, orderId);
    expect(await stockOf(tt, "V1")).toBe(8);
    expect(order.fulfillmentStatus).toBe("label_purchased");
    expect(order.labels).toEqual([
      expect.objectContaining({ trackingNumber: "9400LBL1", transactionId: "tx_9400LBL1", reship: false }),
    ]);

    // A second label for the same package is refused: that is what Reship is for.
    await expect(buyLabel(tt, orderId, "9400LBL1B")).rejects.toThrow(/already bought/);
    await drain(tt);
  });

  it("refuses a label for a cancelled Order or while the payment is disputed", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 10);
    const cancelled = await settle(tt, "GL-LBL-CXL");
    await admin(tt).mutation(internal.orders.desk.cancelOrderAdmin, { orderId: cancelled, refundStripe: false });
    await expect(buyLabel(tt, cancelled, "9400CXL")).rejects.toThrow(/cancelled/);

    const disputed = await settle(tt, "GL-LBL-DSP");
    await tt.mutation(internal.orders.settlement.recordStripeDisputeInternal, {
      orderId: disputed,
      orderNumber: "GL-LBL-DSP",
      disputeId: "dp_1",
      status: "needs_response",
      amount: 117.68,
      currency: "USD",
      webhookEventId: "evt_dispute_open",
      action: "opened",
    });
    await expect(buyLabel(tt, disputed, "9400DSP")).rejects.toThrow(/disputed/);

    // Once the dispute closes the Order can ship again.
    await tt.mutation(internal.orders.settlement.recordStripeDisputeInternal, {
      orderId: disputed,
      orderNumber: "GL-LBL-DSP",
      disputeId: "dp_1",
      status: "won",
      amount: 117.68,
      currency: "USD",
      webhookEventId: "evt_dispute_close",
      action: "closed",
    });
    await buyLabel(tt, disputed, "9400DSP");
    expect((await orderOf(tt, disputed)).fulfillmentStatus).toBe("label_purchased");
    await drain(tt);
  });

  it("a FAILURE scan emails both sides, then a Reship buys a new label and keeps the old one", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 10);
    const orderId = await settle(tt, "GL-RESHIP");
    await buyLabel(tt, orderId, "9400FIRST");

    const res = await scan(tt, "9400FIRST", "FAILURE");
    expect(res.found && res.fulfillmentStatus).toBe("delivery_exception");
    expect(await scheduledNames(tt)).toEqual(expect.arrayContaining([expect.stringContaining("sendDeliveryExceptionEmails")]));

    await expect(buyLabel(tt, orderId, "9400SECOND")).rejects.toThrow(/use Reship/);
    await buyLabel(tt, orderId, "9400SECOND", true);

    const order = await orderOf(tt, orderId);
    expect(order.fulfillmentStatus).toBe("label_purchased");
    expect(order.trackingNumber).toBe("9400SECOND");
    expect(order.trackingStatus).toBeUndefined();
    expect(order.labels?.map((l) => [l.trackingNumber, l.reship])).toEqual([
      ["9400FIRST", false],
      ["9400SECOND", true],
    ]);
    expect(await eventTypes(tt, orderId)).toContain("shipping_label_reshipped");
    expect(await stockOf(tt, "V1")).toBe(8);

    // Scans now follow the new package.
    await scan(tt, "9400SECOND", "DELIVERED");
    expect((await orderOf(tt, orderId)).fulfillmentStatus).toBe("delivered");
    await drain(tt);
  });

  it("a RETURNED scan moves the Order to returned and emails both sides", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 10);
    const orderId = await settle(tt, "GL-RTS");
    await buyLabel(tt, orderId, "9400RTS");
    await scan(tt, "9400RTS", "RETURNED");
    expect((await orderOf(tt, orderId)).fulfillmentStatus).toBe("returned");
    expect((await scheduledNames(tt)).filter((n) => n.includes("sendDeliveryExceptionEmails"))).toHaveLength(1);
    await drain(tt);
  });
});

describe("no placeholder tracking numbers", () => {
  it("settlement leaves the Tracking Number empty until a carrier label exists", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 10);
    const orderId = await settle(tt, "GL-NOTRK");
    expect((await orderOf(tt, orderId)).trackingNumber).toBeUndefined();

    await admin(tt).mutation(api.orders.desk.updateFulfillmentStatusAdmin, { orderId, fulfillmentStatus: "in_transit" });
    expect((await orderOf(tt, orderId)).trackingNumber).toBeUndefined();
    await drain(tt);
  });

  it("a legacy GL-TRK placeholder is never shown to the Customer as carrier tracking", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 10);
    const orderId = await settle(tt, "GL-LEGACYTRK");
    await tt.run(async (ctx) => ctx.db.patch(orderId, { trackingNumber: "GL-TRK-123456" }));
    const view = await owner(tt).query(api.orders.functions.getOrderByOrderNumberAndEmail, {
      orderNumber: "GL-LEGACYTRK",
      email: "buyer@test.com",
    });
    expect(view?.trackingNumber).toBeUndefined();
  });
});

describe("line refunds and Restock", () => {
  it("restocks only the chosen line, only once Stripe accepted, and never touches Payment Status", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 10);
    const orderId = await settle(tt, "GL-REF-1");
    await buyLabel(tt, orderId, "9400REF1");
    await scan(tt, "9400REF1", "DELIVERED");

    const reservation = await reserve(tt, orderId, "req-1", {
      kind: "line",
      lines: [{ lineIndex: 0, quantity: 1, restock: true }],
      includeShipping: false,
    });
    // $50 plus its share of $9.68 tax over $108 of lines and shipping.
    expect(reservation).toMatchObject({ status: "pending", amountCents: 5448, stripeSessionId: "cs_test_GL-REF-1" });
    expect(await stockOf(tt, "V1")).toBe(8);

    const committed = await tt.mutation(internal.payments.refundLedger.commitRefund, {
      refundId: reservation.refundId,
      stripeRefundId: "re_1",
    });
    expect(committed).toEqual({ committed: true, restockedUnits: 1 });
    expect(await stockOf(tt, "V1")).toBe(9);

    // A replayed commit restocks nothing more.
    expect(await tt.mutation(internal.payments.refundLedger.commitRefund, { refundId: reservation.refundId, stripeRefundId: "re_1" })).toEqual({
      committed: false,
      restockedUnits: 0,
    });
    expect(await stockOf(tt, "V1")).toBe(9);

    let order = await orderOf(tt, orderId);
    expect(order.paymentStatus).toBe("paid");
    expect(order.refundedAmount).toBeUndefined();

    // Stripe's charge.refunded webhook records the money, once.
    await chargeRefunded(tt, orderId, "GL-REF-1", 54.48, "evt_ref_1");
    await chargeRefunded(tt, orderId, "GL-REF-1", 54.48, "evt_ref_1");
    order = await orderOf(tt, orderId);
    expect(order.paymentStatus).toBe("partially_refunded");
    expect(order.refundedAmount).toBe(54.48);
    expect(order.fulfillmentStatus).toBe("delivered");
    expect(await eventTypes(tt, orderId)).toEqual(expect.arrayContaining(["refund_requested", "refund_issued"]));
    await drain(tt);
  });

  it("never refunds a line beyond its quantity, even while a refund is in flight; a failure frees it", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 10);
    const orderId = await settle(tt, "GL-REF-2");
    const all = { kind: "line" as const, lines: [{ lineIndex: 0, quantity: 2, restock: true }], includeShipping: false };

    const first = await reserve(tt, orderId, "req-a", all);
    await expect(reserve(tt, orderId, "req-b", all)).rejects.toThrow(/Only 0 of Cap V1 left/);

    // The same request again resolves to the same row (a double click refunds once).
    const again = await reserve(tt, orderId, "req-a", all);
    expect(again.refundId).toBe(first.refundId);
    expect(again.idempotencyKey).toBe(first.idempotencyKey);
    expect(await ledgerOf(tt, orderId)).toHaveLength(1);

    await tt.mutation(internal.payments.refundLedger.failRefund, { refundId: first.refundId, error: "card_declined" });
    expect(await stockOf(tt, "V1")).toBe(8);
    await expect(reserve(tt, orderId, "req-a", all)).rejects.toThrow(/already failed/);
    const retry = await reserve(tt, orderId, "req-c", all);
    expect(retry.status).toBe("pending");
    await drain(tt);
  });

  it("a Goodwill Refund never restocks", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 10);
    const orderId = await settle(tt, "GL-GW");
    const reservation = await reserve(tt, orderId, "req-gw", { kind: "goodwill", amountCents: 1000, reason: "Late delivery" });
    expect(await tt.mutation(internal.payments.refundLedger.commitRefund, { refundId: reservation.refundId, stripeRefundId: "re_gw" })).toEqual({
      committed: true,
      restockedUnits: 0,
    });
    expect(await stockOf(tt, "V1")).toBe(8);
    const [row] = await ledgerOf(tt, orderId);
    expect(row).toMatchObject({ kind: "goodwill", status: "issued", reason: "Late delivery", lines: [] });
    await drain(tt);
  });

  it("refunds are refused while the payment is disputed", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 10);
    const orderId = await settle(tt, "GL-REF-DSP");
    await tt.mutation(internal.orders.settlement.recordStripeDisputeInternal, {
      orderId,
      orderNumber: "GL-REF-DSP",
      disputeId: "dp_2",
      status: "needs_response",
      amount: 117.68,
      currency: "USD",
      webhookEventId: "evt_dsp_2",
      action: "opened",
    });
    await expect(reserve(tt, orderId, "req-dsp", { kind: "goodwill", amountCents: 100, reason: "x" })).rejects.toThrow(/disputed/);
    await drain(tt);
  });

  it("a Return inside the window refunds the lines, not shipping, and restocks what the Administrator chose", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 10);
    const orderId = await settle(tt, "GL-RET");
    await buyLabel(tt, orderId, "9400RET");
    await scan(tt, "9400RET", "DELIVERED");

    const reservation = await reserve(tt, orderId, "req-ret", {
      kind: "return",
      lines: [{ lineIndex: 0, quantity: 2, restock: true }],
      reason: "unwanted",
      unwornWithTags: true,
    });
    expect(reservation.amountCents).toBe(2 * 5448);
    await tt.mutation(internal.payments.refundLedger.commitRefund, { refundId: reservation.refundId, stripeRefundId: "re_ret" });
    expect(await stockOf(tt, "V1")).toBe(10);
    const [row] = await ledgerOf(tt, orderId);
    expect(row).toMatchObject({ kind: "return", returnReason: "unwanted", shippingCents: 0 });

    // A defective item is never restocked.
    const other = await settle(tt, "GL-RET-DEF");
    await buyLabel(tt, other, "9400DEF");
    await scan(tt, "9400DEF", "DELIVERED");
    await expect(
      reserve(tt, other, "req-def", {
        kind: "return",
        lines: [{ lineIndex: 0, quantity: 1, restock: true }],
        reason: "defective",
        unwornWithTags: false,
      })
    ).rejects.toThrow(/never restocked/);
    await drain(tt);
  });

  it("an Order cancelled while a refund was in flight is not restocked twice", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 10);
    const orderId = await settle(tt, "GL-RACE");
    const reservation = await reserve(tt, orderId, "req-race", {
      kind: "line",
      lines: [{ lineIndex: 0, quantity: 1, restock: true }],
      includeShipping: false,
    });
    await admin(tt).mutation(internal.orders.desk.cancelOrderAdmin, { orderId, refundStripe: false });
    expect(await stockOf(tt, "V1")).toBe(10);
    expect(await tt.mutation(internal.payments.refundLedger.commitRefund, { refundId: reservation.refundId, stripeRefundId: "re_race" })).toEqual({
      committed: true,
      restockedUnits: 0,
    });
    expect(await stockOf(tt, "V1")).toBe(10);
    await drain(tt);
  });

  it("a refund Stripe fails after issuing it: row failed, line freed, Restock kept, Administrator told, replay-safe", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 10);
    const orderId = await settle(tt, "GL-REF-FAIL");
    const reservation = await reserve(tt, orderId, "req-fail", {
      kind: "line",
      lines: [{ lineIndex: 0, quantity: 2, restock: true }],
      includeShipping: false,
    });
    await tt.mutation(internal.payments.refundLedger.commitRefund, { refundId: reservation.refundId, stripeRefundId: "re_fail" });
    expect(await stockOf(tt, "V1")).toBe(10);

    const failed = {
      stripeRefundId: "re_fail",
      stripeStatus: "failed" as const,
      failureReason: "expired_or_canceled_card",
      webhookEventId: "evt_refund_failed",
    };
    expect(await tt.mutation(internal.payments.refundLedger.failIssuedRefundFromStripe, failed)).toEqual({
      failed: true,
      restockedUnits: 2,
    });

    const [row] = await ledgerOf(tt, orderId);
    expect(row).toMatchObject({ status: "failed", stripeRefundId: "re_fail" });
    expect(row.error).toContain("expired_or_canceled_card");
    // Stock is not reversed automatically: the note asks the Administrator to check it.
    expect(await stockOf(tt, "V1")).toBe(10);
    const order = await orderOf(tt, orderId);
    expect(order.adminNotes).toContain("⚠️ REFUND FAILED");
    expect(order.adminNotes).toContain("check stock");
    expect(order.paymentStatus).toBe("paid");
    expect((await eventTypes(tt, orderId)).filter((type) => type === "refund_failed")).toHaveLength(1);

    // A replayed event, or Stripe's refund.updated for the same failure, changes nothing.
    expect(await tt.mutation(internal.payments.refundLedger.failIssuedRefundFromStripe, failed)).toEqual({
      failed: false,
      reason: "replayed",
      restockedUnits: 0,
    });
    expect(
      await tt.mutation(internal.payments.refundLedger.failIssuedRefundFromStripe, { ...failed, webhookEventId: "evt_refund_updated" })
    ).toEqual({ failed: false, reason: "already_failed", restockedUnits: 0 });
    expect((await eventTypes(tt, orderId)).filter((type) => type === "refund_failed")).toHaveLength(1);
    expect((await orderOf(tt, orderId)).adminNotes?.match(/REFUND FAILED/g)).toHaveLength(1);

    // The failed refund no longer holds the line: it can be refunded again.
    const again = await reserve(tt, orderId, "req-fail-again", {
      kind: "line",
      lines: [{ lineIndex: 0, quantity: 2, restock: false }],
      includeShipping: false,
    });
    expect(again.status).toBe("pending");
    await drain(tt);
  });

  it("finds a still-pending refund by the ledger id in its Stripe metadata; ignores refunds not in the ledger", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 10);
    const orderId = await settle(tt, "GL-REF-FAIL-2");
    const reservation = await reserve(tt, orderId, "req-pending", { kind: "goodwill", amountCents: 500, reason: "late" });

    expect(
      await tt.mutation(internal.payments.refundLedger.failIssuedRefundFromStripe, {
        stripeRefundId: "re_unknown",
        stripeStatus: "canceled",
        webhookEventId: "evt_unknown",
      })
    ).toEqual({ failed: false, reason: "unknown_refund", restockedUnits: 0 });

    expect(
      await tt.mutation(internal.payments.refundLedger.failIssuedRefundFromStripe, {
        stripeRefundId: "re_pending",
        ledgerRefundId: reservation.refundId,
        stripeStatus: "canceled",
        webhookEventId: "evt_canceled",
      })
    ).toEqual({ failed: true, restockedUnits: 0 });
    const [row] = await ledgerOf(tt, orderId);
    expect(row).toMatchObject({ status: "failed", stripeRefundId: "re_pending" });
    expect((await orderOf(tt, orderId)).adminNotes).not.toContain("check stock");

    // The issue arriving after the failure restocks nothing and leaves the row failed.
    expect(await tt.mutation(internal.payments.refundLedger.commitRefund, { refundId: reservation.refundId, stripeRefundId: "re_pending" })).toEqual({
      committed: false,
      restockedUnits: 0,
    });
    await drain(tt);
  });

  it("the refunds list is for Administrators only", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 10);
    const orderId = await settle(tt, "GL-LIST");
    await reserve(tt, orderId, "req-list", { kind: "goodwill", amountCents: 100, reason: "x" });
    expect(await admin(tt).query(api.payments.refundLedger.listOrderRefunds, { orderId })).toHaveLength(1);
    await expect(owner(tt).query(api.payments.refundLedger.listOrderRefunds, { orderId })).rejects.toThrow(/Forbidden/);
    await drain(tt);
  });
});

describe("Customer Cancellation", () => {
  it("the signed-in owner cancels a paid, unfulfilled Order: stock back, full refund reserved", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 10);
    const orderId = await settle(tt, "GL-CC-1");
    expect(await stockOf(tt, "V1")).toBe(8);

    const result = await owner(tt).mutation(internal.orders.functions.cancelOrder, { orderId });
    expect(result.refund).toMatchObject({ status: "pending", amountCents: 11768 });
    expect(await stockOf(tt, "V1")).toBe(10);

    const order = await orderOf(tt, orderId);
    expect(order.cancellationReason).toBe("customer");
    const [row] = await ledgerOf(tt, orderId);
    expect(row).toMatchObject({ kind: "cancellation", requestId: `cancel-${orderId}`, amountCents: 11768 });
    expect(row.lines.every((l) => !l.restock)).toBe(true);

    // Committing the refund never restocks again.
    await tt.mutation(internal.payments.refundLedger.commitRefund, { refundId: row._id, stripeRefundId: "re_cc" });
    expect(await stockOf(tt, "V1")).toBe(10);

    // And no label can be bought for it.
    await expect(buyLabel(tt, orderId, "9400CC")).rejects.toThrow(/cancelled/);
    await drain(tt);
  });

  it("is refused for another account, a guest Order, a shipped Order, or without sign-in", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 10);
    const mine = await settle(tt, "GL-CC-MINE");
    await expect(stranger(tt).mutation(internal.orders.functions.cancelOrder, { orderId: mine })).rejects.toThrow(/Forbidden/);
    await expect(tt.mutation(internal.orders.functions.cancelOrder, { orderId: mine })).rejects.toThrow(/Authentication required/);

    const guest = await settle(tt, "GL-CC-GUEST", { owner: null });
    await expect(owner(tt).mutation(internal.orders.functions.cancelOrder, { orderId: guest })).rejects.toThrow(/through support/);

    const shipped = await settle(tt, "GL-CC-SHIPPED");
    await buyLabel(tt, shipped, "9400SHIPPED");
    await expect(owner(tt).mutation(internal.orders.functions.cancelOrder, { orderId: shipped })).rejects.toThrow(/dispatched/);

    expect(await stockOf(tt, "V1")).toBe(4);
    for (const orderId of [mine, guest, shipped]) expect((await orderOf(tt, orderId)).cancelledAt).toBeUndefined();
    await drain(tt);
  });
});

describe("Administrator cancellation", () => {
  it("a shipped Order's units stay out; the rest of the payment is reserved for refund", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 10);
    const orderId = await settle(tt, "GL-AC-1");
    await buyLabel(tt, orderId, "9400AC1");
    const result = await admin(tt).mutation(internal.orders.desk.cancelOrderAdmin, { orderId, refundStripe: true });
    expect(result.stockReleased).toBe(false);
    expect(result.refund).toMatchObject({ status: "pending", amountCents: 11768 });
    expect(await stockOf(tt, "V1")).toBe(8);
    await drain(tt);
  });

  it("units a refund already restocked are not given back again by the cancellation", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 10);
    const orderId = await settle(tt, "GL-AC-RESTOCKED");
    const reservation = await reserve(tt, orderId, "req-restocked", {
      kind: "line",
      lines: [{ lineIndex: 0, quantity: 1, restock: true }],
      includeShipping: false,
    });
    await tt.mutation(internal.payments.refundLedger.commitRefund, { refundId: reservation.refundId, stripeRefundId: "re_rs" });
    expect(await stockOf(tt, "V1")).toBe(9);

    const result = await admin(tt).mutation(internal.orders.desk.cancelOrderAdmin, { orderId, refundStripe: true });
    expect(await stockOf(tt, "V1")).toBe(10);
    // Only what is left of the payment is refunded.
    expect(result.refund?.amountCents).toBe(11768 - 5448);
    await drain(tt);
  });

  it("an Order awaiting payment is cancelled without a refund, and says why", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 10);
    const orderId = await tt.run(async (ctx) =>
      ctx.db.insert("orders", {
        orderNumber: "GL-AC-UNPAID",
        items: [{ variantId: "V1", name: "Cap V1", quantity: 1, price: 50, image: "/img.png" }],
        currency: "USD",
        total: 50,
        paymentStatus: "awaiting_payment",
        fulfillmentStatus: "unfulfilled",
        paymentMethod: "stripe",
        createdAt: Date.now(),
      })
    );
    const result = await admin(tt).mutation(internal.orders.desk.cancelOrderAdmin, { orderId, refundStripe: true });
    expect(result.refund).toBeNull();
    expect(result.refundSkipped).toMatch(/not paid/);
    expect(await ledgerOf(tt, orderId)).toHaveLength(0);
    await drain(tt);
  });
});
