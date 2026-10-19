import { describe, expect, it } from "vitest";
import { DEFAULT_SHIPPING_SETTINGS, validateShippingSettings } from "./model";

const ok = { flatShippingFeeUsd: 5, freeShippingThresholdUnits: 3 };

describe("validateShippingSettings", () => {
  it("accepts the defaults and boundary values", () => {
    expect(validateShippingSettings(DEFAULT_SHIPPING_SETTINGS)).toEqual([]);
    expect(validateShippingSettings({ flatShippingFeeUsd: 0, freeShippingThresholdUnits: 1 })).toEqual([]);
    expect(validateShippingSettings({ flatShippingFeeUsd: 100, freeShippingThresholdUnits: 50 })).toEqual([]);
    expect(validateShippingSettings({ ...ok, flatShippingFeeUsd: 7.5 })).toEqual([]);
  });

  it("rejects a negative or oversized fee", () => {
    expect(validateShippingSettings({ ...ok, flatShippingFeeUsd: -1 })).toEqual([{ field: "flatShippingFeeUsd", code: "range" }]);
    expect(validateShippingSettings({ ...ok, flatShippingFeeUsd: 100.01 })).toEqual([{ field: "flatShippingFeeUsd", code: "range" }]);
  });

  it("rejects non-finite fees and more than two decimals", () => {
    expect(validateShippingSettings({ ...ok, flatShippingFeeUsd: NaN })).toHaveLength(1);
    expect(validateShippingSettings({ ...ok, flatShippingFeeUsd: Infinity })).toHaveLength(1);
    expect(validateShippingSettings({ ...ok, flatShippingFeeUsd: 1.005 })).toHaveLength(1);
  });

  it("rejects thresholds that are not integers in 1-50", () => {
    for (const bad of [0, -2, 51, 1.5, NaN]) {
      expect(validateShippingSettings({ ...ok, freeShippingThresholdUnits: bad })).toEqual([
        { field: "freeShippingThresholdUnits", code: "range" },
      ]);
    }
  });

  it("reports both fields at once", () => {
    expect(validateShippingSettings({ flatShippingFeeUsd: -1, freeShippingThresholdUnits: 0 })).toHaveLength(2);
  });
});
