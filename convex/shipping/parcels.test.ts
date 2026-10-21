import { describe, expect, it } from "vitest";
import {
  countParcelLines,
  getParcelPreset,
  insuranceFor,
  PARCEL_PRESETS,
  presetName,
  presetToParcel,
  suggestParcel,
  type ParcelLine,
} from "./parcels";

const caps = (quantity: number): ParcelLine => ({ category: "headwear", quantity });
const tees = (quantity: number): ParcelLine => ({ category: "apparel", quantity });

describe("PARCEL_PRESETS", () => {
  it("declares outside dimensions and packed weights", () => {
    const byId = Object.fromEntries(PARCEL_PRESETS.map((p) => [p.id, p]));
    expect(presetToParcel(byId.one_cap)).toEqual({ length: 8.25, width: 8.25, height: 6.25, weight: 12, unit: "in" });
    expect(presetToParcel(byId.two_caps)).toEqual({ length: 10.25, width: 8.25, height: 6.25, weight: 19, unit: "in" });
    expect(presetToParcel(byId.three_plus_caps)).toEqual({ length: 12.25, width: 10.25, height: 8.25, weight: 28, unit: "in" });
    expect(presetToParcel(byId.one_tee_mailer)).toEqual({ length: 13, width: 10, height: 1, weight: 13, unit: "in" });
    expect(presetToParcel(byId.two_tees_mailer)).toEqual({ length: 15.5, width: 12, height: 2, weight: 26, unit: "in" });
    expect(presetToParcel(byId.cap_and_tee)).toEqual({ length: 10.25, width: 8.25, height: 6.25, weight: 24, unit: "in" });
  });

  it("has unique ids and names in both locales", () => {
    expect(new Set(PARCEL_PRESETS.map((p) => p.id)).size).toBe(PARCEL_PRESETS.length);
    for (const p of PARCEL_PRESETS) {
      expect(presetName(p, "en")).toBe(p.nameEn);
      expect(presetName(p, "es")).toBe(p.nameEs);
      expect(p.nameEn).not.toBe(p.nameEs);
    }
  });
});

describe("countParcelLines", () => {
  it("counts caps and tees separately and treats unknown categories as caps", () => {
    expect(countParcelLines([caps(2), tees(1), { category: "headwear", quantity: 1 }])).toEqual({ caps: 3, tees: 1 });
  });

  it("ignores negative or fractional quantities", () => {
    expect(countParcelLines([caps(-1), tees(1.9)])).toEqual({ caps: 0, tees: 1 });
  });
});

describe("suggestParcel", () => {
  it("1 cap → one_cap", () => expect(suggestParcel([caps(1)]).id).toBe("one_cap"));
  it("2 caps → two_caps", () => expect(suggestParcel([caps(2)]).id).toBe("two_caps"));
  it("2 caps on two lines → two_caps", () => expect(suggestParcel([caps(1), caps(1)]).id).toBe("two_caps"));
  it("3 caps → master box", () => expect(suggestParcel([caps(3)]).id).toBe("three_plus_caps"));
  it("1 tee → one_tee_mailer", () => expect(suggestParcel([tees(1)]).id).toBe("one_tee_mailer"));
  it("2 tees → two_tees_mailer", () => expect(suggestParcel([tees(2)]).id).toBe("two_tees_mailer"));
  it("cap + tee → cap_and_tee (two-cap box at 24 oz)", () => {
    const preset = suggestParcel([caps(1), tees(1)]);
    expect(preset.id).toBe("cap_and_tee");
    expect(preset.weight).toBe(24);
    expect(preset.length).toBe(10.25);
  });
  it("4+ mixed → master box", () => {
    expect(suggestParcel([caps(2), tees(2)]).id).toBe("three_plus_caps");
    expect(suggestParcel([caps(3), tees(1)]).id).toBe("three_plus_caps");
    expect(suggestParcel([caps(1), tees(3)]).id).toBe("three_plus_caps");
  });
  it("3 tees → master box (no mailer fits)", () => expect(suggestParcel([tees(3)]).id).toBe("three_plus_caps"));
  it("empty order → one_cap fallback", () => expect(suggestParcel([]).id).toBe("one_cap"));
  it("never puts a cap in a mailer", () => {
    for (const line of [[caps(1), tees(1)], [caps(2), tees(1)], [caps(1), tees(2)]]) {
      expect(suggestParcel(line).id).not.toMatch(/mailer/);
    }
  });
});

describe("insuranceFor", () => {
  it("adds nothing at or under $100", () => {
    expect(insuranceFor(100)).toBeUndefined();
    expect(insuranceFor(42.5)).toBeUndefined();
  });
  it("covers the order total above $100 in USD as Apparel", () => {
    expect(insuranceFor(100.01)).toEqual({ amount: "100.01", currency: "USD", content: "Apparel" });
    expect(insuranceFor(240)).toEqual({ amount: "240.00", currency: "USD", content: "Apparel" });
  });
});

describe("getParcelPreset", () => {
  it("returns undefined for an unknown id", () => expect(getParcelPreset("nope")).toBeUndefined());
});
