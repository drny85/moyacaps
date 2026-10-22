import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import {
  buildLineItems,
  buildShippingOptions,
  countLabel,
  customerSessionFields,
  emptyCartError,
  itemSummary,
  lineItemName,
  holdShortageError,
  lineStockError,
  productTaxCode,
  reservationSessionExpiresAt,
  resolveProductTaxCode,
  toStripeAddress,
  validateCartLines,
  MAX_CART_LINES,
  MAX_UNITS_PER_CART,
  MAX_UNITS_PER_LINE,
  type CheckoutVariant,
  type LineStock,
  INVOICE_FOOTER,
} from "./checkoutModel";

const NOW = 1_800_000_000_000;

const tee: CheckoutVariant = {
  variantId: "eagle-clover-tee",
  nameEn: "Eagle Clover Tee",
  nameEs: "Playera Águila Trébol",
  priceUsd: 80,
  image: "/shirts/eagle.jpg",
  silhouette: "tee",
  category: "apparel",
  taxCode: "txcd_30011000",
  colorways: [{ id: "washed-black", nameEn: "Washed Black", nameEs: "Negro Lavado" }],
};
const cap: CheckoutVariant = {
  variantId: "negro-rojo",
  nameEn: "Black / Red",
  nameEs: "Negro / Rojo",
  priceUsd: 120,
  image: "/caps/negro-rojo.png",
  silhouette: "snapback",
  category: "headwear",
};
const inStock = (available: number): LineStock => ({ ok: true, available });

function errorOf(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ConvexError);
    return (e as ConvexError<string>).data;
  }
  throw new Error("expected a ConvexError");
}

describe("lineItemName", () => {
  it("appends size and the colorway's display name in the cart locale", () => {
    expect(lineItemName(tee, "en", "washed-black", "L")).toBe("Eagle Clover Tee (Size: L) • Washed Black");
    expect(lineItemName(tee, "es", "washed-black", "L")).toBe("Playera Águila Trébol (Talla: L) • Negro Lavado");
  });

  it("falls back to the colorway id and plain names for caps", () => {
    expect(lineItemName(tee, "en", "sand")).toBe("Eagle Clover Tee • sand");
    expect(lineItemName(cap, "en")).toBe("Black / Red");
  });
});

describe("lineStockError", () => {
  it("asks for a valid option, or reports sold out", () => {
    expect(lineStockError("option_required", "Tee", false)).toBe('Choose a valid colorway and size for "Tee".');
    expect(lineStockError("invalid_option", "Tee", true)).toBe('Elige un color y talla válidos para "Tee".');
    expect(lineStockError("unavailable", "Cap", false)).toBe('"Cap" is sold out.');
  });
});

describe("emptyCartError", () => {
  it("differs between checkout and reservation copy", () => {
    expect(emptyCartError("checkout", "en")).toBe("Your cart is empty. Add caps before checking out.");
    expect(emptyCartError("reservation", "es")).toBe("El carrito está vacío. Agrega gorras antes de apartar.");
  });
});

describe("validateCartLines", () => {
  const opts = { locale: "en", flow: "checkout" as const, now: NOW };

  it("prices lines from the database and keeps tee options", () => {
    const result = validateCartLines(
      [
        { variantId: "eagle-clover-tee", quantity: 2, colorway: "washed-black", size: "L" },
        { variantId: "negro-rojo", quantity: 1 },
      ],
      [tee, cap],
      [inStock(5), inStock(3)],
      opts
    );
    expect(result.subtotal).toBe(280);
    expect(result.totalItems).toBe(3);
    expect(result.validatedItems[0]).toEqual({
      variantId: "eagle-clover-tee",
      name: "Eagle Clover Tee (Size: L) • Washed Black",
      quantity: 2,
      price: 80,
      image: "/shirts/eagle.jpg",
      taxCode: "txcd_30011000",
      category: "apparel",
      silhouette: "tee",
      colorway: "washed-black",
      size: "L",
    });
    expect(result.validatedItems[1]).not.toHaveProperty("colorway");
    expect(result.validatedItems[1].taxCode).toBe("txcd_30060006");
  });

  it("caps units per line, units per cart and lines per cart", () => {
    const line = (quantity: number) => ({ variantId: "negro-rojo", quantity });
    expect(errorOf(() => validateCartLines([line(MAX_UNITS_PER_LINE + 1)], [cap], [inStock(99)], opts))).toBe(
      `Limit ${MAX_UNITS_PER_LINE} of "Black / Red" per order.`
    );
    expect(validateCartLines([line(MAX_UNITS_PER_LINE)], [cap], [inStock(99)], opts).totalItems).toBe(MAX_UNITS_PER_LINE);

    const lines = Array.from({ length: MAX_UNITS_PER_CART / MAX_UNITS_PER_LINE + 1 }, () => line(MAX_UNITS_PER_LINE));
    const stocks = lines.map(() => inStock(99));
    expect(errorOf(() => validateCartLines(lines, lines.map(() => cap), stocks, opts))).toBe(`Limit ${MAX_UNITS_PER_CART} items per order.`);
    expect(errorOf(() => validateCartLines(lines, lines.map(() => cap), stocks, { ...opts, locale: "es" }))).toBe(
      `Máximo ${MAX_UNITS_PER_CART} piezas por pedido.`
    );

    const many = Array.from({ length: MAX_CART_LINES + 1 }, () => line(1));
    expect(errorOf(() => validateCartLines(many, many.map(() => cap), many.map(() => inStock(99)), opts))).toBe(
      `Limit ${MAX_CART_LINES} different products per order.`
    );
  });

  it("floors quantities and treats missing ones as one", () => {
    const result = validateCartLines([{ variantId: "negro-rojo", quantity: 2.7 }, { variantId: "negro-rojo", quantity: 0 }], [cap, cap], [inStock(5), inStock(5)], opts);
    expect(result.validatedItems.map((i) => i.quantity)).toEqual([2, 1]);
  });

  it("rejects a missing product with flow-specific copy", () => {
    expect(errorOf(() => validateCartLines([{ variantId: "gone", quantity: 1 }], [null], [inStock(1)], opts))).toBe(
      "Product not found or unavailable: gone"
    );
    expect(
      errorOf(() => validateCartLines([{ variantId: "gone", quantity: 1 }], [null], [inStock(1)], { ...opts, flow: "reservation", locale: "es" }))
    ).toBe("Producto no disponible: gone");
  });

  it("rejects an archived product: no variant is returned, and a stock check says unavailable", () => {
    expect(errorOf(() => validateCartLines([{ variantId: "negro-rojo", quantity: 1 }], [null], [{ ok: false, reason: "unavailable" }], opts))).toBe(
      "Product not found or unavailable: negro-rojo"
    );
    expect(errorOf(() => validateCartLines([{ variantId: "negro-rojo", quantity: 1 }], [cap], [{ ok: false, reason: "unavailable" }], opts))).toBe(
      lineStockError("unavailable", "Black / Red", false)
    );
  });

  it("rejects failed SKU checks, sold-out lines and oversells", () => {
    expect(errorOf(() => validateCartLines([{ variantId: "eagle-clover-tee", quantity: 1 }], [tee], [{ ok: false, reason: "option_required" }], opts))).toBe(
      'Choose a valid colorway and size for "Eagle Clover Tee".'
    );
    expect(errorOf(() => validateCartLines([{ variantId: "negro-rojo", quantity: 1 }], [cap], [inStock(0)], opts))).toBe(
      'The cap "Black / Red" is sold out.'
    );
    expect(errorOf(() => validateCartLines([{ variantId: "negro-rojo", quantity: 4 }], [cap], [inStock(3)], opts))).toBe(
      'Insufficient stock for "Black / Red". Only 3 unit(s) available.'
    );
    expect(
      errorOf(() => validateCartLines([{ variantId: "negro-rojo", quantity: 4 }], [cap], [inStock(3)], { ...opts, flow: "reservation" }))
    ).toBe('Insufficient stock for "Black / Red". Only 3 available.');
  });

  it("blocks unreleased drops", () => {
    const drop = { ...cap, isDrop: true, dropStatus: "scheduled" as const, dropDate: NOW + 1000 };
    expect(errorOf(() => validateCartLines([{ variantId: "negro-rojo", quantity: 1 }], [drop], [inStock(5)], opts))).toBe(
      'The cap "Black / Red" is an upcoming VIP drop and is not yet available for purchase.'
    );
    const live = { ...drop, dropStatus: "live" as const };
    expect(validateCartLines([{ variantId: "negro-rojo", quantity: 1 }], [live], [inStock(5)], opts).totalItems).toBe(1);
  });

  it("refuses a product with neither a tax code nor a category, in the cart's language", () => {
    const untaxed: CheckoutVariant = { ...cap, category: undefined };
    expect(errorOf(() => validateCartLines([{ variantId: "negro-rojo", quantity: 1 }], [untaxed], [inStock(5)], opts))).toBe(
      `"Black / Red" can't be purchased right now. Please contact support.`
    );
    expect(
      errorOf(() => validateCartLines([{ variantId: "negro-rojo", quantity: 1 }], [untaxed], [inStock(5)], { ...opts, locale: "es" }))
    ).toBe(`"Negro / Rojo" no se puede comprar en este momento. Escríbenos a soporte.`);
  });

  it("a variant's own tax code wins over its category", () => {
    const custom: CheckoutVariant = { ...cap, taxCode: "txcd_99999999" };
    const { validatedItems } = validateCartLines([{ variantId: "negro-rojo", quantity: 1 }], [custom], [inStock(5)], opts);
    expect(validatedItems[0].taxCode).toBe("txcd_99999999");
  });
});

describe("productTaxCode", () => {
  it("prefers the variant's own code, trimmed", () => {
    expect(productTaxCode({ taxCode: " txcd_99999999 ", category: "headwear" })).toBe("txcd_99999999");
  });

  it("derives the code from the category", () => {
    expect(productTaxCode({ category: "headwear" })).toBe("txcd_30060006");
    expect(productTaxCode({ category: "apparel" })).toBe("txcd_30011000");
    expect(productTaxCode({ taxCode: "  ", category: "apparel" })).toBe("txcd_30011000");
  });

  it("never guesses from names or unknown categories", () => {
    expect(productTaxCode({})).toBeNull();
    expect(productTaxCode({ category: "hoodies" })).toBeNull();
    expect(productTaxCode({ category: "tee" })).toBeNull();
  });
});

describe("resolveProductTaxCode", () => {
  it("returns the code or throws the bilingual error", () => {
    expect(resolveProductTaxCode({ category: "apparel", name: "Tee" })).toBe("txcd_30011000");
    expect(errorOf(() => resolveProductTaxCode({ name: "Bomber Jacket" }))).toBe(
      `"Bomber Jacket" can't be purchased right now. Please contact support.`
    );
    expect(errorOf(() => resolveProductTaxCode({ name: "Gorra" }, "es"))).toBe(
      `"Gorra" no se puede comprar en este momento. Escríbenos a soporte.`
    );
  });
});

describe("Stripe fragments", () => {
  it("buildLineItems prices in cents and makes relative images absolute", () => {
    const [line] = buildLineItems([{ variantId: "negro-rojo", name: "Black / Red", quantity: 2, price: 119.99, image: "/caps/a.png", category: "headwear" }], "https://shop.test");
    expect(line.quantity).toBe(2);
    expect(line.price_data?.unit_amount).toBe(11999);
    expect(line.price_data?.product_data?.images).toEqual(["https://shop.test/caps/a.png"]);
    expect(line.price_data?.product_data?.name).toBe("Good Luck 0880 — Black / Red");
    expect(line.price_data?.product_data?.tax_code).toBe("txcd_30060006");
    const [remote] = buildLineItems([{ variantId: "x", name: "X", quantity: 1, price: 1, image: "https://cdn.test/x.png", taxCode: "txcd_30011000" }], "https://shop.test");
    expect(remote.price_data?.product_data?.images).toEqual(["https://cdn.test/x.png"]);
    expect(remote.price_data?.product_data?.tax_code).toBe("txcd_30011000");
    expect(() => buildLineItems([{ variantId: "x", name: "X", quantity: 1, price: 1, image: "/x.png" }], "https://shop.test")).toThrow(ConvexError);
  });

  it("buildShippingOptions labels free vs paid and adds the estimate on request", () => {
    const [free] = buildShippingOptions(0, true, true);
    expect(free.shipping_rate_data?.display_name).toBe("Free standard shipping");
    expect(free.shipping_rate_data?.delivery_estimate).toEqual({
      minimum: { unit: "business_day", value: 2 },
      maximum: { unit: "business_day", value: 5 },
    });
    const [paid] = buildShippingOptions(8, false, false);
    expect(paid.shipping_rate_data?.fixed_amount?.amount).toBe(800);
    expect(paid.shipping_rate_data?.display_name).toBe("Standard shipping");
    expect(paid.shipping_rate_data?.delivery_estimate).toBeUndefined();
    expect(paid.shipping_rate_data?.tax_code).toBe("txcd_92010001");
    expect(paid.shipping_rate_data?.tax_behavior).toBe("exclusive");
  });

  it("no shipping option promises express delivery", () => {
    for (const [option] of [buildShippingOptions(0, true, true), buildShippingOptions(8, false, true)]) {
      expect(option.shipping_rate_data?.display_name).not.toMatch(/express/i);
    }
  });

  it("INVOICE_FOOTER promises no returns window and no final sale (policy not decided yet)", () => {
    expect(INVOICE_FOOTER).not.toMatch(/30 days|returns?\b/i);
    expect(INVOICE_FOOTER).not.toMatch(/final sale/i);
    expect(INVOICE_FOOTER).toContain("orders@goodluckcaps.com");
  });

  it("toStripeAddress requires a street and forces US", () => {
    expect(toStripeAddress(undefined)).toBeUndefined();
    expect(toStripeAddress({ line1: "", city: "A", state: "NY", postalCode: "1" })).toBeUndefined();
    expect(toStripeAddress({ line1: "1 Main", city: "NYC", state: "NY", postalCode: "10001" })).toEqual({
      line1: "1 Main",
      line2: undefined,
      city: "NYC",
      state: "NY",
      postal_code: "10001",
      country: "US",
    });
  });

  it("customerSessionFields reuses a customer or asks Checkout to create one", () => {
    expect(customerSessionFields("cus_1", "a@b.c")).toEqual({
      customer: "cus_1",
      customer_update: { shipping: "auto", address: "auto", name: "auto" },
    });
    expect(customerSessionFields(undefined, "")).toEqual({ customer_creation: "always", customer_email: undefined });
  });

  it("itemSummary lists the first three lines", () => {
    const items = ["A", "B", "C", "D"].map((name) => ({ name, quantity: 1 }));
    expect(itemSummary(items)).toBe("1x A, 1x B, 1x C");
    expect(itemSummary([{ name: "x".repeat(600), quantity: 1 }])).toHaveLength(450);
  });

  it("countLabel pluralizes", () => {
    expect(countLabel(1, "item")).toBe("(1 item)");
    expect(countLabel(3, "cap")).toBe("(3 caps)");
  });

  it("reservation sessions expire two minutes before 24 hours", () => {
    expect(reservationSessionExpiresAt(NOW)).toBe(NOW / 1000 + 24 * 3600 - 120);
  });
});

describe("holdShortageError", () => {
  it("says the line just sold out, or how many are left, in the cart's language", () => {
    expect(holdShortageError("Cap", 0, "en")).toBe('"Cap" just sold out.');
    expect(holdShortageError("Gorra", 0, "es")).toBe('"Gorra" se acaba de agotar.');
    expect(holdShortageError("Cap", 2, "en")).toBe('Insufficient stock for "Cap". Only 2 unit(s) available.');
  });
});
