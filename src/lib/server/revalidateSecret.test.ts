import { describe, expect, it } from "vitest";
import { isValidRevalidateSecret } from "./revalidateSecret";

describe("isValidRevalidateSecret", () => {
  it("accepts only an exact, non-empty match", () => {
    expect(isValidRevalidateSecret("abc", "abc")).toBe(true);
    expect(isValidRevalidateSecret("abd", "abc")).toBe(false);
    expect(isValidRevalidateSecret("abcd", "abc")).toBe(false);
    expect(isValidRevalidateSecret(null, "abc")).toBe(false);
    expect(isValidRevalidateSecret("abc", undefined)).toBe(false);
    expect(isValidRevalidateSecret("", "")).toBe(false);
  });
});
