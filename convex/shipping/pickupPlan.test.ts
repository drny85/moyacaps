import { describe, expect, it } from "vitest";
import {
  groupPickupCandidates,
  isPickupDay,
  nextPickupDate,
  pickupAddress,
  pickupBlocksDate,
  pickupRoute,
  planPickupMode,
  planPickupRequest,
  type PickupCandidate,
} from "./pickupPlan";
import { shippoPolicy } from "./shippoMode";

const candidate = (over: Partial<PickupCandidate>): PickupCandidate => ({
  orderId: "o1",
  orderNumber: "GL-1001",
  carrier: "USPS",
  serviceLevel: "Priority Mail",
  transactionId: "tx_1",
  ...over,
});

describe("pickupRoute", () => {
  it("sends Priority, Express, international and return USPS labels through the API", () => {
    expect(pickupRoute("USPS", "Priority Mail")).toBe("api");
    expect(pickupRoute("usps", "Priority Mail Express")).toBe("api");
    expect(pickupRoute("USPS", "Priority Mail International")).toBe("api");
    expect(pickupRoute("USPS", "First-Class Package International Service")).toBe("api");
    expect(pickupRoute("USPS", "Ground Advantage Return")).toBe("api");
  });

  it("sends Ground Advantage and unknown USPS services to usps.com", () => {
    expect(pickupRoute("USPS", "Ground Advantage")).toBe("usps_site");
    expect(pickupRoute("USPS", "USPS Ground Advantage")).toBe("usps_site");
    expect(pickupRoute("USPS", undefined)).toBe("usps_site");
  });

  it("leaves other carriers out", () => {
    expect(pickupRoute("UPS", "UPS Ground")).toBe("not_usps");
    expect(pickupRoute(undefined, "Priority Mail")).toBe("not_usps");
  });
});

describe("groupPickupCandidates", () => {
  it("splits waiting packages by route and drops other carriers", () => {
    const groups = groupPickupCandidates([
      candidate({ orderId: "a" }),
      candidate({ orderId: "b", serviceLevel: "Ground Advantage" }),
      candidate({ orderId: "c", carrier: "UPS", serviceLevel: "UPS Ground" }),
    ]);
    expect(groups.api.map((c) => c.orderId)).toEqual(["a"]);
    expect(groups.uspsSite.map((c) => c.orderId)).toEqual(["b"]);
  });

  it("sends an eligible label without a Shippo transaction to usps.com", () => {
    const groups = groupPickupCandidates([candidate({ transactionId: undefined })]);
    expect(groups.api).toEqual([]);
    expect(groups.uspsSite).toHaveLength(1);
  });
});

describe("pickup days", () => {
  it("USPS Package Pickup runs Monday to Saturday", () => {
    expect(isPickupDay("2026-10-24")).toBe(true); // Saturday
    expect(isPickupDay("2026-10-25")).toBe(false); // Sunday
    expect(isPickupDay("2026-10-26")).toBe(true); // Monday
    expect(isPickupDay("2026-13-01")).toBe(false);
    expect(isPickupDay("tomorrow")).toBe(false);
  });

  it("the next pickup date is tomorrow, skipping Sunday", () => {
    expect(nextPickupDate(new Date(2026, 9, 22, 15, 0))).toBe("2026-10-23"); // Thu -> Fri
    expect(nextPickupDate(new Date(2026, 9, 24, 9, 0))).toBe("2026-10-26"); // Sat -> Mon
    expect(nextPickupDate(new Date(2026, 11, 31, 9, 0))).toBe("2027-01-01");
  });
});

describe("pickupAddress", () => {
  it("strips the special characters carriers refuse, keeping the email intact", () => {
    const address = pickupAddress({
      name: "Good Luck / Atelier",
      company: "Moya & Caps*",
      street1: "12 Main St #4",
      city: "New York",
      state: "NY",
      zip: "10001",
      country: "US",
      phone: "2125550100",
      email: "orders+pickup@example.com",
    });
    expect(address.name).toBe("Good Luck Atelier");
    expect(address.company).toBe("Moya Caps");
    expect(address.street1).toBe("12 Main St #4");
    expect(address.email).toBe("orders+pickup@example.com");
  });
});

describe("pickupBlocksDate", () => {
  it("a failed or cancelled pickup does not use up the day", () => {
    expect(pickupBlocksDate("CONFIRMED")).toBe(true);
    expect(pickupBlocksDate("PENDING")).toBe(true);
    expect(pickupBlocksDate("ERROR")).toBe(false);
    expect(pickupBlocksDate("CANCELLED")).toBe(false);
  });
});

describe("planPickupRequest", () => {
  const now = new Date(2026, 9, 22, 15, 0).getTime();
  const start = new Date(2026, 9, 23, 9, 0).getTime();
  const end = new Date(2026, 9, 23, 17, 0).getTime();
  const base = {
    pickupDate: "2026-10-23",
    requestedStartTime: start,
    requestedEndTime: end,
    location: "Front Door" as const,
    apiCount: 2,
    alreadyScheduled: false,
    nowMs: now,
  };

  it("accepts a valid request", () => {
    expect(planPickupRequest(base)).toEqual({ ok: true });
  });

  it("needs at least one API-eligible package", () => {
    const plan = planPickupRequest({ ...base, apiCount: 0 });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.error).toMatch(/usps\.com/);
  });

  it("allows one pickup per day", () => {
    const plan = planPickupRequest({ ...base, alreadyScheduled: true });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.error).toMatch(/one pickup per day/);
  });

  it("refuses Sundays, past windows and inverted windows", () => {
    expect(planPickupRequest({ ...base, pickupDate: "2026-10-25" }).ok).toBe(false);
    expect(planPickupRequest({ ...base, nowMs: end + 1 }).ok).toBe(false);
    expect(planPickupRequest({ ...base, requestedEndTime: start }).ok).toBe(false);
  });

  it("needs instructions when the location is Other", () => {
    expect(planPickupRequest({ ...base, location: "Other" }).ok).toBe(false);
    expect(planPickupRequest({ ...base, location: "Other", instructions: "  " }).ok).toBe(false);
    expect(planPickupRequest({ ...base, location: "Other", instructions: "Side gate" }).ok).toBe(true);
  });
});

describe("planPickupMode", () => {
  const live = shippoPolicy({ apiKey: "shippo_live_abc" });
  const testOptedIn = shippoPolicy({ apiKey: "shippo_test_abc", allowSimulation: "true" });
  const none = shippoPolicy({});

  it("schedules real pickups for real labels", () => {
    expect(planPickupMode(live, ["tx_1"])).toEqual({ ok: true, simulated: false });
  });

  it("simulates only when the deployment allows it", () => {
    expect(planPickupMode(testOptedIn, ["sim_tx_1"])).toEqual({ ok: true, simulated: true });
    expect(planPickupMode(shippoPolicy({ allowSimulation: "true" }), ["tx_1"])).toEqual({ ok: true, simulated: true });
    expect(planPickupMode(live, ["sim_tx_1"]).ok).toBe(false);
    expect(planPickupMode(none, ["tx_1"]).ok).toBe(false);
  });
});
