/**
 * Category Status (ADR 0022): whether Caps and Tees are Live, Coming Soon (teaser only) or
 * Hidden. Stored on the single `store_settings` row; a missing value means Live.
 */
import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Category, FieldError } from "../catalog/rules";

export type CategoryStatus = "live" | "coming_soon" | "hidden";

export type CategoryLaunch = {
  status: CategoryStatus;
  launchAt?: number;
  headlineEn?: string;
  headlineEs?: string;
};

export type CategoryLaunches = Record<Category, CategoryLaunch>;

export const DEFAULT_CATEGORY_LAUNCHES: CategoryLaunches = {
  headwear: { status: "live" },
  apparel: { status: "live" },
};

export const HEADLINE_MAX = 80;
const DAY_MS = 24 * 60 * 60 * 1000;
export const LAUNCH_MAX_AHEAD_MS = 365 * DAY_MS;

export const categoryValidator = v.union(v.literal("headwear"), v.literal("apparel"));
export const categoryStatusValidator = v.union(v.literal("live"), v.literal("coming_soon"), v.literal("hidden"));

/** What the storefront reads. */
export const categoryLaunchValidator = v.object({
  status: categoryStatusValidator,
  launchAt: v.optional(v.number()),
  headlineEn: v.optional(v.string()),
  headlineEs: v.optional(v.string()),
});

/** What is stored: the storefront fields plus the pending go-live job. */
export const storedCategoryLaunchValidator = categoryLaunchValidator.extend({
  launchJobId: v.optional(v.id("_scheduled_functions")),
});

export const categoryLaunchesValidator = v.object({
  headwear: categoryLaunchValidator,
  apparel: categoryLaunchValidator,
});

export function validateCategoryLaunch(input: CategoryLaunch, now: number): FieldError[] {
  const errors: FieldError[] = [];
  if (input.launchAt !== undefined) {
    if (input.status !== "coming_soon") {
      errors.push({ field: "launchAt", code: "mismatch" });
    } else if (!Number.isFinite(input.launchAt) || input.launchAt <= now || input.launchAt > now + LAUNCH_MAX_AHEAD_MS) {
      errors.push({ field: "launchAt", code: "range" });
    }
  }
  for (const field of ["headlineEn", "headlineEs"] as const) {
    if ((input[field]?.trim().length ?? 0) > HEADLINE_MAX) errors.push({ field, code: "too_long" });
  }
  return errors;
}

/** Trimmed headlines, with empty ones dropped so the default copy shows. */
export function normalizeCategoryLaunch(input: CategoryLaunch): CategoryLaunch {
  const out: CategoryLaunch = { status: input.status };
  if (input.launchAt !== undefined) out.launchAt = input.launchAt;
  const en = input.headlineEn?.trim();
  const es = input.headlineEs?.trim();
  if (en) out.headlineEn = en;
  if (es) out.headlineEs = es;
  return out;
}

function publicLaunch({ status, launchAt, headlineEn, headlineEs }: CategoryLaunch): CategoryLaunch {
  return normalizeCategoryLaunch({ status, launchAt, headlineEn, headlineEs });
}

export async function getSettingsRow(ctx: Pick<QueryCtx, "db">) {
  return await ctx.db
    .query("store_settings")
    .withIndex("by_key", (q) => q.eq("key", "default"))
    .unique();
}

/** Each category's status for the storefront; pending job ids are never included. */
export async function getCategoryLaunches(ctx: Pick<QueryCtx, "db">): Promise<CategoryLaunches> {
  const stored = (await getSettingsRow(ctx))?.categoryLaunch;
  if (!stored) return DEFAULT_CATEGORY_LAUNCHES;
  return { headwear: publicLaunch(stored.headwear), apparel: publicLaunch(stored.apparel) };
}
