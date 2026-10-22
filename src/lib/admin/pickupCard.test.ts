import { describe, expect, it } from "vitest";
import { localDay, localTimeMs, pickupCardView } from "./pickupCard";

describe("localDay", () => {
  it("formats the local day", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("localTimeMs", () => {
  it("reads a local date and time", () => {
    expect(localTimeMs("2026-10-23", "09:30")).toBe(new Date(2026, 9, 23, 9, 30).getTime());
  });

  it("is NaN for malformed input", () => {
    expect(localTimeMs("10/23/2026", "09:30")).toBeNaN();
    expect(localTimeMs("2026-10-23", "9am")).toBeNaN();
  });
});

describe("pickupCardView", () => {
  const pkg = (id: string) => ({ orderId: id });

  it("is hidden with nothing waiting and nothing scheduled", () => {
    expect(pickupCardView({ api: [], uspsSite: [], upcoming: [] }, "2026-10-23").hidden).toBe(true);
  });

  it("schedules when Priority packages wait and the day is free", () => {
    const view = pickupCardView({ api: [pkg("a")], uspsSite: [], upcoming: [] }, "2026-10-23");
    expect(view).toMatchObject({ hidden: false, apiCount: 1, canSchedule: true, canRideAlong: false });
  });

  it("refuses a day that already has a pickup", () => {
    const view = pickupCardView({ api: [pkg("a")], uspsSite: [], upcoming: [{ pickupDate: "2026-10-23" }] }, "2026-10-23");
    expect(view.dateTaken).toBe(true);
    expect(view.canSchedule).toBe(false);
  });

  it("Ground Advantage alone goes to usps.com; with a Priority pickup it can ride along", () => {
    expect(pickupCardView({ api: [], uspsSite: [pkg("b")], upcoming: [] }, "2026-10-23")).toMatchObject({
      hidden: false,
      canSchedule: false,
      canRideAlong: false,
      uspsSiteCount: 1,
    });
    expect(pickupCardView({ api: [pkg("a")], uspsSite: [pkg("b")], upcoming: [] }, "2026-10-23").canRideAlong).toBe(true);
    expect(pickupCardView({ api: [], uspsSite: [pkg("b")], upcoming: [{ pickupDate: "2026-10-23" }] }, "2026-10-24").canRideAlong).toBe(true);
  });
});
