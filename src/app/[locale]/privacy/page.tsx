import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalPage, legalMetadata } from "@/components/legal/LegalPage";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return legalMetadata((await params).locale, "privacy");
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage locale={locale} doc="privacy" />;
}
