"use client";

import { useTranslations } from "next-intl";
import { CATEGORIES, PRODUCT_LIMITS, SILHOUETTES_BY_CATEGORY } from "@convex/catalog/rules";
import type { Category } from "@convex/catalog/rules";
import { storePath } from "@/lib/admin/productForm";
import type { ProductFormState } from "@/lib/admin/productForm";
import { fieldErrorFor } from "@/lib/admin/editorErrors";
import type { EditorFeedback } from "@/lib/admin/editorErrors";
import type { AutofillField } from "@/lib/admin/photoAutofill/merge";
import { CopyFromAction, Field, HexField, TextAreaField, TextField, inputClass, sectionClass, sectionTitleClass } from "./editorFields";

/** Identity, names, palette and storefront copy of a product. */
export function DetailsSection({
  form,
  feedback,
  isNew,
  onChange,
  onCategory,
  onNameEn,
  aiFilled = [],
}: {
  form: ProductFormState;
  feedback: EditorFeedback;
  isNew: boolean;
  onChange: (changes: Partial<ProductFormState>) => void;
  onCategory: (category: Category) => void;
  onNameEn: (nameEn: string) => void;
  /** Fields still holding a Photo Autofill value. */
  aiFilled?: readonly AutofillField[];
}) {
  const t = useTranslations("admin.products");
  const tf = useTranslations("admin.products.form");
  const err = (field: string) => fieldErrorFor(feedback, field);
  const isTee = form.category === "apparel";
  const ai = (field: AutofillField) => aiFilled.includes(field);

  return (
    <section className={sectionClass}>
      <div>
        <h3 className={sectionTitleClass}>{t("sections.details")}</h3>
        <p className="text-[11px] text-zinc-500 mt-0.5">{tf("requiredHint")}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t("category")} error={err("category")} ai={ai("category")}>
          <select value={form.category} onChange={(e) => onCategory(e.target.value as Category)} className={`${inputClass} mt-1`}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("silhouette")} error={err("silhouette")} ai={ai("silhouette")}>
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
        <TextField
          label={t("productNameEn")}
          value={form.nameEn}
          onChange={onNameEn}
          error={err("nameEn")}
          ai={ai("nameEn")}
          required
          maxLength={PRODUCT_LIMITS.name}
          placeholder={isTee ? tf("placeholders.nameEnTee") : tf("placeholders.nameEnCap")}
          hint={isNew ? tf("hints.nameEn") : undefined}
        />
        <TextField
          label={t("productNameEs")}
          value={form.nameEs}
          onChange={(nameEs) => onChange({ nameEs })}
          error={err("nameEs")}
          ai={ai("nameEs")}
          required
          maxLength={PRODUCT_LIMITS.name}
          placeholder={isTee ? tf("placeholders.nameEsTee") : tf("placeholders.nameEsCap")}
          action={<CopyFromAction source={form.nameEn} onCopy={(nameEs) => onChange({ nameEs })} />}
        />
      </div>

      <TextField
        label={t("variantId")}
        value={form.variantId}
        mono
        required
        disabled={!isNew}
        hint={isNew ? tf("hints.slug", { path: storePath(form.variantId) }) : t("variantIdLocked")}
        placeholder={t("variantIdPlaceholder")}
        onChange={(variantId) => onChange({ variantId })}
        error={err("variantId")}
        ai={ai("variantId")}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10">
        <HexField
          label={isTee ? tf("labels.swatchHex") : t("primaryHex")}
          value={form.primaryHex}
          onChange={(primaryHex) => onChange({ primaryHex })}
          error={err("primaryHex")}
          ai={ai("primaryHex")}
          hint={isTee ? tf("hints.swatchHex") : tf("hints.primaryHex")}
        />
        <HexField
          label={isTee ? tf("labels.swatchBorderHex") : t("secondaryHex")}
          value={form.secondaryHex}
          onChange={(secondaryHex) => onChange({ secondaryHex })}
          error={err("secondaryHex")}
          ai={ai("secondaryHex")}
          hint={isTee ? undefined : tf("hints.secondaryHex")}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TextAreaField
          label={t("descriptionEn")}
          value={form.descriptionEn}
          onChange={(descriptionEn) => onChange({ descriptionEn })}
          error={err("descriptionEn")}
          ai={ai("descriptionEn")}
          placeholder={isTee ? tf("placeholders.descriptionTee") : tf("placeholders.descriptionCap")}
          hint={tf("hints.description")}
          maxLength={PRODUCT_LIMITS.description}
        />
        <TextAreaField
          label={t("descriptionEs")}
          value={form.descriptionEs}
          onChange={(descriptionEs) => onChange({ descriptionEs })}
          error={err("descriptionEs")}
          ai={ai("descriptionEs")}
          placeholder={isTee ? tf("placeholders.descriptionTeeEs") : tf("placeholders.descriptionCapEs")}
          maxLength={PRODUCT_LIMITS.description}
          action={<CopyFromAction source={form.descriptionEn} onCopy={(descriptionEs) => onChange({ descriptionEs })} />}
        />
        <TextField
          label={t("badgeTextEn")}
          value={form.badgeTextEn}
          onChange={(badgeTextEn) => onChange({ badgeTextEn })}
          error={err("badgeTextEn")}
          placeholder={tf("placeholders.badge")}
          hint={tf("hints.badge")}
          maxLength={PRODUCT_LIMITS.badge}
        />
        <TextField
          label={t("badgeTextEs")}
          value={form.badgeTextEs}
          onChange={(badgeTextEs) => onChange({ badgeTextEs })}
          error={err("badgeTextEs")}
          placeholder={tf("placeholders.badgeEs")}
          maxLength={PRODUCT_LIMITS.badge}
          action={<CopyFromAction source={form.badgeTextEn} onCopy={(badgeTextEs) => onChange({ badgeTextEs })} />}
        />
      </div>
    </section>
  );
}
