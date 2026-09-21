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

export interface OrderItemProp {
  variantId?: string;
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

export interface AdminOrderAlertProps {
  orderNumber: string;
  total: number;
  currency: string;
  paymentMethod: string;
  isWhatsAppPending?: boolean;
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
  orderNumber = "MC-TEST1234",
  total = 85.0,
  currency = "USD",
  paymentMethod = "stripe",
  isWhatsAppPending = false,
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
  adminDashboardUrl = "https://moyacaps.com/admin/orders",
  createdAt = Date.now(),
}: AdminOrderAlertProps) {
  const isWhatsApp = paymentMethod === "whatsapp" || isWhatsAppPending;
  const badgeBg = isWhatsApp ? "#d97706" : "#059669";
  const badgeText = isWhatsApp ? "ACTION REQUIRED: WhatsApp Payment" : "PAID - Stripe Verified";

  const dateStr = new Date(createdAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <Html>
      <Head />
      <Preview>
        {isWhatsApp
          ? `[WhatsApp Order] Action required for #${orderNumber} (${currency} ${total.toFixed(2)})`
          : `[New Order] #${orderNumber} received (${currency} ${total.toFixed(2)})`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header Brand */}
          <Section style={headerSection}>
            <Row>
              <Column>
                <Text style={brandTitle}>
                  GOOD<span style={{ color: "#E11D48" }}>LUCK</span>
                </Text>
                <Text style={brandSubtitle}>OPERATIONS HQ — ORDER ALERT</Text>
              </Column>
              <Column align="right">
                <Text style={dateText}>{dateStr}</Text>
              </Column>
            </Row>
          </Section>

          {/* Status Badge */}
          <Section style={{ ...statusBadgeContainer, backgroundColor: badgeBg }}>
            <Text style={statusBadgeText}>{badgeText}</Text>
          </Section>

          {/* Order Summary Box */}
          <Section style={card}>
            <Row>
              <Column>
                <Text style={label}>Order Number</Text>
                <Heading as="h2" style={orderHeading}>
                  #{orderNumber}
                </Heading>
              </Column>
              <Column align="right">
                <Text style={label}>Total Value</Text>
                <Heading as="h2" style={totalHeading}>
                  {currency} ${total.toFixed(2)}
                </Heading>
              </Column>
            </Row>
          </Section>

          {/* Customer & Shipping Details */}
          <Section style={card}>
            <Heading as="h3" style={sectionTitle}>
              Customer & Shipping
            </Heading>
            <Hr style={divider} />
            <Text style={detailRow}>
              <strong>Customer:</strong> {customerName || "Not provided"}
            </Text>
            <Text style={detailRow}>
              <strong>Email:</strong>{" "}
              {customerEmail ? (
                <Link href={`mailto:${customerEmail}`} style={linkStyle}>
                  {customerEmail}
                </Link>
              ) : (
                "Not provided"
              )}
            </Text>
            {customerPhone && (
              <Text style={detailRow}>
                <strong>Phone:</strong>{" "}
                <Link href={`tel:${customerPhone}`} style={linkStyle}>
                  {customerPhone}
                </Link>
              </Text>
            )}
            {shippingAddress && (
              <Text style={detailRow}>
                <strong>Address:</strong>{" "}
                {shippingAddress.line1}
                {shippingAddress.line2 ? `, ${shippingAddress.line2}` : ""},{" "}
                {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode},{" "}
                {shippingAddress.country}
              </Text>
            )}
          </Section>

          {/* Purchased Items */}
          <Section style={card}>
            <Heading as="h3" style={sectionTitle}>
              Purchased Items ({items.reduce((acc, item) => acc + (item.quantity || 1), 0)})
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
          </Section>

          {/* Action CTA */}
          <Section style={ctaSection}>
            <Link href={adminDashboardUrl} style={button}>
              Manage Order in Operations HQ →
            </Link>
            <Text style={ctaHelp}>
              Click to assign tracking, inspect customer notes, or mark as dispatched.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Good Luck Automated Notification System • Confidential Admin Dispatch
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default AdminOrderAlertEmail;

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
  paddingBottom: "16px",
};

const brandTitle: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: "900",
  letterSpacing: "-0.5px",
  color: "#ffffff",
  margin: "0 0 2px 0",
};

const brandSubtitle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: "700",
  letterSpacing: "1.5px",
  color: "#a1a1aa",
  margin: 0,
};

const dateText: React.CSSProperties = {
  fontSize: "12px",
  color: "#71717a",
  margin: 0,
};

const statusBadgeContainer: React.CSSProperties = {
  borderRadius: "8px",
  padding: "10px 16px",
  marginBottom: "16px",
  textAlign: "center",
};

const statusBadgeText: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: "800",
  letterSpacing: "0.5px",
  color: "#ffffff",
  textTransform: "uppercase",
  margin: 0,
};

const card: React.CSSProperties = {
  backgroundColor: "#18181b",
  borderRadius: "8px",
  border: "1px solid #27272a",
  padding: "16px",
  marginBottom: "16px",
};

const label: React.CSSProperties = {
  fontSize: "11px",
  color: "#a1a1aa",
  textTransform: "uppercase",
  letterSpacing: "1px",
  margin: "0 0 4px 0",
};

const orderHeading: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: "800",
  color: "#ffffff",
  fontFamily: "monospace",
  margin: 0,
};

const totalHeading: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: "800",
  color: "#22c55e",
  margin: 0,
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

const linkStyle: React.CSSProperties = {
  color: "#38bdf8",
  textDecoration: "none",
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
  padding: "2px 0",
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
  fontSize: "11px",
  color: "#71717a",
  marginTop: "8px",
};

const footer: React.CSSProperties = {
  textAlign: "center",
  paddingTop: "12px",
  borderTop: "1px solid #27272a",
};

const footerText: React.CSSProperties = {
  fontSize: "10px",
  color: "#52525b",
  margin: 0,
};
