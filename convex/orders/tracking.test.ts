import { describe, expect, it } from "vitest";
import { planTrackingUpdate } from "./tracking";

const NOW = 1_800_000_000_000;
const dispatched = { status: "dispatched" as const, carrier: "USPS", adminNotes: undefined, manualStatusOverride: undefined };

describe("planTrackingUpdate", () => {
  it("records transit scans without changing status", () => {
    const plan = planTrackingUpdate(dispatched, { trackingNumber: "1Z", status: "transit", location: { city: "Newark", state: "NJ" } }, NOW);
    expect(plan.patch).toEqual({ trackingStatus: "TRANSIT", updatedAt: NOW, trackingLocation: "Newark, NJ" });
    expect(plan.event).toBeUndefined();
    expect(plan.delivered).toBe(false);
  });

  it("delivers a dispatched order and audits the scan", () => {
    const plan = planTrackingUpdate(dispatched, { trackingNumber: "1Z", status: "DELIVERED", statusDetails: "Front door" }, NOW);
    expect(plan.patch).toMatchObject({ status: "delivered", trackingDeliveredAt: NOW, trackingStatusDetails: "Front door" });
    expect(plan.delivered).toBe(true);
    expect(plan.event).toEqual({ type: "carrier_delivered", details: "USPS scan: Front door (Destination)" });
  });

  it("respects an Administrator's manual override on DELIVERED", () => {
    const plan = planTrackingUpdate({ ...dispatched, manualStatusOverride: true }, { trackingNumber: "1Z", status: "DELIVERED" }, NOW);
    expect(plan.patch.status).toBeUndefined();
    expect(plan.delivered).toBe(false);
    expect(plan.event).toBeUndefined();
  });

  it("ignores DELIVERED for orders that are not dispatched", () => {
    const plan = planTrackingUpdate({ ...dispatched, status: "paid" }, { trackingNumber: "1Z", status: "DELIVERED" }, NOW);
    expect(plan.patch.status).toBeUndefined();
  });

  it("flags failures and returns in admin notes", () => {
    const plan = planTrackingUpdate(
      { ...dispatched, adminNotes: "earlier" },
      { trackingNumber: "1Z", status: "RETURNED", statusDetails: "Refused", statusDate: "2026-10-01" },
      NOW
    );
    expect(plan.patch.trackingFailedAt).toBe(NOW);
    expect(plan.patch.adminNotes).toBe("earlier\n⚠️ [Carrier RETURNED] Refused () at 2026-10-01");
    expect(plan.event).toEqual({ type: "delivery_returned", details: "USPS exception: Refused" });
  });

  it("takes the scan's carrier only when the order has none", () => {
    const plan = planTrackingUpdate({ ...dispatched, carrier: undefined }, { trackingNumber: "1Z", status: "FAILURE", carrier: "UPS" }, NOW);
    expect(plan.patch.carrier).toBe("UPS");
    expect(plan.event).toEqual({ type: "delivery_failed", details: "UPS exception: FAILURE" });
    expect(planTrackingUpdate(dispatched, { trackingNumber: "1Z", status: "TRANSIT", carrier: "UPS" }, NOW).patch.carrier).toBeUndefined();
  });
});
