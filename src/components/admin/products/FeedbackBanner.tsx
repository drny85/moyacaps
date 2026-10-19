"use client";

import { useTranslations } from "next-intl";
import { RotateCw, X } from "lucide-react";
import type { FieldError } from "@convex/catalog/rules";
import { formatSkuCells } from "@/lib/admin/editorErrors";
import type { EditorBanner } from "@/lib/admin/editorErrors";

/** One save/action failure, worded from `admin.products.errors`. */
export function FeedbackBanner({
  banner,
  formErrors = [],
  colorwayName,
  onDismiss,
  onReload,
}: {
  banner: EditorBanner | null;
  formErrors?: FieldError[];
  colorwayName?: (id: string) => string;
  onDismiss: () => void;
  onReload?: () => void;
}) {
  const t = useTranslations("admin.products");
  if (!banner && formErrors.length === 0) return null;

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
      <div className="space-y-1">
        {lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
      <button type="button" onClick={onDismiss} className="p-1 rounded hover:bg-red-500/20 text-red-500 shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
