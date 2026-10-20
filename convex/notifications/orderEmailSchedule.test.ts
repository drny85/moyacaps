/// <reference types="vite/client" />
/**
 * Which order emails each flow schedules, end to end through Convex (order-email audit,
 * 2026-10-20). Scheduled sends are read from `_scheduled_functions`; the Resend component is
 * not mounted in convex-test, so draining them renders each template but sends nothing.
 */
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";
import { encodeItemsMetadata } from "../payments/checkoutMetadata";

const modules = import.meta.glob("/convex/**/*.ts");
const t = () => convexTest(schema, modules);
type T = ReturnType<typeof t>;

const OWNER = "user_owner";
const admin = (tt: T) => tt.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL });
const owner = (tt: T) => tt.withIdentity({ subject: OWNER });

// No webhook secret outside production: the action parses the payload as the event.
const savedEnv = { key: process.env.STRIPE_SECRET_KEY, secret: process.env.STRIPE_WEBHOOK_SECRET };
beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_order_emails";
  delete process.env.STRIPE_WEBHOOK_SECRET;
});
afterEach(() => {
  process.env.STRIPE_SECRET_KEY = savedEnv.key;
  if (savedEnv.secret !== undefined) process.env.STRIPE_WEBHOOK_SECRET = savedEnv.secret;
});

type Scheduled = { name: string; args: any; state: string };

async function scheduled(tt: T): Promise<Scheduled[]> {
  return await tt.run(async (ctx) =>
    (await ctx.db.system.query("_scheduled_functions").collect()).map((f) => ({
      name: f.name,
      args: f.args[0],
      state: f.state.kind,
    }))
  );
}

/** Scheduled sends of one email action, e.g. "sendCustomerReceipt". */
async function sends(tt: T, action: string): Promise<Scheduled[]> {
  return (await scheduled(tt)).filter((f) => f.name.endsWith(`:${action}`));
}

async function drain(tt: T) {
  await tt.finishAllScheduledFunctions(() => {});
}

async function seedVariant(tt: T, stock = 10) {
  await tt.run(async (ctx) => {
    await ctx.db.insert("variants", {
      variantId: "V1",
      isAvailable: true,
      nameEn: "Cap V1",
      nameEs: "Gorra V1",
      category: "headwear",
      taxCode: "txcd_30060006",
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

/** Pay: an Order awaiting payment with its Checkout Hold and session, as checkout creates it. */
async function holdOrder(tt: T, orderNumber: string, sessionId: string) {
  const orderId = await tt.mutation(internal.orders.checkoutHold.placeCheckoutHold, {
    orderNumber,
    items: [{ variantId: "V1", name: "Cap V1", quantity: 1, price: 100, image: "/img.png" }],
    currency: "USD",
    subtotal: 100,
    shippingFee: 0,
    total: 100,
    clerkUserId: OWNER,
    customerEmail: "buyer@test.com",
    checkoutHoldExpiresAt: Date.now() + 31 * 60 * 1000,
    locale: "en",
  });
  await tt.mutation(internal.orders.checkoutHold.attachCheckoutSession, { orderId, stripeSessionId: sessionId });
  return orderId;
}

function sessionEvent(type: string, eventId: string, sessionId: string, orderNumber: string, state = "NY") {
  return JSON.stringify({
    id: eventId,
    type,
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        payment_status: type === "checkout.session.async_payment_failed" ? "unpaid" : "paid",
        currency: "usd",
        amount_total: 10850,
        client_reference_id: orderNumber,
        customer: "cus_test",
        customer_details: { email: "buyer@test.com", name: "Test Buyer", phone: null, address: { state, country: "US" } },
        shipping_details: {
          name: "Test Buyer",
          address: { line1: "1 Main St", line2: null, city: "Town", state, postal_code: "10001", country: "US" },
        },
        total_details: { amount_tax: 850, breakdown: { taxes: [] } },
        invoice: { id: "in_test", invoice_pdf: null, hosted_invoice_url: null },
        metadata: {
          orderNumber,
          subtotal: "100",
          shippingFee: "0",
          ...encodeItemsMetadata([{ variantId: "V1", quantity: 1, price: 100 }]),
        },
      },
    },
  });
}

const completed = (eventId: string, sessionId: string, orderNumber: string, state?: string) =>
  sessionEvent("checkout.session.completed", eventId, sessionId, orderNumber, state);

async function deliver(tt: T, payload: string) {
  return await tt.action(internal.payments.webhook.fulfillStripeWebhook, { payload, signature: "" });
}

/** The success-page repair path: settles from the retrieved session, with no event id. */
async function successPageSync(tt: T, orderNumber: string, sessionId: string, customerEmail?: string) {
  return await tt.mutation(internal.orders.settlement.createOrUpdateStripeOrder, {
    stripeSessionId: sessionId,
    orderNumber,
    ...(customerEmail && { customerEmail }),
    items: [{ variantId: "V1", name: "Cap V1", quantity: 1, price: 100, image: "/img.png" }],
    currency: "USD",
    subtotal: 100,
    shippingFee: 0,
    tax: 8.5,
    total: 108.5,
  });
}

async function paidOrder(tt: T, orderNumber: string) {
  const orderId = await holdOrder(tt, orderNumber, `cs_${orderNumber}`);
  await deliver(tt, completed(`evt_${orderNumber}`, `cs_${orderNumber}`, orderNumber));
  return orderId;
}

describe("receipt and admin alert: exactly one each", () => {
  it("a replayed webhook, and a second event for the same session, send one receipt and one alert", async () => {
    const tt = t();
    await seedVariant(tt);
    await holdOrder(tt, "GL-RX-1", "cs_rx1");

    await deliver(tt, completed("evt_rx1", "cs_rx1", "GL-RX-1"));
    await deliver(tt, completed("evt_rx1", "cs_rx1", "GL-RX-1"));
    await deliver(tt, sessionEvent("checkout.session.async_payment_succeeded", "evt_rx1b", "cs_rx1", "GL-RX-1"));

    expect(await sends(tt, "sendCustomerReceipt")).toHaveLength(1);
    expect(await sends(tt, "sendAdminOrderAlert")).toHaveLength(1);
    await drain(tt);
  });

  it("the success page settling first, then the webhook, sends one receipt to the email Pay recorded", async () => {
    const tt = t();
    await seedVariant(tt);
    await holdOrder(tt, "GL-RACE-1", "cs_race1");

    // The retrieved session carried no email: the receipt still goes to the Order's own.
    await successPageSync(tt, "GL-RACE-1", "cs_race1");
    await deliver(tt, completed("evt_race1", "cs_race1", "GL-RACE-1"));

    const receipts = await sends(tt, "sendCustomerReceipt");
    expect(receipts).toHaveLength(1);
    expect(receipts[0].args).toMatchObject({ customerEmail: "buyer@test.com", outOfTerritory: false });
    expect(await sends(tt, "sendAdminOrderAlert")).toHaveLength(1);
    await drain(tt);
  });

  it("the webhook settling first, then the success page, also sends one of each", async () => {
    const tt = t();
    await seedVariant(tt);
    await holdOrder(tt, "GL-RACE-2", "cs_race2");

    await deliver(tt, completed("evt_race2", "cs_race2", "GL-RACE-2"));
    await successPageSync(tt, "GL-RACE-2", "cs_race2", "buyer@test.com");

    expect(await sends(tt, "sendCustomerReceipt")).toHaveLength(1);
    expect(await sends(tt, "sendAdminOrderAlert")).toHaveLength(1);
    await drain(tt);
  });

  it("an out-of-territory order's receipt says it will be refunded", async () => {
    const tt = t();
    await seedVariant(tt);
    await holdOrder(tt, "GL-PR-9", "cs_pr9");
    await deliver(tt, completed("evt_pr9", "cs_pr9", "GL-PR-9", "PR"));

    const receipts = await sends(tt, "sendCustomerReceipt");
    expect(receipts).toHaveLength(1);
    expect(receipts[0].args.outOfTerritory).toBe(true);
    await drain(tt);
  });
});

describe("money taken that settlement refused", () => {
  it("a second session paying a paid order alerts the Administrator once", async () => {
    const tt = t();
    await seedVariant(tt);
    await paidOrder(tt, "GL-DBL-1");

    await successPageSync(tt, "GL-DBL-1", "cs_other", "buyer@test.com");
    await successPageSync(tt, "GL-DBL-1", "cs_other", "buyer@test.com");

    const alerts = (await sends(tt, "sendAdminAlert")).map((f) => f.args.alert);
    expect(alerts.map((a) => a.idempotencyKey)).toEqual(["money-double_settlement-cs_other", "money-double_settlement-cs_other"]);
    expect(alerts[0]).toMatchObject({ orderNumber: "GL-DBL-1", badge: "DOUBLE PAYMENT" });
    expect(await sends(tt, "sendCustomerReceipt")).toHaveLength(1);
    await drain(tt);
  });

  it("a payment on a cancelled order alerts the Administrator", async () => {
    const tt = t();
    await seedVariant(tt);
    const orderId = await holdOrder(tt, "GL-CXP-1", "cs_cxp1");
    await admin(tt).mutation(internal.orders.desk.cancelOrderAdmin, { orderId, refundStripe: false });

    await deliver(tt, completed("evt_cxp1", "cs_cxp1", "GL-CXP-1"));

    const alerts = (await sends(tt, "sendAdminAlert")).map((f) => f.args.alert);
    expect(alerts).toEqual([expect.objectContaining({ idempotencyKey: "money-cancelled-cs_cxp1", orderNumber: "GL-CXP-1" })]);
    expect(await sends(tt, "sendCustomerReceipt")).toHaveLength(0);
    await drain(tt);
  });
});

describe("Checkout Hold on a failed delayed payment", () => {
  it("checkout.session.async_payment_failed releases the hold and its units", async () => {
    const tt = t();
    await seedVariant(tt, 5);
    const orderId = await holdOrder(tt, "GL-ASYNC-1", "cs_async1");

    await deliver(tt, sessionEvent("checkout.session.async_payment_failed", "evt_async1", "cs_async1", "GL-ASYNC-1"));

    const { order, stock } = await tt.run(async (ctx) => ({
      order: await ctx.db.get(orderId),
      stock: (await ctx.db.query("variants").first())?.stock,
    }));
    expect(order?.cancelledAt).toBeDefined();
    expect(order?.paymentStatus).toBe("awaiting_payment");
    expect(stock).toBe(5);
    await drain(tt);
  });
});

describe("dispatched and delivered emails", () => {
  it("a label sends the ready-to-ship email; tee lines pass the email validator", async () => {
    const tt = t();
    await seedVariant(tt);
    const orderId = await paidOrder(tt, "GL-SHIP-1");
    // A tee line carries colorway and size (ADR 0015).
    await tt.run(async (ctx) => {
      const order = await ctx.db.get(orderId);
      await ctx.db.patch(orderId, {
        items: [...order!.items, { variantId: "T1", name: "Tee T1", quantity: 1, price: 40, image: "/t.png", colorway: "black", size: "M" }],
      });
    });

    await tt.mutation(internal.orders.fulfillment.attachShippingLabelInternal, {
      orderId,
      carrier: "USPS",
      trackingNumber: "9400111899223344556677",
      shippingLabelUrl: "https://labels.example/1.pdf",
    });

    const dispatched = await sends(tt, "sendOrderDispatchedEmail");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].args).toMatchObject({ carrier: "USPS", trackingNumber: "9400111899223344556677" });
    expect(dispatched[0].args.stage).toBeUndefined();
    await drain(tt);
    expect((await sends(tt, "sendOrderDispatchedEmail"))[0].state).toBe("success");
  });

  it("a carrier DELIVERED scan sends the delivered email", async () => {
    const tt = t();
    await seedVariant(tt);
    const orderId = await paidOrder(tt, "GL-SHIP-2");
    await tt.mutation(internal.orders.fulfillment.attachShippingLabelInternal, {
      orderId,
      carrier: "USPS",
      trackingNumber: "9400111899223344550002",
      shippingLabelUrl: "https://labels.example/2.pdf",
    });
    await tt.mutation(internal.orders.fulfillment.handleTrackingWebhookInternal, {
      trackingNumber: "9400111899223344550002",
      carrier: "USPS",
      status: "DELIVERED",
    });

    const delivered = await sends(tt, "sendOrderDeliveredEmail");
    expect(delivered).toHaveLength(1);
    expect(delivered[0].args).toMatchObject({ customerEmail: "buyer@test.com", trackingNumber: "9400111899223344550002" });
    await drain(tt);
  });

  it("manual desk moves into in transit and delivered send the same emails; a revert sends none", async () => {
    const tt = t();
    await seedVariant(tt);
    const orderId = await paidOrder(tt, "GL-DESK-1");

    await admin(tt).mutation(api.orders.desk.updateFulfillmentStatusAdmin, {
      orderId,
      fulfillmentStatus: "in_transit",
      carrier: "UPS",
      trackingNumber: "1Z999AA10123456784",
    });
    const dispatched = await sends(tt, "sendOrderDispatchedEmail");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].args).toMatchObject({ stage: "in_transit", carrier: "UPS", customerEmail: "buyer@test.com" });

    await admin(tt).mutation(api.orders.desk.updateFulfillmentStatusAdmin, { orderId, fulfillmentStatus: "delivered" });
    expect(await sends(tt, "sendOrderDeliveredEmail")).toHaveLength(1);

    await admin(tt).mutation(api.orders.desk.updateFulfillmentStatusAdmin, { orderId, fulfillmentStatus: "in_transit" });
    expect(await sends(tt, "sendOrderDispatchedEmail")).toHaveLength(1);
    expect(await sends(tt, "sendOrderDeliveredEmail")).toHaveLength(1);
    await drain(tt);
  });
});

function disputeEvent(eventId: string, type: string, dispute: Record<string, unknown>) {
  return JSON.stringify({ id: eventId, type, data: { object: { object: "dispute", ...dispute } } });
}

describe("disputes", () => {
  it("a dispute no order matches still alerts the Administrator", async () => {
    const tt = t();
    await deliver(
      tt,
      disputeEvent("evt_dp1", "charge.dispute.created", {
        id: "dp_unlinked",
        status: "needs_response",
        amount: 2500,
        currency: "usd",
        reason: "fraudulent",
        payment_intent: null,
        evidence_details: { due_by: 1_900_000_000 },
      })
    );

    const alerts = (await sends(tt, "sendAdminAlert")).map((f) => f.args.alert);
    expect(alerts).toEqual([
      expect.objectContaining({ idempotencyKey: "dispute-unlinked-dp_unlinked-needs_response", badge: "UNLINKED DISPUTE" }),
    ]);
    expect(alerts[0].orderNumber).toBeUndefined();
    expect(await sends(tt, "sendAdminDisputeAlert")).toHaveLength(0);
    await drain(tt);
  });
});

describe("cancellation emails", () => {
  it("a Customer Cancellation emails the Customer and alerts the Administrator", async () => {
    const tt = t();
    await seedVariant(tt);
    const orderId = await paidOrder(tt, "GL-CC-9");

    await owner(tt).mutation(internal.orders.functions.cancelOrder, { orderId, reason: "Changed my mind" });

    const notices = await sends(tt, "sendCustomerNotice");
    expect(notices).toHaveLength(1);
    expect(notices[0].args).toMatchObject({ customerEmail: "buyer@test.com", orderNumber: "GL-CC-9" });
    expect(notices[0].args.notice.idempotencyKey).toBe("order-cancelled-GL-CC-9");
    expect(notices[0].args.notice.paragraphs.join(" ")).toMatch(/You cancelled.*full refund of \$108\.50/);

    const alerts = (await sends(tt, "sendAdminAlert")).map((f) => f.args.alert);
    expect(alerts).toEqual([expect.objectContaining({ idempotencyKey: "customer-cancellation-GL-CC-9", orderNumber: "GL-CC-9" })]);
    expect(alerts[0].facts).toContainEqual({ label: "Reason", value: "Changed my mind" });
    await drain(tt);
  });

  it("an Administrator cancellation emails a Customer who paid, and nobody for an unpaid hold", async () => {
    const tt = t();
    await seedVariant(tt);
    const paid = await paidOrder(tt, "GL-AC-9");
    await admin(tt).mutation(internal.orders.desk.cancelOrderAdmin, { orderId: paid, refundStripe: true });
    const unpaid = await holdOrder(tt, "GL-AC-10", "cs_ac10");
    await admin(tt).mutation(internal.orders.desk.cancelOrderAdmin, { orderId: unpaid, refundStripe: true });

    const notices = await sends(tt, "sendCustomerNotice");
    expect(notices.map((f) => f.args.orderNumber)).toEqual(["GL-AC-9"]);
    expect(notices[0].args.notice.paragraphs.join(" ")).toMatch(/We cancelled.*full refund of \$108\.50/);
    expect(await sends(tt, "sendAdminAlert")).toHaveLength(0);
    await drain(tt);
  });

  it("an Administrator cancellation without a refund says the team will follow up", async () => {
    const tt = t();
    await seedVariant(tt);
    const orderId = await paidOrder(tt, "GL-AC-11");
    await admin(tt).mutation(internal.orders.desk.cancelOrderAdmin, { orderId, refundStripe: false });

    const [notice] = await sends(tt, "sendCustomerNotice");
    expect(notice.args.notice.paragraphs.join(" ")).toMatch(/follow up about your refund/);
    await drain(tt);
  });
});

async function goodwill(tt: T, orderId: Id<"orders">, requestId: string) {
  return await tt.mutation(internal.payments.refundLedger.reserveAdminRefund, {
    orderId,
    requestId,
    actor: "user_admin",
    request: { kind: "goodwill", amountCents: 1000, reason: "late" },
  });
}

describe("refund emails", () => {
  it("an issued goodwill refund emails the Customer once, keyed by the refund id", async () => {
    const tt = t();
    await seedVariant(tt);
    const orderId = await paidOrder(tt, "GL-RF-9");
    const reservation = await goodwill(tt, orderId, "req-rf9");

    await tt.mutation(internal.payments.refundLedger.commitRefund, { refundId: reservation.refundId, stripeRefundId: "re_9" });
    await tt.mutation(internal.payments.refundLedger.commitRefund, { refundId: reservation.refundId, stripeRefundId: "re_9" });

    const notices = await sends(tt, "sendCustomerNotice");
    expect(notices).toHaveLength(1);
    expect(notices[0].args.notice).toMatchObject({ idempotencyKey: `refund-${reservation.refundId}`, badge: "REFUND ISSUED" });
    await drain(tt);
  });

  it("a cancellation's refund sends no second refund email", async () => {
    const tt = t();
    await seedVariant(tt);
    const orderId = await paidOrder(tt, "GL-RF-10");
    const { refund } = await owner(tt).mutation(internal.orders.functions.cancelOrder, { orderId });
    await tt.mutation(internal.payments.refundLedger.commitRefund, { refundId: refund.refundId, stripeRefundId: "re_10" });

    const keys = (await sends(tt, "sendCustomerNotice")).map((f) => f.args.notice.idempotencyKey);
    expect(keys).toEqual(["order-cancelled-GL-RF-10"]);
    await drain(tt);
  });

  it("a refund Stripe refused alerts the Administrator", async () => {
    const tt = t();
    await seedVariant(tt);
    const orderId = await paidOrder(tt, "GL-RF-11");
    const reservation = await goodwill(tt, orderId, "req-rf11");

    await tt.mutation(internal.payments.refundLedger.failRefund, { refundId: reservation.refundId, error: "charge_expired" });

    const alerts = (await sends(tt, "sendAdminAlert")).map((f) => f.args.alert);
    expect(alerts).toEqual([
      expect.objectContaining({ idempotencyKey: `refund-failed-${reservation.refundId}`, badge: "REFUND FAILED", orderNumber: "GL-RF-11" }),
    ]);
    expect(await sends(tt, "sendCustomerNotice")).toHaveLength(0);
    await drain(tt);
  });

  it("a refund Stripe failed after issuing it alerts the Administrator once across replays", async () => {
    const tt = t();
    await seedVariant(tt);
    const orderId = await paidOrder(tt, "GL-RF-12");
    const reservation = await goodwill(tt, orderId, "req-rf12");
    await tt.mutation(internal.payments.refundLedger.commitRefund, { refundId: reservation.refundId, stripeRefundId: "re_12" });

    const failure = {
      stripeRefundId: "re_12",
      stripeStatus: "failed" as const,
      failureReason: "lost_or_stolen_card",
      webhookEventId: "evt_rf12",
    };
    await tt.mutation(internal.payments.refundLedger.failIssuedRefundFromStripe, failure);
    await tt.mutation(internal.payments.refundLedger.failIssuedRefundFromStripe, failure);

    const alerts = (await sends(tt, "sendAdminAlert")).map((f) => f.args.alert);
    expect(alerts).toEqual([expect.objectContaining({ idempotencyKey: `refund-failed-${reservation.refundId}` })]);
    await drain(tt);
  });
});
