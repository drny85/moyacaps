"use client";

import { useTranslations } from "next-intl";
import { CATEGORIES, SILHOUETTES_BY_CATEGORY } from "@convex/catalog/rules";
import type { Category } from "@convex/catalog/rules";
import type { ProductFormState } from "@/lib/admin/productForm";
import { fieldErrorFor } from "@/lib/admin/editorErrors";
import type { EditorFeedback } from "@/lib/admin/editorErrors";
import { Field, HexField, TextAreaField, TextField, inputClass, sectionClass, sectionTitleClass } from "./editorFields";

/** Identity, names, palette and storefront copy of a product. */
export function DetailsSection({
  form,
  feedback,
  isNew,
  onChange,
  onCategory,
  onNameEn,
}: {
  form: ProductFormState;
  feedback: EditorFeedback;
  isNew: boolean;
  onChange: (changes: Partial<ProductFormState>) => void;
  onCategory: (category: Category) => void;
  onNameEn: (nameEn: string) => void;
}) {
  const t = useTranslations("admin.products");
  const err = (field: string) => fieldErrorFor(feedback, field);

  return (
    <section className={sectionClass}>
      <h3 className={sectionTitleClass}>{t("sections.details")}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t("category")} error={err("category")}>
          <select value={form.category} onChange={(e) => onCategory(e.target.value as Category)} className={`${inputClass} mt-1`}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("silhouette")} error={err("silhouette")}>
          <select value={form.silhouette} onChange={(e) => onChange({ silhouette: e.target.value })} className={`${inputClass} mt-1`}>
            {SILHOUETTES_BY_CATEGORY[form.category].map((s) => (
              <option key={s} value={s}>
                {t(s)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TextField label={t("productNameEn")} value={form.nameEn} onChange={onNameEn} error={err("nameEn")} />
        <TextField label={t("productNameEs")} value={form.nameEs} onChange={(nameEs) => onChange({ nameEs })} error={err("nameEs")} />
      </div>

      <TextField
        label={t("variantId")}
        value={form.variantId}
        mono
        disabled={!isNew}
        hint={isNew ? undefined : t("variantIdLocked")}
        placeholder={t("variantIdPlaceholder")}
        onChange={(variantId) => onChange({ variantId })}
        error={err("variantId")}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10">
        <HexField label={t("primaryHex")} value={form.primaryHex} onChange={(primaryHex) => onChange({ primaryHex })} error={err("primaryHex")} />
        <HexField label={t("secondaryHex")} value={form.secondaryHex} onChange={(secondaryHex) => onChange({ secondaryHex })} error={err("secondaryHex")} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TextAreaField label={t("descriptionEn")} value={form.descriptionEn} onChange={(descriptionEn) => onChange({ descriptionEn })} error={err("descriptionEn")} />
        <TextAreaField label={t("descriptionEs")} value={form.descriptionEs} onChange={(descriptionEs) => onChange({ descriptionEs })} error={err("descriptionEs")} />
        <TextField label={t("badgeTextEn")} value={form.badgeTextEn} onChange={(badgeTextEn) => onChange({ badgeTextEn })} error={err("badgeTextEn")} />
        <TextField label={t("badgeTextEs")} value={form.badgeTextEs} onChange={(badgeTextEs) => onChange({ badgeTextEs })} error={err("badgeTextEs")} />
      </div>
    </section>
  );
}
