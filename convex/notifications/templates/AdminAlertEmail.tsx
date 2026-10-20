import React from "react";
import { Section, Heading, Text, Link, Row, Column } from "@react-email/components";
import type { AdminAlert } from "../orderEmails";
import { BaseEmailLayout } from "./layout/BaseEmailLayout";
import { badgeStyle, colors, styles } from "./layout/tokens";

export interface AdminAlertEmailProps {
  alert: AdminAlert;
  actionUrl: string;
  actionLabel: string;
}

/** An operational alert for the Administrator; copy comes from orderEmails.ts. */
export function AdminAlertEmail({ alert, actionUrl, actionLabel }: AdminAlertEmailProps) {
  return (
    <BaseEmailLayout preview={alert.subject} audience="admin">
      <Section style={styles.heroSection}>
        <Text style={badgeStyle("warning")}>{alert.badge}</Text>
        <Heading as="h1" style={styles.heading}>
          {alert.heading}
        </Heading>
        {alert.orderNumber && <Text style={orderLine}>Order #{alert.orderNumber}</Text>}
        <Text style={styles.paragraph}>{alert.body}</Text>
      </Section>

      {alert.facts.length > 0 && (
        <Section style={styles.card}>
          {alert.facts.map((fact, idx) => (
            <Row key={idx} style={{ padding: "4px 0" }}>
              <Column style={{ width: "35%" }}>
                <Text style={styles.label}>{fact.label}</Text>
              </Column>
              <Column style={{ width: "65%" }}>
                <Text style={factValue}>{fact.value}</Text>
              </Column>
            </Row>
          ))}
        </Section>
      )}

      <Section style={styles.buttonRow}>
        <Link href={actionUrl} style={styles.button}>
          {actionLabel}
        </Link>
      </Section>
    </BaseEmailLayout>
  );
}

export default AdminAlertEmail;

const orderLine = { ...styles.mono, fontSize: "13px", fontWeight: "600", color: colors.gold, margin: "0 0 10px 0" };
const factValue = { fontSize: "13px", color: colors.text, margin: 0, wordBreak: "break-all" as const };
