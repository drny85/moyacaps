import { describe, expect, it } from "vitest";
import { carrierTrackingNumber, isCarrierTrackingNumber } from "./trackingNumber";

describe("Tracking Number", () => {
  it("is a carrier number only when one exists and is not a legacy placeholder", () => {
    expect(isCarrierTrackingNumber("9400111899223344556677")).toBe(true);
    expect(isCarrierTrackingNumber("1Z9999999900000002")).toBe(true);
    expect(isCarrierTrackingNumber("GL-TRK-123456")).toBe(false);
    expect(isCarrierTrackingNumber("")).toBe(false);
    expect(isCarrierTrackingNumber("  ")).toBe(false);
    expect(isCarrierTrackingNumber(undefined)).toBe(false);
  });

  it("hides a legacy GL-TRK placeholder from what Customers see", () => {
    expect(carrierTrackingNumber({ trackingNumber: "GL-TRK-000001" })).toBeUndefined();
    expect(carrierTrackingNumber({})).toBeUndefined();
    expect(carrierTrackingNumber({ trackingNumber: "9400111899000000000001" })).toBe("9400111899000000000001");
  });
});
