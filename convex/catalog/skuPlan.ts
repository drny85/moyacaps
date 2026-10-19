/**
 * Pure SKU diff for a tee whose colorways or sizes changed (ADR 0015). A SKU is one
 * colorway × size cell; the plan says which cells to add, which empty cells to drop,
 * and which removals are blocked because the cell still holds stock.
 */
export type SkuCell = { colorway: string; size: string };
export type SkuOptions = { colorways: string[]; sizes: string[] };
export type SkuPlan = { insert: SkuCell[]; remove: SkuCell[]; blocked: (SkuCell & { stock: number })[] };

const cellKey = (cell: SkuCell) => `${cell.colorway}\u0000${cell.size}`;

export function planSkuChanges(before: SkuOptions, after: SkuOptions, skus: (SkuCell & { stock: number })[]): SkuPlan {
  const wanted = after.colorways.flatMap((colorway) => after.sizes.map((size) => ({ colorway, size })));
  const wantedKeys = new Set(wanted.map(cellKey));
  const existing = new Map(skus.map((s) => [cellKey(s), s]));

  const insert = wanted.filter((cell) => !existing.has(cellKey(cell)));
  const remove: SkuCell[] = [];
  const blocked: SkuPlan["blocked"] = [];
  for (const sku of skus) {
    if (wantedKeys.has(cellKey(sku))) continue;
    if (sku.stock > 0) blocked.push({ colorway: sku.colorway, size: sku.size, stock: sku.stock });
    else remove.push({ colorway: sku.colorway, size: sku.size });
  }
  return { insert, remove, blocked };
}
