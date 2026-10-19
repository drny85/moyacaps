"use client";

import { useLocale, useTranslations } from "next-intl";
import { CornerDownLeft, X } from "lucide-react";
import type { ProductFormState } from "@/lib/admin/productForm";
import { unsavedFields } from "@/lib/admin/editorSession";

function display(form: ProductFormState, field: keyof ProductFormState, locale: string, yes: string, no: string): string {
  const value = form[field];
  if (typeof value === "boolean") return value ? yes : no;
  if (field === "colorways") return form.colorways.map((c) => (locale === "es" ? c.nameEs : c.nameEn) || c.id).join(", ");
  if (Array.isArray(value)) return value.join(", ");
  return value === undefined || value === "" ? "—" : String(value);
}

/**
 * After "Reload latest" (D12): the values the Administrator had typed, beside the
 * freshly loaded ones, each with Apply to put it back into the form.
 */
export function StaleValuesPanel({
  form,
  unsaved,
  onApply,
  onDismiss,
}: {
  form: ProductFormState;
  unsaved: ProductFormState;
  onApply: (field: keyof ProductFormState) => void;
  onDismiss: () => void;
}) {
  const t = useTranslations("admin.products.stale");
  const tFields = useTranslations("admin.products.fields");
  const locale = useLocale();
  const fields = unsavedFields(form, unsaved);
  if (fields.length === 0) return null;

  return (
    <div role="status" className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] text-xs space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-zinc-900 dark:text-white">{t("title")}</p>
          <p className="text-zinc-600 dark:text-zinc-400">{t("body")}</p>
        </div>
        <button type="button" onClick={onDismiss} aria-label={t("dismiss")} className="p-1 rounded hover:bg-amber-500/20 text-zinc-500">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <ul className="divide-y divide-amber-500/20">
        {fields.map((field) => (
          <li key={field} className="py-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 items-center">
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{tFields(field)}</span>
            <button
              type="button"
              onClick={() => onApply(field)}
              className="row-span-3 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 font-semibold text-amber-800 dark:text-amber-300"
            >
              <CornerDownLeft className="w-3.5 h-3.5" /> {t("apply")}
            </button>
            <span className="text-zinc-600 dark:text-zinc-400 break-all">
              {t("yours")}: <span className="font-mono text-zinc-900 dark:text-white">{display(unsaved, field, locale, t("yes"), t("no"))}</span>
            </span>
            <span className="text-zinc-500 break-all">
              {t("latest")}: <span className="font-mono">{display(form, field, locale, t("yes"), t("no"))}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
