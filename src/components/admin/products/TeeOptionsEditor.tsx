"use client";

import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { ALLOWED_SIZES } from "@convex/catalog/rules";
import type { ColorwayDraft, ProductFormState } from "@/lib/admin/productForm";
import { fieldErrorFor } from "@/lib/admin/editorErrors";
import type { EditorFeedback } from "@/lib/admin/editorErrors";
import { addColorway, addStandardColorways, isColorwayLocked, removeColorway, toggleSize, updateColorway } from "@/lib/admin/teeOptions";
import { Field, FieldErrorText, HexField, TextField, inputClass, sectionClass, sectionTitleClass } from "./editorFields";

/** Apparel Colorways, sizes, default colorway and fabric/fit copy of a tee. Stock per SKU lives in Pricing & Stock. */
export function TeeOptionsEditor({
  form,
  feedback,
  savedColorwayIds,
  printPosition,
  locale,
  onChange,
}: {
  form: ProductFormState;
  feedback: EditorFeedback;
  savedColorwayIds: ReadonlySet<string>;
  printPosition?: "front" | "back";
  locale: string;
  onChange: (edit: (f: ProductFormState) => ProductFormState) => void;
}) {
  const t = useTranslations("admin.products.teeOptions");
  const tSections = useTranslations("admin.products.sections");
  const nameOf = (c: { id: string; nameEn: string; nameEs: string }) => (locale === "es" ? c.nameEs : c.nameEn) || c.id;
  const err = (field: string) => fieldErrorFor(feedback, field);
  const setColorway = (index: number, changes: Partial<ColorwayDraft>) =>
    onChange((f) => updateColorway(f, index, changes, savedColorwayIds));
  const effectiveDefault = form.colorways.some((c) => c.id === form.defaultColorway) ? form.defaultColorway : form.colorways[0]?.id;

  return (
    <section className={sectionClass}>
      <h3 className={sectionTitleClass}>{tSections("tee")}</h3>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          {t("colorways")}
          <span className="text-moya-red ml-0.5" aria-hidden>*</span>
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange(addStandardColorways)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[11px] font-semibold hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("addStandard")}</span>
          </button>
          <button
            type="button"
            onClick={() => onChange(addColorway)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-white/10 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("add")}</span>
          </button>
        </div>
      </div>
      <p className="text-[11px] text-zinc-500">{form.colorways.length === 0 ? t("empty") : t("standardHint")}</p>
      <FieldErrorText error={err("colorways")} />

      {form.colorways.map((c, i) => {
        const locked = isColorwayLocked(form.colorways, i, savedColorwayIds);
        const at = `colorways[${i}]`;
        return (
          <div key={c.uid ?? i} className="p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField label={t("nameEn")} value={c.nameEn} onChange={(nameEn) => setColorway(i, { nameEn })} error={err(`${at}.nameEn`)} placeholder="Crisp Optical White" required />
              <TextField label={t("nameEs")} value={c.nameEs} onChange={(nameEs) => setColorway(i, { nameEs })} error={err(`${at}.nameEs`)} placeholder="Blanco Puro" required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              <TextField
                label={t("id")}
                value={c.id}
                mono
                disabled={locked}
                hint={locked ? t("idLocked") : undefined}
                onChange={(id) => setColorway(i, { id })}
                error={err(`${at}.id`)}
              />
              <HexField label={t("hex")} value={c.hex} onChange={(hex) => setColorway(i, { hex })} error={err(`${at}.hex`)} />
              <HexField label={t("borderHex")} value={c.borderHex} onChange={(borderHex) => setColorway(i, { borderHex })} error={err(`${at}.borderHex`)} />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onChange((f) => removeColorway(f, i))}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t("remove")}</span>
              </button>
            </div>
          </div>
        );
      })}

      <div>
        <span className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">{t("sizes")}</span>
        <div className="flex flex-wrap gap-1.5">
          {ALLOWED_SIZES.map((size) => {
            const on = form.sizes.includes(size);
            return (
              <button
                key={size}
                type="button"
                aria-pressed={on}
                onClick={() => onChange((f) => toggleSize(f, size))}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors ${
                  on
                    ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                    : "bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                {size}
              </button>
            );
          })}
        </div>
        <FieldErrorText error={err("sizes")} />
        <p className="mt-1 text-[11px] text-zinc-500">{t("skuStockInPricing")}</p>
      </div>


      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t("defaultColorway")} error={err("defaultColorway")}>
          <select
            value={effectiveDefault ?? ""}
            disabled={form.colorways.length === 0}
            onChange={(e) => onChange((f) => ({ ...f, defaultColorway: e.target.value }))}
            className={`${inputClass} mt-1`}
          >
            {form.colorways.map((c, i) => (
              <option key={i} value={c.id}>
                {(locale === "es" ? c.nameEs : c.nameEn) || c.id}
              </option>
            ))}
          </select>
        </Field>
        {printPosition && (
          <div>
            <span className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">{t("printPosition")}</span>
            <p className="py-2 text-zinc-600 dark:text-zinc-400">{t(`printPositions.${printPosition}`)}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TextField label={t("fabricEn")} value={form.fabricEn} onChange={(fabricEn) => onChange((f) => ({ ...f, fabricEn }))} error={err("fabricEn")} placeholder="280 GSM combed cotton" />
        <TextField label={t("fabricEs")} value={form.fabricEs} onChange={(fabricEs) => onChange((f) => ({ ...f, fabricEs }))} error={err("fabricEs")} placeholder="Algodón peinado 280 GSM" />
        <TextField label={t("fitEn")} value={form.fitEn} onChange={(fitEn) => onChange((f) => ({ ...f, fitEn }))} error={err("fitEn")} placeholder="Boxy, drop-shoulder" />
        <TextField label={t("fitEs")} value={form.fitEs} onChange={(fitEs) => onChange((f) => ({ ...f, fitEs }))} error={err("fitEs")} placeholder="Holgado, hombro caído" />
      </div>
    </section>
  );
}
