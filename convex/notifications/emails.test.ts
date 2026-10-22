/// <reference types="vite/client" />
/**
 * The transactional senders in emails.ts with the Resend client stubbed (security review M12):
 * which recipients are skipped, what reaches Resend (recipient, reply-to, idempotency key,
 * rendered body), and that a Resend failure is reported in the result instead of thrown.
 */
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { SUPPORT_EMAIL } from "./orderEmails";

const resend = vi.hoisted(() => ({ sendEmail: vi.fn() }));

vi.mock("@convex-dev/resend", () => ({
  Resend: class {
    sendEmail = resend.sendEmail;
  },
}));

const modules = import.meta.glob("/convex/**/*.ts");
const t = () => convexTest(schema, modules);

const items = [{ variantId: "V1", name: "Cap V1", quantity: 1, price: 50, image: "/img.png" }];
const receipt = (customerEmail: string) => ({
  orderNumber: "GL-MAIL-1",
  total: 58,
  currency: "USD",
  customerName: "Ana Buyer",
  customerEmail,
  items,
  subtotal: 50,
  shippingFee: 8,
});

const sent = (call = 0) => resend.sendEmail.mock.calls[call][1];

beforeEach(() => {
  resend.sendEmail.mockReset();
  resend.sendEmail.mockResolvedValue("email_1");
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe("sendCustomerReceipt", () => {
  it("skips an unsendable address without calling Resend", async () => {
    for (const customerEmail of ["", "not-an-email", "a@b.com,c@d.com"]) {
      expect(await t().action(internal.notifications.emails.sendCustomerReceipt, receipt(customerEmail))).toEqual({
        success: false,
        reason: "invalid_email",
      });
    }
    expect(resend.sendEmail).not.toHaveBeenCalled();
  });

  it("sends once per order, replying to support, linking to the site's tracking page", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://staging.example.com/";
    const result = await t().action(internal.notifications.emails.sendCustomerReceipt, receipt("ana@example.com"));

    expect(result).toEqual({ success: true, emailId: "email_1" });
    expect(sent()).toMatchObject({
      to: "ana@example.com",
      replyTo: [SUPPORT_EMAIL],
      subject: expect.stringContaining("GL-MAIL-1"),
      idempotencyKey: "customer-receipt-GL-MAIL-1",
    });
    expect(sent().html).toContain("https://staging.example.com/track?order=GL-MAIL-1");
    expect(sent().text).toContain("GL-MAIL-1");
  });

  it("says an out-of-territory order will be refunded", async () => {
    await t().action(internal.notifications.emails.sendCustomerReceipt, { ...receipt("ana@example.com"), outOfTerritory: true });
    expect(sent().subject).toMatch(/can't ship it/);
  });

  it("reports a Resend failure in the result instead of throwing", async () => {
    resend.sendEmail.mockRejectedValueOnce(new Error("Resend is down"));
    expect(await t().action(internal.notifications.emails.sendCustomerReceipt, receipt("ana@example.com"))).toEqual({
      success: false,
      error: "Resend is down",
    });
  });
});

describe("sendAdminOrderAlert", () => {
  it("goes to the admin inbox, keyed by order and payment method", async () => {
    process.env.ADMIN_NOTIFICATION_EMAIL = "orders@example.com";
    try {
      await t().action(internal.notifications.emails.sendAdminOrderAlert, {
        orderNumber: "GL-MAIL-1",
        total: 58,
        currency: "USD",
        paymentMethod: "card",
        customerEmail: "ana@example.com",
        items,
      });
    } finally {
      delete process.env.ADMIN_NOTIFICATION_EMAIL;
    }
    expect(sent()).toMatchObject({
      to: "orders@example.com",
      idempotencyKey: "admin-alert-GL-MAIL-1-card",
      subject: expect.stringContaining("USD $58.00"),
    });
    expect(sent().html).toContain("https://goodluckcaps.com/admin/orders/GL-MAIL-1");
  });
});

describe("sendOrderDispatchedEmail", () => {
  it("uses a different idempotency key per stage, so in-transit follows the label email", async () => {
    const tt = t();
    const args = { orderNumber: "GL-MAIL-1", customerEmail: "ana@example.com", carrier: "USPS", trackingNumber: "9400111" };
    await tt.action(internal.notifications.emails.sendOrderDispatchedEmail, args);
    await tt.action(internal.notifications.emails.sendOrderDispatchedEmail, { ...args, stage: "in_transit" });

    expect(resend.sendEmail).toHaveBeenCalledTimes(2);
    expect(sent(0).idempotencyKey).not.toBe(sent(1).idempotencyKey);
    expect(sent(0).html).toContain("9400111");
  });

  it("skips an unsendable address", async () => {
    expect(
      await t().action(internal.notifications.emails.sendOrderDispatchedEmail, { orderNumber: "GL-MAIL-1", customerEmail: "nope" })
    ).toEqual({ success: false, reason: "invalid_email" });
    expect(resend.sendEmail).not.toHaveBeenCalled();
  });
});
