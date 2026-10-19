"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useLaunchSeed } from "@/components/providers/CatalogProvider";
import type { CategoryLaunches } from "@/lib/launch";

/**
 * Each category's status (ADR 0022). Starts with what the server rendered (CatalogProvider)
 * and follows the live Convex value, so a launch reaches open tabs within seconds.
 */
export function useCategoryLaunches(): CategoryLaunches {
  const seed = useLaunchSeed();
  return useQuery(api.settings.functions.getStorefrontLaunch, {}) ?? seed;
}
