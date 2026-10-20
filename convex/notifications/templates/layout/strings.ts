/**
 * Text that belongs to the shared layout (signature, links), in English and Spanish. Template
 * bodies own their own copy; this file only covers what every email shares.
 */
import type { EmailLocale } from "./brand";

export type LayoutStrings = {
  shop: string;
  trackOrder: string;
  questions: string;
  policy: string;
  adminFooter: string;
  unsubscribe: string;
  unsubscribeReason: string;
};

const en: LayoutStrings = {
  shop: "Shop",
  trackOrder: "Track order",
  questions: "Questions? Reply to this email or write to",
  policy: "Standard shipping 2–5 business days · 30-day returns for unworn items",
  adminFooter: "Good Luck store operations · internal alert, do not forward to customers",
  unsubscribe: "Unsubscribe",
  unsubscribeReason: "You are receiving this because you asked to be notified by Good Luck.",
};

const es: LayoutStrings = {
  shop: "Tienda",
  trackOrder: "Rastrear pedido",
  questions: "¿Preguntas? Responde a este correo o escribe a",
  policy: "Envío estándar de 2 a 5 días hábiles · devoluciones en 30 días sin usar",
  adminFooter: "Operaciones de la tienda Good Luck · alerta interna, no reenviar a clientes",
  unsubscribe: "Darse de baja",
  unsubscribeReason: "Recibes este correo porque pediste que Good Luck te avisara.",
};

export function layoutStrings(locale: EmailLocale = "en"): LayoutStrings {
  return locale === "es" ? es : en;
}
