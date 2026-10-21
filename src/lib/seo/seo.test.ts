import { describe, expect, it } from "vitest";
import { CAP_VARIANTS, type CapVariant } from "../../data/caps";
import { absoluteUrl, languageAlternates, pageAlternates, siteUrl } from "./site";
import { breadcrumbJsonLd, organizationJsonLd, productDescription, productJsonLd, returnPolicyJsonLd, serializeJsonLd, websiteJsonLd } from "./jsonLd";
import { SUPPORT_EMAIL } from "../legal";
import { buildSitemap, NONE_LIVE, STATIC_PAGES } from "./sitemap";
import { ALL_LIVE } from "../launch";

const BASE = "https://example.com";
const NOW = new Date("2026-10-19T00:00:00Z");
const cap = CAP_VARIANTS.find((p) => p.silhouette !== "tee")!;
const tee = CAP_VARIANTS.find((p) => p.silhouette === "tee")!;

describe("site urls", () => {
  it("strips trailing slashes and falls back to the default origin", () => {
    expect(siteUrl("https://example.com//")).toBe(BASE);
    expect(siteUrl(undefined)).toBe("https://goodluckcaps.com");
  });

  it("keeps absolute asset urls and prefixes relative ones", () => {
    expect(absoluteUrl("https://cdn.convex.cloud/a.png", BASE)).toBe("https://cdn.convex.cloud/a.png");
    expect(absoluteUrl("/og/home.jpg", BASE)).toBe(`${BASE}/og/home.jpg`);
    expect(absoluteUrl("og/home.jpg", BASE)).toBe(`${BASE}/og/home.jpg`);
  });

  it("builds a self canonical with every locale plus x-default", () => {
    expect(pageAlternates("es", "/products", BASE)).toEqual({
      canonical: `${BASE}/es/products`,
      languages: { en: `${BASE}/en/products`, es: `${BASE}/es/products`, "x-default": `${BASE}/en/products` },
    });
    expect(languageAlternates("", BASE)["x-default"]).toBe(`${BASE}/en`);
  });
});

describe("structured data", () => {
  it("describes a product with an absolute image, localized name and a valid offer", () => {
    const ld = productJsonLd(cap, "es", BASE, NOW) as any;
    expect(ld["@type"]).toBe("Product");
    expect(ld.name).toBe(cap.nameEs);
    expect(ld.url).toBe(`${BASE}/es/products/${cap.id}`);
    expect(ld.image.every((u: string) => u.startsWith("http"))).toBe(true);
    expect(new Set(ld.image).size).toBe(ld.image.length);
    expect(ld.offers.price).toBe(cap.priceUsd.toFixed(2));
    expect(ld.offers.priceValidUntil).toBe("2027-10-19");
  });

  it("marks sold-out products OutOfStock and tees as shirts", () => {
    const soldOut: CapVariant = { ...tee, stock: 0 };
    const ld = productJsonLd(soldOut, "en", BASE, NOW) as any;
    expect(ld.offers.availability).toBe("https://schema.org/OutOfStock");
    expect(ld.category).toContain("Shirts");
  });

  it("numbers breadcrumb positions from 1", () => {
    const ld = breadcrumbJsonLd([
      { name: "Home", url: `${BASE}/en` },
      { name: "Shop", url: `${BASE}/en/products` },
    ]) as any;
    expect(ld.itemListElement.map((i: any) => i.position)).toEqual([1, 2]);
  });

  it("adds US shipping details from store settings, and none without them", () => {
    const ld = productJsonLd(tee, "en", BASE, NOW, { flatShippingFeeUsd: 8, freeShippingThresholdUnits: 2 }) as any;
    const shipping = ld.offers.shippingDetails;
    expect(shipping.shippingRate).toEqual({ "@type": "MonetaryAmount", value: "8.00", currency: "USD" });
    expect(shipping.shippingDestination.addressCountry).toBe("US");
    expect(shipping.deliveryTime.transitTime).toMatchObject({ minValue: 2, maxValue: 5, unitCode: "DAY" });
    expect((productJsonLd(tee, "en", BASE, NOW) as any).offers).not.toHaveProperty("shippingDetails");
  });

  describe("review ratings", () => {
    const review = (over: Record<string, unknown> = {}) =>
      ({
        _id: "r1", _creationTime: 0, variantId: cap.id, rating: 5, locale: "en", displayName: "Ana M.",
        publishedAt: Date.UTC(2026, 9, 15, 23, 30), ...over,
      }) as any;

    it("omits aggregateRating and review without reviews", () => {
      const ld = productJsonLd(cap, "en", BASE, NOW) as any;
      expect(ld).not.toHaveProperty("aggregateRating");
      expect(ld).not.toHaveProperty("review");
      const zero = productJsonLd(cap, "en", BASE, NOW, undefined, { summary: { average: 0, count: 0 }, latest: [] }) as any;
      expect(zero).not.toHaveProperty("aggregateRating");
      expect(zero).not.toHaveProperty("review");
    });

    it("adds aggregateRating and review items", () => {
      const ld = productJsonLd(cap, "en", BASE, NOW, undefined, {
        summary: { average: 4.7, count: 3 },
        latest: [review({ title: "Great", body: "Love it" }), review({ _id: "r2", rating: 4, displayName: "Bo" })],
      }) as any;
      expect(ld.aggregateRating).toEqual({ "@type": "AggregateRating", ratingValue: 4.7, reviewCount: 3, bestRating: 5, worstRating: 1 });
      expect(ld.review).toHaveLength(2);
      expect(ld.review[0]).toEqual({
        "@type": "Review",
        author: { "@type": "Person", name: "Ana M." },
        reviewRating: { "@type": "Rating", ratingValue: 5, bestRating: 5, worstRating: 1 },
        datePublished: "2026-10-15",
        name: "Great",
        reviewBody: "Love it",
      });
      expect(ld.review[1].reviewRating.ratingValue).toBe(4);
      expect(ld.review[1]).not.toHaveProperty("name");
      expect(ld.review[1]).not.toHaveProperty("reviewBody");
    });

    it("keeps a </script> review body from breaking out of the tag", () => {
      const ld = productJsonLd(cap, "en", BASE, NOW, undefined, {
        summary: { average: 1, count: 1 },
        latest: [review({ body: "</script><script>alert(1)</script>" })],
      });
      const out = serializeJsonLd(ld);
      expect(out).not.toContain("</script>");
      expect(out).toContain("\\u003c/script>");
    });
  });

  it("states the final-sale return policy on every offer and the organization, linking the page", () => {
    const policy = returnPolicyJsonLd("es", BASE) as any;
    expect(policy).toEqual({
      "@type": "MerchantReturnPolicy",
      applicableCountry: "US",
      returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
      merchantReturnLink: `${BASE}/es/returns`,
    });
    expect((productJsonLd(cap, "es", BASE, NOW) as any).offers.hasMerchantReturnPolicy).toEqual(policy);
    expect((organizationJsonLd(BASE) as any).hasMerchantReturnPolicy.merchantReturnLink).toBe(`${BASE}/en/returns`);
  });

  it("gives the organization a contact email and names both caps and tees", () => {
    const ld = organizationJsonLd(BASE) as any;
    expect(ld.contactPoint.email).toBe(SUPPORT_EMAIL);
    expect(ld.description).toMatch(/caps/i);
    expect(ld.description).toMatch(/tees/i);
    expect(ld.areaServed).toBe("US");
    expect(ld.sameAs).toEqual(["https://www.instagram.com/goodluckcaps/"]);
    expect(ld.description).toContain("nobody saw anything");
  });

  it("has no sitelinks SearchAction pointing at a product slug", () => {
    expect(websiteJsonLd(BASE)).not.toHaveProperty("potentialAction");
  });

  it("escapes < so data cannot close the script tag", () => {
    expect(serializeJsonLd({ name: "</script><script>alert(1)" })).not.toContain("</script>");
  });
});

describe("sitemap", () => {
  const products = [cap, tee, { ...cap, id: "hidden-one", isAvailable: false }];
  const entries = buildSitemap(products, BASE, NOW, ALL_LIVE);
  const urls = entries.map((e) => e.url);

  it("lists every static page and visible product once per locale", () => {
    expect(entries).toHaveLength((STATIC_PAGES.length + 2) * 2);
    expect(urls).toContain(`${BASE}/es/products/${tee.id}`);
    expect(urls).toContain(`${BASE}/es/about`);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("leaves out hidden products, redirects and private areas", () => {
    expect(urls.some((u) => u.includes("hidden-one"))).toBe(false);
    expect(urls).not.toContain(BASE);
    expect(urls.some((u) => /\/(admin|checkout|account)/.test(u))).toBe(false);
  });

  it("omits the category URL of a non-live category", () => {
    const launches = { headwear: { status: "live" as const }, apparel: { status: "coming_soon" as const } };
    const gated = buildSitemap([cap], BASE, NOW, launches).map((e) => e.url);
    expect(gated).toContain(`${BASE}/en/products?category=caps`);
    expect(gated.some((u) => u.includes("category=tees"))).toBe(false);
    expect(gated).toContain(`${BASE}/en/products`);
  });

  it("omits products of a non-live category", () => {
    const capsSoon = { headwear: { status: "coming_soon" as const }, apparel: { status: "live" as const } };
    const urls = buildSitemap([cap, tee], BASE, NOW, capsSoon).map((e) => e.url);
    expect(urls.some((u) => u.includes(`/products/${cap.id}`))).toBe(false);
    expect(urls).toContain(`${BASE}/en/products/${tee.id}`);
  });

  it("lists only ungated pages when Category Status is unknown", () => {
    const urls = buildSitemap([], BASE, NOW, NONE_LIVE).map((e) => e.url);
    expect(urls).toContain(`${BASE}/en/products`);
    expect(urls.some((u) => /category=|\/try-on/.test(u))).toBe(false);
  });

  it("omits Try-On unless Caps are live", () => {
    const capsHidden = { headwear: { status: "hidden" as const }, apparel: { status: "live" as const } };
    const urls = buildSitemap([tee], BASE, NOW, capsHidden).map((e) => e.url);
    expect(urls.some((u) => u.includes("/try-on"))).toBe(false);
    expect(urls.some((u) => u.includes("category=caps"))).toBe(false);
  });

  it("gives product entries absolute images and hreflang with x-default", () => {
    const entry = entries.find((e) => e.url === `${BASE}/en/products/${cap.id}`)!;
    expect(entry.images?.[0]).toMatch(/^https?:\/\//);
    expect(entry.alternates?.languages).toHaveProperty("x-default");
  });
});

describe("productDescription admin override", () => {
  const base = { id: "x", nameEn: "X", nameEs: "X", silhouette: "snapback", primaryHex: "#000", secondaryHex: "#fff", image: "/x.png", stock: 1, priceUsd: 10 } as const;

  it("uses the Administrator description when set, falling back across locales", () => {
    expect(productDescription({ ...base, descriptionEn: "Custom" }, "es")).toBe("Custom");
  });

  it("states a tee's own fabric instead of a fixed GSM range", () => {
    const shirt = { ...base, silhouette: "tee", fabricEn: "Heavyweight 300 GSM Combed Cotton", fabricEs: "Algodón 300 GSM" } as const;
    expect(productDescription(shirt, "en")).toContain("Heavyweight 300 GSM Combed Cotton");
    expect(productDescription(shirt, "es")).toContain("Algodón 300 GSM");
    expect(productDescription({ ...base, silhouette: "tee" }, "en")).not.toMatch(/GSM/);
  });

  it("keeps the generated copy when the description is blank", () => {
    expect(productDescription({ ...base, descriptionEn: "", descriptionEs: " " }, "en")).toContain("Good Luck 0880 cap");
  });
});
