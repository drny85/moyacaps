"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, m } from "framer-motion";
import { useReducedMotionSafe } from "@/hooks/useMotionPrefs";
import { SlidersHorizontal, X } from "lucide-react";
import { useUrlQuery } from "@/components/routing/useUrlQuery";
import { useCapVariants } from "@/hooks/useCapVariants";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { DURATION, EASE } from "@/lib/motion";
import { ProductCard } from "@/components/catalog/ProductCard";
import { LayoutMotion } from "@/components/motion/LayoutMotion";
import {
  activeFilterCount,
  applyShop,
  COLOR_FAMILIES,
  COLOR_FAMILY_SWATCH,
  DEFAULT_STATE,
  familyCounts,
  parseShopState,
  serializeShopState,
  type Category,
  type ColorFamily,
  type ShopState,
  type Silhouette,
  type SortKey,
} from "@/lib/shop";

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/**
 * `initialQuery` is what the static page was rendered for (the category route passes
 * `category=caps|tees`, ADR 0019); the live query string takes over after hydration.
 */
export function ShopView({ initialQuery = "" }: { initialQuery?: string }) {
  const t = useTranslations("shop");
  const [query, setQuery, querySync] = useUrlQuery(initialQuery);
  const reduceMotion = useReducedMotionSafe();
  const { caps: products } = useCapVariants();
  const [now] = useState(() => Date.now());

  const state = useMemo(() => parseShopState(new URLSearchParams(query)), [query]);
  // Filters change the URL in place (no server round trip); the tab's page title follows
  const setState = useCallback((next: ShopState) => setQuery(serializeShopState(next)), [setQuery]);
  const metaTitle =
    state.category === "caps" ? t("metaTitleCaps") : state.category === "tees" ? t("metaTitleTees") : t("metaTitleAll");
  useEffect(() => {
    document.title = metaTitle;
  }, [metaTitle]);

  const items = useMemo(() => applyShop(products, state, now), [products, state, now]);
  const counts = useMemo(() => familyCounts(products, state, now), [products, state, now]);
  const filterCount = activeFilterCount(state);
  const [sheetOpen, setSheetOpen] = useState(false);

  const title = state.category === "caps" ? t("titleCaps") : state.category === "tees" ? t("titleTees") : t("titleAll");
  const tabs: { key: Category; label: string }[] = [
    { key: "all", label: t("tabAll") },
    { key: "caps", label: t("tabCaps") },
    { key: "tees", label: t("tabTees") },
  ];

  return (
    <LayoutMotion>
      {querySync}
      <div className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <header className="flex items-end justify-between gap-4 pb-5 pt-8 sm:pt-12">
          <h1 className="font-poster text-[clamp(3.5rem,14vw,8rem)] uppercase leading-[0.85] tracking-tight text-zinc-900 dark:text-white">
            {title}
          </h1>
          <p className="pb-2 text-sm text-zinc-500 dark:text-zinc-400 tabular-nums" aria-live="polite">
            {t("count", { count: items.length })}
          </p>
        </header>

        {/* Category tabs, filter trigger and sort: sticky under the navbar */}
        <div className="sticky top-[var(--navbar-h,66px)] z-30 -mx-4 border-y border-black/[0.06] bg-white/90 px-4 backdrop-blur-md dark:border-white/[0.08] dark:bg-zinc-950/90 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex h-14 items-center gap-3">
            <nav aria-label={t("titleAll")} className="flex gap-1">
              {tabs.map((tab) => {
                const active = state.category === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setState({ ...state, category: tab.key })}
                    className={`relative h-9 rounded-full px-4 font-display text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red ${
                      active ? "text-white dark:text-zinc-950" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                    }`}
                  >
                    {active && (
                      <m.span
                        layoutId="shop-tab"
                        className="absolute inset-0 rounded-full bg-zinc-900 dark:bg-white"
                        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                      />
                    )}
                    <span className="relative">{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-300 px-3.5 font-display text-sm font-semibold text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red dark:border-white/15 dark:text-zinc-200 lg:hidden"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="whitespace-nowrap sm:hidden">{t("filterSort")}</span>
                <span className="hidden whitespace-nowrap sm:inline">{t("filters")}</span>
                {filterCount > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-moya-red px-1 text-[11px] font-bold tabular-nums text-white">
                    <span className="sr-only">{t("filtersWithCount", { count: filterCount })}</span>
                    <span aria-hidden>{filterCount}</span>
                  </span>
                )}
              </button>
              <label className="relative hidden sm:block">
                <span className="sr-only">{t("sortLabel")}</span>
                <select
                  value={state.sort}
                  onChange={(e) => setState({ ...state, sort: e.target.value as SortKey })}
                  className="h-9 appearance-none rounded-full border border-zinc-300 bg-transparent pl-3.5 pr-8 font-display text-sm font-semibold text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red dark:border-white/15 dark:text-zinc-200 sm:max-w-none"
                >
                  <option value="featured">{t("sortFeatured")}</option>
                  <option value="newest">{t("sortNewest")}</option>
                  <option value="price-asc">{t("sortPriceAsc")}</option>
                  <option value="price-desc">{t("sortPriceDesc")}</option>
                </select>
                <svg aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-500" viewBox="0 0 12 12">
                  <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr] lg:gap-10">
          <aside className="hidden lg:block" aria-label={t("filters")}>
            <div className="sticky top-[calc(var(--navbar-h,66px)+5rem)]">
              <FilterPanel state={state} setState={setState} counts={counts} />
            </div>
          </aside>

          <section aria-label={title}>
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-white/15">
                <p className="font-display text-lg font-semibold text-zinc-900 dark:text-white">{t("emptyTitle")}</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("emptyBody")}</p>
                <button
                  type="button"
                  onClick={() => setState({ ...DEFAULT_STATE, category: state.category, sort: state.sort })}
                  className="mt-5 h-10 rounded-full bg-zinc-900 px-5 font-display text-sm font-semibold text-white dark:bg-white dark:text-zinc-950"
                >
                  {t("clearAll")}
                </button>
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
                <AnimatePresence initial={false} mode="popLayout">
                  {items.map((item, i) => (
                    <m.li
                      key={item.product.id}
                      layout={!reduceMotion}
                      initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.97 }}
                      transition={{ duration: DURATION.fast, ease: EASE.out }}
                    >
                      <ProductCard key={`${item.product.id}-${item.colorway ?? ""}`} item={item} now={now} priority={i < 2} defer={i >= 4} />
                    </m.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </section>
        </div>

        <FilterSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          state={state}
          setState={setState}
          counts={counts}
          resultCount={items.length}
        />
      </div>
    </LayoutMotion>
  );
}

function FilterPanel({
  state,
  setState,
  counts,
}: {
  state: ShopState;
  setState: (s: ShopState) => void;
  counts: Partial<Record<ColorFamily, number>>;
}) {
  const t = useTranslations("shop");
  const families = COLOR_FAMILIES.filter((f) => counts[f] || state.colors.includes(f));
  const showFit = state.category !== "tees";

  return (
    <div className="flex flex-col gap-7">
      <fieldset>
        <legend className="mb-3 font-display text-sm font-bold text-zinc-900 dark:text-white">{t("facetColor")}</legend>
        <div className="flex flex-wrap gap-2">
          {families.map((f) => {
            const on = state.colors.includes(f);
            return (
              <button
                key={f}
                type="button"
                aria-pressed={on}
                onClick={() => setState({ ...state, colors: toggle(state.colors, f) })}
                className={`inline-flex h-9 items-center gap-2 rounded-full border pl-1.5 pr-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red ${
                  on
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-950"
                    : "border-zinc-300 text-zinc-700 hover:border-zinc-500 dark:border-white/15 dark:text-zinc-300"
                }`}
              >
                <span
                  className="h-6 w-6 rounded-full border border-black/10 dark:border-white/20"
                  style={{ backgroundColor: COLOR_FAMILY_SWATCH[f] }}
                />
                {t(`colors.${f}`)}
                <span className={`tabular-nums ${on ? "opacity-70" : "text-zinc-400"}`}>{counts[f] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {showFit && (
        <ChoiceGroup
          legend={t("facetFit")}
          options={[
            { value: "snapback" as Silhouette, label: t("snapback") },
            { value: "trucker" as Silhouette, label: t("trucker") },
          ]}
          selected={state.silhouettes}
          onToggle={(v) => setState({ ...state, silhouettes: toggle(state.silhouettes, v) })}
        />
      )}


      <fieldset>
        <legend className="mb-3 font-display text-sm font-bold text-zinc-900 dark:text-white">{t("facetAvailability")}</legend>
        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-zinc-700 dark:text-zinc-300">
          {t("inStockOnly")}
          <input
            type="checkbox"
            checked={state.inStock}
            onChange={(e) => setState({ ...state, inStock: e.target.checked })}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="relative h-6 w-10 shrink-0 rounded-full bg-zinc-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-moya-green peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-moya-red dark:bg-white/20"
          />
        </label>
      </fieldset>

      {activeFilterCount(state) > 0 && (
        <button
          type="button"
          onClick={() => setState({ ...DEFAULT_STATE, category: state.category, sort: state.sort })}
          className="self-start text-sm font-semibold text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
        >
          {t("clearAll")}
        </button>
      )}
    </div>
  );
}

function ChoiceGroup<T extends string>({
  legend,
  options,
  selected,
  onToggle,
}: {
  legend: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-3 font-display text-sm font-bold text-zinc-900 dark:text-white">{legend}</legend>
      <div className="flex flex-col gap-2.5">
        {options.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={selected.includes(o.value)}
              onChange={() => onToggle(o.value)}
              className="h-[18px] w-[18px] rounded border-zinc-400 accent-moya-red"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Mobile filters: a bottom sheet that keeps the grid's result count on its main button. */
function FilterSheet({
  open,
  onClose,
  state,
  setState,
  counts,
  resultCount,
}: {
  open: boolean;
  onClose: () => void;
  state: ShopState;
  setState: (s: ShopState) => void;
  counts: Partial<Record<ColorFamily, number>>;
  resultCount: number;
}) {
  const t = useTranslations("shop");
  const reduceMotion = useReducedMotionSafe();
  useLockBodyScroll(open);
  // Focus moves into the sheet, Tab stays inside it, and closing returns focus to the trigger
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(panelRef, open, closeRef);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t("filters")}>
          <m.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.fast }}
            onClick={onClose}
          />
          <m.div
            ref={panelRef}
            data-lenis-prevent
            className="absolute inset-x-0 bottom-0 flex max-h-[85svh] flex-col rounded-t-[20px] bg-white pb-[env(safe-area-inset-bottom)] dark:bg-zinc-950"
            initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: DURATION.base, ease: EASE.out }}
          >
            <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
              <h2 className="font-display text-base font-bold text-zinc-900 dark:text-white">
                <span className="sm:hidden">{t("filterSort")}</span>
                <span className="hidden sm:inline">{t("filters")}</span>
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label={t("closeFilters")}
                className="-mr-2 rounded-full p-2 text-zinc-500 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">
              <fieldset className="mb-7 sm:hidden">
                <legend className="mb-3 font-display text-sm font-bold text-zinc-900 dark:text-white">{t("sortLabel")}</legend>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["featured", t("sortFeatured")],
                      ["newest", t("sortNewest")],
                      ["price-asc", t("sortPriceAsc")],
                      ["price-desc", t("sortPriceDesc")],
                    ] as [SortKey, string][]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={state.sort === value}
                      onClick={() => setState({ ...state, sort: value })}
                      className={`h-9 rounded-full border px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red ${
                        state.sort === value
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-950"
                          : "border-zinc-300 text-zinc-700 dark:border-white/15 dark:text-zinc-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <FilterPanel state={state} setState={setState} counts={counts} />
            </div>
            <div className="border-t border-black/[0.06] p-4 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={onClose}
                className="h-12 w-full rounded-full bg-moya-red font-display text-base font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red focus-visible:ring-offset-2"
              >
                {t("showResults", { count: resultCount })}
              </button>
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
