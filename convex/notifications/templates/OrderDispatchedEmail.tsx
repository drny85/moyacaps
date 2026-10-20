import React from "react";
import { Section, Heading, Text, Link, Hr, Row, Column } from "@react-email/components";
import { dispatchedCopy, type ShipmentCopy } from "../orderEmails";
import { BaseEmailLayout } from "./layout/BaseEmailLayout";
import { OrderSummary, type OrderItemProp } from "./layout/OrderSummary";
import { badgeStyle, colors, styles } from "./layout/tokens";

export interface OrderDispatchedEmailProps {
  orderNumber: string;
  customerName?: string;
  // Copy for the stage this email announces (orderEmails.ts dispatchedCopy).
  copy?: ShipmentCopy;
  carrier?: string;
  trackingNumber?: string;
  carrierTrackingUrl?: string;
  storeTrackingUrl?: string;
  estimatedDelivery?: string;
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  items?: OrderItemProp[];
}

export function OrderDispatchedEmail({
  orderNumber = "GL-1001",
  customerName = "Valued Customer",
  copy,
  carrier = "USPS",
  trackingNumber = "9400111899223344556677",
  carrierTrackingUrl = "https://tools.usps.com",
  storeTrackingUrl = "https://goodluckcaps.com/track",
  estimatedDelivery = "2–5 Business Days",
  shippingAddress = {
    line1: "740 Park Ave",
    city: "New York",
    state: "NY",
    postalCode: "10021",
    country: "US",
  },
  items = [
    {
      name: "Good Luck Signature Cap",
      quantity: 1,
      price: 185.0,
    },
  ],
}: OrderDispatchedEmailProps) {
  const directTracking = carrierTrackingUrl || storeTrackingUrl;
  const text = copy ?? dispatchedCopy("label_purchased", orderNumber, carrier);

  return (
    <BaseEmailLayout preview={text.preview} audience="customer">
      <Section style={styles.heroSection}>
        <Text style={badgeStyle("gold")}>{text.badge}</Text>
        <Heading as="h1" style={styles.heading}>
          {text.heading}
        </Heading>
        <Text style={styles.paragraph}>
          Hi {customerName}, order <strong>#{orderNumber}</strong>. {text.body}
        </Text>
      </Section>

      <Section style={styles.card}>
        <Row>
          <Column>
            <Text style={styles.label}>Courier</Text>
            <Text style={{ ...styles.value, color: colors.gold, fontWeight: "700" }}>{carrier}</Text>
          </Column>
          <Column style={{ textAlign: "right" }}>
            <Text style={styles.label}>Estimated transit</Text>
            <Text style={styles.value}>{estimatedDelivery}</Text>
          </Column>
        </Row>
        {trackingNumber && (
          <>
            <Hr style={styles.divider} />
            <Text style={styles.label}>Tracking number</Text>
            <Text style={{ ...styles.value, ...styles.mono, fontSize: "16px", letterSpacing: "1px" }}>{trackingNumber}</Text>
          </>
        )}
        <Section style={{ textAlign: "center" as const, margin: "20px 0 8px 0" }}>
          <Link href={directTracking} style={styles.button}>
            Track your package
          </Link>
        </Section>
        <Text style={help}>
          Or track it at{" "}
          <Link href={storeTrackingUrl} style={styles.link}>
            goodluckcaps.com/track
          </Link>
        </Text>
      </Section>

      {items && items.length > 0 && <OrderSummary title="Items in this package" items={items} currency="USD" />}

      {shippingAddress && (
        <Section style={styles.card}>
          <Heading as="h3" style={styles.subheading}>
            Delivery destination
          </Heading>
          <Hr style={styles.divider} />
          <Text style={styles.paragraph}>
            {customerName}
            <br />
            {shippingAddress.line1}
            {shippingAddress.line2 ? (
              <>
                <br />
                {shippingAddress.line2}
              </>
            ) : null}
            <br />
            {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}
            <br />
            {shippingAddress.country}
          </Text>
        </Section>
      )}
    </BaseEmailLayout>
  );
}

export default OrderDispatchedEmail;

const help = { fontSize: "12px", lineHeight: "18px", color: colors.muted, textAlign: "center" as const, margin: "0" };
