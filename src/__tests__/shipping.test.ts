import { describe, expect, it } from "vitest";
import {
  CAP_BOX_PRESETS,
  getDefaultBoxPreset,
  buildCarrierTrackingUrl,
} from "../../convex/shipping/functions";
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

  it("accurately detects P.O. Box addresses across common formatting variants", async () => {
    const { isPoBoxAddress } = await import("../../convex/shipping/functions");

    expect(isPoBoxAddress("PO Box 1234")).toBe(true);
    expect(isPoBoxAddress("P.O. Box 567")).toBe(true);
    expect(isPoBoxAddress("p.o. box 890")).toBe(true);
    expect(isPoBoxAddress("Post Office Box 42")).toBe(true);
    expect(isPoBoxAddress("Box 101")).toBe(true);
    expect(isPoBoxAddress("123 Main St", "PO Box 99")).toBe(true);

    // Standard residential and commercial addresses should not trigger PO Box detection
    expect(isPoBoxAddress("1 Broadway, Suite 400")).toBe(false);
    expect(isPoBoxAddress("742 Evergreen Terrace")).toBe(false);
    expect(isPoBoxAddress("500 Boxwood Lane")).toBe(false);
  });

  it("strictly validates domestic US 50-state territory and flags Puerto Rico / territories / international", async () => {
    const { isExcludedTerritory } = await import("../../convex/shipping/functions");

    // Valid 50-state domestic US
    expect(isExcludedTerritory("NY", "10004", "US").isExcluded).toBe(false);
    expect(isExcludedTerritory("CA", "90210", "US").isExcluded).toBe(false);
    expect(isExcludedTerritory("FL", "33101", "US").isExcluded).toBe(false);

    // Puerto Rico state & ZIP codes
    expect(isExcludedTerritory("PR", "00901", "US").isExcluded).toBe(true);
    expect(isExcludedTerritory("Puerto Rico", "00901", "US").isExcluded).toBe(true);
    expect(isExcludedTerritory("", "00601", "US").isExcluded).toBe(true);
    expect(isExcludedTerritory("", "00725", "US").isExcluded).toBe(true);

    // US Territories (Guam, USVI, etc.)
    expect(isExcludedTerritory("GU", "96910", "US").isExcluded).toBe(true);
    expect(isExcludedTerritory("VI", "00802", "US").isExcluded).toBe(true);

    // International
    expect(isExcludedTerritory("ON", "M5V 2T6", "CA").isExcluded).toBe(true);
    expect(isExcludedTerritory("London", "SW1A 1AA", "GB").isExcluded).toBe(true);
  });
});
