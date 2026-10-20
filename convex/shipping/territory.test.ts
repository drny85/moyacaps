import { describe, expect, it } from "vitest";
import {
  checkFulfillmentTerritory,
  FULFILLMENT_STATES,
  isExcludedTerritory,
  normalizeState,
  outOfTerritoryNote,
} from "./territory";

const at = (state: string, postalCode = "", country = "US") => checkFulfillmentTerritory({ state, postalCode, country });
const exclusionOf = (state: string, postalCode = "", country = "US") => {
  const verdict = at(state, postalCode, country);
  return verdict.inTerritory ? null : verdict.exclusion;
};

describe("checkFulfillmentTerritory", () => {
  it("covers exactly the 50 States plus DC", () => {
    expect(FULFILLMENT_STATES).toHaveLength(51);
    expect(new Set(FULFILLMENT_STATES).size).toBe(51);
  });

  it("accepts the 50 States and DC", () => {
    expect(at("NY", "10456")).toEqual({ inTerritory: true, state: "NY" });
    expect(at("DC", "20001")).toEqual({ inTerritory: true, state: "DC" });
    expect(at("HI", "96813").inTerritory).toBe(true);
    expect(at("AK", "99501").inTerritory).toBe(true);
    expect(at("HI", "96799").inTerritory).toBe(false); // American Samoa's ZIP, whatever the state says
  });

  it("accepts full state names and a missing country", () => {
    expect(at("New York", "10001")).toEqual({ inTerritory: true, state: "NY" });
    expect(at("District of Columbia", "20500")).toEqual({ inTerritory: true, state: "DC" });
    expect(checkFulfillmentTerritory({ state: "ca", postalCode: "90210" })).toEqual({ inTerritory: true, state: "CA" });
  });

  it("refuses military states AA/AE/AP and military ZIPs", () => {
    expect(exclusionOf("AA", "34001")).toBe("military");
    expect(exclusionOf("AE", "09001")).toBe("military");
    expect(exclusionOf("AP", "96201")).toBe("military");
    expect(exclusionOf("NY", "09012")).toBe("military");
  });

  it("refuses US territories by state and by ZIP", () => {
    for (const state of ["PR", "VI", "GU", "MP", "AS", "FM", "MH", "PW", "UM"]) {
      expect(exclusionOf(state)).toBe("us_territory");
    }
    expect(exclusionOf("Puerto Rico", "00901")).toBe("us_territory");
    expect(exclusionOf("", "00601")).toBe("us_territory");
    expect(exclusionOf("FL", "00802")).toBe("us_territory");
    expect(exclusionOf("", "96910")).toBe("us_territory");
  });

  it("refuses international destinations", () => {
    expect(exclusionOf("ON", "M5V 2T6", "CA")).toBe("international");
    expect(exclusionOf("NY", "10001", "MX")).toBe("international");
  });

  it("refuses an empty or unknown state", () => {
    expect(exclusionOf("", "10001")).toBe("unknown_state");
    expect(exclusionOf("XX", "10001")).toBe("unknown_state");
  });

  it("explains every refusal with the territory rule", () => {
    const verdict = at("AE", "09001");
    expect(verdict.inTerritory).toBe(false);
    if (!verdict.inTerritory) expect(verdict.reason).toContain("50 US States and the District of Columbia");
  });
});

describe("isExcludedTerritory", () => {
  it("is the label-flow view of the same rule", () => {
    expect(isExcludedTerritory("DC", "20001", "US")).toEqual({ isExcluded: false });
    expect(isExcludedTerritory("AP", "96601", "US").isExcluded).toBe(true);
    expect(isExcludedTerritory("PR", "00901", "US").reason).toMatch(/US territories \(PR\)/);
  });
});

describe("normalizeState", () => {
  it("maps names to codes and leaves unknown text upper-cased", () => {
    expect(normalizeState(" new  york ")).toBe("NY");
    expect(normalizeState("guam")).toBe("GU");
    expect(normalizeState("Narnia")).toBe("NARNIA");
    expect(normalizeState(undefined)).toBe("");
  });
});

describe("outOfTerritoryNote", () => {
  it("tells the Administrator to refund before packing", () => {
    const verdict = at("PR", "00901");
    if (verdict.inTerritory) throw new Error("expected an exclusion");
    expect(outOfTerritoryNote(verdict, 108.5, "USD")).toBe(
      "⚠️ OUT OF TERRITORY: US territories (PR) are outside the Fulfillment Territory. Good Luck ships only to the 50 US States and the District of Columbia. Paid USD $108.50. Refund before packing; do not ship."
    );
  });
});
