import React from "react";
import { Section, Heading, Text, Link } from "@react-email/components";
import type { CustomerNotice } from "../orderEmails";
import { BaseEmailLayout } from "./layout/BaseEmailLayout";
import { badgeStyle, styles } from "./layout/tokens";

export interface CustomerNoticeEmailProps {
  notice: CustomerNotice;
  greetingName?: string;
  actionUrl: string;
}

/** A short Customer notice (order cancelled, refund issued); copy comes from orderEmails.ts. */
export function CustomerNoticeEmail({ notice, greetingName, actionUrl }: CustomerNoticeEmailProps) {
  return (
    <BaseEmailLayout preview={notice.preview} audience="customer">
      <Section style={styles.heroSection}>
        <Text style={badgeStyle("gold")}>{notice.badge}</Text>
        <Heading as="h1" style={styles.heading}>
          {notice.heading}
        </Heading>
      </Section>

      <Section style={styles.card}>
        {greetingName && <Text style={styles.paragraph}>Hi {greetingName},</Text>}
        {notice.paragraphs.map((text, idx) => (
          <Text key={idx} style={styles.paragraph}>
            {text}
          </Text>
        ))}
      </Section>

      <Section style={styles.buttonRow}>
        <Link href={actionUrl} style={styles.button}>
          View your order
        </Link>
      </Section>
    </BaseEmailLayout>
  );
}

export default CustomerNoticeEmail;
