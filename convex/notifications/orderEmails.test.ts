import { describe, expect, it } from "vitest";
import {
  cancellationNotice,
  careGuide,
  customerCancellationAlert,
  deliveredCopy,
  dispatchedCopy,
  dispatchedIdempotencyKey,
  manualMoveEmail,
  moneyTakenAlert,
  receiptCopy,
  refundIssuedNotice,
  refundProblemAlert,
  unlinkedDisputeAlert,
} from "./orderEmails";

describe("dispatched and delivered copy", () => {
  it("never says the package was handed to the carrier when only a label was bought", () => {
    const copy = dispatchedCopy("label_purchased", "GL-1", "USPS");
    expect(`${copy.subject} ${copy.body}`).not.toMatch(/handed|dispatched|shipped/i);
    expect(copy.subject).toContain("ready to ship");
    expect(copy.body).toContain("USPS shipping label");
    expect(dispatchedCopy("in_transit", "GL-1", "USPS").subject).toBe("Your Good Luck order #GL-1 has shipped");
  });

  it("subjects name the order, never a product type, and never 0880", () => {
    const subjects = [
      dispatchedCopy("label_purchased", "GL-1").subject,
      dispatchedCopy("in_transit", "GL-1").subject,
      deliveredCopy("GL-1").subject,
    ];
    for (const subject of subjects) {
      expect(subject).toContain("Good Luck order #GL-1");
      expect(subject).not.toMatch(/\bCap\b|0880|Piece/);
    }
  });

  it("the label and shipped emails keep separate idempotency keys", () => {
    expect(dispatchedIdempotencyKey("label_purchased", "GL-1", "9400")).toBe("customer-dispatched-GL-1-9400");
    expect(dispatchedIdempotencyKey("in_transit", "GL-1", "9400")).toBe("customer-shipped-GL-1-9400");
    expect(dispatchedIdempotencyKey("in_transit", "GL-1")).toBe("customer-shipped-GL-1-manual");
  });

  it("the care guide follows the package: caps, tees, or both", () => {
    const titles = (items: { size?: string }[]) => careGuide(items).map((tip) => tip.title).join(" | ");
    expect(titles([{}])).toMatch(/Caps/);
    expect(titles([{}])).not.toMatch(/Tees/);
    expect(titles([{ size: "M" }])).toMatch(/Tees/);
    expect(titles([{ size: "M" }])).not.toMatch(/Caps/);
    expect(titles([{}, { size: "L" }])).toMatch(/Caps.*Tees/);
  });
});

describe("manual desk moves", () => {
  it("send the shipped email into in transit and the delivered email into delivered", () => {
    expect(manualMoveEmail("unfulfilled", "in_transit")).toBe("dispatched");
    expect(manualMoveEmail("label_purchased", "in_transit")).toBe("dispatched");
    expect(manualMoveEmail("in_transit", "delivered")).toBe("delivered");
    expect(manualMoveEmail("unfulfilled", "delivered")).toBe("delivered");
  });

  it("send nothing for a revert or any other move", () => {
    expect(manualMoveEmail("delivered", "in_transit")).toBeNull();
    expect(manualMoveEmail("delivery_exception", "in_transit")).toBeNull();
    expect(manualMoveEmail("in_transit", "label_purchased")).toBeNull();
    expect(manualMoveEmail("in_transit", "delivery_exception")).toBeNull();
  });
});

describe("receipt", () => {
  it("an out-of-territory order is told it will be refunded, not that it is being prepared", () => {
    const normal = receiptCopy("GL-1", false);
    expect(normal.body).toMatch(/preparing/);
    const flagged = receiptCopy("GL-1", true);
    expect(flagged.body).not.toMatch(/preparing/);
    expect(flagged.body).toMatch(/refund it in full/);
    expect(flagged.subject).toContain("#GL-1");
  });
});

describe("Customer notices", () => {
  it("a cancellation states the refund it started, or that the team will follow up", () => {
    const customer = cancellationNotice({ orderNumber: "GL-1", by: "customer", refundCents: 11768 });
    expect(customer.idempotencyKey).toBe("order-cancelled-GL-1");
    expect(customer.paragraphs.join(" ")).toMatch(/You cancelled order #GL-1/);
    expect(customer.paragraphs.join(" ")).toMatch(/full refund of \$117\.68/);
    const admin = cancellationNotice({ orderNumber: "GL-1", by: "administrator", refundCents: null });
    expect(admin.paragraphs.join(" ")).toMatch(/We cancelled order #GL-1/);
    expect(admin.paragraphs.join(" ")).toMatch(/follow up about your refund/);
  });

  it("a refund notice covers line, return and goodwill refunds, keyed by the refund id", () => {
    for (const kind of ["line", "return", "goodwill"] as const) {
      const notice = refundIssuedNotice({ orderNumber: "GL-1", refundId: "r1", kind, amountCents: 1000 });
      expect(notice?.idempotencyKey).toBe("refund-r1");
      expect(notice?.subject).toContain("$10.00");
    }
    expect(refundIssuedNotice({ orderNumber: "GL-1", refundId: "r1", kind: "cancellation", amountCents: 1000 })).toBeNull();
  });
});

describe("Administrator alerts", () => {
  it("each alert links its order and dedupes on a stable key", () => {
    expect(customerCancellationAlert({ orderNumber: "GL-1", refundCents: 500, stockReleased: true })).toMatchObject({
      orderNumber: "GL-1",
      idempotencyKey: "customer-cancellation-GL-1",
    });
    const failed = refundProblemAlert({
      orderNumber: "GL-1",
      refundId: "r1",
      kind: "line",
      amountCents: 500,
      problem: "failed",
      error: "card_declined",
    });
    expect(failed.idempotencyKey).toBe("refund-failed-r1");
    expect(failed.facts).toContainEqual({ label: "Error", value: "card_declined" });
    expect(
      refundProblemAlert({ orderNumber: "GL-1", refundId: "r1", kind: "line", amountCents: 500, problem: "pending" }).idempotencyKey
    ).toBe("refund-pending-r1");
    expect(
      moneyTakenAlert({ kind: "double_settlement", orderNumber: "GL-1", stripeSessionId: "cs_2", total: 10, currency: "usd" })
    ).toMatchObject({ idempotencyKey: "money-double_settlement-cs_2", badge: "DOUBLE PAYMENT" });
    expect(moneyTakenAlert({ kind: "cancelled", orderNumber: "GL-1", stripeSessionId: "cs_2", total: 10, currency: "USD" }).subject).toMatch(
      /Cancelled Order/
    );
  });

  it("an unlinked dispute has no order to link and names the dispute", () => {
    const alert = unlinkedDisputeAlert({ disputeId: "dp_1", status: "needs_response", amount: 25, currency: "usd" });
    expect(alert.orderNumber).toBeUndefined();
    expect(alert.subject).toContain("dp_1");
    expect(alert.idempotencyKey).toBe("dispute-unlinked-dp_1-needs_response");
  });
});
