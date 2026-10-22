/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import aggregateTest from "@convex-dev/aggregate/test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
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

/** A paid Order waiting for its first label: one cap and two tees. */
async function seedNeedsPacking(tt: T, orderNumber = "GL-P1") {
  return await tt.run(async (ctx) =>
    ctx.db.insert("orders", {
      orderNumber,
      customerName: "Test Buyer",
      customerEmail: "buyer@test.com",
      items: [
        { variantId: "CAP1", name: "Cap", quantity: 1, price: 50, image: "/cap.png" },
        { variantId: "TEE1", name: "Tee", quantity: 2, price: 40, image: "/tee.png", colorway: "Black", size: "L" },
      ],
      currency: "USD",
      total: 130,
      paymentStatus: "paid",
      fulfillmentStatus: "unfulfilled",
      paymentMethod: "stripe",
      createdAt: Date.now(),
    })
  );
}

async function completionEvents(tt: T, orderId: Id<"orders">) {
  return await tt.run(async (ctx) =>
    (await ctx.db.query("payment_events").collect()).filter((e) => e.orderId === orderId && e.type === "packing_checklist_completed")
  );
}

describe("Packing Checklist functions (plan 0012)", () => {
  it("only an Administrator can read or tick a checklist", async () => {
    const tt = t();
    const orderId = await seedNeedsPacking(tt);
    expect(await tt.query(api.orders.packingChecklist.getPackingChecklistAdmin, { orderId })).toBeNull();
    const customer = tt.withIdentity({ subject: "user_customer", email: "buyer@test.com" });
    await expect(customer.mutation(api.orders.packingChecklist.checkUnit, { orderId, lineIndex: 0, delta: 1 })).rejects.toThrow();
  });

  it("ticking every unit completes the list and logs one admin-only Timeline event", async () => {
    const tt = t();
    const orderId = await seedNeedsPacking(tt);
    const tick = (lineIndex: number, delta: 1 | -1) => admin(tt).mutation(api.orders.packingChecklist.checkUnit, { orderId, lineIndex, delta });

    await tick(0, 1);
    await tick(1, 1);
    expect(await admin(tt).query(api.orders.packingChecklist.getPackingChecklistAdmin, { orderId })).toMatchObject({
      editable: true,
      checkedUnits: 2,
      totalUnits: 3,
    });

    await tick(1, 1);
    expect(await admin(tt).query(api.orders.packingChecklist.getPackingChecklistAdmin, { orderId })).toMatchObject({ complete: true });
    expect(await completionEvents(tt, orderId)).toHaveLength(1);

    await tick(1, -1);
    await tick(1, 1);
    expect(await completionEvents(tt, orderId)).toHaveLength(1);
  });

  it("a refunded unit leaves the list", async () => {
    const tt = t();
    const orderId = await seedNeedsPacking(tt);
    await tt.run(async (ctx) => {
      await ctx.db.insert("order_refunds", {
        orderId,
        orderNumber: "GL-P1",
        kind: "line",
        status: "issued",
        lines: [{ lineIndex: 1, quantity: 1, amountCents: 4000, restock: true }],
        shippingCents: 0,
        amountCents: 4000,
        requestId: "r1",
        idempotencyKey: "k1",
        actor: "user_admin",
        createdAt: Date.now(),
      });
    });
    const view = await admin(tt).query(api.orders.packingChecklist.getPackingChecklistAdmin, { orderId });
    expect(view?.lines[1]).toEqual({ remaining: 1, checked: 0, overflow: 0 });
    expect(view?.totalUnits).toBe(2);
  });

  it("is locked once a label is bought", async () => {
    const tt = t();
    const orderId = await seedNeedsPacking(tt);
    await admin(tt).mutation(api.orders.packingChecklist.checkUnit, { orderId, lineIndex: 0, delta: 1 });
    await tt.run(async (ctx) => {
      await ctx.db.patch(orderId, {
        fulfillmentStatus: "label_purchased",
        trackingNumber: TRACKING,
        shippingLabelUrl: "https://label.pdf",
        labels: [{ carrier: "USPS", trackingNumber: TRACKING, labelUrl: "https://label.pdf", purchasedAt: Date.now(), reship: false }],
      });
    });
    await expect(admin(tt).mutation(api.orders.packingChecklist.checkUnit, { orderId, lineIndex: 1, delta: 1 })).rejects.toThrow(/locked/);
    expect(await admin(tt).query(api.orders.packingChecklist.getPackingChecklistAdmin, { orderId })).toMatchObject({
      editable: false,
      checkedUnits: 1,
    });
  });

  it("reports progress for several Orders at once", async () => {
    const tt = t();
    const a = await seedNeedsPacking(tt, "GL-P1");
    const b = await seedNeedsPacking(tt, "GL-P2");
    await admin(tt).mutation(api.orders.packingChecklist.checkUnit, { orderId: a, lineIndex: 1, delta: 1 });
    expect(await admin(tt).query(api.orders.packingChecklist.packingProgressAdmin, { orderIds: [a, b] })).toEqual([
      { orderId: a, checkedUnits: 1, totalUnits: 3, complete: false },
      { orderId: b, checkedUnits: 0, totalUnits: 3, complete: false },
    ]);
  });
});
