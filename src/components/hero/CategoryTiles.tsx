"use client";

import Image from "next/image";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpRight, Bell } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useCapVariants } from "@/hooks/useCapVariants";
import { categoryEntries, homeTiles } from "@/lib/homepage";
import { useCategoryLaunches } from "@/hooks/useCategoryLaunches";

/**
 * Caps and Tees entry points right under the hero: each is the category's Catalog Shot,
 * its name in poster type, how many styles there are and the starting price.
 */
export function CategoryTiles() {
  const t = useTranslations("home");
  const { caps: catalog } = useCapVariants();
  const launches = useCategoryLaunches();
  const tiles = useMemo(
    () => homeTiles(categoryEntries(catalog, { caps: "negro-rojo", tees: "butterfly-grunge-tee" }), launches),
    [catalog, launches]
  );
  if (tiles.length === 0) return null;
  // A lone tile spans the row, so it becomes a wide banner instead of a very tall card.
  const tileAspect = tiles.length === 1 ? "sm:aspect-[21/9]" : "sm:aspect-[5/4]";

  return (
    <nav aria-label={t("categoriesLabel")} className="mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6 sm:pb-20 lg:px-8">
      <ul className={`grid gap-3 sm:gap-5 ${tiles.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
        {tiles.map((tile) =>
          tile.kind === "soon" ? (
            <li key={tile.category}>
              <Link
                href={`/products?category=${tile.category}`}
                className={`group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-[18px] bg-zinc-950 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-5 ${tileAspect}`}
              >
                <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-moya-red/30 blur-3xl" />
                <p className="relative font-poster text-[clamp(2rem,9vw,4.5rem)] uppercase leading-[0.85] text-white">
                  {tile.category === "caps" ? t("caps") : t("tees")}
                </p>
                <p className="relative mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/85 sm:text-sm">
                  <Bell className="h-3.5 w-3.5" />
                  {t("droppingSoon")}
                </p>
              </Link>
            </li>
          ) : (
          <li key={tile.category}>
            <Link
              href={`/products?category=${tile.category}`}
              className={`group relative block aspect-[4/5] overflow-hidden rounded-[18px] bg-[#ECEAE6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red focus-visible:ring-offset-2 focus-visible:ring-offset-background ${tileAspect}`}
            >
              <Image
                src={tile.entry.image}
                alt=""
                fill
                sizes="(min-width: 640px) 45vw, 48vw"
                className="object-cover object-[50%_40%] transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.04]"
              />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/55 via-black/15 to-transparent p-3 pt-16 sm:p-5">
                <div>
                  <p className="font-poster text-[clamp(2rem,9vw,4.5rem)] uppercase leading-[0.85] text-white">
                    {tile.category === "caps" ? t("caps") : t("tees")}
                  </p>
                  <p className="mt-1 text-[13px] text-white/85 sm:text-sm">
                    {t("tileMeta", { count: tile.entry.count, price: tile.entry.fromPrice })}
                  </p>
                </div>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-zinc-950 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 sm:h-11 sm:w-11">
                  <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5" />
                </span>
              </div>
            </Link>
          </li>
          )
        )}
      </ul>
    </nav>
  );
}
