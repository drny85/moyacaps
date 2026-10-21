import type { Category, TeeColorwayInput } from "../../../../convex/catalog/rules";
import { categoryOf, type ResolvedVariant } from "../productForm";

/** What the prompt and the merge know about the catalog: shared so both see the same data. */
export type AutofillCatalogContext = {
  colorways: TeeColorwayInput[];
  examples: { category: Category; nameEn: string; nameEs: string; descriptionEn: string; descriptionEs: string }[];
  takenSlugs: string[];
};

export type ContextRow = Pick<
  ResolvedVariant,
  "_creationTime" | "variantId" | "category" | "silhouette" | "nameEn" | "nameEs" | "descriptionEn" | "descriptionEs" | "archivedAt" | "colorways"
>;

const MAX_EXAMPLES = 3;

export function catalogContextFrom(rows: ContextRow[]): AutofillCatalogContext {
  const colorways = new Map<string, TeeColorwayInput>();
  for (const r of rows) {
    for (const { id, nameEn, nameEs, hex, borderHex } of r.colorways ?? []) {
      if (!colorways.has(id)) colorways.set(id, { id, nameEn, nameEs, hex, borderHex });
    }
  }
  const examples = rows
    .filter((r) => r.archivedAt === undefined && r.descriptionEn && r.descriptionEs)
    .sort((a, b) => b._creationTime - a._creationTime)
    .slice(0, MAX_EXAMPLES)
    .map((r) => ({
      category: categoryOf(r),
      nameEn: r.nameEn,
      nameEs: r.nameEs,
      descriptionEn: r.descriptionEn ?? "",
      descriptionEs: r.descriptionEs ?? "",
    }));
  return { colorways: [...colorways.values()], examples, takenSlugs: rows.map((r) => r.variantId) };
}
