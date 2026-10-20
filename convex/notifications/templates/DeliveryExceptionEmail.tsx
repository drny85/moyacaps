import React from "react";
import { Html, Head, Preview, Body, Container, Section, Heading, Text, Link } from "@react-email/components";
import type { DeliveryExceptionCopy } from "../deliveryException";

export interface DeliveryExceptionEmailProps {
  orderNumber: string;
  greetingName?: string;
  copy: DeliveryExceptionCopy;
  carrier: string;
  trackingNumber: string;
  details?: string;
  location?: string;
  actionUrl: string;
  actionLabel: string;
  supportEmail?: string;
}

/** Delivery Exception / returned-to-sender notice, for the Administrator or the Customer. */
export function DeliveryExceptionEmail({
  orderNumber,
  greetingName,
  copy,
  carrier,
  trackingNumber,
  details,
  location,
  actionUrl,
  actionLabel,
  supportEmail = "orders@goodluckcaps.com",
}: DeliveryExceptionEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{copy.subject}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            <Text style={brandTitle}>
              GOOD<span style={{ color: "#D4AF37" }}>LUCK</span>
            </Text>
          </Section>

          <Section style={welcomeSection}>
            <Text style={badge}>{copy.badge}</Text>
            <Heading as="h1" style={greetingHeading}>
              {copy.heading}
            </Heading>
            <Text style={greetingText}>
              {greetingName ? `Hi ${greetingName}, ` : ""}order <strong>#{orderNumber}</strong>. {copy.body}
            </Text>
          </Section>

          <Section style={card}>
            <Text style={metaLabel}>COURIER & TRACKING</Text>
            <Text style={metaValue}>
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

          <Section style={{ textAlign: "center" as const, paddingBottom: "20px" }}>
            <Link href={actionUrl} style={primaryButton}>
              {actionLabel}
            </Link>
          </Section>

          <Section style={footerSection}>
            <Text style={footerText}>
              Questions? <Link href={`mailto:${supportEmail}`} style={footerLink}>{supportEmail}</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default DeliveryExceptionEmail;

const main = {
  backgroundColor: "#0C0A09",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  margin: "0 auto",
  padding: "40px 0",
};

const container = { margin: "0 auto", padding: "0 20px", maxWidth: "580px" };

const headerSection = { textAlign: "center" as const, paddingBottom: "24px" };

const brandTitle = { fontSize: "26px", fontWeight: "900", letterSpacing: "4px", color: "#FFFFFF", margin: 0 };

const welcomeSection = { textAlign: "center" as const, padding: "24px 16px 20px 16px" };

const badge = {
  display: "inline-block",
  fontSize: "10px",
  fontWeight: "700",
  letterSpacing: "2px",
  color: "#F59E0B",
  backgroundColor: "rgba(245, 158, 11, 0.12)",
  border: "1px solid rgba(245, 158, 11, 0.3)",
  borderRadius: "9999px",
  padding: "4px 12px",
  marginBottom: "14px",
};

const greetingHeading = { fontSize: "22px", fontWeight: "700", color: "#F5F5F4", margin: "0 0 10px 0" };

const greetingText = { fontSize: "14px", lineHeight: "22px", color: "#A8A29E", margin: 0 };

const card = {
  backgroundColor: "#18181B",
  borderRadius: "14px",
  border: "1px solid #27272A",
  padding: "24px",
  margin: "16px 0 20px 0",
};

const metaLabel = { fontSize: "10px", fontWeight: "700", letterSpacing: "1.5px", color: "#71717A", margin: "0 0 4px 0" };

const metaValue = { fontSize: "14px", fontWeight: "600", color: "#FAFAFA", margin: 0 };

const detailsText = { fontSize: "13px", lineHeight: "19px", color: "#A1A1AA", margin: "6px 0 0 0" };

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

const footerText = { fontSize: "12px", lineHeight: "18px", color: "#71717A", margin: 0 };

const footerLink = { color: "#D4AF37", textDecoration: "underline" };
