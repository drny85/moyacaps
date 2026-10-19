import { CATEGORIES, SILHOUETTES_BY_CATEGORY } from "../../../convex/catalog/rules";
import type { Category } from "../../../convex/catalog/rules";
import { categoryOf } from "./productForm";
import type { ResolvedVariant } from "./productForm";

/** The admin product list's search and filters. */

export type FilterableProduct = Pick<ResolvedVariant, "variantId" | "nameEn" | "nameEs" | "silhouette" | "category" | "isAvailable">;

export type AvailabilityFilter = "all" | "available" | "unavailable";

export type ProductFilters = {
  query: string;
  category: Category | "all";
  silhouette: string;
  availability: AvailabilityFilter;
};

export const DEFAULT_FILTERS: ProductFilters = { query: "", category: "all", silhouette: "all", availability: "all" };

export function silhouetteOptions(category: Category | "all"): string[] {
  const categories = category === "all" ? CATEGORIES : [category];
  return categories.flatMap((c) => [...SILHOUETTES_BY_CATEGORY[c]]);
}

/** Change the category filter, dropping a silhouette that category does not have. */
export function withFilterCategory(filters: ProductFilters, category: Category | "all"): ProductFilters {
  const keepSilhouette = filters.silhouette === "all" || silhouetteOptions(category).includes(filters.silhouette);
  return { ...filters, category, silhouette: keepSilhouette ? filters.silhouette : "all" };
}

export function filterProducts<T extends FilterableProduct>(rows: T[], filters: ProductFilters): T[] {
  const query = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    const matchesQuery =
      query === "" ||
      row.nameEn.toLowerCase().includes(query) ||
      row.nameEs.toLowerCase().includes(query) ||
      row.variantId.toLowerCase().includes(query);
    const matchesCategory = filters.category === "all" || categoryOf(row) === filters.category;
    const matchesSilhouette = filters.silhouette === "all" || row.silhouette === filters.silhouette;
    const matchesAvailability =
      filters.availability === "all" || (filters.availability === "available") === row.isAvailable;
    return matchesQuery && matchesCategory && matchesSilhouette && matchesAvailability;
  });
}
