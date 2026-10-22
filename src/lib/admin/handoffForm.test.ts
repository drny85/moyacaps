import { describe, expect, it } from "vitest";
import { fromLocalInput, summarizeHandoff, toLocalInput } from "./handoffForm";

describe("local time input", () => {
  it("round-trips a local time to the minute", () => {
    const ms = new Date(2026, 9, 22, 15, 7, 42).getTime();
    expect(toLocalInput(ms)).toBe("2026-10-22T15:07");
    expect(fromLocalInput("2026-10-22T15:07")).toBe(new Date(2026, 9, 22, 15, 7).getTime());
  });

  it("is NaN for malformed input", () => {
    expect(fromLocalInput("")).toBeNaN();
    expect(fromLocalInput("10/22/2026 3pm")).toBeNaN();
  });
});

describe("summarizeHandoff", () => {
  it("counts marked orders and lists refusals", () => {
    expect(
      summarizeHandoff([
        { orderNumber: "GL-1", ok: true },
        { orderNumber: "GL-2", ok: false, error: "Already scanned." },
      ])
    ).toEqual({ marked: 1, failures: ["GL-2: Already scanned."] });
  });
});
