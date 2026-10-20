/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";

const modules = import.meta.glob("/convex/**/*.ts");
const t = () => convexTest(schema, modules);
type T = ReturnType<typeof t>;

const admin = (tt: T) => tt.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL });

// Each case sets its own Shippo environment; nothing here reaches the Shippo API.
const savedEnv = { key: process.env.SHIPPO_API_KEY, allow: process.env.SHIPPO_ALLOW_SIMULATION };
beforeEach(() => {
  delete process.env.SHIPPO_API_KEY;
  delete process.env.SHIPPO_ALLOW_SIMULATION;
});
afterEach(() => {
  if (savedEnv.key === undefined) delete process.env.SHIPPO_API_KEY;
  else process.env.SHIPPO_API_KEY = savedEnv.key;
  if (savedEnv.allow === undefined) delete process.env.SHIPPO_ALLOW_SIMULATION;
  else process.env.SHIPPO_ALLOW_SIMULATION = savedEnv.allow;
});

async function seedPaidOrder(tt: T) {
  return await tt.run(async (ctx) =>
    ctx.db.insert("orders", {
      orderNumber: "GL-SHIP-1",
      customerName: "Test Buyer",
      customerEmail: "buyer@test.com",
      shippingAddress: { line1: "350 5th Ave", city: "New York", state: "NY", postalCode: "10118", country: "US" },
      items: [{ variantId: "V1", name: "Cap V1", quantity: 1, price: 100, image: "/img.png" }],
      currency: "USD",
      subtotal: 100,
      shippingFee: 0,
      total: 100,
      paymentStatus: "paid",
      fulfillmentStatus: "unfulfilled",
      paymentMethod: "stripe",
      createdAt: Date.now(),
    })
  );
}

const parcel = { length: 8, width: 8, height: 6, weight: 12, unit: "in" };

async function getOrder(tt: T, orderId: Awaited<ReturnType<typeof seedPaidOrder>>) {
  return await tt.run((ctx) => ctx.db.get(orderId));
}

describe("Shippo rates and labels never fake postage by default", () => {
  it("returns no simulated rates when Shippo is not configured", async () => {
    const tt = t();
    const orderId = await seedPaidOrder(tt);
    const res = await admin(tt).action(api.shipping.functions.getShippingRates, { orderId, parcel });
    expect(res.success).toBe(false);
    expect(res.isSandbox).toBe(false);
    expect(res.rates).toEqual([]);
    expect(res.error).toMatch(/SHIPPO_API_KEY is missing/);
  });

  it("refuses to buy a simulated rate and leaves the order unfulfilled", async () => {
    const tt = t();
    const orderId = await seedPaidOrder(tt);
    await expect(
      admin(tt).action(api.shipping.functions.buyShippingLabel, { orderId, rateObjectId: `sim_usps_ground_${orderId}`, parcel })
    ).rejects.toThrow(/simulated rate/);
    const order = await getOrder(tt, orderId);
    expect(order?.fulfillmentStatus).toBe("unfulfilled");
    expect(order?.trackingNumber).toBeUndefined();
  });

  it("refuses a simulated rate with a live key even when simulation is opted in", async () => {
    process.env.SHIPPO_API_KEY = "shippo_live_suite";
    process.env.SHIPPO_ALLOW_SIMULATION = "true";
    const tt = t();
    const orderId = await seedPaidOrder(tt);
    await expect(
      admin(tt).action(api.shipping.functions.buyShippingLabel, { orderId, rateObjectId: `sim_usps_ground_${orderId}`, parcel })
    ).rejects.toThrow(/simulated rate/);
    expect((await getOrder(tt, orderId))?.fulfillmentStatus).toBe("unfulfilled");
  });

  it("still simulates on a deployment that opts in without a key (development)", async () => {
    process.env.SHIPPO_ALLOW_SIMULATION = "true";
    const tt = t();
    const orderId = await seedPaidOrder(tt);
    const rates = await admin(tt).action(api.shipping.functions.getShippingRates, { orderId, parcel });
    expect(rates.success).toBe(true);
    expect(rates.isSandbox).toBe(true);
    const label = await admin(tt).action(api.shipping.functions.buyShippingLabel, {
      orderId,
      rateObjectId: rates.rates[0].objectId,
      carrier: rates.rates[0].provider,
      parcel,
    });
    expect(label.isSandbox).toBe(true);
    expect((await getOrder(tt, orderId))?.fulfillmentStatus).toBe("label_purchased");
    await tt.finishAllScheduledFunctions(() => {});
  });
});
