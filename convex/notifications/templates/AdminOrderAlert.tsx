import React from "react";
import { Section, Heading, Text, Link, Hr, Row, Column } from "@react-email/components";
import { formatStoreDateTime } from "../../lib/storeTime";
import { BaseEmailLayout } from "./layout/BaseEmailLayout";
import { OrderSummary, formatAddress, money, type OrderItemProp } from "./layout/OrderSummary";
import { badgeStyle, colors, styles } from "./layout/tokens";

export type { OrderItemProp } from "./layout/OrderSummary";

export interface AdminOrderAlertProps {
  orderNumber: string;
  total: number;
  currency: string;
  paymentMethod: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
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
  adminDashboardUrl?: string;
  createdAt?: number;
}

export function AdminOrderAlertEmail({
  orderNumber = "GL-TEST1234",
  total = 85.0,
  currency = "USD",
  customerName = "Valued Customer",
  customerEmail = "customer@example.com",
  customerPhone = "+1 (555) 000-0000",
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
  adminDashboardUrl = "https://goodluckcaps.com/admin/orders",
  createdAt = Date.now(),
}: AdminOrderAlertProps) {
  const dateStr = formatStoreDateTime(createdAt);

  return (
    <BaseEmailLayout preview={`[New Order] #${orderNumber} received (${money(currency, total)})`} audience="admin">
      <Section style={styles.heroSection}>
        <Text style={badgeStyle("success")}>Paid · Stripe verified</Text>
        <Heading as="h1" style={styles.heading}>
          New order #{orderNumber}
        </Heading>
        <Text style={meta}>{dateStr}</Text>
      </Section>

      <Section style={styles.card}>
        <Row>
          <Column>
            <Text style={styles.label}>Order number</Text>
            <Text style={bigValue}>#{orderNumber}</Text>
          </Column>
          <Column align="right">
            <Text style={styles.label}>Total value</Text>
            <Text style={{ ...bigValue, color: colors.gold }}>{money(currency, total)}</Text>
          </Column>
        </Row>
      </Section>

      <Section style={styles.card}>
        <Heading as="h3" style={styles.subheading}>
          Customer & shipping
        </Heading>
        <Hr style={styles.divider} />
        <Text style={styles.paragraph}>
          <strong>Customer:</strong> {customerName || "Not provided"}
        </Text>
        <Text style={styles.paragraph}>
          <strong>Email:</strong>{" "}
          {customerEmail ? (
            <Link href={`mailto:${customerEmail}`} style={styles.link}>
              {customerEmail}
            </Link>
          ) : (
            "Not provided"
          )}
        </Text>
        {customerPhone && (
          <Text style={styles.paragraph}>
            <strong>Phone:</strong>{" "}
            <Link href={`tel:${customerPhone}`} style={styles.link}>
              {customerPhone}
            </Link>
          </Text>
        )}
        {shippingAddress && (
          <Text style={styles.paragraph}>
            <strong>Address:</strong> {formatAddress(shippingAddress)}
          </Text>
        )}
      </Section>

      <OrderSummary
        title={`Purchased items (${items.reduce((acc, item) => acc + (item.quantity || 1), 0)})`}
        items={items}
        currency={currency}
        subtotal={subtotal}
        shippingFee={shippingFee}
        tax={tax}
      />

      <Section style={styles.buttonRow}>
        <Link href={adminDashboardUrl} style={styles.button}>
          Manage order in admin
        </Link>
        <Text style={{ ...meta, margin: "12px 0 0 0" }}>Buy the label, check customer notes, or update fulfillment.</Text>
      </Section>
    </BaseEmailLayout>
  );
}

export default AdminOrderAlertEmail;

const meta = { fontSize: "12px", lineHeight: "18px", color: colors.muted, margin: "0" };
const bigValue = { ...styles.mono, fontSize: "18px", fontWeight: "700", margin: "0" };
