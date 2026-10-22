import { describe, expect, it } from "vitest";
import { normalizeOrderNumber, toTrackingQuery } from "./orderLookup";

describe("normalizeOrderNumber", () => {
  it("upper-cases, trims and drops a leading #", () => {
    expect(normalizeOrderNumber("  #gl-0880-12 ")).toBe("GL-0880-12");
  });

  it("keeps a # that is not leading", () => {
    expect(normalizeOrderNumber("gl#12")).toBe("GL#12");
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeOrderNumber("   ")).toBe("");
  });
});

describe("toTrackingQuery", () => {
  it("returns null without an order number", () => {
    expect(toTrackingQuery("")).toBeNull();
    expect(toTrackingQuery(" # ".trim())).toBeNull();
  });

  it("asks for the guest view when no email is given", () => {
    expect(toTrackingQuery("gl-1")).toEqual({ orderNumber: "GL-1" });
    expect(toTrackingQuery("gl-1", "   ")).toEqual({ orderNumber: "GL-1" });
  });

  it("lower-cases and trims the email", () => {
    expect(toTrackingQuery("#gl-1", " Buyer@Example.COM ")).toEqual({
      orderNumber: "GL-1",
      email: "buyer@example.com",
    });
  });
});
