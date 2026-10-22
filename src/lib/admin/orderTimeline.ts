/**
 * How the admin Order Timeline reads (CONTEXT.md "Order Timeline"): a title and tone per event
 * type or carrier scan, and who did it. Unknown types fall back to their own words, so a new
 * event shows up without a change here. Pure; covered by orderTimeline.test.ts.
 */
import type { AdminTimelineEntry } from "../../../convex/orders/timeline";

export type TimelineTone = "zinc" | "emerald" | "blue" | "amber" | "rose" | "purple";

const EVENTS: Record<string, { title: string; tone: TimelineTone }> = {
  placed: { title: "Order placed", tone: "zinc" },
  checkout_hold_placed: { title: "Checkout started (stock held)", tone: "zinc" },
  link_generated: { title: "Payment link created", tone: "zinc" },
  session_expired: { title: "Checkout expired", tone: "zinc" },
  inventory_released: { title: "Held stock released", tone: "zinc" },
  stripe_settled: { title: "Payment received", tone: "emerald" },
  double_settlement_attempted: { title: "Duplicate payment blocked", tone: "amber" },
  shipping_label_created: { title: "Label bought", tone: "blue" },
  shipping_label_reshipped: { title: "Reship label bought", tone: "amber" },
  handoff_recorded: { title: "Handed off to the carrier", tone: "blue" },
  handoff_corrected: { title: "Handoff corrected", tone: "blue" },
  handoff_removed: { title: "Handoff removed", tone: "zinc" },
  status_changed: { title: "Status changed by hand", tone: "purple" },
  carrier_delivered: { title: "Delivered", tone: "emerald" },
  delivery_failed: { title: "Delivery exception", tone: "rose" },
  delivery_returned: { title: "Returned to sender", tone: "rose" },
  refund_requested: { title: "Refund requested", tone: "amber" },
  refund_issued: { title: "Refund issued", tone: "amber" },
  refund_failed: { title: "Refund failed", tone: "rose" },
  dispute_created: { title: "Dispute opened", tone: "rose" },
  dispute_closed: { title: "Dispute closed", tone: "zinc" },
  cancelled: { title: "Order cancelled", tone: "rose" },
  out_of_territory: { title: "Outside the shipping area", tone: "rose" },
};

const SCANS: Record<string, { title: string; tone: TimelineTone }> = {
  PRE_TRANSIT: { title: "Carrier: label created", tone: "zinc" },
  TRANSIT: { title: "Carrier: in transit", tone: "blue" },
  DELIVERED: { title: "Carrier: delivered", tone: "emerald" },
  FAILURE: { title: "Carrier: delivery problem", tone: "rose" },
  RETURNED: { title: "Carrier: returned to sender", tone: "rose" },
  UNKNOWN: { title: "Carrier update", tone: "zinc" },
};

const humanize = (kind: string) => kind.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** Who did it, in the desk's words; empty for the system. */
export function actorLabel(actor: string | undefined): string {
  if (!actor) return "";
  if (actor.startsWith("user_") || actor === "admin") return "Administrator";
  if (actor === "courier_webhook") return "Carrier";
  if (actor === "customer") return "Customer";
  if (actor.startsWith("stripe")) return "Stripe";
  if (actor === "system") return "";
  return actor;
}

/** Event details meant for people; machine payloads (JSON) are left out. */
function readableDetails(details: string | undefined): string | undefined {
  const text = details?.trim();
  if (!text || text.startsWith("{") || text.startsWith("[")) return undefined;
  return text;
}

export type TimelineRow = { key: string; at: number; title: string; tone: TimelineTone; details?: string; meta: string };

export function toTimelineRow(entry: AdminTimelineEntry, index: number): TimelineRow {
  const known = entry.source === "scan" ? SCANS[entry.kind] : EVENTS[entry.kind];
  const title = known?.title ?? (entry.source === "scan" ? `Carrier: ${entry.kind.toLowerCase()}` : humanize(entry.kind));
  const scanOut = entry.source === "scan" && /out for delivery/i.test(entry.details ?? "");
  return {
    key: `${entry.source}-${entry.kind}-${entry.at}-${index}`,
    at: entry.at,
    title: scanOut ? "Carrier: out for delivery" : title,
    tone: known?.tone ?? "zinc",
    ...(readableDetails(entry.details) && { details: readableDetails(entry.details) }),
    meta: [entry.location, actorLabel(entry.actor)].filter(Boolean).join(" · "),
  };
}
