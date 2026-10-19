import type { AdminProduct } from "./productSearch";

/** At or below this many units (and above 0) a Product is low on stock. */
export const LOW_STOCK_THRESHOLD = 5;

export type StockLevel = "out" | "low" | "in";

/** Available Inventory: a tee's SKUs summed, or a cap's own stock. */
export function totalStock(p: Pick<AdminProduct, "stock" | "skus">): number {
  return p.skus.length > 0 ? p.skus.reduce((sum, s) => sum + s.stock, 0) : p.stock;
}

export function stockLevel(n: number): StockLevel {
  if (n <= 0) return "out";
  return n <= LOW_STOCK_THRESHOLD ? "low" : "in";
}
