/**
 * Pure Stripe settlement mapping (ADR 0006): which webhook events matter, how a paid
 * Checkout session becomes `orderSettlement:createOrUpdateStripeOrder` arguments, and
 * how refunds and disputes are measured. Only Stripe *types* are imported; covered by
 * stripeSettlementModel.test.ts.
 */
import type Stripe from "stripe";
import { decodeItemsMetadata } from "./checkoutMetadata";
import { lineItemName } from "./checkoutModel";

/** Events the webhook acts on; every other event is acknowledged without side effects. */
export const HANDLED_STRIPE_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.closed",
  "invoice.paid",
  "invoice.payment_succeeded",
] as const;

export function isHandledStripeEvent(type: string): boolean {
  return (HANDLED_STRIPE_EVENTS as readonly string[]).includes(type);
}

/**
 * Extracts normalized sales tax amounts, composite rates, and jurisdictions from a Stripe session.
 */
export function extractTaxInfo(
  session: Pick<Stripe.Checkout.Session, "total_details">,
  address?: { state?: string | null } | null
): {
  taxAmount?: number;
  taxDetails?: {
    amount: number;
    rate?: number;
    jurisdiction?: string;
  };
} {
  const taxAmountCents = session.total_details?.amount_tax ?? 0;
  const taxAmount = taxAmountCents > 0 ? Number((taxAmountCents / 100).toFixed(2)) : undefined;

  let taxDetails: { amount: number; rate?: number; jurisdiction?: string } | undefined = undefined;
  if (taxAmount && taxAmount > 0) {
    const taxesList = session.total_details?.breakdown?.taxes || [];
    const sumRate = taxesList.reduce((acc, t) => acc + (Number(t.rate?.percentage) || 0), 0);
    const jurisdictionList = Array.from(
      new Set(
        taxesList
          .map((t) => t.rate?.jurisdiction || t.rate?.display_name)
          .filter(Boolean)
      )
    );
    const jurisdiction = jurisdictionList.length > 0 ? jurisdictionList.join(", ") : address?.state || undefined;
    taxDetails = {
      amount: taxAmount,
      rate: sumRate > 0 ? Number(sumRate.toFixed(2)) : undefined,
      jurisdiction: jurisdiction || undefined,
    };
  }

  return { taxAmount, taxDetails };
}

export type HydratedItem = {
  variantId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  colorway?: string;
  size?: string;
};

type VariantLookup = (variantId: string) => Promise<{
  nameEn: string;
  nameEs: string;
  priceUsd?: number;
  image?: string;
  colorways?: Array<{ id: string; nameEn: string; nameEs: string }> | null;
} | null>;

/**
 * Hydrates line items from metadata to guarantee full product information
 * even if compact representation was used to respect Stripe's 500-char metadata limit.
 */
export async function hydrateOrderItems(
  metadata: Record<string, string> | null | undefined,
  lookupVariant: VariantLookup
): Promise<HydratedItem[]> {
  const raw: any[] = decodeItemsMetadata(metadata);
  if (raw.length === 0) return [];
  try {
    return await Promise.all(
      raw.map(async (i: any) => {
        if (i.variantId && i.name && i.price !== undefined && i.image) {
          return i;
        }
        const vid = i.variantId || i.id || i.v;
        const qty = i.quantity || i.q || 1;
        // No invented fallback prices: use the price stored in the compact metadata, else
        // the live DB price. Zero only if the variant vanished AND no price was recorded.
        const storedPrice = typeof i.price === "number" ? i.price : typeof i.p === "number" ? i.p : undefined;
        const variant = await lookupVariant(vid);
        const price = storedPrice ?? variant?.priceUsd;
        if (price === undefined) {
          console.error(`hydrateOrderItems: no price available for variant ${vid}; using 0 — flag for review.`);
        }
        const colorway: string | undefined = i.colorway || i.c || undefined;
        const size: string | undefined = i.size || i.s || undefined;
        return {
          variantId: vid,
          name: variant ? lineItemName(variant, "en", colorway, size) : i.name || vid,
          price: price ?? 0,
          quantity: qty,
          image: variant?.image || i.image || "",
          ...(colorway ? { colorway } : {}),
          ...(size ? { size } : {}),
        };
      })
    );
  } catch (e) {
    console.error("Failed to parse and hydrate itemsJson:", e);
    return [];
  }
}

/** Shipping address on a paid session (legacy `shipping_details`/`shipping_cost`, else the customer's). */
export function sessionAddress(session: Stripe.Checkout.Session) {
  const shipping = (session as any).shipping_details || (session as any).shipping_cost;
  return shipping?.address || session.customer_details?.address;
}

/**
 * Arguments for `orderSettlement:createOrUpdateStripeOrder` from a paid session. The order
 * number falls back to the session's client reference, then a session-derived number.
 */
export function settlementFromSession(
  session: Stripe.Checkout.Session,
  items: HydratedItem[],
  options: { webhookEventId?: string; useClientReference: boolean }
) {
  const metadata = session.metadata || {};
  const address = sessionAddress(session);
  const { taxAmount, taxDetails } = extractTaxInfo(session, address);
  const stripeCustomerId =
    typeof session.customer === "string" ? session.customer : (session.customer as any)?.id || undefined;
  const invoiceObj = typeof session.invoice === "object" ? (session.invoice as Stripe.Invoice) : null;
  const stripeInvoiceId = typeof session.invoice === "string" ? session.invoice : invoiceObj?.id || undefined;
  const fallbackNumber = `GL-${session.id.slice(-8).toUpperCase()}`;

  return {
    stripeSessionId: session.id,
    stripeCustomerId,
    stripeInvoiceId,
    invoicePdfUrl: invoiceObj?.invoice_pdf || undefined,
    hostedInvoiceUrl: invoiceObj?.hosted_invoice_url || undefined,
    orderNumber:
      metadata.orderNumber || (options.useClientReference ? session.client_reference_id : undefined) || fallbackNumber,
    customerEmail: session.customer_details?.email || undefined,
    customerName: session.customer_details?.name || undefined,
    customerPhone: session.customer_details?.phone || undefined,
    clerkUserId: metadata.clerkUserId || undefined,
    shippingAddress: address
      ? {
          line1: address.line1 || "Street address",
          line2: address.line2 || undefined,
          city: address.city || "City",
          state: address.state || "",
          postalCode: address.postal_code || "",
          country: address.country || "US",
        }
      : undefined,
    items,
    currency: (session.currency || "usd").toUpperCase(),
    subtotal: metadata.subtotal ? Number(metadata.subtotal) : undefined,
    shippingFee: metadata.shippingFee ? Number(metadata.shippingFee) : undefined,
    tax: taxAmount,
    taxDetails,
    total: (session.amount_total || 0) / 100,
    ...(options.webhookEventId !== undefined ? { webhookEventId: options.webhookEventId } : {}),
    isWhatsAppOrder: metadata.isWhatsAppOrder === "true",
  };
}

/** Refunded dollars on a charge and whether the charge is now fully refunded. */
export function refundFromCharge(charge: Pick<Stripe.Charge, "amount" | "amount_refunded" | "refunded">) {
  return {
    refundedAmount: (charge.amount_refunded ?? 0) / 100,
    isFullRefund: Boolean(
      charge.refunded || (typeof charge.amount === "number" && (charge.amount_refunded ?? 0) >= charge.amount)
    ),
  };
}

/** Dispute amount in dollars, upper-case currency and evidence deadline in ms. */
export function disputeFigures(dispute: Pick<Stripe.Dispute, "amount" | "currency" | "evidence_details" | "status">) {
  return {
    amount: (dispute.amount ?? 0) / 100,
    currency: (dispute.currency || "usd").toUpperCase(),
    evidenceDueBy: dispute.evidence_details?.due_by ? dispute.evidence_details.due_by * 1000 : undefined,
    outcome: dispute.status === "won" ? "WON (Merchant Won)" : "LOST (Funds Withdrawn)",
  };
}
