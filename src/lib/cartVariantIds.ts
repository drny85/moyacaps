/** The distinct products a cart holds, for `catalog/queries:getCartVariants`. Sorted so the query args stay stable. */
export function cartVariantIds(cart: ReadonlyArray<{ id: string; variantId?: string }>): string[] {
  return [...new Set(cart.map((item) => item.variantId || item.id))].sort();
}
