import type { CapVariant } from "@/data/caps";
import { isTee } from "@/lib/shop";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo/jsonLd";
import { localizedUrl, siteUrl } from "@/lib/seo/site";
import { JsonLd } from "./JsonLd";

/** Product + BreadcrumbList rich results for one product page. */
export function ProductJsonLd({ cap, locale }: { cap: CapVariant; locale: string }) {
  const base = siteUrl();
  const es = locale === "es";
  const category = isTee(cap) ? "tees" : "caps";
  const breadcrumbs = breadcrumbJsonLd([
    { name: es ? "Inicio" : "Home", url: localizedUrl(locale, "", base) },
    { name: es ? "Tienda" : "Shop", url: localizedUrl(locale, "/products", base) },
    {
      name: category === "tees" ? (es ? "Playeras" : "Tees") : (es ? "Gorras" : "Caps"),
      url: localizedUrl(locale, `/products?category=${category}`, base),
    },
    { name: es ? cap.nameEs : cap.nameEn, url: localizedUrl(locale, `/products/${cap.id}`, base) },
  ]);

  return <JsonLd data={[productJsonLd(cap, locale, base, new Date()), breadcrumbs]} />;
}
