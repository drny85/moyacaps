import React from "react";
import { Section, Heading, Text, Link, Hr } from "@react-email/components";
import { receiptCopy, type ReceiptCopy } from "../orderEmails";
import { BaseEmailLayout } from "./layout/BaseEmailLayout";
import { OrderSummary, formatAddress, type OrderItemProp } from "./layout/OrderSummary";
import { styles } from "./layout/tokens";

export interface CustomerReceiptProps {
  orderNumber: string;
  total: number;
  currency: string;
  customerName?: string;
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  items: OrderItemProp[];
  subtotal?: number;
  shippingFee?: number;
  tax?: number;
  trackingUrl?: string;
  returnPolicyUrl?: string;
  // Heading and greeting (orderEmails.ts receiptCopy); defaults to the "preparing your order" copy.
  copy?: ReceiptCopy;
}

export function CustomerReceiptEmail({
  orderNumber = "GL-TEST1234",
  total = 85.0,
  currency = "USD",
  customerName = "Customer",
  shippingAddress = {
    line1: "123 Street Ave",
    city: "Los Angeles",
    state: "CA",
    postalCode: "90001",
    country: "US",
  },
  items = [
    {
      name: "Classic Snapback Cap - Black Edition",
      quantity: 1,
      price: 85.0,
    },
  ],
  subtotal = 85.0,
  shippingFee = 0.0,
  tax = 0.0,
  trackingUrl = "https://goodluckcaps.com/track",
  returnPolicyUrl = "https://goodluckcaps.com/returns",
  copy,
}: CustomerReceiptProps) {
  const text = copy ?? receiptCopy(orderNumber, false);
  return (
    <BaseEmailLayout preview={`Your Good Luck order #${orderNumber} has been received!`} audience="customer">
      <Section style={styles.heroSection}>
        <Heading as="h1" style={styles.heading}>
          {text.heading}
        </Heading>
        <Text style={styles.paragraph}>
          Hi {customerName}, {text.body}
        </Text>
      </Section>

      <OrderSummary
        title="Order summary"
        items={items}
        currency={currency}
        subtotal={subtotal}
        shippingFee={shippingFee}
        tax={tax}
        total={{ label: "Total paid", amount: total }}
      />

      {shippingAddress && (
        <Section style={styles.card}>
          <Heading as="h3" style={styles.subheading}>
            Delivery destination
          </Heading>
          <Hr style={styles.divider} />
          <Text style={styles.paragraph}>{formatAddress(shippingAddress)}</Text>
        </Section>
      )}

      <Section style={styles.buttonRow}>
        <Link href={trackingUrl} style={styles.button}>
          Track order status
        </Link>
      </Section>

      {text.returnsNote && (
        <Text style={styles.paragraph}>
          {text.returnsNote}{" "}
          <Link href={returnPolicyUrl} style={styles.link}>
            Read the Return Policy
          </Link>
        </Text>
      )}
    </BaseEmailLayout>
  );
}

export default CustomerReceiptEmail;
