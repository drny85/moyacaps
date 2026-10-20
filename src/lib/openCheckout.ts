/**
 * The cart's open checkout (ADR 0024): the Order and Checkout Session created by the last
 * Pay click. A new Pay click or Stripe's back link expires that session at once, so its
 * Checkout Hold does not keep units out of Available Inventory for the full 30 minutes.
 */
export type OpenCheckout = { orderNumber: string; sessionId: string };

/** Cart lines in the shape `payments/checkout:createCheckoutSession` takes. */
export function cartCheckoutLines(
  cart: ReadonlyArray<{ id: string; variantId?: string; quantity: number; size?: string; colorway?: string }>
): Array<{ variantId: string; quantity: number; size?: string; colorway?: string }> {
  return cart.map((item) => ({
    variantId: item.variantId || item.id,
    quantity: item.quantity,
    ...(item.size ? { size: item.size } : {}),
    ...(item.colorway ? { colorway: item.colorway } : {}),
  }));
}

/** True when the page was reached through Stripe's back link (`cancel_url` adds `canceled=1`). */
export function isCanceledCheckoutReturn(params: { get(name: string): string | null }): boolean {
  const value = params.get("canceled");
  return value === "1" || value === "true";
}
