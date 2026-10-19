"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, m } from "framer-motion";
import { ArrowRight, Clock, Search, X } from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { useStore } from "@/store/useStore";
import { useCapVariants } from "@/hooks/useCapVariants";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";
import { useReducedMotionSafe } from "@/hooks/useMotionPrefs";
import { DURATION, EASE } from "@/lib/motion";
import { isTee } from "@/lib/shop";
import {
  buildSearchIndex,
  featuredProducts,
  searchProducts,
  suggestNames,
  type SearchHit,
} from "@/lib/search/searchProducts";
import { shopHrefForQuery } from "@/lib/search/shopLink";
import { trackSearch } from "@/lib/search/analytics";
import { useRecentSearches } from "./useRecentSearches";

const hrefFor = (hit: SearchHit) => `/products/${hit.product.id}${hit.colorway ? `?colorway=${hit.colorway}` : ""}`;

/**
 * Product search (plan 0006): a full-screen sheet on phones and a centered panel from `md`
 * up, holding an ARIA 1.2 combobox over the already-loaded catalog. Loaded by
 * DeferredOverlays the first time search opens, so it costs nothing on first load.
 */
export function SearchOverlay() {
  const t = useTranslations("search");
  const locale = useLocale();
  const router = useRouter();
  const isOpen = useStore((s) => s.isSearchOpen);
  const closeSearch = useStore((s) => s.closeSearch);
  const { caps } = useCapVariants();
  const { recent, remember, clear } = useRecentSearches();
  const reduceMotion = useReducedMotionSafe();

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const optionId = (i: number) => `${listboxId}-opt-${i}`;

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Each opening starts fresh (adjusting state during render, not in an effect)
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setQuery("");
      setActive(0);
      setNow(Date.now());
    }
  }

  useLockBodyScroll(isOpen);
  useFocusTrap(panelRef, isOpen, inputRef);

  useEffect(() => {
    if (isOpen) trackSearch({ type: "open" });
  }, [isOpen]);

  const index = useMemo(() => buildSearchIndex(caps), [caps]);
  const trimmed = query.trim();
  const results = useMemo(() => searchProducts(index, trimmed, now), [index, trimmed, now]);
  const suggestions = useMemo(
    () => (trimmed && results.length === 0 ? suggestNames(index, trimmed) : []),
    [index, trimmed, results.length]
  );
  const featured = useMemo(() => featuredProducts(caps, now), [caps, now]);

  // Options the arrow keys move through: results, else "did you mean", else featured
  const options: SearchHit[] = !trimmed ? featured : results.length ? results : suggestions;
  const activeIndex = Math.min(active, options.length - 1);
  const shopHref = trimmed ? shopHrefForQuery(trimmed) : "/products";

  // Report a query that found nothing once the Customer stops typing
  useEffect(() => {
    if (!isOpen || !trimmed || results.length) return;
    const id = setTimeout(() => trackSearch({ type: "no_results", query: trimmed }), 1000);
    return () => clearTimeout(id);
  }, [isOpen, trimmed, results.length]);

  const choose = (hit: SearchHit, position: number) => {
    if (trimmed) remember(trimmed);
    trackSearch({ type: "select", query: trimmed, productId: hit.product.id, position, resultCount: results.length });
    closeSearch();
  };

  const toShop = () => {
    if (trimmed) {
      remember(trimmed);
      trackSearch({ type: "shop_link", query: trimmed, href: shopHref });
    }
    closeSearch();
  };

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!options.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((activeIndex + step + options.length) % options.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = options[activeIndex];
      if (hit) {
        choose(hit, activeIndex);
        router.push(hrefFor(hit));
      } else if (trimmed) {
        toShop();
        router.push(shopHref);
      }
    }
  };

  const onPanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      closeSearch();
    }
  };

  const listLabel = !trimmed ? t("featured") : results.length ? t("results", { count: results.length }) : t("didYouMean");
  const fade = reduceMotion ? { duration: 0 } : { duration: DURATION.fast, ease: EASE.out };

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          key="search"
          className="fixed inset-0 z-[60] flex items-stretch justify-center md:items-start md:px-4 md:pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fade}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeSearch} aria-hidden="true" />

          <m.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("title")}
            onKeyDown={onPanelKeyDown}
            initial={reduceMotion ? false : { y: 12, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { y: 8, scale: 0.98 }}
            transition={fade}
            className="relative flex h-dvh w-full flex-col bg-white dark:bg-zinc-950 md:h-auto md:max-h-[70vh] md:max-w-xl md:overflow-hidden md:rounded-2xl md:border md:border-black/[0.08] md:shadow-2xl dark:md:border-white/[0.08]"
          >
            {/* Search field */}
            <div className="flex items-center gap-2 border-b border-black/[0.06] px-4 dark:border-white/[0.08]">
              <Search className="h-5 w-5 shrink-0 text-zinc-400" aria-hidden="true" />
              <input
                ref={inputRef}
                type="search"
                role="combobox"
                aria-label={t("label")}
                aria-expanded={options.length > 0}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={options.length ? optionId(activeIndex) : undefined}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
                placeholder={t("placeholder")}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onInputKeyDown}
                className="h-14 min-w-0 flex-1 bg-transparent text-base text-zinc-950 placeholder:text-zinc-400 focus:outline-none dark:text-white [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
                >
                  {t("clear")}
                </button>
              )}
              <button
                type="button"
                onClick={closeSearch}
                aria-label={t("close")}
                className="-mr-2 flex h-10 w-10 items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-3">
              {/* Recent searches */}
              {!trimmed && recent.length > 0 && (
                <section className="mb-3 px-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <h2 className="font-display text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{t("recent")}</h2>
                    <button type="button" onClick={clear} className="text-xs text-zinc-500 hover:text-zinc-950 dark:hover:text-white">
                      {t("clearRecent")}
                    </button>
                  </div>
                  <ul className="flex flex-wrap gap-1.5">
                    {recent.map((q) => (
                      <li key={q}>
                        <button
                          type="button"
                          onClick={() => {
                            setQuery(q);
                            setActive(0);
                            inputRef.current?.focus();
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] px-3 py-1.5 text-sm text-zinc-700 hover:border-black/20 dark:border-white/[0.1] dark:text-zinc-300 dark:hover:border-white/25"
                        >
                          <Clock className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                          {q}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {trimmed && results.length === 0 && (
                <p className="px-2 pb-2 pt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("noResults", { query: trimmed })}</p>
              )}

              {options.length > 0 && (
                <>
                  <h2 id={`${listboxId}-label`} className="px-2 pb-1.5 font-display text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    {listLabel}
                  </h2>
                  <ul id={listboxId} role="listbox" aria-labelledby={`${listboxId}-label`}>
                    {options.map((hit, i) => {
                      const p = hit.product;
                      const name = locale === "es" ? p.nameEs : p.nameEn;
                      const selected = i === activeIndex;
                      return (
                        <li key={`${p.id}-${hit.colorway ?? ""}`} id={optionId(i)} role="option" aria-selected={selected}>
                          <Link
                            href={hrefFor(hit)}
                            tabIndex={-1}
                            onClick={() => choose(hit, i)}
                            onMouseMove={() => active !== i && setActive(i)}
                            className={`flex items-center gap-3 rounded-xl p-2 transition-colors ${
                              selected ? "bg-zinc-100 dark:bg-white/[0.07]" : ""
                            }`}
                          >
                            <span className="relative aspect-[4/5] w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
                              <Image src={hit.image} alt="" fill sizes="48px" className="object-cover" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-zinc-950 dark:text-white">{name}</span>
                              <span className="block text-xs text-zinc-500">{isTee(p) ? t("tee") : t("cap")}</span>
                            </span>
                            <span className="shrink-0 font-display text-sm font-semibold text-zinc-950 dark:text-white">${p.priceUsd}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              <p className="sr-only" role="status" aria-live="polite">
                {trimmed ? t("results", { count: results.length }) : ""}
              </p>
            </div>

            {/* Footer: Shop link and keyboard hints */}
            <div className="flex items-center justify-between gap-3 border-t border-black/[0.06] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-white/[0.08]">
              <Link
                href={shopHref}
                onClick={toShop}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-moya-red hover:underline"
              >
                {trimmed ? t("seeAll") : t("browseShop")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <p className="hidden items-center gap-3 text-[11px] text-zinc-400 md:flex" aria-hidden="true">
                <span><Kbd>↑</Kbd><Kbd>↓</Kbd> {t("navigate")}</span>
                <span><Kbd>↵</Kbd> {t("open")}</span>
                <span><Kbd>esc</Kbd> {t("dismiss")}</span>
              </p>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mr-0.5 inline-flex min-w-5 items-center justify-center rounded border border-black/10 px-1 font-sans text-[10px] dark:border-white/15">
      {children}
    </kbd>
  );
}
