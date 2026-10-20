/**
 * Who the emails come from: the facts printed in every signature. Pure constants, safe to import
 * from templates and tests.
 */
export { BRAND, POLICY_LINE, SUPPORT_EMAIL } from "../../orderEmails";

export const SITE_URL = "https://goodluckcaps.com";

/** Hosted PNG (Gmail does not render SVG). Clients that block images show the alt text. */
export const LOGO_URL = `${SITE_URL}/brand/logo-512.png`;
export const LOGO_ALT = "GOOD LUCK";

/** Postal address: required by CAN-SPAM in marketing email, shown in every customer signature. */
export const STORE_ADDRESS = "1450 Clay Ave, Bronx, NY 10456";

export type EmailLocale = "en" | "es";
