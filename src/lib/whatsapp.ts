/**
 * WhatsApp support-chat links for Good Luck Caps. WhatsApp never takes orders or payments
 * (ADR 0023); these only open a conversation with the store or a customer.
 */

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
  size?: string;
  colorway?: string;
  silhouette?: string;
}

export function getWhatsAppInquiryUrl({
  name,
  quantity,
  priceSingle,
  currency = "USD",
  isDrop = false,
  locale = "en",
  size,
  colorway,
  silhouette,
}: ProductInquiryParams): string {
  const phone = supportPhone();
  const isTee = silhouette === "tee" || name.toLowerCase().includes("tee") || name.toLowerCase().includes("playera");
  const itemTypeEs = isTee ? "playera" : "gorra";
  const sizeNoteEn = size ? ` (Size: ${size})` : "";
  const sizeNoteEs = size ? ` (Talla: ${size})` : "";
  const colorNoteEn = colorway ? ` • Color: ${colorway}` : "";
  const colorNoteEs = colorway ? ` • Color: ${colorway}` : "";

  let text: string;
  if (isDrop) {
    text =
      locale === "es"
        ? `¡Hola Good Luck! Deseo información y apartar mi acceso prioritario para el drop de la ${itemTypeEs}: ${name}${sizeNoteEs}${colorNoteEs} (Edición 0880). ¿Me podrían compartir más detalles? (Envío a EE.UU.)`
        : `Hi Good Luck! I would like priority access and info regarding the upcoming drop of: ${name}${sizeNoteEn}${colorNoteEn} (0880 Edition). Please share details. (US Shipping)`;
  } else {
    const totalEstimate = priceSingle ? ` - $${priceSingle * quantity} ${currency}` : "";
    text =
      locale === "es"
        ? `¡Hola Good Luck! Deseo ordenar ${quantity} pieza(s) de la ${itemTypeEs} ${name}${sizeNoteEs}${colorNoteEs} (Edición 0880${totalEstimate}). ¿Me podrían compartir los datos de pago y envío en EE.UU.?`
        : `Hi Good Luck! I would like to order ${quantity} piece(s) of ${name}${sizeNoteEn}${colorNoteEn} (0880 Edition${totalEstimate}). Please share payment and US delivery details.`;
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

/**
 * Builds Admin to Customer WhatsApp URL for tracking and general updates.
 */
export function getWhatsAppAdminCustomerUrl({
  customerPhone,
  customerName,
  orderNumber,
  trackingNumber,
  carrier = "USPS",
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
      : ` Your US tracking number is: ${trackingNumber} (${carrier}).`
    : "";

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(greeting + trackingText)}`;
}
