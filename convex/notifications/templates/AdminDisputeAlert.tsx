import React from "react";
import { Section, Heading, Text, Link, Hr, Row, Column } from "@react-email/components";
import { formatStoreDateTime } from "../../lib/storeTime";
import { BaseEmailLayout } from "./layout/BaseEmailLayout";
import { badgeStyle, colors, styles } from "./layout/tokens";

export interface AdminDisputeAlertProps {
  orderNumber: string;
  total: number;
  currency: string;
  disputeId: string;
  reason?: string;
  status: string;
  evidenceDueBy?: number;
  isClosed?: boolean;
  outcome?: string;
  adminDashboardUrl: string;
  stripeDisputeUrl: string;
  createdAt?: number;
}

export function AdminDisputeAlertEmail({
  orderNumber = "GL-TEST1234",
  total = 85.0,
  currency = "USD",
  disputeId = "dp_test123",
  reason = "fraudulent",
  status = "needs_response",
  evidenceDueBy,
  isClosed = false,
  outcome,
  adminDashboardUrl = "https://goodluckcaps.com/admin/orders",
  stripeDisputeUrl = "https://dashboard.stripe.com/disputes",
  createdAt = Date.now(),
}: AdminDisputeAlertProps) {
  const previewText = isClosed
    ? `Dispute closed for Order #${orderNumber} (${currency} $${total.toFixed(2)}) — ${outcome || status}`
    : `🚨 URGENT: Payment dispute opened for Order #${orderNumber} (${currency} $${total.toFixed(2)})`;

  const dueByFormatted = evidenceDueBy
    ? formatStoreDateTime(evidenceDueBy)
    : "Review in Stripe Dashboard";

  return (
    <BaseEmailLayout preview={previewText} audience="admin">
      <Section style={styles.heroSection}>
        <Text style={badgeStyle(isClosed ? "success" : "danger")}>
          {isClosed ? "Dispute resolved" : "Action required"}
        </Text>
        <Heading as="h1" style={styles.heading}>
          {isClosed ? `Dispute closed: Order #${orderNumber}` : `Payment dispute opened: Order #${orderNumber}`}
        </Heading>
        <Text style={styles.paragraph}>
          {isClosed
            ? `The dispute on order #${orderNumber} has been marked as closed by the cardholder's issuing bank.`
            : `A customer has initiated a chargeback/dispute with their bank for order #${orderNumber}. You must submit evidence before the deadline to contest the claim.`}
        </Text>
      </Section>

      <Section style={styles.card}>
        <Row>
          <Column style={{ width: "50%", paddingRight: "10px" }}>
            <Text style={styles.label}>Disputed amount</Text>
            <Text style={amount}>
              {currency.toUpperCase()} ${total.toFixed(2)}
            </Text>
          </Column>
          <Column style={{ width: "50%", paddingLeft: "10px" }}>
            <Text style={styles.label}>Current status</Text>
            <Text style={{ ...amount, color: isClosed ? colors.success : colors.danger }}>
              {outcome || status.replace(/_/g, " ").toUpperCase()}
            </Text>
          </Column>
        </Row>
        <Hr style={styles.divider} />
        <Row>
          <Column style={{ width: "50%", paddingRight: "10px" }}>
            <Text style={styles.label}>Reason code</Text>
            <Text style={styles.value}>{reason ? reason.replace(/_/g, " ").toUpperCase() : "GENERAL / FRAUD"}</Text>
          </Column>
          <Column style={{ width: "50%", paddingLeft: "10px" }}>
            <Text style={styles.label}>Evidence deadline</Text>
            <Text style={styles.value}>{dueByFormatted}</Text>
          </Column>
        </Row>
      </Section>

      <Section style={styles.buttonRow}>
        <Link href={stripeDisputeUrl} style={styles.button}>
          Open dispute in Stripe
        </Link>
        <Text style={{ margin: "12px 0 0 0" }}>
          <Link href={adminDashboardUrl} style={styles.link}>
            View order in admin
          </Link>
        </Text>
      </Section>

      <Section style={{ textAlign: "center" as const }}>
        <Text style={meta}>
          Dispute ID: <span style={styles.mono}>{disputeId}</span>
        </Text>
        <Text style={meta}>Recorded at: {formatStoreDateTime(createdAt)}</Text>
      </Section>
    </BaseEmailLayout>
  );
}

export default AdminDisputeAlertEmail;

const amount = { ...styles.mono, fontSize: "18px", fontWeight: "700", margin: "0 0 4px 0" };
const meta = { fontSize: "12px", lineHeight: "18px", color: colors.subtle, margin: "0 0 4px 0" };
