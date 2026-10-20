import React from "react";
import { Section, Heading, Text, Link } from "@react-email/components";
import type { DeliveryExceptionCopy } from "../deliveryException";
import { BaseEmailLayout, type EmailAudience } from "./layout/BaseEmailLayout";
import { badgeStyle, colors, styles } from "./layout/tokens";

export interface DeliveryExceptionEmailProps {
  audience: EmailAudience;
  orderNumber: string;
  greetingName?: string;
  copy: DeliveryExceptionCopy;
  carrier: string;
  trackingNumber: string;
  details?: string;
  location?: string;
  actionUrl: string;
  actionLabel: string;
}

/** Delivery Exception / returned-to-sender notice, for the Administrator or the Customer. */
export function DeliveryExceptionEmail({
  audience,
  orderNumber,
  greetingName,
  copy,
  carrier,
  trackingNumber,
  details,
  location,
  actionUrl,
  actionLabel,
}: DeliveryExceptionEmailProps) {
  return (
    <BaseEmailLayout preview={copy.subject} audience={audience}>
      <Section style={styles.heroSection}>
        <Text style={badgeStyle("warning")}>{copy.badge}</Text>
        <Heading as="h1" style={styles.heading}>
          {copy.heading}
        </Heading>
        <Text style={styles.paragraph}>
          {greetingName ? `Hi ${greetingName}, ` : ""}order <strong>#{orderNumber}</strong>. {copy.body}
        </Text>
      </Section>

      <Section style={styles.card}>
        <Text style={styles.label}>Courier & tracking</Text>
        <Text style={{ ...styles.value, ...styles.mono }}>
          {carrier} • {trackingNumber}
        </Text>
        {(details || location) && (
          <Text style={detailsText}>
            {details}
            {details && location ? " — " : ""}
            {location}
          </Text>
        )}
      </Section>

      <Section style={styles.buttonRow}>
        <Link href={actionUrl} style={styles.button}>
          {actionLabel}
        </Link>
      </Section>
    </BaseEmailLayout>
  );
}

export default DeliveryExceptionEmail;

const detailsText = { fontSize: "13px", lineHeight: "20px", color: colors.muted, margin: 0 };
