import { describe, expect, it } from "vitest";
import { buildAutofillSystemPrompt } from "./prompt";
import { catalogContextFrom } from "./context";
import { teeRow } from "./testRows";

const empty = { colorways: [], examples: [], takenSlugs: [] };

describe("buildAutofillSystemPrompt", () => {
  it("lists every stored colorway and each example description", () => {
    const prompt = buildAutofillSystemPrompt(catalogContextFrom([teeRow()]));
    for (const s of ["vintage-black", "Vintage Washed Black", "crisp-white", "#1c1c1c", "A heavyweight skull tee."]) {
      expect(prompt).toContain(s);
    }
  });

  it("carries the store vocabulary", () => {
    const prompt = buildAutofillSystemPrompt(empty);
    for (const s of ["Cap", "Heavyweight Tee", "never call it a hat", "Colorway", "Silhouette"]) expect(prompt).toContain(s);
  });

  it("names the allowed silhouettes and the unrecognized case", () => {
    const prompt = buildAutofillSystemPrompt(empty);
    for (const s of ["snapback", "trucker", "tee", "recognized", "other"]) expect(prompt).toContain(s);
  });

  it("states the field limits", () => {
    const prompt = buildAutofillSystemPrompt(empty);
    expect(prompt).toContain("80");
    expect(prompt).toContain("1000");
  });
});
