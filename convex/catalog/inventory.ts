/**
 * Single path for every stock read and write (ADR 0007, ADR 0015).
 *
 * Caps hold stock in `variant_stock`, one row per variant. Heavyweight Tees hold stock per
 * SKU (Graphic Design × Apparel Colorway × size) in the `skus` table, and a tee's total is
 * their sum, computed on read. Checkout writes only those rows, never the variant document,
 * so concurrent holds on different SKUs do not conflict and catalog edits do not race sales.
 * Reads go through `getVariant` / `withStock`, which put the live number on `stock`.
 */
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isCustomerVisible } from "./model";
import { getCategoryLaunches } from "../settings/launch";

export type StockLine = {
  variantId: string;
  quantity: number;
  colorway?: string;
  size?: string;
};

/** Upper bound of SKUs one tee can have (colorways × sizes); keeps reads bounded. */
const MAX_SKUS_PER_VARIANT = 100;

export function hasSkus(variant: Pick<Doc<"variants">, "colorways" | "sizes">): boolean {
  return Boolean(variant.colorways?.length && variant.sizes?.length);
}

/** The variant document as stored: its `stock` field is legacy (see schema), so most callers want `getVariant`. */
export async function getVariantRow(ctx: QueryCtx, variantId: string) {
  return await ctx.db
    .query("variants")
    .withIndex("by_variantId", (q) => q.eq("variantId", variantId))
    .first();
}

/** The variant with its live Available Inventory on `stock`. */
export async function getVariant(ctx: QueryCtx, variantId: string) {
  const row = await getVariantRow(ctx, variantId);
  return row && (await withStock(ctx, row));
}

/** A variant row with its live Available Inventory on `stock`: the SKU sum for a tee, the `variant_stock` row for a cap. */
export async function withStock<T extends Doc<"variants">>(ctx: QueryCtx, variant: T): Promise<T> {
  if (hasSkus(variant)) {
    const skus = await listSkus(ctx, variant.variantId);
    return { ...variant, stock: skus.reduce((sum, s) => sum + s.stock, 0) };
  }
  return { ...variant, stock: await capStock(ctx, variant) };
}

async function getStockRow(ctx: QueryCtx, variantId: string) {
  return await ctx.db
    .query("variant_stock")
    .withIndex("by_variantId", (q) => q.eq("variantId", variantId))
    .unique();
}

/** A cap's units: its `variant_stock` row, or the legacy field until that row exists. */
async function capStock(ctx: QueryCtx, variant: Doc<"variants">): Promise<number> {
  return (await getStockRow(ctx, variant.variantId))?.stock ?? variant.stock;
}

/** Set a cap's units outright, creating its `variant_stock` row on first write. */
export async function setCapStock(ctx: MutationCtx, variantId: string, stock: number) {
  const row = await getStockRow(ctx, variantId);
  if (row) {
    if (row.stock !== stock) await ctx.db.patch("variant_stock", row._id, { stock });
  } else {
    await ctx.db.insert("variant_stock", { variantId, stock });
  }
}

/** Remove a product's `variant_stock` row (purge, or a cap converted to a tee). */
export async function deleteCapStock(ctx: MutationCtx, variantId: string) {
  const row = await getStockRow(ctx, variantId);
  if (row) await ctx.db.delete("variant_stock", row._id);
}

export async function getSku(ctx: QueryCtx, variantId: string, colorway: string, size: string) {
  return await ctx.db
    .query("skus")
    .withIndex("by_variantId_and_colorway_and_size", (q) =>
      q.eq("variantId", variantId).eq("colorway", colorway).eq("size", size)
    )
    .unique();
}

export async function listSkus(ctx: QueryCtx, variantId: string) {
  return await ctx.db
    .query("skus")
    .withIndex("by_variantId_and_colorway_and_size", (q) => q.eq("variantId", variantId))
    .take(MAX_SKUS_PER_VARIANT);
}

/** `variant` is the stored row (its `stock` is legacy); `available` is the line's live units. */
export type StockCheck =
  | { ok: true; variant: Doc<"variants">; available: number }
  | { ok: false; reason: "not_found" | "unavailable" | "option_required" | "invalid_option"; variant?: Doc<"variants"> };

/**
 * Units available for one line: the SKU's stock for tees, the variant's stock for caps.
 * A tee line must name a colorway and size the tee actually offers. Reads only that line's
 * stock row, so a hold never depends on the tee's other SKUs.
 */
export async function checkStock(ctx: QueryCtx, line: StockLine): Promise<StockCheck> {
  const variant = await getVariantRow(ctx, line.variantId);
  if (!variant) return { ok: false, reason: "not_found" };
  if (!isCustomerVisible(variant, await getCategoryLaunches(ctx))) return { ok: false, reason: "unavailable", variant };
  if (!hasSkus(variant)) return { ok: true, variant, available: Math.max(0, await capStock(ctx, variant)) };

  if (!line.colorway || !line.size) return { ok: false, reason: "option_required", variant };
  const offered =
    variant.colorways!.some((c) => c.id === line.colorway) && variant.sizes!.includes(line.size);
  if (!offered) return { ok: false, reason: "invalid_option", variant };

  const sku = await getSku(ctx, variant.variantId, line.colorway, line.size);
  return { ok: true, variant, available: Math.max(0, sku?.stock ?? 0) };
}

/**
 * Apply a stock delta for one line: negative deducts or reserves (never below zero),
 * positive releases or restocks. Lines whose variant is gone are ignored.
 *
 * Tee lines recorded before SKUs existed carry no colorway/size; their units cannot be
 * attributed to a SKU, so a release logs a warning and leaves stock for an Administrator.
 */
export async function adjustStock(ctx: MutationCtx, line: StockLine, delta: number) {
  if (delta === 0) return;
  const variant = await getVariantRow(ctx, line.variantId);
  if (!variant) return;

  if (!hasSkus(variant)) {
    await setCapStock(ctx, variant.variantId, Math.max(0, (await capStock(ctx, variant)) + delta));
    return;
  }

  if (!line.colorway || !line.size) {
    console.warn(
      `adjustStock: tee line ${line.variantId} has no colorway/size (pre-SKU order); ${delta > 0 ? "release" : "deduction"} of ${Math.abs(delta)} skipped — reconcile manually.`
    );
    return;
  }

  const sku = await getSku(ctx, variant.variantId, line.colorway, line.size);
  if (sku) {
    await ctx.db.patch("skus", sku._id, { stock: Math.max(0, sku.stock + delta) });
  } else if (delta > 0) {
    await ctx.db.insert("skus", { variantId: variant.variantId, colorway: line.colorway, size: line.size, stock: delta });
  } else {
    // Sold without a SKU row (e.g. a colorway added without stock rows): nothing to deduct from.
    console.warn(
      `adjustStock: no SKU ${line.variantId} ${line.colorway}/${line.size}; deduction of ${Math.abs(delta)} not recorded — reconcile manually.`
    );
  }
}

/** Set one SKU's stock outright (admin edit). */
export async function setSkuStock(
  ctx: MutationCtx,
  variant: Doc<"variants">,
  colorway: string,
  size: string,
  stock: number
): Promise<{ previous: number; next: number }> {
  const sku = await getSku(ctx, variant.variantId, colorway, size);
  const previous = sku?.stock ?? 0;
  const next = Math.max(0, Math.floor(stock));
  if (sku) await ctx.db.patch("skus", sku._id, { stock: next });
  else await ctx.db.insert("skus", { variantId: variant.variantId, colorway, size, stock: next });
  return { previous, next };
}
