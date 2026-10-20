import { describe, expect, it } from "vitest";
import { isSimulatedRate, planLabelMode, ratesUnavailableError, shippoKeyMode, shippoPolicy } from "./shippoMode";

describe("shippoKeyMode", () => {
  it("classifies live, test and missing keys", () => {
    expect(shippoKeyMode("shippo_live_abc")).toBe("live");
    expect(shippoKeyMode("  shippo_live_abc  ")).toBe("live");
    expect(shippoKeyMode("shippo_test_abc")).toBe("test");
    expect(shippoKeyMode(undefined)).toBe("none");
    expect(shippoKeyMode("   ")).toBe("none");
    expect(shippoKeyMode("mock")).toBe("none");
    expect(shippoKeyMode("test_dummy")).toBe("none");
  });
});

describe("shippoPolicy", () => {
  it("never allows simulation by default", () => {
    expect(shippoPolicy({ apiKey: "shippo_test_abc" }).allowSimulation).toBe(false);
    expect(shippoPolicy({}).allowSimulation).toBe(false);
  });

  it("allows simulation only when opted in and the key is not live", () => {
    expect(shippoPolicy({ allowSimulation: "true" }).allowSimulation).toBe(true);
    expect(shippoPolicy({ apiKey: "shippo_test_abc", allowSimulation: "TRUE" }).allowSimulation).toBe(true);
    expect(shippoPolicy({ apiKey: "shippo_live_abc", allowSimulation: "true" }).allowSimulation).toBe(false);
    expect(shippoPolicy({ allowSimulation: "yes" }).allowSimulation).toBe(false);
  });
});

describe("planLabelMode", () => {
  const live = shippoPolicy({ apiKey: "shippo_live_abc" });
  const liveOptedIn = shippoPolicy({ apiKey: "shippo_live_abc", allowSimulation: "true" });
  const noKey = shippoPolicy({});
  const devSim = shippoPolicy({ allowSimulation: "true" });

  it("buys a real rate for real with any configured key", () => {
    expect(planLabelMode(live, "rate_123")).toEqual({ ok: true, simulated: false });
    expect(planLabelMode(shippoPolicy({ apiKey: "shippo_test_abc" }), "rate_123")).toEqual({ ok: true, simulated: false });
  });

  it("refuses a simulated rate with a live key, even when opted in", () => {
    expect(planLabelMode(live, "sim_usps_ground_x")).toMatchObject({ ok: false });
    expect(planLabelMode(liveOptedIn, "sim_usps_ground_x")).toMatchObject({ ok: false });
  });

  it("refuses any label without a key unless simulation is allowed", () => {
    expect(planLabelMode(noKey, "rate_123")).toMatchObject({ ok: false });
    expect(planLabelMode(noKey, "sim_usps_ground_x")).toMatchObject({ ok: false });
    expect(planLabelMode(devSim, "sim_usps_ground_x")).toEqual({ ok: true, simulated: true });
  });
});

describe("helpers", () => {
  it("spots simulated rate ids", () => {
    expect(isSimulatedRate("sim_ups_2day_abc")).toBe(true);
    expect(isSimulatedRate("rate_abc")).toBe(false);
  });

  it("explains why rates are missing", () => {
    expect(ratesUnavailableError(shippoPolicy({}))).toMatch(/SHIPPO_API_KEY is missing/);
    expect(ratesUnavailableError(shippoPolicy({ apiKey: "shippo_live_x" }), "Invalid address")).toMatch(/Shippo said: Invalid address/);
  });
});
