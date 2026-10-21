import { describe, expect, it, vi } from "vitest";
import { scrollToElement } from "./scrollToElement";

function element(top: number, height: number) {
  return { getBoundingClientRect: () => ({ top, height }), scrollIntoView: vi.fn() };
}

describe("scrollToElement", () => {
  it("centers the element through Lenis when smooth scrolling is on", () => {
    const lenis = { scrollTo: vi.fn() };
    const el = element(1100, 20);
    scrollToElement(el, { lenis, viewportHeight: 720 });
    expect(lenis.scrollTo).toHaveBeenCalledWith(el, { offset: -350 });
    expect(el.scrollIntoView).not.toHaveBeenCalled();
  });

  it("falls back to native smooth scrolling without Lenis", () => {
    const el = element(1100, 20);
    scrollToElement(el, { lenis: undefined, viewportHeight: 720 });
    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
  });
});
