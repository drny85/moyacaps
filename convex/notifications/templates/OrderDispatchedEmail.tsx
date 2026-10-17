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

export interface OrderDispatchedEmailProps {
  orderNumber: string;
  customerName?: string;
  carrier: string;
  trackingNumber: string;
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
  supportEmail?: string;
}

export function OrderDispatchedEmail({
  orderNumber = "GL-0880-9921",
  customerName = "Valued Collector",
  carrier = "USPS",
  trackingNumber = "9400111899223344556677",
  carrierTrackingUrl = "https://tools.usps.com",
  storeTrackingUrl = "https://goodluckcaps.com/track",
  estimatedDelivery = "2-4 Business Days",
  shippingAddress = {
    line1: "740 Park Ave",
    city: "New York",
    state: "NY",
    postalCode: "10021",
    country: "US",
  },
  items = [
    {
      name: "Good Luck Signature 0880 Cap",
      quantity: 1,
      price: 185.0,
    },
  ],
  supportEmail = "concierge@goodluckcaps.com",
}: OrderDispatchedEmailProps) {
  const directTracking = carrierTrackingUrl || storeTrackingUrl;

  return (
    <Html>
      <Head />
      <Preview>Your Good Luck order #{orderNumber} has been dispatched via {carrier}!</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header Brand */}
          <Section style={headerSection}>
            <Text style={brandTitle}>
              GOOD<span style={{ color: "#D4AF37" }}>LUCK</span>
            </Text>
            <Text style={brandSubtitle}>0880 ATELIER • DISPATCH CONFIRMATION</Text>
          </Section>

          {/* Dispatch Announcement */}
          <Section style={welcomeSection}>
            <Text style={badge}>ON ITS WAY</Text>
            <Heading as="h1" style={greetingHeading}>
              Your Order Has Been Dispatched
            </Heading>
            <Text style={greetingText}>
              Greetings {customerName}, your handcrafted piece from Good Luck 0880 has been carefully packed and handed to <strong>{carrier}</strong>.
            </Text>
          </Section>

          {/* Tracking Card */}
          <Section style={trackingCard}>
            <Row>
              <Column>
                <Text style={trackingLabel}>COURIER</Text>
                <Text style={trackingValueHighlight}>{carrier}</Text>
              </Column>
              <Column style={{ textAlign: "right" }}>
                <Text style={trackingLabel}>ESTIMATED TRANSIT</Text>
                <Text style={trackingValue}>{estimatedDelivery}</Text>
              </Column>
            </Row>

            <Hr style={dividerSubtle} />

            <Text style={trackingLabel}>TRACKING NUMBER</Text>
            <Text style={trackingNumberText}>{trackingNumber}</Text>

            <Section style={{ textAlign: "center", marginTop: 24, marginBottom: 8 }}>
              <Link href={directTracking} style={primaryButton}>
                Track Shipment Directly →
              </Link>
            </Section>
            <Text style={trackingHelpText}>
              Or visit our atelier portal at{" "}
              <Link href={storeTrackingUrl} style={inlineLink}>
                goodluckcaps.com/track
              </Link>
            </Text>
          </Section>

          {/* Package Details */}
          {items && items.length > 0 && (
            <Section style={card}>
              <Heading as="h3" style={sectionTitle}>
                Items in this Package
              </Heading>
              <Hr style={divider} />
              {items.map((item, idx) => (
                <Row key={idx} style={itemRow}>
                  <Column style={{ width: "80%" }}>
                    <Text style={itemName}>
                      {item.quantity}× {item.name}
                    </Text>
                  </Column>
                  <Column style={{ width: "20%", textAlign: "right" }}>
                    <Text style={itemPrice}>${item.price.toFixed(2)}</Text>
                  </Column>
                </Row>
              ))}
            </Section>
          )}

          {/* Delivery Destination */}
          {shippingAddress && (
            <Section style={card}>
              <Heading as="h3" style={sectionTitle}>
                Delivery Destination
              </Heading>
              <Hr style={divider} />
              <Text style={addressText}>
                {customerName}
                <br />
                {shippingAddress.line1}
                {shippingAddress.line2 ? <><br />{shippingAddress.line2}</> : null}
                <br />
                {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}
                <br />
                {shippingAddress.country}
              </Text>
            </Section>
          )}

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              Need assistance with your delivery? Contact our concierge at{" "}
              <Link href={`mailto:${supportEmail}`} style={footerLink}>
                {supportEmail}
              </Link>
            </Text>
            <Text style={footerCopyright}>
              © {new Date().getFullYear()} Good Luck 0880. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default OrderDispatchedEmail;

// Aesthetic Dark / Gold Styles
const main = {
  backgroundColor: "#0C0A09",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  margin: "0 auto",
  padding: "40px 0",
};

const container = {
  margin: "0 auto",
  padding: "0 20px",
  maxWidth: "580px",
};

const headerSection = {
  textAlign: "center" as const,
  paddingBottom: "24px",
};

const brandTitle = {
  fontSize: "26px",
  fontWeight: "900",
  letterSpacing: "4px",
  color: "#FFFFFF",
  margin: "0 0 6px 0",
};

const brandSubtitle = {
  fontSize: "10px",
  fontWeight: "600",
  letterSpacing: "2.5px",
  color: "#A8A29E",
  margin: 0,
};

const welcomeSection = {
  textAlign: "center" as const,
  padding: "24px 16px 20px 16px",
};

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

const greetingHeading = {
  fontSize: "22px",
  fontWeight: "700",
  color: "#F5F5F4",
  margin: "0 0 10px 0",
  letterSpacing: "-0.5px",
};

const greetingText = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#A8A29E",
  margin: "0",
};

const trackingCard = {
  backgroundColor: "#18181B",
  borderRadius: "14px",
  border: "1px solid #27272A",
  padding: "24px",
  marginTop: "16px",
  marginBottom: "20px",
};

const trackingLabel = {
  fontSize: "10px",
  fontWeight: "700",
  letterSpacing: "1.5px",
  color: "#71717A",
  margin: "0 0 4px 0",
};

const trackingValueHighlight = {
  fontSize: "16px",
  fontWeight: "700",
  color: "#FAFAFA",
  margin: 0,
};

const trackingValue = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#E4E4E7",
  margin: 0,
};

const trackingNumberText = {
  fontSize: "18px",
  fontFamily: "monospace",
  fontWeight: "700",
  letterSpacing: "1px",
  color: "#D4AF37",
  margin: "4px 0 0 0",
};

const primaryButton = {
  display: "inline-block",
  backgroundColor: "#D4AF37",
  color: "#09090B",
  fontSize: "13px",
  fontWeight: "700",
  letterSpacing: "0.5px",
  padding: "14px 28px",
  borderRadius: "8px",
  textDecoration: "none",
  textAlign: "center" as const,
};

const trackingHelpText = {
  fontSize: "12px",
  color: "#71717A",
  textAlign: "center" as const,
  margin: "12px 0 0 0",
};

const inlineLink = {
  color: "#D4AF37",
  textDecoration: "underline",
};

const card = {
  backgroundColor: "#141416",
  borderRadius: "12px",
  border: "1px solid #27272A",
  padding: "20px 24px",
  marginBottom: "20px",
};

const sectionTitle = {
  fontSize: "13px",
  fontWeight: "700",
  letterSpacing: "1.2px",
  textTransform: "uppercase" as const,
  color: "#E4E4E7",
  margin: "0 0 12px 0",
};

const divider = {
  borderColor: "#27272A",
  borderWidth: "1px",
  margin: "0 0 14px 0",
};

const dividerSubtle = {
  borderColor: "#27272A",
  borderWidth: "1px",
  margin: "16px 0",
};

const itemRow = {
  padding: "6px 0",
};

const itemName = {
  fontSize: "14px",
  fontWeight: "500",
  color: "#D4D4D8",
  margin: 0,
};

const itemPrice = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#FAFAFA",
  margin: 0,
};

const addressText = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "#A1A1AA",
  margin: 0,
};

const footerSection = {
  textAlign: "center" as const,
  paddingTop: "20px",
};

const footerText = {
  fontSize: "12px",
  lineHeight: "18px",
  color: "#71717A",
  margin: "0 0 8px 0",
};

const footerLink = {
  color: "#D4AF37",
  textDecoration: "underline",
};

const footerCopyright = {
  fontSize: "11px",
  color: "#52525B",
  margin: 0,
};
