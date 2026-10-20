import React from "react";
import { Html, Head, Preview, Body, Container, Section, Heading, Text, Link } from "@react-email/components";
import type { CustomerNotice } from "../orderEmails";
import { POLICY_LINE, SUPPORT_EMAIL } from "../orderEmails";

export interface CustomerNoticeEmailProps {
  notice: CustomerNotice;
  greetingName?: string;
  actionUrl: string;
}

/** A short Customer notice (order cancelled, refund issued); copy comes from orderEmails.ts. */
export function CustomerNoticeEmail({ notice, greetingName, actionUrl }: CustomerNoticeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{notice.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            <Text style={brandTitle}>
              GOOD<span style={{ color: "#D4AF37" }}>LUCK</span>
            </Text>
          </Section>

          <Section style={welcomeSection}>
            <Text style={badge}>{notice.badge}</Text>
            <Heading as="h1" style={greetingHeading}>
              {notice.heading}
            </Heading>
          </Section>

          <Section style={card}>
            {greetingName && <Text style={paragraph}>Hi {greetingName},</Text>}
            {notice.paragraphs.map((text, idx) => (
              <Text key={idx} style={paragraph}>
                {text}
              </Text>
            ))}
          </Section>

          <Section style={{ textAlign: "center" as const, paddingBottom: "20px" }}>
            <Link href={actionUrl} style={primaryButton}>
              View your order
            </Link>
          </Section>

          <Section style={footerSection}>
            <Text style={footerText}>{POLICY_LINE}</Text>
            <Text style={footerText}>
              Questions? <Link href={`mailto:${SUPPORT_EMAIL}`} style={footerLink}>{SUPPORT_EMAIL}</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default CustomerNoticeEmail;

const main = {
  backgroundColor: "#0C0A09",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  margin: "0 auto",
  padding: "40px 0",
};

const container = { margin: "0 auto", padding: "0 20px", maxWidth: "580px" };

const headerSection = { textAlign: "center" as const, paddingBottom: "24px" };

const brandTitle = { fontSize: "26px", fontWeight: "900", letterSpacing: "4px", color: "#FFFFFF", margin: 0 };

const welcomeSection = { textAlign: "center" as const, padding: "24px 16px 8px 16px" };

const badge = {
  display: "inline-block",
  fontSize: "10px",
  fontWeight: "700",
  letterSpacing: "2px",
  color: "#D4AF37",
  backgroundColor: "rgba(212, 175, 55, 0.12)",
  border: "1px solid rgba(212, 175, 55, 0.3)",
  borderRadius: "9999px",
  padding: "4px 12px",
  marginBottom: "14px",
};

const greetingHeading = { fontSize: "22px", fontWeight: "700", color: "#F5F5F4", margin: "0 0 10px 0" };

const card = {
  backgroundColor: "#18181B",
  borderRadius: "14px",
  border: "1px solid #27272A",
  padding: "24px",
  margin: "16px 0 20px 0",
};

const paragraph = { fontSize: "14px", lineHeight: "22px", color: "#D4D4D8", margin: "0 0 10px 0" };

const primaryButton = {
  display: "inline-block",
  backgroundColor: "#D4AF37",
  color: "#09090B",
  fontSize: "13px",
  fontWeight: "700",
  padding: "14px 28px",
  borderRadius: "8px",
  textDecoration: "none",
};

const footerSection = { textAlign: "center" as const, paddingTop: "20px" };

const footerText = { fontSize: "12px", lineHeight: "18px", color: "#71717A", margin: "0 0 6px 0" };

const footerLink = { color: "#D4AF37", textDecoration: "underline" };
