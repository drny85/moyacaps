import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { UnsubscribeConfirmation, type UnsubscribeCopy } from "@/components/unsubscribe/UnsubscribeConfirmation";

const COPY_KEYS = [
  "working",
  "doneTitle",
  "doneBody",
  "alreadyTitle",
  "alreadyBody",
  "invalidTitle",
  "invalidBody",
  "errorTitle",
  "errorBody",
  "retry",
  "backToShop",
] as const satisfies readonly (keyof UnsubscribeCopy)[];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "unsubscribe" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/**
 * Where a marketing email's Unsubscribe link lands (`?token=`, see
 * convex/notifications/unsubscribe.ts). The copy is read here on the server, so the
 * `unsubscribe` namespace never ships with storefront pages (ADR 0018).
 */
export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  const t = await getTranslations("unsubscribe");
  const copy = Object.fromEntries(COPY_KEYS.map((key) => [key, t(key)])) as UnsubscribeCopy;
  return <UnsubscribeConfirmation token={typeof token === "string" ? token : ""} copy={copy} />;
}
