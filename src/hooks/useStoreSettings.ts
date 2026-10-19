"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { DEFAULT_SHIPPING_SETTINGS, type ShippingSettings } from "@convex/settings/model";

/**
 * The live shipping rules for display. Checkout re-derives them on the server, so this is
 * only what the customer sees; it falls back to the defaults while the query loads.
 */
export function useStoreSettings(): ShippingSettings {
  return useQuery(api.settings.functions.getStoreSettings) ?? DEFAULT_SHIPPING_SETTINGS;
}
