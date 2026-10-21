import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import en from "../messages/en.json";
import es from "../messages/es.json";

const remaining = (locale: "en" | "es", count: number) =>
  createTranslator({ locale, messages: locale === "en" ? en : es, namespace: "cart" })("freeShippingRemaining", { count });

describe("cart free-shipping progress", () => {
  it("counts items, not caps, since the cart holds tees too", () => {
    expect(remaining("en", 1)).toBe("Add 1 more item for free US shipping");
    expect(remaining("en", 2)).toBe("Add 2 more items for free US shipping");
    expect(remaining("es", 1)).toBe("Agrega 1 artículo más para envío gratis a EE. UU.");
    expect(remaining("es", 2)).toBe("Agrega 2 artículos más para envío gratis a EE. UU.");
  });
});

describe("purchase-flow copy covers caps and tees", () => {
  const caps = { en: /\bcaps?\b/i, es: /\bgorras?\b/i };
  for (const [locale, messages] of [["en", en], ["es", es]] as const) {
    it(`never speaks of caps alone on the way to checkout (${locale})`, () => {
      const lines = [messages.checkout.emptySubtitle, messages.checkout.exploreCta, messages.account.cancelConfirmDesc];
      for (const line of lines) {
        if (caps[locale].test(line)) expect(line).toMatch(/tee|playera/i);
      }
      expect(messages.checkout.exploreCta).not.toMatch(/\d/);
    });
  }
});
