import { permanentRedirect } from "next/navigation";

/** Legacy product URL (shared links, emails, order snapshots): every Product now lives at /products/[slug] (ADR 0015). */
export default async function LegacyCapPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  permanentRedirect(`/${locale}/products/${encodeURIComponent(id)}`);
}
