/**
 * Handoff rules (ADR 0030, CONTEXT.md "Handoff"): the Administrator records when a Ready to Ship
 * package was picked up by or dropped off with the carrier. A Handoff is an event on the current
 * label, never a Fulfillment Status change, so carrier scans keep moving the Order and nothing
 * locks them. Pure; covered by handoff.test.ts.
 */
import { isCancelled, statusAxes, type StatusSource } from "./status";
import { labelHistory, type Handoff, type HandoffMethod, type LabelSource, type ShippingLabel } from "./labels";

const HOUR_MS = 60 * 60 * 1000;
/** A Ready to Ship package with no Handoff after this long may be a forgotten box. */
export const NOT_HANDED_OFF_AFTER_MS = 24 * HOUR_MS;
/** A handed-off package with no carrier scan after this long may be lost before the carrier took it. */
export const NO_SCAN_AFTER_MS = 3 * 24 * HOUR_MS;
/** Clock drift allowed between the Administrator's browser and the server. */
const FUTURE_SLACK_MS = 5 * 60 * 1000;
export const MAX_NOTE_LENGTH = 200;

export type HandoffOrder = StatusSource & LabelSource;

/** The label the package currently travels on, if any. */
export function currentLabel(order: LabelSource): ShippingLabel | undefined {
  const labels = labelHistory(order);
  return labels[labels.length - 1];
}

/** The current label's Handoff, if one was recorded. */
export function currentHandoff(order: LabelSource): Handoff | undefined {
  return currentLabel(order)?.handoff;
}

/**
 * Ready to Ship and still the store's to send: a label is bought, the carrier has not scanned it,
 * and the sale stands (not cancelled, not fully refunded: the store no longer owes that package).
 */
export function isReadyToShip(order: HandoffOrder): boolean {
  const axes = statusAxes(order);
  return !isCancelled(order) && axes.paymentStatus !== "refunded" && axes.fulfillmentStatus === "label_purchased";
}

/** Has the package left the Administrator: handed off, or scanned by the carrier. */
export function hasShipped(order: HandoffOrder): boolean {
  const status = statusAxes(order).fulfillmentStatus;
  if (status === "unfulfilled") return false;
  if (status === "label_purchased") return currentHandoff(order) !== undefined;
  return true;
}

/** Replaces the current (last) label with `next`, keeping the history before it. */
function withCurrentLabel(order: LabelSource, next: ShippingLabel): ShippingLabel[] {
  const labels = labelHistory(order);
  return [...labels.slice(0, -1), next];
}

export type HandoffInput = { method: HandoffMethod; at: number; note?: string; actor: string };

export type HandoffPlan =
  | { ok: true; labels: ShippingLabel[]; correction: boolean; notifyShipped: boolean }
  | { ok: false; error: string };

/**
 * Records (or corrects) the current label's Handoff. Only while Ready to Ship: once the carrier
 * scans the package the Handoff is locked. The time must fall between the label purchase and now.
 * `notifyShipped` is true when the Customer has not been told the package shipped yet.
 */
export function planHandoff(order: HandoffOrder, input: HandoffInput, now: number): HandoffPlan {
  if (!isReadyToShip(order)) {
    return { ok: false, error: "Only a Ready to Ship order can be handed off. Once the carrier scans it, the Handoff is locked." };
  }
  const label = currentLabel(order);
  if (!label) return { ok: false, error: "This order has no shipping label." };
  if (!Number.isFinite(input.at) || input.at > now + FUTURE_SLACK_MS) {
    return { ok: false, error: "The Handoff time cannot be in the future." };
  }
  if (input.at < label.purchasedAt - FUTURE_SLACK_MS) {
    return { ok: false, error: "The Handoff time cannot be before the label was bought." };
  }
  const note = input.note?.trim().slice(0, MAX_NOTE_LENGTH) || undefined;
  const handoff: Handoff = {
    method: input.method,
    at: Math.min(input.at, now),
    ...(note && { note }),
    recordedAt: now,
    actor: input.actor,
  };
  const notifyShipped = label.shippedNoticeAt === undefined;
  return {
    ok: true,
    labels: withCurrentLabel(order, { ...label, handoff, ...(notifyShipped && { shippedNoticeAt: now }) }),
    correction: label.handoff !== undefined,
    notifyShipped,
  };
}

/** Removes a mistaken Handoff, while still Ready to Ship. The shipped notice already sent stays sent. */
export function planClearHandoff(order: HandoffOrder): { ok: true; labels: ShippingLabel[] } | { ok: false; error: string } {
  if (!isReadyToShip(order)) return { ok: false, error: "The Handoff is locked once the carrier scans the package." };
  const label = currentLabel(order);
  if (!label?.handoff) return { ok: false, error: "This order has no Handoff to remove." };
  const { handoff: _removed, ...rest } = label;
  return { ok: true, labels: withCurrentLabel(order, rest) };
}

/**
 * Marks the current label's shipped notice as sent and returns the new label history, or null
 * when the Customer was already told (a Handoff or an earlier scan). One notice per label.
 */
export function claimShippedNotice(order: LabelSource, now: number): ShippingLabel[] | null {
  const label = currentLabel(order);
  if (!label || label.shippedNoticeAt !== undefined) return null;
  return withCurrentLabel(order, { ...label, shippedNoticeAt: now });
}

export type HandoffFlag = "not_handed_off" | "no_scan";

/**
 * Desk flag for a Ready to Ship package: no Handoff a day after the label was bought (a forgotten
 * box), or handed off with no carrier scan after three days (likely lost before the carrier).
 */
export function handoffFlag(order: HandoffOrder, now: number): HandoffFlag | null {
  if (!isReadyToShip(order)) return null;
  const label = currentLabel(order);
  if (!label) return null;
  if (!label.handoff) return label.purchasedAt < now - NOT_HANDED_OFF_AFTER_MS ? "not_handed_off" : null;
  return label.handoff.at < now - NO_SCAN_AFTER_MS ? "no_scan" : null;
}
