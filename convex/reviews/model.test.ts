import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import {
  CARD_RATING_MIN_COUNT,
  REVIEW_INVITE_DELAY_MS,
  cardRating,
  normalizeReviewInput,
  reviewableLines,
  reviewerDisplayName,
  statsDelta,
  type ReviewStatus,
} from "./model";

describe("constants", () => {
  it("match the plan", () => {
    expect(CARD_RATING_MIN_COUNT).toBe(3);
    expect(REVIEW_INVITE_DELAY_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("normalizeReviewInput", () => {
  it("rejects ratings outside 1-5 and non-integers", () => {
    for (const rating of [0, 6, 4.5]) {
      expect(() => normalizeReviewInput({ rating })).toThrow(ConvexError);
    }
  });

  it("trims title and body", () => {
    expect(normalizeReviewInput({ rating: 5, title: "  Great  ", body: " Nice cap\n" })).toEqual({
      rating: 5,
      title: "Great",
      body: "Nice cap",
    });
  });

  it("turns blank fields into undefined", () => {
    const out = normalizeReviewInput({ rating: 3, title: "   ", body: "" });
    expect(out.title).toBeUndefined();
    expect(out.body).toBeUndefined();
  });

  it("enforces max lengths after trim", () => {
    expect(() => normalizeReviewInput({ rating: 5, title: "a".repeat(81) })).toThrow(ConvexError);
    expect(normalizeReviewInput({ rating: 5, title: ` ${"a".repeat(80)} ` }).title).toHaveLength(80);
    expect(() => normalizeReviewInput({ rating: 5, body: "a".repeat(2001) })).toThrow(ConvexError);
  });

  it("keeps markup verbatim", () => {
    expect(normalizeReviewInput({ rating: 5, title: "<script>" }).title).toBe("<script>");
  });
});

type OrderArg = Parameters<typeof reviewableLines>[0];
type RefundArg = Parameters<typeof reviewableLines>[1][number];

const item = (variantId: string, quantity: number, extra: Record<string, string> = {}) => ({
  variantId,
  name: "Cap",
  quantity,
  price: 3000,
  image: "x",
  ...extra,
});
const order = (over: Partial<OrderArg> = {}, items = [item("v1", 1)]): OrderArg =>
  ({ items, fulfillmentStatus: "delivered", cancelledAt: undefined, ...over }) as unknown as OrderArg;
const refund = (status: string, lineIndex: number, quantity: number): RefundArg =>
  ({ status, lines: [{ lineIndex, quantity, amountCents: 100, restock: false }] }) as unknown as RefundArg;

describe("reviewableLines", () => {
  it("returns a delivered line with its index and options", () => {
    const o = order({}, [item("v0", 1), item("v1", 1, { colorway: "Black", size: "M" })]);
    expect(reviewableLines(o, [], "v1")).toEqual([{ lineIndex: 1, colorway: "Black", size: "M" }]);
  });

  it("returns nothing before delivery", () => {
    expect(reviewableLines(order({ fulfillmentStatus: "in_transit" }), [], "v1")).toEqual([]);
  });

  it("returns nothing for a cancelled order", () => {
    expect(reviewableLines(order({ cancelledAt: 1 }), [], "v1")).toEqual([]);
  });

  it("keeps a qty-2 line refunded 1", () => {
    const o = order({}, [item("v1", 2)]);
    expect(reviewableLines(o, [refund("issued", 0, 1)], "v1")).toHaveLength(1);
  });

  it("excludes a qty-1 line refunded 1, pending counts too", () => {
    expect(reviewableLines(order(), [refund("issued", 0, 1)], "v1")).toEqual([]);
    expect(reviewableLines(order(), [refund("pending", 0, 1)], "v1")).toEqual([]);
  });

  it("sums refunds across records", () => {
    const o = order({}, [item("v1", 2)]);
    expect(reviewableLines(o, [refund("issued", 0, 1), refund("issued", 0, 1)], "v1")).toEqual([]);
  });

  it("ignores failed refunds", () => {
    expect(reviewableLines(order(), [refund("failed", 0, 1)], "v1")).toHaveLength(1);
  });

  it("excludes other variants", () => {
    expect(reviewableLines(order(), [], "v2")).toEqual([]);
  });
});

describe("reviewerDisplayName", () => {
  it("abbreviates the last name", () => {
    expect(reviewerDisplayName("Robert Melendez")).toBe("Robert M.");
  });
  it("keeps a single name", () => {
    expect(reviewerDisplayName("Cher")).toBe("Cher");
  });
  it("falls back to Verified Buyer", () => {
    expect(reviewerDisplayName(undefined)).toBe("Verified Buyer");
    expect(reviewerDisplayName("   ")).toBe("Verified Buyer");
  });
});

describe("statsDelta", () => {
  const r = (status: ReviewStatus, rating: number, hidden = false) => ({ status, rating, hidden });
  it("adds a new published review", () => {
    expect(statsDelta(null, r("published", 5))).toEqual({ count: 1, ratingSum: 5 });
  });
  it("removes when it leaves published", () => {
    expect(statsDelta(r("published", 5), r("pending", 4))).toEqual({ count: -1, ratingSum: -5 });
  });
  it("adjusts the sum on a rating change", () => {
    expect(statsDelta(r("published", 5), r("published", 3))).toEqual({ count: 0, ratingSum: -2 });
  });
  it("removes when hidden", () => {
    expect(statsDelta(r("published", 4), r("published", 4, true))).toEqual({ count: -1, ratingSum: -4 });
  });
  it("ignores uncounted reviews", () => {
    expect(statsDelta(r("rejected", 2), null)).toEqual({ count: 0, ratingSum: 0 });
  });
});

describe("cardRating", () => {
  it("hides below the minimum", () => {
    expect(cardRating({ count: 2, ratingSum: 10 })).toBeNull();
  });
  it("rounds to one decimal at the minimum", () => {
    expect(cardRating({ count: 3, ratingSum: 14 })).toEqual({ average: 4.7, count: 3 });
  });
});
