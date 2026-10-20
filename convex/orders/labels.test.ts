import { describe, expect, it } from "vitest";
import { appendLabel, labelHistory, latestLabelPurchasedAt, MAX_LABELS, type ShippingLabel } from "./labels";

const label = (n: number, extra: Partial<ShippingLabel> = {}): ShippingLabel => ({
  carrier: "USPS",
  trackingNumber: `9400${n}`,
  labelUrl: `https://labels.example/${n}.pdf`,
  purchasedAt: n,
  reship: false,
  ...extra,
});

describe("label history", () => {
  it("an Order with no label has no history", () => {
    expect(labelHistory({})).toEqual([]);
    // A legacy placeholder number is not a label.
    expect(labelHistory({ trackingNumber: "GL-TRK-123456" })).toEqual([]);
    expect(latestLabelPurchasedAt({})).toBeUndefined();
  });

  it("an Order labelled before the history existed reads its one label from the flat fields", () => {
    expect(
      labelHistory({
        shippingLabelUrl: "https://l/1.pdf",
        trackingNumber: "9400LEGACY",
        shippingCarrier: "UPS",
        shippingTransactionId: "tx_1",
        shippingCost: 5.85,
        updatedAt: 500,
        createdAt: 100,
      })
    ).toEqual([
      {
        carrier: "UPS",
        trackingNumber: "9400LEGACY",
        labelUrl: "https://l/1.pdf",
        transactionId: "tx_1",
        cost: 5.85,
        purchasedAt: 500,
        reship: false,
      },
    ]);
  });

  it("a Reship keeps every earlier label, the latest last", () => {
    const first = label(1);
    const legacy = { shippingLabelUrl: first.labelUrl, trackingNumber: first.trackingNumber, carrier: "USPS", updatedAt: 1 };
    const afterReship = appendLabel(legacy, label(2, { reship: true }));
    expect(afterReship.map((l) => [l.trackingNumber, l.reship])).toEqual([
      ["94001", false],
      ["94002", true],
    ]);
    expect(latestLabelPurchasedAt({ labels: afterReship })).toBe(2);
  });

  it("keeps at most the most recent labels", () => {
    let labels: ShippingLabel[] = [];
    for (let n = 1; n <= MAX_LABELS + 3; n++) labels = appendLabel({ labels }, label(n));
    expect(labels).toHaveLength(MAX_LABELS);
    expect(labels[0].purchasedAt).toBe(4);
    expect(labels[labels.length - 1].purchasedAt).toBe(MAX_LABELS + 3);
  });
});
