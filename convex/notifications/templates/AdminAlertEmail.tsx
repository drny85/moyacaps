import React from "react";
import { Html, Head, Preview, Body, Container, Section, Heading, Text, Link, Row, Column } from "@react-email/components";
import type { AdminAlert } from "../orderEmails";

export interface AdminAlertEmailProps {
  alert: AdminAlert;
  actionUrl: string;
  actionLabel: string;
}

/** An operational alert for the Administrator; copy comes from orderEmails.ts. */
export function AdminAlertEmail({ alert, actionUrl, actionLabel }: AdminAlertEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{alert.subject}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={welcomeSection}>
            <Text style={badge}>{alert.badge}</Text>
            <Heading as="h1" style={heading}>
              {alert.heading}
            </Heading>
            {alert.orderNumber && <Text style={subheading}>Order #{alert.orderNumber}</Text>}
            <Text style={bodyText}>{alert.body}</Text>
          </Section>

          {alert.facts.length > 0 && (
            <Section style={card}>
              {alert.facts.map((fact, idx) => (
                <Row key={idx} style={{ padding: "4px 0" }}>
                  <Column style={{ width: "35%" }}>
                    <Text style={factLabel}>{fact.label}</Text>
                  </Column>
                  <Column style={{ width: "65%" }}>
                    <Text style={factValue}>{fact.value}</Text>
                  </Column>
                </Row>
              ))}
            </Section>
          )}

          <Section style={{ textAlign: "center" as const, paddingBottom: "20px" }}>
            <Link href={actionUrl} style={primaryButton}>
              {actionLabel}
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default AdminAlertEmail;

const main = {
  backgroundColor: "#0C0A09",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  margin: "0 auto",
  padding: "40px 0",
};

const container = { margin: "0 auto", padding: "0 20px", maxWidth: "580px" };

const welcomeSection = { textAlign: "center" as const, padding: "16px 16px 12px 16px" };

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

const heading = { fontSize: "22px", fontWeight: "700", color: "#F5F5F4", margin: "0 0 6px 0" };

const subheading = { fontSize: "13px", fontWeight: "600", color: "#D4AF37", margin: "0 0 10px 0" };

const bodyText = { fontSize: "14px", lineHeight: "22px", color: "#A8A29E", margin: 0 };

const card = {
  backgroundColor: "#18181B",
  borderRadius: "14px",
  border: "1px solid #27272A",
  padding: "20px 24px",
  margin: "16px 0 20px 0",
};

const factLabel = { fontSize: "11px", fontWeight: "700", letterSpacing: "1px", color: "#71717A", margin: 0 };

const factValue = { fontSize: "13px", color: "#FAFAFA", margin: 0, wordBreak: "break-all" as const };

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
