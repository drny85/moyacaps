import { describe, expect, it } from "vitest";
import { timeRemaining } from "./countdown";

describe("timeRemaining", () => {
  it("clamps at zero and flags isLive", () => {
    expect(timeRemaining(1000, 2000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, isLive: true });
    expect(timeRemaining(1000, 1000)).toMatchObject({ totalMs: 0, isLive: true });
  });

  it("splits the remaining time into days, hours, minutes and seconds", () => {
    expect(timeRemaining(90_061_000, 0)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1, totalMs: 90_061_000, isLive: false });
  });
});
