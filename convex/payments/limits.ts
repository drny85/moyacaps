/**
 * Purchase limits, so one buyer (or a script) cannot hold a whole drop: every Pay click
 * places a Checkout Hold on its units for about 30 minutes (ADR 0024). The cart store
 * clamps to the same numbers so the storefront never offers more than checkout accepts.
 */
export const MAX_UNITS_PER_LINE = 5;
export const MAX_UNITS_PER_CART = 20;
export const MAX_CART_LINES = 20;
