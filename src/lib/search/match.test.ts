import { describe, expect, it } from "vitest";
import { allowedTypos, editDistance, MATCH, scoreWord } from "./match";
import { normalize, tokenize } from "./normalize";

describe("normalize", () => {
  it("folds case, accents and punctuation", () => {
    expect(normalize("Gorra Café — Edición")).toBe("gorra cafe edicion");
    expect(tokenize("Eagle & Clover")).toEqual(["eagle", "and", "clover"]);
    expect(tokenize("8-Ball")).toEqual(["8", "ball"]);
    expect(tokenize("Kid's")).toEqual(["kids"]);
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("editDistance", () => {
  it("counts insertions, deletions, substitutions and swaps", () => {
    expect(editDistance("skull", "skull", 2)).toBe(0);
    expect(editDistance("skul", "skull", 2)).toBe(1);
    expect(editDistance("skoll", "skull", 2)).toBe(1);
    expect(editDistance("sklul", "skull", 2)).toBe(1);
    expect(editDistance("gotic", "gothic", 2)).toBe(1);
  });

  it("stops past the cutoff", () => {
    expect(editDistance("butterfly", "boxing", 2)).toBe(3);
    expect(editDistance("a", "abcdef", 1)).toBe(2);
  });
});

describe("scoreWord", () => {
  it("ranks exact over prefix over substring over typo", () => {
    expect(scoreWord("skull", "skull")).toBe(MATCH.exact);
    expect(scoreWord("sku", "skull")).toBe(MATCH.prefix);
    expect(scoreWord("ull", "skull")).toBe(MATCH.substring);
    expect(scoreWord("skul", "skulls")).toBe(MATCH.prefix);
    expect(scoreWord("skoll", "skull")).toBeGreaterThan(0);
    expect(scoreWord("skoll", "skull")).toBeLessThan(MATCH.substring);
  });

  it("tolerates a typo in a word still being typed", () => {
    expect(scoreWord("gotic", "gothic")).toBeGreaterThan(0);
    expect(scoreWord("eagel", "eagle")).toBeGreaterThan(0);
    expect(scoreWord("buterfly", "butterfly")).toBeGreaterThan(0);
  });

  it("does not fuzz short words", () => {
    expect(allowedTypos(3)).toBe(0);
    expect(scoreWord("cat", "cap")).toBe(0);
    expect(scoreWord("xy", "skull")).toBe(0);
  });

  it("allows more in the loose pass", () => {
    expect(scoreWord("skoal", "skull")).toBe(0);
    expect(scoreWord("skoal", "skull", true)).toBeGreaterThan(0);
  });
});
