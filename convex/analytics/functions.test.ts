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
const dashboard = (tt: T) => admin(tt).query(api.analytics.functions.getAnalyticsAdmin, { clientTime: Date.now(), tzOffsetMinutes: 0 });

async function seedCap(tt: T) {
  await tt.run((ctx) =>
    ctx.db.insert("variants", {
      variantId: "V1",
      isAvailable: true,
      nameEn: "Cap",
      nameEs: "Gorra",
      silhouette: "snapback",
      primaryHex: "#000000",
      secondaryHex: "#ffffff",
      image: "/img.png",
      stock: 5,
      priceUsd: 100,
      isFeatured: false,
    })
  );
}

const hold = (tt: T, orderNumber: string) =>
  tt.mutation(internal.orders.checkoutHold.placeCheckoutHold, {
    orderNumber,
    items: [{ variantId: "V1", quantity: 1, name: "Cap", price: 100, image: "/img.png" }],
    currency: "USD",
    subtotal: 100,
    shippingFee: 0,
    total: 100,
    customerEmail: "buyer@test.com",
    checkoutHoldExpiresAt: Date.now() + 31 * 60 * 1000,
    locale: "en",
  });

/** An order as it existed before the aggregate: written straight to the table, so no trigger ran. */
const legacyOrder = (tt: T, orderNumber: string, total: number) =>
  tt.run((ctx) =>
    ctx.db.insert("orders", {
      orderNumber,
      items: [],
      currency: "USD",
      total,
      paymentStatus: "paid",
      fulfillmentStatus: "delivered",
      paymentMethod: "stripe",
      createdAt: Date.now() - 400 * 24 * 60 * 60 * 1000,
    })
  );

describe("getAnalyticsAdmin totals (M8)", () => {
  it("follow every order write through the orderStats trigger", async () => {
    const tt = t();
    await seedCap(tt);
    const orderId = await hold(tt, "GL-A1");
    await hold(tt, "GL-A2");
    expect(await dashboard(tt)).toMatchObject({ totalOrdersCount: 2, paymentStatusCounts: { awaiting_payment: 2 }, cancelledCount: 0 });

    await tt.mutation(internal.orders.checkoutHold.releaseCheckoutHold, { orderId, reason: "session_creation_failed" });
    expect(await dashboard(tt)).toMatchObject({ totalOrdersCount: 2, paymentStatusCounts: { awaiting_payment: 1 }, cancelledCount: 1 });
  });

  it("backfillOrderStats counts orders written before the aggregate, once", async () => {
    const tt = t();
    await legacyOrder(tt, "GL-OLD-1", 300);
    await legacyOrder(tt, "GL-OLD-2", 200);
    expect(await dashboard(tt)).toMatchObject({ totalOrdersCount: 0, totalRevenue: 0 });

    await tt.mutation(internal.analytics.migrations.backfillOrderStats, {});
    await tt.mutation(internal.analytics.migrations.backfillOrderStats, {});
    await tt.finishAllScheduledFunctions(() => {});
    const after = await dashboard(tt);
    expect(after).toMatchObject({ totalOrdersCount: 2, totalRevenue: 500, completedOrdersCount: 2 });
    // All-time totals, but both orders are older than the chart window.
    expect(after.windows.d30).toEqual({ revenue: 0, orders: 0 });
  });
});
