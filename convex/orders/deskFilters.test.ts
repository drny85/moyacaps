import { describe, expect, it } from "vitest";
import { DESK_FILTERS, matchesDeskFilter, parseDeskFilter, type DeskFilter } from "./deskFilters";
import type { FulfillmentStatus, PaymentStatus } from "./status";

const NOW = Date.UTC(2026, 9, 19, 12);
const DAY = 24 * 60 * 60 * 1000;

const order = (paymentStatus: PaymentStatus, fulfillmentStatus: FulfillmentStatus, extra: { cancelledAt?: number; createdAt?: number } = {}) => ({
  paymentStatus,
  fulfillmentStatus,
  createdAt: NOW,
  ...extra,
});

const tabsOf = (o: ReturnType<typeof order>) => DESK_FILTERS.filter((f) => matchesDeskFilter(o, f, NOW));

describe("parseDeskFilter", () => {
  it("accepts every desk filter and lists everything for unknown values", () => {
    for (const f of DESK_FILTERS) expect(parseDeskFilter(f)).toBe(f);
    expect(parseDeskFilter(undefined)).toBe("all");
    expect(parseDeskFilter("nonsense")).toBe("all");
  });

  it("maps the single-status desk's tabs onto the axes", () => {
    expect(parseDeskFilter("paid")).toBe<DeskFilter>("needs_packing");
    expect(parseDeskFilter("needs_attention")).toBe<DeskFilter>("needs_packing");
    expect(parseDeskFilter("dispatched")).toBe<DeskFilter>("in_transit");
    expect(parseDeskFilter("pending")).toBe<DeskFilter>("awaiting_payment");
  });
});

describe("matchesDeskFilter", () => {
  it("a fresh paid order waits in the packing queue", () => {
    expect(tabsOf(order("paid", "unfulfilled"))).toEqual(["all", "needs_packing"]);
  });

  it("the packing queue turns overdue after 24 hours", () => {
    expect(tabsOf(order("paid", "unfulfilled", { createdAt: NOW - 2 * DAY }))).toEqual(["all", "needs_packing", "overdue"]);
    // Exactly 24 hours is not yet overdue; one millisecond more is.
    expect(tabsOf(order("paid", "unfulfilled", { createdAt: NOW - DAY }))).toEqual(["all", "needs_packing"]);
    expect(tabsOf(order("paid", "unfulfilled", { createdAt: NOW - DAY - 1 }))).toEqual(["all", "needs_packing", "overdue"]);
  });

  it("a partially refunded order still needs packing", () => {
    expect(tabsOf(order("partially_refunded", "unfulfilled"))).toEqual(["all", "needs_packing", "partially_refunded"]);
  });

  it("a refunded delivered order shows under both axes", () => {
    expect(tabsOf(order("refunded", "delivered"))).toEqual(["all", "done", "delivered", "refunded"]);
  });

  it("a disputed order in transit is not in the packing queue", () => {
    expect(tabsOf(order("disputed", "in_transit"))).toEqual(["all", "shipped", "problems", "in_transit", "disputed"]);
  });

  it("an abandoned checkout is cancelled, not awaiting payment", () => {
    expect(tabsOf(order("awaiting_payment", "unfulfilled"))).toEqual(["all", "awaiting_payment"]);
    expect(tabsOf(order("awaiting_payment", "unfulfilled", { cancelledAt: NOW }))).toEqual(["all", "cancelled"]);
  });

  it("queues group the statuses the desk works from", () => {
    expect(tabsOf(order("paid", "label_purchased"))).toEqual(["all", "shipped", "label_purchased"]);
    expect(tabsOf(order("paid", "delivery_exception"))).toEqual(["all", "problems", "delivery_exception"]);
    expect(tabsOf(order("paid", "returned"))).toEqual(["all", "problems", "returned"]);
    expect(tabsOf(order("paid", "delivered"))).toEqual(["all", "done", "delivered"]);
    expect(tabsOf(order("refunded", "unfulfilled"))).toEqual(["all", "done", "refunded"]);
  });

  it("a cancelled order is never Shipped, Done or a Problem, whatever its axes say", () => {
    expect(tabsOf(order("refunded", "unfulfilled", { cancelledAt: NOW }))).toEqual(["all", "refunded", "cancelled"]);
    expect(tabsOf(order("paid", "returned", { cancelledAt: NOW }))).toEqual(["all", "returned", "cancelled"]);
    expect(tabsOf(order("paid", "in_transit", { cancelledAt: NOW }))).toEqual(["all", "in_transit", "cancelled"]);
  });

  it("a refunded return or exception is resolved: Done, no longer a Problem", () => {
    expect(tabsOf(order("refunded", "returned"))).toEqual(["all", "done", "returned", "refunded"]);
    expect(tabsOf(order("refunded", "delivery_exception"))).toEqual(["all", "done", "delivery_exception", "refunded"]);
    expect(tabsOf(order("partially_refunded", "returned"))).toEqual(["all", "problems", "returned", "partially_refunded"]);
  });
});
