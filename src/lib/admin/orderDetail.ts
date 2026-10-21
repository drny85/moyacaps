/**
 * Order detail view model (plan 0009 D13, D13a): the page's sections as plain data, with
 * each line joined to its Product so the person packing sees the right Catalog Shot.
 */
import { canEditShippingAddress, isCancelled } from "../../../convex/orders/status";
import type { FulfillmentStatus, PaymentStatus } from "../../../convex/orders/status";
import { carrierTrackingNumber } from "../../../convex/orders/trackingNumber";
import { getCarrierTrackingUrl } from "../tracking";
import { orderAge } from "./orderRow";
import type { OrderAge } from "./orderRow";

export type DetailOrderInput = {
  _id: string;
  orderNumber: string;
  createdAt: number;
  currency?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: { line1: string; line2?: string; city: string; state: string; postalCode: string; country: string };
  items: Array<{ variantId: string; name: string; quantity: number; price: number; image: string; colorway?: string; size?: string }>;
  subtotal?: number;
  shippingFee?: number;
  tax?: number;
  taxDetails?: { rate?: number };
  total: number;
  refundedAmount?: number;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  cancelledAt?: number;
  disputed?: boolean;
  stripeSessionId?: string;
  paymentMethod: string;
  carrier?: string;
  trackingNumber?: string;
  shippingLabelUrl?: string;
  adminNotes?: string;
  manualStatusOverride?: boolean;
};

export type PackingProductInput = {
  variantId: string;
  nameEn: string;
  nameEs: string;
  category?: string;
  image: string;
  catalogShot?: string;
  /** Lifestyle Shots, after the productImages overlay. */
  images?: string[];
  colorways?: Array<{ id: string; nameEn: string; nameEs: string; catalogShot: string; lifestyleImage: string }>;
};

export type PackingLine = {
  key: string;
  name: string;
  slug: string;
  quantity: number;
  image: string;
  lifestyleImage?: string;
  colorway?: string;
  size?: string;
  /** No Product row any more: the order's own stored name and image are shown. */
  archived: boolean;
  unitLabel: string;
  lineLabel: string;
};

type Lifecycle = { paymentStatus: PaymentStatus; fulfillmentStatus: FulfillmentStatus; cancelledAt?: number };

export type OrderDetailVM = {
  header: { orderNumber: string; age: OrderAge; lifecycle: Lifecycle; disputed: boolean; cancelled: boolean; placedLabel: string };
  items: PackingLine[];
  itemCount: number;
  money: {
    subtotalLabel?: string;
    shippingLabel?: string | "free";
    taxLabel?: string;
    taxRate?: number;
    refundedLabel?: string;
    totalLabel: string;
    paid: boolean;
  };
  shipTo: { name?: string; email?: string; phone?: string; lines: string[]; editable: boolean; missing: boolean };
  labels: { carrier?: string; trackingNumber?: string; trackingUrl: string | null; labelUrl?: string; manualOverride: boolean };
  notes: string;
  danger: { canCancel: boolean; refundable: boolean };
};

type Locale = "en" | "es";

export function formatMoney(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(amount);
}

function packingLine(item: DetailOrderInput["items"][number], row: PackingProductInput | undefined, locale: Locale): PackingLine {
  const base = {
    key: [item.variantId, item.colorway, item.size].filter(Boolean).join("/"),
    slug: item.variantId,
    quantity: item.quantity,
    size: item.size,
    unitLabel: formatMoney(item.price, locale),
    lineLabel: formatMoney(item.price * item.quantity, locale),
  };
  if (!row) return { ...base, name: item.name, image: item.image, colorway: item.colorway, archived: true };

  const name = locale === "es" ? row.nameEs : row.nameEn;
  if (item.colorway !== undefined) {
    // A tee: its Catalog Shot and Lifestyle Shot belong to the Apparel Colorway.
    const cw = row.colorways?.find((c) => c.id === item.colorway);
    return {
      ...base,
      name,
      image: cw?.catalogShot || cw?.lifestyleImage || item.image,
      lifestyleImage: cw?.lifestyleImage || undefined,
      colorway: cw ? (locale === "es" ? cw.nameEs : cw.nameEn) : item.colorway,
      archived: false,
    };
  }
  return { ...base, name, image: row.catalogShot || row.image || item.image, lifestyleImage: row.images?.[0], archived: false };
}

function addressLines(a: DetailOrderInput["shippingAddress"]): string[] {
  if (!a?.line1) return [];
  return [a.line1, a.line2, `${a.city}, ${a.state} ${a.postalCode}`.trim(), a.country].filter((l): l is string => Boolean(l));
}

export function toOrderDetail(order: DetailOrderInput, products: PackingProductInput[] | undefined, locale: Locale, now: number): OrderDetailVM {
  const rows = new Map((products ?? []).map((p) => [p.variantId, p]));
  const paid = order.paymentStatus !== "awaiting_payment";
  const trackingNumber = carrierTrackingNumber(order);
  return {
    header: {
      orderNumber: order.orderNumber,
      age: orderAge(order.createdAt, now),
      lifecycle: { paymentStatus: order.paymentStatus, fulfillmentStatus: order.fulfillmentStatus, cancelledAt: order.cancelledAt },
      disputed: order.disputed === true || order.paymentStatus === "disputed",
      cancelled: isCancelled(order),
      placedLabel: new Date(order.createdAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }),
    },
    items: order.items.map((item) => packingLine(item, rows.get(item.variantId), locale)),
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    money: {
      subtotalLabel: order.subtotal === undefined ? undefined : formatMoney(order.subtotal, locale),
      shippingLabel: order.shippingFee === undefined ? undefined : order.shippingFee === 0 ? "free" : formatMoney(order.shippingFee, locale),
      taxLabel: order.tax !== undefined && order.tax > 0 ? formatMoney(order.tax, locale) : undefined,
      taxRate: order.taxDetails?.rate,
      refundedLabel: order.refundedAmount !== undefined && order.refundedAmount > 0 ? formatMoney(order.refundedAmount, locale) : undefined,
      totalLabel: formatMoney(order.total, locale),
      paid,
    },
    shipTo: {
      name: order.customerName,
      email: order.customerEmail,
      phone: order.customerPhone,
      lines: addressLines(order.shippingAddress),
      editable: canEditShippingAddress(order),
      missing: !order.shippingAddress?.line1,
    },
    labels: {
      carrier: order.carrier,
      trackingNumber,
      trackingUrl: getCarrierTrackingUrl(order.carrier, trackingNumber),
      labelUrl: order.shippingLabelUrl,
      manualOverride: order.manualStatusOverride === true,
    },
    notes: order.adminNotes ?? "",
    danger: {
      canCancel: !isCancelled(order),
      refundable: paid && order.paymentMethod === "stripe" && Boolean(order.stripeSessionId),
    },
  };
}
