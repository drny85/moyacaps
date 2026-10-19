"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { Flame, PackageOpen, Plus, RotateCw, Search, SearchX, Shirt, X } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Category } from "@convex/catalog/rules";
import { Link, useRouter } from "@/i18n/routing";
import { nextGridIndex } from "@/lib/admin/keyboardNav";
import type { GridKey } from "@/lib/admin/keyboardNav";
import { toProductCard } from "@/lib/admin/productCard";
import { applyFilters, chipCount, hasActiveFilters } from "@/lib/admin/productFilters";
import { EmptyState } from "./EmptyState";
import { FeedbackBanner } from "./FeedbackBanner";
import { FilterChips } from "./FilterChips";
import { ProductActionDialogs } from "./ProductActionDialogs";
import { ProductCard } from "./ProductCard";
import type { ProductCardHandlers } from "./ProductCard";
import { ProductGridSkeleton } from "./ProductGridSkeleton";
import { QueryErrorBoundary } from "./QueryErrorBoundary";
import { useAdminShortcuts } from "./useAdminShortcuts";
import { useProductActions } from "./useProductActions";
import { useProductFilters } from "./useProductFilters";

const GRID_KEYS = new Set<string>(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);

export const newProductHref = (category: Category) => `/admin/products/new?category=${category}`;

/** Drop chips depend on the clock; a minute's precision is enough. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function NewProductButtons() {
  const t = useTranslations("admin.products.grid");
  const [open, setOpen] = useState(false);
  const btn =
    "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-moya-red hover:bg-moya-red-light text-white text-xs font-semibold shadow-md shadow-moya-red/20 transition-all active:scale-95";
  return (
    <>
      <div className="hidden sm:flex items-center gap-2">
        <Link href={newProductHref("headwear")} className={btn}>
          <Plus className="w-4 h-4" /> {t("newCap")}
        </Link>
        <Link href={newProductHref("apparel")} className={btn}>
          <Plus className="w-4 h-4" /> {t("newTee")}
        </Link>
      </div>
      {/* Phone: one floating button with a Cap/Tee choice. */}
      <div className="sm:hidden fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 flex flex-col items-end gap-2">
        {open && (
          <div className="flex flex-col gap-2 items-end">
            <Link href={newProductHref("headwear")} className={btn}>
              {t("newCap")}
            </Link>
            <Link href={newProductHref("apparel")} className={btn}>
              <Shirt className="w-4 h-4" /> {t("newTee")}
            </Link>
          </div>
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-label={t("newProduct")}
          onClick={() => setOpen((o) => !o)}
          className="w-14 h-14 rounded-full bg-moya-red text-white shadow-xl shadow-moya-red/30 flex items-center justify-center active:scale-95"
        >
          {open ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
      </div>
    </>
  );
}

function GridBody() {
  const t = useTranslations("admin.products.grid");
  const locale = useLocale();
  const router = useRouter();
  const now = useNow();
  const { filters, setFilters, clear } = useProductFilters();
  const data = useQuery(api.catalog.admin.getAllProductsAdmin, { includeArchived: filters.status === "archived" });
  const actions = useProductActions(locale);
  const search = useRef<HTMLInputElement>(null);
  const grid = useRef<HTMLDivElement>(null);

  const rows = data?.variants;
  const visible = useMemo(() => (rows ? applyFilters(rows, filters, now) : []), [rows, filters, now]);
  const cards = useMemo(() => visible.map((row) => ({ row, vm: toProductCard(row, locale, now) })), [visible, locale, now]);

  useAdminShortcuts({
    "/": () => search.current?.focus(),
    n: () => router.push(newProductHref("headwear")),
    escape: (e) => {
      if (e.target === search.current) search.current?.blur();
    },
  });

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    if (!GRID_KEYS.has(e.key) || !grid.current) return;
    const current = (e.target as HTMLElement).closest<HTMLElement>("[data-card-index]");
    if (!current) return;
    const targets = grid.current.querySelectorAll<HTMLElement>("[data-card-index]");
    const columns = getComputedStyle(grid.current).gridTemplateColumns.split(" ").length;
    const next = nextGridIndex(Number(current.dataset.cardIndex), e.key as GridKey, columns, targets.length);
    e.preventDefault();
    targets[next]?.focus();
  };

  const handlers: ProductCardHandlers = {
    onStock: actions.requestStock,
    onSkus: actions.openSkus,
    onAvailability: actions.requestAvailability,
    onFeatured: actions.toggleFeatured,
    onDrop: (row) => actions.openDropSchedule(row),
    onArchive: actions.requestArchive,
    onRestore: actions.restore,
  };

  const catalogEmpty = rows !== undefined && rows.length === 0 && !hasActiveFilters(filters);

  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-moya-red font-bold">{t("eyebrow")}</span>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-zinc-950 dark:text-white tracking-tight">
            {t("title")} {rows && <span className="text-zinc-400 font-normal">({rows.filter((r) => r.archivedAt === undefined).length})</span>}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/drops"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/[0.1] text-zinc-900 dark:text-white text-xs font-semibold border border-zinc-200 dark:border-white/[0.08]"
          >
            <Flame className="w-4 h-4 text-moya-red" />
            <span className="hidden sm:inline">{t("dropsDesk")}</span>
          </Link>
          <NewProductButtons />
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={search}
            type="search"
            value={filters.q}
            onChange={(e) => setFilters({ q: e.target.value })}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl bg-white dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-moya-red"
          />
          <kbd className="hidden sm:block absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-white/10 text-[10px] font-mono text-zinc-500">/</kbd>
        </div>
        <FilterChips filters={filters} onChange={setFilters} onClear={clear} count={(patch) => (rows ? chipCount(rows, filters, patch, now) : 0)} />
      </div>

      <FeedbackBanner banner={actions.error} onDismiss={actions.clearError} />

      {rows === undefined ? (
        <ProductGridSkeleton />
      ) : catalogEmpty ? (
        <EmptyState icon={<PackageOpen className="w-10 h-10" />} title={t("emptyTitle")} body={t("emptyBody")}>
          <Link href={newProductHref("headwear")} className="px-3.5 py-2 rounded-xl bg-moya-red text-white text-xs font-semibold">
            {t("newCap")}
          </Link>
          <Link href={newProductHref("apparel")} className="px-3.5 py-2 rounded-xl bg-moya-red text-white text-xs font-semibold">
            {t("newTee")}
          </Link>
        </EmptyState>
      ) : cards.length === 0 ? (
        <EmptyState icon={<SearchX className="w-10 h-10" />} title={t("noMatches")}>
          <button type="button" onClick={clear} className="px-3.5 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold">
            {t("clearFilters")}
          </button>
        </EmptyState>
      ) : (
        <div ref={grid} onKeyDown={onGridKeyDown} className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {cards.map(({ row, vm }, i) => (
            <ProductCard
              key={vm.id}
              row={row}
              vm={vm}
              index={i}
              isUpdating={actions.updatingStockId === vm.id}
              isFlashing={actions.flashStockId === vm.id}
              handlers={handlers}
            />
          ))}
        </div>
      )}

      <ProductActionDialogs actions={actions} />
    </>
  );
}

/** The admin product list (screen 1): search, filter chips, card grid and quick actions. */
export function ProductGrid() {
  const t = useTranslations("admin.products.grid");
  return (
    <div className="space-y-5 pb-24 sm:pb-12">
      <QueryErrorBoundary
        fallback={(retry) => (
          <EmptyState title={t("errorTitle")} body={t("errorBody")}>
            <button type="button" onClick={retry} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold">
              <RotateCw className="w-3.5 h-3.5" /> {t("retry")}
            </button>
          </EmptyState>
        )}
      >
        <GridBody />
      </QueryErrorBoundary>
    </div>
  );
}
