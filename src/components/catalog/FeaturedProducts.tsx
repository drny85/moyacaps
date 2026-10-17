"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useCapVariants } from "@/hooks/useCapVariants";
import { pickFeatured } from "@/lib/homepage";
import { ProductCard } from "@/components/catalog/ProductCard";

const COUNT = 8;

/** Eight purchasable products, caps and tees alternating, with a way into the full Shop. */
export function FeaturedProducts() {
  const t = useTranslations("home");
  const { caps: catalog } = useCapVariants();
  const [now] = useState(() => Date.now());
  const items = useMemo(() => pickFeatured(catalog, COUNT, now), [catalog, now]);
  if (items.length === 0) return null;

  return (
    <section id="featured" aria-labelledby="featured-heading" className="mx-auto w-full max-w-7xl scroll-mt-24 px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 id="featured-heading" className="font-poster text-5xl uppercase leading-none text-zinc-950 dark:text-white sm:text-6xl">
          {t("featuredTitle")}
        </h2>
        <Link
          href="/products"
          className="group inline-flex shrink-0 items-center gap-1.5 pb-1 font-display text-sm font-semibold text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
        >
          {t("shopAll", { count: catalog.length })}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.product.id}>
            <ProductCard item={item} now={now} />
          </li>
        ))}
      </ul>
    </section>
  );
}
