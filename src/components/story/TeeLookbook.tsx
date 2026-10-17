"use client";

import Image from "next/image";
import { useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { m } from "framer-motion";
import { Link } from "@/i18n/routing";
import { useCapVariants } from "@/hooks/useCapVariants";
import { useParallax } from "@/hooks/useParallax";
import { lookbookShots } from "@/lib/homepage";

/**
 * Street-photo strip of the tees on model (Lifestyle Shots, ADR 0016). Swipe on phones,
 * scroll sideways on desktop; each photo opens that tee on the colorway shown. Photos drift
 * inside their frames as the strip crosses the viewport (one shared scroll value).
 */
export function TeeLookbook() {
  const t = useTranslations("home");
  const locale = useLocale();
  const { caps: catalog } = useCapVariants();
  const shots = useMemo(() => lookbookShots(catalog, 12), [catalog]);
  const sectionRef = useRef<HTMLElement>(null);
  const drift = useParallax(sectionRef, 60);
  if (shots.length === 0) return null;

  return (
    <section ref={sectionRef} id="lookbook" aria-labelledby="lookbook-heading" className="overflow-hidden pb-20 sm:pb-28">
      <div className="mx-auto mb-6 flex w-full max-w-7xl items-end justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div>
          <h2 id="lookbook-heading" className="font-poster text-5xl uppercase leading-none text-zinc-950 dark:text-white sm:text-6xl">
            {t("lookbookTitle")}
          </h2>
          <p className="mt-2 max-w-md text-base text-zinc-600 dark:text-zinc-400">{t("lookbookBody")}</p>
        </div>
        <Link
          href="/products?category=tees"
          className="hidden shrink-0 pb-1 font-display text-sm font-semibold text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white sm:inline"
        >
          {t("shopTees")}
        </Link>
      </div>

      <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:gap-4 sm:px-6 lg:px-[max(2rem,calc((100vw-80rem)/2+2rem))] [&::-webkit-scrollbar]:hidden">
        {shots.map((s) => {
          const name = locale === "es" ? s.name.es : s.name.en;
          const colorway = locale === "es" ? s.colorwayName.es : s.colorwayName.en;
          return (
            <li key={s.productId} className="w-[68%] shrink-0 snap-start sm:w-[40%] lg:w-[23%]">
              <Link
                href={`/products/${s.productId}?colorway=${s.colorway}`}
                className="group block focus-visible:outline-none"
              >
                <div className="relative aspect-[3/4] overflow-hidden rounded-[14px] bg-zinc-900 group-focus-visible:ring-2 group-focus-visible:ring-moya-red">
                  <m.div style={{ y: drift }} className="absolute inset-[-6%_0]">
                    <Image
                      src={s.src}
                      alt={`${name} — ${colorway}`}
                      fill
                      sizes="(min-width: 1024px) 23vw, (min-width: 640px) 40vw, 68vw"
                      className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03]"
                    />
                  </m.div>
                </div>
                <p className="mt-3 line-clamp-1 font-display text-[15px] font-semibold text-zinc-900 group-hover:text-moya-red dark:text-zinc-100">
                  {name}
                </p>
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400">{colorway}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
