import type { ShippingAddressValues } from "@/lib/validations/address";

/** Which line the account Order card shows under its items, from the order's state. */
export type OrderActionNote = "cancellable" | "shipped" | "awaitingDispatch" | "finalized";

export function orderActionNote(flags: {
  isCancellable: boolean;
  isShipped: boolean;
  canEditAddress: boolean;
}): OrderActionNote {
  if (flags.isCancellable) return "cancellable";
  if (flags.isShipped) return "shipped";
  if (flags.canEditAddress) return "awaitingDispatch";
  return "finalized";
}

type AddressSource = {
  shippingAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  customerPhone?: string;
};

/** The address form's starting values for an Order: what it ships to now, US by default. */
export function addressFormDefaults(order: AddressSource): ShippingAddressValues {
  return {
    line1: order.shippingAddress?.line1 || "",
    line2: order.shippingAddress?.line2 || "",
    city: order.shippingAddress?.city || "",
    state: order.shippingAddress?.state || "",
    postalCode: order.shippingAddress?.postalCode || "",
    customerPhone: order.customerPhone || "",
    country: order.shippingAddress?.country || "US",
  };
}

/** WhatsApp text a customer sends the concierge about one Order. */
export function conciergeMessage(locale: string, orderNumber: string, actionType: "return" | "support"): string {
  return locale === "es"
    ? `¡Hola Good Luck Concierge! Necesito asistencia con mi orden #${orderNumber} (${actionType === "return" ? "Cambio/Devolución" : "Rastreo/Envío"}).`
    : `Hi Good Luck Concierge! I need assistance with my Order #${orderNumber} (${actionType === "return" ? "Exchange/Return" : "Tracking/Delivery"}).`;
}
