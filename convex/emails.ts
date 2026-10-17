/**
 * LEGACY PATH SHIM: keeps `internal.emails.*` alive for jobs scheduled before the
 * convex/ domain-folder refactor. Delete once a prod deploy has been live longer
 * than the longest scheduled delay (WhatsApp reservation hold).
 */
export { sendAdminOrderAlert, sendCustomerReceipt, sendAdminDisputeAlert, sendOrderDispatchedEmail, sendOrderDeliveredEmail } from "./notifications/emails";
