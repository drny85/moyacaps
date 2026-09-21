import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEs = locale === "es";
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://moyacaps.vercel.app").replace(/\/$/, "");

  return {
    title: isEs ? "Rastrear Pedido | Good Luck" : "Track Order | Good Luck",
    description: isEs
      ? "Consulta el estado en tiempo real y el despacho de tu orden Good Luck."
      : "Inspect live fulfillment progress and carrier tracking for your Good Luck order.",
    alternates: {
      canonical: `${siteUrl}/${locale}/track`,
      languages: {
        en: `${siteUrl}/en/track`,
        es: `${siteUrl}/es/track`,
      },
    },
  };
}

export default function TrackLayout({
  children,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  return <>{children}</>;
}
