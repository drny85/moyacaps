import { describe, expect, it } from "vitest";
import { wrapFocus } from "../hooks/useFocusTrap";

describe("wrapFocus (modal Tab cycling)", () => {
  it("wraps from the last element to the first, and back with Shift+Tab", () => {
    expect(wrapFocus(4, 5, false)).toBe(0);
    expect(wrapFocus(0, 5, true)).toBe(4);
  });

  it("lets the browser handle moves inside the trap", () => {
    expect(wrapFocus(1, 5, false)).toBeNull();
    expect(wrapFocus(3, 5, true)).toBeNull();
  });

  it("pulls focus back in when it escaped the trap", () => {
    expect(wrapFocus(-1, 5, false)).toBe(0);
    expect(wrapFocus(-1, 5, true)).toBe(4);
  });

  it("does nothing when there is nothing to focus", () => {
    expect(wrapFocus(-1, 0, false)).toBeNull();
  });

  it("a single element keeps focus on itself", () => {
    expect(wrapFocus(0, 1, false)).toBe(0);
    expect(wrapFocus(0, 1, true)).toBe(0);
  });
});
