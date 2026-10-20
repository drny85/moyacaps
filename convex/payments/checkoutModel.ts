/**
 * Pure checkout rules shared by the Stripe checkout actions (ADR 0002, ADR 0010, ADR 0015):
 * cart validation with bilingual errors, line naming, category tax codes, and the Stripe line
 * item / shipping / customer fragments. Only Stripe *types* are imported, so this module
 * runs anywhere and is covered by checkoutModel.test.ts.
 */
import { ConvexError } from "convex/values";
import type Stripe from "stripe";
import { isPurchaseBlockedByDrop } from "../catalog/model";
import { CATEGORIES, DEFAULT_TAX_CODE, type Category } from "../catalog/rules";

export type CheckoutLineItemInput = {
  variantId: string;
  name: string;
  quantity: number;
  price: number;
  image: string;
  taxCode?: string;
  category?: string;
  silhouette?: string;
};

export type ValidatedLine = CheckoutLineItemInput & { colorway?: string; size?: string };

export type CartLine = { variantId: string; quantity: number; size?: string; colorway?: string };

export type CheckoutVariant = {
  variantId: string;
  nameEn: string;
  nameEs: string;
  priceUsd: number;
  image: string;
  silhouette: string;
  taxCode?: string;
  category?: string;
  colorways?: Array<{ id: string; nameEn: string; nameEs: string }> | null;
  isDrop?: boolean;
  dropStatus?: "scheduled" | "live" | "archived";
  dropDate?: number;
  isAvailable?: boolean;
};

export type LineStockReason = "not_found" | "unavailable" | "option_required" | "invalid_option";
export type LineStock = { ok: true; available: number } | { ok: false; reason: LineStockReason };

/** Direct card checkout, or a WhatsApp concierge reservation. Their copy differs slightly. */
export type CheckoutFlow = "checkout" | "reservation";

/** Unit price fallback for a variant row with no price (legacy caps were $120). */
const FALLBACK_UNIT_PRICE_USD = 120;

/** Line name shown on Stripe, receipts and orders: tees append size and the colorway's display name. */
export function lineItemName(
  variant: { nameEn: string; nameEs: string; colorways?: Array<{ id: string; nameEn: string; nameEs: string }> | null },
  locale: string,
  colorway?: string,
  size?: string
): string {
  const es = locale === "es";
  const base = es ? variant.nameEs : variant.nameEn;
  const cw = colorway ? variant.colorways?.find((c) => c.id === colorway) : undefined;
  const sizeSuffix = size ? ` (${es ? "Talla" : "Size"}: ${size})` : "";
  const colorSuffix = cw ? ` • ${es ? cw.nameEs : cw.nameEn}` : colorway ? ` • ${colorway}` : "";
  return `${base}${sizeSuffix}${colorSuffix}`;
}

/** Bilingual message for a line that fails the per-SKU stock check (ADR 0015). */
export function lineStockError(reason: LineStockReason, variantName: string, es: boolean): string {
  if (reason === "option_required" || reason === "invalid_option") {
    return es
      ? `Elige un color y talla válidos para "${variantName}".`
      : `Choose a valid colorway and size for "${variantName}".`;
  }
  return es ? `"${variantName}" se encuentra agotado.` : `"${variantName}" is sold out.`;
}

/**
 * Bilingual message when a Checkout Hold cannot take a line's units (ADR 0024): another
 * Customer's hold or purchase got there between pricing and Pay.
 */
export function holdShortageError(lineName: string, available: number, locale: string): string {
  const es = locale === "es";
  if (available <= 0) {
    return es ? `"${lineName}" se acaba de agotar.` : `"${lineName}" just sold out.`;
  }
  return cartMessages.checkout.insufficient(es, lineName, available);
}

export function emptyCartError(flow: CheckoutFlow, locale: string): string {
  const es = locale === "es";
  if (flow === "checkout") {
    return es ? "El carrito está vacío. Agrega gorras antes de pagar." : "Your cart is empty. Add caps before checking out.";
  }
  return es ? "El carrito está vacío. Agrega gorras antes de apartar." : "Your bag is empty. Add caps before reserving.";
}

const cartMessages = {
  checkout: {
    notFound: (es: boolean, id: string) =>
      es ? `Producto no encontrado o no disponible: ${id}` : `Product not found or unavailable: ${id}`,
    upcomingDrop: (es: boolean, name: string) =>
      es
        ? `La gorra "${name}" es un drop VIP programado y aún no está disponible para compra.`
        : `The cap "${name}" is an upcoming VIP drop and is not yet available for purchase.`,
    insufficient: (es: boolean, name: string, stock: number) =>
      es
        ? `Inventario insuficiente para "${name}". Solo hay ${stock} pieza(s) disponible(s).`
        : `Insufficient stock for "${name}". Only ${stock} unit(s) available.`,
  },
  reservation: {
    notFound: (es: boolean, id: string) => (es ? `Producto no disponible: ${id}` : `Product not available: ${id}`),
    upcomingDrop: (es: boolean, name: string) =>
      es ? `La gorra "${name}" es un drop VIP programado.` : `The cap "${name}" is an upcoming VIP drop.`,
    insufficient: (es: boolean, name: string, stock: number) =>
      es
        ? `Inventario insuficiente para "${name}". Solo quedan ${stock} disponible(s).`
        : `Insufficient stock for "${name}". Only ${stock} available.`,
  },
} as const;

/**
 * Validate a cart against live variants and per-line stock and price it from the database.
 * `variants[i]` and `lineStocks[i]` belong to `items[i]`. Throws a ConvexError with a
 * customer-facing message (in the cart's locale) on the first line that cannot be sold.
 */
export function validateCartLines(
  items: CartLine[],
  variants: Array<CheckoutVariant | null>,
  lineStocks: LineStock[],
  options: { locale: string; flow: CheckoutFlow; now: number }
): { validatedItems: ValidatedLine[]; subtotal: number; totalItems: number } {
  const es = options.locale === "es";
  const copy = cartMessages[options.flow];
  let subtotal = 0;
  let totalItems = 0;
  const validatedItems: ValidatedLine[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const variant = variants[i];

    if (!variant) {
      throw new ConvexError(copy.notFound(es, item.variantId));
    }

    const variantName = es ? variant.nameEs : variant.nameEn;
    const lineStock = lineStocks[i];
    if (!lineStock.ok) {
      throw new ConvexError(lineStockError(lineStock.reason, variantName, es));
    }
    const stock = lineStock.available;

    if (stock <= 0) {
      throw new ConvexError(es ? `La gorra "${variantName}" se encuentra agotada.` : `The cap "${variantName}" is sold out.`);
    }

    // Ironclad Purchase Gate: Drop products cannot be purchased until released
    if (isPurchaseBlockedByDrop(variant, options.now)) {
      throw new ConvexError(copy.upcomingDrop(es, variantName));
    }

    const qty = Math.max(1, Math.floor(item.quantity || 1));
    if (qty > stock) {
      throw new ConvexError(copy.insufficient(es, variantName, stock));
    }

    // Stripe Tax needs a code per line; refuse before any Checkout Hold is placed.
    const taxCode = productTaxCode(variant);
    if (!taxCode) {
      throw new ConvexError(missingTaxCodeError(variantName, es));
    }

    const unitPrice: number = typeof variant.priceUsd === "number" ? variant.priceUsd : FALLBACK_UNIT_PRICE_USD;

    totalItems += qty;
    subtotal += unitPrice * qty;

    validatedItems.push({
      variantId: variant.variantId,
      name: lineItemName(variant, options.locale, item.colorway, item.size),
      quantity: qty,
      price: unitPrice,
      image: variant.image,
      taxCode,
      category: variant.category,
      silhouette: variant.silhouette,
      ...(item.colorway ? { colorway: item.colorway } : {}),
      ...(item.size ? { size: item.size } : {}),
    });
  }

  return { validatedItems, subtotal, totalItems };
}

/**
 * Stripe Product Tax Code for a line: the variant's own `taxCode`, else its category's
 * (Caps `txcd_30060006`, Tees `txcd_30011000`). No name or silhouette guessing; null when
 * the product has neither, and checkout refuses it.
 */
export function productTaxCode(item: { taxCode?: string; category?: string }): string | null {
  const own = item.taxCode?.trim();
  if (own) return own;
  const category = item.category as Category | undefined;
  return category && (CATEGORIES as readonly string[]).includes(category) ? DEFAULT_TAX_CODE[category] : null;
}

/** Bilingual message for a product checkout cannot tax (a catalog mistake, not the Customer's). */
export function missingTaxCodeError(variantName: string, es: boolean): string {
  return es
    ? `"${variantName}" no se puede comprar en este momento. Escríbenos a soporte.`
    : `"${variantName}" can't be purchased right now. Please contact support.`;
}

/** `productTaxCode`, throwing the bilingual ConvexError when the product has no code. */
export function resolveProductTaxCode(
  item: { taxCode?: string; category?: string; name: string },
  locale = "en"
): string {
  const code = productTaxCode(item);
  if (!code) throw new ConvexError(missingTaxCodeError(item.name, locale === "es"));
  return code;
}

/**
 * Builds Stripe line items from DB-verified order items. Shared by direct checkout,
 * WhatsApp lead creation, and payment-link refresh so the three can never drift.
 */
export function buildLineItems(
  items: CheckoutLineItemInput[],
  origin: string
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  return items.map((item) => ({
    price_data: {
      currency: "usd",
      product_data: {
        name: `Good Luck 0880 — ${item.name}`,
        images: [item.image.startsWith("http") ? item.image : `${origin}${item.image}`],
        tax_code: resolveProductTaxCode(item),
        metadata: {
          variantId: item.variantId,
        },
      },
      unit_amount: Math.round(item.price * 100),
    },
    quantity: item.quantity,
  }));
}

/**
 * Single shipping option with free/paid presentation. Shared across checkout paths.
 */
export function buildShippingOptions(
  shippingFee: number,
  freeShipping: boolean,
  withDeliveryEstimate: boolean
): Stripe.Checkout.SessionCreateParams.ShippingOption[] {
  const shippingRate: Stripe.Checkout.SessionCreateParams.ShippingOption.ShippingRateData = {
    type: "fixed_amount",
    fixed_amount: {
      amount: Math.round(shippingFee * 100),
      currency: "usd",
    },
    display_name: freeShipping ? "Free US Express Delivery" : "US Tracked Express Courier",
    tax_code: "txcd_92010001", // Shipping / delivery fee
    tax_behavior: "exclusive",
  };
  if (withDeliveryEstimate) {
    shippingRate.delivery_estimate = {
      minimum: { unit: "business_day", value: 2 },
      maximum: { unit: "business_day", value: 4 },
    };
  }
  return [{ shipping_rate_data: shippingRate }];
}

export function toStripeAddress(
  addr: { line1: string; line2?: string; city: string; state: string; postalCode: string } | undefined | null
): Stripe.AddressParam | undefined {
  if (!addr || !addr.line1) return undefined;
  return {
    line1: addr.line1,
    line2: addr.line2 || undefined,
    city: addr.city,
    state: addr.state,
    postal_code: addr.postalCode,
    country: "US",
  };
}

/** "2x Cap A, 1x Tee B" — first three lines, under Stripe's 500-char metadata value limit. */
export function itemSummary(items: Array<{ quantity: number; name: string }>): string {
  return items.map((i) => `${i.quantity}x ${i.name}`).slice(0, 3).join(", ").slice(0, 450);
}

export const INVOICE_FOOTER =
  "Good Luck 0880 | Bespoke NYC Headwear | Support: goodluckcaps.com | All limited drop items are serialized and final sale.";

/** "(1 item)" / "(3 caps)" style suffix used in invoice and payment descriptions. */
export const countLabel = (count: number, noun: "item" | "cap") => `(${count} ${noun}${count > 1 ? "s" : ""})`;

/**
 * Stripe Checkout sessions must expire in under 24h; reservation links expire 2 minutes
 * before the 24h stock hold ends. Returns Unix seconds.
 */
export function reservationSessionExpiresAt(nowMs: number): number {
  return Math.floor(nowMs / 1000) + 24 * 3600 - 120;
}

/** Reuse a known Stripe customer (kept fresh by Checkout), or let Checkout create one. */
export function customerSessionFields(customerId: string | undefined, email: string | undefined) {
  return customerId
    ? {
        customer: customerId,
        customer_update: {
          shipping: "auto" as const,
          address: "auto" as const,
          name: "auto" as const,
        },
      }
    : {
        customer_creation: "always" as const,
        customer_email: email || undefined,
      };
}

/** US-only shipping, phone and automatic tax: identical on every checkout path. */
export const STRIPE_COLLECTION_FIELDS = {
  shipping_address_collection: {
    allowed_countries: ["US"] as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[],
  },
  phone_number_collection: {
    enabled: true,
  },
  automatic_tax: {
    enabled: true,
  },
};
