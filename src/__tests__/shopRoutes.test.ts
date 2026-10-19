import { describe, expect, it } from "vitest";
import { isShopCategory, shopCategoryRewrite } from "../lib/shopRoutes";

describe("shopCategoryRewrite", () => {
  it("serves category views from their prerendered path", () => {
    expect(shopCategoryRewrite("/en/products", "caps")).toBe("/en/products/category/caps");
    expect(shopCategoryRewrite("/es/products/", "tees")).toBe("/es/products/category/tees");
  });

  it("leaves the full Shop, unknown categories and other routes alone", () => {
    expect(shopCategoryRewrite("/en/products", null)).toBeNull();
    expect(shopCategoryRewrite("/en/products", "hats")).toBeNull();
    expect(shopCategoryRewrite("/en/products/negro-rojo", "caps")).toBeNull();
    expect(shopCategoryRewrite("/products", "caps")).toBeNull();
    expect(shopCategoryRewrite("/fr/products", "caps")).toBeNull();
  });
});

describe("isShopCategory", () => {
  it("accepts only caps and tees", () => {
    expect(isShopCategory("caps")).toBe(true);
    expect(isShopCategory("tees")).toBe(true);
    expect(isShopCategory("all")).toBe(false);
    expect(isShopCategory(undefined)).toBe(false);
  });
});
