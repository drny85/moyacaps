import { describe, expect, it } from "vitest";
import { CAP_VARIANTS } from "../../data/caps";
import { ALL_LIVE } from "../launch";
import { SUPPORT_EMAIL } from "../legal";
import { buildLlmsTxt } from "./llms";

const BASE = "https://example.com";
const cap = CAP_VARIANTS.find((p) => p.silhouette !== "tee")!;
const tee = CAP_VARIANTS.find((p) => p.silhouette === "tee")!;
const SHIPPING = { flatShippingFeeUsd: 8, freeShippingThresholdUnits: 2 };

describe("llms.txt", () => {
  const txt = buildLlmsTxt({ products: [cap, tee], launches: ALL_LIVE, shipping: SHIPPING, base: BASE });

  it("starts with the brand as an H1 and a blockquote summary", () => {
    const [h1, , summary] = txt.split("\n");
    expect(h1).toBe("# Good Luck");
    expect(summary.startsWith("> ")).toBe(true);
  });

  it("links each live product with its price", () => {
    expect(txt).toContain(`[${tee.nameEn}](${BASE}/en/products/${tee.id}): $${tee.priceUsd} USD`);
    expect(txt).toContain(`${BASE}/en/products/${cap.id}`);
  });

  it("leaves out products and Try-On of a non-live category, and says what is coming", () => {
    const capsSoon = { headwear: { status: "coming_soon" as const }, apparel: { status: "live" as const } };
    const gated = buildLlmsTxt({ products: [cap, tee], launches: capsSoon, shipping: SHIPPING, base: BASE });
    expect(gated).not.toContain(`/products/${cap.id}`);
    expect(gated).not.toContain("/try-on");
    expect(gated).toMatch(/Caps: coming soon/);
    expect(gated).toContain(`/products/${tee.id}`);
  });

  it("leaves out hidden products", () => {
    const hidden = buildLlmsTxt({ products: [{ ...tee, isAvailable: false }], launches: ALL_LIVE, shipping: SHIPPING, base: BASE });
    expect(hidden).not.toContain(`/products/${tee.id}`);
  });

  it("states shipping, policies and contact", () => {
    expect(txt).toContain("$8.00");
    expect(txt).toMatch(/free on 2 or more items/);
    expect(txt).toContain(`${BASE}/en/terms`);
    expect(txt).toContain(`${BASE}/en/privacy`);
    expect(txt).toContain(SUPPORT_EMAIL);
    expect(txt).toContain("https://www.instagram.com/goodluckcaps/");
  });

  it("still describes the store when the catalog is unavailable", () => {
    const bare = buildLlmsTxt({ products: [], launches: undefined, shipping: undefined, base: BASE });
    expect(bare).toContain("# Good Luck");
    expect(bare).toContain(SUPPORT_EMAIL);
    expect(bare).not.toContain("/products/");
    expect(bare).not.toContain("$8.00");
  });
});
