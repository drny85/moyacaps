/**
 * Pure rules for WhatsApp concierge reservations (ADR 0010, ADR 0011): hold window,
 * anti-hoarding limits and input sanitation. Covered by reservationModel.test.ts.
 */

/** Reserved stock is held for 24 hours, from creation or from the latest payment-link dispatch. */
export const RESERVATION_HOLD_MS = 24 * 60 * 60 * 1000;

/** Unconfirmed reservations one email or phone may hold at once. */
export const MAX_ACTIVE_RESERVATIONS = 3;

/** Reservations one email may create in a sliding 24h window (cancel-and-recreate included). */
export const MAX_RESERVATIONS_PER_DAY = 5;
export const RESERVATION_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Most recent orders read for the sliding-window check; must exceed MAX_RESERVATIONS_PER_DAY. */
export const RESERVATION_RATE_LOOKBACK = 10;

export const MAX_RESERVATION_LINES = 20;
export const MAX_LINE_QUANTITY = 10;

export function isValidLineQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity > 0 && quantity <= MAX_LINE_QUANTITY;
}

/** Trim and bound contact fields; phone keeps digits only. Empty values become undefined. */
export function sanitizeReservationContact(input: { name?: string; phone?: string; email?: string }) {
  return {
    name: input.name?.trim().slice(0, 100),
    phone: input.phone?.replace(/\D/g, "").slice(0, 20) || undefined,
    email: input.email?.trim().toLowerCase().slice(0, 100),
  };
}

type AddressInput = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

/** Trim and bound a US shipping address; reservations ship domestically only. */
export function sanitizeReservationAddress(address: AddressInput | undefined) {
  if (!address) return undefined;
  return {
    line1: address.line1.trim().slice(0, 150),
    line2: address.line2?.trim().slice(0, 100) || undefined,
    city: address.city.trim().slice(0, 100),
    state: address.state.trim().toUpperCase().slice(0, 2),
    postalCode: address.postalCode.trim().slice(0, 10),
    country: "US",
  };
}

/** Reservations created inside the sliding window ending at `now`. */
export function countReservationsInWindow(orders: Array<{ createdAt?: number }>, now: number): number {
  const windowStart = now - RESERVATION_RATE_WINDOW_MS;
  return orders.filter((o) => (o.createdAt || 0) >= windowStart).length;
}
