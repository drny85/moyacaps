import type { Metadata } from "next";
import { VirtualTryOnStudio } from "@/components/tryon/VirtualTryOnStudio";
import { Link } from "@/i18n/routing";
import { ArrowLeft, Sparkles, ShieldCheck } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEs = locale === "es";
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://goodluckcaps.com").replace(/\/$/, "");

  const title = isEs
    ? "Probador Virtual de Gorras | Good Luck 0880"
    : "Virtual Cap Try-On Mirror | Good Luck 0880";

  const description = isEs
    ? "Pruébate en tiempo real las 16 combinaciones de gorras Good Luck en tu rostro con tu cámara o selfie. 100% privado en tu dispositivo."
    : "Try on all 16 Good Luck streetwear cap colorways on your face in real time via live camera or photo upload. 100% on-device private.";

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/${locale}/try-on`,
      languages: {
        en: `${siteUrl}/en/try-on`,
        es: `${siteUrl}/es/try-on`,
      },
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/${locale}/try-on`,
      type: "website",
      siteName: "Good Luck",
      images: [
        {
          url: `${siteUrl}/caps/negro-rojo.png`,
          width: 1200,
          height: 630,
          alt: "Good Luck Virtual Try-On",
        },
      ],
    },
  };
}

export default async function TryOnPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEs = locale === "es";

  return (
    <div className="min-h-screen py-6 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-display font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isEs ? "Volver a la Colección" : "Back to Collection"}</span>
        </Link>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full glass-dark text-[10px] font-mono text-zinc-500 border border-black/5 dark:border-white/5">
          <ShieldCheck className="w-3 h-3 text-emerald-500" />
          <span>{isEs ? "Cero Almacenamiento en Nube" : "Zero Cloud Storage"}</span>
        </div>
      </div>

      {/* Main Studio Component */}
      <VirtualTryOnStudio isModal={false} />
    </div>
  );
}
