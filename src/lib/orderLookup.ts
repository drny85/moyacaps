/** What the order tracking page asks Convex for (`getOrderByOrderNumberAndEmail`). */
export type TrackingQuery = { orderNumber: string; email?: string };

/** Order numbers as stored: upper case, no surrounding spaces, no leading `#` ("#gl-12 " → "GL-12"). */
export function normalizeOrderNumber(raw: string): string {
  return raw.trim().toUpperCase().replace(/^#/, "");
}

/**
 * Builds the tracking lookup from what the visitor typed or the `?order=` link carried.
 * No order number means no lookup; a blank email is left out, which gives the guest view.
 */
export function toTrackingQuery(orderNumber: string, email = ""): TrackingQuery | null {
  const cleanNumber = normalizeOrderNumber(orderNumber);
  if (!cleanNumber) return null;
  const cleanEmail = email.trim().toLowerCase();
  return cleanEmail ? { orderNumber: cleanNumber, email: cleanEmail } : { orderNumber: cleanNumber };
}
