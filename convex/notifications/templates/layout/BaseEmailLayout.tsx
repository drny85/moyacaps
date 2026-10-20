import React from "react";
import { Html, Head, Preview, Body, Container, Section, Img, Text, Link, Hr } from "@react-email/components";
import { BRAND, BRAND_RED, LOGO_URL, SITE_URL, SUPPORT_EMAIL, type EmailLocale } from "./brand";
import { layoutStrings } from "./strings";
import { colors, fonts } from "./tokens";

export type EmailAudience = "customer" | "admin";

export interface BaseEmailLayoutProps {
  /** Inbox preview line shown next to the subject. */
  preview: string;
  /** Customers get the full signature; Administrators get a short internal footer. */
  audience: EmailAudience;
  locale?: EmailLocale;
  /** Marketing email only: a working one-click unsubscribe link (CAN-SPAM). */
  unsubscribeUrl?: string;
  /** Base URL for the footer links; defaults to the production site. */
  siteUrl?: string;
  children: React.ReactNode;
}

/**
 * The one shell every Good Luck email is wrapped in: document, logo header, body slot and the
 * signature. Templates render only their body inside it, styled with ./tokens, so every
 * email shares one look and one signature.
 */
export function BaseEmailLayout({
  preview,
  audience,
  locale = "en",
  unsubscribeUrl,
  siteUrl = SITE_URL,
  children,
}: BaseEmailLayoutProps) {
  const t = layoutStrings(locale);
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            {/* Same lockup as the storefront footer: mark, GOOD (white) LUCK (red), 0880 badge. */}
            <table role="presentation" align="center" cellPadding={0} cellSpacing={0} style={{ margin: "0 auto" }}>
              <tbody>
                <tr>
                  <td style={{ verticalAlign: "middle", paddingRight: "8px" }}>
                    <Link href={siteUrl}>
                      <Img src={LOGO_URL} alt="" width="28" height="28" style={logo} />
                    </Link>
                  </td>
                  <td style={{ verticalAlign: "middle" }}>
                    <Link href={siteUrl} style={wordmark}>
                      GOOD<span style={{ color: BRAND_RED }}>LUCK</span>
                    </Link>
                  </td>
                  <td style={{ verticalAlign: "middle", paddingLeft: "8px" }}>
                    <span style={badge0880}>0880</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {children}

          <Hr style={rule} />
          {audience === "customer" ? (
            <Section style={footer} data-signature="customer">
              <Text style={footerBrand}>{BRAND}</Text>
              <Text style={footerText}>
                <Link href={`${siteUrl}/products`} style={footerLink}>
                  {t.shop}
                </Link>
                {"  ·  "}
                <Link href={`${siteUrl}/track`} style={footerLink}>
                  {t.trackOrder}
                </Link>
              </Text>
              <Text style={footerText}>{t.policy}</Text>
              <Text style={footerText}>
                {t.questions}{" "}
                <Link href={`mailto:${SUPPORT_EMAIL}`} style={footerLink}>
                  {SUPPORT_EMAIL}
                </Link>
              </Text>
              {unsubscribeUrl && (
                <Text style={footerAddress}>
                  {t.unsubscribeReason}{" "}
                  <Link href={unsubscribeUrl} style={footerLink}>
                    {t.unsubscribe}
                  </Link>
                </Text>
              )}
            </Section>
          ) : (
            <Section style={footer} data-signature="admin">
              <Text style={footerAddress}>{t.adminFooter}</Text>
            </Section>
          )}
        </Container>
      </Body>
    </Html>
  );
}

export default BaseEmailLayout;

const body = { backgroundColor: colors.background, fontFamily: fonts.sans, margin: "0 auto", padding: "32px 0" };
const container = { margin: "0 auto", padding: "0 20px", maxWidth: "580px" };
const header = { textAlign: "center" as const, padding: "0 0 20px 0" };
const logo = { display: "block", border: 0 };
const wordmark = {
  fontSize: "20px",
  fontWeight: "800",
  letterSpacing: "-0.3px",
  color: colors.text,
  textDecoration: "none",
  lineHeight: "28px",
};
const badge0880 = {
  display: "inline-block",
  fontFamily: fonts.mono,
  fontSize: "9px",
  fontWeight: "700",
  lineHeight: "12px",
  padding: "2px 6px",
  borderRadius: "6px",
  color: "#FB7185",
  backgroundColor: "rgba(159, 18, 57, 0.3)",
  border: "1px solid rgba(225, 29, 72, 0.3)",
};
const rule = { borderColor: colors.border, margin: "8px 0 20px 0" };
const footer = { textAlign: "center" as const, padding: "0 0 8px 0" };
const footerBrand = { fontSize: "13px", fontWeight: "700", letterSpacing: "3px", color: colors.text, margin: "0 0 8px 0" };
const footerText = { fontSize: "12px", lineHeight: "18px", color: colors.muted, margin: "0 0 6px 0" };
const footerAddress = { fontSize: "11px", lineHeight: "16px", color: colors.subtle, margin: "0 0 4px 0" };
const footerLink = { color: colors.gold, textDecoration: "underline" };
