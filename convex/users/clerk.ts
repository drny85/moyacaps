import { isAllowlistedAdmin } from "../lib/auth";

/**
 * The subset of Clerk's UserJSON we mirror. Webhook `data` and the Backend API
 * (`GET /v1/users`) share this snake_case shape, so one mapper serves both paths.
 */
export type ClerkUserJSON = {
  id: string;
  primary_email_address_id?: string | null;
  email_addresses?: { id: string; email_address: string; verification?: { status?: string } | null }[];
  primary_phone_number_id?: string | null;
  phone_numbers?: { id: string; phone_number: string }[];
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
};

export type UserUpsert = {
  clerkId: string;
  email: string;
  /** Clerk has verified `email` (its primary address); gates guest Order claims (ADR 0026). */
  emailVerified?: boolean;
  name?: string;
  role: "admin" | "customer";
  imageUrl?: string;
  phone?: string;
};

// SECURITY: admin is granted ONLY by the allowlist. Clerk publicMetadata is
// client-writable, so it must NEVER confer admin rights.
export function roleFor(email: string, clerkId: string, emailVerified: boolean | undefined): UserUpsert["role"] {
  return isAllowlistedAdmin({ subject: clerkId, email, emailVerified }) ? "admin" : "customer";
}

function primaryOf<T extends { id: string }>(items: T[] | undefined, primaryId?: string | null) {
  return items?.find((item) => item.id === primaryId) ?? items?.[0];
}

export function toUserUpsert(user: ClerkUserJSON): UserUpsert {
  const primaryEmail = primaryOf(user.email_addresses, user.primary_email_address_id);
  const email = primaryEmail?.email_address.trim().toLowerCase() ?? "";
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || undefined;
  const phone = primaryOf(user.phone_numbers, user.primary_phone_number_id)?.phone_number || undefined;

  const emailVerified = primaryEmail?.verification?.status === "verified";
  return {
    clerkId: user.id,
    email,
    emailVerified,
    name,
    role: roleFor(email, user.id, emailVerified),
    imageUrl: user.image_url || undefined,
    phone,
  };
}
