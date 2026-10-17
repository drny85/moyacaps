/**
 * LEGACY PATH SHIM: keeps `internal.stripeCheckout.*` alive for jobs scheduled before the
 * convex/ domain-folder refactor. Delete once a prod deploy has been live longer
 * than the longest scheduled delay (WhatsApp reservation hold).
 */
export { expireOpenCheckoutSessionsInternal } from "./payments/checkout";
