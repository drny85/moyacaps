"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Archive, ArchiveRestore, Check, Edit2, Eye, EyeOff, Flame, Star, Users } from "lucide-react";
import type { ResolvedVariant } from "@/lib/admin/productForm";

const stepBtn =
  "h-6 rounded-md bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 font-mono text-xs flex items-center justify-center disabled:opacity-30 transition-colors";
const iconBtn = "p-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors";
const dash = <span className="text-zinc-400">—</span>;

export type ProductRowHandlers = {
  onStock: (row: ResolvedVariant, delta: number) => void;
  onSkus: (variantId: string) => void;
  onAvailability: (row: ResolvedVariant) => void;
  onFeatured: (variantId: string) => void;
  onEdit: (row: ResolvedVariant) => void;
  onArchive: (variantId: string) => void;
  onRestore: (variantId: string) => void;
};

/** One product in the admin list with its quick actions. */
export function ProductRow({
  row,
  locale,
  isUpdating,
  isFlashing,
  handlers,
}: {
  row: ResolvedVariant;
  locale: string;
  isUpdating: boolean;
  isFlashing: boolean;
  handlers: ProductRowHandlers;
}) {
  const t = useTranslations("admin.products");
  const isArchived = row.archivedAt !== undefined;
  const hidden = !row.isAvailable;
  const hasSkus = Boolean(row.colorways?.length);

  return (
    <tr className={`hover:bg-zinc-50/80 dark:hover:bg-white/[0.02] transition-colors ${hidden ? "bg-zinc-50/40 dark:bg-white/[0.01] opacity-75" : ""}`}>
      <td className="py-3 px-4">
        <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-white/10 relative overflow-hidden shrink-0 group">
          <Image
            src={row.image || "/caps/negro-rojo.png"}
            alt={row.nameEn}
            fill
            sizes="48px"
            className={`object-contain p-1 group-hover:scale-110 transition-transform ${hidden ? "grayscale opacity-50" : ""}`}
          />
          {hidden && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none" title={t("notAvailable")}>
              <EyeOff className="w-4 h-4 text-amber-400" />
            </div>
          )}
        </div>
      </td>

      <td className="py-3 px-4">
        <span className="font-semibold text-zinc-900 dark:text-white block">
          {row.nameEn}
          {isArchived && (
            <span className="ml-2 px-1.5 py-0.5 rounded-md bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20 text-[10px] font-mono font-bold uppercase align-middle">
              {t("archivedBadge")}
            </span>
          )}
        </span>
        <span className="text-[11px] text-zinc-600 dark:text-zinc-400 block">{row.nameEs}</span>
        <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 block mt-0.5">{t("row.slug", { id: row.variantId })}</span>
      </td>

      <td className="py-3 px-4">
        <div className="flex items-center gap-1.5">
          <div style={{ backgroundColor: row.primaryHex }} className="w-5 h-5 rounded-full border border-black/20 shadow-xs" title={t("row.crown", { hex: row.primaryHex })} />
          <div style={{ backgroundColor: row.secondaryHex }} className="w-5 h-5 rounded-full border border-black/20 shadow-xs" title={t("row.visor", { hex: row.secondaryHex })} />
        </div>
      </td>

      <td className="py-3 px-4">
        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
          {row.silhouette}
        </span>
      </td>

      <td className="py-3 px-4 font-mono font-bold text-zinc-900 dark:text-white">
        ${row.priceUsd} <span className="text-[10px] text-zinc-600 dark:text-zinc-400">USD</span>
      </td>

      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded-md font-mono text-xs font-bold border ${
              row.stock === 0
                ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                : row.stock <= 5
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
            }`}
          >
            {t("row.stockLeft", { count: row.stock })}
          </span>
          {isArchived ? null : hasSkus ? (
            <button
              type="button"
              onClick={() => handlers.onSkus(row.variantId)}
              className="px-2 h-6 rounded-md bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-mono text-xs font-bold hover:opacity-90 transition-opacity"
              title={t("row.skusTitle")}
            >
              {t("row.skus")}
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={() => handlers.onStock(row, -1)} disabled={isUpdating || row.stock <= 0} className={`w-6 ${stepBtn}`} title={t("row.deduct", { count: 1 })}>
                -1
              </button>
              {[1, 5].map((delta) => (
                <button key={delta} onClick={() => handlers.onStock(row, delta)} disabled={isUpdating} className={`min-w-6 px-1.5 ${stepBtn}`} title={t("row.add", { count: delta })}>
                  +{delta}
                </button>
              ))}
              <button
                onClick={() => handlers.onStock(row, 10)}
                disabled={isUpdating}
                className="px-1.5 h-6 rounded-md bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-mono text-xs flex items-center justify-center font-bold hover:opacity-90 transition-opacity"
                title={t("row.add", { count: 10 })}
              >
                {isFlashing ? <Check className="w-3 h-3 text-emerald-500" /> : "+10"}
              </button>
            </div>
          )}
        </div>
      </td>

      <td className="py-3 px-4 text-center">
        {isArchived ? (
          dash
        ) : (
          <button
            type="button"
            onClick={() => handlers.onAvailability(row)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              row.isAvailable
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                : "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20 hover:bg-zinc-500/20"
            }`}
            title={row.isAvailable ? t("row.markUnavailable") : t("row.markAvailable")}
          >
            {row.isAvailable ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{row.isAvailable ? t("available") : t("notAvailable")}</span>
          </button>
        )}
      </td>

      <td className="py-3 px-4 text-center">
        {isArchived ? (
          dash
        ) : (
          <button
            onClick={() => handlers.onFeatured(row.variantId)}
            className={`p-1.5 rounded-lg transition-colors ${row.isFeatured ? "text-amber-500 bg-amber-500/10" : "text-zinc-600 dark:text-zinc-400 hover:text-amber-500"}`}
            title={t("row.toggleFeatured")}
          >
            <Star className={`w-4 h-4 ${row.isFeatured ? "fill-amber-500" : ""}`} />
          </button>
        )}
      </td>

      <td className="py-3 px-4 text-center">
        {isArchived ? (
          dash
        ) : row.isDrop ? (
          <div className="inline-flex flex-col items-center gap-0.5">
            <Link
              href="/admin/drops"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-moya-red/15 text-moya-red border border-moya-red/30 hover:bg-moya-red/25 transition-all shadow-xs"
              title={t("row.manageDrop")}
            >
              <Flame className="w-3 h-3 text-moya-red" />
              <span>{t("row.dropActive")}</span>
            </Link>
            {row.dropDate && (
              <span className="text-[10px] font-mono text-zinc-500">
                {new Date(row.dropDate).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", { month: "short", day: "numeric" })}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-500 font-semibold">
              <Users className="w-2.5 h-2.5" />
              <span>{t("row.dropAlerts", { count: row.subscribersCount })}</span>
            </span>
          </div>
        ) : (
          <Link
            href="/admin/drops"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 bg-zinc-100/70 dark:bg-white/[0.03] hover:bg-zinc-200 dark:hover:bg-white/[0.06] transition-colors"
            title={t("row.scheduleDrop")}
          >
            <Flame className="w-2.5 h-2.5" />
            <span>{t("row.addDrop")}</span>
          </Link>
        )}
      </td>

      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {!isArchived && (
            <button onClick={() => handlers.onEdit(row)} className={iconBtn} title={t("row.edit")}>
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          <Link href={`/products/${row.variantId}`} target="_blank" className={iconBtn} title={t("row.preview")}>
            <Eye className="w-3.5 h-3.5" />
          </Link>
          {isArchived ? (
            <button
              onClick={() => handlers.onRestore(row.variantId)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
              title={t("restore")}
            >
              <ArchiveRestore className="w-3.5 h-3.5" />
              <span>{t("restore")}</span>
            </button>
          ) : (
            <button
              onClick={() => handlers.onArchive(row.variantId)}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              title={t("archive")}
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
