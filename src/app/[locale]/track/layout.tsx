import { FullMessagesProvider } from "@/components/providers/FullMessagesProvider";
import type { Metadata } from "next";
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

export default function TrackLayout({
  children,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  return <FullMessagesProvider>{children}</FullMessagesProvider>;
}
