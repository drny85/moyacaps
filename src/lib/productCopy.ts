import type { CapVariant } from "../data/caps";

/** Trimmed text, or undefined when missing or blank (the admin stores a cleared text as ""). */
export function nonBlank(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * The Administrator-written description for this locale, falling back to the other
 * locale's text. Undefined when neither is set, so callers keep their default copy.
 */
export function customDescription(
  product: Pick<CapVariant, "descriptionEn" | "descriptionEs">,
  locale: string,
): string | undefined {
  const [own, other] =
    locale === "es" ? [product.descriptionEs, product.descriptionEn] : [product.descriptionEn, product.descriptionEs];
  return nonBlank(own) ?? nonBlank(other);
}
