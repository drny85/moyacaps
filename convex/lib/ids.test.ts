import { describe, expect, it } from "vitest";
import { generateOrderNumber } from "./ids";

describe("generateOrderNumber", () => {
  it("is GL-, the base36 time, then 8 random digits", () => {
    const now = Date.UTC(2026, 9, 21);
    const number = generateOrderNumber(now);
    expect(number).toMatch(new RegExp(`^GL-${now.toString(36).toUpperCase()}-\\d{8}$`));
    expect(generateOrderNumber(now)).not.toBe(number);
  });
});
