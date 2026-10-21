/** The one low-stock threshold: Home, the Orders badge and the Products grid all read it (plan 0009 D21). */
export const LOW_STOCK_UNITS = 5;

export function isLowStock(stock: number): boolean {
  return stock <= LOW_STOCK_UNITS;
}
