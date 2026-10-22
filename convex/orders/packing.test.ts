import { describe, expect, it } from "vitest";
import { packingView, planCheck, type PackingOrder } from "./packing";
import type { ShippingLabel } from "./labels";

const T0 = Date.UTC(2026, 9, 22, 12);

const label = (over: Partial<ShippingLabel> = {}): ShippingLabel => ({
  carrier: "USPS",
  trackingNumber: "9400111899223344556677",
  labelUrl: "https://label.pdf",
  purchasedAt: T0,
  reship: false,
  ...over,
});

const order = (over: Partial<PackingOrder> = {}): PackingOrder => ({
  paymentStatus: "paid",
  fulfillmentStatus: "unfulfilled",
  items: [{ quantity: 1 }, { quantity: 3 }],
  ...over,
});

describe("Packing Checklist view", () => {
  it("a Needs Packing Order starts with every unit to check", () => {
    expect(packingView(order(), [0, 0])).toEqual({
      editable: true,
      lines: [
        { remaining: 1, checked: 0, overflow: 0 },
        { remaining: 3, checked: 0, overflow: 0 },
      ],
      checkedUnits: 0,
      totalUnits: 4,
      uncheckedUnits: 4,
      complete: false,
    });
  });

  it("refunded units are off the list; a fully refunded line has nothing left", () => {
    const view = packingView(order(), [1, 1]);
    expect(view.lines.map((l) => l.remaining)).toEqual([0, 2]);
    expect(view.totalUnits).toBe(2);
  });

  it("shows the Checked units of the checklist for the next label, and is complete when all are Checked", () => {
    const half = packingView(order({ packingChecklist: { forLabel: 0, checked: [1, 1] } }), [0, 0]);
    expect(half).toMatchObject({ checkedUnits: 2, uncheckedUnits: 2, complete: false });

    const full = packingView(order({ packingChecklist: { forLabel: 0, checked: [1, 3] } }), [0, 0]);
    expect(full).toMatchObject({ checkedUnits: 4, uncheckedUnits: 0, complete: true });
  });

  it("a unit refunded after it was Checked shows as one to take out, and the list is not complete", () => {
    const view = packingView(order({ packingChecklist: { forLabel: 0, checked: [1, 3] } }), [0, 1]);
    expect(view.lines[1]).toEqual({ remaining: 2, checked: 3, overflow: 1 });
    expect(view).toMatchObject({ checkedUnits: 3, uncheckedUnits: 0, complete: false });
  });

  it("once a label is bought the list is read-only and keeps what was Checked", () => {
    const labelled = order({
      fulfillmentStatus: "label_purchased",
      labels: [label()],
      packingChecklist: { forLabel: 0, checked: [1, 2] },
    });
    expect(packingView(labelled, [0, 0])).toMatchObject({ editable: false, checkedUnits: 3 });
  });

  it("a Reship starts a fresh list; the first box's ticks do not carry over", () => {
    const bounced = order({
      fulfillmentStatus: "delivery_exception",
      labels: [label()],
      packingChecklist: { forLabel: 0, checked: [1, 3] },
    });
    expect(packingView(bounced, [0, 0])).toMatchObject({ editable: true, checkedUnits: 0, uncheckedUnits: 4 });
  });

  it("a cancelled or fully refunded Order has nothing to tick", () => {
    expect(packingView(order({ cancelledAt: T0 }), [0, 0]).editable).toBe(false);
    expect(packingView(order({ paymentStatus: "refunded" }), [1, 3]).editable).toBe(false);
  });
});

describe("Checking a unit", () => {
  it("a tap Checks one unit on the checklist for the next label", () => {
    const plan = planCheck(order(), [0, 0], 1, 1, T0);
    expect(plan).toEqual({ ok: true, checklist: { forLabel: 0, checked: [0, 1] }, completed: false });
  });

  it("cannot Check more units than the line still has, nor undo below zero", () => {
    const full = order({ packingChecklist: { forLabel: 0, checked: [1, 0] } });
    expect(planCheck(full, [0, 0], 0, 1, T0)).toMatchObject({ ok: false });
    expect(planCheck(order(), [0, 0], 0, -1, T0)).toMatchObject({ ok: false });
    expect(planCheck(order(), [1, 0], 0, 1, T0)).toMatchObject({ ok: false });
  });

  it("an extra Checked unit after a refund can be undone", () => {
    const over = order({ packingChecklist: { forLabel: 0, checked: [0, 3] } });
    expect(planCheck(over, [0, 1], 1, -1, T0)).toMatchObject({ ok: true, checklist: { checked: [0, 2] } });
  });

  it("rejects a line the Order does not have", () => {
    expect(planCheck(order(), [0, 0], 2, 1, T0)).toMatchObject({ ok: false });
    expect(planCheck(order(), [0, 0], -1, 1, T0)).toMatchObject({ ok: false });
  });

  it("is locked once the label is bought", () => {
    const labelled = order({ fulfillmentStatus: "label_purchased", labels: [label()] });
    expect(planCheck(labelled, [0, 0], 0, 1, T0)).toMatchObject({ ok: false });
  });

  it("a Reship's first tick starts a fresh checklist for the new label", () => {
    const bounced = order({
      fulfillmentStatus: "returned",
      labels: [label()],
      packingChecklist: { forLabel: 0, checked: [1, 3], completedAt: T0 - 1 },
    });
    expect(planCheck(bounced, [0, 0], 0, 1, T0)).toEqual({ ok: true, checklist: { forLabel: 1, checked: [1, 0] }, completed: false });
  });

  it("the last unit completes the list once; undoing and re-checking does not complete it again", () => {
    const almost = order({ packingChecklist: { forLabel: 0, checked: [1, 2] } });
    const done = planCheck(almost, [0, 0], 1, 1, T0);
    expect(done).toEqual({ ok: true, checklist: { forLabel: 0, checked: [1, 3], completedAt: T0 }, completed: true });

    const reopened = order({ packingChecklist: { forLabel: 0, checked: [1, 2], completedAt: T0 } });
    expect(planCheck(reopened, [0, 0], 1, 1, T0 + 1)).toMatchObject({ ok: true, completed: false, checklist: { completedAt: T0 } });
  });
});
