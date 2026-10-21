import React from "react";
import { Section, Heading, Text, Link } from "@react-email/components";
import { reviewInviteCopy } from "../orderEmails";
import { BaseEmailLayout } from "./layout/BaseEmailLayout";
import { badgeStyle, colors, styles } from "./layout/tokens";

export interface ReviewInviteEmailProps {
  orderNumber: string;
  customerName?: string;
  /** Names of the products the Customer can still review on this Order. */
  itemNames?: string[];
  reviewUrl?: string;
  /** Visible opt-out link in the footer. */
  unsubscribeUrl?: string;
}

export function ReviewInviteEmail({
  orderNumber = "GL-1001",
  customerName = "Valued Customer",
  itemNames = ["Good Luck Signature Cap"],
  reviewUrl = "https://goodluckcaps.com/account/orders",
  unsubscribeUrl,
}: ReviewInviteEmailProps) {
  const text = reviewInviteCopy(orderNumber);
  return (
    <BaseEmailLayout preview={text.preview} audience="customer" unsubscribeUrl={unsubscribeUrl}>
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
        <Text style={styles.label}>Waiting for your review</Text>
        {itemNames.map((name, idx) => (
          <Text key={idx} style={styles.value}>
            {name}
          </Text>
        ))}
        <Section style={{ textAlign: "center" as const, margin: "20px 0 0 0" }}>
          <Link href={reviewUrl} style={styles.button}>
            Write a review
          </Link>
        </Section>
      </Section>

      <Text style={note}>It takes a minute. You will only get this one email for the order.</Text>
    </BaseEmailLayout>
  );
}

export default ReviewInviteEmail;

const note = { fontSize: "13px", lineHeight: "20px", color: colors.muted, textAlign: "center" as const, margin: "0 0 12px 0" };
