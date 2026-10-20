import { describe, expect, it } from "vitest";
import {
  cancellationReleaseLines,
  cancellationRequestId,
  customerPaysReturnShipping,
  describeRefund,
  lineRefundCents,
  orderCents,
  planFullRefund,
  planGoodwillRefund,
  planLineRefund,
  planReturn,
  refundedQuantities,
  refundErrorOutcome,
  refundIdempotencyKey,
  remainingRefundableCents,
  returnWindowClosesAt,
  shippingRefundCents,
  type LedgerEntry,
  type RefundableOrder,
} from "./refundModel";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Two caps at $40 and one tee at $25, $8 shipping, $10.03 tax (8.875% of $113): $123.03.
 * Tax is shared across $113 of lines and shipping.
 */
const order = (extra: Partial<RefundableOrder> = {}): RefundableOrder => ({
  items: [
    { variantId: "cap", name: "Cap", quantity: 2, price: 40, image: "/cap.png" },
    { variantId: "tee", name: "Tee", quantity: 1, price: 25, image: "/tee.png", colorway: "black", size: "M" },
  ],
  subtotal: 105,
  shippingFee: 8,
  tax: 10.03,
  total: 123.03,
  paymentStatus: "paid",
  fulfillmentStatus: "delivered",
  stripeSessionId: "cs_test_1",
  ...extra,
});

const entry = (extra: Partial<LedgerEntry> = {}): LedgerEntry => ({
  kind: "line",
  status: "issued",
  lines: [],
  shippingCents: 0,
  amountCents: 0,
  ...extra,
});

const plan = <T extends { ok: boolean }>(result: T) => {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result)}`);
  return (result as T & { plan: any }).plan;
};

const error = (result: { ok: boolean; error?: string }) => (result.ok ? undefined : result.error);

describe("line amounts", () => {
  it("a line refund is price × quantity plus that line's share of tax", () => {
    expect(lineRefundCents(order(), 0, 1)).toBe(4000 + 355);
    expect(lineRefundCents(order(), 1, 1)).toBe(2500 + 222);
    expect(shippingRefundCents(order())).toBe(800 + 71);
  });

  it("partial refunds of one line add up exactly to the whole line", () => {
    const whole = lineRefundCents(order(), 0, 2);
    expect(lineRefundCents(order(), 0, 1, 0) + lineRefundCents(order(), 0, 1, 1)).toBe(whole);
  });

  it("every line plus shipping is the whole Order", () => {
    const o = order();
    expect(lineRefundCents(o, 0, 2) + lineRefundCents(o, 1, 1) + shippingRefundCents(o)).toBe(orderCents(o).totalCents);
  });

  it("an Order with no tax refunds the bare price; an Order with no subtotal sums its lines", () => {
    expect(lineRefundCents(order({ tax: 0, total: 113 }), 0, 1)).toBe(4000);
    expect(orderCents(order({ subtotal: undefined })).subtotalCents).toBe(10500);
  });
});

describe("planLineRefund", () => {
  it("refunds chosen lines and quantities, Restock chosen per line", () => {
    const p = plan(
      planLineRefund(order(), [], {
        lines: [
          { lineIndex: 0, quantity: 1, restock: true },
          { lineIndex: 1, quantity: 1, restock: false },
        ],
        includeShipping: false,
      })
    );
    expect(p).toEqual({
      kind: "line",
      lines: [
        { lineIndex: 0, quantity: 1, amountCents: 4355, restock: true },
        { lineIndex: 1, quantity: 1, amountCents: 2722, restock: false },
      ],
      shippingCents: 0,
      amountCents: 7077,
    });
  });

  it("never refunds a line beyond its quantity, counting refunds still in flight", () => {
    const ledger = [entry({ status: "pending", lines: [{ lineIndex: 0, quantity: 2, amountCents: 8710, restock: false }], amountCents: 8710 })];
    expect(refundedQuantities(order(), ledger)).toEqual([2, 0]);
    expect(error(planLineRefund(order(), ledger, { lines: [{ lineIndex: 0, quantity: 1, restock: false }], includeShipping: false }))).toBe(
      "Only 0 of Cap left to refund (2 bought)."
    );
  });

  it("a failed refund frees what it reserved", () => {
    const ledger = [entry({ status: "failed", lines: [{ lineIndex: 0, quantity: 2, amountCents: 8710, restock: false }], amountCents: 8710 })];
    expect(planLineRefund(order(), ledger, { lines: [{ lineIndex: 0, quantity: 2, restock: false }], includeShipping: false }).ok).toBe(true);
  });

  it("the second unit of a line is charged its cumulative tax share", () => {
    const ledger = [entry({ lines: [{ lineIndex: 0, quantity: 1, amountCents: 4355, restock: false }], amountCents: 4355 })];
    const p = plan(planLineRefund(order(), ledger, { lines: [{ lineIndex: 0, quantity: 1, restock: false }], includeShipping: false }));
    expect(p.amountCents).toBe(4355);
  });

  it("refuses unknown, repeated or non-whole lines", () => {
    const o = order();
    const ask = (lines: { lineIndex: number; quantity: number; restock: boolean }[]) =>
      error(planLineRefund(o, [], { lines, includeShipping: false }));
    expect(ask([])).toBe("Choose at least one line to refund.");
    expect(ask([{ lineIndex: 5, quantity: 1, restock: false }])).toBe("Line 6 does not exist.");
    expect(ask([{ lineIndex: 0.5, quantity: 1, restock: false }])).toMatch(/does not exist/);
    expect(ask([{ lineIndex: 0, quantity: 0, restock: false }])).toMatch(/at least 1/);
    expect(ask([{ lineIndex: 0, quantity: 1.5, restock: false }])).toMatch(/whole number/);
    expect(ask([{ lineIndex: 0, quantity: Number.NaN, restock: false }])).toMatch(/whole number/);
    expect(
      ask([
        { lineIndex: 0, quantity: 1, restock: false },
        { lineIndex: 0, quantity: 1, restock: false },
      ])
    ).toBe("Line 1 is listed twice.");
  });

  it("refunds shipping, with its tax share, at most once", () => {
    const p = plan(planLineRefund(order(), [], { lines: [], includeShipping: true }));
    expect(p).toMatchObject({ lines: [], shippingCents: 871, amountCents: 871 });
    expect(error(planLineRefund(order(), [entry({ shippingCents: 871, amountCents: 871 })], { lines: [], includeShipping: true }))).toBe(
      "Shipping was already refunded."
    );
    expect(error(planLineRefund(order({ shippingFee: 0 }), [], { lines: [], includeShipping: true }))).toBe(
      "Order had no shipping fee to refund."
    );
  });

  it("refuses Restock on a cancelled Order: the cancellation already handled its units", () => {
    const cancelled = order({ fulfillmentStatus: "unfulfilled", cancelledAt: 1, cancellationReason: "administrator" });
    expect(error(planLineRefund(cancelled, [], { lines: [{ lineIndex: 0, quantity: 1, restock: true }], includeShipping: false }))).toMatch(
      /cancelled/
    );
    expect(planLineRefund(cancelled, [], { lines: [{ lineIndex: 0, quantity: 1, restock: false }], includeShipping: false }).ok).toBe(true);
  });

  it("money goes back only on a settled, undisputed, not fully refunded Stripe payment", () => {
    const ask = (o: RefundableOrder) => error(planLineRefund(o, [], { lines: [{ lineIndex: 0, quantity: 1, restock: false }], includeShipping: false }));
    expect(ask(order({ paymentStatus: "awaiting_payment" }))).toMatch(/not paid/);
    expect(ask(order({ paymentStatus: "refunded" }))).toMatch(/already fully refunded/);
    expect(ask(order({ paymentStatus: "disputed" }))).toMatch(/disputed/);
    expect(ask(order({ stripeSessionId: undefined }))).toMatch(/no Stripe payment/);
    expect(ask(order({ paymentStatus: "partially_refunded", refundedAmount: 5 }))).toBeUndefined();
  });

  it("never asks Stripe for more than is left (rounding, or Dashboard refunds)", () => {
    // $120 refunded in the Stripe Dashboard: only $3.03 is left.
    const p = plan(planLineRefund(order({ paymentStatus: "partially_refunded", refundedAmount: 120 }), [], {
      lines: [{ lineIndex: 0, quantity: 1, restock: false }],
      includeShipping: false,
    }));
    expect(p.amountCents).toBe(303);
    expect(error(planLineRefund(order({ paymentStatus: "partially_refunded", refundedAmount: 123.03 }), [], {
      lines: [{ lineIndex: 0, quantity: 1, restock: false }],
      includeShipping: false,
    }))).toBe("Nothing is left to refund on this order.");
  });
});

describe("remainingRefundableCents", () => {
  it("takes the larger of the ledger and what Stripe reported, ignoring failed refunds", () => {
    expect(remainingRefundableCents(order(), [])).toBe(12303);
    expect(remainingRefundableCents(order(), [entry({ amountCents: 1000 }), entry({ status: "failed", amountCents: 5000 })])).toBe(11303);
    expect(remainingRefundableCents(order({ refundedAmount: 20 }), [entry({ amountCents: 1000 })])).toBe(10303);
  });
});

describe("cancellationReleaseLines", () => {
  it("gives back only units no issued refund already restocked", () => {
    const ledger = [
      entry({ lines: [{ lineIndex: 0, quantity: 1, amountCents: 4355, restock: true }] }),
      // Refunded without Restock: the unit is still out, so the cancellation gives it back.
      entry({ lines: [{ lineIndex: 1, quantity: 1, amountCents: 2722, restock: false }] }),
      // Pending and failed refunds never restocked anything.
      entry({ status: "pending", lines: [{ lineIndex: 0, quantity: 1, amountCents: 4355, restock: true }] }),
      entry({ status: "failed", lines: [{ lineIndex: 1, quantity: 1, amountCents: 2722, restock: true }] }),
    ];
    expect(cancellationReleaseLines(order(), ledger).map((l) => [l.variantId, l.quantity])).toEqual([
      ["cap", 1],
      ["tee", 1],
    ]);
    const allBack = [entry({ lines: [{ lineIndex: 0, quantity: 2, amountCents: 8710, restock: true }] })];
    expect(cancellationReleaseLines(order(), allBack).map((l) => l.variantId)).toEqual(["tee"]);
  });
});

describe("planGoodwillRefund", () => {
  it("is a free amount that never touches a line or Restocks", () => {
    expect(plan(planGoodwillRefund(order(), [], { amountCents: 500, reason: "Late delivery" }))).toEqual({
      kind: "goodwill",
      lines: [],
      shippingCents: 0,
      amountCents: 500,
    });
  });

  it("needs a reason and an amount within what is left", () => {
    expect(error(planGoodwillRefund(order(), [], { amountCents: 500, reason: "  " }))).toMatch(/why/);
    expect(error(planGoodwillRefund(order(), [], { amountCents: 0, reason: "x" }))).toMatch(/at least/);
    expect(error(planGoodwillRefund(order(), [], { amountCents: 1.5, reason: "x" }))).toMatch(/at least/);
    expect(error(planGoodwillRefund(order(), [], { amountCents: 12304, reason: "x" }))).toBe(
      "Goodwill amount exceeds the $123.03 left to refund."
    );
    expect(error(planGoodwillRefund(order({ paymentStatus: "disputed" }), [], { amountCents: 100, reason: "x" }))).toMatch(/disputed/);
  });
});

describe("planFullRefund (cancellation)", () => {
  it("refunds exactly what is left: every unrefunded unit and shipping, with no Restock", () => {
    const p = plan(planFullRefund(order({ fulfillmentStatus: "unfulfilled" }), []));
    expect(p.kind).toBe("cancellation");
    expect(p.amountCents).toBe(12303);
    expect(p.shippingCents).toBe(871);
    expect(p.lines).toEqual([
      { lineIndex: 0, quantity: 2, amountCents: 8710, restock: false },
      { lineIndex: 1, quantity: 1, amountCents: 2722, restock: false },
    ]);
  });

  it("after a line refund, refunds only the rest", () => {
    const ledger = [entry({ lines: [{ lineIndex: 1, quantity: 1, amountCents: 2722, restock: true }], amountCents: 2722 })];
    const p = plan(planFullRefund(order({ paymentStatus: "partially_refunded" }), ledger));
    expect(p.amountCents).toBe(12303 - 2722);
    expect(p.lines.map((l: { lineIndex: number }) => l.lineIndex)).toEqual([0]);
  });
});

describe("Returns", () => {
  const delivered = (deliveredAt: number) => order({ trackingDeliveredAt: deliveredAt });
  const ret = (reason: "unwanted" | "defective" | "wrong_item", restock: boolean, unwornWithTags = true) => ({
    lines: [{ lineIndex: 0, quantity: 1, restock }],
    reason,
    unwornWithTags,
  });

  it("the window is 30 days from delivery, or from the label date + 7 days without a delivered scan", () => {
    expect(returnWindowClosesAt(delivered(1000))).toBe(1000 + 30 * DAY);
    const labelled = order({ fulfillmentStatus: "in_transit", labels: [{ carrier: "USPS", trackingNumber: "94", labelUrl: "u", purchasedAt: 5000, reship: false }] });
    expect(returnWindowClosesAt(labelled)).toBe(5000 + 37 * DAY);
    expect(returnWindowClosesAt(order({ fulfillmentStatus: "unfulfilled" }))).toBeUndefined();
  });

  it("refunds the returned lines inside the window and never the original shipping", () => {
    const p = plan(planReturn(delivered(0), [], ret("unwanted", true), 29 * DAY));
    expect(p).toMatchObject({ kind: "return", shippingCents: 0, amountCents: 4355 });
    expect(p.lines[0].restock).toBe(true);
  });

  it("is refused once the window closed", () => {
    expect(error(planReturn(delivered(0), [], ret("unwanted", false), 31 * DAY))).toBe("The 30-day Return window closed on Jan 30, 1970.");
  });

  it("a change of mind needs the items unworn with tags", () => {
    expect(error(planReturn(delivered(0), [], ret("unwanted", false, false), DAY))).toBe("A Return needs the items unworn with tags.");
  });

  it("a defective item is never restocked; a wrong item may be", () => {
    expect(error(planReturn(delivered(0), [], ret("defective", true, false), DAY))).toMatch(/never restocked/);
    expect(planReturn(delivered(0), [], ret("defective", false, false), DAY).ok).toBe(true);
    expect(planReturn(delivered(0), [], ret("wrong_item", true), DAY).ok).toBe(true);
  });

  it("an Order that never shipped, or that the carrier could not deliver, is not a Return", () => {
    expect(error(planReturn(order({ fulfillmentStatus: "unfulfilled" }), [], ret("unwanted", false), 0))).toMatch(/never shipped/);
    for (const fulfillmentStatus of ["returned", "delivery_exception"] as const) {
      expect(error(planReturn(order({ fulfillmentStatus }), [], ret("unwanted", false), 0))).toMatch(/Reship or refund/);
    }
  });

  it("the Customer pays return shipping unless the item is defective or wrong", () => {
    expect(customerPaysReturnShipping("unwanted")).toBe(true);
    expect(customerPaysReturnShipping("defective")).toBe(false);
    expect(customerPaysReturnShipping("wrong_item")).toBe(false);
  });
});

describe("Stripe", () => {
  it("one request always sends the same idempotency key", () => {
    expect(refundIdempotencyKey("ord1", "req1")).toBe(refundIdempotencyKey("ord1", "req1"));
    expect(refundIdempotencyKey("ord1", "req1")).not.toBe(refundIdempotencyKey("ord1", "req2"));
    expect(cancellationRequestId("ord1")).toBe("cancel-ord1");
  });

  it("only errors Stripe raises before refunding fail a refund; the rest are retried", () => {
    expect(refundErrorOutcome("StripeInvalidRequestError")).toBe("failed");
    expect(refundErrorOutcome("StripeCardError")).toBe("failed");
    expect(refundErrorOutcome("StripeConnectionError")).toBe("retry");
    expect(refundErrorOutcome("StripeAPIError")).toBe("retry");
    expect(refundErrorOutcome(undefined)).toBe("retry");
  });

  it("describes a refund for the audit log", () => {
    expect(
      describeRefund(order(), {
        kind: "line",
        lines: [{ lineIndex: 0, quantity: 2, amountCents: 8710, restock: true }],
        shippingCents: 871,
        amountCents: 9581,
      })
    ).toBe("line refund $95.81: 2× Cap (restock), shipping");
  });
});
