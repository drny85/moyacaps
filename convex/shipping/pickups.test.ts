/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import aggregateTest from "@convex-dev/aggregate/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";
import { nextPickupDate } from "./pickupPlan";

const modules = import.meta.glob("/convex/**/*.ts");
function t() {
  const tt = convexTest(schema, modules);
  aggregateTest.register(tt, "orderStats");
  return tt;
}
type T = ReturnType<typeof t>;

const admin = (tt: T) => tt.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL, emailVerified: true });

// Simulated pickups only; nothing here reaches the Shippo API.
const savedEnv = { key: process.env.SHIPPO_API_KEY, allow: process.env.SHIPPO_ALLOW_SIMULATION };
beforeEach(() => {
  delete process.env.SHIPPO_API_KEY;
  process.env.SHIPPO_ALLOW_SIMULATION = "true";
});
afterEach(() => {
  if (savedEnv.key === undefined) delete process.env.SHIPPO_API_KEY;
  else process.env.SHIPPO_API_KEY = savedEnv.key;
  if (savedEnv.allow === undefined) delete process.env.SHIPPO_ALLOW_SIMULATION;
  else process.env.SHIPPO_ALLOW_SIMULATION = savedEnv.allow;
});

async function seedLabelled(tt: T, orderNumber: string, serviceLevel: string) {
  return await tt.run(async (ctx) =>
    ctx.db.insert("orders", {
      orderNumber,
      customerName: "Test Buyer",
      items: [{ variantId: "V1", name: "Cap V1", quantity: 1, price: 100, image: "/img.png" }],
      currency: "USD",
      total: 100,
      paymentStatus: "paid",
      fulfillmentStatus: "label_purchased",
      paymentMethod: "stripe",
      shippingCarrier: "USPS",
      shippingServiceLevel: serviceLevel,
      shippingTransactionId: `sim_tx_${orderNumber}`,
      createdAt: Date.now(),
    })
  );
}

const today = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();
const pickupDate = nextPickupDate(new Date());
const at = (time: string) => new Date(`${pickupDate}T${time}:00`).getTime();
const request = {
  today,
  pickupDate,
  requestedStartTime: at("09:00"),
  requestedEndTime: at("17:00"),
  location: "Front Door" as const,
};

describe("USPS pickups", () => {
  it("schedules the Priority packages, leaves Ground Advantage for usps.com, and takes the day", async () => {
    const tt = t();
    const priority = await seedLabelled(tt, "GL-P1", "Priority Mail");
    await seedLabelled(tt, "GL-G1", "Ground Advantage");

    const before = await admin(tt).query(api.shipping.pickupQueries.pickupDesk, { today });
    expect(before.api.map((c) => c.orderId)).toEqual([priority]);
    expect(before.uspsSite.map((c) => c.orderNumber)).toEqual(["GL-G1"]);

    const result = await admin(tt).action(api.shipping.pickups.schedulePickup, request);
    expect(result).toMatchObject({ status: "CONFIRMED", packages: 1, simulated: true });
    expect(result.confirmationCode).toMatch(/^SIM/);

    const after = await admin(tt).query(api.shipping.pickupQueries.pickupDesk, { today });
    expect(after.api).toEqual([]);
    expect(after.uspsSite).toHaveLength(1);
    expect(after.upcoming).toHaveLength(1);
    expect(after.upcoming[0]).toMatchObject({ pickupDate, packages: 1, status: "CONFIRMED" });

    // One pickup per day, even for packages labelled later.
    await seedLabelled(tt, "GL-P2", "Priority Mail Express");
    await expect(admin(tt).action(api.shipping.pickups.schedulePickup, request)).rejects.toThrow(/one pickup per day/);
  });

  it("refuses when only Ground Advantage packages wait", async () => {
    const tt = t();
    await seedLabelled(tt, "GL-G1", "Ground Advantage");
    await expect(admin(tt).action(api.shipping.pickups.schedulePickup, request)).rejects.toThrow(/usps\.com/);
  });

  it("refuses simulated labels when the deployment does not allow simulation", async () => {
    delete process.env.SHIPPO_ALLOW_SIMULATION;
    const tt = t();
    await seedLabelled(tt, "GL-P1", "Priority Mail");
    await expect(admin(tt).action(api.shipping.pickups.schedulePickup, request)).rejects.toThrow(/SHIPPO_API_KEY is missing|simulated/);
  });

  it("is admin-only", async () => {
    const tt = t();
    await expect(tt.query(api.shipping.pickupQueries.pickupDesk, { today })).rejects.toThrow();
    await expect(tt.action(api.shipping.pickups.schedulePickup, request)).rejects.toThrow();
  });
});
