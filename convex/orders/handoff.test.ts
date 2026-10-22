import { describe, expect, it } from "vitest";
import {
  NOT_HANDED_OFF_AFTER_MS,
  NO_SCAN_AFTER_MS,
  claimShippedNotice,
  currentHandoff,
  handoffFlag,
  hasShipped,
  isHandedOff,
  planClearHandoff,
  planHandoff,
  type HandoffOrder,
} from "./handoff";
import type { ShippingLabel } from "./labels";

const T0 = Date.UTC(2026, 9, 22, 12);
const HOUR = 60 * 60 * 1000;

const label = (over: Partial<ShippingLabel> = {}): ShippingLabel => ({
  carrier: "USPS",
  trackingNumber: "9400111899223344556677",
  labelUrl: "https://label.pdf",
  purchasedAt: T0,
  reship: false,
  ...over,
});

const order = (over: Partial<HandoffOrder> = {}): HandoffOrder => ({
  paymentStatus: "paid",
  fulfillmentStatus: "label_purchased",
  labels: [label()],
  ...over,
});

const input = { method: "dropped_off" as const, at: T0 + 2 * HOUR, actor: "user_admin" };

describe("planHandoff", () => {
  it("records a Handoff on the current label and asks to tell the Customer once", () => {
    const plan = planHandoff(order(), { ...input, note: "  Post office on 5th  " }, T0 + 3 * HOUR);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.correction).toBe(false);
    expect(plan.notifyShipped).toBe(true);
    expect(plan.labels[0].handoff).toEqual({
      method: "dropped_off",
      at: T0 + 2 * HOUR,
      note: "Post office on 5th",
      recordedAt: T0 + 3 * HOUR,
      actor: "user_admin",
    });
    expect(plan.labels[0].shippedNoticeAt).toBe(T0 + 3 * HOUR);
  });

  it("corrects an existing Handoff without telling the Customer again", () => {
    const first = planHandoff(order(), input, T0 + 3 * HOUR);
    if (!first.ok) throw new Error(first.error);
    const plan = planHandoff(order({ labels: first.labels }), { ...input, method: "picked_up" }, T0 + 4 * HOUR);
    expect(plan.ok && plan.correction).toBe(true);
    expect(plan.ok && plan.notifyShipped).toBe(false);
    expect(plan.ok && plan.labels[0].handoff?.method).toBe("picked_up");
  });

  it("only touches the current label of a Reship", () => {
    const old = label({ trackingNumber: "OLD", purchasedAt: T0 - 48 * HOUR });
    const plan = planHandoff(order({ labels: [old, label({ reship: true })] }), input, T0 + 3 * HOUR);
    expect(plan.ok && plan.labels[0]).toEqual(old);
    expect(plan.ok && plan.labels[1].handoff?.method).toBe("dropped_off");
  });

  it("refuses once the carrier scanned it, or when cancelled, fully refunded or unlabelled", () => {
    expect(planHandoff(order({ fulfillmentStatus: "in_transit" }), input, T0 + 3 * HOUR).ok).toBe(false);
    expect(planHandoff(order({ cancelledAt: T0 }), input, T0 + 3 * HOUR).ok).toBe(false);
    expect(planHandoff(order({ paymentStatus: "refunded" }), input, T0 + 3 * HOUR).ok).toBe(false);
    expect(planHandoff(order({ paymentStatus: "partially_refunded" }), input, T0 + 3 * HOUR).ok).toBe(true);
    expect(planHandoff(order({ fulfillmentStatus: "unfulfilled", labels: [] }), input, T0 + 3 * HOUR).ok).toBe(false);
  });

  it("refuses a time in the future or before the label was bought", () => {
    expect(planHandoff(order(), { ...input, at: T0 + 5 * HOUR }, T0 + 3 * HOUR).ok).toBe(false);
    expect(planHandoff(order(), { ...input, at: T0 - HOUR }, T0 + 3 * HOUR).ok).toBe(false);
    expect(planHandoff(order(), { ...input, at: NaN }, T0 + 3 * HOUR).ok).toBe(false);
  });

  it("works on an Order labelled before the label history existed", () => {
    const legacy = order({ labels: undefined, shippingLabelUrl: "https://l.pdf", trackingNumber: "9400111899223344556677", updatedAt: T0 });
    const plan = planHandoff(legacy, input, T0 + 3 * HOUR);
    expect(plan.ok && plan.labels).toHaveLength(1);
  });
});

describe("planClearHandoff", () => {
  it("removes a Handoff while Ready to Ship, keeping the shipped notice", () => {
    const first = planHandoff(order(), input, T0 + 3 * HOUR);
    if (!first.ok) throw new Error(first.error);
    const plan = planClearHandoff(order({ labels: first.labels }));
    expect(plan.ok && plan.labels[0].handoff).toBeUndefined();
    expect(plan.ok && plan.labels[0].shippedNoticeAt).toBe(T0 + 3 * HOUR);
  });

  it("refuses with no Handoff or after a scan", () => {
    expect(planClearHandoff(order()).ok).toBe(false);
    const first = planHandoff(order(), input, T0 + 3 * HOUR);
    if (!first.ok) throw new Error(first.error);
    expect(planClearHandoff(order({ labels: first.labels, fulfillmentStatus: "in_transit" })).ok).toBe(false);
  });
});

describe("hasShipped", () => {
  it("is true after a Handoff or any carrier scan", () => {
    expect(hasShipped(order({ fulfillmentStatus: "unfulfilled", labels: [] }))).toBe(false);
    expect(hasShipped(order())).toBe(false);
    expect(hasShipped(order({ labels: [label({ handoff: { method: "picked_up", at: T0, recordedAt: T0, actor: "a" } })] }))).toBe(true);
    expect(hasShipped(order({ fulfillmentStatus: "in_transit" }))).toBe(true);
    expect(hasShipped(order({ fulfillmentStatus: "delivered" }))).toBe(true);
  });
});

describe("isHandedOff", () => {
  it("is true only while Ready to Ship with a Handoff on the current label", () => {
    const handoff = { method: "dropped_off" as const, at: T0, recordedAt: T0, actor: "a" };
    expect(isHandedOff(order())).toBe(false);
    expect(isHandedOff(order({ labels: [label({ handoff })] }))).toBe(true);
    expect(isHandedOff(order({ fulfillmentStatus: "in_transit", labels: [label({ handoff })] }))).toBe(false);
    expect(isHandedOff(order({ labels: [label({ handoff }), label({ reship: true })] }))).toBe(false);
  });
});

describe("claimShippedNotice", () => {
  it("claims the notice once per label", () => {
    const labels = claimShippedNotice(order(), T0);
    expect(labels?.[0].shippedNoticeAt).toBe(T0);
    expect(claimShippedNotice(order({ labels: labels! }), T0 + HOUR)).toBeNull();
  });

  it("a Reship's new label gets its own notice", () => {
    const labels = [label({ shippedNoticeAt: T0 - HOUR }), label({ reship: true })];
    expect(claimShippedNotice(order({ labels }), T0)?.[1].shippedNoticeAt).toBe(T0);
  });
});

describe("handoffFlag", () => {
  it("flags a box not handed off a day after the label", () => {
    expect(handoffFlag(order(), T0 + NOT_HANDED_OFF_AFTER_MS - 1)).toBeNull();
    expect(handoffFlag(order(), T0 + NOT_HANDED_OFF_AFTER_MS + 1)).toBe("not_handed_off");
  });

  it("flags a handed-off box with no scan after three days", () => {
    const handedOff = order({ labels: [label({ handoff: { method: "dropped_off", at: T0, recordedAt: T0, actor: "a" } })] });
    expect(currentHandoff(handedOff)?.method).toBe("dropped_off");
    expect(handoffFlag(handedOff, T0 + NO_SCAN_AFTER_MS - 1)).toBeNull();
    expect(handoffFlag(handedOff, T0 + NO_SCAN_AFTER_MS + 1)).toBe("no_scan");
  });

  it("never flags a scanned or cancelled order", () => {
    expect(handoffFlag(order({ fulfillmentStatus: "in_transit" }), T0 + 10 * NO_SCAN_AFTER_MS)).toBeNull();
    expect(handoffFlag(order({ cancelledAt: T0 }), T0 + 10 * NO_SCAN_AFTER_MS)).toBeNull();
  });
});
