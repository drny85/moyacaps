import { describe, expect, it } from "vitest";
import { customerRefund } from "./orderRefund";

describe("customerRefund", () => {
  it("shows nothing when nothing was refunded", () => {
    expect(customerRefund({ total: 88 })).toBeNull();
    expect(customerRefund({ total: 88, refundedAmount: 0 })).toBeNull();
    expect(customerRefund({ total: 88, refundedAmount: null })).toBeNull();
  });

  it("a full Goodwill Refund leaves nothing paid", () => {
    expect(customerRefund({ total: 88, refundedAmount: 88 })).toEqual({ refunded: 88, netPaid: 0 });
  });

  it("a partial refund shows what came back and what was paid in the end", () => {
    expect(customerRefund({ total: 88, refundedAmount: 15 })).toEqual({ refunded: 15, netPaid: 73 });
  });

  it("rounds to the cent and never goes below zero", () => {
    expect(customerRefund({ total: 10.1, refundedAmount: 0.3 })).toEqual({ refunded: 0.3, netPaid: 9.8 });
    expect(customerRefund({ total: 88, refundedAmount: 90 })).toEqual({ refunded: 90, netPaid: 0 });
  });
});
