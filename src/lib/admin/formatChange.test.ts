import { describe, expect, it } from "vitest";
import { formatChange, formatValue } from "./formatChange";

const ctx = { locale: "en", yes: "yes", no: "no" };

describe("formatValue", () => {
  it("renders null as an em dash", () => {
    expect(formatValue("price", null, ctx)).toBe("—");
  });
  it("renders booleans with the supplied copy", () => {
    expect(formatValue("isFeatured", true, ctx)).toBe("yes");
    expect(formatValue("isFeatured", false, { ...ctx, no: "no" })).toBe("no");
  });
  it("renders numbers as-is", () => {
    expect(formatValue("priceUsd", 125, ctx)).toBe("125");
    expect(formatValue("stock", 0, ctx)).toBe("0");
  });
  it("renders strings as-is", () => {
    expect(formatValue("name", "Negro", ctx)).toBe("Negro");
  });
  it("formats dropDate timestamps with the locale", () => {
    const ts = Date.UTC(2026, 0, 15, 12, 0, 0);
    expect(formatValue("dropDate", ts, ctx)).toBe(
      new Date(ts).toLocaleString("en"),
    );
    expect(formatValue("dropDate", ts, { ...ctx, locale: "es" })).toBe(
      new Date(ts).toLocaleString("es"),
    );
  });
  it("renders objects and arrays as JSON", () => {
    expect(formatValue("x", [1, 2], ctx)).toBe("[1,2]");
    expect(formatValue("x", { a: 1 }, ctx)).toBe('{"a":1}');
  });
  it("truncates long JSON to 60 chars with an ellipsis", () => {
    const out = formatValue("x", Array.from({ length: 100 }, (_, i) => i), ctx);
    expect(out).toHaveLength(60);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("formatChange", () => {
  it("joins field, from and to", () => {
    expect(formatChange({ field: "priceUsd", from: 120, to: 125 }, ctx)).toBe(
      "priceUsd: 120 → 125",
    );
  });
  it("shows dash for added fields", () => {
    expect(formatChange({ field: "note", from: null, to: "hi" }, ctx)).toBe(
      "note: — → hi",
    );
  });
});
