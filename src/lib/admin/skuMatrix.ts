import { ALLOWED_SIZES } from "../../../convex/catalog/rules";

/**
 * The tee SKU matrix (D9): Apparel Colorways as rows, sizes as columns, one stock cell
 * per SKU. A cell with no SKU row yet (a colorway or size added in the form, not saved)
 * shows 0 and is not editable until the form is saved.
 */

export type SkuStock = { colorway: string; size: string; stock: number };
export type SkuCellVM = { size: string; stock: number; saved: boolean; blocked: boolean; removed: boolean };
export type SkuRowVM = { colorway: string; name: string; cells: SkuCellVM[]; total: number; removed: boolean };
export type SkuMatrix = { sizes: string[]; removedSizes: string[]; rows: SkuRowVM[]; total: number };

type Colorway = { id: string; name: string; removed?: boolean };

const key = (colorway: string, size: string) => `${colorway}\u0000${size}`;

/** `removedSizes` are columns the form dropped but the saved tee still has. */
export function buildSkuMatrix(colorways: Colorway[], sizes: string[], skus: SkuStock[], removedSizes: string[] = []): SkuMatrix {
  const stock = new Map(skus.map((s) => [key(s.colorway, s.size), s.stock]));
  const rows = colorways.map(({ id, name, removed = false }) => {
    const cells = sizes.map((size) => {
      const saved = stock.get(key(id, size));
      return { size, stock: saved ?? 0, saved: saved !== undefined, blocked: false, removed: removed || removedSizes.includes(size) };
    });
    return { colorway: id, name, cells, total: cells.reduce((sum, c) => sum + c.stock, 0), removed };
  });
  return { sizes, removedSizes, rows, total: rows.reduce((sum, r) => sum + r.total, 0) };
}

/**
 * The matrix for the editor: the form's colorways and sizes, plus the saved ones the
 * form removed (shown struck through until Save, so a removal that would drop stock is visible).
 */
export function formSkuMatrix(
  form: { colorways: Colorway[]; sizes: string[] },
  saved: { colorways: Colorway[]; sizes: string[] },
  skus: SkuStock[]
): SkuMatrix {
  const formIds = new Set(form.colorways.map((c) => c.id));
  const colorways = [...form.colorways, ...saved.colorways.filter((c) => !formIds.has(c.id)).map((c) => ({ ...c, removed: true }))];
  const removedSizes = saved.sizes.filter((s) => !form.sizes.includes(s));
  const all = new Set([...form.sizes, ...removedSizes]);
  const sizes = [...ALLOWED_SIZES.filter((s) => all.has(s)), ...[...all].filter((s) => !(ALLOWED_SIZES as readonly string[]).includes(s))];
  return buildSkuMatrix(colorways, sizes, skus, removedSizes);
}

/** Flag the cells a `sku_in_stock` error names: removing them would drop live stock. */
export function markBlocked(matrix: SkuMatrix, cells: { colorway: string; size: string }[]): SkuMatrix {
  const blocked = new Set(cells.map((c) => key(c.colorway, c.size)));
  return {
    ...matrix,
    rows: matrix.rows.map((row) => ({
      ...row,
      cells: row.cells.map((c) => ({ ...c, blocked: blocked.has(key(row.colorway, c.size)) })),
    })),
  };
}
