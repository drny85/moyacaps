import React from "react";
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Link,
  Hr,
  Row,
  Column,
} from "@react-email/components";
import { OrderItemProp } from "./AdminOrderAlert";

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
  supportEmail?: string;
}

export function CustomerReceiptEmail({
  orderNumber = "MC-TEST1234",
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
  trackingUrl = "https://moyacaps.com/track",
  supportEmail = "orders@moyacaps.com",
}: CustomerReceiptProps) {
  return (
    <Html>
      <Head />
      <Preview>Your Moya Caps order #{orderNumber} has been received!</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header Brand */}
          <Section style={headerSection}>
            <Text style={brandTitle}>
              MOYA<span style={{ color: "#E11D48" }}>CAPS</span>
            </Text>
            <Text style={brandSubtitle}>HEADWEAR & APPAREL CRAFTED FOR EXCELLENCE</Text>
          </Section>

          {/* Greeting */}
          <Section style={welcomeSection}>
            <Heading as="h1" style={greetingHeading}>
              Thank You for Your Order!
            </Heading>
            <Text style={greetingText}>
              Hi {customerName}, we&apos;re preparing your order <strong>#{orderNumber}</strong>. We&apos;ll notify you with tracking information as soon as your package ships.
            </Text>
          </Section>

          {/* Order Details Card */}
          <Section style={card}>
            <Heading as="h3" style={sectionTitle}>
              Order Summary
            </Heading>
            <Hr style={divider} />
            {items.map((item, idx) => (
              <Row key={idx} style={itemRow}>
                <Column style={{ width: "70%" }}>
                  <Text style={itemName}>
                    {item.quantity}x {item.name}
                  </Text>
                </Column>
                <Column align="right" style={{ width: "30%" }}>
                  <Text style={itemPrice}>
                    {currency} ${(item.price * item.quantity).toFixed(2)}
                  </Text>
                </Column>
              </Row>
            ))}

            <Hr style={divider} />
            {subtotal !== undefined && (
              <Row style={summaryRow}>
                <Column>
                  <Text style={summaryLabel}>Subtotal</Text>
                </Column>
                <Column align="right">
                  <Text style={summaryValue}>
                    {currency} ${subtotal.toFixed(2)}
                  </Text>
                </Column>
              </Row>
            )}
            {shippingFee !== undefined && (
              <Row style={summaryRow}>
                <Column>
                  <Text style={summaryLabel}>Shipping</Text>
                </Column>
                <Column align="right">
                  <Text style={summaryValue}>
                    {shippingFee === 0 ? "FREE" : `${currency} $${shippingFee.toFixed(2)}`}
                  </Text>
                </Column>
              </Row>
            )}
            {tax !== undefined && tax > 0 && (
              <Row style={summaryRow}>
                <Column>
                  <Text style={summaryLabel}>Sales Tax</Text>
                </Column>
                <Column align="right">
                  <Text style={summaryValue}>
                    {currency} ${tax.toFixed(2)}
                  </Text>
                </Column>
              </Row>
            )}
            <Hr style={divider} />
            <Row style={summaryRow}>
              <Column>
                <Text style={{ ...summaryLabel, fontWeight: "700", color: "#ffffff" }}>
                  Total Paid
                </Text>
              </Column>
              <Column align="right">
                <Text style={{ ...summaryValue, fontSize: "16px", fontWeight: "800", color: "#22c55e" }}>
                  {currency} ${total.toFixed(2)}
                </Text>
              </Column>
            </Row>
          </Section>

          {/* Shipping Address */}
          {shippingAddress && (
            <Section style={card}>
              <Heading as="h3" style={sectionTitle}>
                Delivery Destination
              </Heading>
              <Hr style={divider} />
              <Text style={detailRow}>
                {shippingAddress.line1}
                {shippingAddress.line2 ? `, ${shippingAddress.line2}` : ""},{" "}
                {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode},{" "}
                {shippingAddress.country}
              </Text>
            </Section>
          )}

          {/* CTA Track Order */}
          <Section style={ctaSection}>
            <Link href={trackingUrl} style={button}>
              Track Order Status →
            </Link>
            <Text style={ctaHelp}>
              Have questions about your order? Reply directly to this email or contact us at{" "}
              <Link href={`mailto:${supportEmail}`} style={{ color: "#38bdf8" }}>
                {supportEmail}
              </Link>
              .
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} Moya Caps. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default CustomerReceiptEmail;

/* ── Inline Styles ── */
const main: React.CSSProperties = {
  backgroundColor: "#09090b",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  padding: "32px 0",
  margin: 0,
};

const container: React.CSSProperties = {
  backgroundColor: "#121216",
  borderRadius: "12px",
  border: "1px solid #27272a",
  padding: "24px",
  maxWidth: "580px",
  margin: "0 auto",
};

const headerSection: React.CSSProperties = {
  textAlign: "center",
  paddingBottom: "20px",
  borderBottom: "1px solid #27272a",
  marginBottom: "20px",
};

const brandTitle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "900",
  letterSpacing: "-0.5px",
  color: "#ffffff",
  margin: "0 0 4px 0",
};

const brandSubtitle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: "700",
  letterSpacing: "2px",
  color: "#a1a1aa",
  margin: 0,
};

const welcomeSection: React.CSSProperties = {
  paddingBottom: "16px",
};

const greetingHeading: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: "800",
  color: "#ffffff",
  margin: "0 0 8px 0",
};

const greetingText: React.CSSProperties = {
  fontSize: "14px",
  color: "#a1a1aa",
  lineHeight: "1.6",
  margin: 0,
};

const card: React.CSSProperties = {
  backgroundColor: "#18181b",
  borderRadius: "8px",
  border: "1px solid #27272a",
  padding: "16px",
  marginBottom: "16px",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: "700",
  color: "#ffffff",
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  margin: "0 0 8px 0",
};

const divider: React.CSSProperties = {
  borderColor: "#27272a",
  margin: "8px 0 12px 0",
};

const detailRow: React.CSSProperties = {
  fontSize: "13px",
  color: "#d4d4d8",
  margin: "4px 0",
  lineHeight: "1.5",
};

const itemRow: React.CSSProperties = {
  padding: "4px 0",
};

const itemName: React.CSSProperties = {
  fontSize: "13px",
  color: "#ffffff",
  margin: 0,
};

const itemPrice: React.CSSProperties = {
  fontSize: "13px",
  color: "#a1a1aa",
  fontFamily: "monospace",
  margin: 0,
};

const summaryRow: React.CSSProperties = {
  padding: "4px 0",
};

const summaryLabel: React.CSSProperties = {
  fontSize: "12px",
  color: "#71717a",
  margin: 0,
};

const summaryValue: React.CSSProperties = {
  fontSize: "12px",
  color: "#d4d4d8",
  margin: 0,
  fontFamily: "monospace",
};

const ctaSection: React.CSSProperties = {
  textAlign: "center",
  padding: "16px 0",
};

const button: React.CSSProperties = {
  backgroundColor: "#E11D48",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "700",
  borderRadius: "8px",
  padding: "12px 24px",
  textDecoration: "none",
  display: "inline-block",
};

const ctaHelp: React.CSSProperties = {
  fontSize: "12px",
  color: "#71717a",
  marginTop: "12px",
  lineHeight: "1.5",
};

const footer: React.CSSProperties = {
  textAlign: "center",
  paddingTop: "12px",
  borderTop: "1px solid #27272a",
};

const footerText: React.CSSProperties = {
  fontSize: "11px",
  color: "#52525b",
  margin: 0,
};
