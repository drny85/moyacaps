/**
 * Terms & Conditions and Privacy Policy: the shared facts and the order of their sections.
 * The copy lives in src/messages/{en,es}.json under `legal.<doc>.sections.<id>`, each with a
 * `heading`, a `body` of paragraphs and an optional bullet `list`. Messages are precompiled
 * (next.config.mjs), so pages cannot read them raw: this manifest gives the section order and
 * `countItems` finds how many paragraphs or bullets a section has. Pure: covered by legal.test.ts.
 */

/** Mirrors SUPPORT_EMAIL in convex/notifications/orderEmails.ts (legal.test.ts keeps them equal). */
export const SUPPORT_EMAIL = "orders@goodluckcaps.com";

/** The date both pages were last changed, YYYY-MM-DD. Bump it with any change to their copy. */
export const LEGAL_LAST_UPDATED = "2026-10-20";

export type LegalDocument = "terms" | "privacy";

/** Section ids per page, in display order. Every id needs copy in both locales (legal.test.ts). */
export const LEGAL_SECTIONS: Record<LegalDocument, readonly string[]> = {
  terms: [
    "seller",
    "eligibility",
    "orders",
    "pricing",
    "payment",
    "shipping",
    "cancellations",
    "returns",
    "drops",
    "ip",
    "use",
    "liability",
    "law",
    "changes",
    "contact",
  ],
  privacy: [
    "collect",
    "tryOn",
    "use",
    "providers",
    "noSale",
    "marketing",
    "cookies",
    "retention",
    "security",
    "children",
    "rights",
    "changes",
    "contact",
  ],
};

/** "October 20, 2026" / "20 de octubre de 2026". Formatted in UTC so the calendar date never shifts. */
export function formatLastUpdated(locale: string, isoDate: string = LEGAL_LAST_UPDATED): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** How many entries `<prefix>.0`, `<prefix>.1`, … exist, given next-intl's `t.has`. */
export function countItems(has: (key: string) => boolean, prefix: string): number {
  let count = 0;
  while (has(`${prefix}.${count}`)) count += 1;
  return count;
}
