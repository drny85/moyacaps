import { FullMessagesProvider } from "@/components/providers/FullMessagesProvider";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { pageAlternates } from "@/lib/seo/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEs = locale === "es";

  return {
    title: isEs ? "Rastrear Pedido | Good Luck" : "Track Order | Good Luck",
    description: isEs
      ? "Consulta el estado en tiempo real y el despacho de tu orden Good Luck."
      : "Inspect live fulfillment progress and carrier tracking for your Good Luck order.",
    alternates: pageAlternates(locale, "/track"),
  };
}

export default async function TrackLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Locale from the route, not request headers, so /track prerenders (ADR 0020)
  setRequestLocale((await params).locale);
  return <FullMessagesProvider>{children}</FullMessagesProvider>;
}
