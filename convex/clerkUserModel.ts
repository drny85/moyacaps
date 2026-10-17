import { PRIMARY_ADMIN_EMAIL, PRIMARY_ADMIN_CLERK_ID } from "./auth";

/**
 * The subset of Clerk's UserJSON we mirror. Webhook `data` and the Backend API
 * (`GET /v1/users`) share this snake_case shape, so one mapper serves both paths.
 */
export type ClerkUserJSON = {
  id: string;
  primary_email_address_id?: string | null;
  email_addresses?: { id: string; email_address: string }[];
  primary_phone_number_id?: string | null;
  phone_numbers?: { id: string; phone_number: string }[];
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
};

export type UserUpsert = {
  clerkId: string;
  email: string;
  name?: string;
  role: "admin" | "customer";
  imageUrl?: string;
  phone?: string;
};

// SECURITY: admin is granted ONLY by the allowlist. Clerk publicMetadata is
// client-writable, so it must NEVER confer admin rights.
export function roleFor(email: string, clerkId: string): UserUpsert["role"] {
  return email === PRIMARY_ADMIN_EMAIL.toLowerCase() || clerkId === PRIMARY_ADMIN_CLERK_ID
    ? "admin"
    : "customer";
}

function primaryOf<T extends { id: string }>(items: T[] | undefined, primaryId?: string | null) {
  return items?.find((item) => item.id === primaryId) ?? items?.[0];
}

export function toUserUpsert(user: ClerkUserJSON): UserUpsert {
  const email = primaryOf(user.email_addresses, user.primary_email_address_id)
    ?.email_address.trim()
    .toLowerCase() ?? "";
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || undefined;
  const phone = primaryOf(user.phone_numbers, user.primary_phone_number_id)?.phone_number || undefined;

  return {
    clerkId: user.id,
    email,
    name,
    role: roleFor(email, user.id),
    imageUrl: user.image_url || undefined,
    phone,
  };
}
