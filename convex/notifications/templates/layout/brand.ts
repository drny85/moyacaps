/**
 * Who the emails come from: the facts printed in every signature. Pure constants, safe to import
 * from templates and tests.
 */
export { BRAND, POLICY_LINE, SUPPORT_EMAIL } from "../../orderEmails";

export const SITE_URL = "https://goodluckcaps.com";

/** Hosted PNG (Gmail does not render SVG). Decorative: the GOOD LUCK wordmark beside it carries the name. */
export const LOGO_URL = `${SITE_URL}/brand/logo-512.png`;

/** Brand red (the storefront's moya-red), used for the wordmark under the logo. */
export const BRAND_RED = "#E11D48";

export type EmailLocale = "en" | "es";
