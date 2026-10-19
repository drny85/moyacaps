/**
 * Storefront side of Category Status (ADR 0022), pure and tested. The Shop speaks in
 * `caps`/`tees`; Convex stores `headwear`/`apparel`.
 */
import type { Category } from "@convex/catalog/rules";
import type { CategoryLaunch, CategoryLaunches, CategoryStatus } from "@convex/settings/launch";
import { SHOP_CATEGORIES, type ShopCategory } from "./shopRoutes";

export type { CategoryLaunch, CategoryLaunches, CategoryStatus };

export const SHOP_TO_CATEGORY: Record<ShopCategory, Category> = { caps: "headwear", tees: "apparel" };

/** Every category Live: what the storefront assumes before Convex answers, and what a missing row means. */
export const ALL_LIVE: CategoryLaunches = { headwear: { status: "live" }, apparel: { status: "live" } };

export function statusFor(launches: CategoryLaunches, shop: ShopCategory): CategoryStatus {
  return launches[SHOP_TO_CATEGORY[shop]].status;
}

export function liveShopCategories(launches: CategoryLaunches): ShopCategory[] {
  return SHOP_CATEGORIES.filter((c) => statusFor(launches, c) === "live");
}

export function teaserShopCategories(launches: CategoryLaunches): ShopCategory[] {
  return SHOP_CATEGORIES.filter((c) => statusFor(launches, c) === "coming_soon");
}

/** The Administrator's headline for this locale, or the default copy. */
export function teaserHeadline(launch: CategoryLaunch, locale: "en" | "es", fallback: string): string {
  const custom = (locale === "es" ? launch.headlineEs : launch.headlineEn)?.trim();
  return custom || fallback;
}
