import { describe, expect, it } from "vitest";
import { shouldGuardClick } from "./navigationGuard";

const HERE = "https://goodluckcaps.com/en/admin/products/negro-rojo";
const plain = { meta: false, ctrl: false, shift: false, alt: false, button: 0 };

describe("shouldGuardClick", () => {
  it("guards a plain click to another in-app page", () => {
    expect(shouldGuardClick({ href: "/en/admin/products" }, plain, HERE)).toBe(true);
    expect(shouldGuardClick({ href: "https://goodluckcaps.com/en/admin/orders" }, plain, HERE)).toBe(true);
    expect(shouldGuardClick({ href: "/en/admin/products/negro-rojo?tab=x" }, plain, HERE)).toBe(true);
  });

  it("lets the same page and its anchors through", () => {
    expect(shouldGuardClick({ href: "/en/admin/products/negro-rojo" }, plain, HERE)).toBe(false);
    expect(shouldGuardClick({ href: "#images" }, plain, HERE)).toBe(false);
  });

  it("lets new tabs, downloads and other sites through", () => {
    expect(shouldGuardClick({ href: "/en/products/negro-rojo", target: "_blank" }, plain, HERE)).toBe(false);
    expect(shouldGuardClick({ href: "/file.csv", download: true }, plain, HERE)).toBe(false);
    expect(shouldGuardClick({ href: "https://stripe.com" }, plain, HERE)).toBe(false);
    expect(shouldGuardClick({ href: "mailto:a@b.c" }, plain, HERE)).toBe(false);
  });

  it("lets modified and non-left clicks through", () => {
    expect(shouldGuardClick({ href: "/en/admin" }, { ...plain, meta: true }, HERE)).toBe(false);
    expect(shouldGuardClick({ href: "/en/admin" }, { ...plain, ctrl: true }, HERE)).toBe(false);
    expect(shouldGuardClick({ href: "/en/admin" }, { ...plain, shift: true }, HERE)).toBe(false);
    expect(shouldGuardClick({ href: "/en/admin" }, { ...plain, button: 1 }, HERE)).toBe(false);
  });
});
