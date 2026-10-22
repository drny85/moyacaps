/**
 * Cart stock model: how many units each cart line may hold, from the live rows of
 * `catalog/queries:getCartVariants`. Tees clamp to their own SKU (Graphic Design ×
 * colorway × size); caps clamp to the variant's stock. Pure functions only.
 */
import { skuStock, type SkuStock } from "./productOptions";
import { MAX_UNITS_PER_LINE } from "../../convex/payments/limits";

export interface CartStockLine {
  id: string;
  variantId?: string;
  name: string;
  quantity: number;
  maxStock?: number;
  colorway?: string;
  size?: string;
}

/** The fields of one `getCartVariants` row the cart reads. `skus` is null for caps. */
export interface CartStockVariant {
  variantId: string;
  stock: number;
  isAvailable?: boolean;
  isDrop?: boolean;
  dropDate?: number;
  dropStatus?: string;
  skus?: SkuStock[] | null;
}

export function findLineVariant<V extends { variantId: string }>(
  line: Pick<CartStockLine, "id" | "variantId">,
  variants: readonly V[]
): V | undefined {
  return variants.find((v) => v.variantId === (line.variantId || line.id));
}

/** Units this line may hold: its SKU's stock for a tee, the variant's stock for a cap. */
export function lineStock(line: Pick<CartStockLine, "colorway" | "size">, variant: CartStockVariant): number {
  const stock = variant.skus ? skuStock(variant.skus, line.colorway, line.size) : variant.stock;
  return typeof stock === "number" ? Math.max(0, stock) : 0;
}

/** A drop not yet released for purchase. */
export function isUnreleasedDrop(variant: CartStockVariant, now: number): boolean {
  return Boolean(
    variant.isDrop &&
      variant.dropStatus !== "live" &&
      ((typeof variant.dropDate === "number" && now < variant.dropDate) || variant.dropStatus === "scheduled")
  );
}

/** True when the line cannot be bought as it stands: unavailable, sold out, or over its stock. */
export function lineOverStock(line: CartStockLine, variant: CartStockVariant): boolean {
  const stock = lineStock(line, variant);
  return variant.isAvailable === false || stock <= 0 || line.quantity > stock;
}

export interface ClampResult<L> {
  cart: L[];
  adjusted: boolean;
  adjustedNames: string[];
}

/**
 * Fit every line to live stock: drop unavailable, sold-out and unreleased lines, cap the
 * rest at their stock and record it as `maxStock`. Lines with no live row stay as they are.
 */
export function clampCart<L extends CartStockLine>(
  cart: readonly L[],
  variants: readonly CartStockVariant[],
  now: number
): ClampResult<L> {
  const adjustedNames: string[] = [];
  const out: L[] = [];

  for (const line of cart) {
    const variant = findLineVariant(line, variants);
    if (!variant) {
      out.push(line);
      continue;
    }
    const stock = lineStock(line, variant);
    if (variant.isAvailable === false || stock <= 0 || isUnreleasedDrop(variant, now)) {
      adjustedNames.push(line.name);
      continue;
    }
    // Checkout refuses more than MAX_UNITS_PER_LINE of one line, so the cart never holds more.
    const limit = Math.min(stock, MAX_UNITS_PER_LINE);
    if (line.quantity > limit) adjustedNames.push(line.name);
    out.push({ ...line, quantity: Math.min(line.quantity, limit), maxStock: limit });
  }

  return { cart: out, adjusted: adjustedNames.length > 0, adjustedNames };
}
