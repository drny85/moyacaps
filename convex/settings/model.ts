import type { QueryCtx } from "../_generated/server";
import type { FieldError } from "../catalog/rules";

export type ShippingSettings = {
  flatShippingFeeUsd: number;
  freeShippingThresholdUnits: number;
};

export const DEFAULT_SHIPPING_SETTINGS: ShippingSettings = {
  flatShippingFeeUsd: 8,
  freeShippingThresholdUnits: 2,
};

function hasAtMostTwoDecimals(n: number): boolean {
  return Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
}

export function validateShippingSettings(s: ShippingSettings): FieldError[] {
  const errors: FieldError[] = [];
  const fee = s.flatShippingFeeUsd;
  if (!Number.isFinite(fee) || fee < 0 || fee > 100 || !hasAtMostTwoDecimals(fee)) {
    errors.push({ field: "flatShippingFeeUsd", code: "range" });
  }
  const threshold = s.freeShippingThresholdUnits;
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 50) {
    errors.push({ field: "freeShippingThresholdUnits", code: "range" });
  }
  return errors;
}

/** The stored shipping rules, or the defaults when an Administrator has never saved any. */
export async function getShippingSettings(ctx: Pick<QueryCtx, "db">): Promise<ShippingSettings> {
  const row = await ctx.db
    .query("store_settings")
    .withIndex("by_key", (q) => q.eq("key", "default"))
    .unique();
  if (!row) return DEFAULT_SHIPPING_SETTINGS;
  return {
    flatShippingFeeUsd: row.flatShippingFeeUsd,
    freeShippingThresholdUnits: row.freeShippingThresholdUnits,
  };
}
