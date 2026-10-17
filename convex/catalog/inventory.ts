/**
 * Single path for every stock read and write (ADR 0007, ADR 0015).
 *
 * Caps hold stock on their variant row. Heavyweight Tees hold stock per SKU
 * (Graphic Design × Apparel Colorway × size) in the `skus` table, and the tee
 * variant's `stock` is kept equal to the sum of its SKUs so catalog, analytics and
 * low-stock views keep reading one number.
 */
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

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

export async function getVariant(ctx: QueryCtx, variantId: string) {
  return await ctx.db
    .query("variants")
    .withIndex("by_variantId", (q) => q.eq("variantId", variantId))
    .first();
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

export type StockCheck =
  | { ok: true; variant: Doc<"variants">; available: number }
  | { ok: false; reason: "not_found" | "unavailable" | "option_required" | "invalid_option"; variant?: Doc<"variants"> };

/**
 * Units available for one line: the SKU's stock for tees, the variant's stock for caps.
 * A tee line must name a colorway and size the tee actually offers.
 */
export async function checkStock(ctx: QueryCtx, line: StockLine): Promise<StockCheck> {
  const variant = await getVariant(ctx, line.variantId);
  if (!variant) return { ok: false, reason: "not_found" };
  if (variant.isAvailable === false) return { ok: false, reason: "unavailable", variant };
  if (!hasSkus(variant)) return { ok: true, variant, available: Math.max(0, variant.stock) };

  if (!line.colorway || !line.size) return { ok: false, reason: "option_required", variant };
  const offered =
    variant.colorways!.some((c) => c.id === line.colorway) && variant.sizes!.includes(line.size);
  if (!offered) return { ok: false, reason: "invalid_option", variant };

  const sku = await getSku(ctx, variant.variantId, line.colorway, line.size);
  return { ok: true, variant, available: Math.max(0, sku?.stock ?? 0) };
}

/** Re-derive a tee variant's aggregate stock from its SKUs. */
async function syncTeeAggregate(ctx: MutationCtx, variant: Doc<"variants">) {
  const skus = await listSkus(ctx, variant.variantId);
  const total = skus.reduce((sum, s) => sum + s.stock, 0);
  if (total !== variant.stock) await ctx.db.patch("variants", variant._id, { stock: total });
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
  const variant = await getVariant(ctx, line.variantId);
  if (!variant) return;

  if (!hasSkus(variant)) {
    await ctx.db.patch("variants", variant._id, { stock: Math.max(0, variant.stock + delta) });
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
  await syncTeeAggregate(ctx, variant);
}

/** Set one SKU's stock outright (admin edit) and keep the tee aggregate in sync. */
export async function setSkuStock(
  ctx: MutationCtx,
  variant: Doc<"variants">,
  colorway: string,
  size: string,
  stock: number
) {
  const sku = await getSku(ctx, variant.variantId, colorway, size);
  const next = Math.max(0, Math.floor(stock));
  if (sku) await ctx.db.patch("skus", sku._id, { stock: next });
  else await ctx.db.insert("skus", { variantId: variant.variantId, colorway, size, stock: next });
  await syncTeeAggregate(ctx, variant);
}
