/**
 * Centralized WhatsApp Configuration and URL generators for Good Luck Caps.
 * Enforces US domestic shipping messaging and 24-hour inventory reservation notices.
 */

const DEFAULT_RESERVATION_HOLD_HOURS = 24;

function resolveSupportPhone(): string {
  const raw = (process.env.NEXT_PUBLIC_WHATSAPP_PHONE || "").replace(/\D/g, "");
  if (!raw) {
    // Fail closed in production: never silently point customers at a placeholder number.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "NEXT_PUBLIC_WHATSAPP_PHONE is not configured. Set it in the deployment environment."
      );
    }
    console.warn("[whatsapp] NEXT_PUBLIC_WHATSAPP_PHONE not set; using dev placeholder number.");
    return "13055550880";
  }
  return raw;
}

let cachedPhone: string | undefined;
function supportPhone(): string {
  if (!cachedPhone) cachedPhone = resolveSupportPhone();
  return cachedPhone;
}

/** Formats a money amount honestly (no hardcoded ".00" string math). */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export const WHATSAPP_CONFIG = {
  get defaultPhone(): string {
    return supportPhone();
  },
  reservationHoldHours: DEFAULT_RESERVATION_HOLD_HOURS,
  country: "US",
  shippingNoticeEn: "Domestic US shipping only (2-4 business days express).",
  shippingNoticeEs: "Envíos únicamente dentro de EE.UU. (2-4 días hábiles express).",
};

/**
 * Normalizes any customer-provided phone to digits-only for wa.me URLs.
 */
export function getCleanWhatsAppNumber(phone?: string): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

/**
 * Builds standard concierge support URL for floating bars, footer, and general inquiries.
 */
export function getWhatsAppConciergeUrl(locale = "en", customText?: string): string {
  const phone = supportPhone();
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
  const phone = supportPhone();
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
  customerEmail?: string;
  shippingAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  paymentUrl?: string | null;
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
  customerEmail,
  shippingAddress,
  paymentUrl,
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
    lines.push(`${index + 1}. ${item.name} (${item.quantity}x) — ${formatUsd(item.price)} ${currency} c/u`);
  });

  lines.push("");
  lines.push(`Subtotal: ${formatUsd(subtotal)} ${currency}`);
  lines.push(`Shipping (US Domestic): ${shippingFee === 0 ? (isEs ? "GRATIS" : "FREE") : `${formatUsd(shippingFee)} ${currency}`}`);
  lines.push(`*Total: ${formatUsd(total)} ${currency}* (antes de impuestos / before tax)`);
  lines.push("");

  if (customerName || customerPhone || customerEmail || shippingAddress) {
    lines.push(isEs ? "*Datos de Contacto y Entrega:*" : "*Contact & US Delivery Details:*");
    if (customerName) lines.push(`${isEs ? "Nombre" : "Name"}: ${customerName}`);
    if (customerEmail) lines.push(`Email: ${customerEmail}`);
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
    } else {
      lines.push(
        isEs
          ? "Dirección: Se ingresará de forma segura en el enlace de pago oficial (Envíos a todo EE.UU.)"
          : "Address: To be provided securely on the official checkout payment link (US Domestic)"
      );
    }
    lines.push("");
  }

  if (isEs) {
    lines.push(`⏱️ *Inventario apartado por 24 horas.*`);
    lines.push(`Envíos exclusivamente dentro de Estados Unidos.`);
    lines.push(`Por favor revisen mi pedido y compártanme el enlace de pago seguro (Tarjeta / Apple Pay o Zelle) para finalizar mi compra. ¡Gracias!`);
  } else {
    lines.push(`⏱️ *Inventory reserved for 24 hours.*`);
    lines.push(`Shipping exclusively within the United States.`);
    lines.push(`Please review my order and share the secure payment link (Card / Apple Pay or Zelle) so I can complete my purchase. Thank you!`);
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
}

/**
 * Builds Admin to Customer payment link dispatch message & URL.
 */
export interface AdminPaymentLinkParams {
  customerPhone?: string;
  customerName?: string;
  orderNumber: string;
  paymentUrl: string;
  total: number;
  currency?: string;
  locale?: string;
}

export function getWhatsAppAdminPaymentLinkMessage({
  customerName,
  orderNumber,
  paymentUrl,
  total,
  currency = "USD",
  locale = "en",
}: Omit<AdminPaymentLinkParams, "customerPhone">): string {
  const isEs = locale === "es";
  const name = customerName || (isEs ? "estimado cliente" : "there");

  if (isEs) {
    return [
      `¡Hola ${name}! 👋`,
      `Hemos revisado y aprobado tu pedido *#${orderNumber}* de Good Luck (Colección 0880) para entrega en EE.UU.`,
      "",
      `*Total a pagar:* ${formatUsd(total)} ${currency} (los impuestos se calculan en el enlace de pago)`,
      "",
      `💳 *Paga de forma segura aquí (Tarjeta / Apple Pay):*`,
      paymentUrl,
      "",
      `_O si prefieres pagar por Zelle / transferencia bancaria, responde a este mensaje para darte los datos._`,
      "",
      `⏱️ *Tus gorras están apartadas por 24 horas.* ¡Quedamos listos para despachar tu paquete!`,
    ].join("\n");
  }

  return [
    `Hi ${name}! 👋`,
    `We've reviewed and approved your order *#${orderNumber}* from Good Luck (0880 Collection) for US delivery.`,
    "",
    `*Total Due:* ${formatUsd(total)} ${currency} (sales tax is calculated securely at checkout)`,
    "",
    `💳 *Complete your purchase securely here (Card / Apple Pay):*`,
    paymentUrl,
    "",
    `_Or if you prefer to pay via Zelle / bank transfer, reply to this message for details._`,
    "",
    `⏱️ *Your caps are reserved for 24 hours.* We're ready to dispatch your express delivery!`,
  ].join("\n");
}

/**
 * Returns the wa.me deep link to the CUSTOMER's number, or null when the lead has no phone —
 * the caller must then ask the admin to reply inside the concierge thread instead of opening
 * a chat with the store's own number (which is what the old fallback did).
 */
export function getWhatsAppAdminPaymentLinkUrl(
  params: AdminPaymentLinkParams
): { url: string | null; message: string } {
  const cleanPhone = getCleanWhatsAppNumber(params.customerPhone);
  const message = getWhatsAppAdminPaymentLinkMessage(params);
  if (!cleanPhone) {
    return { url: null, message };
  }
  return { url: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, message };
}

/**
 * Builds Admin to Customer WhatsApp URL for tracking and general updates.
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
