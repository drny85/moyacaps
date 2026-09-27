import { describe, expect, it } from "vitest";
import {
  CAP_BOX_PRESETS,
  getDefaultBoxPreset,
  buildCarrierTrackingUrl,
} from "../../convex/shipping";
import { getCarrierTrackingUrl } from "../lib/tracking";

describe("Shipping & Packaging Presets", () => {
  it("selects 1-cap standard box for 1 item", () => {
    const preset = getDefaultBoxPreset(1);
    expect(preset.id).toBe("one_cap");
    expect(preset.length).toBe(8);
    expect(preset.width).toBe(8);
    expect(preset.height).toBe(6);
    expect(preset.weight).toBe(8);
  });

  it("selects 2-cap double box for 2 items", () => {
    const preset = getDefaultBoxPreset(2);
    expect(preset.id).toBe("two_caps");
    expect(preset.length).toBe(10);
    expect(preset.width).toBe(8);
    expect(preset.height).toBe(6);
    expect(preset.weight).toBe(13);
  });

  it("selects 3+ cap collector master box for 3 or more items", () => {
    const preset3 = getDefaultBoxPreset(3);
    expect(preset3.id).toBe("three_plus_caps");
    expect(preset3.length).toBe(12);
    expect(preset3.width).toBe(10);
    expect(preset3.height).toBe(8);
    expect(preset3.weight).toBe(20);

    const preset5 = getDefaultBoxPreset(5);
    expect(preset5.id).toBe("three_plus_caps");
  });

  it("builds correct live tracking URLs for all major couriers", () => {
    const uspsUrl = buildCarrierTrackingUrl("USPS", "9400111899223344556677");
    expect(uspsUrl).toContain("tools.usps.com");
    expect(uspsUrl).toContain("9400111899223344556677");

    const upsUrl = buildCarrierTrackingUrl("UPS", "1Z9999999999999999");
    expect(upsUrl).toContain("ups.com/track");
    expect(upsUrl).toContain("1Z9999999999999999");

    const fedexUrl = buildCarrierTrackingUrl("FedEx", "794999999999");
    expect(fedexUrl).toContain("fedex.com/fedextrack");
    expect(fedexUrl).toContain("794999999999");

    const dhlUrl = buildCarrierTrackingUrl("DHL Express", "1234567890");
    expect(dhlUrl).toContain("dhl.com");
    expect(dhlUrl).toContain("1234567890");

    expect(buildCarrierTrackingUrl("Unknown", "")).toBeNull();
  });

  it("lib/tracking getCarrierTrackingUrl matches convex implementation", () => {
    const trk = "9400111899223344556677";
    expect(getCarrierTrackingUrl("USPS", trk)).toBe(buildCarrierTrackingUrl("USPS", trk));
  });
});
