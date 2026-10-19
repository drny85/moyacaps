"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { ChevronRight } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { Link } from "@/i18n/routing";
import { useUrlQuery } from "@/components/routing/useUrlQuery";
import { toCapVariant } from "@/lib/toCapVariant";
import { getCapAngleImages } from "@/lib/capAngles";
import { applyShop, DEFAULT_STATE, isTee } from "@/lib/shop";
import { gallerySlides, initialSelection, type Selection, type SkuStock } from "@/lib/productOptions";
import { useCapVariants } from "@/hooks/useCapVariants";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { ProductCard } from "@/components/catalog/ProductCard";

export type ProductWithSkus = Doc<"variants"> & { skus: SkuStock[] };

/**
 * One product page for caps and tees (ADR 0015/0016). The server passes the product it
 * rendered; the live Convex query then keeps price and SKU stock current. Colour and size
 * live in the URL so a shared link opens on the same choice.
 */
export function ProductView({ initial }: { initial: ProductWithSkus }) {
  const t = useTranslations("product");
  const tPdp = useTranslations("pdp");
  const locale = useLocale();
  const { freeShippingThresholdUnits } = useStoreSettings();
  const [query, setQuery, querySync] = useUrlQuery();
  const [now] = useState(() => Date.now());

  const live = useQuery(api.catalog.queries.getProductBySlug, { slug: initial.variantId });
  const doc = live ?? initial;
  const product = useMemo(() => toCapVariant(doc), [doc]);
  const skus: SkuStock[] = doc.skus;
  const tee = isTee(product);
  const name = locale === "es" ? product.nameEs : product.nameEn;

  // The choice lives in the URL; the static page renders the default until it is read (ADR 0020)
  const selection = useMemo<Selection>(() => {
    const params = new URLSearchParams(query);
    return initialSelection(product, { colorway: params.get("colorway"), size: params.get("size") });
  }, [product, query]);
  const select = (next: Selection) => {
    const params = new URLSearchParams();
    if (next.colorway) params.set("colorway", next.colorway);
    if (next.size) params.set("size", next.size);
    setQuery(params.toString());
  };

  const colorway = product.colorways?.find((c) => c.id === selection.colorway);
  const slides = useMemo(
    () =>
      gallerySlides(product, selection, name, tee ? null : getCapAngleImages(product), {
        lifestyle: t("onModel"),
        artwork: t("artwork"),
        angle: (a) => (a === "left" ? t("angleLeft") : a === "back" ? t("angleBack") : t("angleRight")),
        colorway: colorway ? (locale === "es" ? colorway.nameEs : colorway.nameEn) : undefined,
      }),
    [product, selection, name, tee, colorway, locale, t]
  );

  const { caps: catalog } = useCapVariants();
  const related = useMemo(
    () =>
      applyShop(
        catalog.filter((p) => p.id !== product.id),
        { ...DEFAULT_STATE, category: tee ? "tees" : "caps", inStock: true },
        now
      ).slice(0, 8),
    [catalog, product.id, tee, now]
  );

  const category = tee ? "tees" : "caps";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-20 lg:pt-8">
      {querySync}
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/products" className="hover:text-zinc-900 dark:hover:text-white">
          {t("breadcrumbShop")}
        </Link>
        <ChevronRight aria-hidden className="h-3.5 w-3.5" />
        <Link href={`/products?category=${category}`} className="hover:text-zinc-900 dark:hover:text-white">
          {tee ? t("breadcrumbTees") : t("breadcrumbCaps")}
        </Link>
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          <ProductGallery slides={slides} resetKey={selection.colorway ?? product.id} />
        </div>

        <div className="lg:col-span-5">
          <div className="flex flex-col gap-6 lg:sticky lg:top-[calc(var(--navbar-h,66px)+1.5rem)]">
            <header>
              <h1 className="font-poster text-[clamp(2.25rem,8vw,3.5rem)] uppercase leading-[0.92] tracking-tight text-zinc-900 dark:text-white">
                {name}
              </h1>
              <p className="mt-3 font-display text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">
                ${product.priceUsd}
                <span className="ml-1.5 text-sm font-medium text-zinc-500">USD</span>
              </p>
            </header>

            <ProductPurchase product={product} skus={skus} selection={selection} onSelect={select} now={now} />

            <div className="divide-y divide-black/[0.08] border-y border-black/[0.08] dark:divide-white/[0.08] dark:border-white/[0.08]">
              {tee ? (
                <>
                  {(product.fabricEn || product.fitEn) && (
                    <Detail title={t("detailsFabricFit")} open>
                      <ul className="flex flex-col gap-1">
                        {[locale === "es" ? product.fabricEs : product.fabricEn, locale === "es" ? product.fitEs : product.fitEn]
                          .filter(Boolean)
                          .map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                      </ul>
                    </Detail>
                  )}
                  <Detail title={t("detailsPrint")}>
                    <p>{product.printPosition === "back" ? t("printBack") : t("printFront")}. {t("printBody")}</p>
                  </Detail>
                  <Detail title={t("detailsCare")}>
                    <p>{t("teeCare")}</p>
                  </Detail>
                </>
              ) : (
                <>
                  <Detail title={t("detailsBuild")} open>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                      {(
                        [
                          ["specCrown", "specCrownVal"],
                          ["specVisor", "specVisorVal"],
                          ["specStitch", "specStitchVal"],
                          ["specClosure", "specClosureVal"],
                          ["specFabric", "specFabricVal"],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k} className="contents">
                          <dt className="text-zinc-500">{tPdp(k)}</dt>
                          <dd>{tPdp(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  </Detail>
                  <Detail title={t("detailsCare")}>
                    <p>{tPdp("specCareVal")}</p>
                  </Detail>
                </>
              )}
              <Detail title={t("detailsShipping")}>
                <p>{t("shippingBody", { threshold: freeShippingThresholdUnits })}</p>
              </Detail>
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16 lg:mt-24" aria-labelledby="related-heading">
          <h2 id="related-heading" className="mb-5 font-poster text-4xl uppercase leading-none text-zinc-900 dark:text-white sm:text-5xl">
            {tee ? t("moreTees") : t("moreCaps")}
          </h2>
          <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
            {related.map((item) => (
              <li key={item.product.id} className="w-[44%] shrink-0 snap-start sm:w-[30%] lg:w-auto">
                <ProductCard item={item} now={now} defer />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Detail({ title, open = false, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group py-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between font-display text-[15px] font-semibold text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red dark:text-white">
        {title}
        <span aria-hidden className="text-xl leading-none text-zinc-400 transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{children}</div>
    </details>
  );
}
