/** Pure rules behind the admin Category Status controls (ADR 0022). */
import type { CategoryStatus } from "@convex/settings/launch";
import type { Category } from "@convex/catalog/rules";
import { getCleanWhatsAppNumber } from "../whatsapp";

/** Leaving Live removes products from the store, so it goes through a confirmation. */
export function needsLaunchConfirm(before: CategoryStatus, after: CategoryStatus): boolean {
  return before === "live" && after !== "live";
}

type ListedRow = { category?: string; silhouette: string; isAvailable: boolean; archivedAt?: number };

/** Products a Customer would lose if this category stopped being Live. */
export function listedCount(rows: ListedRow[], category: Category): number {
  return rows.filter((row) => {
    const rowCategory = row.category ?? (row.silhouette === "tee" ? "apparel" : "headwear");
    return rowCategory === category && row.isAvailable && row.archivedAt === undefined;
  }).length;
}

/** Click-to-chat link for telling a WhatsApp subscriber the category is live. */
export function launchChatUrl(contact: string, text: string): string {
  return `https://wa.me/${getCleanWhatsAppNumber(contact)}?text=${encodeURIComponent(text)}`;
}

/** The WhatsApp launch message, in the subscriber's language, linking to the category in the shop. */
export function launchWhatsAppText(locale: "en" | "es", category: Category, siteUrl: string): string {
  const shop = category === "apparel" ? "tees" : "caps";
  const url = `${siteUrl.replace(/\/$/, "")}/${locale}/products?category=${shop}`;
  return locale === "es"
    ? `¡Hola! Te escribimos de Good Luck. Ya salieron las ${category === "apparel" ? "playeras" : "gorras"} que esperabas: ${url}`
    : `Hi! Good Luck here. The ${shop} you asked about just dropped: ${url}`;
}
