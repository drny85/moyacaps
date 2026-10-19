import React from "react";
import { Html, Head, Preview, Body, Container, Section, Heading, Text, Link } from "@react-email/components";

export interface CategoryLaunchEmailProps {
  locale: "en" | "es";
  category: "headwear" | "apparel";
  name?: string;
  shopUrl: string;
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

export function CategoryLaunchEmail({ locale, category, name, shopUrl }: CategoryLaunchEmailProps) {
  const copy = COPY[locale];
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{copy[category].heading}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={brand}>
              GOOD<span style={{ color: "#D4AF37" }}>LUCK</span>
            </Text>
          </Section>
          <Section style={content}>
            <Heading as="h1" style={heading}>
              {copy[category].heading}
            </Heading>
            <Text style={text}>{copy.greeting(name)}</Text>
            <Text style={text}>{copy.body}</Text>
            <Link href={shopUrl} style={button}>
              {copy.cta}
            </Link>
          </Section>
          <Text style={footer}>{copy.footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#0a0a0a", fontFamily: "Helvetica, Arial, sans-serif", margin: 0, padding: "24px 0" };
const container = { backgroundColor: "#111111", maxWidth: "560px", margin: "0 auto", borderRadius: "12px", overflow: "hidden" as const };
const header = { padding: "28px 32px 0" };
const brand = { color: "#ffffff", fontSize: "22px", fontWeight: 800, letterSpacing: "4px", margin: 0 };
const content = { padding: "16px 32px 32px" };
const heading = { color: "#ffffff", fontSize: "28px", lineHeight: "34px", margin: "8px 0 16px" };
const text = { color: "#d4d4d4", fontSize: "16px", lineHeight: "24px", margin: "0 0 12px" };
const button = {
  display: "inline-block",
  backgroundColor: "#D4AF37",
  color: "#0a0a0a",
  fontWeight: 700,
  fontSize: "15px",
  padding: "12px 24px",
  borderRadius: "999px",
  textDecoration: "none",
  marginTop: "12px",
};
const footer = { color: "#737373", fontSize: "12px", lineHeight: "18px", padding: "0 32px 28px", margin: 0 };
