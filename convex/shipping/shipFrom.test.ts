import { describe, expect, it } from "vitest";
import { SHIP_FROM_ENV, parseShipFrom } from "./shipFrom";

const full = {
  SHIP_FROM_NAME: "Good Luck Atelier",
  SHIP_FROM_COMPANY: "Example Shop",
  SHIP_FROM_STREET1: "1 Example St",
  SHIP_FROM_CITY: "Bronx",
  SHIP_FROM_STATE: "NY",
  SHIP_FROM_ZIP: "10001",
  SHIP_FROM_PHONE: "(555) 010-0100",
  SHIP_FROM_EMAIL: "orders@example.com",
};

describe("parseShipFrom", () => {
  it("builds the Shippo address from the deployment's env, digits-only phone, US by default", () => {
    expect(parseShipFrom(full)).toEqual({
      ok: true,
      address: {
        name: "Good Luck Atelier",
        company: "Example Shop",
        street1: "1 Example St",
        street2: undefined,
        city: "Bronx",
        state: "NY",
        zip: "10001",
        country: "US",
        phone: "5550100100",
        email: "orders@example.com",
      },
    });
  });

  it("keeps an optional second line and company", () => {
    const parsed = parseShipFrom({ ...full, SHIP_FROM_STREET2: "Suite 2", SHIP_FROM_COMPANY: " " });
    expect(parsed.ok && parsed.address).toMatchObject({ street2: "Suite 2", company: undefined });
  });

  it("names every required variable that is missing or blank", () => {
    expect(parseShipFrom({ ...full, SHIP_FROM_STREET1: " ", SHIP_FROM_ZIP: undefined })).toEqual({ ok: false, missing: ["SHIP_FROM_STREET1", "SHIP_FROM_ZIP"] });
    expect(parseShipFrom({})).toEqual({ ok: false, missing: SHIP_FROM_ENV.required });
  });

  it("rejects a phone that is not 10 digits", () => {
    expect(parseShipFrom({ ...full, SHIP_FROM_PHONE: "12345" })).toEqual({ ok: false, missing: ["SHIP_FROM_PHONE"] });
  });
});
