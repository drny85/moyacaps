import { describe, expect, it } from "vitest";
import {
  adminTimeline,
  customerTimeline,
  effectiveScans,
  isDuplicateScan,
  scanKind,
  scanTime,
  type TimelineOrder,
  type TrackingScan,
} from "./timeline";
import type { ShippingLabel } from "./labels";

const T0 = Date.UTC(2026, 9, 20, 12);
const HOUR = 3600_000;

const label = (over: Partial<ShippingLabel> = {}): ShippingLabel => ({
  carrier: "USPS",
  trackingNumber: "9400",
  labelUrl: "u",
  purchasedAt: T0 + HOUR,
  reship: false,
  ...over,
});

const scan = (status: string, at: number, over: Partial<TrackingScan> = {}): TrackingScan => ({
  trackingNumber: "9400",
  status,
  statusDate: new Date(at).toISOString(),
  receivedAt: at + 60_000,
  ...over,
});

const order = (over: Partial<TimelineOrder> = {}): TimelineOrder => ({ createdAt: T0, ...over });

describe("scans", () => {
  it("uses the carrier's date, else when it arrived", () => {
    expect(scanTime({ statusDate: "2026-10-21T10:00:00Z", receivedAt: 5 })).toBe(Date.UTC(2026, 9, 21, 10));
    expect(scanTime({ statusDate: "not a date", receivedAt: 5 })).toBe(5);
    expect(scanTime({ receivedAt: 5 })).toBe(5);
  });

  it("drops a repeat of the latest scan", () => {
    const latest = scan("TRANSIT", T0, { statusDetails: "Arrived" });
    const { receivedAt: _r, ...same } = latest;
    expect(isDuplicateScan(latest, same)).toBe(true);
    expect(isDuplicateScan(latest, { ...same, statusDetails: "Departed" })).toBe(false);
    expect(isDuplicateScan(undefined, same)).toBe(false);
  });

  it("maps carrier statuses to Customer milestones", () => {
    expect(scanKind("TRANSIT", "Arrived at USPS Facility")).toBe("in_transit");
    expect(scanKind("TRANSIT", "Out for Delivery")).toBe("out_for_delivery");
    expect(scanKind("delivered")).toBe("delivered");
    expect(scanKind("FAILURE")).toBe("delivery_problem");
    expect(scanKind("RETURNED")).toBe("returned");
    expect(scanKind("PRE_TRANSIT")).toBeNull();
    expect(scanKind("UNKNOWN")).toBeNull();
  });

  it("an older Order with no stored scans shows its latest scan", () => {
    const legacy = order({ trackingNumber: "9400", trackingStatus: "DELIVERED", trackingLocation: "Bronx, NY", trackingDeliveredAt: T0 + 5 * HOUR });
    expect(effectiveScans(legacy, [])).toEqual([
      { trackingNumber: "9400", status: "DELIVERED", location: "Bronx, NY", receivedAt: T0 + 5 * HOUR },
    ]);
    expect(effectiveScans(legacy, [scan("TRANSIT", T0)])).toHaveLength(1);
    expect(effectiveScans(order(), [])).toEqual([]);
  });
});

describe("customerTimeline", () => {
  it("lists the package milestones newest first, with the Handoff and scans", () => {
    const handoff = { method: "dropped_off" as const, at: T0 + 2 * HOUR, note: "secret note", recordedAt: T0 + 2 * HOUR, actor: "user_admin" };
    const timeline = customerTimeline(order({ labels: [label({ handoff })] }), {
      paidAt: T0 + 60_000,
      scans: [
        scan("PRE_TRANSIT", T0 + HOUR),
        scan("TRANSIT", T0 + 3 * HOUR, { location: "Bronx, NY" }),
        scan("TRANSIT", T0 + 4 * HOUR, { statusDetails: "Out for Delivery" }),
        scan("DELIVERED", T0 + 5 * HOUR, { location: "Austin, TX" }),
      ],
    });
    expect(timeline.map((e) => e.kind)).toEqual([
      "delivered",
      "out_for_delivery",
      "in_transit",
      "handed_off",
      "ready_to_ship",
      "paid",
      "placed",
    ]);
    expect(timeline.find((e) => e.kind === "handed_off")).toEqual({ at: T0 + 2 * HOUR, kind: "handed_off", method: "dropped_off", carrier: "USPS" });
    expect(timeline[0].location).toBe("Austin, TX");
    expect(JSON.stringify(timeline)).not.toMatch(/secret note|user_admin/);
  });

  it("a Reship shows a new label was sent; a cancellation shows last", () => {
    const timeline = customerTimeline(
      order({ labels: [label(), label({ reship: true, purchasedAt: T0 + 48 * HOUR })], cancelledAt: T0 + 72 * HOUR }),
      { scans: [] }
    );
    expect(timeline.map((e) => e.kind)).toEqual(["cancelled", "reship", "ready_to_ship", "placed"]);
  });
});

describe("ordering", () => {
  it("entries at the same moment keep lifecycle order", () => {
    const timeline = customerTimeline(order({ labels: [label({ purchasedAt: T0 })] }), { paidAt: T0, scans: [] });
    expect(timeline.map((e) => e.kind)).toEqual(["ready_to_ship", "paid", "placed"]);
  });
});

describe("adminTimeline", () => {
  it("merges the order's event log with carrier scans, newest first", () => {
    const timeline = adminTimeline(order(), {
      events: [
        { type: "stripe_settled", details: '{"total":160}', createdAt: T0 + 60_000 },
        { type: "handoff_recorded", details: "Package dropped off with USPS", actor: "user_admin", createdAt: T0 + 2 * HOUR },
        { type: "refund_issued", details: "Goodwill $10.00", createdAt: T0 + 6 * HOUR },
      ],
      scans: [scan("TRANSIT", T0 + 3 * HOUR, { statusDetails: "Accepted at USPS", location: "Bronx, NY" })],
    });
    expect(timeline.map((e) => `${e.source}:${e.kind}`)).toEqual([
      "event:refund_issued",
      "scan:TRANSIT",
      "event:handoff_recorded",
      "event:stripe_settled",
      "order:placed",
    ]);
    expect(timeline[1]).toMatchObject({ details: "Accepted at USPS", location: "Bronx, NY" });
    expect(timeline[2].actor).toBe("user_admin");
  });
});
