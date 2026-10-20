import { describe, expect, it } from "vitest";
import React from "react";
import { renderEmail } from "./renderEmail";
import { BRAND_RED, SUPPORT_EMAIL, LOGO_URL } from "./brand";
import { layoutStrings } from "./strings";
import { AdminAlertEmail } from "../AdminAlertEmail";
import { AdminDisputeAlertEmail } from "../AdminDisputeAlert";
import { AdminOrderAlertEmail } from "../AdminOrderAlert";
import { AdminTerritoryAlertEmail } from "../AdminTerritoryAlert";
import { CategoryLaunchEmail } from "../CategoryLaunchEmail";
import { CustomerNoticeEmail } from "../CustomerNoticeEmail";
import { CustomerReceiptEmail } from "../CustomerReceipt";
import { DeliveryExceptionEmail } from "../DeliveryExceptionEmail";
import { OrderDeliveredEmail } from "../OrderDeliveredEmail";
import { OrderDispatchedEmail } from "../OrderDispatchedEmail";
import { cancellationNotice, customerCancellationAlert } from "../../orderEmails";
import { deliveryExceptionCopy } from "../../deliveryException";

const items = [{ name: "Black / Red Signature", quantity: 1, price: 120 }];
const address = { line1: "350 5th Ave", city: "New York", state: "NY", postalCode: "10118", country: "US" };

/** Every email the store sends, rendered with minimal props, tagged with who receives it. */
const templates: Array<{ name: string; audience: "customer" | "admin"; element: React.ReactElement }> = [
  {
    name: "AdminAlertEmail",
    audience: "admin",
    element: React.createElement(AdminAlertEmail, {
      alert: customerCancellationAlert({ orderNumber: "GL-1", refundCents: 12000, stockReleased: true }),
      actionUrl: "https://example.test/admin",
      actionLabel: "Open order",
    }),
  },
  {
    name: "AdminDisputeAlertEmail",
    audience: "admin",
    element: React.createElement(AdminDisputeAlertEmail, {
      orderNumber: "GL-1",
      total: 120,
      currency: "USD",
      disputeId: "dp_1",
      status: "needs_response",
      adminDashboardUrl: "https://example.test/admin",
      stripeDisputeUrl: "https://example.test/stripe",
      createdAt: Date.UTC(2026, 9, 20, 13, 10),
    }),
  },
  {
    name: "AdminOrderAlertEmail",
    audience: "admin",
    element: React.createElement(AdminOrderAlertEmail, {
      orderNumber: "GL-1",
      total: 128,
      currency: "USD",
      paymentMethod: "stripe",
      items,
      shippingAddress: address,
      subtotal: 120,
      shippingFee: 8,
      createdAt: Date.UTC(2026, 9, 20, 13, 10),
    }),
  },
  {
    name: "AdminTerritoryAlertEmail",
    audience: "admin",
    element: React.createElement(AdminTerritoryAlertEmail, {
      orderNumber: "GL-1",
      total: 120,
      currency: "USD",
      reason: "Puerto Rico is outside the Fulfillment Territory.",
      adminDashboardUrl: "https://example.test/admin",
    }),
  },
  {
    name: "CategoryLaunchEmail",
    audience: "customer",
    element: React.createElement(CategoryLaunchEmail, {
      locale: "en",
      category: "headwear",
      shopUrl: "https://example.test/products",
    }),
  },
  {
    name: "CustomerNoticeEmail",
    audience: "customer",
    element: React.createElement(CustomerNoticeEmail, {
      notice: cancellationNotice({ orderNumber: "GL-1", by: "customer", refundCents: 12000 }),
      actionUrl: "https://example.test/track",
    }),
  },
  {
    name: "CustomerReceiptEmail",
    audience: "customer",
    element: React.createElement(CustomerReceiptEmail, {
      orderNumber: "GL-1",
      total: 128,
      currency: "USD",
      customerName: "Ana",
      items,
      shippingAddress: address,
      subtotal: 120,
      shippingFee: 8,
    }),
  },
  {
    name: "DeliveryExceptionEmail (customer)",
    audience: "customer",
    element: React.createElement(DeliveryExceptionEmail, {
      audience: "customer",
      orderNumber: "GL-1",
      copy: deliveryExceptionCopy("delivery_exception", "customer", "GL-1"),
      carrier: "USPS",
      trackingNumber: "9400",
      actionUrl: "https://example.test/track",
      actionLabel: "Track your order",
    }),
  },
  {
    name: "DeliveryExceptionEmail (admin)",
    audience: "admin",
    element: React.createElement(DeliveryExceptionEmail, {
      audience: "admin",
      orderNumber: "GL-1",
      copy: deliveryExceptionCopy("returned", "administrator", "GL-1"),
      carrier: "USPS",
      trackingNumber: "9400",
      actionUrl: "https://example.test/admin",
      actionLabel: "Open order",
    }),
  },
  {
    name: "OrderDeliveredEmail",
    audience: "customer",
    element: React.createElement(OrderDeliveredEmail, { orderNumber: "GL-1", items }),
  },
  {
    name: "OrderDispatchedEmail",
    audience: "customer",
    element: React.createElement(OrderDispatchedEmail, { orderNumber: "GL-1", items, shippingAddress: address }),
  },
];

const t = layoutStrings("en");
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe("every email is wrapped in BaseEmailLayout", () => {
  for (const { name, audience, element } of templates) {
    it(`${name}: one document, the logo, the ${audience} signature and a plain-text version`, async () => {
      const { html, text } = await renderEmail(element);

      expect(count(html.toLowerCase(), "<html")).toBe(1);
      expect(count(html.toLowerCase(), "<body")).toBe(1);
      expect(html).toContain(LOGO_URL);
      expect(html).toContain("#0C0A09");
      expect(html).not.toContain("Good Luck 0880");
      expect(html).not.toMatch(/background-color:\s*(#09090b|#0a0a0a|#111111)|Operations HQ/i);

      // Storefront lockup: GOOD (white) + LUCK (brand red) + 0880 badge beside the logo.
      expect(html).toMatch(new RegExp(`GOOD<span[^>]*color:\\s*${BRAND_RED}[^>]*>LUCK</span>`, "i"));
      expect(html).toContain(">0880<");
      // Not yet: no postal address, no returns window, no "reply to this email".
      expect(html).not.toMatch(/Clay Ave|30-day|30 days|30 días|reply to this email|responde a este correo/i);
      expect(text).not.toMatch(/Clay Ave|30-day|30 days|reply to this email/i);

      if (audience === "customer") {
        expect(html).toContain(`mailto:${SUPPORT_EMAIL}`);
        expect(html).toContain(t.policy);
        expect(html).not.toContain(t.adminFooter);
      } else {
        expect(html).toContain(t.adminFooter);
        expect(html).not.toContain(t.policy);
      }

      expect(text.length).toBeGreaterThan(50);
      expect(text).not.toMatch(/<[a-z][^>]*>/i);
    });
  }

  it("covers every template in the folder", () => {
    const names = new Set(templates.map((tmpl) => tmpl.name.split(" ")[0]));
    expect(names.size).toBe(10);
  });
});

describe("launch email signature", () => {
  it("shows an unsubscribe link only when one is given, in the email's language", async () => {
    const without = await renderEmail(
      React.createElement(CategoryLaunchEmail, { locale: "es", category: "apparel", shopUrl: "https://x.test" })
    );
    expect(without.html).not.toContain(layoutStrings("es").unsubscribe);
    expect(without.html).toContain('lang="es"');

    const withLink = await renderEmail(
      React.createElement(CategoryLaunchEmail, {
        locale: "es",
        category: "apparel",
        shopUrl: "https://x.test",
        unsubscribeUrl: "https://x.test/unsubscribe?t=abc",
      })
    );
    expect(withLink.html).toContain("https://x.test/unsubscribe?t=abc");
    expect(withLink.html).toContain(layoutStrings("es").unsubscribe);
  });
});
