/** Pure rules behind the admin Category Status controls (ADR 0022). */
import type { CategoryStatus } from "@convex/settings/launch";
import type { Category } from "@convex/catalog/rules";

/** Leaving Live removes products from the store, so it goes through a confirmation. */
export function needsLaunchConfirm(before: CategoryStatus, after: CategoryStatus): boolean {
  return before === "live" && after !== "live";
}

type ListedRow = { category?: string; silhouette: string; isAvailable: boolean; archivedAt?: number };

/** Products a Customer would lose if this category stopped being Live. */
export function listedCount(rows: ListedRow[], category: Category): number {
  return rows.filter((row) => {
    const rowCategory = row.category ?? (row.silhouette === "tee" ? "apparel" : "headwear");
    return rowCategory === category && row.isAvailable && row.archivedAt === undefined;
  }).length;
}
