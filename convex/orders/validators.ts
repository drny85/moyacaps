/** Argument and return validators shared by the order modules. */
import { v } from "convex/values";
import schema from "../schema";
import { handoffMethodValidator } from "./labels";

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


// ── Return validators ────────────────────────────────────────────────────────

export const orderDoc = schema.doc("orders");

export const successResult = v.object({ success: v.boolean() });

const publicItem = v.object({
  variantId: v.string(),
  name: v.string(),
  quantity: v.number(),
  price: v.number(),
  image: v.string(),
});

/** Fields every customer-facing order view shares (orders/model.ts projections). */
const viewFields = orderDoc.pick(
  "_id",
  "orderNumber",
  "paymentStatus",
  "fulfillmentStatus",
  "cancelledAt",
  "carrier",
  "trackingNumber",
  "trackingStatus",
  "trackingStatusDetails",
  "trackingStatusDate",
  "trackingLocation",
  "createdAt",
  "updatedAt",
  "currency",
  "customerName",
  "subtotal",
  "shippingFee",
  "tax",
  "taxDetails",
  "total",
  "paymentMethod",
  "invoicePdfUrl",
  "hostedInvoiceUrl"
).extend({
  // The current label's Handoff as the Customer sees it: no note, no actor (ADR 0030).
  handoff: v.optional(v.object({ method: handoffMethodValidator, at: v.number() })),
});

/** orderModel.confirmationView */
export const confirmationViewValidator = viewFields.extend({
  items: v.array(publicItem),
  shippingAddress: v.optional(shippingAddressValidator),
  customerPhone: v.optional(v.string()),
  isGuestView: v.boolean(),
});

const reservationFields = orderDoc.pick("paymentUrl", "paymentLinkSentAt", "reservationExpiresAt").fields;

/** orderModel.guestTrackingView */
export const guestTrackingViewValidator = viewFields.extend({
  ...reservationFields,
  items: v.array(publicItem),
  shippingAddress: v.optional(shippingAddressValidator),
  customerEmail: v.optional(v.string()),
  customerPhone: v.optional(v.string()),
  isGuestView: v.boolean(),
});

/** orderModel.ownerTrackingView */
export const ownerTrackingViewValidator = viewFields.extend({
  ...reservationFields,
  items: v.array(orderItemValidator),
  shippingAddress: v.optional(shippingAddressValidator),
  customerEmail: v.optional(v.string()),
  customerPhone: v.optional(v.string()),
  isGuestView: v.boolean(),
});
