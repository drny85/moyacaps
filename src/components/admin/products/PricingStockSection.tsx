"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { ProductFormState } from "@/lib/admin/productForm";
import { fieldErrorFor } from "@/lib/admin/editorErrors";
import type { EditorFeedback } from "@/lib/admin/editorErrors";
import { TextField, sectionClass, sectionTitleClass } from "./editorFields";

/** Price, stock (per SKU for tees), tax code, storefront visibility and featured flag. */
export function PricingStockSection({
  form,
  feedback,
  isNew,
  onChange,
  skuStock,
}: {
  form: ProductFormState;
  feedback: EditorFeedback;
  /** A new Product is created hidden; visibility and featured come after its first Catalog Shot. */
  isNew: boolean;
  onChange: (changes: Partial<ProductFormState>) => void;
  /** A tee's per-SKU stock grid, shown in place of the single stock field. */
  skuStock?: ReactNode;
}) {
  const t = useTranslations("admin.products");
  const tf = useTranslations("admin.products.form");
  const err = (field: string) => fieldErrorFor(feedback, field);
  const isTee = form.category === "apparel";

  return (
    <section className={sectionClass}>
      <h3 className={sectionTitleClass}>{t("sections.pricing")}</h3>
      <div className={`grid grid-cols-1 gap-3 items-start ${isTee ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
        <TextField
          label={t("priceUsd")}
          type="number"
          inputMode="decimal"
          mono
          required
          value={form.priceUsd}
          onChange={(priceUsd) => onChange({ priceUsd })}
          error={err("priceUsd")}
          placeholder={isTee ? "60.00" : "45.00"}
          hint={tf("hints.price")}
        />
        {!isTee && (
          <TextField
            label={t("stock")}
            type="number"
            inputMode="numeric"
            mono
            required
            value={form.stock}
            onChange={(stock) => onChange({ stock })}
            error={err("stock")}
            placeholder="12"
            hint={tf("hints.stock")}
          />
        )}
      </div>
      <details className="group">
        <summary className="cursor-pointer text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white select-none">{tf("advanced")}</summary>
        <div className="mt-2 sm:max-w-xs">
          <TextField label={t("taxCode")} mono value={form.taxCode} onChange={(taxCode) => onChange({ taxCode })} error={err("taxCode")} hint={tf("hints.taxCode")} placeholder="txcd_30011000" />
        </div>
      </details>

      {isTee && (
        <div>
          <span className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">{t("teeOptions.skuStock")}</span>
          <p className="text-[11px] text-zinc-500 mb-2">{t("teeStockHint")}</p>
          {skuStock}
        </div>
      )}

      {isNew ? (
        <p className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-300">{tf("hiddenUntilPublished")}</p>
      ) : (
        <>
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
          </>
      )}
    </section>
  );
}
