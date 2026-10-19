/**
 * One source of truth for public URLs in metadata, sitemaps and structured data.
 * Every canonical / hreflang / Open Graph URL is built here so they never drift apart.
 */
import { routing } from "../../i18n/config";

export type Locale = (typeof routing.locales)[number];

export const SITE_NAME = "Good Luck";
export const DEFAULT_SITE_URL = "https://goodluckcaps.com";
export const DEFAULT_OG_IMAGE = "/og/home.jpg";

/** Origin without a trailing slash, from NEXT_PUBLIC_SITE_URL (inlined at build). */
export function siteUrl(env: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  return (env || DEFAULT_SITE_URL).replace(/\/+$/, "");
}

/** Absolute URL for a site path or asset; absolute URLs (e.g. Convex storage) pass through. */
export function absoluteUrl(path: string, base: string = siteUrl()): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** `/{locale}{path}` as an absolute URL. `path` is "" for the locale home or starts with "/". */
export function localizedUrl(locale: string, path = "", base: string = siteUrl()): string {
  return `${base}/${locale}${path}`;
}

/** hreflang map for one page: every locale plus x-default (the default locale). */
export function languageAlternates(path = "", base: string = siteUrl()): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = localizedUrl(l, path, base);
  languages["x-default"] = localizedUrl(routing.defaultLocale, path, base);
  return languages;
}

/** `alternates` for Next metadata: self-canonical plus hreflang. */
export function pageAlternates(locale: string, path = "", base: string = siteUrl()) {
  return { canonical: localizedUrl(locale, path, base), languages: languageAlternates(path, base) };
}

export function ogLocale(locale: string): string {
  return locale === "es" ? "es_ES" : "en_US";
}

export function isLocale(value: string): value is Locale {
  return (routing.locales as readonly string[]).includes(value);
}
