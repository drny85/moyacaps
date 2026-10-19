import { CATEGORIES } from "../../../convex/catalog/rules";
import type { Category } from "../../../convex/catalog/rules";
import { attentionReasons } from "./productAttention";
import { dropState } from "./productCard";
import { categoryOf } from "./productForm";
import { matchesQuery } from "./productSearch";
import type { AdminProduct } from "./productSearch";
import { stockLevel, totalStock } from "./stockLevel";

export { LOW_STOCK_THRESHOLD } from "./stockLevel";

/** The admin product grid's search and filter chips (D4). Each chip group holds at most one value. */

export const STATUS_FILTERS = ["live", "hidden", "archived", "drop"] as const;
export const STOCK_FILTERS = ["out", "low", "in"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];
export type StockFilter = (typeof STOCK_FILTERS)[number];

export type ProductFilters = {
  q: string;
  category?: Category;
  status?: StatusFilter;
  stock?: StockFilter;
  featured?: boolean;
  attention?: boolean;
};

export const EMPTY_FILTERS: ProductFilters = { q: "" };

export function hasActiveFilters(f: ProductFilters): boolean {
  return f.q.trim() !== "" || f.category !== undefined || f.status !== undefined || f.stock !== undefined || Boolean(f.featured) || Boolean(f.attention);
}

function matchesStatus(p: AdminProduct, status: StatusFilter | undefined, now: number): boolean {
  const archived = p.archivedAt !== undefined;
  if (status === "archived") return archived;
  if (archived) return false;
  switch (status) {
    case undefined:
      return true;
    case "live":
      return p.isAvailable;
    case "hidden":
      return !p.isAvailable;
    case "drop":
      return dropState(p, now) !== undefined;
  }
}

/** The Products the grid shows; every active filter must match. `now` decides drop status. */
export function applyFilters<T extends AdminProduct>(products: T[], f: ProductFilters, now: number): T[] {
  return products.filter(
    (p) =>
      matchesStatus(p, f.status, now) &&
      (f.category === undefined || categoryOf(p) === f.category) &&
      (f.stock === undefined || stockLevel(totalStock(p)) === f.stock) &&
      (!f.featured || p.isFeatured) &&
      (!f.attention || attentionReasons(p).length > 0) &&
      matchesQuery(p, f.q)
  );
}

/** How many Products the grid would show with `patch` applied on top of `f`. */
export function chipCount(products: AdminProduct[], f: ProductFilters, patch: Partial<ProductFilters>, now: number): number {
  return applyFilters(products, { ...f, ...patch }, now).length;
}

function oneOf<T extends string>(values: readonly T[], raw: string | null): T | undefined {
  return values.find((v) => v === raw);
}

/** Read filters from the URL; unknown values mean "no filter". */
export function filtersFromSearchParams(sp: URLSearchParams): ProductFilters {
  const f: ProductFilters = { q: sp.get("q") ?? "" };
  const category = oneOf(CATEGORIES, sp.get("category"));
  const status = oneOf(STATUS_FILTERS, sp.get("status"));
  const stock = oneOf(STOCK_FILTERS, sp.get("stock"));
  if (category) f.category = category;
  if (status) f.status = status;
  if (stock) f.stock = stock;
  if (sp.get("featured") === "1") f.featured = true;
  if (sp.get("attention") === "1") f.attention = true;
  return f;
}

export function filtersToSearchParams(f: ProductFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.q !== "") sp.set("q", f.q);
  if (f.category) sp.set("category", f.category);
  if (f.status) sp.set("status", f.status);
  if (f.stock) sp.set("stock", f.stock);
  if (f.featured) sp.set("featured", "1");
  if (f.attention) sp.set("attention", "1");
  return sp;
}
