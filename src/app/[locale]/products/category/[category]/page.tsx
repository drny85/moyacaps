import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { ShopView } from "@/components/shop/ShopView";
import { shopMetadata } from "@/lib/server/shopMetadata";
import { isShopCategory, SHOP_CATEGORIES } from "@/lib/shopRoutes";
import { api } from "@convex/_generated/api";
import { queryForStaticRender } from "@/lib/server/convexStatic";
import { statusFor } from "@/lib/launch";

type Params = Promise<{ locale: string; category: string }>;

/**
 * Prerendered Shop category view. Served for `/{locale}/products?category=…` through the
 * proxy rewrite (src/lib/shopRoutes.ts, ADR 0020); the address bar keeps the public URL.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => SHOP_CATEGORIES.map((category) => ({ locale, category })));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, category } = await params;
  return shopMetadata(locale, isShopCategory(category) ? category : null);
}

export default async function ShopCategoryPage({ params }: { params: Params }) {
  const { locale, category } = await params;
  if (!isShopCategory(category)) notFound();
  // A Hidden category is gone from the store (ADR 0022); Coming Soon renders its teaser in ShopView.
  if (statusFor(await queryForStaticRender(api.settings.functions.getStorefrontLaunch, {}), category) === "hidden") notFound();
  setRequestLocale(locale);
  return (
    <main className="min-h-screen">
      <ShopView initialQuery={`category=${category}`} />
    </main>
  );
}
