import { describe, expect, it } from "vitest";
import {
  decideRefundFailure,
  refundFailureFromEvent,
  restockedUnits,
  type FailingRefundRow,
  type StripeRefundFailure,
} from "./refundFailureModel";

const refund = (extra: Partial<{ status: string | null; failure_reason: string; metadata: Record<string, string> | null }> = {}) => ({
  id: "re_1",
  status: "failed" as string | null,
  metadata: { refundId: "ledger_1" } as Record<string, string> | null,
  ...extra,
});

const row = (extra: Partial<FailingRefundRow> = {}): FailingRefundRow => ({
  kind: "line",
  status: "issued",
  lines: [
    { lineIndex: 0, quantity: 2, amountCents: 8000, restock: true },
    { lineIndex: 1, quantity: 1, amountCents: 2500, restock: false },
  ],
  amountCents: 10500,
  stripeRefundId: "re_1",
  ...extra,
});

const failure: StripeRefundFailure = {
  stripeRefundId: "re_1",
  ledgerRefundId: "ledger_1",
  stripeStatus: "failed",
  failureReason: "expired_or_canceled_card",
};

describe("refundFailureFromEvent", () => {
  it("reads a refund.failed event, with the ledger id from metadata and Stripe's reason", () => {
    expect(refundFailureFromEvent("refund.failed", refund({ failure_reason: "lost_or_stolen_card" }))).toEqual({
      stripeRefundId: "re_1",
      ledgerRefundId: "ledger_1",
      stripeStatus: "failed",
      failureReason: "lost_or_stolen_card",
    });
  });

  it("reads a refund.updated event only when the refund failed or was canceled", () => {
    expect(refundFailureFromEvent("refund.updated", refund({ status: "canceled", metadata: null }))).toEqual({
      stripeRefundId: "re_1",
      stripeStatus: "canceled",
    });
    expect(refundFailureFromEvent("refund.updated", refund({ status: "failed" }))?.stripeStatus).toBe("failed");
    expect(refundFailureFromEvent("refund.updated", refund({ status: "succeeded" }))).toBeNull();
    expect(refundFailureFromEvent("refund.updated", refund({ status: "pending" }))).toBeNull();
    expect(refundFailureFromEvent("refund.updated", refund({ status: null }))).toBeNull();
  });

  it("ignores other event types", () => {
    expect(refundFailureFromEvent("refund.created", refund())).toBeNull();
    expect(refundFailureFromEvent("charge.refunded", refund())).toBeNull();
  });
});

describe("restockedUnits", () => {
  it("counts the units on lines marked for Restock once the refund was issued", () => {
    expect(restockedUnits(row())).toBe(2);
  });

  it("is zero while the refund is still pending (Restock happens only on issue)", () => {
    expect(restockedUnits(row({ status: "pending" }))).toBe(0);
  });
});

describe("decideRefundFailure", () => {
  it("fails an issued refund, leaves its Restock in place, and asks the Administrator to check stock", () => {
    const decision = decideRefundFailure({ row: row(), failure, eventAlreadyRecorded: false });
    expect(decision).toEqual({
      action: "fail",
      error: "Stripe failed the refund after accepting it: expired_or_canceled_card",
      restockedUnits: 2,
      details: "line refund $105.00 (Stripe re_1) failed: expired_or_canceled_card; 2 restocked unit(s) left in stock",
      note: expect.stringContaining("⚠️ REFUND FAILED: line refund $105.00 (Stripe re_1) — expired_or_canceled_card."),
    });
    expect(decision.action === "fail" && decision.note).toContain(
      "2 unit(s) were restocked when it was issued and stay in stock: check stock before refunding them again."
    );
  });

  it("has no stock advice when nothing was restocked", () => {
    const decision = decideRefundFailure({
      row: row({ kind: "goodwill", lines: [], amountCents: 1500 }),
      failure: { stripeRefundId: "re_1", stripeStatus: "canceled" },
      eventAlreadyRecorded: false,
    });
    expect(decision).toMatchObject({
      action: "fail",
      error: "Stripe canceled the refund after accepting it: canceled",
      restockedUnits: 0,
      details: "goodwill refund $15.00 (Stripe re_1) canceled: canceled",
    });
    expect(decision.action === "fail" && decision.note).not.toContain("check stock");
  });

  it("fails a refund still pending (Stripe failed it before the issue was recorded) without stock advice", () => {
    const decision = decideRefundFailure({ row: row({ status: "pending" }), failure, eventAlreadyRecorded: false });
    expect(decision).toMatchObject({ action: "fail", restockedUnits: 0 });
  });

  it("says why when Stripe gives no reason", () => {
    const decision = decideRefundFailure({
      row: row(),
      failure: { stripeRefundId: "re_1", stripeStatus: "failed" },
      eventAlreadyRecorded: false,
    });
    expect(decision.action === "fail" && decision.error).toBe("Stripe failed the refund after accepting it: no reason given");
  });

  it("is replay-safe on the event id", () => {
    expect(decideRefundFailure({ row: row(), failure, eventAlreadyRecorded: true })).toEqual({
      action: "ignore",
      reason: "replayed",
    });
  });

  it("does nothing for a refund already failed by another event", () => {
    expect(decideRefundFailure({ row: row({ status: "failed" }), failure, eventAlreadyRecorded: false })).toEqual({
      action: "ignore",
      reason: "already_failed",
    });
  });

  it("ignores a refund that is not in the ledger (made in the Stripe Dashboard)", () => {
    expect(decideRefundFailure({ row: null, failure, eventAlreadyRecorded: false })).toEqual({
      action: "ignore",
      reason: "unknown_refund",
    });
  });
});
