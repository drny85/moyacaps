/**
 * Centralized WhatsApp Configuration and URL generators for Good Luck Caps.
 * Enforces US domestic shipping messaging and 24-hour inventory reservation notices.
 */

export const WHATSAPP_CONFIG = {
  // Configurable via environment variable; defaults to US domestic support number
  defaultPhone: (process.env.NEXT_PUBLIC_WHATSAPP_PHONE || "13055550880").replace(/\D/g, ""),
  reservationHoldHours: 24,
  country: "US",
  shippingNoticeEn: "Domestic US shipping only (2-4 business days express).",
  shippingNoticeEs: "Envíos únicamente dentro de EE.UU. (2-4 días hábiles express).",
};

export function getCleanWhatsAppNumber(phone?: string): string {
  if (!phone) return WHATSAPP_CONFIG.defaultPhone;
  const cleaned = phone.replace(/\D/g, "");
  return cleaned || WHATSAPP_CONFIG.defaultPhone;
}

/**
 * Builds standard concierge support URL for floating bars, footer, and general inquiries.
 */
export function getWhatsAppConciergeUrl(locale = "en", customText?: string): string {
  const phone = WHATSAPP_CONFIG.defaultPhone;
  const text =
    customText ||
    (locale === "es"
      ? "¡Hola Good Luck! Quisiera asistencia del Concierge sobre las gorras de la Colección 0880 y envíos en EE.UU."
      : "Hi Good Luck! I'd like Concierge styling assistance regarding the 0880 Collection and US shipping.");

  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

/**
 * Builds order tracking inquiry URL.
 */
export function getWhatsAppTrackingUrl(orderNumber: string, locale = "en"): string {
  const phone = WHATSAPP_CONFIG.defaultPhone;
  const greeting =
    locale === "es"
      ? `¡Hola Good Luck! Necesito asistencia con el seguimiento de mi pedido #${orderNumber}.`
      : `Hi Good Luck! I need assistance tracking my order #${orderNumber}.`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(greeting)}`;
}

/**
 * Builds single product inquiry URL (Product Detail View & Quick View).
 */
export interface ProductInquiryParams {
  name: string;
  quantity: number;
  priceSingle?: number;
  currency?: string;
  isDrop?: boolean;
  locale?: string;
}

export function getWhatsAppInquiryUrl({
  name,
  quantity,
  priceSingle,
  currency = "USD",
  isDrop = false,
  locale = "en",
}: ProductInquiryParams): string {
  const phone = WHATSAPP_CONFIG.defaultPhone;

  let text: string;
  if (isDrop) {
    text =
      locale === "es"
        ? `¡Hola Good Luck! Deseo información y apartar mi acceso prioritario para el drop de la gorra: ${name} (Edición 0880). ¿Me podrían compartir más detalles? (Envío a EE.UU.)`
        : `Hi Good Luck! I would like priority access and info regarding the upcoming drop of: ${name} (0880 Edition). Please share details. (US Shipping)`;
  } else {
    const totalEstimate = priceSingle ? ` - $${priceSingle * quantity} ${currency}` : "";
    text =
      locale === "es"
        ? `¡Hola Good Luck! Deseo ordenar ${quantity} pieza(s) de la gorra ${name} (Edición 0880${totalEstimate}). ¿Me podrían compartir los datos de pago y envío en EE.UU.?`
        : `Hi Good Luck! I would like to order ${quantity} piece(s) of ${name} (0880 Edition${totalEstimate}). Please share payment and US delivery details.`;
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

/**
 * Builds itemized WhatsApp checkout order URL.
 */
export interface WhatsAppOrderLeadParams {
  orderNumber: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
  shippingFee: number;
  total: number;
  currency?: string;
  customerName?: string;
  customerPhone?: string;
  shippingAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  locale?: string;
}

export function getWhatsAppOrderUrl({
  orderNumber,
  items,
  subtotal,
  shippingFee,
  total,
  currency = "USD",
  customerName,
  customerPhone,
  shippingAddress,
  locale = "en",
}: WhatsAppOrderLeadParams): string {
  const phone = WHATSAPP_CONFIG.defaultPhone;
  const isEs = locale === "es";

  const lines: string[] = [];

  if (isEs) {
    lines.push(`🔥 *PEDIDO GOOD LUCK 0880: #${orderNumber}*`);
    lines.push(`Hola Good Luck, deseo confirmar mi pedido reservado:`);
    lines.push("");
    lines.push("*Artículos:*");
  } else {
    lines.push(`🔥 *GOOD LUCK 0880 ORDER: #${orderNumber}*`);
    lines.push(`Hi Good Luck, I'd like to complete payment for my reserved order:`);
    lines.push("");
    lines.push("*Items:*");
  }

  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.name} (${item.quantity}x) — $${item.price} ${currency} c/u`);
  });

  lines.push("");
  lines.push(`Subtotal: $${subtotal}.00 ${currency}`);
  lines.push(`Shipping (US Domestic): ${shippingFee === 0 ? (isEs ? "GRATIS" : "FREE") : `$${shippingFee}.00 ${currency}`}`);
  lines.push(`*Total: $${total}.00 ${currency}*`);
  lines.push("");

  if (customerName || customerPhone || shippingAddress) {
    lines.push(isEs ? "*Datos de Envío (EE.UU.):*" : "*US Shipping Destination:*");
    if (customerName) lines.push(`${isEs ? "Nombre" : "Name"}: ${customerName}`);
    if (customerPhone) lines.push(`${isEs ? "Teléfono" : "Phone"}: ${customerPhone}`);
    if (shippingAddress) {
      const parts = [
        shippingAddress.line1,
        shippingAddress.line2,
        shippingAddress.city,
        shippingAddress.state,
        shippingAddress.postalCode,
        "US",
      ].filter(Boolean);
      lines.push(`${isEs ? "Dirección" : "Address"}: ${parts.join(", ")}`);
    }
    lines.push("");
  }

  if (isEs) {
    lines.push(`⏱️ *Inventario apartado por 24 horas.*`);
    lines.push(`Envíos exclusivamente dentro de Estados Unidos.`);
    lines.push(`Por favor facilítenme las opciones de pago (Zelle, tarjeta o transferencia) para liberar el despacho. ¡Gracias!`);
  } else {
    lines.push(`⏱️ *Inventory reserved for 24 hours.*`);
    lines.push(`Shipping exclusively within the United States.`);
    lines.push(`Please provide payment instructions (Zelle, card, or transfer) to dispatch my package. Thank you!`);
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
}

/**
 * Builds Admin to Customer WhatsApp URL.
 */
export function getWhatsAppAdminCustomerUrl({
  customerPhone,
  customerName,
  orderNumber,
  trackingNumber,
  carrier = "USPS Express",
  locale = "en",
}: {
  customerPhone?: string;
  customerName?: string;
  orderNumber: string;
  trackingNumber?: string;
  carrier?: string;
  locale?: string;
}): string {
  const cleanPhone = getCleanWhatsAppNumber(customerPhone);
  const isEs = locale === "es";

  const greeting = isEs
    ? `¡Hola ${customerName || "estimado cliente"}! Te contactamos de Good Luck respecto a tu orden #${orderNumber}.`
    : `Hi ${customerName || "Customer"}, this is Good Luck regarding your order #${orderNumber}.`;

  const trackingText = trackingNumber
    ? isEs
      ? ` Tu número de guía para envío dentro de EE.UU. es: ${trackingNumber} (${carrier}).`
      : ` Your express US domestic tracking code is: ${trackingNumber} (${carrier}).`
    : "";

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(greeting + trackingText)}`;
}
