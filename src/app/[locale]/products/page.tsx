import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { ShopView } from "@/components/shop/ShopView";
import { shopMetadata } from "@/lib/server/shopMetadata";

type Params = Promise<{ locale: string }>;

// Static (ADR 0019): `?category=` requests are rewritten to products/category/[category]
// by the proxy; other filters are applied in the browser.
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return shopMetadata(locale, null);
}

export default async function ShopPage({ params }: { params: Params }) {
  setRequestLocale((await params).locale);
  return (
    <main className="min-h-screen">
      <ShopView />
    </main>
  );
}
