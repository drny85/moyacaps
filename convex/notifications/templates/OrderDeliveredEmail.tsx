import React from "react";
import { Section, Heading, Text, Link, Hr } from "@react-email/components";
import { careGuide, deliveredCopy, SUPPORT_EMAIL } from "../orderEmails";
import { BaseEmailLayout } from "./layout/BaseEmailLayout";
import { OrderSummary, type OrderItemProp } from "./layout/OrderSummary";
import { badgeStyle, colors, styles } from "./layout/tokens";

export interface OrderDeliveredEmailProps {
  orderNumber: string;
  customerName?: string;
  carrier?: string;
  trackingNumber?: string;
  deliveredLocation?: string;
  deliveredDetails?: string;
  storeTrackingUrl?: string;
  items?: OrderItemProp[];
}

export function OrderDeliveredEmail({
  orderNumber = "GL-1001",
  customerName = "Valued Customer",
  carrier = "USPS",
  trackingNumber = "9400111899223344556677",
  deliveredLocation = "In or at the mailbox • New York, NY",
  deliveredDetails = "Package handed directly to resident or placed in secure receptacle",
  storeTrackingUrl = "https://goodluckcaps.com/track",
  items = [
    {
      name: "Good Luck Signature Cap",
      quantity: 1,
      price: 185.0,
    },
  ],
}: OrderDeliveredEmailProps) {
  const text = deliveredCopy(orderNumber);
  const careTips = careGuide(items);
  return (
    <BaseEmailLayout preview={text.preview} audience="customer">
      <Section style={styles.heroSection}>
        <Text style={badgeStyle("success")}>{text.badge}</Text>
        <Heading as="h1" style={styles.heading}>
          {text.heading}
        </Heading>
        <Text style={styles.paragraph}>
          Hi {customerName}, {text.body}
        </Text>
      </Section>

      <Section style={styles.card}>
        <Text style={styles.label}>Courier & tracking</Text>
        <Text style={{ ...styles.value, ...styles.mono, color: colors.gold }}>
          {[carrier, trackingNumber].filter(Boolean).join(" • ") || "Delivered"}
        </Text>
        <Hr style={styles.divider} />
        <Text style={styles.label}>Delivery scan</Text>
        <Text style={styles.value}>{deliveredLocation}</Text>
        {deliveredDetails && <Text style={detailsText}>{deliveredDetails}</Text>}
        <Section style={{ textAlign: "center" as const, margin: "20px 0 0 0" }}>
          <Link href={storeTrackingUrl} style={styles.button}>
            View your order
          </Link>
        </Section>
      </Section>

      <Section style={styles.card}>
        <Heading as="h3" style={styles.subheading}>
          Care guide
        </Heading>
        <Hr style={styles.divider} />
        {careTips.map((tip, idx) => (
          <Text key={idx} style={styles.paragraph}>
            <strong>{tip.title}:</strong> {tip.body}
          </Text>
        ))}
      </Section>

      {items && items.length > 0 && <OrderSummary title="Package contents" items={items} currency="USD" />}

      <Text style={missing}>Didn't get your package? Write to us at {SUPPORT_EMAIL} and we'll sort it out.</Text>
    </BaseEmailLayout>
  );
}

export default OrderDeliveredEmail;

const detailsText = { fontSize: "13px", lineHeight: "20px", color: colors.muted, margin: "0" };
const missing = { fontSize: "13px", lineHeight: "20px", color: colors.muted, textAlign: "center" as const, margin: "0 0 12px 0" };
