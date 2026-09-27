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

export interface OrderDeliveredEmailProps {
  orderNumber: string;
  customerName?: string;
  carrier: string;
  trackingNumber: string;
  deliveredLocation?: string;
  deliveredDetails?: string;
  storeTrackingUrl?: string;
  items?: OrderItemProp[];
  supportEmail?: string;
}

export function OrderDeliveredEmail({
  orderNumber = "GL-0880-9921",
  customerName = "Valued Collector",
  carrier = "USPS",
  trackingNumber = "9400111899223344556677",
  deliveredLocation = "In or at the mailbox • New York, NY",
  deliveredDetails = "Package handed directly to resident or placed in secure receptacle",
  storeTrackingUrl = "https://goodluckcaps.com/track",
  items = [
    {
      name: "Good Luck Signature 0880 Cap",
      quantity: 1,
      price: 185.0,
    },
  ],
  supportEmail = "concierge@goodluckcaps.com",
}: OrderDeliveredEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your Good Luck order #{orderNumber} has been delivered!</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header Brand */}
          <Section style={headerSection}>
            <Text style={brandTitle}>
              GOOD<span style={{ color: "#D4AF37" }}>LUCK</span>
            </Text>
            <Text style={brandSubtitle}>0880 ATELIER • DELIVERY CONFIRMATION</Text>
          </Section>

          {/* Delivery Announcement */}
          <Section style={welcomeSection}>
            <Text style={badge}>DELIVERED</Text>
            <Heading as="h1" style={greetingHeading}>
              Your Piece Has Arrived
            </Heading>
            <Text style={greetingText}>
              Greetings {customerName}, courier scanning confirms that order <strong>#{orderNumber}</strong> has been successfully delivered.
            </Text>
          </Section>

          {/* Delivery Details Card */}
          <Section style={deliveryCard}>
            <Row>
              <Column>
                <Text style={metaLabel}>COURIER & TRACKING</Text>
                <Text style={metaValueHighlight}>
                  {carrier} • {trackingNumber}
                </Text>
              </Column>
            </Row>

            <Hr style={dividerSubtle} />

            <Text style={metaLabel}>DELIVERY SCAN</Text>
            <Text style={deliveryLocationText}>{deliveredLocation}</Text>
            {deliveredDetails && (
              <Text style={deliveryDetailsText}>{deliveredDetails}</Text>
            )}

            <Section style={{ textAlign: "center", marginTop: 20 }}>
              <Link href={storeTrackingUrl} style={primaryButton}>
                View Order & Invoice Receipt →
              </Link>
            </Section>
          </Section>

          {/* Headwear Care Guide */}
          <Section style={card}>
            <Heading as="h3" style={sectionTitle}>
              Headwear Care & Preservation
            </Heading>
            <Hr style={divider} />
            <Text style={careItem}>
              <strong>1. Crown Preservation:</strong> Store your cap upright on a crown mold, hook, or flat surface to preserve its structured silhouette.
            </Text>
            <Text style={careItem}>
              <strong>2. Moisture & Heat:</strong> Keep away from excessive humidity or direct extreme heat. If exposed to rain, reshape the crown gently and let air-dry at room temperature.
            </Text>
            <Text style={careItem}>
              <strong>3. Spot Cleaning:</strong> Clean gently with a soft bristle brush or a damp lint-free cloth. Never machine wash.
            </Text>
          </Section>

          {/* Package Summary */}
          {items && items.length > 0 && (
            <Section style={card}>
              <Heading as="h3" style={sectionTitle}>
                Package Contents
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

          {/* Concierge Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              Did not receive your package or need concierge assistance? Reply directly or contact us at{" "}
              <Link href={`mailto:${supportEmail}`} style={footerLink}>
                {supportEmail}
              </Link>
            </Text>
            <Text style={footerCopyright}>
              © {new Date().getFullYear()} Good Luck 0880 Atelier. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default OrderDeliveredEmail;

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
  color: "#10B981",
  backgroundColor: "rgba(16, 185, 129, 0.12)",
  border: "1px solid rgba(16, 185, 129, 0.3)",
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

const deliveryCard = {
  backgroundColor: "#18181B",
  borderRadius: "14px",
  border: "1px solid #27272A",
  padding: "24px",
  marginTop: "16px",
  marginBottom: "20px",
};

const metaLabel = {
  fontSize: "10px",
  fontWeight: "700",
  letterSpacing: "1.5px",
  color: "#71717A",
  margin: "0 0 4px 0",
};

const metaValueHighlight = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#FAFAFA",
  margin: 0,
};

const deliveryLocationText = {
  fontSize: "16px",
  fontWeight: "700",
  color: "#10B981",
  margin: "4px 0 0 0",
};

const deliveryDetailsText = {
  fontSize: "13px",
  lineHeight: "19px",
  color: "#A1A1AA",
  margin: "6px 0 0 0",
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

const careItem = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "#A1A1AA",
  margin: "0 0 10px 0",
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
