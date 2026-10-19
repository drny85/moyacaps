import { describe, expect, it } from "vitest";
import { nextGridIndex } from "./keyboardNav";

// 4 columns, 10 items: rows [0-3] [4-7] [8-9]
describe("nextGridIndex", () => {
  it("moves left and right within bounds", () => {
    expect(nextGridIndex(0, "ArrowLeft", 4, 10)).toBe(0);
    expect(nextGridIndex(3, "ArrowRight", 4, 10)).toBe(4);
    expect(nextGridIndex(9, "ArrowRight", 4, 10)).toBe(9);
  });

  it("moves up and down by a row", () => {
    expect(nextGridIndex(1, "ArrowUp", 4, 10)).toBe(1);
    expect(nextGridIndex(5, "ArrowUp", 4, 10)).toBe(1);
    expect(nextGridIndex(1, "ArrowDown", 4, 10)).toBe(5);
  });

  it("lands on the last item when the row below is partial", () => {
    expect(nextGridIndex(6, "ArrowDown", 4, 10)).toBe(9);
    expect(nextGridIndex(9, "ArrowDown", 4, 10)).toBe(9);
  });

  it("jumps with Home and End", () => {
    expect(nextGridIndex(5, "Home", 4, 10)).toBe(0);
    expect(nextGridIndex(5, "End", 4, 10)).toBe(9);
  });

  it("stays put with nothing to move to", () => {
    expect(nextGridIndex(0, "ArrowDown", 4, 0)).toBe(0);
  });
});
