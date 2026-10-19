import { describe, expect, it } from "vitest";
import { customDescription } from "./productCopy";

describe("customDescription", () => {
  it("picks the locale's text", () => {
    const p = { descriptionEn: "English", descriptionEs: "Español" };
    expect(customDescription(p, "en")).toBe("English");
    expect(customDescription(p, "es")).toBe("Español");
  });

  it("falls back to the other locale when the chosen one is empty", () => {
    expect(customDescription({ descriptionEn: "English", descriptionEs: "" }, "es")).toBe("English");
    expect(customDescription({ descriptionEn: "  ", descriptionEs: "Español" }, "en")).toBe("Español");
  });

  it("is undefined when both are missing, empty or whitespace", () => {
    expect(customDescription({}, "en")).toBeUndefined();
    expect(customDescription({ descriptionEn: "", descriptionEs: " \n " }, "es")).toBeUndefined();
  });

  it("trims the result", () => {
    expect(customDescription({ descriptionEn: "  Hi  " }, "en")).toBe("Hi");
  });
});
