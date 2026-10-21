import { describe, expect, it } from "vitest";
import { toOrderRow } from "./orderRow";
import type { OrderRowInput } from "./orderRow";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 9, 17, 12);

const base: OrderRowInput = {
  _id: "o1",
  orderNumber: "GL-1042",
  customerName: "Ana López",
  customerEmail: "ana@example.com",
  total: 86,
  createdAt: NOW - 2 * HOUR,
  paymentStatus: "paid",
  fulfillmentStatus: "unfulfilled",
  items: [
    { name: "Cap", image: "/a.png", quantity: 1 },
    { name: "Tee", image: "/b.png", quantity: 2 },
  ],
  shippingAddress: { line1: "1 Main St" },
};

describe("toOrderRow", () => {
  const row = toOrderRow(base, NOW, "en");

  it("links to the detail page", () => {
    expect(row.href).toBe("/admin/orders/GL-1042");
    expect(row.id).toBe("o1");
  });

  it("prefers name, then email, then nothing", () => {
    expect(row.customer).toBe("Ana López");
    expect(toOrderRow({ ...base, customerName: undefined }, NOW, "en").customer).toBe("ana@example.com");
    expect(toOrderRow({ ...base, customerName: undefined, customerEmail: undefined }, NOW, "en").customer).toBe("");
  });

  it("formats the total and sums quantities, keeping three thumbs", () => {
    expect(row.totalLabel).toBe("$86");
    expect(row.itemCount).toBe(3);
    const many = { ...base, items: [1, 2, 3, 4].map((n) => ({ name: `i${n}`, image: n === 2 ? "" : `/${n}.png`, quantity: 1 })) };
    expect(toOrderRow(many, NOW, "en").thumbs).toEqual(["/1.png", "/3.png", "/4.png"]);
  });

  it("ages in minutes, hours, then days", () => {
    expect(toOrderRow({ ...base, createdAt: NOW - 5 * MIN }, NOW, "en").age).toEqual({ value: 5, unit: "m" });
    expect(toOrderRow({ ...base, createdAt: NOW - 3 * HOUR }, NOW, "en").age).toEqual({ value: 3, unit: "h" });
    expect(toOrderRow({ ...base, createdAt: NOW - 2 * DAY - HOUR }, NOW, "en").age).toEqual({ value: 2, unit: "d" });
    expect(toOrderRow({ ...base, createdAt: NOW + MIN }, NOW, "en").age).toEqual({ value: 0, unit: "m" });
  });

  it("is overdue only after 24 hours in Needs Packing", () => {
    expect(toOrderRow({ ...base, createdAt: NOW - DAY }, NOW, "en").overdue).toBe(false);
    expect(toOrderRow({ ...base, createdAt: NOW - DAY - 1 }, NOW, "en").overdue).toBe(true);
    expect(toOrderRow({ ...base, createdAt: NOW - 9 * DAY, paymentStatus: "awaiting_payment" }, NOW, "en").overdue).toBe(false);
    expect(toOrderRow({ ...base, createdAt: NOW - 9 * DAY, fulfillmentStatus: "in_transit" }, NOW, "en").overdue).toBe(false);
  });

  it("offers the one quick action labelAction allows", () => {
    expect(row.quickAction).toBe("buy");
    expect(toOrderRow({ ...base, fulfillmentStatus: "delivery_exception" }, NOW, "en").quickAction).toBe("reship");
    expect(toOrderRow({ ...base, paymentStatus: "awaiting_payment" }, NOW, "en").quickAction).toBeNull();
    expect(toOrderRow({ ...base, cancelledAt: NOW }, NOW, "en").quickAction).toBeNull();
    expect(toOrderRow({ ...base, fulfillmentStatus: "in_transit" }, NOW, "en").quickAction).toBeNull();
  });

  it("flags a missing address and passes the lifecycle through", () => {
    expect(row.addressMissing).toBe(false);
    expect(toOrderRow({ ...base, shippingAddress: undefined }, NOW, "en").addressMissing).toBe(true);
    expect(row.lifecycle).toEqual({ paymentStatus: "paid", fulfillmentStatus: "unfulfilled", cancelledAt: undefined });
  });
});
