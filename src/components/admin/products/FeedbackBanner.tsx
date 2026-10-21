"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2, Info, RotateCw, X } from "lucide-react";
import type { FieldError } from "@convex/catalog/rules";
import { bannerTone, formatSkuCells, stockUnits } from "@/lib/admin/editorErrors";
import type { EditorBanner } from "@/lib/admin/editorErrors";

/** One save/action failure, worded from `admin.products.errors`. */
export function FeedbackBanner({
  banner,
  formErrors = [],
  colorwayName,
  onDismiss,
  onReload,
  onDiscardStock,
}: {
  banner: EditorBanner | null;
  formErrors?: FieldError[];
  colorwayName?: (id: string) => string;
  onDismiss: () => void;
  onReload?: () => void;
  /** Offered on a `sku_in_stock` refusal: save again and drop the stock those SKUs hold. */
  onDiscardStock?: () => void;
}) {
  const t = useTranslations("admin.products");
  if (!banner && formErrors.length === 0) return null;

  // Confirmations float at the bottom so they are seen wherever the page is scrolled.
  if (banner && formErrors.length === 0 && (bannerTone(banner) === "success" || bannerTone(banner) === "info")) {
    const success = bannerTone(banner) === "success";
    return (
      <div
        role="status"
        aria-live="polite"
        className={`fixed z-40 left-1/2 -translate-x-1/2 bottom-24 sm:bottom-6 flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-full shadow-lg text-xs font-semibold border animate-slide-up ${
          success
            ? "bg-emerald-600 text-white border-emerald-500"
            : "bg-white text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-white/10"
        }`}
      >
        {success ? <CheckCircle2 className="w-4 h-4" aria-hidden /> : <Info className="w-4 h-4" aria-hidden />}
        <span>{t(success ? "editor.saved" : "editor.noChanges")}</span>
        <button type="button" onClick={onDismiss} aria-label={t("editor.dismiss")} className="p-1 rounded-full hover:bg-black/10">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (banner?.kind === "stale") {
    return (
      <div role="alert" className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-center justify-between gap-3">
        <span>{t("errors.stale")}</span>
        {onReload && (
          <button
            type="button"
            onClick={onReload}
            className="inline-flex items-center gap-1 shrink-0 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 font-semibold"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>{t("reloadLatest")}</span>
          </button>
        )}
      </div>
    );
  }

  const message = (b: EditorBanner): string => {
    switch (b.kind) {
      case "sku_in_stock":
        return t("errors.sku_in_stock", { cells: formatSkuCells(b.cells, colorwayName) });
      case "needs_image":
      case "archived":
        return t(`errors.${b.kind}`);
      case "image_rule":
        return t(`images.errors.${b.code}`);
      case "message":
        return b.text;
      case "invalid":
        return t("editor.invalid", { count: b.count });
      default:
        return t("errors.unknown");
    }
  };
  const lines = [
    ...(banner ? [message(banner)] : []),
    ...formErrors.map((e) => `${e.field}: ${t(`errors.${e.code}`)}`),
  ];

  return (
    <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 flex items-start justify-between gap-3 text-xs">
      <div className="space-y-2">
        {lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
        {banner?.kind === "sku_in_stock" && onDiscardStock && banner.cells.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const units = stockUnits(banner.cells);
              if (window.confirm(t("discardStockConfirm", { units, cells: formatSkuCells(banner.cells, colorwayName) }))) onDiscardStock();
            }}
            className="inline-flex items-center px-2.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 font-semibold text-red-700 dark:text-red-300"
          >
            {t("discardStockAndSave", { units: stockUnits(banner.cells) })}
          </button>
        )}
      </div>
      <button type="button" onClick={onDismiss} className="p-1 rounded hover:bg-red-500/20 text-red-500 shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
