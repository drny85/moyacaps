/// <reference types="vite/client" />
/**
 * The Orders desk table query (plan 0013): one sorted page of a desk tab inside a date window.
 */
import { convexTest } from "convex-test";
import type { FunctionArgs } from "convex/server";
import aggregateTest from "@convex-dev/aggregate/test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import schema from "../schema";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";
import { ORDERS_PAGE_SIZE } from "./deskPage";

const modules = import.meta.glob("/convex/**/*.ts");

function t() {
  const tt = convexTest(schema, modules);
  aggregateTest.register(tt, "orderStats");
  return tt;
}
type T = ReturnType<typeof t>;

const admin = (tt: T) => tt.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL, emailVerified: true });

type SeededOrder = Partial<Doc<"orders">> & Pick<Doc<"orders">, "orderNumber" | "paymentStatus" | "fulfillmentStatus">;

async function seedOrder(tt: T, fields: SeededOrder) {
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

const page = (tt: T, args: Partial<FunctionArgs<typeof api.orders.desk.getOrdersDeskPage>> = {}) =>
  admin(tt).query(api.orders.desk.getOrdersDeskPage, { clientTime: 10_000_000, ...args });

describe("getOrdersDeskPage", () => {
  it("sorts the whole tab, then returns one page with the total", async () => {
    const tt = t();
    const count = ORDERS_PAGE_SIZE + 10;
    for (let i = 0; i < count; i++) {
      await seedOrder(tt, { orderNumber: `GL-T-${i}`, paymentStatus: "paid", fulfillmentStatus: "delivered", total: i * 10, createdAt: 1_000 + i });
    }

    const first = await page(tt, { sort: "total_desc" });
    expect(first).toMatchObject({ total: count, page: 1, pageCount: 2, capped: false });
    expect(first.rows).toHaveLength(ORDERS_PAGE_SIZE);
    expect(first.rows[0].orderNumber).toBe(`GL-T-${count - 1}`);

    const second = await page(tt, { sort: "total_desc", page: 2 });
    expect(second.rows.map((o) => o.orderNumber)).toEqual(Array.from({ length: 10 }, (_, i) => `GL-T-${9 - i}`));

    // Oldest first, and a page past the end shows the last one.
    expect((await page(tt, { sort: "placed_asc" })).rows[0].orderNumber).toBe("GL-T-0");
    expect((await page(tt, { page: 99 })).page).toBe(2);
  });

  it("keeps only the date window, with until exclusive, on All and on other History Queues", async () => {
    const tt = t();
    await seedOrder(tt, { orderNumber: "GL-OLD", paymentStatus: "paid", fulfillmentStatus: "delivered", createdAt: 1_000 });
    await seedOrder(tt, { orderNumber: "GL-MID", paymentStatus: "paid", fulfillmentStatus: "delivered", createdAt: 5_000 });
    await seedOrder(tt, { orderNumber: "GL-NEW", paymentStatus: "paid", fulfillmentStatus: "delivered", createdAt: 9_000 });
    const numbers = async (status: string) => (await page(tt, { status, since: 4_000, until: 9_000 })).rows.map((o) => o.orderNumber);

    expect(await numbers("all")).toEqual(["GL-MID"]);
    expect(await numbers("done")).toEqual(["GL-MID"]);
  });

  it("search results follow the chosen sort", async () => {
    const tt = t();
    await seedOrder(tt, { orderNumber: "GL-ANA-1", customerName: "Ana Small", paymentStatus: "paid", fulfillmentStatus: "delivered", total: 20 });
    await seedOrder(tt, { orderNumber: "GL-ANA-2", customerName: "Ana Big", paymentStatus: "paid", fulfillmentStatus: "delivered", total: 90 });
    await seedOrder(tt, { orderNumber: "GL-BEA-1", customerName: "Bea", paymentStatus: "paid", fulfillmentStatus: "delivered", total: 50 });

    const found = await page(tt, { search: "ana", sort: "total_desc" });
    expect(found.rows.map((o) => o.orderNumber)).toEqual(["GL-ANA-2", "GL-ANA-1"]);
    expect(found.total).toBe(2);
  });

  it("skips Expired Checkouts on All", async () => {
    const tt = t();
    await seedOrder(tt, { orderNumber: "GL-REAL", paymentStatus: "paid", fulfillmentStatus: "unfulfilled" });
    await seedOrder(tt, { orderNumber: "GL-EXP", paymentStatus: "awaiting_payment", fulfillmentStatus: "unfulfilled", cancelledAt: 3_000 });
    expect((await page(tt)).rows.map((o) => o.orderNumber)).toEqual(["GL-REAL"]);
  });

  it("returns an empty page when signed out", async () => {
    const tt = t();
    await seedOrder(tt, { orderNumber: "GL-1", paymentStatus: "paid", fulfillmentStatus: "unfulfilled" });
    expect(await tt.query(api.orders.desk.getOrdersDeskPage, { clientTime: 0 })).toEqual({ rows: [], total: 0, page: 1, pageCount: 1, capped: false });
  });
});
