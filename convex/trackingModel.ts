/**
 * Pure carrier-tracking rules (ADR 0012): how a tracking webhook scan changes an order.
 * Covered by trackingModel.test.ts.
 */
import type { Doc } from "./_generated/dataModel";
import { appendNote } from "./orderModel";

export type TrackingScan = {
  trackingNumber: string;
  carrier?: string;
  /** "PRE_TRANSIT" | "TRANSIT" | "DELIVERED" | "RETURNED" | "FAILURE" | "UNKNOWN" */
  status: string;
  statusDetails?: string;
  statusDate?: string;
  location?: { city?: string; state?: string; zip?: string; country?: string };
};

type TrackedOrder = Pick<Doc<"orders">, "status" | "carrier" | "adminNotes" | "manualStatusOverride">;

export type TrackingPlan = {
  trackingStatus: string;
  locationStr?: string;
  patch: Record<string, unknown>;
  event?: { type: string; details: string };
  /** DELIVERED scan moved a dispatched order to delivered: send the delivery email. */
  delivered: boolean;
};

/**
 * DELIVERED moves a dispatched order to delivered unless an Administrator locked it
 * (manualStatusOverride). FAILURE/RETURNED flag the order for staff. Every scan updates
 * the tracking fields.
 */
export function planTrackingUpdate(order: TrackedOrder, scan: TrackingScan, now: number): TrackingPlan {
  const trackingStatus = scan.status.toUpperCase();
  const locationParts = [scan.location?.city, scan.location?.state].filter(Boolean);
  const locationStr = locationParts.length > 0 ? locationParts.join(", ") : undefined;
  const carrierName = order.carrier || scan.carrier || "Courier";

  const patch: Record<string, unknown> = {
    trackingStatus,
    updatedAt: now,
  };
  if (scan.statusDetails) patch.trackingStatusDetails = scan.statusDetails;
  if (scan.statusDate) patch.trackingStatusDate = scan.statusDate;
  if (locationStr) patch.trackingLocation = locationStr;
  if (scan.carrier && !order.carrier) patch.carrier = scan.carrier;

  if (trackingStatus === "DELIVERED") {
    if (!order.manualStatusOverride && order.status === "dispatched") {
      patch.status = "delivered";
      patch.trackingDeliveredAt = now;
      return {
        trackingStatus,
        locationStr,
        patch,
        delivered: true,
        event: {
          type: "carrier_delivered",
          details: `${carrierName} scan: ${scan.statusDetails || "Delivered to destination"} (${locationStr || "Destination"})`,
        },
      };
    }
    return { trackingStatus, locationStr, patch, delivered: false };
  }

  if (trackingStatus === "FAILURE" || trackingStatus === "RETURNED") {
    patch.trackingFailedAt = now;
    const alertLine = `⚠️ [Carrier ${trackingStatus}] ${scan.statusDetails || "Exception encountered during transit"} (${locationStr || ""}) at ${scan.statusDate || new Date(now).toISOString()}`;
    patch.adminNotes = appendNote(order.adminNotes, alertLine).trim();
    return {
      trackingStatus,
      locationStr,
      patch,
      delivered: false,
      event: {
        type: trackingStatus === "RETURNED" ? "delivery_returned" : "delivery_failed",
        details: `${carrierName} exception: ${scan.statusDetails || trackingStatus}`,
      },
    };
  }

  return { trackingStatus, locationStr, patch, delivered: false };
}
