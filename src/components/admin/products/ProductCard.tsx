"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, ArchiveRestore, Check, Eye, EyeOff, Flame, ImageOff, Minus, Plus, Radio, Star } from "lucide-react";
import { Link } from "@/i18n/routing";
import type { ProductCardVM, Pill } from "@/lib/admin/productCard";
import type { ResolvedVariant } from "@/lib/admin/productForm";
import { ProductCardMenu } from "./ProductCardMenu";

export type ProductCardHandlers = {
  onStock: (row: ResolvedVariant, delta: number) => void;
  onSkus: (variantId: string) => void;
  onAvailability: (row: ResolvedVariant) => void;
  onFeatured: (variantId: string) => void;
  onDrop: (row: ResolvedVariant) => void;
  onArchive: (variantId: string) => void;
  onRestore: (variantId: string) => void;
};

const STOCK_TONE = {
  out: "text-red-600 dark:text-red-400",
  low: "text-amber-600 dark:text-amber-400",
  in: "text-zinc-900 dark:text-white",
} as const;

const PILL_TONE: Record<Pill, string> = {
  hidden: "bg-zinc-900/80 text-white",
  featured: "bg-amber-400 text-zinc-950",
  drop: "bg-moya-red text-white",
  attention: "bg-amber-500/90 text-zinc-950",
};

const iconBtn =
  "p-1.5 rounded-lg transition-colors disabled:opacity-40 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06]";

/** One Product in the admin grid (D16): 4:5 Catalog Shot, pills, name, slug, price, stock and quick actions. */
export function ProductCard({
  row,
  vm,
  index,
  isUpdating,
  isFlashing,
  handlers,
}: {
  row: ResolvedVariant;
  vm: ProductCardVM;
  index: number;
  isUpdating: boolean;
  isFlashing: boolean;
  handlers: ProductCardHandlers;
}) {
  const t = useTranslations("admin.products.card");
  const tAttention = useTranslations("admin.products.attention");

  const pillLabel = (pill: Pill) => {
    if (pill !== "drop" || !vm.drop) return t(`pills.${pill}`);
    return vm.drop.live ? t("pills.liveDrop") : t("pills.drop", { date: vm.drop.date });
  };

  const image = (
    <div className="relative aspect-[4/5] bg-zinc-100 dark:bg-white/[0.04] overflow-hidden">
      {vm.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Convex storage or static URL, admin only
        <img
          src={vm.imageUrl}
          alt={vm.name}
          loading="lazy"
          className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${vm.pills.includes("hidden") || vm.archived ? "grayscale opacity-60" : ""}`}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-zinc-400">
          <ImageOff className="w-8 h-8" />
          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] font-semibold">{t("needsCatalogShot")}</span>
        </div>
      )}
      <div className="absolute top-2 left-2 right-2 flex flex-wrap gap-1">
        {vm.archived && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-700 text-white">{t("pills.archived")}</span>}
        {vm.pills.map((pill) => (
          <span
            key={pill}
            title={pill === "attention" ? vm.attention.map((r) => tAttention(r)).join(" · ") : undefined}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${PILL_TONE[pill]}`}
          >
            {pill === "hidden" && <EyeOff className="w-2.5 h-2.5" />}
            {pill === "featured" && <Star className="w-2.5 h-2.5 fill-current" />}
            {pill === "drop" && (vm.drop?.live ? <Radio className="w-2.5 h-2.5" /> : <Flame className="w-2.5 h-2.5" />)}
            {pill === "attention" && <AlertTriangle className="w-2.5 h-2.5" />}
            {pillLabel(pill)}
          </span>
        ))}
      </div>
      {vm.drop && !vm.drop.live && (
        <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/70 text-white">
          {t("subscribers", { count: vm.drop.subscribers })}
        </span>
      )}
    </div>
  );

  return (
    <article
      className={`group relative flex flex-col rounded-2xl overflow-hidden border bg-white dark:bg-[#0c0c14] shadow-xs transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-moya-red ${
        vm.archived ? "border-dashed border-zinc-300 dark:border-white/10 opacity-70" : "border-zinc-200 dark:border-white/[0.06]"
      }`}
    >
      {vm.archived ? (
        <div data-card-index={index} tabIndex={0} className="outline-none">
          {image}
        </div>
      ) : (
        <Link href={`/admin/products/${vm.id}`} data-card-index={index} className="outline-none" aria-label={t("open", { name: vm.name })}>
          {image}
        </Link>
      )}

      <div className="p-3 flex-1 flex flex-col gap-1">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white leading-tight line-clamp-2">{vm.name}</p>
        <p className="text-[10px] font-mono text-zinc-500 truncate">{vm.slug}</p>
        <div className="flex items-center justify-between text-xs font-mono mt-auto pt-1">
          <span className="font-bold text-zinc-900 dark:text-white">{vm.priceLabel}</span>
          <span className={`font-bold ${STOCK_TONE[vm.stockLevel]}`}>{t("stock", { count: vm.stock })}</span>
        </div>
      </div>

      <div className="px-2 pb-2 flex items-center justify-between gap-1 border-t border-zinc-100 dark:border-white/[0.06] pt-2">
        {vm.archived ? (
          <button
            type="button"
            onClick={() => handlers.onRestore(vm.id)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06]"
          >
            <ArchiveRestore className="w-3.5 h-3.5" /> {t("restore")}
          </button>
        ) : (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => handlers.onAvailability(row)}
              aria-label={row.isAvailable ? t("hide", { name: vm.name }) : t("show", { name: vm.name })}
              title={row.isAvailable ? t("visible") : t("hidden")}
              className={`${iconBtn} ${row.isAvailable ? "text-emerald-600 dark:text-emerald-400" : ""}`}
            >
              {row.isAvailable ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            {vm.isTee ? (
              <button type="button" onClick={() => handlers.onSkus(vm.id)} className="px-2 py-1 rounded-lg text-[11px] font-mono font-bold bg-zinc-100 dark:bg-white/[0.06] text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-white/10">
                {t("skus")}
              </button>
            ) : (
              <>
                <button type="button" onClick={() => handlers.onStock(row, -1)} disabled={isUpdating || vm.stock <= 0} aria-label={t("stockMinus", { name: vm.name })} className={iconBtn}>
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => handlers.onStock(row, 1)} disabled={isUpdating} aria-label={t("stockPlus", { name: vm.name })} className={iconBtn}>
                  {isFlashing ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Plus className="w-3.5 h-3.5" />}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => handlers.onFeatured(vm.id)}
              aria-pressed={row.isFeatured}
              aria-label={t("featured", { name: vm.name })}
              className={`${iconBtn} ${row.isFeatured ? "text-amber-500" : ""}`}
            >
              <Star className={`w-4 h-4 ${row.isFeatured ? "fill-amber-500" : ""}`} />
            </button>
          </div>
        )}
        <ProductCardMenu
          variantId={vm.id}
          name={vm.name}
          archived={vm.archived}
          onDrop={() => handlers.onDrop(row)}
          onArchive={() => handlers.onArchive(vm.id)}
          onRestore={() => handlers.onRestore(vm.id)}
        />
      </div>
    </article>
  );
}
