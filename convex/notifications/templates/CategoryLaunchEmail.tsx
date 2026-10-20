import React from "react";
import { Section, Heading, Text, Link } from "@react-email/components";
import { BaseEmailLayout } from "./layout/BaseEmailLayout";
import { colors, styles } from "./layout/tokens";

export interface CategoryLaunchEmailProps {
  locale: "en" | "es";
  category: "headwear" | "apparel";
  name?: string;
  shopUrl: string;
  /** The reader's unsubscribe page (notifications/unsubscribe.ts); the layout shows it in the signature. */
  unsubscribeUrl?: string;
}

const COPY = {
  en: {
    headwear: { thing: "Caps", heading: "The caps just dropped." },
    apparel: { thing: "Tees", heading: "The tees just dropped." },
    greeting: (name?: string) => (name ? `${name}, you asked us to tell you first.` : "You asked us to tell you first."),
    body: "They're live in the shop now. Quantities are limited, so don't sleep on it.",
    cta: "Shop now",
    footer: "You're getting this because you signed up for a Good Luck launch alert. It's a one-time email.",
  },
  es: {
    headwear: { thing: "Gorras", heading: "Ya salieron las gorras." },
    apparel: { thing: "Playeras", heading: "Ya salieron las playeras." },
    greeting: (name?: string) => (name ? `${name}, nos pediste que te avisáramos primero.` : "Nos pediste que te avisáramos primero."),
    body: "Ya están en la tienda. Las cantidades son limitadas, no te quedes sin la tuya.",
    cta: "Comprar ahora",
    footer: "Recibes esto porque te registraste para un aviso de lanzamiento de Good Luck. Es un correo único.",
  },
} as const;

/** Subject line for a launch email; the template and the sender share the copy. */
export function categoryLaunchSubject(locale: "en" | "es", category: "headwear" | "apparel"): string {
  return locale === "es"
    ? `¡Ya salieron las ${COPY.es[category].thing.toLowerCase()}! — Good Luck`
    : `${COPY.en[category].thing} just dropped — Good Luck`;
}

export function CategoryLaunchEmail({ locale, category, name, shopUrl, unsubscribeUrl }: CategoryLaunchEmailProps) {
  const copy = COPY[locale];
  return (
    <BaseEmailLayout preview={copy[category].heading} audience="customer" locale={locale} unsubscribeUrl={unsubscribeUrl}>
      <Section style={styles.heroSection}>
        <Heading as="h1" style={heading}>
          {copy[category].heading}
        </Heading>
        <Text style={styles.paragraph}>{copy.greeting(name)}</Text>
        <Text style={styles.paragraph}>{copy.body}</Text>
      </Section>
      <Section style={styles.buttonRow}>
        <Link href={shopUrl} style={styles.button}>
          {copy.cta}
        </Link>
      </Section>
      <Text style={reason}>{copy.footer}</Text>
    </BaseEmailLayout>
  );
}

const heading = { ...styles.heading, fontSize: "28px", lineHeight: "34px" };
const reason = { fontSize: "12px", lineHeight: "18px", color: colors.subtle, textAlign: "center" as const, margin: "0 0 8px 0" };
