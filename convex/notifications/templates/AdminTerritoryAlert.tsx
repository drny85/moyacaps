import React from "react";
import { Section, Heading, Text, Link } from "@react-email/components";
import { BaseEmailLayout } from "./layout/BaseEmailLayout";
import { badgeStyle, styles } from "./layout/tokens";

export interface AdminTerritoryAlertProps {
  orderNumber: string;
  total: number;
  currency: string;
  reason: string;
  customerName?: string;
  customerEmail?: string;
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  adminDashboardUrl: string;
}

/** A paid Order whose shipping address is outside the Fulfillment Territory: refund it before packing. */
export function AdminTerritoryAlertEmail({
  orderNumber = "GL-TEST1234",
  total = 85.0,
  currency = "USD",
  reason = "US territories (PR) are outside the Fulfillment Territory.",
  customerName,
  customerEmail,
  shippingAddress,
  adminDashboardUrl = "https://goodluckcaps.com/admin/orders",
}: AdminTerritoryAlertProps) {
  const amount = `${currency.toUpperCase()} $${total.toFixed(2)}`;
  return (
    <BaseEmailLayout
      preview={`Refund before packing: Order #${orderNumber} ships outside the Fulfillment Territory`}
      audience="admin"
    >
      <Section style={styles.heroSection}>
        <Text style={badgeStyle("danger")}>Fulfillment Territory alert</Text>
        <Heading as="h1" style={styles.heading}>
          Order #{orderNumber} is outside the Fulfillment Territory
        </Heading>
        <Text style={styles.paragraph}>
          This Order was paid ({amount}) but its shipping address is outside the 50 US States and DC. Refund it in the
          admin desk before anyone packs it. Do not ship it.
        </Text>
      </Section>

      <Section style={styles.card}>
        <Text style={styles.label}>Why</Text>
        <Text style={styles.value}>{reason}</Text>
        <Text style={styles.label}>Ship to</Text>
        <Text style={styles.value}>
          {customerName || "Unknown customer"}
          {customerEmail ? ` · ${customerEmail}` : ""}
        </Text>
        {shippingAddress ? (
          <Text style={styles.value}>
            {shippingAddress.line1}
            {shippingAddress.line2 ? `, ${shippingAddress.line2}` : ""}, {shippingAddress.city},{" "}
            {shippingAddress.state} {shippingAddress.postalCode}, {shippingAddress.country}
          </Text>
        ) : null}
      </Section>

      <Section style={styles.buttonRow}>
        <Link href={adminDashboardUrl} style={styles.button}>
          Open order in admin
        </Link>
      </Section>
    </BaseEmailLayout>
  );
}

export default AdminTerritoryAlertEmail;
