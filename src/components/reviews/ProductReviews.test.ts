import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import { ReviewList, type PublicReview } from "./ReviewList";
import { StarRating } from "./StarRating";
import { ConvexError } from "convex/values";
import { REVIEW_ERRORS } from "../../../convex/reviews/model";
import {
  boughtNote,
  deepLinkTarget,
  reviewErrorKey,
  reviewFormMode,
  shouldShowCardRating,
} from "./reviewView";

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

describe("reviewFormMode", () => {
  it("opens an existing review read-only once the Customer is no longer eligible", () => {
    expect(reviewFormMode({ canReview: true, hasReview: false })).toBe("create");
    expect(reviewFormMode({ canReview: true, hasReview: true })).toBe("edit");
    expect(reviewFormMode({ canReview: false, hasReview: true })).toBe("readOnly");
    expect(reviewFormMode({ canReview: false, hasReview: false })).toBeNull();
  });
});

describe("reviewErrorKey", () => {
  it("maps known server errors to localized keys, else shows the server text or the generic error", () => {
    expect(reviewErrorKey(new ConvexError(REVIEW_ERRORS.notEligible))).toEqual({ key: "errorNotEligible" });
    expect(reviewErrorKey(new ConvexError(REVIEW_ERRORS.accountDeleted))).toEqual({ key: "errorAccount" });
    expect(reviewErrorKey(new ConvexError(REVIEW_ERRORS.signIn))).toEqual({ key: "errorSignIn" });
    expect(reviewErrorKey(new ConvexError(REVIEW_ERRORS.signInToManage))).toEqual({ key: "errorSignIn" });
    expect(reviewErrorKey(new ConvexError("Rating must be 1 to 5."))).toEqual({ text: "Rating must be 1 to 5." });
    expect(reviewErrorKey(new ConvexError({ code: 1 }))).toEqual({ key: "error" });
    expect(reviewErrorKey(new Error("network"))).toEqual({ key: "error" });
  });

  it("every mapped key exists in the Reviews messages", () => {
    for (const key of ["error", "errorNotEligible", "errorAccount", "errorSignIn", "readOnlyNote", "viewReview"]) {
      expect(en.Reviews).toHaveProperty(key);
    }
  });
});
