/**
 * Order Timeline (CONTEXT.md "Order Timeline"): the dated history of an Order. The Administrator
 * sees everything (the order's event log plus every carrier scan); the Customer sees only the
 * package milestones, never refunds, notes or who did what. Orders from before scans were
 * stored get a timeline from what they already carry (placed, labels, Handoff, latest scan).
 * Pure; covered by timeline.test.ts.
 */
import { v, type Infer } from "convex/values";
import { labelHistory, type LabelSource, type HandoffMethod } from "./labels";

/** Scans kept per Order; a package rarely gets more than twenty. */
export const MAX_TRACKING_EVENTS = 60;

/** One carrier scan as stored (no street or postal code: only city and state). */
export type TrackingScan = {
  trackingNumber: string;
  status: string;
  statusDetails?: string;
  statusDate?: string;
  location?: string;
  receivedAt: number;
};

/** When the scan happened: the carrier's own date, else when Shippo told us. */
export function scanTime(scan: Pick<TrackingScan, "statusDate" | "receivedAt">): number {
  const parsed = scan.statusDate ? Date.parse(scan.statusDate) : NaN;
  return Number.isFinite(parsed) ? parsed : scan.receivedAt;
}

/** Whether `next` repeats the latest stored scan (Shippo resends updates). */
export function isDuplicateScan(latest: TrackingScan | undefined, next: Omit<TrackingScan, "receivedAt">): boolean {
  if (!latest) return false;
  return (
    latest.trackingNumber === next.trackingNumber &&
    latest.status === next.status &&
    (latest.statusDate ?? "") === (next.statusDate ?? "") &&
    (latest.statusDetails ?? "") === (next.statusDetails ?? "")
  );
}

// ── Customer view ───────────────────────────────────────────────────────────

export const CUSTOMER_TIMELINE_KINDS = [
  "placed",
  "paid",
  "ready_to_ship",
  "reship",
  "handed_off",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "delivery_problem",
  "returned",
  "cancelled",
] as const;
export type CustomerTimelineKind = (typeof CUSTOMER_TIMELINE_KINDS)[number];

export const customerTimelineEntryValidator = v.object({
  at: v.number(),
  kind: v.union(...(CUSTOMER_TIMELINE_KINDS.map((k) => v.literal(k)) as [
    ReturnType<typeof v.literal<CustomerTimelineKind>>,
    ReturnType<typeof v.literal<CustomerTimelineKind>>,
    ...ReturnType<typeof v.literal<CustomerTimelineKind>>[],
  ])),
  method: v.optional(v.union(v.literal("picked_up"), v.literal("dropped_off"))),
  carrier: v.optional(v.string()),
  location: v.optional(v.string()),
});
export type CustomerTimelineEntry = Infer<typeof customerTimelineEntryValidator>;

/** The milestone a carrier scan shows the Customer, or null for one that says nothing new. */
export function scanKind(status: string, details?: string): CustomerTimelineKind | null {
  switch (status.toUpperCase()) {
    case "TRANSIT":
      return /out for delivery/i.test(details ?? "") ? "out_for_delivery" : "in_transit";
    case "DELIVERED":
      return "delivered";
    case "FAILURE":
      return "delivery_problem";
    case "RETURNED":
      return "returned";
    default:
      // PRE_TRANSIT ("label created") and UNKNOWN repeat what Ready to ship already says.
      return null;
  }
}

export type TimelineOrder = LabelSource & {
  createdAt: number;
  cancelledAt?: number;
  carrier?: string;
  trackingNumber?: string;
  trackingStatus?: string;
  trackingStatusDetails?: string;
  trackingStatusDate?: string;
  trackingLocation?: string;
  trackingDeliveredAt?: number;
};

/** Scans to show: the stored ones, or for an older Order its latest scan from the order itself. */
export function effectiveScans(order: TimelineOrder, scans: TrackingScan[]): TrackingScan[] {
  if (scans.length > 0 || !order.trackingStatus || !order.trackingNumber) return scans;
  return [
    {
      trackingNumber: order.trackingNumber,
      status: order.trackingStatus,
      ...(order.trackingStatusDetails !== undefined && { statusDetails: order.trackingStatusDetails }),
      ...(order.trackingStatusDate !== undefined && { statusDate: order.trackingStatusDate }),
      ...(order.trackingLocation !== undefined && { location: order.trackingLocation }),
      receivedAt: order.trackingDeliveredAt ?? order.updatedAt ?? order.createdAt,
    },
  ];
}

/** Newest first; entries at the same moment keep lifecycle order (the later step on top). */
const newestFirst = <T extends { at: number }>(entries: T[]) =>
  entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.at - a.entry.at || b.index - a.index)
    .map(({ entry }) => entry);

/**
 * The Customer's timeline, newest first: placed, paid, each label (a Reship says a new one was
 * sent), the Handoff, the carrier's milestones and a cancellation.
 */
export function customerTimeline(order: TimelineOrder, sources: { paidAt?: number; scans: TrackingScan[] }): CustomerTimelineEntry[] {
  const entries: CustomerTimelineEntry[] = [{ at: order.createdAt, kind: "placed" }];
  if (sources.paidAt !== undefined) entries.push({ at: sources.paidAt, kind: "paid" });
  for (const label of labelHistory(order)) {
    entries.push({ at: label.purchasedAt, kind: label.reship ? "reship" : "ready_to_ship", carrier: label.carrier });
    if (label.handoff) {
      entries.push({ at: label.handoff.at, kind: "handed_off", method: label.handoff.method as HandoffMethod, carrier: label.carrier });
    }
  }
  for (const scan of effectiveScans(order, sources.scans)) {
    const kind = scanKind(scan.status, scan.statusDetails);
    if (kind) entries.push({ at: scanTime(scan), kind, ...(scan.location && { location: scan.location }) });
  }
  if (order.cancelledAt !== undefined) entries.push({ at: order.cancelledAt, kind: "cancelled" });
  return newestFirst(entries);
}

// ── Administrator view ──────────────────────────────────────────────────────

export const adminTimelineEntryValidator = v.object({
  at: v.number(),
  source: v.union(v.literal("order"), v.literal("event"), v.literal("scan")),
  /** "placed", an order event type (stripe_settled, handoff_recorded, …) or a scan status. */
  kind: v.string(),
  details: v.optional(v.string()),
  actor: v.optional(v.string()),
  location: v.optional(v.string()),
});
export type AdminTimelineEntry = Infer<typeof adminTimelineEntryValidator>;

export type OrderEvent = { type: string; details?: string; actor?: string; createdAt: number };

/** Everything that happened to the Order, newest first: its event log merged with carrier scans. */
export function adminTimeline(order: TimelineOrder, sources: { events: OrderEvent[]; scans: TrackingScan[] }): AdminTimelineEntry[] {
  const entries: AdminTimelineEntry[] = [{ at: order.createdAt, source: "order", kind: "placed" }];
  for (const event of sources.events) {
    entries.push({
      at: event.createdAt,
      source: "event",
      kind: event.type,
      ...(event.details && { details: event.details }),
      ...(event.actor && { actor: event.actor }),
    });
  }
  for (const scan of effectiveScans(order, sources.scans)) {
    entries.push({
      at: scanTime(scan),
      source: "scan",
      kind: scan.status.toUpperCase(),
      ...(scan.statusDetails && { details: scan.statusDetails }),
      ...(scan.location && { location: scan.location }),
    });
  }
  return newestFirst(entries);
}
