"use client";

import { useTranslations } from "next-intl";
import type { ProductFormState } from "@/lib/admin/productForm";
import type { EditorFeedback } from "@/lib/admin/editorErrors";
import { formSkuMatrix, markBlocked } from "@/lib/admin/skuMatrix";
import type { SkuStock } from "@/lib/admin/skuMatrix";
import { SkuMatrix } from "./SkuMatrix";

/** The saved tee behind the SKU matrix; absent for a Product not created yet. */
export type SavedTee = {
  variantId: string;
  productName: string;
  skus: SkuStock[];
  colorways: { id: string; nameEn: string; nameEs: string; hex?: string; borderHex?: string }[];
  sizes: string[];
};

/**
 * A tee's stock, managed per SKU (Apparel Colorway × size) right in Pricing & Stock.
 * The grid follows the form's colorways and sizes, so an added row or column shows
 * before Save and a removed one that still holds stock is flagged.
 */
export function TeeSkuStock({
  form,
  feedback,
  saved,
  locale,
}: {
  form: ProductFormState;
  feedback: EditorFeedback;
  saved?: SavedTee;
  locale: string;
}) {
  const t = useTranslations("admin.products.teeOptions");
  if (!saved) return <p className="text-[11px] text-zinc-500">{t("skuAfterCreate")}</p>;

  const nameOf = (c: { id: string; nameEn: string; nameEs: string }) => (locale === "es" ? c.nameEs : c.nameEn) || c.id;
  const formColorways = form.colorways
    .filter((c, i) => c.id !== "" && form.colorways.findIndex((x) => x.id === c.id) === i)
    .map((c) => ({ id: c.id, name: nameOf(c), hex: c.hex, borderHex: c.borderHex }));
  const banner = feedback.banner;
  const matrix = markBlocked(
    formSkuMatrix(
      { colorways: formColorways, sizes: form.sizes },
      { colorways: saved.colorways.map((c) => ({ id: c.id, name: nameOf(c), hex: c.hex, borderHex: c.borderHex })), sizes: saved.sizes },
      saved.skus
    ),
    banner?.kind === "sku_in_stock" ? banner.cells : []
  );
  return <SkuMatrix variantId={saved.variantId} productName={saved.productName} matrix={matrix} />;
}
