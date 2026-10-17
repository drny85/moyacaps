import { describe, expect, it } from "vitest";
import {
  countReservationsInWindow,
  isValidLineQuantity,
  RESERVATION_RATE_WINDOW_MS,
  sanitizeReservationAddress,
  sanitizeReservationContact,
} from "./reservationModel";

describe("isValidLineQuantity", () => {
  it("accepts whole units from 1 to 10", () => {
    expect([1, 5, 10].every(isValidLineQuantity)).toBe(true);
    expect([0, -1, 11, 1.5, Number.NaN].some(isValidLineQuantity)).toBe(false);
  });
});

describe("sanitizeReservationContact", () => {
  it("trims, lower-cases email and keeps phone digits only", () => {
    expect(sanitizeReservationContact({ name: "  Ana  ", phone: "+1 (555) 123-4567", email: "  Ana@Example.COM " })).toEqual({
      name: "Ana",
      phone: "15551234567",
      email: "ana@example.com",
    });
  });

  it("drops a phone with no digits and bounds long values", () => {
    const contact = sanitizeReservationContact({ phone: "n/a", name: "x".repeat(150), email: `${"a".repeat(120)}@x.com` });
    expect(contact.phone).toBeUndefined();
    expect(contact.name).toHaveLength(100);
    expect(contact.email).toHaveLength(100);
  });
});

describe("sanitizeReservationAddress", () => {
  it("normalizes state and forces a US address", () => {
    expect(
      sanitizeReservationAddress({ line1: " 1 Main St ", line2: "  ", city: " Miami ", state: " fl ", postalCode: " 33101 ", country: "MX" })
    ).toEqual({ line1: "1 Main St", line2: undefined, city: "Miami", state: "FL", postalCode: "33101", country: "US" });
  });

  it("passes through a missing address", () => {
    expect(sanitizeReservationAddress(undefined)).toBeUndefined();
  });
});

describe("countReservationsInWindow", () => {
  it("counts orders created inside the sliding 24h window", () => {
    const now = 10 * RESERVATION_RATE_WINDOW_MS;
    const orders = [{ createdAt: now }, { createdAt: now - RESERVATION_RATE_WINDOW_MS }, { createdAt: now - RESERVATION_RATE_WINDOW_MS - 1 }, {}];
    expect(countReservationsInWindow(orders, now)).toBe(2);
  });
});
