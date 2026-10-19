"use client";

import { useTranslations } from "next-intl";
import type { ProductFormState } from "@/lib/admin/productForm";
import { fieldErrorFor } from "@/lib/admin/editorErrors";
import type { EditorFeedback } from "@/lib/admin/editorErrors";
import { TextField, sectionClass, sectionTitleClass } from "./editorFields";

/** Price, stock, tax code, storefront visibility and featured flag. */
export function ProductPricingFields({
  form,
  feedback,
  onChange,
}: {
  form: ProductFormState;
  feedback: EditorFeedback;
  onChange: (changes: Partial<ProductFormState>) => void;
}) {
  const t = useTranslations("admin.products");
  const err = (field: string) => fieldErrorFor(feedback, field);
  const isTee = form.category === "apparel";

  return (
    <section className={sectionClass}>
      <h3 className={sectionTitleClass}>{t("sections.pricing")}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
        <TextField label={t("priceUsd")} type="number" mono value={form.priceUsd} onChange={(priceUsd) => onChange({ priceUsd })} error={err("priceUsd")} />
        <TextField
          label={t("stock")}
          type="number"
          mono
          value={form.stock}
          disabled={isTee}
          hint={isTee ? t("teeStockHint") : undefined}
          onChange={(stock) => onChange({ stock })}
          error={err("stock")}
        />
        <TextField label={t("taxCode")} mono value={form.taxCode} onChange={(taxCode) => onChange({ taxCode })} error={err("taxCode")} />
      </div>

      <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10">
        <input
          type="checkbox"
          id="availableCheck"
          checked={form.isAvailable}
          onChange={(e) => onChange({ isAvailable: e.target.checked })}
          className="w-4 h-4 rounded text-moya-red focus:ring-moya-red cursor-pointer"
        />
        <label htmlFor="availableCheck" className="flex-1 cursor-pointer">
          <span className="font-semibold text-zinc-900 dark:text-white block text-xs">{t("availableSwitch")}</span>
          <span className="text-[11px] text-zinc-500 block">{t("availableSwitchDesc")}</span>
        </label>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono ${
            form.isAvailable ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400"
          }`}
        >
          {form.isAvailable ? t("available") : t("notAvailable")}
        </span>
      </div>

      <div className="flex items-center gap-2 px-1">
        <input
          type="checkbox"
          id="featuredCheck"
          checked={form.isFeatured}
          onChange={(e) => onChange({ isFeatured: e.target.checked })}
          className="w-4 h-4 rounded text-moya-red focus:ring-moya-red cursor-pointer"
        />
        <label htmlFor="featuredCheck" className="font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer text-xs">
          {t("featured")}
        </label>
      </div>
    </section>
  );
}
