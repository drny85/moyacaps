import { describe, expect, it } from "vitest";
import { foldText, matchesQuery } from "./productSearch";
import { capRow, teeRow } from "./productFixtures";

describe("foldText", () => {
  it("lower-cases and strips accents", () => {
    expect(foldText("GÓTICO Ñandú")).toBe("gotico nandu");
  });
});

describe("matchesQuery", () => {
  it("matches across accents in either direction", () => {
    expect(matchesQuery(teeRow(), "gotica")).toBe(true);
    expect(matchesQuery(teeRow({ nameEs: "gotica" }), "GÓTICA")).toBe(true);
  });

  it("matches the slug and colorway names", () => {
    expect(matchesQuery(teeRow(), "skull-tee")).toBe(true);
    expect(matchesQuery(teeRow(), "crisp white")).toBe(true);
    expect(matchesQuery(teeRow(), "deslavado")).toBe(true);
  });

  it("needs every token to match", () => {
    expect(matchesQuery(capRow(), "black red")).toBe(true);
    expect(matchesQuery(capRow(), "black blue")).toBe(false);
  });

  it("matches everything for an empty query", () => {
    expect(matchesQuery(capRow(), "   ")).toBe(true);
  });
});
