import { describe, expect, it } from "vitest";
import { floorToMinute } from "../hooks/useMinuteClock";

describe("floorToMinute", () => {
  it("drops seconds and milliseconds so every component sends the same clientTime", () => {
    const minute = Date.UTC(2026, 9, 17, 12, 34);
    expect(floorToMinute(minute)).toBe(minute);
    expect(floorToMinute(minute + 59_999)).toBe(minute);
    expect(floorToMinute(minute + 60_000)).toBe(minute + 60_000);
  });
});
