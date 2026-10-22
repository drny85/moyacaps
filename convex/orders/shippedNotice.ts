/**
 * The "has shipped" email (ADR 0030): sent once per label, at the Handoff or the first carrier
 * scan, whichever comes first. Callers claim the notice on the label (handoff.ts) in the same
 * write, then schedule the email here.
 */
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { hasEmail } from "./shared";
import { carrierTrackingNumber } from "./trackingNumber";

export async function scheduleShippedEmail(
  ctx: MutationCtx,
  order: Doc<"orders">,
  overrides: { carrier?: string; trackingNumber?: string } = {}
): Promise<void> {
  if (!hasEmail(order.customerEmail)) return;
  await ctx.scheduler.runAfter(0, internal.notifications.emails.sendOrderDispatchedEmail, {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    stage: "in_transit",
    carrier: (overrides.carrier ?? order.carrier) || undefined,
    trackingNumber: (overrides.trackingNumber ?? carrierTrackingNumber(order)) || undefined,
    shippingAddress: order.shippingAddress,
    items: order.items,
  });
}
