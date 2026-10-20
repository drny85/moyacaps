import { describe, expect, it } from "vitest";
import { buildRefundRequest, dollarsToCents, emptyDraft, lineRequests, restockSummary } from "./refundForm";

describe("refund form", () => {
  it("sends only the lines with a quantity, keeping each line's Restock choice", () => {
    const draft = emptyDraft(3);
    draft.lines[0] = { quantity: 1, restock: true };
    draft.lines[2] = { quantity: 2, restock: false };
    expect(lineRequests(draft)).toEqual([
      { lineIndex: 0, quantity: 1, restock: true },
      { lineIndex: 2, quantity: 2, restock: false },
    ]);
    expect(restockSummary(draft, ["Cap", "Tee", "Hoodie"])).toEqual(["1× Cap"]);
  });

  it("builds the request for each refund kind", () => {
    const draft = { ...emptyDraft(1), includeShipping: true, goodwillDollars: "12.50", note: "Late" };
    draft.lines[0] = { quantity: 1, restock: false };
    expect(buildRefundRequest("line", draft)).toEqual({
      kind: "line",
      lines: [{ lineIndex: 0, quantity: 1, restock: false }],
      includeShipping: true,
    });
    expect(buildRefundRequest("return", { ...draft, returnReason: "defective", unwornWithTags: false })).toEqual({
      kind: "return",
      lines: [{ lineIndex: 0, quantity: 1, restock: false }],
      reason: "defective",
      unwornWithTags: false,
    });
    expect(buildRefundRequest("goodwill", draft)).toEqual({ kind: "goodwill", amountCents: 1250, reason: "Late" });
  });

  it("reads a dollar amount as cents, refusing anything that is not a positive amount", () => {
    expect(dollarsToCents("10")).toBe(1000);
    expect(dollarsToCents(" 0.015 ")).toBe(2);
    expect(dollarsToCents("")).toBe(0);
    expect(dollarsToCents("-5")).toBe(0);
    expect(dollarsToCents("abc")).toBe(0);
  });
});
