import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import { ReviewList, type PublicReview } from "./ReviewList";
import { StarRating } from "./StarRating";
import { boughtNote, deepLinkTarget, shouldShowCardRating, showWriteReview } from "./reviewView";

const colorways = [{ id: "black", nameEn: "Black", nameEs: "Negro" }];

const review = (over: Partial<PublicReview> = {}): PublicReview => ({
  _id: "r1",
  rating: 5,
  locale: "en",
  displayName: "Ana R.",
  publishedAt: 1_700_000_000_000,
  ...over,
});

function render(reviews: PublicReview[]) {
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale: "en", messages: { Reviews: en.Reviews }, children: createElement(ReviewList, { reviews, colorways, locale: "en" }) }
    )
  );
}

describe("ReviewList", () => {
  it("renders a script-tag title as escaped text", () => {
    const html = render([review({ title: "<script>alert(1)</script>", body: "<img src=x onerror=alert(1)>" })]);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
  });

  it("shows the Bought note for a tee review", () => {
    expect(render([review({ boughtColorway: "black", boughtSize: "L" })])).toContain("Bought: Black / L");
  });

  it("shows the Verified Buyer badge", () => {
    expect(render([review()])).toContain("Verified Buyer");
  });

  it("shows no Bought note for a cap review", () => {
    expect(render([review()])).not.toContain("Bought:");
  });
});

describe("boughtNote", () => {
  it("localizes the colorway and falls back to the raw id", () => {
    expect(boughtNote(review({ boughtColorway: "black", boughtSize: "L" }), colorways, "es")).toBe("Negro / L");
    expect(boughtNote(review({ boughtColorway: "navy", boughtSize: "M" }), colorways, "en")).toBe("navy / M");
    expect(boughtNote(review({ boughtSize: "M" }), colorways, "en")).toBe("M");
    expect(boughtNote(review(), colorways, "en")).toBeNull();
  });
});

describe("showWriteReview", () => {
  it("hides Write a review when canReview is false, signed out, or loading", () => {
    expect(showWriteReview({ canReview: false, review: null })).toBe(false);
    expect(showWriteReview(undefined)).toBe(false);
    expect(showWriteReview({ canReview: true, review: null })).toBe(true);
  });
});

describe("card rating", () => {
  it("renders no stars without a rating", () => {
    expect(shouldShowCardRating(undefined)).toBe(false);
    expect(shouldShowCardRating({ average: 4.5, count: 3 })).toBe(true);
    expect(shouldShowCardRating({ average: 4.5, count: 2 })).toBe(false);
  });

  it("StarRating display renders nothing interactive", () => {
    const html = renderToStaticMarkup(createElement(StarRating, { value: 4.5, label: "4.5 out of 5 stars" }));
    expect(html).toContain('aria-label="4.5 out of 5 stars"');
    expect(html).not.toContain("<input");
  });
});

describe("deepLinkTarget", () => {
  it("picks the first unreviewed product, or none when all are reviewed", () => {
    expect(deepLinkTarget([{ variantId: "a", reviewed: true }, { variantId: "b", reviewed: false }, { variantId: "c", reviewed: false }])).toBe("b");
    expect(deepLinkTarget([{ variantId: "a", reviewed: true }])).toBeNull();
    expect(deepLinkTarget([])).toBeNull();
  });
});
