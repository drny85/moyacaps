/**
 * Parcel suggestion for an order: order lines store only `variantId`, so the
 * category comes from the variant row (catalog/model.ts catalogCategory). The pure
 * rule lives in ./parcels.ts; this file only resolves categories and exposes it.
 */
import { v } from "convex/values";
import { internalQuery, query, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { requireAdmin } from "../lib/auth";
import { getVariant } from "../catalog/inventory";
import { catalogCategory } from "../catalog/model";
import { countParcelLines, suggestParcel, type ParcelLine } from "./parcels";

const parcelLineValidator = v.object({
  category: v.union(v.literal("headwear"), v.literal("apparel")),
  quantity: v.number(),
});

/** One line per order item with its category; an item whose variant is gone ships as a cap. */
export async function resolveParcelLines(ctx: QueryCtx, items: Doc<"orders">["items"]): Promise<ParcelLine[]> {
  const lines: ParcelLine[] = [];
  for (const item of items) {
    const variant = await getVariant(ctx, item.variantId);
    lines.push({ category: variant ? catalogCategory(variant) : "headwear", quantity: item.quantity });
  }
  return lines;
}

export const orderParcelLinesInternal = internalQuery({
  args: { orderId: v.id("orders") },
  returns: v.array(parcelLineValidator),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) return [];
    return await resolveParcelLines(ctx, order.items);
  },
});

/** Admin: the preset the label modal should start from for this order. */
export const suggestParcelForOrder = query({
  args: { orderId: v.id("orders") },
  returns: v.union(
    v.object({ presetId: v.string(), caps: v.number(), tees: v.number() }),
    v.null()
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) return null;
    const lines = await resolveParcelLines(ctx, order.items);
    const { caps, tees } = countParcelLines(lines);
    return { presetId: suggestParcel(lines).id, caps, tees };
  },
});
