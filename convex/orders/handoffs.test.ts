/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import aggregateTest from "@convex-dev/aggregate/test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";

const modules = import.meta.glob("/convex/**/*.ts");
function t() {
  const tt = convexTest(schema, modules);
  aggregateTest.register(tt, "orderStats");
  return tt;
}
type T = ReturnType<typeof t>;

const admin = (tt: T) => tt.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL, emailVerified: true });
const TRACKING = "9400111899223344556677";

async function seedReadyToShip(tt: T, orderNumber = "GL-H1") {
  const purchasedAt = Date.now() - 60 * 60 * 1000;
  return await tt.run(async (ctx) =>
    ctx.db.insert("orders", {
      orderNumber,
      customerName: "Test Buyer",
      customerEmail: "buyer@test.com",
      items: [{ variantId: "V1", name: "Cap V1", quantity: 1, price: 100, image: "/img.png" }],
      currency: "USD",
      total: 100,
      paymentStatus: "paid",
      fulfillmentStatus: "label_purchased",
      paymentMethod: "stripe",
      carrier: "USPS",
      trackingNumber: TRACKING,
      shippingLabelUrl: "https://label.pdf",
      labels: [{ carrier: "USPS", trackingNumber: TRACKING, labelUrl: "https://label.pdf", purchasedAt, reship: false }],
      createdAt: purchasedAt,
    })
  );
}

/** "has shipped" emails scheduled so far. */
async function shippedEmails(tt: T) {
  return await tt.run(async (ctx) => {
    const jobs = await ctx.db.system.query("_scheduled_functions").collect();
    return jobs.filter((j) => j.name.includes("sendOrderDispatchedEmail") && (j.args[0] as { stage?: string }).stage === "in_transit");
  });
}

describe("Handoffs (ADR 0030)", () => {
  it("a Handoff tells the Customer once; the later scan moves the status without a second email", async () => {
    const tt = t();
    const orderId = await seedReadyToShip(tt);

    const { results } = await admin(tt).mutation(api.orders.handoffs.recordHandoff, {
      orderIds: [orderId],
      method: "dropped_off",
      at: Date.now(),
      note: "Post office",
    });
    expect(results).toEqual([{ orderId, orderNumber: "GL-H1", ok: true }]);
    let order = await tt.run((ctx) => ctx.db.get(orderId));
    expect(order?.fulfillmentStatus).toBe("label_purchased");
    expect(order?.manualStatusOverride).toBeUndefined();
    expect(order?.labels?.[0].handoff).toMatchObject({ method: "dropped_off", note: "Post office", actor: "user_admin" });
    expect(await shippedEmails(tt)).toHaveLength(1);

    // Correcting it does not email again.
    await admin(tt).mutation(api.orders.handoffs.recordHandoff, { orderIds: [orderId], method: "picked_up", at: Date.now() });
    expect(await shippedEmails(tt)).toHaveLength(1);

    await tt.mutation(internal.orders.fulfillment.handleTrackingWebhookInternal, { trackingNumber: TRACKING, status: "TRANSIT" });
    order = await tt.run((ctx) => ctx.db.get(orderId));
    expect(order?.fulfillmentStatus).toBe("in_transit");
    expect(order?.labels?.[0].handoff?.method).toBe("picked_up");
    expect(await shippedEmails(tt)).toHaveLength(1);

    // Locked once scanned.
    const late = await admin(tt).mutation(api.orders.handoffs.recordHandoff, { orderIds: [orderId], method: "dropped_off", at: Date.now() });
    expect(late.results[0].ok).toBe(false);
    await expect(admin(tt).mutation(api.orders.handoffs.clearHandoff, { orderId })).rejects.toThrow(/locked/);
  });

  it("with no Handoff, the first scan sends the shipped email", async () => {
    const tt = t();
    await seedReadyToShip(tt);
    await tt.mutation(internal.orders.fulfillment.handleTrackingWebhookInternal, { trackingNumber: TRACKING, status: "TRANSIT" });
    await tt.mutation(internal.orders.fulfillment.handleTrackingWebhookInternal, { trackingNumber: TRACKING, status: "TRANSIT" });
    expect(await shippedEmails(tt)).toHaveLength(1);
  });

  it("marks several at once and reports the ones it could not", async () => {
    const tt = t();
    const a = await seedReadyToShip(tt, "GL-H1");
    const b = await seedReadyToShip(tt, "GL-H2");
    await tt.run((ctx) => ctx.db.patch(b, { fulfillmentStatus: "in_transit" }));
    const { results } = await admin(tt).mutation(api.orders.handoffs.recordHandoff, { orderIds: [a, b], method: "picked_up", at: Date.now() });
    expect(results.map((r) => r.ok)).toEqual([true, false]);
  });

  it("is admin-only and shows on the desk counters", async () => {
    const tt = t();
    const orderId = await seedReadyToShip(tt);
    await expect(tt.mutation(api.orders.handoffs.recordHandoff, { orderIds: [orderId], method: "picked_up", at: Date.now() })).rejects.toThrow();
    expect(await admin(tt).query(api.orders.handoffs.handoffAttention, { clientTime: Date.now() })).toEqual({
      readyToShip: 1,
      notHandedOff: 0,
      noScan: 0,
    });
    expect(await admin(tt).query(api.orders.handoffs.handoffAttention, { clientTime: Date.now() + 2 * 24 * 3600_000 })).toMatchObject({
      notHandedOff: 1,
    });
  });
});
