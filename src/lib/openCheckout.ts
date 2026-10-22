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

/**
 * The open checkout to release when a store page loads: any return to the store means the
 * shopper left Stripe without paying (Back, a reload, a new tab), so its Checkout Hold should
 * not keep units out of stock for 30 minutes. Never on the success page, which clears it.
 */
export function checkoutToReleaseOnLoad(openCheckout: OpenCheckout | null, pathname: string): OpenCheckout | null {
  if (!openCheckout) return null;
  return /(^|\/)checkout\/success\/?$/.test(pathname) ? null : openCheckout;
}

/**
 * The cart's open checkout once `released` was expired on the server: forgotten, unless a new
 * Pay click opened another one meanwhile. Cleared only after the server answers, so the cart
 * keeps counting the hold as its own stock until the units are back in stock.
 */
export function openCheckoutAfterRelease(current: OpenCheckout | null, released: OpenCheckout): OpenCheckout | null {
  return current && current.sessionId !== released.sessionId ? current : null;
}
