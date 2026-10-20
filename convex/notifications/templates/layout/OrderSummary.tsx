import React from "react";
import { Section, Heading, Text, Hr, Row, Column } from "@react-email/components";
import { colors, styles } from "./tokens";

export interface OrderItemProp {
  variantId?: string;
  name: string;
  quantity: number;
  price: number;
  image?: string;
  // Tee lines only (ADR 0015).
  colorway?: string;
  size?: string;
}

export type EmailAddress = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

/** "350 5th Ave, Apt 2, New York, NY 10118, US" */
export function formatAddress(address: EmailAddress): string {
  const street = address.line2 ? `${address.line1}, ${address.line2}` : address.line1;
  return `${street}, ${address.city}, ${address.state} ${address.postalCode}, ${address.country}`;
}

export const money = (currency: string, amount: number) => `${currency.toUpperCase()} $${amount.toFixed(2)}`;

export interface OrderSummaryProps {
  title: string;
  items: OrderItemProp[];
  currency: string;
  subtotal?: number;
  shippingFee?: number;
  tax?: number;
  /** Shown as the last, emphasised row when given (e.g. "Total paid"). */
  total?: { label: string; amount: number };
}

/** The line items and totals card shared by the receipt and the admin order alert. */
export function OrderSummary({ title, items, currency, subtotal, shippingFee, tax, total }: OrderSummaryProps) {
  return (
    <Section style={styles.card}>
      <Heading as="h3" style={styles.subheading}>
        {title}
      </Heading>
      <Hr style={styles.divider} />
      {items.map((item, idx) => (
        <Row key={idx} style={{ padding: "4px 0" }}>
          <Column style={{ width: "70%" }}>
            <Text style={itemName}>
              {item.quantity}x {item.name}
            </Text>
          </Column>
          <Column align="right" style={{ width: "30%" }}>
            <Text style={amount}>{money(currency, item.price * item.quantity)}</Text>
          </Column>
        </Row>
      ))}
      <Hr style={styles.divider} />
      {subtotal !== undefined && <SummaryRow label="Subtotal" value={money(currency, subtotal)} />}
      {shippingFee !== undefined && (
        <SummaryRow label="Shipping" value={shippingFee === 0 ? "FREE" : money(currency, shippingFee)} />
      )}
      {tax !== undefined && tax > 0 && <SummaryRow label="Sales tax" value={money(currency, tax)} />}
      {total && (
        <>
          <Hr style={styles.divider} />
          <Row>
            <Column>
              <Text style={{ ...summaryLabel, fontWeight: "700", color: colors.text }}>{total.label}</Text>
            </Column>
            <Column align="right">
              <Text style={{ ...amount, fontSize: "16px", fontWeight: "800", color: colors.gold }}>
                {money(currency, total.amount)}
              </Text>
            </Column>
          </Row>
        </>
      )}
    </Section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Row>
      <Column>
        <Text style={summaryLabel}>{label}</Text>
      </Column>
      <Column align="right">
        <Text style={amount}>{value}</Text>
      </Column>
    </Row>
  );
}

const itemName = { fontSize: "14px", lineHeight: "20px", color: colors.body, margin: "0" };
const amount = { ...styles.mono, fontSize: "13px", margin: "0" };
const summaryLabel = { fontSize: "13px", color: colors.muted, margin: "2px 0" };
