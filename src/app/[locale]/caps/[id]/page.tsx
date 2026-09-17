import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { CAP_VARIANTS } from "@/data/caps";
import { ProductDetailView } from "@/components/product/ProductDetailView";

export function generateStaticParams() {
  const params: { locale: string; id: string }[] = [];
  for (const locale of routing.locales) {
    for (const cap of CAP_VARIANTS) {
      params.push({ locale, id: cap.id });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const cap = CAP_VARIANTS.find((c) => c.id === id);

  if (!cap) {
    return {
      title: "Cap Not Found | Moya Caps",
    };
  }

  const name = locale === "es" ? cap.nameEs : cap.nameEn;
  const description =
    locale === "es"
      ? `Gorra oficial Moya Caps 0880 Good Luck — ${name}. Bordado 3D de alta densidad, diablos laterales y silueta ${cap.silhouette}.`
      : `Official Moya Caps 0880 Good Luck Cap — ${name}. High-density 3D puff embroidery, twin pitchfork devil flanks, and ${cap.silhouette} profile.`;

  return {
    title: `${name} | Moya Caps 0880 Good Luck Edition`,
    description,
    openGraph: {
      title: `${name} | Moya Caps 0880`,
      description,
      images: [
        {
          url: cap.image,
          width: 800,
          height: 800,
          alt: name,
        },
      ],
    },
  };
}

export default async function CapDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const cap = CAP_VARIANTS.find((c) => c.id === id);

  if (!cap) {
    notFound();
  }

  return (
    <main className="min-h-screen pt-4 pb-20">
      <ProductDetailView cap={cap} allCaps={CAP_VARIANTS} />
    </main>
  );
}
