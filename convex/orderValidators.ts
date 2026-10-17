/** Argument validators shared by the order modules. */
import { v } from "convex/values";

export const shippingAddressValidator = v.object({
  line1: v.string(),
  line2: v.optional(v.string()),
  city: v.string(),
  state: v.string(),
  postalCode: v.string(),
  country: v.string(),
});

export const orderItemValidator = v.object({
  variantId: v.string(),
  name: v.string(),
  quantity: v.number(),
  price: v.number(),
  image: v.string(),
  colorway: v.optional(v.string()),
  size: v.optional(v.string()),
});

export const orderStatusValidator = v.union(
  v.literal("pending"),
  v.literal("paid"),
  v.literal("dispatched"),
  v.literal("delivered"),
  v.literal("cancelled"),
  v.literal("whatsapp_initiated"),
  v.literal("refunded"),
  v.literal("partially_refunded")
);
