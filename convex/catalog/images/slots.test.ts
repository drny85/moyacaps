import { describe, expect, it } from "vitest";
import { isValidSlot, sameSlot } from "./slots";

const tee = ["black", "white"];

describe("isValidSlot", () => {
  it("accepts a tee catalog or lifestyle shot for a known colorway", () => {
    expect(isValidSlot({ role: "catalog", colorway: "black" }, tee)).toBe(true);
    expect(isValidSlot({ role: "lifestyle", colorway: "white" }, tee)).toBe(true);
  });
  it("rejects an unknown colorway, and a colorway on headwear", () => {
    expect(isValidSlot({ role: "catalog", colorway: "red" }, tee)).toBe(false);
    expect(isValidSlot({ role: "catalog", colorway: "black" }, [])).toBe(false);
  });
  it("accepts headwear without a colorway", () => {
    expect(isValidSlot({ role: "catalog" }, [])).toBe(true);
  });
  it("requires angle for the angle role, headwear only", () => {
    expect(isValidSlot({ role: "angle", angle: "front" }, [])).toBe(true);
    expect(isValidSlot({ role: "angle" }, [])).toBe(false);
    expect(isValidSlot({ role: "angle", angle: "front" }, tee)).toBe(false);
  });
  it("rejects angle without the angle role", () => {
    expect(isValidSlot({ role: "catalog", angle: "front" }, [])).toBe(false);
  });
});

describe("sameSlot", () => {
  it("compares role, colorway and angle", () => {
    expect(sameSlot({ role: "catalog", colorway: "a" }, { role: "catalog", colorway: "a" })).toBe(true);
    expect(sameSlot({ role: "catalog", colorway: "a" }, { role: "catalog" })).toBe(false);
    expect(sameSlot({ role: "angle", angle: "left" }, { role: "angle", angle: "right" })).toBe(false);
  });
});
