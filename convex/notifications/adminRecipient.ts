/**
 * Which inbox receives the store's admin alerts (new orders, disputes, out-of-territory orders,
 * cancellations, failed refunds, delivery exceptions). Read at send time from the deployment's
 * `ADMIN_NOTIFICATION_EMAIL`, so changing the variable takes effect without a redeploy. A blank or
 * malformed value falls back to the primary Administrator and says so.
 */
export type AdminRecipient = { email: string; fromEnv: boolean };

const SIMPLE_EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function resolveAdminRecipient(envValue: string | undefined, fallback: string): AdminRecipient {
  const value = (envValue ?? "").trim();
  if (SIMPLE_EMAIL.test(value)) return { email: value, fromEnv: true };
  return { email: fallback, fromEnv: false };
}
