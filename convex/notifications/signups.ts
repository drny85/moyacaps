/**
 * Shared rules for the public alert sign-ups: drop alerts (catalog/drops) and the Coming Soon
 * waitlist (notifications/launchAlerts). Both mutations are public and send email later, so
 * input is normalized here and each caller is rate-limited (security review M2): a bot that
 * signs up thousands of strangers would otherwise burn the sender reputation at launch.
 */
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";

const EMAIL_MAX = 254;
export const SIGNUP_NAME_MAX = 80;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The stored form of a sign-up contact: a lowercased email, or a WhatsApp number as digits
 * only (so "+1 (555) 123-4567" and "15551234567" are the same person). Throws on bad input.
 */
export function normalizeContact(channel: "email" | "whatsapp", raw: string): string {
  if (channel === "email") {
    const email = raw.trim().toLowerCase();
    if (email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email)) throw new Error("Enter a valid email");
    return email;
  }
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) throw new Error("Enter a valid WhatsApp number");
  return digits;
}

/** Trimmed display name, or undefined when blank. Throws when it is too long. */
export function normalizeSignupName(raw: string | undefined): string | undefined {
  const name = raw?.trim() || undefined;
  if (name && name.length > SIGNUP_NAME_MAX) throw new Error("Name is too long");
  return name;
}

const signupRateLimiter = new RateLimiter(components.rateLimiter, {
  // A person signs up for a few drops at most; 10 a minute leaves room for a busy drop page.
  alertSignupPerUser: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 10 },
  // Every signed-out visitor together (mutations see no IP): enough for a launch, not for a bot list.
  alertSignupAnonymous: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 30 },
});

/** Throws when the caller is over its sign-up budget. */
export async function enforceSignupRateLimit(ctx: MutationCtx, subject: string | undefined) {
  const { ok } = subject
    ? await signupRateLimiter.limit(ctx, "alertSignupPerUser", { key: subject })
    : await signupRateLimiter.limit(ctx, "alertSignupAnonymous");
  if (!ok) throw new Error("Too many sign-ups right now. Try again in a minute.");
}
