import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { encodeItemsMetadata } from "./checkoutMetadata";
import {
  disputeFigures,
  extractTaxInfo,
  hydrateOrderItems,
  isHandledStripeEvent,
  refundFromCharge,
  settlementFromSession,
} from "./settlementModel";

function session(overrides: Record<string, unknown> = {}): Stripe.Checkout.Session {
  return {
    id: "cs_test_abcdefgh12345678",
    object: "checkout.session",
    amount_total: 21600,
    currency: "usd",
    client_reference_id: "GL-REF-1",
    customer: "cus_1",
    customer_details: {
      email: "ana@example.com",
      name: "Ana Lopez",
      phone: "+15551234567",
      address: { line1: "1 Main St", line2: null, city: "New York", state: "NY", postal_code: "10001", country: "US" },
    },
    invoice: { id: "in_1", invoice_pdf: "https://pdf", hosted_invoice_url: "https://hosted" },
    metadata: { orderNumber: "GL-ABC-1", clerkUserId: "user_1", subtotal: "200", shippingFee: "0" },
    total_details: {
      amount_tax: 1600,
      breakdown: {
        taxes: [
          { amount: 1000, rate: { percentage: 4, jurisdiction: "New York" } },
          { amount: 600, rate: { percentage: 4.875, display_name: "NYC Sales Tax" } },
        ],
      },
    },
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

describe("isHandledStripeEvent", () => {
  it("acts on settlement, invoice, refund and dispute events only", () => {
    expect(isHandledStripeEvent("checkout.session.completed")).toBe(true);
    expect(isHandledStripeEvent("charge.dispute.closed")).toBe(true);
    expect(isHandledStripeEvent("refund.failed")).toBe(true);
    expect(isHandledStripeEvent("refund.updated")).toBe(true);
    expect(isHandledStripeEvent("refund.created")).toBe(false);
    expect(isHandledStripeEvent("customer.created")).toBe(false);
  });
});

describe("extractTaxInfo", () => {
  it("sums rates and joins jurisdictions", () => {
    expect(extractTaxInfo(session())).toEqual({
      taxAmount: 16,
      taxDetails: { amount: 16, rate: 8.88, jurisdiction: "New York, NYC Sales Tax" },
    });
  });

  it("falls back to the address state and reports no tax when none was charged", () => {
    const noBreakdown = session({ total_details: { amount_tax: 500 } });
    expect(extractTaxInfo(noBreakdown, { state: "FL" }).taxDetails).toEqual({ amount: 5, rate: undefined, jurisdiction: "FL" });
    expect(extractTaxInfo(session({ total_details: { amount_tax: 0 } }))).toEqual({ taxAmount: undefined, taxDetails: undefined });
  });
});

describe("hydrateOrderItems", () => {
  const lookup = vi.fn(async (variantId: string) =>
    variantId === "eagle-clover-tee"
      ? { nameEn: "Eagle Clover Tee", nameEs: "Playera", priceUsd: 80, image: "/eagle.jpg", colorways: [{ id: "black", nameEn: "Black", nameEs: "Negro" }] }
      : null
  );

  it("rebuilds compact lines with live names and the stored price", async () => {
    const metadata = encodeItemsMetadata([{ variantId: "eagle-clover-tee", quantity: 2, price: 75, colorway: "black", size: "M" }]);
    expect(await hydrateOrderItems(metadata, lookup)).toEqual([
      { variantId: "eagle-clover-tee", name: "Eagle Clover Tee (Size: M) • Black", price: 75, quantity: 2, image: "/eagle.jpg", colorway: "black", size: "M" },
    ]);
  });

  it("keeps full legacy lines as recorded and never invents a price for vanished variants", async () => {
    const legacy = { itemsJson: JSON.stringify([{ variantId: "old", name: "Old Cap", price: 120, image: "/old.png", quantity: 1 }]) };
    expect(await hydrateOrderItems(legacy, lookup)).toEqual([{ variantId: "old", name: "Old Cap", price: 120, image: "/old.png", quantity: 1 }]);

    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const vanished = { itemsJson: JSON.stringify([{ v: "gone", q: 1 }]) };
    expect(await hydrateOrderItems(vanished, lookup)).toEqual([{ variantId: "gone", name: "gone", price: 0, quantity: 1, image: "" }]);
    errors.mockRestore();
  });

  it("returns no items when metadata carries none", async () => {
    expect(await hydrateOrderItems(undefined, lookup)).toEqual([]);
  });
});

describe("settlementFromSession", () => {
  const items = [{ variantId: "negro-rojo", name: "Black / Red", price: 100, quantity: 2, image: "/a.png" }];

  it("maps a paid session to settlement arguments", () => {
    expect(settlementFromSession(session(), items, { webhookEventId: "evt_1", useClientReference: true })).toEqual({
      stripeSessionId: "cs_test_abcdefgh12345678",
      stripeCustomerId: "cus_1",
      stripeInvoiceId: "in_1",
      invoicePdfUrl: "https://pdf",
      hostedInvoiceUrl: "https://hosted",
      orderNumber: "GL-ABC-1",
      customerEmail: "ana@example.com",
      customerName: "Ana Lopez",
      customerPhone: "+15551234567",
      clerkUserId: "user_1",
      shippingAddress: { line1: "1 Main St", line2: undefined, city: "New York", state: "NY", postalCode: "10001", country: "US" },
      items,
      currency: "USD",
      subtotal: 200,
      shippingFee: 0,
      tax: 16,
      taxDetails: { amount: 16, rate: 8.88, jurisdiction: "New York, NYC Sales Tax" },
      total: 216,
      webhookEventId: "evt_1",
    });
  });

  it("falls back to the client reference only for webhooks, then a session-derived number", () => {
    const bare = session({ metadata: {} });
    expect(settlementFromSession(bare, [], { useClientReference: true }).orderNumber).toBe("GL-REF-1");
    expect(settlementFromSession(bare, [], { useClientReference: false }).orderNumber).toBe("GL-12345678");
  });

  it("omits the webhook event id for the success-page repair path", () => {
    expect(settlementFromSession(session(), [], { useClientReference: false })).not.toHaveProperty("webhookEventId");
  });

  it("reads expanded customers, string invoices and missing addresses", () => {
    const args = settlementFromSession(
      session({ customer: { id: "cus_2" }, invoice: "in_2", customer_details: { email: null, name: null, phone: null, address: null } }),
      [],
      { useClientReference: true }
    );
    expect(args.stripeCustomerId).toBe("cus_2");
    expect(args.stripeInvoiceId).toBe("in_2");
    expect(args.invoicePdfUrl).toBeUndefined();
    expect(args.shippingAddress).toBeUndefined();
    expect(args.customerEmail).toBeUndefined();
  });

});

describe("refundFromCharge", () => {
  it("measures partial and full refunds", () => {
    expect(refundFromCharge({ amount: 10000, amount_refunded: 2500, refunded: false })).toEqual({ refundedAmount: 25, isFullRefund: false });
    expect(refundFromCharge({ amount: 10000, amount_refunded: 10000, refunded: false })).toEqual({ refundedAmount: 100, isFullRefund: true });
    expect(refundFromCharge({ amount: 10000, amount_refunded: 0, refunded: true }).isFullRefund).toBe(true);
  });
});

describe("disputeFigures", () => {
  it("converts amounts and deadlines and names the outcome", () => {
    expect(
      disputeFigures({ amount: 12800, currency: "usd", evidence_details: { due_by: 1_800_000_000 } as Stripe.Dispute.EvidenceDetails, status: "won" })
    ).toEqual({ amount: 128, currency: "USD", evidenceDueBy: 1_800_000_000_000, outcome: "WON (Merchant Won)" });
    expect(disputeFigures({ amount: 100, currency: "usd", evidence_details: {} as Stripe.Dispute.EvidenceDetails, status: "lost" })).toMatchObject({
      evidenceDueBy: undefined,
      outcome: "LOST (Funds Withdrawn)",
    });
  });
});
