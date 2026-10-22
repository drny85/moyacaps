/**
 * Small rules every transactional sender in emails.ts applies (security review M12): which
 * addresses are worth handing to Resend, and the site URL the emails link to. Pure.
 */
const FALLBACK_SITE_URL = "https://goodluckcaps.com";

/** Site links in emails: NEXT_PUBLIC_APP_URL without trailing slashes, else production. */
export function emailBaseUrl(appUrl: string | undefined): string {
  return (appUrl?.trim() || FALLBACK_SITE_URL).replace(/\/+$/, "");
}

/** A recipient worth sending to: one address with a local part and a dotted domain. */
export function isSendableEmail(email: string | null | undefined): email is string {
  if (!email) return false;
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email.trim());
}
