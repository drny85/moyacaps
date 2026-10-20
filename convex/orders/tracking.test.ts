import { describe, expect, it } from "vitest";
import { planTrackingUpdate } from "./tracking";

const NOW = 1_800_000_000_000;
const shipped = {
  paymentStatus: "paid" as const,
  fulfillmentStatus: "in_transit" as const,
  carrier: "USPS",
  adminNotes: undefined,
  manualStatusOverride: undefined,
};

describe("planTrackingUpdate", () => {
  it("records transit scans; an order already in transit stays put", () => {
    const plan = planTrackingUpdate(shipped, { trackingNumber: "1Z", status: "transit", location: { city: "Newark", state: "NJ" } }, NOW);
    expect(plan.patch).toEqual({ trackingStatus: "TRANSIT", updatedAt: NOW, trackingLocation: "Newark, NJ" });
    expect(plan.fulfillmentStatus).toBeUndefined();
    expect(plan.event).toBeUndefined();
    expect(plan.delivered).toBe(false);
  });

  it("the first transit scan moves a label-purchased order in transit", () => {
    const plan = planTrackingUpdate({ ...shipped, fulfillmentStatus: "label_purchased" }, { trackingNumber: "1Z", status: "TRANSIT" }, NOW);
    expect(plan.patch).toMatchObject({ fulfillmentStatus: "in_transit", paymentStatus: "paid" });
  });

  it("delivers a shipped order and audits the scan", () => {
    const plan = planTrackingUpdate(shipped, { trackingNumber: "1Z", status: "DELIVERED", statusDetails: "Front door" }, NOW);
    expect(plan.patch).toMatchObject({ fulfillmentStatus: "delivered", trackingDeliveredAt: NOW, trackingStatusDetails: "Front door" });
    expect(plan.delivered).toBe(true);
    expect(plan.event).toEqual({ type: "carrier_delivered", details: "USPS scan: Front door (Destination)" });
  });

  it("delivers a refunded order without touching its Payment Status", () => {
    const plan = planTrackingUpdate({ ...shipped, paymentStatus: "refunded" }, { trackingNumber: "1Z", status: "DELIVERED" }, NOW);
    expect(plan.patch).toMatchObject({ fulfillmentStatus: "delivered", paymentStatus: "refunded" });
    expect(plan.delivered).toBe(true);
  });

  it("respects an Administrator's manual override on DELIVERED", () => {
    const plan = planTrackingUpdate({ ...shipped, manualStatusOverride: true }, { trackingNumber: "1Z", status: "DELIVERED" }, NOW);
    expect(plan.patch.fulfillmentStatus).toBeUndefined();
    expect(plan.delivered).toBe(false);
    expect(plan.event).toBeUndefined();
  });

  it("ignores DELIVERED for orders with nothing shipped", () => {
    const plan = planTrackingUpdate({ ...shipped, fulfillmentStatus: "unfulfilled" }, { trackingNumber: "1Z", status: "DELIVERED" }, NOW);
    expect(plan.patch.fulfillmentStatus).toBeUndefined();
    expect(plan.delivered).toBe(false);
  });

  it("flags returns in admin notes and marks the order returned", () => {
    const plan = planTrackingUpdate(
      { ...shipped, adminNotes: "earlier" },
      { trackingNumber: "1Z", status: "RETURNED", statusDetails: "Refused", statusDate: "2026-10-01" },
      NOW
    );
    expect(plan.patch.trackingFailedAt).toBe(NOW);
    expect(plan.patch.fulfillmentStatus).toBe("returned");
    expect(plan.patch.adminNotes).toBe("earlier\n⚠️ [Carrier RETURNED] Refused () at 2026-10-01");
    expect(plan.event).toEqual({ type: "delivery_returned", details: "USPS exception: Refused" });
  });

  it("a carrier failure is a Delivery Exception", () => {
    const plan = planTrackingUpdate({ ...shipped, carrier: undefined }, { trackingNumber: "1Z", status: "FAILURE", carrier: "UPS" }, NOW);
    expect(plan.patch.fulfillmentStatus).toBe("delivery_exception");
    expect(plan.patch.carrier).toBe("UPS");
    expect(plan.event).toEqual({ type: "delivery_failed", details: "UPS exception: FAILURE" });
  });

  it("takes the scan's carrier only when the order has none", () => {
    expect(planTrackingUpdate(shipped, { trackingNumber: "1Z", status: "TRANSIT", carrier: "UPS" }, NOW).patch.carrier).toBeUndefined();
  });
});
